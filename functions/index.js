/**
 * Cloud Functions — Champion Saúde Animal
 * ============================================================================
 *  • sitemap      → /sitemap.xml gerado ao vivo do Firestore
 *  • productPage  → injeta title/description/OG + JSON-LD no HTML do produto
 *                   ANTES de servir, para que robôs sociais (WhatsApp, Face,
 *                   Twitter) e o Googlebot recebam o meta correto sem depender
 *                   de JavaScript. O JS do site segue hidratando o conteúdo.
 *
 *  Lê o Firestore via REST (somente produtos publicados; as regras já liberam
 *  leitura pública desses). A API key é a chave web pública do app — não secreta.
 * ============================================================================
 */
import { onRequest } from 'firebase-functions/v2/https';
import { readFileSync } from 'node:fs';

const SITE = 'https://ofertaschampion.com.br';
const PROJECT_ID = 'champion-e84e8';
const API_KEY = 'AIzaSyD9D6ZSDyX0fhS7j0aWVwk0hUxudJKPEKc';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/* ─────────── Helpers ─────────── */
function xmlEscape(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}
function htmlAttrEscape(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

/* Decodifica o formato tipado do Firestore REST para JS puro. */
function decode(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) {
    const o = {};
    const f = v.mapValue.fields || {};
    for (const k in f) o[k] = decode(f[k]);
    return o;
  }
  return null;
}
function docToProduct(doc) {
  const fields = doc.fields || {};
  const p = {};
  for (const k in fields) p[k] = decode(fields[k]);
  p.id = doc.name.split('/').pop();
  return p;
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchPublishedProducts() {
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'products' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'published' }
        }
      }
    }
  };
  const rows = await fetchJson(`${FS_BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return rows
    .filter((r) => r.document && r.document.name)
    .map((r) => docToProduct(r.document));
}

async function fetchProductById(id) {
  const safe = encodeURIComponent(id).replace(/%2F/g, '');
  const doc = await fetchJson(`${FS_BASE}/products/${safe}?key=${API_KEY}`);
  if (!doc || !doc.fields) return null;
  const p = docToProduct(doc);
  if (p.status && p.status !== 'published') return null;
  return p;
}

/* ─────────── Preço auxiliar ─────────── */
function minPrice(p) {
  const vp = (p.variants || []).map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
  if (vp.length) return Math.min(...vp);
  return Number.isFinite(Number(p.price)) ? Number(p.price) : null;
}
function priceValidUntil() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/* ════════════════════════════ SITEMAP ════════════════════════════ */
const STATIC_PAGES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/produtos.html', changefreq: 'weekly', priority: '0.9' },
  { loc: '/guias.html', changefreq: 'weekly', priority: '0.8' },
  { loc: '/guias/controle-mosca-dos-chifres.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/guias/sal-mineral-para-gado.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/guias/vermifugacao-bovinos.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/blog.html', changefreq: 'weekly', priority: '0.7' },
  { loc: '/calculo-dose.html', changefreq: 'monthly', priority: '0.7' },
  { loc: '/sobre.html', changefreq: 'monthly', priority: '0.6' }
];
const FALLBACK_PRODUCTS = [
  'difly', 'difly-s3', 'vermi-sal', 'ade-po', 'diazinon', 'nucleo-supera',
  'nucleo-tm-force', 'iatf-boost', 'andro-boost', 'propoxur-1', 'domifly-s3',
  'datropa', 'avecal', 'suino-nobre', 'farinha-calcio'
];

export const sitemap = onRequest(
  { region: 'us-central1', cors: true, memory: '256MiB' },
  async (req, res) => {
    let entries;
    try {
      const products = await fetchPublishedProducts();
      if (!products.length) throw new Error('vazio');
      entries = products.map((p) => {
        const lm = p.updatedAt ? `<lastmod>${String(p.updatedAt).slice(0, 10)}</lastmod>` : '';
        const loc = `${SITE}/produto.html?p=${encodeURIComponent(p.id)}`;
        return `  <url><loc>${xmlEscape(loc)}</loc>${lm}<changefreq>weekly</changefreq><priority>0.9</priority></url>`;
      });
    } catch (err) {
      console.warn('[sitemap] fallback:', err.message);
      entries = FALLBACK_PRODUCTS.map((id) =>
        `  <url><loc>${SITE}/produto.html?p=${id}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
    }
    const statics = STATIC_PAGES.map((p) =>
      `  <url><loc>${SITE}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${statics.join('\n')}
${entries.join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  }
);

/* ═══════════════════════ PRODUCT PAGE (SSR meta) ═══════════════════════ */
let TEMPLATE = null;
function getTemplate() {
  if (TEMPLATE) return TEMPLATE;
  try {
    TEMPLATE = readFileSync(new URL('./produto-template.html', import.meta.url), 'utf8');
  } catch (err) {
    console.error('[productPage] template ausente:', err.message);
    TEMPLATE = '';
  }
  return TEMPLATE;
}

function buildProductJsonLd(p, url) {
  const image = p.image ? [p.image.startsWith('http') ? p.image : `${SITE}/${String(p.image).replace(/^\/+/, '')}`] : [];
  const shipping = {
    '@type': 'OfferShippingDetails',
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BR' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' }
    }
  };
  const returns = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'BR',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 7,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn'
  };
  const deco = (o) => Object.assign(o, {
    priceValidUntil: priceValidUntil(), shippingDetails: shipping, hasMerchantReturnPolicy: returns
  });
  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  let offers;
  if (hasVariants) {
    offers = p.variants.filter((v) => Number.isFinite(Number(v.price))).map((v) => deco({
      '@type': 'Offer', name: v.name, sku: `${p.id}-${v.id || ''}`,
      price: Number(v.price).toFixed(2), priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock', url
    }));
  } else if (Number.isFinite(Number(p.price))) {
    offers = [deco({
      '@type': 'Offer', sku: p.id, price: Number(p.price).toFixed(2),
      priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url
    })];
  }
  const data = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, sku: p.id, mpn: p.id,
    brand: { '@type': 'Brand', name: 'Champion Saúde Animal' },
    category: p.category,
    description: String(p.headline || p.excerpt || p.content || p.name).slice(0, 5000),
    image
  };
  if (offers && offers.length) data.offers = offers.length === 1 ? offers[0] : offers;
  return data;
}

function buildBreadcrumb(p, url) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Produtos', item: SITE + '/produtos.html' },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }
    ]
  };
}

function renderProductHead(p) {
  const url = `${SITE}/produto.html?p=${encodeURIComponent(p.id)}`;
  const titleSuffix = p.category ? ` — ${p.category}` : '';
  const title = `${p.name}${titleSuffix} | Champion Saúde Animal`;
  const desc = String(p.excerpt || p.headline || p.content || '')
    .replace(/\s+/g, ' ').trim().slice(0, 158);
  const img = p.image
    ? (String(p.image).startsWith('http') ? p.image : `${SITE}/${String(p.image).replace(/^\/+/, '')}`)
    : `${SITE}/assets/img/brand/logo.png`;
  const tags = [
    `<meta name="description" content="${htmlAttrEscape(desc)}" data-ssr />`,
    `<link rel="canonical" href="${htmlAttrEscape(url)}" data-ssr />`,
    `<meta property="og:type" content="product" data-ssr />`,
    `<meta property="og:title" content="${htmlAttrEscape(title)}" data-ssr />`,
    `<meta property="og:description" content="${htmlAttrEscape(desc)}" data-ssr />`,
    `<meta property="og:url" content="${htmlAttrEscape(url)}" data-ssr />`,
    `<meta property="og:image" content="${htmlAttrEscape(img)}" data-ssr />`,
    `<meta property="og:site_name" content="Champion Saúde Animal" data-ssr />`,
    `<meta property="og:locale" content="pt_BR" data-ssr />`,
    `<meta name="twitter:card" content="summary_large_image" data-ssr />`,
    `<script type="application/ld+json" data-jsonld="product">${JSON.stringify(buildProductJsonLd(p, url))}</script>`,
    `<script type="application/ld+json" data-jsonld="breadcrumb">${JSON.stringify(buildBreadcrumb(p, url))}</script>`
  ];
  return { title, tagsHtml: tags.join('\n  ') };
}

export const productPage = onRequest(
  { region: 'us-central1', memory: '256MiB' },
  async (req, res) => {
    const template = getTemplate();
    /* Sem template não há o que fazer além de devolver erro suave. */
    if (!template) { res.status(302).set('Location', `${SITE}/produtos.html`).end(); return; }

    /* Aceita os dois formatos de URL:
       - clássico:  /produto.html?p=difly
       - limpo/SEO: /produtos/difly  (último segmento do caminho)
       Permite migrar para URLs limpas sem quebrar os links antigos. */
    const pathSlug = (req.path || '')
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .pop() || '';
    const fromPath = /^\/produtos\//i.test(req.path || '') ? pathSlug : '';
    const id = ((req.query.p || fromPath) || '').toString().trim();
    res.set('Content-Type', 'text/html; charset=utf-8');
    /* Cache curto na CDN: produto novo/edição reflete em poucos minutos. */
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600');

    if (!id) { res.status(200).send(template); return; }

    try {
      const product = await fetchProductById(id);
      if (!product) { res.status(200).send(template); return; }
      const { title, tagsHtml } = renderProductHead(product);
      let html = template;
      /* Troca o <title> e injeta o meta/JSON-LD antes de </head>. */
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlAttrEscape(title)}</title>`);
      html = html.replace(/<\/head>/i, `  ${tagsHtml}\n</head>`);
      res.status(200).send(html);
    } catch (err) {
      console.warn('[productPage] fallback template:', err.message);
      res.status(200).send(template); /* nunca quebra a página */
    }
  }
);
