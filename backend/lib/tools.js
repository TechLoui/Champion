'use strict';

/**
 * Ferramentas do agente.
 *
 * Esta é a trava arquitetural: o agente só consegue fazer o que existe aqui.
 * Não há ferramenta de diagnóstico nem de cálculo de dose, então não existe
 * caminho para ele fazer isso — independente do que o cliente peça ou de como
 * o prompt seja contornado.
 *
 * Formato compatível com a API da DeepSeek (mesmo shape da OpenAI).
 */

const shopify = require('./shopify');
const site = require('./site');

const definitions = [
  {
    type: 'function',
    function: {
      name: 'buscar_produtos',
      description:
        'Busca produtos no catálogo Champion por termo livre (nome, espécie, tipo). ' +
        'Devolve nome, resumo, foto, preço por apresentação e link da página. ' +
        'Use sempre que o cliente perguntar o que existe, quanto custa ou o que serve para algo.',
      parameters: {
        type: 'object',
        properties: {
          termo: {
            type: 'string',
            description: 'O que buscar. Ex: "difly", "sal mineral bovinos", "vermifugo". Vazio lista o catálogo.'
          },
          limite: {
            type: 'integer',
            description: 'Quantos produtos retornar (1 a 12). Padrão 6.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'detalhes_produto',
      description:
        'Ficha completa de um produto: descrição, modo de uso do rótulo e apresentações. ' +
        'Use quando o cliente pedir detalhe, composição ou como usar. ' +
        'O campo modo_de_uso é o texto do rótulo — repasse como está, nunca adapte.',
      parameters: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description: 'Identificador do produto, vindo de buscar_produtos. Ex: "difly-s3".'
          }
        },
        required: ['handle']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mostrar_produtos',
      description:
        'Exibe cards visuais dos produtos na conversa, com FOTO, preço e botão de comprar. ' +
        'É assim que o cliente vê a imagem do produto — escrever a URL da foto no texto NÃO mostra imagem nenhuma. ' +
        'Chame sempre que recomendar ou citar produtos, logo depois da sua mensagem de texto. ' +
        'Escolha só os produtos que você realmente recomendou, não tudo que a busca devolveu.',
      parameters: {
        type: 'object',
        properties: {
          handles: {
            type: 'array',
            description: 'Handles dos produtos a exibir, na ordem. Máximo 4.',
            items: { type: 'string' }
          }
        },
        required: ['handles']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'buscar_conteudo',
      description:
        'Busca no conteúdo técnico do site (blog Champion): mineralização, manejo, sanidade, nutrição. ' +
        'Use quando o cliente fizer uma dúvida técnica geral de pecuária que o site já responde, ' +
        'ou quando quiser embasar uma recomendação. Devolve trechos e o link do artigo.',
      parameters: {
        type: 'object',
        properties: {
          termo: {
            type: 'string',
            description: 'Assunto a buscar. Ex: "mineralização seca", "mosca dos chifres", "consumo de sal".'
          }
        },
        required: ['termo']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'montar_carrinho',
      description:
        'Cria o carrinho no Shopify e devolve o link de pagamento oficial. ' +
        'Só chame depois de confirmar com o cliente qual apresentação e quantas unidades. ' +
        'Repasse o link exatamente como voltar.',
      parameters: {
        type: 'object',
        properties: {
          itens: {
            type: 'array',
            description: 'Apresentações escolhidas pelo cliente.',
            items: {
              type: 'object',
              properties: {
                variantId: {
                  type: 'string',
                  description: 'ID da apresentação (campo variantId vindo de buscar_produtos).'
                },
                quantidade: { type: 'integer', description: 'Unidades (1 a 99).' }
              },
              required: ['variantId', 'quantidade']
            }
          }
        },
        required: ['itens']
      }
    }
  }
];

/* Executores. Cada um devolve um objeto que vira JSON no tool_result.
   Erros voltam como { erro: "..." } para o modelo poder se recuperar e
   avisar o cliente, em vez de derrubar a conversa inteira.

   `coletor` é o canal lateral: o que for empurrado em coletor.cards sai na
   resposta HTTP como dado estruturado, não como texto. É por ali que a foto
   do produto chega ao widget — o modelo não consegue "desenhar" uma imagem
   escrevendo uma URL no meio da frase. */
const executors = {
  async buscar_produtos(args) {
    const produtos = await shopify.buscarProdutos(args.termo, args.limite);
    if (!produtos.length) {
      return { produtos: [], aviso: 'Nenhum produto encontrado para esse termo.' };
    }
    return { produtos };
  },

  async detalhes_produto(args) {
    const produto = await shopify.detalhesProduto(args.handle);
    if (!produto) return { erro: 'Produto não encontrado com esse handle.' };
    return { produto };
  },

  async mostrar_produtos(args, coletor) {
    const handles = (Array.isArray(args.handles) ? args.handles : [])
      .map((h) => String(h || '').trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!handles.length) return { erro: 'Nenhum handle informado.' };

    const produtos = (await Promise.all(handles.map((h) => shopify.detalhesProduto(h))))
      .filter(Boolean);

    if (!produtos.length) {
      return { erro: 'Nenhum dos handles foi encontrado. Confira com buscar_produtos.' };
    }

    if (coletor) {
      produtos.forEach((p) => {
        /* Evita repetir o mesmo card se o modelo chamar duas vezes. */
        if (!coletor.cards.some((c) => c.handle === p.handle)) {
          coletor.cards.push({
            handle: p.handle,
            nome: p.nome,
            resumo: p.resumo,
            foto: p.foto,
            url: p.url,
            /* Lista completa: o card monta um slide por apresentação, com
               nome e preço. Sem isso o cliente vê um preço só e não percebe
               que existe embalagem maior — que é justamente onde o custo por
               dose cai e a venda cresce. */
            apresentacoes: p.apresentacoes
          });
        }
      });
    }

    return {
      exibidos: produtos.map((p) => p.nome),
      instrucao: 'Os cards já apareceram para o cliente com foto e preço. Não repita a URL da imagem no texto.'
    };
  },

  async buscar_conteudo(args) {
    const artigos = await site.buscarConteudo(args.termo, 3);
    if (!artigos.length) {
      return {
        artigos: [],
        aviso: 'Nada encontrado no conteúdo do site sobre isso. Não improvise: ofereça a equipe técnica.'
      };
    }
    return { artigos };
  },

  async montar_carrinho(args) {
    return await shopify.montarCarrinho(args.itens);
  }
};

async function execute(name, args, coletor) {
  const fn = executors[name];
  if (!fn) return { erro: `Ferramenta desconhecida: ${name}` };

  try {
    return await fn(args || {}, coletor);
  } catch (err) {
    console.error(`[chat] ferramenta ${name} falhou:`, err.message);
    return {
      erro: err.message,
      instrucao: 'Não foi possível consultar agora. Peça desculpas e ofereça o WhatsApp.'
    };
  }
}

module.exports = { definitions, execute };
