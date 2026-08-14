'use strict';

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const leadsRouter    = require('./routes/leads');
const chatRouter     = require('./routes/chat');

const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'champion-backend', ts: new Date().toISOString() });
});

app.use('/api/leads', leadsLimiter, leadsRouter);

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
