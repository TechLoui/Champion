// Cliente da Storefront API do Shopify — Champion Saúde Animal
//
// Responsável por:
//   • buscar o catálogo do Shopify (produtos, preço, estoque, imagens, metafields)
//   • mapear cada produto para o MESMO formato que product-data.js/normalizeProduct
//     já espera, de modo que a vitrine (products-cms.js) só troque a fonte de dados;
//   • criar o carrinho no Shopify e devolver a checkoutUrl (usado na FASE 2 pelo
//     redirect do checkout).
//
// Exporta funções ES module (para products-cms.js) e também publica window.ChampionShopify
// (para scripts não-módulo, como o checkout).

import { CHAMPION_SHOPIFY_CONFIG, isShopifyConfigured } from './shopify-config.js';

const CFG = CHAMPION_SHOPIFY_CONFIG;
const NS = CFG.metafieldNamespace || 'custom';

export function isShopifyEnabled() {
  return isShopifyConfigured(CFG);
}

function endpoint() {
  return `https://${CFG.domain}/api/${CFG.apiVersion}/graphql.json`;
}

/* Chamada GraphQL genérica à Storefront API. */
async function gql(query, variables) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': CFG.storefrontToken
    },
    body: JSON.stringify({ query, variables: variables || {} })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    const msg = (body.errors && body.errors[0] && body.errors[0].message) || `HTTP ${res.status}`;
    throw new Error(`Shopify Storefront: ${msg}`);
  }
  return body.data;
}

/* ─── Metafields de conteúdo (namespace `custom`) ───
   Cada chave abaixo vira um alias no GraphQL para ler o metafield correspondente.
   A ordem/valores devem casar com o cadastro feito no Shopify (ver doc). */
const META_KEYS = [
  'headline', 'excerpt', 'benefits', 'usage',
  'presentations', 'faq', 'badge', 'species', 'group', 'use', 'category'
];

function metafieldFragment() {
  return META_KEYS
    .map((k) => `${k}: metafield(namespace: "${NS}", key: "${k}") { value }`)
    .join('\n        ');
}

const PRODUCTS_QUERY = `
  query ChampionProducts($first: Int!, $cursor: String) {
    products(first: $first, after: $cursor, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        description
        productType
        availableForSale
        featuredImage { url altText }
        images(first: 8) { nodes { url } }
        priceRange { minVariantPrice { amount } }
        variants(first: 50) {
          nodes {
            id
            title
            sku
            availableForSale
            price { amount }
            image { url }
          }
        }
        collections(first: 10) { nodes { title handle } }
        ${metafieldFragment()}
      }
    }
  }
`;

function metaVal(node, key) {
  return node[key] && node[key].value != null ? String(node[key].value) : '';
}

/* Benefits pode vir como list.single_line_text (JSON: ["a","b"]) ou texto multilinha.
   Normaliza para texto com um item por linha (products-cms.js separa por \n). */
function parseBenefits(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('[')) {
    try { return JSON.parse(t).map((s) => String(s).trim()).filter(Boolean).join('\n'); }
    catch (e) { /* cai pro texto cru */ }
  }
  return t;
}

/* FAQ vem como metafield JSON: [{ "q": "...", "a": "..." }, ...] */
function parseFaq(raw) {
  const t = String(raw || '').trim();
  if (!t) return [];
  try {
    const arr = JSON.parse(t);
    return Array.isArray(arr)
      ? arr.map((x) => ({ q: String(x && x.q || '').trim(), a: String(x && x.a || '').trim() }))
           .filter((x) => x.q && x.a)
      : [];
  } catch (e) { return []; }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* Mapeia um produto do Shopify para o formato interno (compatível com normalizeProduct).
   `variantId` (GID do Shopify) é preservado para o checkout da FASE 2. */
function mapProduct(node, index) {
  const vnodes = (node.variants && node.variants.nodes) || [];
  const hasVariants = vnodes.length > 1;

  const featured = (node.featuredImage && node.featuredImage.url)
    || (node.images && node.images.nodes[0] && node.images.nodes[0].url)
    || '';

  /* Disponibilidade real (estoque). O Shopify já esconde produtos em "rascunho"
     da Storefront API; aqui tratamos os que ficam sem estoque. */
  const available = node.availableForSale !== false;
  /* hideOutOfStock=true  → sem estoque some do catálogo (status 'draft', filtrado na vitrine)
     hideOutOfStock=false → continua aparecendo, marcado como "Esgotado". */
  const hidden = !available && CFG.hideOutOfStock !== false;

  /* Categoria/espécie/grupo derivados das Coleções do Shopify. */
  const collectionTitles = ((node.collections && node.collections.nodes) || []).map((c) => c.title).filter(Boolean);
  const SPECIES_COL = { 'bovinos': 'bovinos', 'equinos': 'equinos', 'suínos': 'suinos', 'suinos': 'suinos', 'aves': 'aves', 'caprinos': 'caprinos', 'ovinos': 'ovinos' };
  const GROUP_COL = { 'inseticidas': 'inseticida', 'larvicida oral': 'larvicida' };
  let colSpecies = '', colGroup = '', colCategory = '';
  collectionTitles.forEach((t) => {
    const key = String(t).trim().toLowerCase();
    if (SPECIES_COL[key] && !colSpecies) { colSpecies = SPECIES_COL[key]; colCategory = String(t).trim(); }
    Object.keys(GROUP_COL).forEach((gk) => { if (key.indexOf(gk) === 0 && !colGroup) colGroup = GROUP_COL[gk]; });
  });
  if (!colCategory) {
    const firstReal = collectionTitles.find((t) => !/p[áa]gina principal|principal/i.test(t));
    if (firstReal) colCategory = String(firstReal).trim();
  }

  const base = {
    id: node.handle,
    name: node.title,
    status: hidden ? 'draft' : 'published',
    available: available,
    inventory: Number.isFinite(node.totalInventory) ? node.totalInventory : null,
    tag: metaVal(node, 'badge'),
    category: metaVal(node, 'category') || colCategory || node.productType || 'Champion',
    species: metaVal(node, 'species') || colSpecies,
    group: metaVal(node, 'group') || colGroup,
    use: metaVal(node, 'use'),
    collections: collectionTitles,
    image: featured,
    excerpt: metaVal(node, 'excerpt'),
    headline: metaVal(node, 'headline'),
    content: node.description || '',
    benefits: parseBenefits(metaVal(node, 'benefits')),
    usage: metaVal(node, 'usage'),
    presentations: metaVal(node, 'presentations') || 'Consultar embalagem',
    faq: parseFaq(metaVal(node, 'faq')),
    order: index + 1
  };

  if (hasVariants) {
    base.price = null; // getMinPrice usa o menor preço entre as variantes
    base.variantId = '';
    base.variants = vnodes.map((v, i) => ({
      id: slugify(v.title) || `var-${i + 1}`,
      name: v.title,
      price: Number(v.price && v.price.amount) || null,
      image: (v.image && v.image.url) || '',
      variantId: v.id,          // GID p/ checkout
      sku: v.sku || '',
      available: v.availableForSale !== false
    }));
  } else {
    const only = vnodes[0] || {};
    base.price = Number(only.price && only.price.amount)
      || Number(node.priceRange && node.priceRange.minVariantPrice.amount)
      || null;
    base.variantId = only.id || '';  // GID p/ checkout
    base.variants = [];
  }

  return base;
}

/* ─── Catálogo (memoizado por carregamento de página) ─── */
let _productsPromise = null;

export async function getShopifyProducts() {
  if (!isShopifyEnabled()) throw new Error('Shopify não configurado.');
  if (_productsPromise) return _productsPromise;

  _productsPromise = (async () => {
    const out = [];
    let cursor = null;
    let guard = 0;
    do {
      const data = await gql(PRODUCTS_QUERY, { first: 100, cursor });
      const conn = data.products;
      conn.nodes.forEach((n, i) => out.push(mapProduct(n, out.length + i)));
      cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (cursor && ++guard < 20);
    return out;
  })();

  try {
    return await _productsPromise;
  } catch (err) {
    _productsPromise = null; // permite retry numa próxima chamada
    throw err;
  }
}

/* ─── Checkout (FASE 2): cria o carrinho no Shopify e devolve a checkoutUrl ───
   `items` são os itens do carrinho local; cada um precisa de `variantId` (GID) e `qty`.
   `email` (opcional) pré-preenche a identificação no checkout do Shopify. */
const CART_CREATE = `
  mutation ChampionCartCreate($lines: [CartLineInput!]!, $email: String) {
    cartCreate(input: { lines: $lines, buyerIdentity: { email: $email } }) {
      cart { checkoutUrl }
      userErrors { field message }
    }
  }
`;

export async function createShopifyCheckout(items, email) {
  if (!isShopifyEnabled()) throw new Error('Shopify não configurado.');
  const lines = (items || [])
    .filter((i) => i && i.variantId)
    .map((i) => ({ merchandiseId: i.variantId, quantity: Math.max(1, Number(i.qty) || 1) }));

  if (!lines.length) {
    throw new Error('Nenhum item com variante do Shopify no carrinho. Verifique o cadastro (SKU/variante).');
  }

  const data = await gql(CART_CREATE, { lines, email: email || null });
  const result = data.cartCreate || {};
  if (result.userErrors && result.userErrors.length) {
    throw new Error(result.userErrors[0].message || 'Falha ao criar o carrinho no Shopify.');
  }
  const url = result.cart && result.cart.checkoutUrl;
  if (!url) throw new Error('Shopify não retornou a URL de checkout.');
  return url;
}

/* Publica no escopo global para scripts não-módulo (ex.: checkout). */
if (typeof window !== 'undefined') {
  window.ChampionShopify = {
    enabled: isShopifyEnabled,
    getProducts: getShopifyProducts,
    checkout: createShopifyCheckout
  };
}
