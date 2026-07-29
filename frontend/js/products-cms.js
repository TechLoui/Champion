import { getAdminStore } from './admin-store.js?v=20260522-2';
import { PRODUCT_ALIASES, formatBRL, normalizeProduct, getMinPrice, getDisplayImage } from './product-data.js?v=20260522-2';
import { isShopifyEnabled, getShopifyProducts } from './shopify-client.js';

(async function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function splitOptions(value) {
    return String(value || 'Consultar embalagem')
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitBenefits(value) {
    return String(value || '')
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function findProduct(products, id) {
    const normalized = PRODUCT_ALIASES[id] || id;
    return products.find((product) => product.id === normalized || product.id === id);
  }

  function setProductButton(card, product) {
    const button = $('.product-add', card);
    if (!button) return;
    const clone = button.cloneNode(true);
    clone.href = `produto.html?p=${encodeURIComponent(product.id)}`;
    const hasVariants = product.variants && product.variants.length > 0;
    clone.setAttribute('aria-label', hasVariants
      ? `Escolher variante de ${product.name}`
      : `Adicionar ${product.name} ao carrinho`);
    clone.addEventListener('click', (event) => {
      /* Sem estoque: o "+" apenas leva à página do produto (não adiciona). */
      if (product.available === false) return;
      /* Com variantes, o "+" leva pra página do produto pro cliente escolher. */
      if (hasVariants) return;
      /* Sem preço ou R$0 (atacado): leva à página do produto (botão de orçamento). */
      if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.ChampionCart?.add({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: 1,
        image: product.image || '',
        art: product.name.charAt(0),
        variantId: product.variantId || ''
      }, { open: false });
    });
    button.replaceWith(clone);
  }

  function cardPriceText(product) {
    if (product.available === false) return 'Esgotado';
    const hasVariants = product.variants && product.variants.length > 0;
    const min = getMinPrice(product);
    if (!Number.isFinite(min) || min <= 0) return 'Sob consulta';
    return (hasVariants ? 'A partir de ' : '') + formatBRL(min);
  }

  function updateCard(card, product) {
    card.hidden = false;
    card.dataset.product = product.id;

    const title = $('.product-name', card);
    if (title) {
      const link = $('a', title);
      if (link) {
        link.textContent = product.name;
        link.href = `produto.html?p=${encodeURIComponent(product.id)}`;
      } else {
        title.textContent = product.name;
      }
    }

    const cat = $('.product-cat', card);
    if (cat) cat.textContent = product.category;

    const desc = $('.product-desc', card);
    if (desc) desc.textContent = product.excerpt;

    const priceLabel = $('.product-price-label', card);
    if (priceLabel) priceLabel.textContent = '';

    const price = $('.product-price', card);
    if (price) {
      const min = getMinPrice(product);
      price.classList.toggle('product-price-consult', !Number.isFinite(min));
      price.textContent = cardPriceText(product);
    }

    const thumb = $('.product-thumb', card);
    if (thumb && product.image) {
      const tag = product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : '';
      thumb.className = 'product-thumb has-photo';
      thumb.innerHTML = `${tag}<img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
    }

    const mediaLink = $('.blog-card-media, .product-thumb a', card);
    if (mediaLink) mediaLink.href = `produto.html?p=${encodeURIComponent(product.id)}`;

    setProductButton(card, product);
  }

  function createCard(product) {
    const article = document.createElement('article');
    article.className = 'product-card is-visible';
    article.dataset.product = product.id;
    article.innerHTML = `
      <div class="product-thumb has-photo">
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ''}
        <img class="product-photo" src="${escapeHtml(product.image || 'assets/img/brand/icon.png')}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(product.category)}</span>
        <h3 class="product-name"><a href="produto.html?p=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
        <p class="product-desc">${escapeHtml(product.excerpt)}</p>
        <div class="product-foot">
          <div class="product-price-block">
            <span class="product-price-label"></span>
            <span class="product-price">${escapeHtml(cardPriceText(product))}</span>
          </div>
          <a href="produto.html?p=${encodeURIComponent(product.id)}" class="product-add" aria-label="Adicionar ${escapeHtml(product.name)} ao carrinho">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </a>
        </div>
      </div>
    `;
    setProductButton(article, product);
    return article;
  }

  function updateFilters(taxonomy) {
    /* Re-render dos filter blocks com base na taxonomia salva pelo admin. */
    const blocks = $$('.shop-side .filter-block');
    if (!blocks.length || !taxonomy) return;

    const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const renderItems = (items, attr) => items.map((it) => `
      <li><label class="filter-check"><input type="checkbox" data-${attr}="${escapeHtml(it.slug)}" /><span class="box">${checkSvg}</span>${escapeHtml(it.name)}<span class="count">0</span></label></li>
    `).join('');

    blocks.forEach((block) => {
      const h5 = block.querySelector('h5');
      if (!h5) return;
      const label = h5.textContent.trim().toLowerCase();
      const ul = block.querySelector('ul');
      if (!ul) return;
      if (label.startsWith('categoria') && taxonomy.groups) {
        ul.innerHTML = renderItems(taxonomy.groups, 'cat');
      } else if (label.startsWith('esp') && taxonomy.species) {
        ul.innerHTML = renderItems(taxonomy.species, 'esp');
      } else if ((label.includes('uso') || label.includes('forma')) && taxonomy.uses) {
        ul.innerHTML = renderItems(taxonomy.uses, 'use');
      }
    });

    /* Notifica o catálogo (produtos.html) pra recomputar contadores */
    if (typeof window.ChampionCatalog?.refreshFilters === 'function') {
      window.ChampionCatalog.refreshFilters();
    }
  }

  function updateCatalog(products) {
    const list = $('.product-list');
    if (!list || !products.length) return;

    const published = products.filter((product) => product.status === 'published');
    const byId = new Map(published.map((product) => [product.id, product]));
    const seen = new Set();

    $$('.product-card[data-product]', list).forEach((card) => {
      const product = findProduct(published, card.dataset.product);
      if (!product) {
        card.hidden = true;
        return;
      }
      seen.add(product.id);
      updateCard(card, product);
    });

    published.forEach((product) => {
      if (seen.has(product.id)) return;
      list.appendChild(createCard(product));
      byId.set(product.id, product);
    });

    const total = $('#shopTotal');
    if (total) total.textContent = String(published.length);
  }

  function formatDetailPrice(value) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return null;
    const [reais, centavos] = Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).split(',');
    return `R$ ${reais}<small>,${centavos}</small>`;
  }

  function updateDetailPriceEl(value) {
    const price = $('#detailPrice');
    if (!price) return;
    const formatted = formatDetailPrice(value);
    if (formatted) {
      price.classList.remove('product-price-consult');
      price.innerHTML = formatted;
    } else {
      price.classList.add('product-price-consult');
      price.textContent = 'Sob consulta';
    }
  }

  function updateDetailImageEl(product, variant) {
    const art = $('#detailArt');
    if (!art) return;
    const src = getDisplayImage(product, variant);
    if (!src) return;
    art.className = 'detail-art has-photo';
    art.innerHTML = `<img class="detail-photo" src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}" />`;
  }

  /* Devolve o "estado atual" da seleção: variante (se houver) ou nada.
     Closure compartilhada entre o seletor e o botão de adicionar. */
  function makeSelectionState(product) {
    let currentVariant = null;
    if (product.variants && product.variants.length) currentVariant = product.variants[0];
    return {
      get variant() { return currentVariant; },
      set(v) { currentVariant = v; }
    };
  }

  function replaceDetailCartButton(product, selection) {
    const current = $('#addToCartBtn');
    if (!current) return;
    const clone = current.cloneNode(true);
    /* Sem estoque: botão desabilitado com "Esgotado". */
    if (product.available === false) {
      clone.textContent = 'Esgotado';
      clone.style.opacity = '0.55';
      clone.style.pointerEvents = 'none';
      clone.setAttribute('aria-disabled', 'true');
      current.replaceWith(clone);
      return;
    }
    /* Se não há preço base nem nenhuma variante com preço, vira "orçamento" */
    const baseHasPrice = Number.isFinite(Number(product.price)) && Number(product.price) > 0;
    const anyVariantHasPrice = (product.variants || []).some((v) => Number.isFinite(Number(v.price)) && Number(v.price) > 0);
    const sellable = baseHasPrice || anyVariantHasPrice;
    if (!sellable) {
      clone.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
        Solicitar orçamento
      `;
    }
    clone.addEventListener('click', () => {
      const qty = Math.max(1, Number($('#qtyInput')?.value || 1));
      const variant = selection.variant;
      const optionLabel = variant ? variant.name : ($('.detail-option.active')?.textContent || '');
      const finalPrice = variant && Number.isFinite(Number(variant.price))
        ? Number(variant.price)
        : Number(product.price);
      if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        const msg = encodeURIComponent(`Olá! Tenho interesse em ATACADO/REVENDA do produto ${product.name}${optionLabel ? ' · ' + optionLabel : ''}. Podem me passar condições e valores?`);
        window.open(`https://api.whatsapp.com/send/?phone=5562981817915&type=phone_number&app_absent=0&text=${msg}`, '_blank');
        return;
      }
      const variantKey = variant ? variant.id : optionLabel;
      window.ChampionCart?.add({
        id: variantKey ? `${product.id}|${variantKey}` : product.id,
        name: product.name + (optionLabel ? ` · ${optionLabel}` : ''),
        price: finalPrice,
        qty,
        image: getDisplayImage(product, variant),
        art: product.name.charAt(0),
        variantId: (variant && variant.variantId) || product.variantId || ''
      });
    });
    current.replaceWith(clone);
  }

  function renderVariantSelector(product, selection) {
    const options = $('#detailOptions');
    if (!options) return;
    options.innerHTML = '';
    const hasVariants = product.variants && product.variants.length > 0;
    if (hasVariants) {
      options.classList.add('detail-options-rich');
      product.variants.forEach((variant, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `detail-option detail-option-variant${index === 0 ? ' active' : ''}`;
        const priceLabel = Number.isFinite(Number(variant.price))
          ? `R$ ${Number(variant.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'sob consulta';
        button.innerHTML = `
          ${variant.image ? `<span class="detail-option-thumb"><img src="${escapeHtml(variant.image)}" alt="" loading="lazy" /></span>` : ''}
          <span class="detail-option-text">
            <span class="detail-option-name">${escapeHtml(variant.name)}</span>
            <span class="detail-option-price">${escapeHtml(priceLabel)}</span>
          </span>
        `;
        button.addEventListener('click', () => {
          $$('.detail-option', options).forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
          selection.set(variant);
          updateDetailPriceEl(variant.price);
          updateDetailImageEl(product, variant);
        });
        options.appendChild(button);
      });
    } else {
      options.classList.remove('detail-options-rich');
      splitOptions(product.presentations).forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `detail-option${index === 0 ? ' active' : ''}`;
        button.textContent = option;
        button.addEventListener('click', () => {
          $$('.detail-option', options).forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
        });
        options.appendChild(button);
      });
    }
  }

  const SITE_ORIGIN = 'https://ofertaschampion.com.br';

  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      const parts = selector.match(/\[([^=]+)="([^"]+)"\]/);
      if (parts) el.setAttribute(parts[1], parts[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function setCanonical(href) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  function injectJsonLd(id, data) {
    let script = document.head.querySelector(`script[type="application/ld+json"][data-jsonld="${id}"]`);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-jsonld', id);
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  /* Validade do preço (1 ano à frente) — exigido pelo Google p/ rich result de Offer. */
  function priceValidUntil() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }

  /* Frete e devolução padrão — destrava o rich result de preço no Google. */
  const SHIPPING_DETAILS = {
    '@type': 'OfferShippingDetails',
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BR' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 7, unitCode: 'DAY' }
    }
  };
  const RETURN_POLICY = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'BR',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 7,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn'
  };

  function decorateOffer(offer) {
    return Object.assign(offer, {
      priceValidUntil: priceValidUntil(),
      shippingDetails: SHIPPING_DETAILS,
      hasMerchantReturnPolicy: RETURN_POLICY
    });
  }

  function buildProductSchema(product) {
    const url = `${SITE_ORIGIN}/produto.html?p=${encodeURIComponent(product.id)}`;
    const image = product.image ? [SITE_ORIGIN + '/' + product.image.replace(/^\/+/, '')] : [];
    const description = (product.headline || product.excerpt || product.content || product.name).slice(0, 5000);
    const hasVariants = product.variants && product.variants.length > 0;
    let offers;
    if (hasVariants) {
      offers = product.variants
        .filter((v) => Number.isFinite(Number(v.price)))
        .map((v) => decorateOffer({
          '@type': 'Offer',
          name: v.name,
          sku: `${product.id}-${v.id}`,
          price: Number(v.price).toFixed(2),
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          url: `${url}#${encodeURIComponent(v.id)}`
        }));
    } else if (Number.isFinite(Number(product.price))) {
      offers = [decorateOffer({
        '@type': 'Offer',
        sku: product.id,
        price: Number(product.price).toFixed(2),
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url
      })];
    }
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.id,
      mpn: product.id,
      brand: { '@type': 'Brand', name: 'Champion Saúde Animal' },
      category: product.category,
      description,
      image
    };
    if (offers && offers.length) data.offers = offers.length === 1 ? offers[0] : offers;
    return data;
  }

  function buildBreadcrumbSchema(product) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Produtos', item: SITE_ORIGIN + '/produtos.html' },
        { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_ORIGIN}/produto.html?p=${encodeURIComponent(product.id)}` }
      ]
    };
  }

  function hydrateProductMeta(product) {
    const url = `${SITE_ORIGIN}/produto.html?p=${encodeURIComponent(product.id)}`;
    const titleSuffix = product.category ? ` — ${product.category}` : '';
    const title = `${product.name}${titleSuffix} | Champion Saúde Animal`;
    const desc = (product.excerpt || product.headline || product.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 158);
    document.title = title;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:type"]', 'content', 'product');
    setMeta('meta[property="og:url"]', 'content', url);
    if (product.image) {
      const absImg = product.image.startsWith('http') ? product.image : `${SITE_ORIGIN}/${product.image.replace(/^\/+/, '')}`;
      setMeta('meta[property="og:image"]', 'content', absImg);
    }
    setCanonical(url);
    injectJsonLd('product', buildProductSchema(product));
    injectJsonLd('breadcrumb', buildBreadcrumbSchema(product));
  }

  const SPECIES_LABELS = {
    bovinos: 'Bovinos', equinos: 'Equinos', ovinos: 'Ovinos', suinos: 'Suínos',
    aves: 'Aves', minerais: 'Minerais', ambientes: 'Ambientes rurais', veterinario: 'Uso veterinário'
  };

  /* Banco de perguntas por GRUPO de produto. Cada item gera perguntas no
     vocabulário que o pecuarista realmente digita (sintoma/problema), o que
     faz a página ranquear para milhares de variações de busca em cauda longa.
     As respostas se apoiam nos dados reais do produto (sem inventar eficácia). */
  function groupFaq(product) {
    const g = String(product.group || '').toLowerCase();
    const cat = String(product.category || '').toLowerCase();
    const name = product.name;
    const base = product.excerpt || product.headline || '';
    const is = (k) => g.includes(k) || cat.includes(k);
    const nameHas = (k) => name.toLowerCase().includes(k);
    const out = [];

    if (is('larvicida') || nameHas('difly')) {
      out.push(
        { q: `O ${name} acaba com a mosca-dos-chifres no gado?`, a: `O ${name} é indicado para o controle da mosca-dos-chifres no rebanho, atuando na origem da infestação. ${base}` },
        { q: `Como controlar a mosca do chifre no gado com o ${name}?`, a: product.usage ? `${product.usage} Misturado no cocho, age no ciclo da mosca sem estresse de manejo.` : `O ${name} é fornecido no cocho e atua no ciclo reprodutivo da mosca-dos-chifres. Consulte a bula para a dose por cabeça.` }
      );
    }
    if (is('parasitario') || nameHas('s3')) {
      out.push(
        { q: `O ${name} controla carrapato e mosca ao mesmo tempo?`, a: `Sim, o ${name} tem ação ampliada contra os principais parasitas do rebanho. ${base}` },
        { q: `Como controlar carrapato no gado sem banho de imersão?`, a: `O ${name} é fornecido no cocho, ajudando no controle parasitário sem a necessidade de banho de imersão. Consulte a orientação técnica para o manejo ideal.` }
      );
    }
    if (is('inseticida')) {
      out.push(
        { q: `O ${name} serve para matar mosca no curral e nas instalações?`, a: `O ${name} é indicado para o controle de insetos em ambientes e instalações rurais. ${base}` },
        { q: `Como aplicar o ${name} no ambiente?`, a: product.usage || `Siga a diluição e a forma de aplicação indicadas no rótulo do ${name}, conforme orientação técnica.` }
      );
    }
    if (is('vermifug') || (is('mineraliza') && nameHas('vermi'))) {
      out.push(
        { q: `O ${name} é um bom vermífugo para gado?`, a: `O ${name} oferece vermifugação ${is('mineraliza') ? 'aliada à mineralização ' : ''}de forma prática no cocho. ${base}` },
        { q: `Como vermifugar o gado sem manejo, direto no cocho?`, a: product.usage ? `${product.usage}` : `O ${name} é fornecido junto ao sal/ração, permitindo vermifugação contínua sem apartar o rebanho.` },
        { q: `Com que frequência usar o ${name} no rebanho?`, a: `O uso contínuo no cocho mantém a proteção do rebanho. Consulte a orientação técnica da Champion para o protocolo ideal na sua propriedade.` }
      );
    }
    if (is('mineraliza') || is('microminerais') || is('cálcio') || is('calcio')) {
      out.push(
        { q: `Para que serve o ${name} na mineralização do rebanho?`, a: `O ${name} fornece minerais essenciais para o desempenho e a saúde do rebanho. ${base}` },
        { q: `O ${name} pode ser misturado no sal mineral?`, a: product.usage || `Sim, o ${name} é formulado para uso no cocho. Consulte a proporção de mistura no rótulo.` }
      );
    }
    if (is('nutri') || nameHas('núcleo') || nameHas('nucleo')) {
      out.push(
        { q: `O ${name} ajuda no ganho de peso e na engorda do gado?`, a: `O ${name} é formulado para desempenho e nutrição do rebanho. ${base}` },
        { q: `Como usar o ${name} na dieta dos animais?`, a: product.usage || `O ${name} entra na formulação da dieta conforme a categoria animal. Consulte a recomendação técnica para a inclusão correta.` },
        { q: `O ${name} serve para confinamento?`, a: `O ${name} pode ser usado em programas nutricionais como recria, engorda e confinamento. Fale com a equipe técnica para ajustar à sua fase de produção.` }
      );
    }
    if (is('reprodu')) {
      out.push(
        { q: `O ${name} ajuda a aumentar a taxa de prenhez?`, a: `O ${name} apoia o programa reprodutivo do rebanho com suporte nutricional. ${base}` },
        { q: `Quando usar o ${name} no protocolo de IATF?`, a: product.usage || `O ${name} é indicado dentro do manejo reprodutivo. Consulte a equipe técnica para o momento ideal de uso no seu protocolo.` }
      );
    }
    if (is('suplemento') || nameHas('a.d.e') || nameHas('ade')) {
      out.push(
        { q: `Para que serve o ${name} e quando suplementar?`, a: `O ${name} é um suplemento indicado para períodos de maior exigência do animal (seca, recria, reprodução e recuperação). ${base}` },
        { q: `O ${name} é em pó ou injetável e como administrar?`, a: product.usage || `Consulte o rótulo do ${name} para a forma de administração e a dose recomendada.` }
      );
    }
    return out;
  }

  /* Gera perguntas frequentes automáticas — definição, problema (por grupo),
     dose, espécie, segurança, preço, onde comprar e entrega — garantindo
     conteúdo rico e schema mesmo sem FAQ manual cadastrada. */
  function buildAutoFaq(product) {
    const name = product.name;
    const speciesLabel = SPECIES_LABELS[product.species] || '';
    const base = product.excerpt || product.headline || '';
    const faq = [];

    /* 1. Definição — pega buscas "o que é / para que serve {produto}" */
    faq.push({
      q: `O que é o ${name} e para que serve?`,
      a: `${base || `O ${name} é um produto Champion para saúde e nutrição animal.`} Veja abaixo a indicação, o modo de uso e as perguntas frequentes.`
    });

    /* 2. Perguntas de problema/sintoma específicas do grupo */
    groupFaq(product).forEach((item) => faq.push(item));

    /* 3. Modo de uso / dose */
    if (product.usage) {
      faq.push({ q: `Qual a dose e como usar o ${name}?`, a: product.usage });
    }

    /* 4. Espécie / indicação */
    if (speciesLabel) {
      faq.push({
        q: `O ${name} pode ser usado em ${speciesLabel.toLowerCase()}?`,
        a: `Sim, o ${name} é indicado para ${speciesLabel.toLowerCase()}. Em caso de dúvida sobre a indicação para o seu rebanho, fale com a equipe técnica da Champion.`
      });
    }

    /* 5. Segurança / resíduo / carência — pergunta muito buscada */
    faq.push({
      q: `O ${name} deixa resíduo no leite ou na carne? Tem período de carência?`,
      a: `Siga sempre a bula e o rótulo do ${name} quanto a carência e restrições de uso. Em caso de dúvida sobre o uso no seu rebanho, consulte a equipe técnica da Champion ou o seu responsável técnico.`
    });

    /* 6. Apresentações / tamanhos */
    if (product.presentations && product.presentations.toLowerCase() !== 'consultar embalagem') {
      faq.push({ q: `Quais as apresentações do ${name}?`, a: `Apresentações disponíveis: ${product.presentations}.` });
    } else if (product.variants && product.variants.length) {
      faq.push({
        q: `Quais tamanhos do ${name} estão disponíveis?`,
        a: `Disponível em: ${product.variants.map((v) => v.name).join(', ')}. Cada opção pode ter preço diferente — selecione a desejada acima.`
      });
    }

    /* 7. Preço / onde comprar — pega buscas "preço / onde comprar {produto}" */
    const min = getMinPrice(product);
    if (Number.isFinite(min)) {
      faq.push({
        q: `Quanto custa e onde comprar o ${name}?`,
        a: `Você compra o ${name} direto no site oficial da Champion, a partir de ${formatBRL(min)}, com pagamento protegido e entrega para todo o Brasil.`
      });
    } else {
      faq.push({
        q: `Onde comprar o ${name}?`,
        a: `O ${name} pode ser solicitado direto pela Champion. Use o botão de contato na página para receber preço, disponibilidade e orientação técnica.`
      });
    }

    /* 8. Registro MAPA */
    faq.push({
      q: `O ${name} tem registro no Ministério da Agricultura (MAPA)?`,
      a: `Sim. Os produtos Champion seguem as normas do MAPA. Consulte o rótulo da embalagem para o número de registro e a bula completa.`
    });

    /* 9. Entrega nacional */
    faq.push({
      q: `A Champion entrega o ${name} em todo o Brasil?`,
      a: `Sim, a Champion atende todo o território nacional. O prazo de entrega varia conforme a região e é informado no checkout.`
    });

    return faq;
  }

  function getProductFaq(product) {
    /* FAQ manual cadastrada no admin tem prioridade; complementa com as automáticas. */
    const manual = Array.isArray(product.faq) ? product.faq : [];
    const auto = buildAutoFaq(product);
    const combined = [...manual];
    auto.forEach((item) => {
      if (!combined.some((m) => m.q.toLowerCase() === item.q.toLowerCase())) combined.push(item);
    });
    return combined;
  }

  function renderProductContent(product) {
    /* Texto principal (descrição completa) */
    const textEl = $('#productContentText');
    if (textEl) {
      const paragraphs = String(product.content || product.excerpt || '')
        .split(/\n{2,}|\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      textEl.innerHTML = paragraphs.length
        ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
        : `<p>${escapeHtml(product.excerpt || product.name)}</p>`;
    }
    const titleEl = $('#productContentTitle');
    if (titleEl) titleEl.textContent = `Sobre o ${product.name}`;

    /* Benefícios */
    const benefits = splitBenefits(product.benefits);
    const benefitsBlock = $('#productBenefitsBlock');
    const benefitsList = $('#productBenefitsList');
    if (benefitsBlock && benefitsList) {
      if (benefits.length) {
        benefitsList.innerHTML = benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
        benefitsBlock.hidden = false;
      } else {
        benefitsBlock.hidden = true;
      }
    }

    /* Modo de uso */
    const usageBlock = $('#productUsageBlock');
    const usageText = $('#productUsageText');
    if (usageBlock && usageText) {
      if (product.usage) {
        usageText.textContent = product.usage;
        usageBlock.hidden = false;
      } else {
        usageBlock.hidden = true;
      }
    }

    /* Ficha rápida (specs) */
    const specs = $('#productSpecsList');
    if (specs) {
      const rows = [];
      if (product.category) rows.push(['Categoria', product.category]);
      const speciesLabel = SPECIES_LABELS[product.species];
      if (speciesLabel) rows.push(['Indicação', speciesLabel]);
      if (product.variants && product.variants.length) {
        rows.push(['Opções', product.variants.map((v) => v.name).join(' · ')]);
      } else if (product.presentations) {
        rows.push(['Apresentação', product.presentations]);
      }
      rows.push(['Registro', 'MAPA — ver rótulo']);
      rows.push(['Entrega', 'Todo o Brasil']);
      specs.innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
    }

    /* Guia relacionado (interlink produto → pilar de SEO), por grupo */
    const guideBox = $('#productGuideBox');
    const guideLink = $('#productGuideLink');
    if (guideBox && guideLink) {
      const g = String(product.group || '').toLowerCase();
      const cat = String(product.category || '').toLowerCase();
      const has = (k) => g.includes(k) || cat.includes(k);
      let guide = null;
      if (has('larvicida') || has('parasitario') || has('inseticida') || /difly/i.test(product.name)) {
        guide = { href: 'guias/controle-mosca-dos-chifres.html', label: 'Como controlar a mosca-dos-chifres no gado' };
      } else if (has('vermifug') || /vermi/i.test(product.name)) {
        guide = { href: 'guias/vermifugacao-bovinos.html', label: 'Vermifugação de bovinos: quando e como' };
      } else if (has('mineraliza') || has('microminerais') || has('cálcio') || has('calcio') || has('nutri') || /núcleo|nucleo/i.test(product.name)) {
        guide = { href: 'guias/sal-mineral-para-gado.html', label: 'Sal mineral para gado: guia completo' };
      }
      if (guide) {
        guideLink.innerHTML = `<a href="${guide.href}">${escapeHtml(guide.label)} →</a>`;
        guideBox.hidden = false;
      } else {
        guideBox.hidden = true;
      }
    }

    /* CTA da ficha rápida rola de volta pro seletor de compra */
    const cta = $('#productContentCta');
    if (cta) {
      cta.addEventListener('click', (ev) => {
        ev.preventDefault();
        document.querySelector('.detail-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    /* FAQ acordeão */
    const faq = getProductFaq(product);
    const faqBlock = $('#productFaqBlock');
    const faqList = $('#productFaqList');
    if (faqBlock && faqList) {
      if (faq.length) {
        faqList.innerHTML = faq.map((item, i) => `
          <details class="product-faq-item"${i === 0 ? ' open' : ''}>
            <summary>${escapeHtml(item.q)}</summary>
            <div class="product-faq-answer"><p>${escapeHtml(item.a)}</p></div>
          </details>
        `).join('');
        faqBlock.hidden = false;
        injectJsonLd('faq', {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a }
          }))
        });
      } else {
        faqBlock.hidden = true;
      }
    }
  }

  function updateDetail(products) {
    if (!$('#detailName')) return;
    const requested = new URLSearchParams(window.location.search).get('p') || 'difly';
    const product = findProduct(products.filter((item) => item.status === 'published'), requested);
    if (!product) return;

    hydrateProductMeta(product);
    renderProductContent(product);

    $('#crumbName').textContent = product.name;
    $('#detailName').textContent = product.name;
    $('#detailCat').textContent = product.category;
    $('#detailDesc').innerHTML = `<strong style="color:var(--ink)">${escapeHtml(product.headline || product.excerpt)}</strong><br>${escapeHtml(product.content || product.excerpt)}`;

    const selection = makeSelectionState(product);
    const initialPrice = selection.variant && Number.isFinite(Number(selection.variant.price))
      ? selection.variant.price
      : product.price;
    updateDetailPriceEl(initialPrice);
    updateDetailImageEl(product, selection.variant);
    renderVariantSelector(product, selection);

    const features = $('.detail-features');
    if (features) {
      const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      features.innerHTML = [
        ...splitBenefits(product.benefits).map((benefit) => `<div>${icon}<div><strong>${escapeHtml(benefit)}</strong></div></div>`),
        `<div>${icon}<div><strong>Modo de uso</strong>${escapeHtml(product.usage || 'Consulte a orientação técnica da Champion.')}</div></div>`,
        `<div>${icon}<div><strong>Atendimento técnico</strong>Confirme embalagem, disponibilidade e recomendação de uso com a Champion.</div></div>`
      ].join('');
    }

    replaceDetailCartButton(product, selection);
  }

  /* Otimiza a página de catálogo (produtos.html): canonical, OG e ItemList.
     Roda só quando NÃO é a página de detalhe de produto. */
  function updateCatalogSeo(products) {
    if ($('#detailName')) return; /* página de produto tem seu próprio meta */
    const list = $('.product-list');
    if (!list) return; /* não é o catálogo */

    const url = `${SITE_ORIGIN}/produtos.html`;
    const title = 'Produtos Champion — Saúde e nutrição animal para todo o Brasil';
    const desc = 'Catálogo Champion: larvicidas, vermífugos, mineralização, suplementos e nutrição para bovinos, equinos, suínos e aves. Compra protegida e entrega nacional.';
    document.title = title;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[property="og:url"]', 'content', url);
    setCanonical(url);

    const published = products.filter((p) => p.status === 'published');
    injectJsonLd('itemlist', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Catálogo Champion Saúde Animal',
      numberOfItems: published.length,
      itemListElement: published.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_ORIGIN}/produto.html?p=${encodeURIComponent(p.id)}`,
        name: p.name
      }))
    });
  }

  /* Fonte dos produtos: Shopify (quando configurado) ou o admin/Firestore atual.
     A taxonomia dos filtros continua vindo do admin store (os slugs de
     species/group/use dos metafields do Shopify usam o mesmo vocabulário). */
  async function loadProducts() {
    if (isShopifyEnabled()) {
      try {
        const prods = await getShopifyProducts();
        /* Aplica o liga/desliga feito no painel admin (Modelo B): handle
           desativado vira 'draft' e é filtrado da vitrine. */
        let hidden = {};
        try {
          const store = await getAdminStore();
          hidden = (await store.getCatalogVisibility()).hidden || {};
        } catch (e) { /* sem visibilidade → todos visíveis */ }
        return prods.map((p) => (hidden[p.id] ? Object.assign({}, p, { status: 'draft' }) : p));
      } catch (err) {
        console.error('Falha ao carregar produtos do Shopify, usando fonte local.', err);
      }
    }
    const store = await getAdminStore();
    if (typeof store.getTaxonomy === 'function') {
      try {
        updateFilters(await store.getTaxonomy());
      } catch (e) {
        console.warn('Taxonomia indisponível, usando filtros padrão.', e);
      }
    }
    return store.getProducts({ includeDrafts: false });
  }

  try {
    const products = (await loadProducts()).map(normalizeProduct);
    if (!products.length) return;
    updateCatalog(products);
    updateCatalogSeo(products);
    updateDetail(products);
  } catch (error) {
    console.error('Não foi possível carregar produtos do painel.', error);
  }
})();
