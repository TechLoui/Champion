import { getAdminStore } from './admin-store.js?v=20260828-8';
import { PRODUCT_ALIASES, formatBRL, normalizeProduct, getMinPrice, getDisplayImage } from './product-data.js?v=20260828-8';
import { isShopifyEnabled, getShopifyProducts } from './shopify-client.js?v=20260828-8';

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

  /* ── Conformidade regulatória (MAPA): o site NÃO pode conter claims de
     vermífugo / combate a vermes. Remove esses termos de todo texto renderizado,
     mesmo que venham da descrição do produto no Shopify. ── */
  const REGULATED_RX = /verm[íi]fug\w*|verminose\w*|vermes|nemat[óo]deo\w*|anti-?helm\w*|helm[íi]nt\w*|combate\s+(?:a\s+)?verm\w*/i;
  function scrubSentences(text) {
    if (!text) return text;
    return String(text)
      .split(/\n{2,}|\n/)
      .map((para) => para.split(/(?<=[.!?])\s+/).filter((s) => !REGULATED_RX.test(s)).join(' ').trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  function scrubLines(text) {
    if (!text) return text;
    return String(text).split(/\n|;/).map((s) => s.trim()).filter((s) => s && !REGULATED_RX.test(s)).join('\n');
  }
  /* category e tag são rótulos curtos ("Bovinos · Vermífugo mineral"), não frases —
     o scrub por sentença não os alcançava, e era por aí que o termo continuava
     aparecendo no card e no topo da página. Remove o segmento problemático e
     mantém o resto do rótulo. */
  function scrubLabel(text, fallback) {
    const kept = String(text || '')
      .split('·')
      .map((part) => part.trim())
      .filter((part) => part && !REGULATED_RX.test(part));
    return kept.length ? kept.join(' · ') : (fallback || '');
  }

  function primeiraFrase(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const m = t.match(/^[^.!?\n]+[.!?]?/);
    return (m ? m[0] : t).trim();
  }

  function scrubRegulatedProduct(p) {
    p.category = scrubLabel(p.category, 'Champion');
    p.tag = scrubLabel(p.tag, '');
    p.content = scrubSentences(p.content);
    p.excerpt = REGULATED_RX.test(p.excerpt || '') ? scrubSentences(p.excerpt) : p.excerpt;
    p.headline = REGULATED_RX.test(p.headline || '') ? '' : p.headline;
    p.benefits = scrubLines(p.benefits);
    p.usage = scrubSentences(p.usage);
    if (Array.isArray(p.faq)) p.faq = p.faq.filter((f) => !REGULATED_RX.test((f.q || '') + ' ' + (f.a || '')));

    /* Em produtos como o Vermi-Sal, headline e excerpt são de uma frase só — e a
       frase é justamente o claim regulado. O scrub tira a frase e não sobra nada,
       deixando a página sem nenhuma linha descritiva.

       O texto já passou pelo scrub, então reaproveitar o começo dele é seguro:
       o conteúdo é compatível por construção. Melhor uma descrição mais curta
       do que um campo vazio. */
    if (!p.excerpt) p.excerpt = primeiraFrase(p.content);
    if (!p.headline) p.headline = p.excerpt || primeiraFrase(p.content);

    return p;
  }

  function findProduct(products, id) {
    const normalized = PRODUCT_ALIASES[id] || id;
    return products.find((product) => product.id === normalized || product.id === id);
  }

  function setProductButton(card, product, ehFamilia) {
    const button = $('.product-add', card);
    if (!button) return;
    const clone = button.cloneNode(true);
    clone.href = `/produto?p=${encodeURIComponent(product.id)}`;
    const hasVariants = product.variants && product.variants.length > 0;
    clone.setAttribute('aria-label', hasVariants
      ? `Escolher variante de ${product.name}`
      : `Adicionar ${product.name} ao carrinho`);
    clone.addEventListener('click', (event) => {
      /* Sem estoque: o "+" apenas leva à página do produto (não adiciona). */
      if (product.available === false) return;
      /* Com variantes OU com apresentações irmãs, o "+" leva pra página do
         produto: o cliente precisa escolher, não dá pra adivinhar o tamanho. */
      if (hasVariants || ehFamilia) return;
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

  /* Uma família ocupa UM card no catálogo, representada pela apresentação mais
     barata — é ela que sustenta o "a partir de". As demais não viram card. */
  function collapseFamilies(published) {
    const vistas = new Set();
    const saida = [];
    for (const p of published) {
      const fam = String(p.family || '').trim().toLowerCase();
      if (!fam) { saida.push(p); continue; }
      if (vistas.has(fam)) continue;
      vistas.add(fam);
      const grupo = siblingsOf(p, published);
      saida.push(grupo.length ? grupo[0] : p);
    }
    return saida;
  }

  function cardPriceText(product, ehFamilia) {
    if (!ehFamilia && product.available === false) return 'Esgotado';
    const hasVariants = product.variants && product.variants.length > 0;
    const min = getMinPrice(product);
    if (!Number.isFinite(min) || min <= 0) return 'Sob consulta';
    return (hasVariants || ehFamilia ? 'A partir de ' : '') + formatBRL(min);
  }

  function updateCard(card, product, ehFamilia) {
    card.hidden = false;
    card.dataset.product = product.id;
    /* Expõe espécie/categoria pro motor de filtros (main.js). */
    card.dataset.species = product.species || '';
    card.dataset.cats = product.group || '';

    const title = $('.product-name', card);
    if (title) {
      const link = $('a', title);
      if (link) {
        link.textContent = product.name;
        link.href = `/produto?p=${encodeURIComponent(product.id)}`;
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
      price.textContent = cardPriceText(product, ehFamilia);
    }

    const thumb = $('.product-thumb', card);
    if (thumb && product.image) {
      const tag = product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : '';
      thumb.className = 'product-thumb has-photo';
      thumb.innerHTML = `${tag}<a class="product-thumb-link" href="/produto?p=${encodeURIComponent(product.id)}" aria-label="Ver ${escapeHtml(product.name)}"><img class="product-photo" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" /></a>`;
    }

    const mediaLink = $('.blog-card-media, .product-thumb a', card);
    if (mediaLink) mediaLink.href = `/produto?p=${encodeURIComponent(product.id)}`;

    setProductButton(card, product, ehFamilia);
  }

  function createCard(product, ehFamilia) {
    const article = document.createElement('article');
    article.className = 'product-card is-visible';
    article.dataset.product = product.id;
    article.dataset.species = product.species || '';
    article.dataset.cats = product.group || '';
    article.innerHTML = `
      <div class="product-thumb has-photo">
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ''}
        <a class="product-thumb-link" href="/produto?p=${encodeURIComponent(product.id)}" aria-label="Ver ${escapeHtml(product.name)}"><img class="product-photo" src="${escapeHtml(product.image || '/assets/img/brand/icon.png')}" alt="${escapeHtml(product.name)}" loading="lazy" /></a>
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(product.category)}</span>
        <h3 class="product-name"><a href="/produto?p=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
        <p class="product-desc">${escapeHtml(product.excerpt)}</p>
        <div class="product-foot">
          <div class="product-price-block">
            <span class="product-price-label"></span>
            <span class="product-price">${escapeHtml(cardPriceText(product, ehFamilia))}</span>
          </div>
          <a href="/produto?p=${encodeURIComponent(product.id)}" class="product-add" aria-label="Adicionar ${escapeHtml(product.name)} ao carrinho">
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
    /* Uma família ocupa um card só, representada pela apresentação mais barata —
       é o que sustenta o "A partir de". Os outros tamanhos não viram card; eles
       aparecem como opção dentro da página do produto. */
    const vitrine = collapseFamilies(published);
    const naVitrine = new Set(vitrine.map((p) => p.id));
    const temIrmaos = new Map(vitrine.map((p) => [p.id, siblingsOf(p, published).length > 0]));
    const seen = new Set();

    $$('.product-card[data-product]', list).forEach((card) => {
      const product = findProduct(published, card.dataset.product);
      /* Card estático de um tamanho que agora é opção de outro: sai da vitrine. */
      if (!product || !naVitrine.has(product.id)) {
        card.hidden = true;
        return;
      }
      seen.add(product.id);
      updateCard(card, product, temIrmaos.get(product.id));
    });

    vitrine.forEach((product) => {
      if (seen.has(product.id)) return;
      list.appendChild(createCard(product, temIrmaos.get(product.id)));
    });

    const total = $('#shopTotal');
    if (total) total.textContent = String(vitrine.length);
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
  function makeSelectionState(product, irmaos) {
    let currentVariant = null;
    let currentSibling = null;
    const temIrmaos = Boolean(irmaos && irmaos.length);
    const quantasVariantes = (product.variants && product.variants.length) || 0;
    /* Só é escolha quando há mais de uma. */
    const temVariantes = quantasVariantes > 1;

    /* NADA vem pré-selecionado quando existe mais de uma apresentação — seja
       variante do Shopify, seja produto irmão. São preços e embalagens
       diferentes; escolher pelo cliente é como ele acaba levando o tamanho
       errado.

       Variante única é exceção: não há o que escolher, então ela já vem
       marcada. Sem isso o cliente teria de clicar numa opção só para liberar a
       compra, e o carrinho perderia o GID da variante. */
    if (!temIrmaos && quantasVariantes === 1) {
      currentVariant = product.variants[0];
    }
    return {
      get variant() { return currentVariant; },
      set(v) { currentVariant = v; },
      get sibling() { return currentSibling; },
      setSibling(p) { currentSibling = p; },
      get needsChoice() {
        if (temIrmaos) return !currentSibling;
        if (temVariantes) return !currentVariant;
        return false;
      }
    };
  }

  /* Enquanto falta escolher, o botão diz o que falta em vez de convidar a
     comprar, e as apresentações pulsam para puxar o olho pra decisão. */
  function atualizarEstadoEscolha(selection) {
    const falta = selection.needsChoice;

    const options = $('#detailOptions');
    if (options) options.classList.toggle('aguardando-escolha', falta);

    const btn = $('#addToCartBtn');
    if (!btn) return;
    btn.classList.toggle('is-aguardando', falta);
    const rotulo = $('.add-cart-label', btn);
    if (rotulo) {
      rotulo.textContent = falta ? 'Escolha o tamanho' : 'Adicionar ao carrinho';
    }
  }

  function replaceDetailCartButton(product, selection, irmaos) {
    const temIrmaos = Boolean(irmaos && irmaos.length);
    const current = $('#addToCartBtn');
    if (!current) return;
    const clone = current.cloneNode(true);
    /* Envolve o texto num span para poder trocar o rotulo depois sem recriar o
       botao (e sem perder os listeners). */
    if (!$('.add-cart-label', clone)) {
      const icone = clone.querySelector('svg');
      clone.innerHTML = (icone ? icone.outerHTML : '')
        + '<span class="add-cart-label">Adicionar ao carrinho</span>';
    }
    /* Sem estoque: botão desabilitado com "Esgotado". Numa família isso não vale
       na abertura — o estoque é de cada apresentação, e o cliente ainda não
       escolheu; a checagem passa para o clique. */
    if (!temIrmaos && product.available === false) {
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
    const anySiblingHasPrice = menorPrecoDe(irmaos || []) !== null;
    const sellable = baseHasPrice || anyVariantHasPrice || anySiblingHasPrice;
    if (!sellable) {
      clone.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
        Solicitar orçamento
      `;
    }
    clone.addEventListener('click', () => {
      /* Família sem apresentação escolhida: não adivinha o tamanho. */
      if (selection.needsChoice) {
        pedirEscolha();
        return;
      }
      const qty = Math.max(1, Number($('#qtyInput')?.value || 1));
      /* Apresentação escolhida é um produto Shopify inteiro; variante é uma
         opção dentro do produto. Nunca ocorrem juntas. */
      const irmao = selection.sibling;
      const alvo = irmao || product;
      if (alvo.available === false) { pedirEscolha(); const h=document.getElementById("detailChoiceHint"); if(h) h.textContent="Este tamanho está esgotado. Escolha outro."; return; }
      const variant = irmao ? null : selection.variant;
      const optionLabel = irmao
        ? (irmao.presentation || '')
        : (variant ? variant.name : ($('.detail-option.active')?.textContent || ''));
      const finalPrice = variant && Number.isFinite(Number(variant.price))
        ? Number(variant.price)
        : Number(getMinPrice(alvo));
      if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        const msg = encodeURIComponent(`Olá! Tenho interesse em ATACADO/REVENDA do produto ${alvo.name}${!irmao && optionLabel ? ' · ' + optionLabel : ''}. Podem me passar condições e valores?`);
        window.open(`https://api.whatsapp.com/send/?phone=5562981817915&type=phone_number&app_absent=0&text=${msg}`, '_blank');
        return;
      }
      /* Apresentação irmã já é um produto distinto — entra no carrinho com o
         próprio handle. Variante é subdivisão, então vira chave composta. */
      const cartId = irmao
        ? alvo.id
        : (variant ? `${product.id}|${variant.id}` : (optionLabel ? `${product.id}|${optionLabel}` : product.id));
      window.ChampionCart?.add({
        id: cartId,
        /* O nome do irmão já diz o tamanho; só a variante precisa do sufixo. */
        name: irmao ? alvo.name : product.name + (optionLabel ? ` · ${optionLabel}` : ''),
        price: finalPrice,
        qty,
        image: getDisplayImage(alvo, variant),
        art: alvo.name.charAt(0),
        variantId: (variant && variant.variantId) || alvo.variantId || ''
      });
      /* Remarketing de carrinho abandonado depende deste evento. O `id` tem de
         ser o mesmo do feed do Merchant Center, senão o anúncio não casa com o
         produto — por isso vai o handle, não a chave composta do carrinho. */
      window.ChampionTracking?.addToCart({
        id: alvo.id,
        name: alvo.name,
        variant: optionLabel || undefined,
        category: alvo.category,
        price: finalPrice,
        qty
      });
    });
    current.replaceWith(clone);
  }

  /* Produtos da mesma "família" são apresentações do mesmo item — Difly balde
     6 kg e Difly sachê 20 g, por exemplo. No Shopify eles são produtos
     separados, cada um com handle e GID de checkout próprios; aqui viram
     opções na mesma página.

     O agrupamento vem do metafield `familia`, nunca do nome do produto: por
     nome, "Difly S3" seria lido como um tamanho do Difly, e é outra
     formulação. Quem decide o que agrupa é o cadastro, não uma heurística. */
  function siblingsOf(product, products) {
    const fam = String(product.family || '').trim().toLowerCase();
    if (!fam) return [];
    const grupo = (products || []).filter((p) =>
      p.status === 'published' && String(p.family || '').trim().toLowerCase() === fam);
    if (grupo.length < 2) return [];
    return grupo.slice().sort((a, b) => {
      const pa = Number(getMinPrice(a)), pb = Number(getMinPrice(b));
      if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
      return String(a.presentation || a.name).localeCompare(String(b.presentation || b.name), 'pt-BR');
    });
  }

  /* Rótulo acima do preço ("A partir de", enquanto nada foi escolhido). */
  function setPriceLabel(text) {
    const el = $('.detail-price-block .product-price-label') || $('.product-price-label');
    if (el) el.textContent = text || '';
  }

  function limparAvisoEscolha() {
    const hint = $('#detailChoiceHint');
    if (hint) hint.remove();
  }

  /* Clicou em adicionar sem escolher a apresentação: em vez de adivinhar um
     tamanho, leva o cliente até o seletor e diz o que falta. */
  function pedirEscolha() {
    const options = $('#detailOptions');
    if (!options) return;
    let hint = $('#detailChoiceHint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'detailChoiceHint';
      hint.setAttribute('role', 'alert');
      hint.style.cssText = 'margin:10px 0 0;font-size:13px;font-weight:600;color:#D8352A';
      options.insertAdjacentElement('afterend', hint);
    }
    hint.textContent = 'Escolha o tamanho antes de adicionar ao carrinho.';
    options.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* Menor preço entre as apresentações da família. */
  function menorPrecoDe(lista) {
    const precos = lista
      .map((p) => Number(getMinPrice(p)))
      .filter((n) => Number.isFinite(n) && n > 0);
    return precos.length ? Math.min(...precos) : null;
  }

  function renderVariantSelector(product, selection, irmaos) {
    const options = $('#detailOptions');
    if (!options) return;
    options.innerHTML = '';
    limparAvisoEscolha();
    if (options.parentElement) options.parentElement.hidden = false;
    const hasVariants = product.variants && product.variants.length > 0;
    irmaos = irmaos || [];
    if (hasVariants) {
      options.classList.add('detail-options-rich');
      product.variants.forEach((variant) => {
        const button = document.createElement('button');
        button.type = 'button';
        /* Sem 'active' no primeiro: a escolha e do cliente. */
        button.className = 'detail-option detail-option-variant';
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
          setPriceLabel('');
          updateDetailPriceEl(variant.price);
          updateDetailImageEl(product, variant);
          limparAvisoEscolha();
          atualizarEstadoEscolha(selection);
        });
        options.appendChild(button);
      });
    } else if (irmaos.length) {
      /* Cada apresentação é um produto próprio no Shopify (handle e GID de
         checkout próprios), mas aqui se comporta como variante: escolher troca
         preço e imagem sem sair da página. Nenhum botão nasce ativo. */
      options.classList.add('detail-options-rich');
      irmaos.forEach((irmao) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'detail-option detail-option-variant';
        const preco = Number(getMinPrice(irmao));
        const priceLabel = Number.isFinite(preco) && preco > 0 ? formatBRL(preco) : 'sob consulta';
        button.innerHTML = `
          ${irmao.image ? `<span class="detail-option-thumb"><img src="${escapeHtml(irmao.image)}" alt="" loading="lazy" /></span>` : ''}
          <span class="detail-option-text">
            <span class="detail-option-name">${escapeHtml(irmao.presentation || irmao.name)}</span>
            <span class="detail-option-price">${escapeHtml(priceLabel)}</span>
          </span>
        `;
        button.addEventListener('click', () => {
          $$('.detail-option', options).forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
          selection.setSibling(irmao);
          setPriceLabel('');
          updateDetailPriceEl(getMinPrice(irmao));
          updateDetailImageEl(irmao, null);
          limparAvisoEscolha();
          atualizarEstadoEscolha(selection);
        });
        options.appendChild(button);
      });
    } else {
      options.classList.remove('detail-options-rich');
      const lista = splitOptions(product.presentations);
      /* Uma opção só não é escolha. Renderizada como botão, ela convida a um
         clique que não faz nada — foi assim que "Consultar embalagem" virou
         reclamação de cliente. Vira rótulo. */
      if (lista.length < 2) {
        const rotulo = document.createElement('span');
        rotulo.className = 'detail-option detail-option-static';
        rotulo.textContent = lista[0] || 'Consultar embalagem';
        options.appendChild(rotulo);
        return;
      }
      lista.forEach((option, index) => {
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

  const SITE_ORIGIN = 'https://champion.ind.br';

  /* URL canônica do produto.
     As duas rotas respondem: /produto?p=<slug> (a que está no ar e para onde os
     anúncios apontam) e /produtos/<slug>. Os links internos seguem usando a
     primeira; o canonical e os dados estruturados apontam para /produtos/<slug>,
     que é a forma que vai ser adotada quando os anúncios migrarem.
     normalizeProduct() passa o id por slugify(), então ele já casa com o
     [a-z0-9-]+ esperado pela regra de rewrite. */
  function productUrl(product) {
    return `${SITE_ORIGIN}/produtos/${encodeURIComponent(product.id)}`;
  }

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
    const url = productUrl(product);
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
        { '@type': 'ListItem', position: 2, name: 'Produtos', item: SITE_ORIGIN + '/produtos' },
        { '@type': 'ListItem', position: 3, name: product.name, item: productUrl(product) }
      ]
    };
  }

  function hydrateProductMeta(product) {
    const url = productUrl(product);
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
    /* Rede de segurança regulatória: descarta qualquer pergunta/resposta com termos vedados. */
    return combined.filter((item) => !REGULATED_RX.test((item.q || '') + ' ' + (item.a || '')));
  }

  function renderProductContent(product) {
    /* Texto principal (descrição completa) */
    const textEl = $('#productContentText');
    if (textEl) {
      const raw = String(product.content || product.excerpt || '');
      let paragraphs = raw.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
      /* Descrição do Shopify costuma vir num bloco único gigante — quebra em
         parágrafos legíveis (grupos de ~3 frases). */
      if (paragraphs.length <= 1 && raw.length > 320) {
        const sentences = raw.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [raw];
        paragraphs = [];
        for (let i = 0; i < sentences.length; i += 3) paragraphs.push(sentences.slice(i, i + 3).join(' ').trim());
        paragraphs = paragraphs.filter(Boolean);
      }
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
    const requested = (window.championProductSlug ? window.championProductSlug() : new URLSearchParams(window.location.search).get('p')) || 'difly';
    const product = findProduct(products.filter((item) => item.status === 'published'), requested);
    if (!product) {
      /* A regra de rewrite aceita /produtos/<qualquer-coisa> e devolve 200, então
         um slug inexistente renderiza o conteúdo de exemplo do HTML — um soft 404.
         Hospedagem estática não permite mudar o status daqui, mas dá para impedir
         que o Google indexe essas páginas. */
      setMeta('meta[name="robots"]', 'content', 'noindex, follow');
      return;
    }

    renderDetailFor(product, products);
  }

  /* Monta a página inteira para um produto. Separado de updateDetail porque o
     seletor de apresentação chama isso de novo, sem recarregar a página. */
  function renderDetailFor(product, products) {
    hydrateProductMeta(product);
    renderProductContent(product);

    /* view_item: alimenta o remarketing dinâmico e o funil do GA4. */
    window.ChampionTracking?.viewItem({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price
    });

    $('#crumbName').textContent = product.name;
    $('#detailName').textContent = product.name;
    $('#detailCat').textContent = product.category;
    /* Topo: só o resumo curto (mantém os botões de compra visíveis).
       A descrição completa fica na seção "Sobre", acessível pelo link. */
    const shortDesc = product.excerpt || product.headline || product.content || '';
    const hasMore = String(product.content || '').replace(/\s+/g, ' ').trim().length > String(shortDesc).trim().length + 20;
    $('#detailDesc').innerHTML = escapeHtml(shortDesc)
      + (hasMore ? ' <a href="#productContentTitle" class="detail-desc-more" id="detailDescMore">Ver descrição completa →</a>' : '');
    const moreLink = $('#detailDescMore');
    if (moreLink) {
      moreLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        document.getElementById('productContentTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    const irmaos = (product.variants && product.variants.length)
      ? []
      : siblingsOf(product, products);
    const selection = makeSelectionState(product, irmaos);

    if (irmaos.length) {
      /* Nada escolhido ainda: mostra o piso da família, como no card. */
      const menor = menorPrecoDe(irmaos);
      setPriceLabel(menor === null ? '' : 'A partir de');
      updateDetailPriceEl(menor);
    } else if (product.variants && product.variants.length) {
      /* Variantes do Shopify, nenhuma escolhida ainda: mostra o piso, igual ao card. */
      const menor = getMinPrice(product);
      setPriceLabel(Number.isFinite(Number(menor)) && Number(menor) > 0 ? 'A partir de' : '');
      updateDetailPriceEl(menor);
    } else {
      setPriceLabel('');
      updateDetailPriceEl(product.price);
    }
    updateDetailImageEl(product, selection.variant);
    renderVariantSelector(product, selection, irmaos);

    const features = $('.detail-features');
    if (features) {
      const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      features.hidden = false;
      features.innerHTML = [
        ...splitBenefits(product.benefits).map((benefit) => `<div>${icon}<div><strong>${escapeHtml(benefit)}</strong></div></div>`),
        `<div>${icon}<div><strong>Modo de uso</strong>${escapeHtml(product.usage || 'Consulte a orientação técnica da Champion.')}</div></div>`,
        `<div>${icon}<div><strong>Atendimento técnico</strong>Confirme embalagem, disponibilidade e recomendação de uso com a Champion.</div></div>`
      ].join('');
    }

    replaceDetailCartButton(product, selection, irmaos);
    atualizarEstadoEscolha(selection);
  }

  /* Otimiza a página de catálogo (produtos.html): canonical, OG e ItemList.
     Roda só quando NÃO é a página de detalhe de produto. */
  function updateCatalogSeo(products) {
    if ($('#detailName')) return; /* página de produto tem seu próprio meta */
    const list = $('.product-list');
    if (!list) return; /* não é o catálogo */

    const url = `${SITE_ORIGIN}/produtos`;
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
        url: productUrl(p),
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
           desativado vira 'draft' e é filtrado da vitrine.
           A leitura da visibilidade NÃO pode bloquear o catálogo — se o Firestore
           demorar/travar, seguimos com todos os produtos visíveis (timeout). */
        let hidden = {};
        try {
          const store = await getAdminStore();
          const vis = await Promise.race([
            store.getCatalogVisibility(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
          ]);
          hidden = (vis && vis.hidden) || {};
        } catch (e) { /* visibilidade indisponível/lenta → todos visíveis */ }
        return prods.map((p) => (hidden[p.id] ? Object.assign({}, p, { status: 'draft' }) : p));
      } catch (err) {
        console.error('Falha ao carregar produtos do Shopify, usando fonte local.', err);
      }
    }
    /* Sem fallback para catálogo local: a Shopify é a única fonte de produto.
       O catálogo do Firestore foi retirado — tinha 17 produtos com preço cravado,
       dos quais 14 nem existiam mais na loja, e mascarava falha da Shopify
       servindo dado velho como se fosse bom.

       Se a Shopify falhar, a vitrine volta vazia e o HTML gerado por
       tools/gerar-produtos.js segura o conteúdo indexável. */
    return [];
  }

  /* Home: atualiza os cards de "Destaques" (.product-grid) com dados REAIS do Shopify —
     preço/variante/adicionar-ao-carrinho corretos, eliminando os dados fictícios do main.js.
     Só atualiza cards existentes (não adiciona); esconde os que não existem no Shopify. */
  function updateFeaturedGrid(products) {
    const grid = $('.product-grid');
    if (!grid) return;
    const published = products.filter((product) => product.status === 'published');
    $$('.product-card[data-product]', grid).forEach((card) => {
      const product = findProduct(published, card.dataset.product);
      if (!product) { card.hidden = true; return; }
      card.hidden = false;
      updateCard(card, product);
    });
  }

  /* Monta a taxonomia dos filtros (espécie/categoria) a partir das Coleções do
     Shopify presentes nos produtos. */
  function buildTaxonomyFromProducts(products) {
    const SP = { bovinos: 'Bovinos', equinos: 'Equinos', suinos: 'Suínos', aves: 'Aves', caprinos: 'Caprinos', ovinos: 'Ovinos', minerais: 'Minerais' };
    const GR = { larvicida: 'Larvicida', inseticida: 'Inseticidas', parasitario: 'Antiparasitário', mineralizacao: 'Mineralização', nutricao: 'Nutrição', suplemento: 'Suplemento', reproducao: 'Reprodução' };
    const sp = new Map(), gr = new Map();
    products.filter((p) => p.status === 'published').forEach((p) => {
      if (p.species && !sp.has(p.species)) sp.set(p.species, { slug: p.species, name: SP[p.species] || p.species, order: sp.size + 1 });
      if (p.group && !gr.has(p.group)) gr.set(p.group, { slug: p.group, name: GR[p.group] || p.group, order: gr.size + 1 });
    });
    return { species: [...sp.values()], groups: [...gr.values()], uses: [] };
  }

  try {
    const products = (await loadProducts()).map(normalizeProduct).map(scrubRegulatedProduct);
    if (!products.length) return;
    updateCatalog(products);
    updateFeaturedGrid(products);
    updateCatalogSeo(products);
    updateDetail(products);
    /* Modo Shopify: reescreve os filtros com as coleções reais e reconstrói o
       motor de filtros (main.js) já com os cards renderizados. */
    if (isShopifyEnabled()) updateFilters(buildTaxonomyFromProducts(products));
  } catch (error) {
    console.error('Não foi possível carregar produtos do painel.', error);
  }
})();
