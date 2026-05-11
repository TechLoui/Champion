import { getAdminStore } from './admin-store.js';

(async function () {
  'use strict';

  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  try {
    const store = await getAdminStore();
    const all = await store.getBanners();
    const published = all.filter((b) => b.status === 'published');
    if (!published.length) return;

    const track = document.getElementById('heroTrack');
    const dotsEl = document.getElementById('heroDots');
    if (!track || !dotsEl) return;

    track.innerHTML = published.map((b, i) => `
      <article class="hero-slide${i === 0 ? ' is-active' : ''}" data-slide="${i}">
        <a href="${esc(b.link)}" aria-label="${esc(b.label)}">
          <img src="${esc(b.image)}" alt="${esc(b.alt)}" />
        </a>
      </article>
    `).join('');

    dotsEl.innerHTML = published.map((_, i) => `
      <button class="hero-dot${i === 0 ? ' is-active' : ''}" data-go="${i}" aria-label="Slide ${i + 1}"></button>
    `).join('');

    window.ChampionCarousel?.reinit();
  } catch (err) {
    console.error('[banners-cms]', err);
  }
})();
