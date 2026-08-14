'use strict';

/**
 * Shopify Storefront API — lado servidor.
 *
 * O frontend já fala com o Storefront pelo js/shopify-client.js, mas o agente
 * NÃO pode depender disso: quem responde ao cliente é o backend, e as respostas
 * precisam sair de uma fonte que o modelo não consegue inventar. Todo preço,
 * apresentação e link de checkout que o agente diz vem daqui.
 */

/* Os mesmos valores de frontend/js/shopify-config.js.
   Ficam como padrão aqui de propósito: o token da Storefront API é público por
   natureza (roda no navegador de qualquer visitante) e já está versionado no
   frontend — exigir que fosse declarado de novo no Railway daria trabalho sem
   ganhar segurança nenhuma. As variáveis de ambiente continuam funcionando e
   têm prioridade, para quando a loja ou a versão da API mudar. */
const DOMAIN = process.env.SHOPIFY_DOMAIN || '40455a-2.myshopify.com';
const TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '13cfcfd02757bc44f98363b0c9e0581a';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const NS = process.env.SHOPIFY_METAFIELD_NAMESPACE || 'custom';

/* Mesmas chaves cadastradas no Shopify (ver docs/SHOPIFY-INTEGRACAO.md). */
const META_KEYS = ['headline', 'excerpt', 'usage', 'presentations', 'category'];

function isConfigured() {
  return Boolean(DOMAIN && TOKEN && DOMAIN.includes('myshopify.com'));
}

function metafieldFragment() {
  return META_KEYS
    .map((k) => `${k}: metafield(namespace: "${NS}", key: "${k}") { value }`)
    .join('\n        ');
}

async function gql(query, variables) {
  if (!isConfigured()) {
    throw new Error('Shopify não configurado no backend (SHOPIFY_DOMAIN / SHOPIFY_STOREFRONT_TOKEN).');
  }

  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN
    },
    body: JSON.stringify({ query, variables: variables || {} }),
    signal: AbortSignal.timeout(15000)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    const msg = (body.errors && body.errors[0] && body.errors[0].message) || `HTTP ${res.status}`;
    throw new Error(`Shopify Storefront: ${msg}`);
  }
  return body.data;
}

function metaVal(node, key) {
  return node && node[key] && node[key].value != null ? String(node[key].value) : '';
}

function brl(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* Achata um produto do Shopify no mínimo que o agente precisa dizer ao cliente.
   Menos campo = menos token e menos chance de o modelo se perder. */
function mapProduct(node) {
  const variants = ((node.variants && node.variants.nodes) || []).map((v) => ({
    variantId: v.id,
    apresentacao: v.title === 'Default Title' ? 'Padrão' : v.title,
    preco: brl(v.price && v.price.amount),
    disponivel: Boolean(v.availableForSale)
  }));

  return {
    handle: node.handle,
    nome: node.title,
    categoria: metaVal(node, 'category') || node.productType || '',
    resumo: metaVal(node, 'excerpt') || String(node.description || '').slice(0, 240),
    foto: (node.featuredImage && node.featuredImage.url) || null,
    disponivel: Boolean(node.availableForSale),
    apresentacoes: variants,
    /* Página do produto no site — o agente manda esse link, nunca inventa URL. */
    url: `${process.env.SITE_URL || 'https://ofertaschampion.com.br'}/produto.html?p=${node.handle}`
  };
}

const PRODUCT_FIELDS = `
  handle
  title
  description
  productType
  availableForSale
  featuredImage { url }
  variants(first: 25) {
    nodes { id title availableForSale price { amount } }
  }
`;

/**
 * Busca produtos por termo livre. Sem termo, devolve os primeiros do catálogo.
 */
async function buscarProdutos(termo, limite) {
  const first = Math.min(Math.max(Number(limite) || 6, 1), 12);
  const termoLimpo = String(termo || '').trim();

  /* RELEVANCE só é válido junto de um termo de busca — sem termo o Shopify
     precisa de outra ordenação, senão a query se comporta de forma imprevisível. */
  const sortKey = termoLimpo ? 'RELEVANCE' : 'TITLE';

  const query = `
    query ChampionBusca($first: Int!, $q: String) {
      products(first: $first, query: $q, sortKey: ${sortKey}) {
        nodes {
          ${PRODUCT_FIELDS}
          ${metafieldFragment()}
        }
      }
    }
  `;

  const data = await gql(query, { first, q: termoLimpo || null });
  return ((data.products && data.products.nodes) || []).map(mapProduct);
}

/**
 * Ficha completa de um produto — inclui modo de uso e apresentações do rótulo.
 * É a única fonte de "como usar" que o agente tem acesso.
 */
async function detalhesProduto(handle) {
  const query = `
    query ChampionProduto($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_FIELDS}
        ${metafieldFragment()}
      }
    }
  `;

  const data = await gql(query, { handle: String(handle || '').trim() });
  if (!data.product) return null;

  const base = mapProduct(data.product);
  return Object.assign(base, {
    descricao: String(data.product.description || '').trim(),
    /* Texto do rótulo. Se vier vazio, o agente é instruído a encaminhar
       para a equipe técnica em vez de preencher a lacuna sozinho. */
    modo_de_uso: metaVal(data.product, 'usage'),
    apresentacoes_rotulo: metaVal(data.product, 'presentations')
  });
}

/**
 * Cria um carrinho no Shopify e devolve o checkoutUrl.
 *
 * Este é o link de pagamento. Ele é emitido pelo Shopify, não escrito pelo
 * modelo — por isso não há como o agente mandar o cliente para um link errado
 * nem cobrar um valor que não existe no catálogo.
 */
async function montarCarrinho(itens) {
  const lines = (Array.isArray(itens) ? itens : [])
    .map((i) => ({
      merchandiseId: String(i.variantId || '').trim(),
      quantity: Math.min(Math.max(Number(i.quantidade) || 1, 1), 99)
    }))
    .filter((l) => l.merchandiseId.startsWith('gid://shopify/ProductVariant/'));

  if (!lines.length) {
    throw new Error('Nenhuma apresentação válida foi informada.');
  }

  const mutation = `
    mutation ChampionCarrinho($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart {
          checkoutUrl
          cost { totalAmount { amount } }
          lines(first: 25) {
            nodes {
              quantity
              merchandise {
                ... on ProductVariant {
                  title
                  price { amount }
                  product { title }
                }
              }
            }
          }
        }
        userErrors { message }
      }
    }
  `;

  const data = await gql(mutation, { lines });
  const result = data.cartCreate || {};

  if (result.userErrors && result.userErrors.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }
  if (!result.cart || !result.cart.checkoutUrl) {
    throw new Error('O Shopify não devolveu um link de checkout.');
  }

  return {
    link_pagamento: result.cart.checkoutUrl,
    total: brl(result.cart.cost && result.cart.cost.totalAmount && result.cart.cost.totalAmount.amount),
    itens: ((result.cart.lines && result.cart.lines.nodes) || []).map((n) => ({
      produto: n.merchandise && n.merchandise.product && n.merchandise.product.title,
      apresentacao: n.merchandise && n.merchandise.title,
      quantidade: n.quantity,
      preco_unitario: brl(n.merchandise && n.merchandise.price && n.merchandise.price.amount)
    }))
  };
}

module.exports = { isConfigured, buscarProdutos, detalhesProduto, montarCarrinho };
