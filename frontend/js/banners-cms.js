/* Champion · Banner CMS público
 *
 * Renderiza o(s) banner(s) configurado(s) no painel admin para cada página.
 * Suporta o novo schema com slides[], carrossel automático, texto sobreposto
 * e link opcional. Mantém compat com schema antigo (1 imagem por banner).
 *
 * Para cada página que tiver um <div data-banner-page="<key>"> a gente
 * popula com o banner publicado correspondente.
 */
import { getAdminStore } from './admin-store.js?v=20261029-4-banners';
import { assetUrl } from './asset-url.js?v=20260902-3';

(async function () {
  'use strict';

  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* Valor seguro para uso em srcset: espaços em branco separam a URL do
     descritor, então precisam virar %20 (senão o navegador descarta o
     candidato e cai na imagem desktop). Não afeta data URLs. */
  function escSrcset(v) {
    return esc(String(v || '').replace(/\s+/g, '%20'));
  }

  /* Em srcset a VÍRGULA separa candidatos — e toda data URL tem uma
     ("data:image/png;base64,..."). Codificá-la quebraria a própria data URL,
     então não existe forma de usar esse valor num <source srcset>.

     Isso importa porque o <picture> não é tolerante: se a media query casa
     mas o srcset é inutilizável, o navegador NÃO volta para o <img> — fica
     sem imagem nenhuma. Era o motivo de o banner sumir no celular e aparecer
     no desktop, que usa <img src> e engole data URL sem reclamar. */
  function serveEmSrcset(v) {
    const s = String(v || '');
    return Boolean(s) && s.indexOf(',') === -1;
  }

  /* Monta a arte de um slide, escolhendo o melhor mecanismo disponível.

     Caminho normal: <picture> + <source>, que faz o navegador baixar só a
     imagem certa. Quando a arte mobile não serve em srcset (data URL), cai
     para duas <img> alternadas por CSS — assim a arte mobile continua sendo
     usada, em vez de o celular receber a versão de desktop. Custa o download
     das duas, mas só nesse caso. */
  /* `primeiro` marca o slide visível na abertura. As artes do banner pesam
     ~2 MB cada; sem essa distinção o navegador baixa os quatro slides ao
     mesmo tempo e eles disputam banda. No wifi ninguém nota, mas no 4G o
     visitante fica olhando o fundo escuro até o primeiro chegar.

     Com prioridade alta no primeiro e lazy nos demais, a arte de abertura
     ganha a banda inteira e aparece antes; o resto carrega enquanto ele lê. */
  function montarArte(desktop, mobile, alt, primeiro) {
    const a = esc(alt || '');
    const m = mobile || desktop || '';
    const carga = primeiro
      ? 'fetchpriority="high" decoding="async"'
      : 'loading="lazy" decoding="async"';

    if (!m || m === desktop) {
      return `<picture><img src="${esc(assetUrl(desktop || ''))}" alt="${a}" ${carga} /></picture>`;
    }

    if (serveEmSrcset(m)) {
      return `<picture>
          <source media="(max-width: 720px)" srcset="${escSrcset(assetUrl(m))}" />
          <img src="${esc(assetUrl(desktop || ''))}" alt="${a}" ${carga} />
        </picture>`;
    }

    /* Arte que não serve em srcset (data URL): escolhemos aqui e entregamos
       um <img> só, mantendo a estrutura <picture> > <img> que o CSS do hero
       posiciona. Não reavalia ao girar a tela — aceitável, é exceção. */
    const usarMobile = window.matchMedia('(max-width: 720px)').matches;
    return `<picture><img src="${esc(assetUrl(usarMobile ? m : (desktop || '')))}" alt="${a}" ${carga} /></picture>`;
  }

  function detectPage() {
    /* Rotas limpas: "/", "/produtos", "/blog", "/sobre". O casamento é exato de
       propósito: "/produtos/<slug>" é página de produto, não o catálogo — com
       includes() ela recebia o banner do catálogo. */
    const path = ((window.location.pathname || '').toLowerCase().replace(/\/+$/, '')) || '/';
    if (path === '/' || path === '/index' || path === '/index.html') return 'home';
    if (path === '/produtos' || path === '/produtos.html') return 'produtos';
    if (path === '/blog' || path === '/blog.html') return 'blog';
    if (path === '/sobre' || path === '/sobre.html') return 'sobre';
    return null;
  }

  function renderHomeHeroCarousel(banner) {
    /* Mantém compatibilidade com o markup existente de home (heroTrack, heroDots) */
    const track = document.getElementById('heroTrack');
    const dotsEl = document.getElementById('heroDots');
    if (!track || !dotsEl) return;

    /* A abertura da home mantém apenas os dois produtos da linha Difly. */
    const diflyImage = '/assets/img/hero/difly-fullscreen-20261030.png';
    /* Cena S3 adaptada de foto de Johan Backman no Pexels: https://www.pexels.com/photo/cows-in-a-field-17276424/ */
    const s3Image = '/assets/img/hero/difly-s3-cow-trough-20261103.jpg';

    track.innerHTML = `
        <article class="hero-slide df-campaign-slide df-campaign-slide--difly is-active" data-slide="0" data-product="difly">
          <a href="/produtos/difly.html" aria-label="Conhecer Difly">
            <span class="df-campaign-scene"><picture class="df-campaign-bg-wrap"><img class="df-campaign-bg" src="${diflyImage}" alt="" fetchpriority="high" decoding="async" /></picture><span class="df-hero-packs df-hero-packs--difly" aria-hidden="true"><img class="df-hero-pack df-hero-pack--difly-pot" src="/assets/img/home/variants/difly-pot-300g.png" alt="" decoding="async" /><img class="df-hero-pack df-hero-pack--difly-box" src="/assets/img/home/variants/difly-box-10x20.png" alt="" decoding="async" /><img class="df-hero-pack df-hero-pack--difly-main" src="/assets/img/home/difly-6kg-floating.png" alt="" decoding="async" /></span></span>
            <span class="df-campaign-copy">
            <small>DIFLY · CONTROLE DA MOSCA</small>
            <strong>Difly.<em>Controle da mosca.</em></strong>
            <span class="df-campaign-benefits"><span><img src="/assets/img/home/icons/difly-sem-mosca-ai.png" alt="" />Sem mosca</span><span><img src="/assets/img/home/icons/difly-sem-manejo-ai.png" alt="" />Sem manejo</span><span><img src="/assets/img/home/icons/difly-sem-residuos-ai.png" alt="" />Sem resíduos</span></span>
            <b class="df-campaign-price">R$ 0,72 <em>por cabeça / mês*</em></b>
            <span class="df-campaign-offer-yield">6 kg tratam <b>833 animais</b> por <b>120 dias*</b></span>
            <span class="df-campaign-formats">6 kg · 300 g · caixa 10×20 g</span>
            <i class="df-campaign-link">Conhecer Difly <span aria-hidden="true">↗</span></i>
            <small class="df-campaign-note">*Valores de referência da campanha. Use conforme o rótulo e a orientação técnica.</small>
          </span>
        </a>
      </article>
        <article class="hero-slide df-campaign-slide df-campaign-slide--s3" data-slide="1" data-product="difly-s3">
          <a href="/produtos/difly-s3.html" aria-label="Conhecer Difly S3">
            <span class="df-campaign-scene"><picture class="df-campaign-bg-wrap"><source media="(max-width: 720px)" srcset="/assets/img/hero/mobile/difly-s3-cow-trough-mobile-20261103.jpg"><img class="df-campaign-bg" src="${s3Image}" alt="" loading="lazy" decoding="async" /></picture><span class="df-hero-packs df-hero-packs--s3" aria-hidden="true"><img class="df-hero-pack df-hero-pack--s3-1kg" src="/assets/img/home/variants/difly-s3-1kg.png" alt="" loading="lazy" decoding="async" /><img class="df-hero-pack df-hero-pack--s3-300g" src="/assets/img/home/variants/difly-s3-300g.png" alt="" loading="lazy" decoding="async" /><img class="df-hero-pack df-hero-pack--s3-main" src="/assets/img/home/difly-s3-6kg-floating.png" alt="" loading="lazy" decoding="async" /></span></span>
            <span class="df-campaign-copy"><small>LINHA DIFLY · S3</small><strong>Difly S3.<em>Mosca e carrapato.</em></strong><span class="df-campaign-benefits df-campaign-benefits--s3"><span><img src="/assets/img/home/icons/s3-sem-mosca-ai.png" alt="" />Sem mosca</span><span><img src="/assets/img/home/icons/s3-sem-carrapato-ai.png" alt="" />Sem carrapato</span><span><img src="/assets/img/home/icons/s3-sem-manejo-ai.png" alt="" />Sem manejo</span></span><span class="df-campaign-formats">6 kg · 1 kg · 300 g (cx. 24)</span><i class="df-campaign-link">Conhecer Difly S3 <span aria-hidden="true">↗</span></i></span>
          </a>
        </article>
        `;

    dotsEl.innerHTML = ['Difly', 'Difly S3'].map((name, i) => `
      <button class="hero-dot${i === 0 ? ' is-active' : ''}" data-go="${i}" aria-label="Banner ${name}"></button>
    `).join('');

    /* A hero da home alterna Difly e S3 a cada 4 segundos. */
    if (window.ChampionCarousel) {
      if (typeof window.ChampionCarousel.setInterval === 'function') {
        window.ChampionCarousel.setInterval(4000);
      }
      if (typeof window.ChampionCarousel.reinit === 'function') {
        window.ChampionCarousel.reinit();
      }
    }
    window.ChampionI18n?.apply(document.documentElement.dataset.lang || 'pt');
  }

  function renderGenericBanner(banner, target) {
    const slides = (banner.slides && banner.slides.length)
      ? banner.slides
      : [{ image: banner.image, imageMobile: banner.imageMobile, eyebrow: banner.label, link: banner.link, title: '', subtitle: '', cta: '' }];

    target.classList.add('cms-banner');
    target.style.setProperty('--banner-aspect', banner.aspect || '16/9');

    target.innerHTML = `
      <div class="cms-banner-carousel" data-transition="${banner.transitionMs || 6000}">
        ${slides.map((s, i) => {
          const overlay = (s.eyebrow || s.title || s.subtitle || s.cta) ? `
            <div class="cms-banner-overlay">
              ${s.eyebrow ? `<span class="cms-banner-eyebrow">${esc(s.eyebrow)}</span>` : ''}
              ${s.title ? `<h2 class="cms-banner-title">${esc(s.title)}</h2>` : ''}
              ${s.subtitle ? `<p class="cms-banner-subtitle">${esc(s.subtitle)}</p>` : ''}
              ${s.cta && s.link ? `<a class="cms-banner-cta" href="${esc(s.link)}">${esc(s.cta)} →</a>` : ''}
            </div>` : '';
          const img = montarArte(s.image, s.imageMobile, s.title || s.eyebrow || '', i === 0);
          const inner = s.link && !s.cta
            ? `<a href="${esc(s.link)}" class="cms-banner-link" aria-label="${esc(s.title || 'Banner')}">${img}${overlay}</a>`
            : `<div class="cms-banner-static">${img}${overlay}</div>`;
          return `<div class="cms-banner-slide${i === 0 ? ' is-active' : ''}" data-slide="${i}">${inner}</div>`;
        }).join('')}
      </div>
      ${slides.length > 1 ? `
        <div class="cms-banner-dots">
          ${slides.map((_, i) => `<button class="cms-banner-dot${i === 0 ? ' is-active' : ''}" data-go="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
        </div>` : ''}
    `;

    if (slides.length > 1) {
      const slideEls = target.querySelectorAll('.cms-banner-slide');
      const dotEls = target.querySelectorAll('.cms-banner-dot');
      let current = 0;
      const interval = Math.max(2000, Number(banner.transitionMs) || 6000);
      function show(idx) {
        current = (idx + slides.length) % slides.length;
        slideEls.forEach((s, i) => s.classList.toggle('is-active', i === current));
        dotEls.forEach((d, i) => d.classList.toggle('is-active', i === current));
      }
      dotEls.forEach((d) => d.addEventListener('click', () => show(parseInt(d.getAttribute('data-go'), 10) || 0)));
      setInterval(() => show(current + 1), interval);
    }
  }

  try {
    const store = await getAdminStore();
    /* `includeDrafts: false` é obrigatório aqui: sem o filtro na query o
       Firestore nega a leitura para quem não é admin (ver getBanners). */
    const all = await store.getBanners({ includeDrafts: false });
    const published = all.filter((b) => b.status === 'published');
    if (!published.length) return;

    const currentPage = detectPage();
    const forPage = published.filter((b) => (b.page || 'home') === currentPage).sort((a, b) => a.order - b.order);

    /* 1) Carrossel da home (compat com markup existente) */
    if (currentPage === 'home' && forPage.length && document.getElementById('heroTrack')) {
      renderHomeHeroCarousel(forPage[0]);
    }

    /* 2) Banners genéricos em outras páginas, marcados com data-banner-page="<key>" */
    document.querySelectorAll('[data-banner-page]').forEach((target) => {
      const wanted = target.getAttribute('data-banner-page');
      const banner = published.find((b) => (b.page || 'home') === wanted);
      if (banner) renderGenericBanner(banner, target);
    });
  } catch (err) {
    console.error('[banners-cms]', err);
  }
})();
