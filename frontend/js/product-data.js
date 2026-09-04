import { assetUrl } from './asset-url.js?v=20260902-3';

export { assetUrl };

/* O catálogo cravado (17 produtos com preço fixo) foi removido: a Shopify é a
   única fonte de produto. Restou vazio para não quebrar quem ainda importa o
   símbolo; o objetivo é que ninguém importe. */
export const DEFAULT_PRODUCTS = [];

export const PRODUCT_ALIASES = {
  'ver-mi-sal': 'vermi-sal',
  nucleo: 'nucleo-supera'
};

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `produto-${Date.now()}`;
}

function normalizeVariant(variant = {}, index = 0) {
  const name = String(variant.name || '').trim();
  if (!name) return null;
  const price = Number.parseFloat(String(variant.price ?? '').replace(',', '.'));
  return {
    id: slugify(variant.id || name) || `var-${index + 1}`,
    name,
    price: Number.isFinite(price) ? price : null,
    image: assetUrl(variant.image),
    /* GID da variante no Shopify (usado no checkout). Vazio p/ produtos locais. */
    variantId: String(variant.variantId || '').trim()
  };
}

export function normalizeProduct(product = {}, index = 0) {
  const name = String(product.name || `Produto ${index + 1}`).trim();
  const id = slugify(product.id || name);
  const price = Number.parseFloat(String(product.price ?? '').replace(',', '.'));
  const variants = Array.isArray(product.variants)
    ? product.variants.map((v, i) => normalizeVariant(v, i)).filter(Boolean)
    : [];
  const faq = Array.isArray(product.faq)
    ? product.faq
        .map((item) => ({
          q: String(item && item.q || '').trim(),
          a: String(item && item.a || '').trim()
        }))
        .filter((item) => item.q && item.a)
    : [];
  return {
    id,
    name,
    status: product.status === 'draft' ? 'draft' : 'published',
    /* Disponibilidade de estoque (Shopify). Produtos locais são sempre disponíveis. */
    available: product.available !== false,
    tag: String(product.tag || '').trim(),
    category: String(product.category || 'Champion').trim(),
    species: String(product.species || '').trim(),
    group: String(product.group || '').trim(),
    use: String(product.use || '').trim(),
    /* Agrupamento de apresentacoes (metafields do Shopify). Vazio = produto avulso. */
    family: String(product.family || '').trim(),
    presentation: String(product.presentation || '').trim(),
    price: Number.isFinite(price) ? price : null,
    image: assetUrl(product.image),
    excerpt: String(product.excerpt || '').trim(),
    headline: String(product.headline || product.excerpt || '').trim(),
    content: String(product.content || product.excerpt || '').trim(),
    benefits: String(product.benefits || '').trim(),
    usage: String(product.usage || '').trim(),
    presentations: String(product.presentations || 'Consultar embalagem').trim(),
    variants,
    faq,
    /* GID da variante padrão no Shopify (produto sem variantes). Vazio p/ produtos locais. */
    variantId: String(product.variantId || '').trim(),
    order: Number.isFinite(Number(product.order)) ? Number(product.order) : index + 1
  };
}

/* Menor preço entre as variantes (ou o preço base se não houver variantes). */
export function getMinPrice(product) {
  if (!product) return null;
  const prices = (product.variants || [])
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n));
  if (prices.length) return Math.min(...prices);
  return Number.isFinite(Number(product.price)) ? Number(product.price) : null;
}

/* Imagem default exibida no card/detalhe (variant.image cai p/ product.image). */
export function getDisplayImage(product, variant) {
  if (variant && variant.image) return variant.image;
  if (variant && !variant.image && product?.image) return product.image;
  return product?.image || '';
}

export function sortProducts(products) {
  return products.slice().sort((a, b) => {
    const order = (Number(a.order) || 99) - (Number(b.order) || 99);
    if (order !== 0) return order;
    return String(a.name).localeCompare(String(b.name));
  });
}

export function formatBRL(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sob consulta';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
