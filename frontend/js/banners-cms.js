/* Champion · Banner CMS público
 *
 * Renderiza o(s) banner(s) configurado(s) no painel admin para cada página.
 * Suporta o novo schema com slides[], carrossel automático, texto sobreposto
 * e link opcional. Mantém compat com schema antigo (1 imagem por banner).
 *
 * Para cada página que tiver um <div data-banner-page="<key>"> a gente
 * popula com o banner publicado correspondente.
 */
import { getAdminStore } from './admin-store.js';

(async function () {
  'use strict';

  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function detectPage() {
    /* tenta inferir a página atual pelo path */
    const path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('/') || path.endsWith('index.html')) return 'home';
    if (path.includes('produtos')) return 'produtos';
    if (path.includes('blog')) return 'blog';
    if (path.includes('sobre')) return 'sobre';
    if (path.includes('calculo-dose')) return 'calculo-dose';
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
      const altText = esc(s.title || s.eyebrow || '');
      const desktopSrc = esc(s.image || '');
      const mobileSrc = esc(s.imageMobile || s.image || '');
      const img = `
        <picture>
          <source media="(max-width: 720px)" srcset="${mobileSrc}" />
          <img src="${desktopSrc}" alt="${altText}" />
        </picture>`;
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
      : [{ image: banner.image, eyebrow: banner.label, link: banner.link, title: '', subtitle: '', cta: '' }];

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
          const img = `<img src="${esc(s.image)}" alt="${esc(s.title || s.eyebrow || '')}" />`;
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
    const all = await store.getBanners();
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
