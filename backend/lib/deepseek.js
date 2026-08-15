'use strict';

/**
 * Cliente DeepSeek + loop de tool calling.
 *
 * A API da DeepSeek é compatível com o formato da OpenAI, então trocar de
 * provedor depois é mudar BASE_URL, MODEL e a chave — o resto do arquivo não
 * muda. Isso é de propósito: a escolha do modelo deve sair do teste, não estar
 * soldada no código.
 */

const tools = require('./tools');
const { buildSystemPrompt } = require('./prompt');

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const API_KEY = process.env.LLM_API_KEY || '';

/* Teto de idas e voltas com o modelo numa mesma mensagem do cliente.
   Um atendimento normal usa 3 ou 4 (buscar → detalhar → mostrar cards →
   responder). O limite existe para um loop de ferramenta com defeito não
   queimar a fatura. */
const MAX_ITERACOES = 8;

/* Quantas mensagens do histórico mandamos de volta. Atendimento não precisa de
   memória longa, e histórico curto = resposta mais barata e mais rápida. */
const MAX_HISTORICO = 20;

/* Resposta de escape quando o loop estoura. Fica aqui em vez de no prompt
   porque o modelo já não está respondendo neste ponto — é texto nosso. */
const FALLBACK = {
  pt: 'Não consegui concluir sua consulta agora. Pode chamar a gente no WhatsApp pelo 0800 723 1616 que a equipe te atende na hora.',
  en: "I couldn't complete your request right now. Please reach our team on WhatsApp or call 0800 723 1616.",
  es: 'No pude completar tu consulta ahora. Puedes hablar con nuestro equipo por WhatsApp o llamar al 0800 723 1616.'
};

function isConfigured() {
  return Boolean(API_KEY);
}

async function chamarModelo(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: tools.definitions,
      tool_choice: 'auto',
      /* 0.4 dá naturalidade ao texto de atendimento sem soltar a mão do
         modelo. Os números que importam vêm de ferramenta, não da amostragem. */
      temperature: 0.4,
      max_tokens: 1400
    }),
    signal: AbortSignal.timeout(45000)
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body.error && body.error.message) || `HTTP ${res.status}`;
    throw new Error(`LLM: ${msg}`);
  }

  const choice = body.choices && body.choices[0];
  if (!choice) throw new Error('LLM: resposta sem choices.');

  return { message: choice.message, usage: body.usage || null };
}

/**
 * Roda um turno completo: recebe o histórico da conversa e devolve a resposta
 * final em texto, já com todas as chamadas de ferramenta resolvidas.
 *
 * @param {Array<{role: string, content: string}>} historico
 * @param {string} [idiomaSite] Idioma da página (pt/en/es) — só palpite inicial
 * @returns {Promise<{ resposta: string, ferramentas: string[], usage: object }>}
 */
async function responder(historico, idiomaSite) {
  if (!isConfigured()) {
    throw new Error('LLM_API_KEY não configurada no backend.');
  }

  const messages = [{ role: 'system', content: buildSystemPrompt(idiomaSite) }].concat(
    (historico || [])
      .slice(-MAX_HISTORICO)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
  );

  const ferramentasUsadas = [];
  const usageTotal = { prompt_tokens: 0, completion_tokens: 0 };

  /* Canal lateral para dado estruturado. Cards de produto saem por aqui, não
     no texto — assim a foto chega ao widget como imagem de verdade em vez de
     uma URL solta no meio da frase. */
  const coletor = { cards: [] };

  for (let i = 0; i < MAX_ITERACOES; i += 1) {
    const { message, usage } = await chamarModelo(messages);

    if (usage) {
      usageTotal.prompt_tokens += usage.prompt_tokens || 0;
      usageTotal.completion_tokens += usage.completion_tokens || 0;
    }

    messages.push(message);

    const chamadas = message.tool_calls || [];
    if (!chamadas.length) {
      return {
        resposta: String(message.content || '').trim(),
        cards: coletor.cards,
        ferramentas: ferramentasUsadas,
        usage: usageTotal
      };
    }

    /* Ferramentas são independentes entre si — roda todas em paralelo e
       devolve os resultados na mesma rodada. */
    const resultados = await Promise.all(
      chamadas.map(async (call) => {
        const nome = call.function && call.function.name;
        let args = {};
        try {
          args = JSON.parse((call.function && call.function.arguments) || '{}');
        } catch (e) {
          return { call, saida: { erro: 'Argumentos inválidos (JSON malformado).' } };
        }
        ferramentasUsadas.push(nome);
        return { call, saida: await tools.execute(nome, args, coletor) };
      })
    );

    for (const { call, saida } of resultados) {
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(saida)
      });
    }
  }

  /* Estourou o teto de iterações — o modelo ficou preso chamando ferramenta.
     Não devolve texto vazio para o cliente. */
  return {
    resposta: FALLBACK[idiomaSite] || FALLBACK.pt,
    cards: coletor.cards,
    ferramentas: ferramentasUsadas,
    usage: usageTotal,
    truncado: true
  };
}

module.exports = { responder, isConfigured, MODEL };
