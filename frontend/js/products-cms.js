import { getAdminStore } from './admin-store.js';
import { PRODUCT_ALIASES, formatBRL, normalizeProduct } from './product-data.js';

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
    clone.setAttribute('aria-label', `Adicionar ${product.name} ao carrinho`);
    clone.addEventListener('click', (event) => {
      if (!Number.isFinite(Number(product.price))) return;
      event.preventDefault();
      event.stopPropagation();
      window.ChampionCart?.add({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: 1,
        art: product.name.charAt(0)
      }, { open: false });
    });
    button.replaceWith(clone);
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
    if (priceLabel) priceLabel.textContent = 'Preço fictício';

    const price = $('.product-price', card);
    if (price) {
      price.classList.toggle('product-price-consult', !Number.isFinite(Number(product.price)));
      price.textContent = formatBRL(product.price);
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
            <span class="product-price-label">Preço fictício</span>
            <span class="product-price">${escapeHtml(formatBRL(product.price))}</span>
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

  function replaceDetailCartButton(product) {
    const current = $('#addToCartBtn');
    if (!current) return;
    const clone = current.cloneNode(true);
    if (!Number.isFinite(Number(product.price))) {
      clone.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
        Solicitar orçamento
      `;
    }
    clone.addEventListener('click', () => {
      const qty = Math.max(1, Number($('#qtyInput')?.value || 1));
      const option = $('.detail-option.active')?.textContent || '';
      if (!Number.isFinite(Number(product.price))) {
        const msg = encodeURIComponent(`Olá! Quero receber orçamento e orientação técnica para ${product.name}${option ? ' · ' + option : ''}.`);
        window.open(`https://api.whatsapp.com/send/?phone=556240150742&type=phone_number&app_absent=0&text=${msg}`, '_blank');
        return;
      }
      window.ChampionCart?.add({
        id: `${product.id}|${option}`,
        name: product.name + (option ? ` · ${option}` : ''),
        price: Number(product.price),
        qty,
        art: product.name.charAt(0)
      });
    });
    current.replaceWith(clone);
  }

  function updateDetail(products) {
    if (!$('#detailName')) return;
    const requested = new URLSearchParams(window.location.search).get('p') || 'difly';
    const product = findProduct(products.filter((item) => item.status === 'published'), requested);
    if (!product) return;

    document.title = `${product.name} · Champion`;
    $('#crumbName').textContent = product.name;
    $('#detailName').textContent = product.name;
    $('#detailCat').textContent = product.category;
    $('#detailDesc').innerHTML = `<strong style="color:var(--ink)">${escapeHtml(product.headline || product.excerpt)}</strong><br>${escapeHtml(product.content || product.excerpt)}`;

    const price = $('#detailPrice');
    if (price) {
      if (Number.isFinite(Number(product.price))) {
        const [reais, centavos] = Number(product.price).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).split(',');
        price.classList.remove('product-price-consult');
        price.innerHTML = `R$ ${reais}<small>,${centavos}</small>`;
      } else {
        price.classList.add('product-price-consult');
        price.textContent = 'Sob consulta';
      }
    }

    const art = $('#detailArt');
    if (art && product.image) {
      art.className = 'detail-art has-photo';
      art.innerHTML = `<img class="detail-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`;
    }

    const options = $('#detailOptions');
    if (options) {
      options.innerHTML = '';
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

    const features = $('.detail-features');
    if (features) {
      const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      features.innerHTML = [
        ...splitBenefits(product.benefits).map((benefit) => `<div>${icon}<div><strong>${escapeHtml(benefit)}</strong></div></div>`),
        `<div>${icon}<div><strong>Modo de uso</strong>${escapeHtml(product.usage || 'Consulte a orientação técnica da Champion.')}</div></div>`,
        `<div>${icon}<div><strong>Atendimento técnico</strong>Confirme embalagem, disponibilidade e recomendação de uso com a Champion.</div></div>`
      ].join('');
    }

    replaceDetailCartButton(product);
  }

  try {
    const store = await getAdminStore();

    /* Carrega taxonomia primeiro para re-renderizar os filtros antes do catálogo */
    if (typeof store.getTaxonomy === 'function') {
      try {
        const taxonomy = await store.getTaxonomy();
        updateFilters(taxonomy);
      } catch (e) {
        console.warn('Taxonomia indisponível, usando filtros padrão.', e);
      }
    }

    const products = (await store.getProducts({ includeDrafts: false })).map(normalizeProduct);
    if (!products.length) return;
    updateCatalog(products);
    updateDetail(products);
  } catch (error) {
    console.error('Não foi possível carregar produtos do painel.', error);
  }
})();
