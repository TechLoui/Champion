'use strict';

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const leadsRouter    = require('./routes/leads');
const chatRouter     = require('./routes/chat');
const contaRouter    = require('./routes/conta');

const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const { getDb, diagnosticarChave } = require('./lib/firebase');

const app = express();

/* O Railway serve atrás de um proxy, então o IP real do visitante vem no
   X-Forwarded-For. Sem isto o express-rate-limit avisa no log e, pior,
   passa a contar TODO MUNDO no mesmo balde (o IP do proxy) — o limite de
   30 mensagens viraria 30 para o site inteiro, não por pessoa.

   `1` e não `true`: confiar em toda a cadeia deixaria qualquer um forjar
   o cabeçalho e escapar do limite. Confiamos só no primeiro salto. */
app.set('trust proxy', 1);

/* Considera www.exemplo.com e exemplo.com a mesma origem: é o mesmo site,
   e sem isso quem entra pelo www leva erro de CORS enquanto quem entra sem
   o www funciona. Não amplia nada — só normaliza o que já foi liberado. */
function origemPermitida(origin) {
  /* Sem allowlist configurada, as rotas públicas (leads, chat) seguem abertas —
     é como sempre funcionou. Mas as rotas de conta carregam cookie de sessão, e
     aceitar origem desconhecida ali permitiria a qualquer site agir em nome do
     visitante logado. Por isso a liberação ampla vale só para o que não é conta;
     ver o guard em /api/conta abaixo. */
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes(origin)) return true;
  const semWww = origin.replace('://www.', '://');
  return allowedOrigins.includes(semWww);
}

/* Trava explícita: se ninguém configurou ALLOWED_ORIGINS, as rotas de conta não
   sobem. É preferível o login não funcionar a ficar exposto sem que se perceba. */
function exigirAllowlist(req, res, next) {
  if (allowedOrigins.length === 0) {
    console.error('[conta] ALLOWED_ORIGINS não configurado — rotas de conta desativadas.');
    return res.status(503).json({ error: 'Login indisponível: servidor sem origens autorizadas.' });
  }
  next();
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origemPermitida(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  /* Necessário para o cookie de sessão da conta do cliente viajar entre o site
     e este backend. Ver a trava em origemPermitida: com credenciais ligadas,
     liberar origem desconhecida deixaria qualquer site fazer requisição
     autenticada em nome do visitante. */
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(express.json({ limit: '64kb' }));

const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

/* Diz o que está configurado e o que realmente conecta. A diferença importa:
   variável presente não significa credencial válida — já aconteceu de a chave
   do Firebase chegar com a quebra de linha escapada duas vezes, passar na
   checagem de "existe" e falhar no PEM.

   Só booleanos e a mensagem do SDK. Nenhum valor de variável sai daqui. */
const BUILD = '2026-08-28-diag';

app.get('/api/health', async (_req, res) => {
  const cfg = {
    firebase: Boolean(
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
      || process.env.FIREBASE_SERVICE_ACCOUNT
    ),
    resend: Boolean(process.env.RESEND_API_KEY),
    emailDestino: Boolean(process.env.NOTIFICATION_EMAIL),
    llm: Boolean(process.env.LLM_API_KEY),
    shopify: Boolean(process.env.SHOPIFY_SHOP_ID && process.env.SHOPIFY_CUSTOMER_CLIENT_ID),
    allowedOrigins: allowedOrigins.length
  };

  /* Uma leitura de verdade: só ela distingue "variável existe" de "credencial
     funciona". Documento inexistente é resposta válida — o que importa é a
     chamada completar sem erro. */
  let firestore = false;
  let firestoreErro = null;
  try {
    const db = getDb();
    if (db) {
      await db.collection('_health').doc('ping').get();
      firestore = true;
    }
  } catch (err) {
    firestoreErro = String(err && err.message || err).slice(0, 160);
  }

  res.json({
    ok: true,
    service: 'champion-backend',
    /* Marcador de build: sem ele não dá para saber, de fora, se o deploy que
       você acabou de disparar já substituiu o processo antigo. */
    build: BUILD,
    ts: new Date().toISOString(),
    chave: diagnosticarChave(),
    config: cfg,
    firestore,
    firestoreErro,
    /* O que acontece com um lead que chegar agora. */
    leadsSeriamGravados: firestore,
    leadsSeriamNotificados: cfg.resend && cfg.emailDestino
  });
});

app.use('/api/leads', leadsLimiter, leadsRouter);

/* Conta do cliente (OAuth das novas contas da Shopify). Limite folgado: o
   /eu é consultado a cada carregamento de página pelo site. */
const contaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' }
});
app.use('/api/conta', exigirAllowlist, contaLimiter, contaRouter);

/* Chat: limite mais alto que leads (é uma conversa, não um formulário), mas
   ainda apertado — cada mensagem custa tokens, então a rota é um alvo óbvio
   para abuso se ficar aberta. */
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas mensagens seguidas. Aguarde um momento e tente de novo.' }
});

app.use('/api/chat', chatLimiter, chatRouter);
/* Checkout e pagamento migraram para o Shopify (checkout hospedado).
   As rotas Pagar.me (checkout/webhook) foram removidas. */

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.use((err, _req, res, _next) => {
  console.error('[champion-backend]', err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`[champion-backend] Servidor rodando na porta ${PORT}`);
});
