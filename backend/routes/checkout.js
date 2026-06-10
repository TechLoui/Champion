'use strict';

/* Champion · Checkout (Pagar.me API v5)
 * ============================================================================
 *  POST /api/checkout        → cria um pedido na Pagar.me (Pix ou cartão) e
 *                              grava o pedido no Firestore (Admin) como pendente
 *                              até a confirmação do pagamento.
 *  GET  /api/checkout/:id/status → status do pedido (usado no polling do Pix).
 *
 *  Segurança:
 *   • A secret key (sk_live) só existe aqui (env PAGARME_SECRET_KEY). Nunca no
 *     frontend nem no repositório.
 *   • O dado do cartão NÃO trafega por aqui: o browser tokeniza com a public key
 *     e envia apenas o card_token (PCI-friendly).
 *   • O cliente é identificado pelo Firebase ID token verificado no Admin — não
 *     por um campo enviado no corpo da requisição.
 *   • O total é recalculado a partir do preço real no Firestore quando o produto
 *     existe lá; produtos fora do Firestore caem no preço do cliente sanitizado.
 * ============================================================================ */

const express = require('express');
const router  = express.Router();

const { getAdmin, getDb } = require('../lib/firebase');

const PAGARME_BASE = 'https://api.pagar.me/core/v5';

/* ─────────── Helpers ─────────── */
function sanitize(value, maxLength = 500) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

/* Identifica o cliente pelo Firebase ID token (Authorization: Bearer ...). */
async function verifyUid(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const admin = getAdmin();
  if (!admin) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1].trim());
    return decoded.uid;
  } catch (err) {
    return null;
  }
}

/* Verifica que o requisitante é admin (blogAdmins/{uid}.active === true). */
async function verifyAdmin(req) {
  const uid = await verifyUid(req);
  if (!uid) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection('blogAdmins').doc(uid).get();
    return (snap.exists && snap.data() && snap.data().active === true) ? uid : null;
  } catch (err) {
    return null;
  }
}

/* Chamada autenticada à Pagar.me (Basic Auth: secret key como usuário). */
async function pagarme(path, body, method) {
  const sk = process.env.PAGARME_SECRET_KEY;
  if (!sk) throw new Error('PAGARME_SECRET_KEY não configurada.');
  const auth = Buffer.from(sk + ':').toString('base64');
  const opts = {
    method: method || 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  };
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(PAGARME_BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

/* "(64) 99999-1234" → { country_code, area_code, number } */
function parsePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return null;
  return { country_code: '55', area_code: d.slice(0, 2), number: d.slice(2) };
}

/* CPF (11) → individual · CNPJ (14) → company */
function parseDoc(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11) return { document: d, document_type: 'CPF', type: 'individual' };
  if (d.length === 14) return { document: d, document_type: 'CNPJ', type: 'company' };
  return null;
}

/* Preço confiável em centavos. Usa o Firestore quando o produto existe lá
   (impede adulteração de preço); senão confia no preço do cliente sanitizado. */
async function priceCents(db, item) {
  const clientPrice = Number(item.price);
  const clientCents = Number.isFinite(clientPrice) && clientPrice > 0
    ? Math.round(clientPrice * 100) : null;
  if (!db) return clientCents;
  try {
    const rawId = String(item.id || '');
    const baseId = rawId.split('|')[0];
    if (!baseId) return clientCents;
    const snap = await db.collection('products').doc(baseId).get();
    if (!snap.exists) return clientCents; /* produto demo fora do Firestore */
    const p = snap.data() || {};
    const variantId = rawId.includes('|') ? rawId.slice(rawId.indexOf('|') + 1) : null;
    let price = Number(p.price);
    if (variantId && Array.isArray(p.variants)) {
      const v = p.variants.find((x) => String(x.id) === variantId);
      if (v && Number.isFinite(Number(v.price))) price = Number(v.price);
    }
    if (!Number.isFinite(price) && Array.isArray(p.variants) && p.variants.length) {
      const prices = p.variants.map((v) => Number(v.price)).filter(Number.isFinite);
      if (prices.length) price = Math.min.apply(null, prices);
    }
    if (Number.isFinite(price) && price > 0) return Math.round(price * 100);
    return clientCents;
  } catch (err) {
    console.warn('[checkout] priceCents fallback:', err.message);
    return clientCents;
  }
}

/* Próximo número de pedido (mesma lógica do order-store do frontend). */
async function nextOrderNumber(db) {
  try {
    const snap = await db.collection('orders').get();
    let max = 10400;
    snap.forEach((doc) => {
      const n = parseInt(String((doc.data() || {}).number || '').replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
    return String(max + 1);
  } catch (err) {
    return String(10401 + Math.floor(Math.random() * 1000));
  }
}

/* Mapeia o status da Pagar.me para o status interno do pedido. */
function mapStatus(pgStatus, method) {
  if (pgStatus === 'paid') return 'paid';
  if (pgStatus === 'failed' || pgStatus === 'canceled') return 'failed';
  if (method === 'credit_card') return 'processing';
  return 'pending'; /* pix e boleto: aguardando pagamento */
}

/* ═══════════════════════ POST /api/checkout ═══════════════════════ */
router.post('/', async (req, res) => {
  try {
    const uid = await verifyUid(req);
    if (!uid) return res.status(401).json({ error: 'Faça login para finalizar a compra.' });

    const body = req.body || {};
    const rawMethod = sanitize(body.paymentMethod, 20).toLowerCase();
    const method = (rawMethod === 'credit_card' || rawMethod === 'cartao' || rawMethod === 'card')
      ? 'credit_card'
      : (rawMethod === 'pix' ? 'pix'
      : (rawMethod === 'boleto' ? 'boleto' : null));
    if (!method) return res.status(422).json({ error: 'Forma de pagamento inválida.' });

    const c = body.customer || {};
    const name  = sanitize(c.name, 120);
    const email = sanitize(c.email, 200).toLowerCase();
    if (!name || !email) return res.status(422).json({ error: 'Nome e e-mail são obrigatórios.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({ error: 'E-mail inválido.' });

    const doc = parseDoc(c.cpfCnpj || c.document);
    if (!doc) return res.status(422).json({ error: 'Informe um CPF ou CNPJ válido.' });
    const phone = parsePhone(c.phone);

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return res.status(422).json({ error: 'Carrinho vazio.' });

    const db = getDb();

    /* Itens com preço confiável (centavos) */
    const items = [];
    let subtotal = 0;
    for (const it of rawItems) {
      const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
      const cents = await priceCents(db, it);
      if (!cents || cents <= 0) {
        return res.status(422).json({ error: 'Produto com preço inválido: ' + sanitize(it.name || it.id, 80) });
      }
      subtotal += cents * qty;
      items.push({
        amount: cents,
        description: sanitize(it.name, 120) || 'Produto',
        quantity: qty,
        code: String(it.id || '').slice(0, 60)
      });
    }

    /* Frete: grátis a partir de R$500, senão R$38 (mesma regra do checkout) */
    const shipping = subtotal >= 50000 ? 0 : 3800;
    const total = subtotal + shipping;
    if (shipping > 0) {
      items.push({ amount: shipping, description: 'Frete', quantity: 1, code: 'frete' });
    }

    /* Pagamento */
    const payment = {};
    if (method === 'pix') {
      payment.payment_method = 'pix';
      payment.pix = { expires_in: 3600 };
    } else if (method === 'boleto') {
      const due = new Date();
      due.setDate(due.getDate() + 3); /* vencimento em 3 dias */
      payment.payment_method = 'boleto';
      payment.boleto = { instructions: 'Pague em qualquer banco ou app até o vencimento.', due_at: due.toISOString() };
    } else {
      const cardToken = sanitize(body.card_token, 120);
      if (!cardToken) return res.status(422).json({ error: 'Não foi possível ler os dados do cartão.' });
      const installments = Math.max(1, Math.min(12, parseInt(body.installments, 10) || 1));
      payment.payment_method = 'credit_card';
      payment.credit_card = {
        installments: installments,
        statement_descriptor: 'CHAMPION',
        card_token: cardToken
      };
    }

    const orderId = 'ord-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const number = db ? await nextOrderNumber(db) : String(10401);

    const pgBody = {
      items: items,
      customer: {
        name: name,
        email: email,
        type: doc.type,
        document: doc.document,
        document_type: doc.document_type,
        phones: phone ? { mobile_phone: phone } : undefined
      },
      payments: [payment],
      metadata: { firestoreOrderId: orderId, orderNumber: number }
    };

    const pg = await pagarme('/orders', pgBody);
    if (!pg.ok) {
      console.error('[checkout] Pagar.me erro', pg.status, JSON.stringify(pg.data).slice(0, 600));
      const detail = pg.data && (pg.data.message
        || (pg.data.errors && Object.values(pg.data.errors).flat().join(' ')));
      return res.status(402).json({ error: detail || 'Pagamento não autorizado. Confira os dados e tente novamente.' });
    }

    const data    = pg.data || {};
    const charge  = (Array.isArray(data.charges) && data.charges[0]) || {};
    const lastTx  = charge.last_transaction || {};
    const pgStatus = data.status || charge.status || '';
    const status  = mapStatus(pgStatus, method);

    /* Persiste o pedido no Firestore (Admin ignora as rules) */
    const now = new Date().toISOString();
    const orderDoc = {
      number: number,
      customerId: uid,
      customer: { name: name, email: email, phone: sanitize(c.phone, 30), cpfCnpj: doc.document },
      address: body.address || null,
      items: rawItems.map((i) => ({
        id: String(i.id || ''),
        name: sanitize(i.name, 120),
        price: Number(i.price) || 0,
        qty: Math.max(1, parseInt(i.qty, 10) || 1),
        image: sanitize(i.image, 300)
      })),
      subtotal: subtotal / 100,
      shipping: shipping / 100,
      total: total / 100,
      paymentMethod: method === 'credit_card' ? 'cartao' : method,
      status: status,
      pagarmeOrderId: data.id || null,
      pagarmeChargeId: charge.id || null,
      paidAt: status === 'paid' ? now : null,
      createdAt: now,
      updatedAt: now,
      notes: ''
    };
    /* Guarda o Pix no pedido para o cliente reabrir o QR depois ("Pagar agora"). */
    if (method === 'pix' && (lastTx.qr_code || lastTx.qr_code_url)) {
      orderDoc.pix = {
        qr_code: lastTx.qr_code || '',
        qr_code_url: lastTx.qr_code_url || '',
        expires_at: lastTx.expires_at || ''
      };
    }
    /* Guarda o boleto (linha digitável + PDF) para reexibir depois ("Ver boleto"). */
    if (method === 'boleto') {
      orderDoc.boleto = {
        line: lastTx.line || '',
        pdf: lastTx.pdf || '',
        url: lastTx.url || '',
        barcode: lastTx.barcode || '',
        due_at: lastTx.due_at || ''
      };
    }
    if (db) {
      try { await db.collection('orders').doc(orderId).set(orderDoc); }
      catch (err) { console.error('[checkout] Firestore save falhou:', err.message); }
    }

    const resp = {
      orderId: orderId,
      orderNumber: number,
      status: status,
      paymentMethod: orderDoc.paymentMethod
    };
    if (method === 'pix') {
      resp.pix = {
        qr_code: lastTx.qr_code || '',
        qr_code_url: lastTx.qr_code_url || '',
        expires_at: lastTx.expires_at || ''
      };
    }
    if (method === 'boleto') {
      resp.boleto = {
        line: lastTx.line || '',
        pdf: lastTx.pdf || '',
        url: lastTx.url || ''
      };
    }
    return res.status(201).json(resp);
  } catch (err) {
    console.error('[checkout]', err);
    return res.status(500).json({ error: 'Erro ao processar o checkout. Tente novamente.' });
  }
});

/* ═══════════════════════ GET /api/checkout/:id/status ═══════════════════════ */
router.get('/:id/status', async (req, res) => {
  const uid = await verifyUid(req);
  if (!uid) return res.status(401).json({ error: 'Não autorizado.' });
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Serviço indisponível.' });
  try {
    const snap = await db.collection('orders').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const o = snap.data() || {};
    if (o.customerId !== uid) return res.status(403).json({ error: 'Não autorizado.' });
    return res.json({ status: o.status, orderNumber: o.number });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar o pedido.' });
  }
});

/* ═══════════════════════ POST /api/checkout/:id/refund (admin) ═══════════════════════ */
router.post('/:id/refund', async (req, res) => {
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return res.status(403).json({ error: 'Apenas administradores podem estornar.' });
  const db = getDb();
  if (!db) return res.status(503).json({ error: 'Serviço indisponível.' });
  try {
    const ref = db.collection('orders').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const o = snap.data() || {};
    if (o.status === 'refunded') return res.json({ status: 'refunded', alreadyRefunded: true });
    const chargeId = o.pagarmeChargeId;
    if (!chargeId) return res.status(422).json({ error: 'Pedido sem cobrança vinculada na Pagar.me.' });

    /* Estorno total: DELETE da cobrança (sem amount = valor integral). */
    const pg = await pagarme('/charges/' + encodeURIComponent(chargeId), null, 'DELETE');
    if (!pg.ok) {
      console.error('[checkout] refund erro', pg.status, JSON.stringify(pg.data).slice(0, 400));
      const detail = pg.data && (pg.data.message
        || (pg.data.errors && Object.values(pg.data.errors).flat().join(' ')));
      return res.status(402).json({ error: detail || 'Não foi possível estornar a cobrança.' });
    }

    const now = new Date().toISOString();
    await ref.set({ status: 'refunded', refundedAt: now, updatedAt: now }, { merge: true });
    return res.json({ status: 'refunded' });
  } catch (err) {
    console.error('[checkout] refund', err.message);
    return res.status(500).json({ error: 'Erro ao estornar o pedido.' });
  }
});

module.exports = router;
