#!/usr/bin/env node
/* Champion · Gerador de páginas de produto
 *
 * Por que existe: o site é estático e as páginas de produto eram montadas só
 * por JavaScript, depois de uma chamada à Shopify. O HTML cru de todas elas era
 * byte a byte idêntico — mesmo título, mesmo H1, sem canonical. Para a primeira
 * leitura do Google, 20 produtos eram uma página duplicada só.
 *
 * O que faz: lê o catálogo da Shopify e escreve um HTML de verdade por produto
 * em produtos/<handle>.html, com título, descrição, preço, imagem, canonical e
 * dados estruturados já no arquivo. O JavaScript continua rodando por cima e
 * cuida do que é interativo (seletor de tamanho, carrinho, estoque).
 *
 * Uso:
 *   node tools/gerar-produtos.js            # gera em frontend/produtos/
 *   node tools/gerar-produtos.js --dry      # só relata, não escreve
 *
 * Precisa rodar a cada mudança de catálogo na Shopify. O conteúdo interativo
 * continua em tempo real; o que fica congelado no HTML é o texto indexável.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', 'frontend');
const SAIDA = path.join(RAIZ, 'produtos');
const TEMPLATE = path.join(RAIZ, 'produto.html');
const SITE = 'https://champion.ind.br';
const DRY = process.argv.includes('--dry');

/* ── Config da Shopify, lida do mesmo arquivo que o site usa ─────────────── */
const cfgSrc = fs.readFileSync(path.join(RAIZ, 'js', 'shopify-config.js'), 'utf8');
const cfg = (k) => (cfgSrc.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1];

/* ── Scrub regulatório (MAPA) ────────────────────────────────────────────────
   Extraído do products-cms.js em tempo de build, não reescrito aqui. Se as
   regras mudarem lá, o gerador acompanha sozinho — duplicar essa lógica seria
   garantir que uma hora as duas divergem, e o lado que divergir publica claim
   proibido no HTML, onde o Google lê. */
function carregarScrub() {
  const src = fs.readFileSync(path.join(RAIZ, 'js', 'products-cms.js'), 'utf8');
  const ini = src.indexOf('const REGULATED_RX');
  const fim = src.indexOf('function findProduct');
  if (ini < 0 || fim < 0) throw new Error('bloco de conformidade não localizado em products-cms.js');
  const exp = {};
  new Function('exp', src.slice(ini, fim) + '\nexp.scrub = scrubRegulatedProduct; exp.RX = REGULATED_RX;')(exp);
  return exp;
}

/* ── Consulta ────────────────────────────────────────────────────────────── */
const QUERY = `
  query { products(first: 250, sortKey: TITLE) {
    nodes {
      handle title description productType availableForSale
      featuredImage { url altText }
      priceRange { minVariantPrice { amount } }
      variants(first: 50) { nodes { title sku availableForSale price { amount } } }
      excerpt:       metafield(namespace: "custom", key: "excerpt")       { value }
      headline:      metafield(namespace: "custom", key: "headline")      { value }
      category:      metafield(namespace: "custom", key: "category")      { value }
      benefits:      metafield(namespace: "custom", key: "benefits")      { value }
      usage:         metafield(namespace: "custom", key: "usage")         { value }
      presentations: metafield(namespace: "custom", key: "presentations") { value }
      species:       metafield(namespace: "custom", key: "species")       { value }
      grupo:         metafield(namespace: "custom", key: "group")         { value }
      uso:           metafield(namespace: "custom", key: "use")           { value }
    }
  } }`;

const meta = (n, k) => (n[k] && n[k].value != null ? String(n[k].value) : '');

async function buscar() {
  const r = await fetch(`https://${cfg('domain')}/api/${cfg('apiVersion')}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': cfg('storefrontToken')
    },
    body: JSON.stringify({ query: QUERY })
  });
  if (!r.ok) throw new Error('Shopify respondeu HTTP ' + r.status);
  const json = await r.json();
  if (json.errors) throw new Error('Shopify: ' + JSON.stringify(json.errors).slice(0, 300));
  return json.data.products.nodes;
}

/* ── Utilitários de texto ────────────────────────────────────────────────── */
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const semTags = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function resumo(p) {
  const base = p.excerptScrub || p.headlineScrub || semTags(p.descriptionScrub) || p.title;
  return semTags(base).slice(0, 158);
}

function precoBR(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Substitui o conteúdo de um elemento localizado por id, preservando os
   atributos que já estão lá (classe, estilo). */
function trocarPorId(html, id, conteudo) {
  const rx = new RegExp('(<([a-z0-9]+)[^>]*\\bid="' + id + '"[^>]*>)([\\s\\S]*?)(</\\2>)', 'i');
  if (!rx.test(html)) return { html, ok: false };
  return { html: html.replace(rx, (m, abre, tag, _dentro, fecha) => abre + conteudo + fecha), ok: true };
}

function trocarNaHead(html, busca, novo) {
  return html.includes(busca) ? html.replace(busca, novo) : html;
}

/* ── Dados estruturados ──────────────────────────────────────────────────── */
function jsonLd(p, url) {
  const variantes = p.variants.nodes;
  const ofertas = variantes.map((v) => ({
    '@type': 'Offer',
    name: v.title === 'Default Title' ? undefined : v.title,
    sku: v.sku || undefined,
    price: Number(v.price.amount).toFixed(2),
    priceCurrency: 'BRL',
    availability: v.availableForSale
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    url
  }));
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: resumo(p),
    image: p.featuredImage ? [p.featuredImage.url] : [],
    brand: { '@type': 'Brand', name: 'Champion Saúde Animal' },
    url,
    offers: ofertas.length > 1
      ? {
        '@type': 'AggregateOffer',
        priceCurrency: 'BRL',
        lowPrice: Math.min(...variantes.map((v) => Number(v.price.amount))).toFixed(2),
        highPrice: Math.max(...variantes.map((v) => Number(v.price.amount))).toFixed(2),
        offerCount: ofertas.length,
        offers: ofertas
      }
      : ofertas[0]
  };
}

/* ── Montagem de uma página ──────────────────────────────────────────────── */
function montar(template, p) {
  const url = `${SITE}/produtos/${p.handle}`;
  const desc = resumo(p);
  const cat = p.categoryScrub || p.productType || 'Champion';
  const titulo = `${p.title}${cat && cat !== 'Champion' ? ' — ' + cat : ''} | Champion Saúde Animal`;
  const menor = Number(p.priceRange.minVariantPrice.amount);
  const varias = p.variants.nodes.length > 1;

  let h = template;

  /* head */
  h = trocarNaHead(h, '<title>Produto · Champion Saúde Animal</title>', `<title>${esc(titulo)}</title>`);
  h = h.replace('</head>', ''
    + `  <meta name="description" content="${esc(desc)}" />\n`
    + `  <link rel="canonical" href="${esc(url)}" />\n`
    + `  <meta property="og:type" content="product" />\n`
    + `  <meta property="og:title" content="${esc(titulo)}" />\n`
    + `  <meta property="og:description" content="${esc(desc)}" />\n`
    + `  <meta property="og:url" content="${esc(url)}" />\n`
    + (p.featuredImage ? `  <meta property="og:image" content="${esc(p.featuredImage.url)}" />\n` : '')
    + `  <script type="application/ld+json">${JSON.stringify(jsonLd(p, url))}</script>\n`
    + '</head>');

  /* corpo */
  const faltando = [];
  for (const [id, conteudo] of [
    ['crumbName', esc(p.title)],
    ['detailName', esc(p.title)],
    ['detailCat', esc(cat)],
    ['detailDesc', esc(desc)],
    ['detailPrice', menor > 0
      ? `R$ ${esc(precoBR(menor).split(',')[0])}<small>,${esc(precoBR(menor).split(',')[1])}</small>`
      : 'Sob consulta']
  ]) {
    const r = trocarPorId(h, id, conteudo);
    h = r.html;
    if (!r.ok) faltando.push(id);
  }

  /* rótulo "A partir de" quando há mais de um tamanho, igual ao runtime */
  if (varias) {
    h = h.replace('<span class="product-price-label"></span>',
      '<span class="product-price-label">A partir de</span>');
  }

  /* imagem principal */
  if (p.featuredImage) {
    const r = trocarPorId(h, 'detailArt',
      `<img class="detail-photo" src="${esc(p.featuredImage.url)}" alt="${esc(p.featuredImage.altText || p.title)}" />`);
    if (r.ok) h = r.html.replace(/(<div class="detail-art)"/, '$1 has-photo"');
    else faltando.push('detailArt');
  }

  return { html: h, faltando };
}

/* ── Cards do catálogo ───────────────────────────────────────────────────────
   O catálogo também precisa dos produtos no HTML cru: é por ele que o Google
   descobre as páginas de produto. Antes eram 17 cards escritos à mão, e só 3
   correspondiam a um produto real da loja — os outros 14 eram links mortos. */
function montarCard(p) {
  const cat = p.categoryScrub || p.productType || 'Champion';
  const url = `/produtos/${p.handle}`;
  const menor = Number(p.priceRange.minVariantPrice.amount);
  const varias = p.variants.nodes.length > 1;
  const preco = menor > 0
    ? (varias ? 'A partir de ' : '') + 'R$ ' + precoBR(menor)
    : 'Sob consulta';
  const foto = p.featuredImage
    ? `<img class="product-photo" src="${esc(p.featuredImage.url)}" alt="${esc(p.title)}" loading="lazy" />`
    : '';
  const mais = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
    + 'stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/>'
    + '<line x1="5" y1="12" x2="19" y2="12"/></svg>';

  /* Os filtros do catálogo (main.js) leem espécie, categoria e uso dos data-*
     do card. Sem eles no HTML gerado, filtrar só funcionaria depois que o
     products-cms.js hidratasse — e não funcionaria nunca para o rastreador. */
  return `<article class="product-card" data-product="${esc(p.handle)}"`
    + ` data-species="${esc(meta(p, 'species'))}"`
    + ` data-cats="${esc(meta(p, 'grupo'))}"`
    + ` data-use="${esc(meta(p, 'uso'))}">`
    + `<div class="product-thumb${foto ? ' has-photo' : ''}">`
    + `<a class="product-thumb-link" href="${esc(url)}" aria-label="Ver ${esc(p.title)}">${foto}</a></div>`
    + '<div class="product-body">'
    + `<span class="product-cat">${esc(cat)}</span>`
    + `<h3 class="product-name"><a href="${esc(url)}">${esc(p.title)}</a></h3>`
    + `<p class="product-desc">${esc(resumo(p))}</p>`
    + '<div class="product-foot"><div class="product-price-block">'
    + `<span class="product-price-label"></span><span class="product-price">${esc(preco)}</span></div>`
    + `<a href="${esc(url)}" class="product-add" aria-label="Ver ${esc(p.title)}">${mais}</a>`
    + '</div></div></article>';
}

function regravarCatalogo(produtos) {
  const arq = path.join(RAIZ, 'produtos.html');
  let html = fs.readFileSync(arq, 'utf8');

  /* Tolerante a classes extras: o container é "product-list stagger". */
  const mAbre = html.match(/<div[^>]*\bclass="[^"]*\bproduct-list\b[^"]*"[^>]*>/);
  if (!mAbre) throw new Error('container .product-list não encontrado em produtos.html');
  const abre = mAbre.index;
  const fimAbre = abre + mAbre[0].length;

  /* Fecha no </div> correspondente, contando aninhamento. */
  let nivel = 1, i = fimAbre;
  while (nivel > 0 && i < html.length) {
    const prox = html.slice(i).search(/<\/?div\b/);
    if (prox < 0) break;
    i += prox;
    nivel += html.slice(i, i + 5).startsWith('</div') ? -1 : 1;
    i += 4;
  }
  const fecha = html.lastIndexOf('</div>', i);
  if (nivel !== 0 || fecha < fimAbre) throw new Error('não consegui delimitar .product-list');

  const cards = '\n' + produtos.map((p) => '          ' + montarCard(p)).join('\n') + '\n        ';
  html = html.slice(0, fimAbre) + cards + html.slice(fecha);
  if (!DRY) fs.writeFileSync(arq, html);
  return produtos.length;
}

/* ── Execução ────────────────────────────────────────────────────────────── */
(async () => {
  const { scrub } = carregarScrub();
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const produtos = await buscar();

  console.log(`loja ${cfg('domain')} — ${produtos.length} produtos na vitrine\n`);

  if (!DRY) {
    fs.mkdirSync(SAIDA, { recursive: true });
    /* Remove páginas de produtos que saíram do catálogo, senão ficam órfãs no
       ar respondendo 200 para produto que não existe mais. */
    for (const f of fs.readdirSync(SAIDA).filter((f) => f.endsWith('.html'))) {
      if (!produtos.some((p) => p.handle + '.html' === f)) {
        fs.unlinkSync(path.join(SAIDA, f));
        console.log('  removido (saiu do catálogo): ' + f);
      }
    }
  }

  const avisos = [];
  for (const p of produtos) {
    /* Passa pelo mesmo scrub do runtime antes de virar HTML indexável. */
    const limpo = scrub({
      category: meta(p, 'category') || p.productType,
      tag: '',
      content: p.description,
      excerpt: meta(p, 'excerpt'),
      headline: meta(p, 'headline'),
      benefits: meta(p, 'benefits'),
      usage: meta(p, 'usage'),
      faq: []
    });
    p.categoryScrub = limpo.category;
    p.excerptScrub = limpo.excerpt;
    p.headlineScrub = limpo.headline;
    p.descriptionScrub = limpo.content;

    const { html, faltando } = montar(template, p);
    if (faltando.length) avisos.push(`${p.handle}: não localizou ${faltando.join(', ')}`);

    if (!DRY) fs.writeFileSync(path.join(SAIDA, p.handle + '.html'), html);
    console.log('  ' + p.handle.padEnd(42)
      + (Number(p.priceRange.minVariantPrice.amount) > 0
        ? 'R$ ' + precoBR(p.priceRange.minVariantPrice.amount)
        : 'sob consulta').padEnd(16)
      + (p.variants.nodes.length > 1 ? p.variants.nodes.length + ' tamanhos' : ''));
  }

  const nCards = regravarCatalogo(produtos);
  console.log('\ncatálogo: ' + nCards + ' cards regravados em produtos.html');

  if (avisos.length) {
    console.log('\nAVISOS (o template mudou de estrutura?):');
    avisos.forEach((a) => console.log('  ' + a));
  }
  console.log(`\n${produtos.length} páginas ${DRY ? 'seriam geradas' : 'geradas'} em frontend/produtos/`);
})().catch((e) => { console.error('FALHOU: ' + e.message); process.exit(1); });
