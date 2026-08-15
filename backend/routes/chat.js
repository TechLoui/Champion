'use strict';

const express = require('express');
const router = express.Router();

const llm = require('../lib/deepseek');
const shopify = require('../lib/shopify');
const { getDb } = require('../lib/firebase');

/* Limites do payload. Atendimento não precisa de mensagem gigante, e teto
   pequeno é a defesa mais barata contra alguém tentar usar a rota como
   um LLM grátis. */
const MAX_MENSAGEM = 1500;
const MAX_HISTORICO = 20;

/* Erros da própria rota (quando o modelo nem chegou a responder) precisam sair
   no idioma da página — o cliente não deveria ver português no site em inglês. */
const ERROS = {
  indisponivel: {
    pt: 'O atendimento por chat está temporariamente indisponível.',
    en: 'Chat support is temporarily unavailable.',
    es: 'La atención por chat no está disponible en este momento.'
  },
  vazia: {
    pt: 'Mensagem vazia.',
    en: 'Empty message.',
    es: 'Mensaje vacío.'
  },
  falha: {
    pt: 'Não consegui responder agora. Chama a gente no WhatsApp ou no 0800 723 1616 que a equipe te atende.',
    en: 'I could not respond right now. Please reach us on WhatsApp or call 0800 723 1616.',
    es: 'No pude responder ahora. Escríbenos por WhatsApp o llama al 0800 723 1616.'
  }
};

function erro(chave, idioma) {
  return ERROS[chave][idioma] || ERROS[chave].pt;
}

function lerIdioma(body) {
  const l = String((body && body.idioma) || '').toLowerCase();
  return ['pt', 'en', 'es'].includes(l) ? l : 'pt';
}

/* Grava a conversa no Firestore. Serve para três coisas: melhorar o prompt
   com o que os clientes realmente perguntam, descobrir produto que falta no
   catálogo, e ter registro do que o agente respondeu.
   Nunca derruba a resposta ao cliente — se o log falhar, o chat segue. */
async function registrarConversa(dados) {
  const db = getDb();
  if (!db) return;

  try {
    await db.collection('chat-conversas').add({
      sessionId: dados.sessionId,
      idioma: dados.idioma || null,
      pergunta: dados.pergunta,
      resposta: dados.resposta,
      ferramentas: dados.ferramentas,
      modelo: llm.MODEL,
      usage: dados.usage || null,
      truncado: Boolean(dados.truncado),
      criadoEm: new Date().toISOString()
    });
  } catch (err) {
    console.error('[chat] log falhou:', err.message);
  }
}

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    llm: llm.isConfigured(),
    shopify: shopify.isConfigured(),
    modelo: llm.MODEL
  });
});

router.post('/', async (req, res) => {
  const body = req.body || {};

  /* Idioma da página, só como palpite para a primeira mensagem. O que manda é
     o idioma em que o cliente escreveu — regra que vive no system prompt.
     Allowlist fechada: valor arbitrário aqui viraria injeção no prompt. */
  const idiomaSite = lerIdioma(body);

  if (!llm.isConfigured()) {
    return res.status(503).json({ error: erro('indisponivel', idiomaSite) });
  }

  const mensagem = String(body.mensagem || '').trim().slice(0, MAX_MENSAGEM);
  const sessionId = String(body.sessionId || '').trim().slice(0, 64) || 'anon';

  if (!mensagem) {
    return res.status(400).json({ error: erro('vazia', idiomaSite) });
  }

  /* O histórico vem do cliente (o backend é stateless, como o resto da API).
     Por isso ele é tratado como entrada não confiável: só role user/assistant,
     truncado, e o system prompt é sempre montado no servidor — nunca aceito
     do payload. Sem isso, dava para reescrever as regras do agente pelo
     DevTools. */
  const historico = Array.isArray(body.historico)
    ? body.historico
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
        .slice(-MAX_HISTORICO)
        .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, MAX_MENSAGEM) }))
    : [];

  historico.push({ role: 'user', content: mensagem });

  try {
    const resultado = await llm.responder(historico, idiomaSite);

    /* Não espera o log para responder — o cliente não deve pagar a latência
       do Firestore. */
    registrarConversa({
      sessionId,
      idioma: idiomaSite,
      pergunta: mensagem,
      resposta: resultado.resposta,
      ferramentas: resultado.ferramentas,
      usage: resultado.usage,
      truncado: resultado.truncado
    });

    res.json({
      resposta: resultado.resposta,
      /* Cards de produto: dado estruturado, renderizado pelo widget com a foto
         de verdade. Não é texto e não passa pelo modelo de novo. */
      produtos: resultado.cards || [],
      ferramentas: resultado.ferramentas
    });
  } catch (err) {
    console.error('[chat] falhou:', err.message);
    res.status(502).json({ error: erro('falha', idiomaSite) });
  }
});

module.exports = router;
