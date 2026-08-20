/* Champion · Banner CMS público
 *
 * Renderiza o(s) banner(s) configurado(s) no painel admin para cada página.
 * Suporta o novo schema com slides[], carrossel automático, texto sobreposto
 * e link opcional. Mantém compat com schema antigo (1 imagem por banner).
 *
 * Para cada página que tiver um <div data-banner-page="<key>"> a gente
 * popula com o banner publicado correspondente.
 */
import { getAdminStore } from './admin-store.js?v=20260819-1';

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
      return `<picture><img src="${esc(desktop || '')}" alt="${a}" ${carga} /></picture>`;
    }

    if (serveEmSrcset(m)) {
      return `<picture>
          <source media="(max-width: 720px)" srcset="${escSrcset(m)}" />
          <img src="${esc(desktop || '')}" alt="${a}" ${carga} />
        </picture>`;
    }

    /* Arte que não serve em srcset (data URL): escolhemos aqui e entregamos
       um <img> só, mantendo a estrutura <picture> > <img> que o CSS do hero
       posiciona. Não reavalia ao girar a tela — aceitável, é exceção. */
    const usarMobile = window.matchMedia('(max-width: 720px)').matches;
    return `<picture><img src="${esc(usarMobile ? m : (desktop || ''))}" alt="${a}" ${carga} /></picture>`;
  }

  function detectPage() {
    /* tenta inferir a página atual pelo path */
    const path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('/') || path.endsWith('index.html')) return 'home';
    if (path.includes('produtos')) return 'produtos';
    if (path.includes('blog')) return 'blog';
    if (path.includes('sobre')) return 'sobre';
    return null;
  }

  function renderHomeHeroCarousel(banner) {
    /* Mantém compatibilidade com o markup existente de home (heroTrack, heroDots) */
    const track = document.getElementById('heroTrack');
    const dotsEl = document.getElementById('heroDots');
    if (!track || !dotsEl) return;

    const slides = (banner.slides && banner.slides.length)
      ? banner.slides
      : [{ image: banner.image, imageMobile: banner.imageMobile, eyebrow: banner.label, link: banner.link, title: '', subtitle: '', cta: '' }];

    track.innerHTML = slides.map((s, i) => {
      const overlay = (s.eyebrow || s.title || s.subtitle || s.cta) ? `
        <div class="hero-slide-overlay">
          ${s.eyebrow ? `<span class="hero-slide-eyebrow">${esc(s.eyebrow)}</span>` : ''}
          ${s.title ? `<h2 class="hero-slide-title">${esc(s.title)}</h2>` : ''}
          ${s.subtitle ? `<p class="hero-slide-subtitle">${esc(s.subtitle)}</p>` : ''}
          ${s.cta && s.link ? `<a class="hero-slide-cta" href="${esc(s.link)}">${esc(s.cta)}</a>` : ''}
        </div>` : '';
      /* Sem esc() aqui: montarArte escapa por dentro. */
      const altText = s.title || s.eyebrow || '';
      const img = montarArte(s.image, s.imageMobile, altText, i === 0);
      const inner = s.link
        ? `<a href="${esc(s.link)}" aria-label="${esc(s.title || s.eyebrow || 'Banner')}">${img}${overlay}</a>`
        : `<div class="hero-slide-static">${img}${overlay}</div>`;
      return `<article class="hero-slide${i === 0 ? ' is-active' : ''}" data-slide="${i}">${inner}</article>`;
    }).join('');

    dotsEl.innerHTML = slides.map((_, i) => `
      <button class="hero-dot${i === 0 ? ' is-active' : ''}" data-go="${i}" aria-label="Slide ${i + 1}"></button>
    `).join('');

    /* Configura intervalo do carrossel se o helper expor essa API */
    if (window.ChampionCarousel) {
      if (banner.transitionMs && typeof window.ChampionCarousel.setInterval === 'function') {
        window.ChampionCarousel.setInterval(banner.transitionMs);
      }
      if (typeof window.ChampionCarousel.reinit === 'function') {
        window.ChampionCarousel.reinit();
      }
    }
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
