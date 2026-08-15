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
      name: 'adicionar_ao_carrinho',
      description:
        'Coloca os itens no carrinho do site — o mesmo carrinho da vitrine, que o cliente ' +
        'vê no botão de carrinho aqui do chat e no ícone do site. ' +
        'Só chame depois de confirmar com o cliente qual apresentação e quantas unidades. ' +
        'Depois de chamar, diga que está no carrinho e aponte o botão "Finalizar compra"; ' +
        'NÃO escreva link de pagamento — quem gera o pagamento é o checkout do site.',
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
/* Formato do card. Um lugar só, usado tanto por mostrar_produtos quanto pela
   rede de segurança em deepseek.js. */
function paraCard(p) {
  return {
    handle: p.handle,
    nome: p.nome,
    resumo: p.resumo,
    foto: p.foto,
    url: p.url,
    /* Lista completa: o card monta um slide por apresentação, com nome e
       preço. Sem isso o cliente vê um preço só e não percebe que existe
       embalagem maior — que é justamente onde o custo por dose cai. */
    apresentacoes: p.apresentacoes
  };
}

/* Guarda tudo que o agente consultou nesta mensagem. Se ele terminar falando
   de um produto sem ter chamado mostrar_produtos, o deepseek.js usa esta
   lista para exibir o card assim mesmo — ver `cardsPorMencao`. */
function lembrar(coletor, produtos) {
  if (!coletor) return;
  produtos.forEach((p) => {
    if (p && p.handle && !coletor.vistos.some((v) => v.handle === p.handle)) {
      coletor.vistos.push(paraCard(p));
    }
  });
}

const executors = {
  async buscar_produtos(args, coletor) {
    const produtos = await shopify.buscarProdutos(args.termo, args.limite);
    if (!produtos.length) {
      return { produtos: [], aviso: 'Nenhum produto encontrado para esse termo.' };
    }
    lembrar(coletor, produtos);
    return {
      produtos,
      instrucao: 'Para o cliente VER estes produtos, chame mostrar_produtos com os handles. Sem isso ele não vê nada.'
    };
  },

  async detalhes_produto(args, coletor) {
    const produto = await shopify.detalhesProduto(args.handle);
    if (!produto) return { erro: 'Produto não encontrado com esse handle.' };
    lembrar(coletor, [produto]);
    return { produto };
  },

  async mostrar_produtos(args, coletor) {
    const handles = (Array.isArray(args.handles) ? args.handles : [])
      .map((h) => String(h || '').trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!handles.length) return { erro: 'Nenhum handle informado.' };

    /* Resolve primeiro no que já foi consultado nesta mensagem. Além de
       evitar uma ida à rede, isso salva o caso comum de o modelo inventar o
       handle ("difly-s3") em vez de copiar o que veio da busca
       ("difly-s3-champion") — antes disso o card simplesmente não aparecia. */
    const vistos = (coletor && coletor.vistos) || [];

    const produtos = (await Promise.all(handles.map(async (h) => {
      const alvo = h.toLowerCase();

      const cache = vistos.find((v) => {
        const vh = String(v.handle || '').toLowerCase();
        return vh === alvo || vh.includes(alvo) || alvo.includes(vh);
      });
      if (cache) return cache;

      const buscado = await shopify.detalhesProduto(h);
      if (buscado) return buscado;

      /* Último recurso: o "handle" pode ser na verdade o nome do produto. */
      return vistos.find((v) => String(v.nome || '').toLowerCase().includes(alvo)) || null;
    }))).filter(Boolean);

    if (!produtos.length) {
      return { erro: 'Nenhum dos handles foi encontrado. Confira com buscar_produtos.' };
    }

    if (coletor) {
      lembrar(coletor, produtos);
      produtos.forEach((p) => {
        /* Evita repetir o mesmo card se o modelo chamar duas vezes. */
        if (!coletor.cards.some((c) => c.handle === p.handle)) {
          coletor.cards.push(paraCard(p));
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

  /* Não cria carrinho no Shopify. Devolve os itens resolvidos pelo canal
     lateral, e o widget os coloca no carrinho do site (champion-cart) — o
     mesmo da vitrine. Assim existe UM carrinho só, e o pagamento sai pelo
     checkout do site em vez de um link solto no meio da conversa. */
  async adicionar_ao_carrinho(args, coletor) {
    const pedidos = (Array.isArray(args.itens) ? args.itens : [])
      .map((i) => ({
        variantId: String((i && i.variantId) || '').trim(),
        quantidade: Math.min(Math.max(Number(i && i.quantidade) || 1, 1), 99)
      }))
      .filter((i) => i.variantId)
      .slice(0, 10);

    if (!pedidos.length) {
      return { erro: 'Nenhuma apresentação informada. Use o variantId vindo de buscar_produtos.' };
    }

    /* Procura primeiro no que já foi consultado; depois no catálogo. O modelo
       às vezes devolve o variantId de uma mensagem anterior. */
    const universo = ((coletor && coletor.vistos) || []).slice();
    let catalogo = null;

    const resolvidos = [];
    for (const pedido of pedidos) {
      let achado = encontrarPorVariante(universo, pedido.variantId);

      if (!achado) {
        if (!catalogo) catalogo = (await shopify.catalogo()).map(paraCard);
        achado = encontrarPorVariante(catalogo, pedido.variantId);
      }
      if (achado) resolvidos.push({ produto: achado.produto, apr: achado.apr, qtd: pedido.quantidade });
    }

    if (!resolvidos.length) {
      return {
        erro: 'Nenhuma apresentação encontrada com esses variantId.',
        instrucao: 'Chame buscar_produtos de novo e use o variantId exato que voltar.'
      };
    }

    if (coletor) {
      resolvidos.forEach((r) => {
        coletor.carrinho.push({
          handle: r.produto.handle,
          nome: r.produto.nome,
          foto: r.produto.foto,
          variantId: r.apr.variantId,
          apresentacao: r.apr.apresentacao,
          preco: r.apr.preco,
          precoNum: r.apr.precoNum,
          quantidade: r.qtd
        });
      });
    }

    return {
      adicionados: resolvidos.map((r) => ({
        produto: r.produto.nome,
        apresentacao: r.apr.apresentacao,
        quantidade: r.qtd,
        preco: r.apr.preco
      })),
      instrucao:
        'Já entrou no carrinho do site e o cliente está vendo. Confirme em uma frase, ' +
        'diga que é só tocar em "Finalizar compra" no carrinho aqui do chat, e pergunte ' +
        'se ele quer incluir mais alguma coisa. NÃO escreva link de pagamento.'
    };
  }
};

/* Localiza o produto e a apresentação a partir do variantId. */
function encontrarPorVariante(lista, variantId) {
  for (const produto of lista || []) {
    const apr = (produto.apresentacoes || []).find((a) => a.variantId === variantId);
    if (apr) return { produto, apr };
  }
  return null;
}

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

/**
 * Rede de segurança para o modelo que fala de um produto mas esquece de
 * chamar mostrar_produtos — o sintoma é "aí estão as três apresentações"
 * seguido de nada na tela.
 *
 * Se a resposta final cita pelo nome um produto que ele consultou nesta
 * mensagem, o card aparece assim mesmo. Determinístico: não depende de o
 * modelo lembrar da regra.
 */
function cardsPorMencao(texto, vistos) {
  const t = normalizar(texto);
  if (!t || !Array.isArray(vistos) || !vistos.length) return [];

  /* Comparar o nome inteiro não serve: o título no Shopify costuma ser
     "Difly S3 Champion 6kg" e o agente escreve só "Difly S3". Então batemos
     token a token e exigimos que todos os termos distintivos do nome
     apareçam no texto. */
  const GENERICOS = ['champion', 'kg', 'ml', 'gr', 'litro', 'litros', 'para', 'com'];

  return vistos
    .map((p) => {
      const tokens = normalizar(p.nome)
        .split(' ')
        .filter((w) => w.length >= 2 && GENERICOS.indexOf(w) === -1);

      if (!tokens.length) return null;

      const achou = tokens.filter((w) => t.indexOf(w) !== -1).length;
      /* Todos os termos presentes, e pelo menos um com mais de 3 letras
         (senão "s3" sozinho casaria com qualquer coisa). */
      const forte = tokens.some((w) => w.length > 3 && t.indexOf(w) !== -1);
      return achou === tokens.length && forte ? { p, peso: tokens.length } : null;
    })
    .filter(Boolean)
    /* Nome mais específico primeiro: se o texto cita "Difly S3", o card do
       S3 vem antes do card do "Difly". */
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 4)
    .map((x) => x.p);
}

/* Minúsculas, sem acento e sem pontuação — o agente escreve "Difly S3." e o
   título vem "DIFLY S3"; sem normalizar, nada casa. */
function normalizar(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Decide quais cards vão para a tela ao fim de uma mensagem.
 *
 * Três degraus, do mais confiável ao mais tolerante:
 *  1. O que o agente pediu explicitamente com mostrar_produtos.
 *  2. O que ele consultou nesta mensagem e citou pelo nome.
 *  3. Qualquer produto do catálogo citado pelo nome — cobre o caso em que
 *     ele responde de cabeça, com o que já sabia de mensagens anteriores,
 *     sem chamar ferramenta nenhuma. Era exatamente o que acontecia quando
 *     o cliente pedia "quero ver os produtos" no meio da conversa.
 */
async function resolverCards(texto, coletor) {
  if (coletor.cards.length) return coletor.cards;

  const doTurno = cardsPorMencao(texto, coletor.vistos);
  if (doTurno.length) return doTurno;

  try {
    const todos = await shopify.catalogo();
    return cardsPorMencao(texto, todos.map(paraCard));
  } catch (err) {
    console.error('[chat] resolverCards falhou:', err.message);
    return [];
  }
}

module.exports = { definitions, execute, cardsPorMencao, resolverCards };
