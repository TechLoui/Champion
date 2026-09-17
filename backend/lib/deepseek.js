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
const flow = require('./chat-flow');

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

async function chamarModelo(messages, detalhado = false) {
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
      max_tokens: detalhado ? 1000 : 350
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
async function responder(historico, idiomaSite, opcoes = {}) {
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
     uma URL solta no meio da frase.

     `vistos` guarda tudo que foi consultado; serve de rede de segurança para
     quando o modelo fala do produto mas esquece de pedir o card. */
  const coletor = { cards: [], vistos: [], carrinho: [] };

  const ultimaMensagem = messages.filter((m) => m.role === 'user').at(-1);
  coletor.mensagemCliente = ultimaMensagem?.content || '';
  const idioma = flow.idiomaDoCliente(coletor.mensagemCliente, idiomaSite);
  const detalhado = /composi[cç][aã]o|modo de us|dosagem|detalhe completo|expli(?:que|car) em detalhe|composition|instructions|composici[oó]n/i.test(coletor.mensagemCliente);
  if (ultimaMensagem) {
    try {
      const catalogo = await flow.catalogoDireto(ultimaMensagem.content, historico, idioma, opcoes.catalogoOffset);
      if (catalogo) return catalogo;
      const recusa = flow.recusaConfirmacao(historico, idioma);
      if (recusa) return recusa;
      const confirmado = await flow.produtoConfirmado(historico);
      const consulta = confirmado || await tools.consultarMencionados(ultimaMensagem.content, coletor);
      if (consulta) {
        if (!consulta.produtos.length && consulta.sugestoes?.length) return flow.perguntaConfirmacao(consulta.sugestoes, idioma);
        if (confirmado || flow.ehConsultaSimples(ultimaMensagem.content)) {
          const breve = flow.consultaBreve(consulta, idioma);
          if (breve) return breve;
        }
        const id = 'consulta_nome_cliente';
        messages.push({
          role: 'assistant', content: null,
          tool_calls: [{ id, type: 'function', function: {
            name: 'buscar_produtos', arguments: JSON.stringify({ termo: ultimaMensagem.content })
          } }]
        }, { role: 'tool', tool_call_id: id, content: JSON.stringify(consulta) });
        ferramentasUsadas.push('buscar_produtos');
      }
    } catch (err) {
      /* A indisponibilidade do catálogo não impede atendimento institucional
         nem deve virar uma falsa afirmação de produto inexistente. */
      console.error('[chat] consulta inicial falhou:', err.message);
      messages.push({ role: 'system', content: 'A consulta inicial ao catálogo falhou. Se a mensagem trata de produto, tente buscar_produtos; se a ferramenta falhar, informe indisponibilidade temporária. Não diga que o produto não existe.' });
    }
  }

  for (let i = 0; i < MAX_ITERACOES; i += 1) {
    const { message, usage } = await chamarModelo(messages, detalhado);

    if (usage) {
      usageTotal.prompt_tokens += usage.prompt_tokens || 0;
      usageTotal.completion_tokens += usage.completion_tokens || 0;
    }

    messages.push(message);

    const chamadas = message.tool_calls || [];
    if (!chamadas.length) {
      const resposta = String(message.content || '').trim();

      /* O modelo citou o produto e não pediu o card? Mostramos assim mesmo.
         Sem isso o cliente lê "aí estão as três apresentações" e não vê nada. */
      const cards = await tools.resolverCards(resposta, coletor);

      return {
        resposta,
        cards,
        /* Itens que o agente mandou para o carrinho do site nesta mensagem.
           O widget os adiciona ao champion-cart — não existe carrinho
           paralelo nem link de pagamento solto na conversa. */
        carrinho: coletor.carrinho,
        ferramentas: ferramentasUsadas,
        usage: usageTotal
      };
    }

    /* O coletor é compartilhado: busca, confirmação e carrinho dependem
       dos resultados anteriores. Não permite uma ficha ultrapassar a
       trava de aproximação por uma corrida de chamadas paralelas. */
    const resultados = [];
    for (const call of chamadas) {
        const nome = call.function && call.function.name;
        let args = {};
        try {
          args = JSON.parse((call.function && call.function.arguments) || '{}');
        } catch (e) {
          resultados.push({ call, saida: { erro: 'Argumentos inválidos (JSON malformado).' } });
          continue;
        }
        ferramentasUsadas.push(nome);
        resultados.push({ call, saida: await tools.execute(nome, args, coletor) });
    }

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
    carrinho: coletor.carrinho,
    ferramentas: ferramentasUsadas,
    usage: usageTotal,
    truncado: true
  };
}

module.exports = { responder, isConfigured, MODEL };
