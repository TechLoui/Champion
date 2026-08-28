'use strict';

/* Champion · Conta do cliente (Shopify Customer Account API)
 *
 * A loja usa as NOVAS contas de cliente, onde o customerAccessTokenCreate da
 * Storefront API não existe. O caminho é OAuth 2.0 / OIDC, e a troca do code
 * pelo token precisa ser server-side — é por isso que isso mora aqui e não no
 * navegador.
 *
 * Fluxo:
 *   1. GET  /api/conta/login     → manda o visitante para a Shopify
 *   2. GET  /api/conta/callback  → Shopify volta com ?code, trocamos por token
 *   3. GET  /api/conta/eu        → quem está logado (para o site montar a UI)
 *   4. GET  /api/conta/pedidos   → pedidos do cliente autenticado
 *   5. POST /api/conta/sair      → encerra a sessão
 *
 * O token NUNCA vai para o navegador. O que vai é um id de sessão em cookie
 * httpOnly; o token fica no Firestore, associado a esse id.
 *
 * Variáveis de ambiente necessárias (Railway) — TODAS obrigatórias:
 *   SHOPIFY_SHOP_ID                 id numérico da loja (ex.: 57535168647)
 *   SHOPIFY_CUSTOMER_CLIENT_ID      client id do app de Customer Account API
 *   SHOPIFY_CUSTOMER_CLIENT_SECRET  secret DESSE app
 *   BACKEND_URL                     ex.: https://api.champion.ind.br
 *   SITE_URL                        ex.: https://champion.ind.br
 *
 * Atenção: o app de Customer Account API é OUTRO app, diferente do app
 * personalizado que fornece o token da Storefront. As credenciais não são
 * intercambiáveis — usar as do app errado devolve erro de cliente inválido.
 */

const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../lib/firebase');

const router = express.Router();

const SHOP_ID = process.env.SHOPIFY_SHOP_ID || '';
const CLIENT_ID = process.env.SHOPIFY_CUSTOMER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SHOPIFY_CUSTOMER_CLIENT_SECRET || '';
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
const SITE_URL = (process.env.SITE_URL || 'https://champion.ind.br').replace(/\/+$/, '');
const API_VERSION = process.env.SHOPIFY_CUSTOMER_API_VERSION || '2024-10';

const COOKIE_SESSAO = 'champion_conta';
const COOKIE_FLUXO = 'champion_oauth';
const SESSAO_DIAS = 30;

/* O secret é obrigatório, não opcional: o documento de descoberta desta loja
   lista token_endpoint_auth_methods_supported = client_secret_basic,
   client_secret_post — sem "none". Ou seja, o endpoint de token não aceita
   cliente público, e PKCE sozinho não basta.
   Conferir em: https://shopify.com/authentication/<SHOP_ID>/.well-known/openid-configuration */
const configurado = () => Boolean(SHOP_ID && CLIENT_ID && CLIENT_SECRET && BACKEND_URL);

function faltando() {
  return [
    !SHOP_ID && 'SHOPIFY_SHOP_ID',
    !CLIENT_ID && 'SHOPIFY_CUSTOMER_CLIENT_ID',
    !CLIENT_SECRET && 'SHOPIFY_CUSTOMER_CLIENT_SECRET',
    !BACKEND_URL && 'BACKEND_URL'
  ].filter(Boolean);
}

/* ── URLs da Shopify ─────────────────────────────────────────────────────── */
const authBase = () => `https://shopify.com/authentication/${SHOP_ID}`;
const apiUrl = () => `https://shopify.com/${SHOP_ID}/account/customer/api/${API_VERSION}/graphql`;
const redirectUri = () => `${BACKEND_URL}/api/conta/callback`;

/* ── Cookies ─────────────────────────────────────────────────────────────────
   Parsing manual em vez de cookie-parser: é um cookie só, e evitar dependência
   nova mantém o deploy do Railway sem surpresa.

   SameSite=None é obrigatório enquanto o backend estiver noutro domínio que o
   site. Quando o backend passar a responder em api.champion.ind.br, isso pode
   virar Lax — e aí o cookie deixa de ser de terceiros, que é o que Safari e
   Firefox bloqueiam por padrão. */
function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

function gravarCookie(res, nome, valor, segundos) {
  const partes = [
    `${nome}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    `Max-Age=${segundos}`
  ];
  const anteriores = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [].concat(anteriores, partes.join('; ')));
}

function apagarCookie(res, nome) {
  gravarCookie(res, nome, '', 0);
}

/* ── Sessões no Firestore ────────────────────────────────────────────────────
   O backend já usa firebase-admin, então não entra dependência nova. Guardamos
   o token aqui e no navegador só o id — se o cookie vazar, ainda é preciso
   estar dentro da validade e o token continua fora do alcance de script. */
const col = () => {
  const db = getDb();
  return db ? db.collection('customerSessions') : null;
};

async function salvarSessao(id, dados) {
  const c = col();
  if (!c) throw new Error('Firestore indisponível para guardar a sessão.');
  await c.doc(id).set(dados);
}

async function lerSessao(id) {
  const c = col();
  if (!c || !id) return null;
  const snap = await c.doc(id).get();
  return snap.exists ? snap.data() : null;
}

async function apagarSessao(id) {
  const c = col();
  if (c && id) await c.doc(id).delete().catch(() => {});
}

/* ── PKCE ────────────────────────────────────────────────────────────────── */
const base64url = (buf) => buf.toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function novoPkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

/* ── 1. Início do login ──────────────────────────────────────────────────── */
router.get('/login', (req, res) => {
  if (!configurado()) {
    const faltam = faltando();
    console.error('[conta] configuração incompleta — faltando: ' + faltam.join(', '));
    return res.status(503).json({
      error: 'Login de cliente ainda não configurado no servidor.',
      faltando: faltam
    });
  }

  const { verifier, challenge } = novoPkce();
  const state = base64url(crypto.randomBytes(16));
  const nonce = base64url(crypto.randomBytes(16));

  /* Para onde devolver depois de logar. Só caminho relativo: aceitar URL
     completa aqui seria um open redirect. */
  const destino = String(req.query.voltar || '/minha-conta');
  const voltar = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/minha-conta';

  gravarCookie(res, COOKIE_FLUXO, JSON.stringify({ verifier, state, nonce, voltar }), 600);

  const url = new URL(`${authBase()}/oauth/authorize`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', 'openid email customer-account-api:full');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  res.redirect(url.toString());
});

/* ── 2. Retorno da Shopify ───────────────────────────────────────────────── */
router.get('/callback', async (req, res) => {
  const falhar = (motivo) => {
    console.error('[conta] callback:', motivo);
    res.redirect(`${SITE_URL}/minha-conta?login=erro`);
  };

  try {
    if (!configurado()) return falhar('variáveis de ambiente ausentes');

    const bruto = lerCookie(req, COOKIE_FLUXO);
    apagarCookie(res, COOKIE_FLUXO);
    if (!bruto) return falhar('cookie de fluxo ausente (expirou ou foi bloqueado)');

    const fluxo = JSON.parse(bruto);
    if (!req.query.code) return falhar('sem code na volta');
    /* state confere que a volta pertence a este início de login — sem isso,
       um terceiro poderia forçar a troca de um code que não é do visitante. */
    if (req.query.state !== fluxo.state) return falhar('state divergente');

    const corpo = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      code: String(req.query.code),
      code_verifier: fluxo.verifier
    });

    /* client_secret_basic: é o método que esta loja anuncia suportar. O
       endpoint de token NÃO aceita cliente público — sem o secret a troca
       falha com erro genérico, difícil de diagnosticar. */
    const cabecalhos = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    };

    const r = await fetch(`${authBase()}/oauth/token`, {
      method: 'POST', headers: cabecalhos, body: corpo
    });
    if (!r.ok) return falhar(`troca de token HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);

    const tok = await r.json();
    if (!tok.access_token) return falhar('resposta sem access_token');

    const id = base64url(crypto.randomBytes(24));
    await salvarSessao(id, {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token || null,
      idToken: tok.id_token || null,
      expiraEm: Date.now() + (Number(tok.expires_in || 3600) * 1000),
      criadoEm: new Date().toISOString()
    });

    gravarCookie(res, COOKIE_SESSAO, id, SESSAO_DIAS * 24 * 60 * 60);
    res.redirect(SITE_URL + fluxo.voltar);
  } catch (e) {
    falhar(e.message);
  }
});

/* ── Customer Account API ────────────────────────────────────────────────── */
async function consultar(sessao, query, variables) {
  const r = await fetch(apiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      /* A Customer Account API recebe o token cru, sem o prefixo "Bearer". */
      Authorization: sessao.accessToken
    },
    body: JSON.stringify({ query, variables: variables || {} })
  });

  const texto = await r.text();
  if (!r.ok) throw new Error(`Customer Account API HTTP ${r.status}: ${texto.slice(0, 300)}`);

  const json = JSON.parse(texto);
  if (json.errors) throw new Error('GraphQL: ' + JSON.stringify(json.errors).slice(0, 300));
  return json.data;
}

/* Middleware: resolve a sessão ou responde 401. */
async function exigirSessao(req, res, next) {
  try {
    const id = lerCookie(req, COOKIE_SESSAO);
    const sessao = await lerSessao(id);
    if (!sessao) return res.status(401).json({ error: 'Não autenticado.' });
    if (sessao.expiraEm && Date.now() > sessao.expiraEm) {
      await apagarSessao(id);
      apagarCookie(res, COOKIE_SESSAO);
      return res.status(401).json({ error: 'Sessão expirada.' });
    }
    req.sessaoId = id;
    req.sessao = sessao;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Falha ao ler a sessão.' });
  }
}

/* ── 3. Quem está logado ─────────────────────────────────────────────────── */
router.get('/eu', async (req, res) => {
  const id = lerCookie(req, COOKIE_SESSAO);
  const sessao = await lerSessao(id);
  if (!sessao || (sessao.expiraEm && Date.now() > sessao.expiraEm)) {
    return res.json({ logado: false });
  }
  try {
    const d = await consultar(sessao, `
      query { customer {
        firstName lastName
        emailAddress { emailAddress }
      } }`);
    const c = d.customer || {};
    res.json({
      logado: true,
      nome: [c.firstName, c.lastName].filter(Boolean).join(' '),
      email: (c.emailAddress && c.emailAddress.emailAddress) || ''
    });
  } catch (e) {
    console.error('[conta] /eu:', e.message);
    res.json({ logado: false, erro: 'Não consegui confirmar a sessão.' });
  }
});

/* ── 4. Pedidos ──────────────────────────────────────────────────────────── */
router.get('/pedidos', exigirSessao, async (req, res) => {
  try {
    const d = await consultar(req.sessao, `
      query Pedidos($n: Int!) {
        customer {
          orders(first: $n, sortKey: PROCESSED_AT, reverse: true) {
            nodes {
              id
              number
              processedAt
              financialStatus
              fulfillmentStatus: fulfillments(first: 1) { nodes { status } }
              totalPrice { amount currencyCode }
              lineItems(first: 20) { nodes { title quantity } }
            }
          }
        }
      }`, { n: 20 });

    const nodes = (d.customer && d.customer.orders && d.customer.orders.nodes) || [];
    res.json({
      pedidos: nodes.map((o) => ({
        id: o.id,
        numero: o.number,
        data: o.processedAt,
        pagamento: o.financialStatus,
        entrega: (o.fulfillmentStatus && o.fulfillmentStatus.nodes[0] && o.fulfillmentStatus.nodes[0].status) || null,
        total: o.totalPrice ? Number(o.totalPrice.amount) : null,
        moeda: o.totalPrice ? o.totalPrice.currencyCode : 'BRL',
        itens: ((o.lineItems && o.lineItems.nodes) || []).map((i) => ({ titulo: i.title, qtd: i.quantity }))
      }))
    });
  } catch (e) {
    /* Nome de campo divergente do schema aparece aqui. A mensagem vai crua no
       log de propósito: é o que permite corrigir a query sem adivinhação. */
    console.error('[conta] /pedidos:', e.message);
    res.status(502).json({ error: 'Não consegui buscar seus pedidos agora.' });
  }
});

/* ── 5. Sair ─────────────────────────────────────────────────────────────── */
router.post('/sair', async (req, res) => {
  const id = lerCookie(req, COOKIE_SESSAO);
  await apagarSessao(id);
  apagarCookie(res, COOKIE_SESSAO);
  res.json({ ok: true });
});

module.exports = router;
