'use strict';

/* Champion · Webhook da Pagar.me
 * ============================================================================
 *  POST /api/webhooks/pagarme
 *  Recebe as notificações da Pagar.me e atualiza o status do pedido no Firestore.
 *
 *  Autenticidade: a Pagar.me v5 não assina o corpo (sem HMAC). Protegemos a rota
 *  com HTTP Basic Auth — configure o mesmo usuário/senha no painel da Pagar.me
 *  (na URL do webhook) e nas envs PAGARME_WEBHOOK_USER / PAGARME_WEBHOOK_PASS.
 *
 *  Idempotente: um pedido já "paid" nunca é rebaixado por um evento atrasado.
 * ============================================================================ */

const express = require('express');
const router  = express.Router();

const { getDb } = require('../lib/firebase');

function checkBasicAuth(req) {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASS;
  /* Sem credenciais configuradas: não bloqueia (mas avisa). Configure em produção! */
  if (!user && !pass) {
    console.warn('[webhook-pagarme] PAGARME_WEBHOOK_USER/PASS não configurados — rota desprotegida.');
    return true;
  }
  const header = req.headers.authorization || '';
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const p = idx >= 0 ? decoded.slice(idx + 1) : '';
  return u === user && p === pass;
}

router.post('/', async (req, res) => {
  if (!checkBasicAuth(req)) return res.status(401).json({ error: 'unauthorized' });

  const type = (req.body && req.body.type) || '';
  const data = (req.body && req.body.data) || {};

  /* O payload pode vir como um "order" ou como um "charge". */
  const order = data.object === 'order' ? data : (data.order || null);
  const metadata = (order && order.metadata) || data.metadata || {};
  const firestoreOrderId = metadata.firestoreOrderId || null;
  const pagarmeOrderId =
    (order && order.id) ||
    data.order_id ||
    (data.charge && data.charge.order_id) ||
    null;

  let newStatus = null;
  if (type === 'order.paid' || type === 'charge.paid') newStatus = 'paid';
  else if (type === 'charge.refunded') newStatus = 'refunded';
  else if (type === 'charge.payment_failed' || type === 'order.payment_failed') newStatus = 'failed';

  /* Eventos que não afetam o status do pedido: apenas confirmamos o recebimento. */
  if (!newStatus) return res.status(200).json({ ok: true, ignored: type });

  const db = getDb();
  if (!db) return res.status(200).json({ ok: true }); /* sem Admin: ack mesmo assim */

  try {
    let ref = null;
    if (firestoreOrderId) {
      ref = db.collection('orders').doc(firestoreOrderId);
    } else if (pagarmeOrderId) {
      const q = await db.collection('orders').where('pagarmeOrderId', '==', pagarmeOrderId).limit(1).get();
      if (!q.empty) ref = q.docs[0].ref;
    }
    if (!ref) return res.status(200).json({ ok: true, notFound: true });

    const snap = await ref.get();
    if (!snap.exists) return res.status(200).json({ ok: true, notFound: true });

    const current = snap.data() || {};
    const cur = current.status;

    /* Transições idempotentes / sem rebaixar estados finais:
       - paid:     só aplica se ainda não estava pago/estornado;
       - refunded: aplica mesmo vindo de paid (estorno é transição válida), exceto se já estornado;
       - failed:   nunca rebaixa um pedido pago ou estornado. */
    if (newStatus === 'paid' && (cur === 'paid' || cur === 'refunded')) {
      return res.status(200).json({ ok: true, noop: true });
    }
    if (newStatus === 'refunded' && cur === 'refunded') {
      return res.status(200).json({ ok: true, noop: true });
    }
    if (newStatus === 'failed' && (cur === 'paid' || cur === 'refunded')) {
      return res.status(200).json({ ok: true, noop: true });
    }

    const patch = { status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === 'paid') patch.paidAt = new Date().toISOString();
    if (newStatus === 'refunded') patch.refundedAt = new Date().toISOString();
    await ref.set(patch, { merge: true });

    return res.status(200).json({ ok: true, status: newStatus });
  } catch (err) {
    console.error('[webhook-pagarme]', err.message);
    /* 500 → a Pagar.me reenvia depois (a operação é idempotente). */
    return res.status(500).json({ error: 'retry' });
  }
});

module.exports = router;
