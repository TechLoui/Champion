/* ================================================================
   CHAMPION — Site interactions
   ================================================================ */

(function () {
  'use strict';

  // ------------------------------------------------------------
  // Intro GIF
  // ------------------------------------------------------------
  const intro = document.getElementById('siteIntro');
  if (intro) {
    const INTRO_FADE_START = 4500;
    const INTRO_REMOVE_AT = 5500;
    const INTRO_SESSION_KEY = 'champion-intro-played';
    const shouldPlayIntro = sessionStorage.getItem(INTRO_SESSION_KEY) !== '1';

    const closeIntro = () => {
      document.body.classList.remove('site-intro-active');
      intro.classList.add('is-hiding');
    };

    if (shouldPlayIntro) {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
      window.setTimeout(closeIntro, INTRO_FADE_START);
      window.setTimeout(() => intro.remove(), INTRO_REMOVE_AT);
    } else {
      document.body.classList.remove('site-intro-active');
      intro.remove();
    }
  }

  // ------------------------------------------------------------
  // Header scroll effect
  // ------------------------------------------------------------
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ------------------------------------------------------------
  // Mobile menu
  // ------------------------------------------------------------
  // Mobile menu — FAB + bottom-sheet panel (replaces header on <=720px)
  (function setupMobileMenu() {
    const nav = document.getElementById('primaryNav');
    if (!nav || document.querySelector('.mobile-menu-fab')) return;

    // Collect links from the desktop nav so the mobile panel mirrors them
    const navLinks = Array.from(nav.querySelectorAll('a')).map(a => ({
      href: a.getAttribute('href') || '#',
      text: a.textContent.trim(),
      active: a.classList.contains('active'),
      target: a.getAttribute('target') || '',
      rel: a.getAttribute('rel') || ''
    }));

    // Icon mapping per link
    const iconFor = (text) => {
      const t = text.toLowerCase();
      if (t.includes('inicial') || t.includes('home') || t.includes('início')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
      }
      if (t.includes('produto')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>';
      }
      if (t.includes('sobre')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      }
      if (t.includes('blog')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
      }
      if (t.includes('revenda')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      }
      if (t.includes('cálculo') || t.includes('dose') || t.includes('calculo')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="8" y1="18" x2="14" y2="18"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>';
    };
    const arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    // Brand logo
    const brandImg = document.querySelector('.site-header .brand img');
    const brandSrc = brandImg ? brandImg.getAttribute('src') : 'assets/img/brand/logo.png';

    // Build FAB
    const fab = document.createElement('button');
    fab.className = 'mobile-menu-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Abrir menu');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'mobilePanel');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';

    // Build panel
    const panel = document.createElement('div');
    panel.className = 'mobile-panel';
    panel.id = 'mobilePanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Menu de navegação');

    const linksHtml = navLinks.map(l => {
      const isExternal = l.target === '_blank';
      const externalAttrs = isExternal ? ` target="_blank" rel="${l.rel || 'noopener'}"` : '';
      return `<a href="${l.href}"${externalAttrs}${l.active ? ' class="active"' : ''}>
        <span class="ico">${iconFor(l.text)}</span>
        <span class="label">${l.text}</span>
        <span class="arrow">${arrowSvg}</span>
      </a>`;
    }).join('');

    panel.innerHTML = `
      <div class="mobile-panel-backdrop" aria-hidden="true"></div>
      <div class="mobile-panel-sheet" role="document">
        <div class="mobile-panel-grip" aria-hidden="true"></div>
        <div class="mobile-panel-brand">
          <img src="${brandSrc}" alt="Champion" />
          <button class="mobile-panel-close" type="button" aria-label="Fechar menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
          </button>
        </div>
        <div class="mobile-panel-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="mobilePanelSearch" placeholder="Buscar produtos…" autocomplete="off" />
        </div>
        <nav class="mobile-panel-nav" aria-label="Menu principal">
          ${linksHtml}
        </nav>
        <div class="mobile-panel-foot">
          <button type="button" id="mobilePanelAccount">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Minha conta
          </button>
          <a href="https://wa.me/5564993021616" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const backdrop = panel.querySelector('.mobile-panel-backdrop');
    const closeBtn = panel.querySelector('.mobile-panel-close');
    const accountBtn = panel.querySelector('#mobilePanelAccount');
    const searchInput = panel.querySelector('#mobilePanelSearch');

    const setOpen = (open) => {
      panel.classList.toggle('is-open', open);
      document.body.classList.toggle('mobile-panel-open', open);
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      fab.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!panel.classList.contains('is-open'));
    });
    backdrop.addEventListener('click', () => setOpen(false));
    closeBtn.addEventListener('click', () => setOpen(false));
    panel.querySelectorAll('.mobile-panel-nav a').forEach(a => {
      a.addEventListener('click', () => setOpen(false));
    });
    if (accountBtn) {
      accountBtn.addEventListener('click', () => {
        setOpen(false);
        const trigger = document.querySelector('.account-trigger') || document.querySelector('[data-account-trigger]');
        if (trigger) setTimeout(() => trigger.click(), 200);
        else window.location.href = 'cliente-conta.html';
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim();
          if (q) window.location.href = 'produtos.html?q=' + encodeURIComponent(q);
        }
      });
    }

    window.addEventListener('resize', () => {
      if (window.matchMedia('(min-width: 721px)').matches && panel.classList.contains('is-open')) {
        setOpen(false);
      }
    });
  })();

  // ------------------------------------------------------------
  // Header language switch
  // ------------------------------------------------------------
  const LANGUAGE_KEY = 'champion-language';
  let accountTriggers = [];
  const languageCopy = {
    pt: {
      htmlLang: 'pt-BR',
      label: 'Português',
      changed: 'Idioma alterado para Português.',
      home: 'Página Inicial',
      shop: 'Produtos',
      about: 'Sobre a Champion',
      blog: 'Blog',
      store: 'Revenda',
      dose: 'Cálculo de dose',
      promo: 'FRETE GRÁTIS para pedidos acima de R$ 500',
      search: 'Buscar',
      account: 'Conta',
      accountOf: 'Conta de',
      accountTitle: 'Minha conta',
      cart: 'Carrinho',
      menu: 'Menu'
    },
    en: {
      htmlLang: 'en',
      label: 'English',
      changed: 'Language changed to English.',
      home: 'Home',
      shop: 'Products',
      about: 'About Champion',
      blog: 'Blog',
      store: 'Resellers',
      dose: 'Dose Calculator',
      promo: 'FREE SHIPPING on orders over R$ 500',
      search: 'Search',
      account: 'Account',
      accountOf: 'Account for',
      accountTitle: 'My account',
      cart: 'Cart',
      menu: 'Menu'
    },
    es: {
      htmlLang: 'es',
      label: 'Español',
      changed: 'Idioma cambiado a Español.',
      home: 'Inicio',
      shop: 'Productos',
      about: 'Sobre Champion',
      blog: 'Blog',
      store: 'Distribuidores',
      dose: 'Cálculo de dosis',
      promo: 'ENVÍO GRATIS en pedidos superiores a R$ 500',
      search: 'Buscar',
      account: 'Cuenta',
      accountOf: 'Cuenta de',
      accountTitle: 'Mi cuenta',
      cart: 'Carrito',
      menu: 'Menú'
    }
  };

  const safeStorage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  };

  const getCurrentLanguage = () => {
    const saved = safeStorage.get(LANGUAGE_KEY);
    return languageCopy[saved] ? saved : 'pt';
  };

  function createLanguageSwitch() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || headerActions.querySelector('.lang-switch')) return;

    const switcher = document.createElement('label');
    switcher.className = 'lang-switch';
    switcher.setAttribute('aria-label', 'Selecionar idioma');
    switcher.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>
      <select id="languageSelect">
        <option value="pt">PT</option>
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    `;

    const accountButton = headerActions.querySelector('button[aria-label="Conta"]');
    accountButton?.classList.add('account-trigger');
    headerActions.insertBefore(switcher, accountButton || headerActions.querySelector('.cart-btn') || headerActions.firstChild);

    switcher.querySelector('select')?.addEventListener('change', (event) => {
      setLanguage(event.target.value, true);
    });
  }

  function setTextByHref(hrefPart, text) {
    document.querySelectorAll(`#primaryNav a[href*="${hrefPart}"]`).forEach(link => {
      link.textContent = text;
    });
  }

  function applyHeaderLanguage(lang) {
    const copy = languageCopy[lang] || languageCopy.pt;
    document.documentElement.lang = copy.htmlLang;

    const select = document.getElementById('languageSelect');
    if (select) {
      select.value = lang;
      select.setAttribute('aria-label', copy.label);
      select.closest('.lang-switch')?.setAttribute('title', copy.label);
    }

    setTextByHref('index.html', copy.home);
    setTextByHref('produtos.html', copy.shop);
    setTextByHref('sobre.html', copy.about);
    setTextByHref('blog.html', copy.blog);
    setTextByHref('pertinhodemim.com', copy.store);
    setTextByHref('calculo-dose.html', copy.dose);

    const promo = document.querySelector('.topbar .pill');
    if (promo) promo.textContent = copy.promo;

    document.querySelectorAll('button[aria-label="Buscar"], button[aria-label="Search"], button[aria-label="Buscar"]').forEach(button => {
      button.setAttribute('aria-label', copy.search);
      button.setAttribute('title', copy.search);
    });
    document.querySelectorAll('.cart-btn, .cart-float').forEach(button => {
      button.setAttribute('aria-label', copy.cart);
      button.setAttribute('title', copy.cart);
    });
    document.querySelectorAll('.menu-toggle').forEach(button => {
      button.setAttribute('aria-label', copy.menu);
      button.setAttribute('title', copy.menu);
    });

    if (accountTriggers.length) updateAccountTriggers();
  }

  function setLanguage(lang, announce = false) {
    const nextLang = languageCopy[lang] ? lang : 'pt';
    safeStorage.set(LANGUAGE_KEY, nextLang);
    document.documentElement.dataset.lang = nextLang;
    applyHeaderLanguage(nextLang);
    document.documentElement.classList.add('lang-ready');
    if (announce && typeof showToast === 'function') showToast(languageCopy[nextLang].changed);
  }

  createLanguageSwitch();
  setLanguage(getCurrentLanguage());

  // ------------------------------------------------------------
  // Hero carousel (auto-play)
  // ------------------------------------------------------------
  let _carouselTimer;
  function initHeroCarousel() {
    if (_carouselTimer) clearInterval(_carouselTimer);
    const track = document.getElementById('heroTrack');
    if (!track) return;
    const slides = Array.from(track.querySelectorAll('.hero-slide'));
    const dots = Array.from(document.querySelectorAll('#heroDots .hero-dot'));
    const prev = document.getElementById('heroPrev');
    const next = document.getElementById('heroNext');
    let i = 0;
    const AUTOPLAY = 6000;

    const go = (n) => {
      i = (n + slides.length) % slides.length;
      track.style.transform = `translateX(-${i * 100}%)`;
      slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
      dots.forEach((d, idx) => d.classList.toggle('is-active', idx === i));
    };

    const stop = () => { if (_carouselTimer) clearInterval(_carouselTimer); };
    const start = () => { stop(); _carouselTimer = setInterval(() => go(i + 1), AUTOPLAY); };

    prev?.addEventListener('click', () => { go(i - 1); start(); });
    next?.addEventListener('click', () => { go(i + 1); start(); });
    dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.go); start(); }));

    track.parentElement.addEventListener('mouseenter', stop);
    track.parentElement.addEventListener('mouseleave', start);

    let startX = 0, dx = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; stop(); }, { passive: true });
    track.addEventListener('touchmove', e => { dx = e.touches[0].clientX - startX; }, { passive: true });
    track.addEventListener('touchend', () => {
      if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      dx = 0;
      start();
    });

    start();
  }
  window.ChampionCarousel = { reinit: initHeroCarousel };
  initHeroCarousel();

  // Mobile: indicador de scroll na base do hero
  (function setupHeroScrollIndicator() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.hero-scroll-indicator')) return;
    const indicator = document.createElement('div');
    indicator.className = 'hero-scroll-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = `
      <span class="hero-scroll-indicator-mouse"></span>
      <span class="hero-scroll-indicator-label">Role</span>
      <span class="hero-scroll-indicator-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>
    `;
    hero.appendChild(indicator);
    const onScroll = () => {
      if (window.scrollY > 40) {
        hero.classList.add('is-scrolled');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Clicar no indicador faz scroll suave para a próxima seção
    indicator.style.pointerEvents = 'auto';
    indicator.style.cursor = 'pointer';
    indicator.addEventListener('click', () => {
      const next = hero.nextElementSibling;
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  })();

  // ------------------------------------------------------------
  // Story play button (focus video / open YouTube)
  // ------------------------------------------------------------
  const storyPlay = document.getElementById('storyPlay');
  if (storyPlay) {
    storyPlay.addEventListener('click', () => window.open('https://youtu.be/SsF-aEboU44', '_blank'));
  }

  // ------------------------------------------------------------
  // Reveal on scroll
  // ------------------------------------------------------------
  const motionReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const autoRevealSelectors = [
    '.section-head > *',
    '.stat-item',
    '.cat-card',
    '.product-card',
    '.about-image',
    '.about-text',
    '.feature-image',
    '.video-placeholder',
    '.cta-grid > *',
    '.footer-grid > *',
    '.mvv-card',
    '.mvv-head-text',
    '.mvv-head-image',
    '.culture-card',
    '.manifesto-grid > *',
    '.map-info',
    '.map-frame',
    '.shop-search',
    '.shop-side',
    '.shop-toolbar',
    '.product-list > *',
    '.detail-art',
    '.detail-info',
    '.detail-features > *',
    '.calc-card',
    '.calc-result',
    '.guide-card',
    '.benefit-card',
    '.benefits-hero-text',
    '.benefits-strip',
    '.testi-card',
    '.story-stat',
    '.blog-featured',
    '.blog-card',
    '.blog-sidebar',
    '.blog-admin-card',
    '.blog-admin-panel',
    '.page-hero-inner > *',
    '.about-callout',
    '.about-awards',
    '.about-checklist',
    '.about-cta-row',
    '.spot-stat'
  ];

  const revealCandidates = Array.from(document.querySelectorAll(autoRevealSelectors.join(',')));
  revealCandidates.forEach((el, index) => {
    if (el.closest('.site-intro, .cart-drawer, .cart-overlay, .toast')) return;
    el.classList.add('reveal');

    if (!el.classList.contains('reveal-delay-1') &&
        !el.classList.contains('reveal-delay-2') &&
        !el.classList.contains('reveal-delay-3') &&
        !el.classList.contains('reveal-delay-4') &&
        !el.style.getPropertyValue('--reveal-delay')) {
      el.style.setProperty('--reveal-delay', `${Math.min((index % 6) * 55, 275)}ms`);
    }

    if (el.matches('.about-image, .feature-image, .shop-side, .detail-art, .map-info')) {
      el.classList.add('reveal-left');
    } else if (el.matches('.about-text, .detail-info, .calc-result, .map-frame')) {
      el.classList.add('reveal-right');
    } else if (el.matches('.product-card, .cat-card, .mvv-card, .culture-card, .guide-card, .stat-item')) {
      el.classList.add('reveal-scale');
    }
  });

  const reveals = document.querySelectorAll('.reveal, .stagger');
  if (motionReduced) {
    reveals.forEach(el => el.classList.add('is-visible'));
  } else if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  // ------------------------------------------------------------
  // Subtle parallax for elements marked .parallax-y
  // ------------------------------------------------------------
  if (!motionReduced) {
    const parallaxEls = document.querySelectorAll('.parallax-y');
    if (parallaxEls.length) {
      let raf = 0;
      const updateParallax = () => {
        parallaxEls.forEach(el => {
          const rect = el.getBoundingClientRect();
          const center = rect.top + rect.height / 2 - window.innerHeight / 2;
          const speed = parseFloat(el.dataset.speed || '0.08');
          el.style.transform = `translate3d(0, ${(-center * speed).toFixed(2)}px, 0)`;
        });
        raf = 0;
      };
      const onScroll = () => { if (!raf) raf = requestAnimationFrame(updateParallax); };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      updateParallax();
    }
  }

  // ------------------------------------------------------------
  // Scroll progress bar (top of page)
  // ------------------------------------------------------------
  if (!document.querySelector('.scroll-progress')) {
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span class="scroll-progress-fill"></span>';
    document.body.appendChild(progress);
    const fill = progress.firstElementChild;
    let progRaf = 0;
    const updateProg = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      fill.style.transform = `scaleX(${(pct / 100).toFixed(4)})`;
      progRaf = 0;
    };
    window.addEventListener('scroll', () => { if (!progRaf) progRaf = requestAnimationFrame(updateProg); }, { passive: true });
    window.addEventListener('resize', updateProg);
    updateProg();
  }

  // ------------------------------------------------------------
  // Scroll-to-top floating button
  // ------------------------------------------------------------
  if (!document.querySelector('.scroll-top-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scroll-top-btn';
    btn.setAttribute('aria-label', 'Voltar ao topo');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: motionReduced ? 'auto' : 'smooth' });
    });
    const onScrollBtn = () => btn.classList.toggle('is-visible', window.scrollY > 480);
    window.addEventListener('scroll', onScrollBtn, { passive: true });
    onScrollBtn();
  }

  // ------------------------------------------------------------
  // Animated number counters (data-counter elements or .stat-item h4 / .story-stat h3)
  // ------------------------------------------------------------
  const counters = document.querySelectorAll('[data-counter], .stat-item h4, .story-stat h3 span:first-child');
  if (counters.length && !motionReduced && 'IntersectionObserver' in window) {
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const animateCount = (el) => {
      const text = el.textContent.trim();
      // Match: optional + or - , number with optional decimal/comma, optional suffix like × or %
      const match = text.match(/^([+\-]?)(\d+(?:[.,]\d+)?)([^\d]*)$/);
      if (!match) return;
      const sign = match[1];
      const numStr = match[2].replace(',', '.');
      const target = parseFloat(numStr);
      if (Number.isNaN(target)) return;
      const suffix = match[3] || '';
      const decimals = (numStr.includes('.') ? numStr.split('.')[1].length : 0);
      const duration = 1400;
      const startTime = performance.now();
      const formatNum = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      const tick = (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        const v = target * easeOut(t);
        el.textContent = sign + formatNum(v) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = sign + formatNum(target) + suffix;
      };
      requestAnimationFrame(tick);
    };
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          animateCount(en.target);
          counterObserver.unobserve(en.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => counterObserver.observe(el));
  }

  // ------------------------------------------------------------
  // Image fade-in once loaded
  // ------------------------------------------------------------
  document.querySelectorAll('img').forEach((img) => {
    if (img.closest('.site-intro, .topbar, .site-header')) return;
    if (img.classList.contains('img-faded')) return;
    img.classList.add('img-fade');
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-faded');
    } else {
      img.addEventListener('load', () => img.classList.add('img-faded'), { once: true });
      img.addEventListener('error', () => img.classList.add('img-faded'), { once: true });
    }
  });

  // ------------------------------------------------------------
  // Category cards: background photo on hover/focus/tap (smooth crossfade)
  // ------------------------------------------------------------
  const categoryShowcase = document.querySelector('.category-showcase');
  if (categoryShowcase) {
    const categoryCards = Array.from(categoryShowcase.querySelectorAll('.cat-card[data-category-bg]'));
    let pinnedCategoryCard = null;
    let activeLayerIdx = 0;
    let currentBgUrl = null;
    const isCoarsePointer = () => window.matchMedia?.('(hover: none)')?.matches;

    // Inject two stacked layers for the crossfade effect
    const stack = document.createElement('div');
    stack.className = 'cat-bg-stack';
    stack.setAttribute('aria-hidden', 'true');
    stack.innerHTML = '<div class="cat-bg-layer"></div><div class="cat-bg-layer"></div>';
    categoryShowcase.prepend(stack);
    const layers = stack.querySelectorAll('.cat-bg-layer');

    function setCategoryBackground(card) {
      if (!card) return;
      const bg = card.dataset.categoryBg;
      if (!bg) return;
      const bgUrl = new URL(bg, window.location.href).href;

      // Same image already on top: just keep state in sync, skip swap
      if (bgUrl !== currentBgUrl) {
        const nextIdx = (activeLayerIdx + 1) % 2;
        layers[nextIdx].style.backgroundImage = `url("${bgUrl}")`;
        // Force reflow so the transition fires reliably when swapping
        // eslint-disable-next-line no-unused-expressions
        layers[nextIdx].offsetWidth;
        layers[nextIdx].classList.add('is-active');
        layers[activeLayerIdx].classList.remove('is-active');
        activeLayerIdx = nextIdx;
        currentBgUrl = bgUrl;
      }

      categoryShowcase.dataset.activeCategory = card.dataset.categoryLabel || '';
      categoryShowcase.classList.add('is-bg-visible');
      categoryCards.forEach(item => item.classList.toggle('is-active', item === card));
    }

    function clearCategoryBackground() {
      if (pinnedCategoryCard) {
        setCategoryBackground(pinnedCategoryCard);
        return;
      }
      categoryShowcase.classList.remove('is-bg-visible');
      // Fade out both layers — overlay fades via .is-bg-visible
      layers.forEach(layer => layer.classList.remove('is-active'));
      currentBgUrl = null;
      delete categoryShowcase.dataset.activeCategory;
      categoryCards.forEach(item => item.classList.remove('is-active'));
    }

    categoryCards.forEach(card => {
      if (card.dataset.categoryBg) {
        const image = new Image();
        image.src = card.dataset.categoryBg;
      }

      card.addEventListener('pointerenter', () => setCategoryBackground(card));
      card.addEventListener('focus', () => setCategoryBackground(card));
      card.addEventListener('click', (event) => {
        if (isCoarsePointer() && pinnedCategoryCard !== card) {
          event.preventDefault();
        }
        pinnedCategoryCard = card;
        setCategoryBackground(card);
      });
    });

    categoryShowcase.addEventListener('mouseleave', clearCategoryBackground);
    categoryShowcase.addEventListener('focusout', (event) => {
      if (!categoryShowcase.contains(event.relatedTarget)) clearCategoryBackground();
    });
  }

  // ------------------------------------------------------------
  // CART (localStorage)
  // ------------------------------------------------------------
  const STORAGE_KEY = 'champion-cart';

  const fmtBRL = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cartProductPhotos = {
    'difly': { src: 'assets/img/products/difly.png', alt: 'Difly' },
    'difly-s3': { src: 'assets/img/products/difly-s3.png', alt: 'Difly S3' },
    'vermi-sal': { src: 'assets/img/products/vermi-sal.png', alt: 'Vermi-Sal' },
    'ver-mi-sal': { src: 'assets/img/products/vermi-sal.png', alt: 'Vermi-Sal' },
    'ade-po': { src: 'assets/img/products/ade-po.png', alt: 'A.D.E. Pó' },
    'diazinon': { src: 'assets/img/products/diazinon.png', alt: 'Diazinon' },
    'nucleo-supera': { src: 'assets/img/products/nucleo-premium.png', alt: 'Núcleo Supera' },
    'nucleo': { src: 'assets/img/products/nucleo-premium.png', alt: 'Núcleo Supera' },
    'nucleo-tm-force': { src: 'assets/img/products/select.png', alt: 'Núcleo TM Force' },
    'iatf-boost': { src: 'assets/img/products/iatf-boost.png', alt: 'IATF Boost' },
    'andro-boost': { src: 'assets/img/products/andro-boost.png', alt: 'Andro Boost' },
    'propoxur-1': { src: 'assets/img/products/propoxur.png', alt: 'Propoxur 1%' },
    'domifly-s3': { src: 'assets/img/products/domifly.png', alt: 'Domifly S3' },
    'datropa': { src: 'assets/img/products/datropa.png', alt: 'Datropa' },
    'avecal': { src: 'assets/img/products/avecal.png', alt: 'Avecal' },
    'suino-nobre': { src: 'assets/img/products/suino-nobre.png', alt: 'Suíno Nobre' },
    'farinha-calcio': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio' },
    'farinha-calcio-fosfatada': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio Fosfatada' },
    'farinha-calcio-b12': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio + B12' }
  };

  function getCartPhoto(item) {
    const rawId = String(item.id || '');
    const baseId = rawId.split('|')[0];
    if (item.image) return { src: item.image, alt: item.name };
    return cartProductPhotos[baseId] || cartProductPhotos[rawId] || null;
  }

  function renderCartThumb(item) {
    const photo = getCartPhoto(item);
    if (photo?.src) {
      return `
        <div class="cart-item-thumb has-photo">
          <img src="${escape(photo.src)}" alt="${escape(photo.alt || item.name)}" loading="lazy" />
        </div>`;
    }
    return `<div class="cart-item-thumb">${(item.art || item.name.charAt(0)).toUpperCase()}</div>`;
  }

  const Cart = {
    items: [],
    load() {
      try { this.items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { this.items = []; }
    },
    save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); },
    add(item, options = {}) {
      const existing = this.items.find(i => i.id === item.id);
      if (existing) existing.qty += item.qty || 1;
      else this.items.push(Object.assign({ qty: 1 }, item));
      this.save();
      this.render();
      if (options.open !== false) this.open();
      showToast(`${item.name} adicionado ao carrinho`);
    },
    remove(id) {
      this.items = this.items.filter(i => i.id !== id);
      this.save();
      this.render();
    },
    setQty(id, q) {
      const it = this.items.find(i => i.id === id);
      if (!it) return;
      it.qty = Math.max(1, Math.min(99, q));
      this.save();
      this.render();
    },
    total() {
      return this.items.reduce((s, i) => s + i.price * i.qty, 0);
    },
    count() {
      return this.items.reduce((s, i) => s + i.qty, 0);
    },
    open() {
      drawer?.classList.add('is-open');
      overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },
    close() {
      drawer?.classList.remove('is-open');
      overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
    },
    render() {
      const body = document.getElementById('cartBody');
      const totalEl = document.getElementById('cartTotal');
      const count = this.count();
      document.querySelectorAll('#cartBadge, [data-cart-badge]').forEach(badge => {
        const previous = parseInt(badge.textContent, 10) || 0;
        badge.textContent = count;
        if (count > previous) {
          badge.classList.remove('is-bumped');
          // Force reflow so the animation re-runs
          void badge.offsetWidth;
          badge.classList.add('is-bumped');
        }
      });
      const cartFloat = document.querySelector('.cart-float');
      if (cartFloat) cartFloat.dataset.hasItems = count > 0 ? 'true' : 'false';
      if (totalEl) totalEl.textContent = fmtBRL(this.total());
      if (!body) return;

      if (!this.items.length) {
        body.innerHTML = `
          <div class="cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <p>Seu carrinho está vazio.<br>Que tal adicionar um produto?</p>
          </div>`;
        return;
      }
      body.innerHTML = this.items.map(it => `
        <div class="cart-item">
          ${renderCartThumb(it)}
          <div class="cart-item-body">
            <h5>${escape(it.name)}</h5>
            <p>${fmtBRL(it.price)}</p>
            <div class="cart-item-foot">
              <div class="qty" style="height:34px">
                <button data-act="dec" data-id="${it.id}" style="width:34px;height:34px;font-size:14px">−</button>
                <input value="${it.qty}" data-act="set" data-id="${it.id}" style="width:38px;font-size:14px" />
                <button data-act="inc" data-id="${it.id}" style="width:34px;height:34px;font-size:14px">+</button>
              </div>
              <strong>${fmtBRL(it.price * it.qty)}</strong>
              <button class="icon-btn" data-act="rm" data-id="${it.id}" style="width:34px;height:34px" aria-label="Remover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');

      body.querySelectorAll('[data-act]').forEach(el => {
        const act = el.dataset.act;
        const id = el.dataset.id;
        if (act === 'inc') el.onclick = () => this.setQty(id, (this.items.find(i=>i.id===id)?.qty || 1) + 1);
        if (act === 'dec') el.onclick = () => this.setQty(id, (this.items.find(i=>i.id===id)?.qty || 1) - 1);
        if (act === 'rm') el.onclick = () => this.remove(id);
        if (act === 'set') el.onchange = () => this.setQty(id, +el.value);
      });
    }
  };

  function escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Drawer wires
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const cartHead = drawer?.querySelector('.cart-head');
  if (cartHead && !cartHead.querySelector('.cart-brand')) {
    const title = cartHead.querySelector('h3');
    if (title) {
      title.outerHTML = `
        <div class="cart-brand">
          <img src="assets/img/brand/logo.png" alt="Champion" />
          <div>
            <span>Champion</span>
            <strong>Seu carrinho</strong>
          </div>
        </div>`;
    }
  }
  document.getElementById('cartBtn')?.addEventListener('click', () => Cart.open());
  document.getElementById('cartClose')?.addEventListener('click', () => Cart.close());
  overlay?.addEventListener('click', () => Cart.close());

  // Wire click on the static .cart-float (added directly in HTML for reliability).
  // Fallback: if for any reason it isn't in the page, inject it.
  let floatBtn = document.querySelector('.cart-float');
  if (!floatBtn) {
    floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'cart-float';
    floatBtn.id = 'cartFloat';
    floatBtn.setAttribute('aria-label', 'Abrir carrinho');
    floatBtn.dataset.hasItems = 'false';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      <span class="badge" data-cart-badge>0</span>
      <span class="cart-float-label" aria-hidden="true">Carrinho</span>
    `;
    document.body.appendChild(floatBtn);
  }
  floatBtn.addEventListener('click', () => Cart.open());

  document.getElementById('cartCheckout')?.addEventListener('click', () => {
    if (!Cart.items.length) { showToast('Seu carrinho está vazio.'); return; }
    /* Redireciona para o fluxo de checkout. Sem gateway: o pedido será marcado como pago ao confirmar. */
    window.location.href = 'checkout.html';
  });

  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Cart.close();
      closeAccountModal();
    }
  });

  Cart.load();
  Cart.render();

  // ------------------------------------------------------------
  // Product cards: photos, demo prices and cart actions
  // ------------------------------------------------------------
  const productPhotos = {
    'difly': { src: 'assets/img/products/difly.png', alt: 'Difly' },
    'difly-s3': { src: 'assets/img/products/difly-s3.png', alt: 'Difly S3' },
    'vermi-sal': { src: 'assets/img/products/vermi-sal.png', alt: 'Vermi-Sal' },
    'ver-mi-sal': { src: 'assets/img/products/vermi-sal.png', alt: 'Vermi-Sal' },
    'ade-po': { src: 'assets/img/products/ade-po.png', alt: 'A.D.E. Pó' },
    'diazinon': { src: 'assets/img/products/diazinon.png', alt: 'Diazinon' },
    'nucleo-supera': { src: 'assets/img/products/nucleo-premium.png', alt: 'Núcleo Supera' },
    'nucleo': { src: 'assets/img/products/nucleo-premium.png', alt: 'Núcleo Supera' },
    'nucleo-tm-force': { src: 'assets/img/products/select.png', alt: 'Núcleo TM Force' },
    'iatf-boost': { src: 'assets/img/products/iatf-boost.png', alt: 'IATF Boost' },
    'andro-boost': { src: 'assets/img/products/andro-boost.png', alt: 'Andro Boost' },
    'propoxur-1': { src: 'assets/img/products/propoxur.png', alt: 'Propoxur 1%' },
    'domifly-s3': { src: 'assets/img/products/domifly.png', alt: 'Domifly S3' },
    'datropa': { src: 'assets/img/products/datropa.png', alt: 'Datropa' },
    'avecal': { src: 'assets/img/products/avecal.png', alt: 'Avecal' },
    'suino-nobre': { src: 'assets/img/products/suino-nobre.png', alt: 'Suíno Nobre' },
    'farinha-calcio': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio' },
    'farinha-calcio-fosfatada': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio Fosfatada' },
    'farinha-calcio-b12': { src: 'assets/img/products/farinha-calcio.png', alt: 'Farinha de Cálcio + B12' }
  };

  const productCommerce = {
    'difly': { name: 'Difly', price: 129.90, art: 'D' },
    'difly-s3': { name: 'Difly S3', price: 189.90, art: 'S' },
    'vermi-sal': { name: 'Vermi-Sal', price: 149.90, art: 'V' },
    'ver-mi-sal': { name: 'Vermi-Sal', price: 149.90, art: 'V' },
    'ade-po': { name: 'A.D.E. Pó', price: 79.90, art: 'A' },
    'diazinon': { name: 'Diazinon', price: 64.90, art: 'D' },
    'nucleo-supera': { name: 'Núcleo Supera', price: 219.90, art: 'N' },
    'nucleo': { name: 'Núcleo Supera', price: 219.90, art: 'N' },
    'nucleo-tm-force': { name: 'Núcleo TM Force', price: 249.90, art: 'T' },
    'iatf-boost': { name: 'IATF Boost', price: 179.90, art: 'I' },
    'andro-boost': { name: 'Andro Boost', price: 169.90, art: 'A' },
    'propoxur-1': { name: 'Propoxur 1%', price: 49.90, art: 'P' },
    'domifly-s3': { name: 'Domifly S3', price: 89.90, art: 'D' },
    'datropa': { name: 'Datropa', price: 139.90, art: 'D' },
    'avecal': { name: 'Avecal', price: 59.90, art: 'A' },
    'suino-nobre': { name: 'Suíno Nobre', price: 159.90, art: 'S' },
    'farinha-calcio': { name: 'Farinha de Cálcio', price: 39.90, art: 'C' },
    'farinha-calcio-fosfatada': { name: 'Farinha de Cálcio Fosfatada', price: 54.90, art: 'F' },
    'farinha-calcio-b12': { name: 'Farinha de Cálcio + B12', price: 69.90, art: 'B' }
  };

  document.querySelectorAll('.product-card[data-product]').forEach(card => {
    const id = card.dataset.product;
    const photo = productPhotos[id];
    const thumb = card.querySelector('.product-thumb');
    if (photo && thumb) {
      const tag = thumb.querySelector('.product-tag')?.outerHTML || '';
      thumb.className = 'product-thumb has-photo';
      thumb.innerHTML = `${tag}<img class="product-photo" src="${photo.src}" alt="${photo.alt}" loading="lazy" />`;
    }

    const commerce = productCommerce[id];
    if (!commerce) return;

    const labelEl = card.querySelector('.product-price-label');
    const priceEl = card.querySelector('.product-price');
    if (labelEl) labelEl.textContent = 'Preço fictício';
    if (priceEl) {
      priceEl.classList.remove('product-price-consult');
      priceEl.textContent = fmtBRL(commerce.price);
    }

    const addBtn = card.querySelector('.product-add');
    if (addBtn) {
      addBtn.setAttribute('aria-label', `Adicionar ${commerce.name} ao carrinho`);
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Cart.add({ id: id, ...commerce, qty: 1 }, { open: false });
      });
    }
  });

  // ------------------------------------------------------------
  // Shop filters, search, sorting and view mode
  // ------------------------------------------------------------
  const shopList = document.querySelector('.product-list');
  const shopSide = document.getElementById('shopSide');
  const shopTotal = document.getElementById('shopTotal');

  if (shopList && shopSide && shopTotal) {
    const shopSearch = document.getElementById('shopSearch');
    const shopSearchBtn = document.getElementById('shopSearchBtn');
    const sortSelect = document.getElementById('shopSort');
    const activeFilters = document.getElementById('activeFilters');
    const filterClear = document.getElementById('filterClear');
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const priceMinInput = document.getElementById('priceMin');
    const priceMaxInput = document.getElementById('priceMax');
    const priceRadios = Array.from(shopSide.querySelectorAll('input[name="price"]'));
    const checkInputs = Array.from(shopSide.querySelectorAll('input[data-cat], input[data-esp], input[data-use]'));
    const allFilterInputs = [...checkInputs, ...priceRadios];

    const productCatalog = {
      'difly': {
        cats: ['larvicida', 'parasitario'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['mosca', 'mosca-dos-chifres', 'larvas', 'cocho', 'origem'],
        best: 1,
        launch: 12
      },
      'difly-s3': {
        cats: ['larvicida', 'parasitario'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['moscas', 'carrapatos', 'pragas', 'infestacoes'],
        best: 2,
        launch: 13
      },
      'vermi-sal': {
        cats: ['vermifugo', 'mineralizacao'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['vermes', 'nematodeos', 'antianemico', 'cocho'],
        best: 3,
        launch: 8
      },
      'ade-po': {
        cats: ['suplemento'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['vitaminas', 'imunidade', 'fertilidade', 'seca', 'recria'],
        best: 6,
        launch: 9
      },
      'diazinon': {
        cats: ['inseticida'],
        species: ['ambientes'],
        uses: ['pulverizacao'],
        keywords: ['currais', 'estabulos', 'moscas', 'pulgas', 'instalacoes', 'epi'],
        best: 10,
        launch: 4
      },
      'nucleo-supera': {
        cats: ['nutricao'],
        species: ['bovinos'],
        uses: ['sal-racao', 'dieta-premix'],
        keywords: ['ganho de peso', 'dieta', 'pre-mix', 'custos', 'producao'],
        best: 4,
        launch: 10
      },
      'nucleo-tm-force': {
        cats: ['nutricao'],
        species: ['bovinos'],
        uses: ['sal-racao', 'dieta-premix'],
        keywords: ['performance', 'alto desempenho', 'ganho intensivo', 'dieta'],
        best: 5,
        launch: 14
      },
      'iatf-boost': {
        cats: ['suplemento', 'reproducao'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['prenhez', 'ovarios', 'fertilidade', 'reproducao'],
        best: 7,
        launch: 15
      },
      'andro-boost': {
        cats: ['suplemento', 'reproducao'],
        species: ['bovinos'],
        uses: ['sal-racao'],
        keywords: ['touros', 'semen', 'motilidade', 'fertilidade'],
        best: 8,
        launch: 16
      },
      'propoxur-1': {
        cats: ['inseticida', 'parasitario'],
        species: ['veterinario'],
        uses: ['po-topico'],
        keywords: ['pulgas', 'carrapatos', 'piolhos', 'ectoparasitas', 'po'],
        best: 11,
        launch: 5
      },
      'domifly-s3': {
        cats: ['larvicida', 'inseticida'],
        species: ['ambientes'],
        uses: ['agua-parada'],
        keywords: ['dengue', 'mosquito', 'larvicida liquido', 'agua parada'],
        best: 9,
        launch: 17
      },
      'datropa': {
        cats: ['nutricao', 'suplemento'],
        species: ['equinos'],
        uses: ['sal-racao'],
        keywords: ['equinos', 'ossos', 'desempenho', 'palatabilidade'],
        best: 12,
        launch: 7
      },
      'avecal': {
        cats: ['mineralizacao', 'nutricao'],
        species: ['aves'],
        uses: ['sal-racao'],
        keywords: ['aves', 'calcio', 'crescimento', 'producao'],
        best: 13,
        launch: 6
      },
      'suino-nobre': {
        cats: ['nutricao', 'suplemento'],
        species: ['suinos'],
        uses: ['sal-racao'],
        keywords: ['suinos', 'ganho de peso', 'conversao alimentar'],
        best: 14,
        launch: 11
      },
      'farinha-calcio': {
        cats: ['mineralizacao', 'nutricao'],
        species: ['minerais'],
        uses: ['dieta-premix'],
        keywords: ['calcio', 'ossos', 'base nutricional'],
        best: 15,
        launch: 1
      },
      'farinha-calcio-fosfatada': {
        cats: ['mineralizacao', 'nutricao'],
        species: ['minerais'],
        uses: ['dieta-premix'],
        keywords: ['calcio', 'fosforo', 'fosfatada', 'formulacao'],
        best: 16,
        launch: 2
      },
      'farinha-calcio-b12': {
        cats: ['mineralizacao', 'suplemento'],
        species: ['minerais'],
        uses: ['dieta-premix'],
        keywords: ['calcio', 'b12', 'vitaminas', 'suporte vitaminico'],
        best: 17,
        launch: 3
      }
    };

    const normalizeText = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const parseMoney = (value) => {
      const clean = String(value || '').replace(/[^\d,.]/g, '').replace(',', '.');
      if (!clean) return null;
      const parsed = Number.parseFloat(clean);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const getFilterValue = (input) => input.dataset.cat || input.dataset.esp || input.dataset.use || '';
    const getFilterType = (input) => input.dataset.cat ? 'cats' : input.dataset.esp ? 'species' : 'uses';
    const getFilterLabel = (input) => {
      const clone = input.closest('label')?.cloneNode(true);
      if (!clone) return getFilterValue(input);
      clone.querySelectorAll('input, .box, .count').forEach(node => node.remove());
      return clone.textContent.trim();
    };

    const products = Array.from(shopList.querySelectorAll('.product-card[data-product]')).map((card, index) => {
      const id = card.dataset.product;
      const commerce = productCommerce[id] || {};
      const meta = productCatalog[id] || {};
      const name = commerce.name || card.querySelector('.product-name')?.textContent.trim() || id;
      const price = typeof commerce.price === 'number' ? commerce.price : parseMoney(card.querySelector('.product-price')?.textContent) || 0;
      const categoryText = card.querySelector('.product-cat')?.textContent || '';
      const desc = card.querySelector('.product-desc')?.textContent || '';
      const searchBlob = normalizeText([
        name,
        categoryText,
        desc,
        ...(meta.keywords || [])
      ].join(' '));

      return {
        id,
        card,
        index,
        name,
        price,
        searchBlob,
        cats: meta.cats || [],
        species: meta.species || [],
        uses: meta.uses || [],
        best: meta.best || 99,
        launch: meta.launch || 0
      };
    });

    let shopEmpty = document.getElementById('shopEmpty');
    if (!shopEmpty) {
      shopEmpty = document.createElement('div');
      shopEmpty.className = 'shop-empty';
      shopEmpty.id = 'shopEmpty';
      shopEmpty.hidden = true;
      shopEmpty.innerHTML = '<div><strong>Nenhum produto encontrado</strong><span>Ajuste a busca ou remova algum filtro.</span></div>';
      shopList.after(shopEmpty);
    }

    const readState = () => {
      const checkedBy = (attr) => checkInputs
        .filter(input => input.checked && input.dataset[attr])
        .map(input => input.dataset[attr]);
      const selectedPrice = priceRadios.find(input => input.checked);
      const customMin = parseMoney(priceMinInput?.value);
      const customMax = parseMoney(priceMaxInput?.value);

      return {
        query: normalizeText(shopSearch?.value || '').trim(),
        cats: checkedBy('cat'),
        species: checkedBy('esp'),
        uses: checkedBy('use'),
        priceMin: selectedPrice ? parseMoney(selectedPrice.dataset.priceMin) : customMin,
        priceMax: selectedPrice ? parseMoney(selectedPrice.dataset.priceMax) : customMax,
        selectedPrice
      };
    };

    const matchesGroup = (selected, values) => !selected.length || selected.some(value => values.includes(value));

    const productMatches = (product, state) => {
      if (!matchesGroup(state.cats, product.cats)) return false;
      if (!matchesGroup(state.species, product.species)) return false;
      if (!matchesGroup(state.uses, product.uses)) return false;
      if (state.priceMin !== null && product.price < state.priceMin) return false;
      if (state.priceMax !== null && product.price > state.priceMax) return false;
      const terms = state.query.split(/\s+/).filter(Boolean);
      return !terms.length || terms.every(term => product.searchBlob.includes(term));
    };

    const sortProducts = (items) => {
      const mode = sortSelect?.value || 'relevance';
      return [...items].sort((a, b) => {
        if (mode === 'best') return a.best - b.best || a.index - b.index;
        if (mode === 'price-asc') return a.price - b.price || a.index - b.index;
        if (mode === 'price-desc') return b.price - a.price || a.index - b.index;
        if (mode === 'new') return b.launch - a.launch || a.index - b.index;
        if (mode === 'name') return a.name.localeCompare(b.name, 'pt-BR') || a.index - b.index;
        return a.index - b.index;
      });
    };

    const updateCounts = () => {
      checkInputs.forEach(input => {
        const value = getFilterValue(input);
        const type = getFilterType(input);
        const countEl = input.closest('label')?.querySelector('.count');
        const count = products.filter(product => product[type].includes(value)).length;
        if (countEl) countEl.textContent = count;
      });
    };

    const addChip = (label, onClear) => {
      const chip = document.createElement('span');
      chip.className = 'active-chip';
      chip.append(document.createTextNode(label));

      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Remover filtro ${label}`);
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      button.addEventListener('click', onClear);

      chip.append(button);
      activeFilters?.append(chip);
    };

    const renderChips = (state) => {
      if (!activeFilters) return;
      activeFilters.innerHTML = '<span class="label">Filtros ativos:</span>';
      let hasChip = false;

      if (shopSearch?.value.trim()) {
        hasChip = true;
        addChip(`Busca: ${shopSearch.value.trim()}`, () => {
          shopSearch.value = '';
          applyFilters();
        });
      }

      checkInputs.filter(input => input.checked).forEach(input => {
        hasChip = true;
        addChip(getFilterLabel(input), () => {
          input.checked = false;
          applyFilters();
        });
      });

      if (state.selectedPrice) {
        hasChip = true;
        addChip(getFilterLabel(state.selectedPrice), () => {
          state.selectedPrice.checked = false;
          applyFilters();
        });
      } else {
        if (state.priceMin !== null) {
          hasChip = true;
          addChip(`Mín. ${fmtBRL(state.priceMin)}`, () => {
            if (priceMinInput) priceMinInput.value = '';
            applyFilters();
          });
        }
        if (state.priceMax !== null) {
          hasChip = true;
          addChip(`Máx. ${fmtBRL(state.priceMax)}`, () => {
            if (priceMaxInput) priceMaxInput.value = '';
            applyFilters();
          });
        }
      }

      activeFilters.style.display = hasChip ? 'flex' : 'none';
    };

    function applyFilters() {
      const state = readState();
      const sorted = sortProducts(products);
      const visible = sorted.filter(product => productMatches(product, state));
      const visibleSet = new Set(visible);

      sorted.forEach(product => shopList.appendChild(product.card));
      products.forEach(product => {
        const shouldShow = visibleSet.has(product);
        product.card.classList.toggle('is-hidden', !shouldShow);
        if (shouldShow) product.card.classList.add('is-visible');
      });

      shopTotal.textContent = visible.length;
      shopEmpty.hidden = visible.length > 0;
      renderChips(state);
    }

    checkInputs.forEach(input => input.addEventListener('change', applyFilters));

    priceRadios.forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) {
          if (priceMinInput) priceMinInput.value = '';
          if (priceMaxInput) priceMaxInput.value = '';
        }
        applyFilters();
      });
    });

    [priceMinInput, priceMaxInput].forEach(input => {
      input?.addEventListener('input', () => {
        priceRadios.forEach(radio => { radio.checked = false; });
        applyFilters();
      });
    });

    shopSearch?.addEventListener('input', applyFilters);
    shopSearch?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyFilters();
      }
    });
    shopSearchBtn?.addEventListener('click', applyFilters);
    sortSelect?.addEventListener('change', applyFilters);

    document.querySelectorAll('.view-toggle [data-view]').forEach(button => {
      button.addEventListener('click', () => {
        const isList = button.dataset.view === 'list';
        shopList.classList.toggle('is-list', isList);
        document.querySelectorAll('.view-toggle [data-view]').forEach(viewButton => {
          const active = viewButton === button;
          viewButton.classList.toggle('active', active);
          viewButton.setAttribute('aria-pressed', String(active));
        });
      });
    });

    mobileFilterBtn?.setAttribute('aria-controls', 'shopSide');
    mobileFilterBtn?.setAttribute('aria-expanded', 'false');
    mobileFilterBtn?.addEventListener('click', () => {
      const isOpen = shopSide.classList.toggle('is-open');
      mobileFilterBtn.setAttribute('aria-expanded', String(isOpen));
    });

    filterClear?.addEventListener('click', () => {
      allFilterInputs.forEach(input => { input.checked = false; });
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      if (shopSearch) shopSearch.value = '';
      applyFilters();
    });

    updateCounts();
    applyFilters();
  }

  // ------------------------------------------------------------
  // Account modal (login/register demo)
  // ------------------------------------------------------------
  const ACCOUNT_KEY = 'champion-account';
  const SESSION_KEY = 'champion-session';
  accountTriggers = document.querySelectorAll('button[aria-label="Conta"], button[aria-label="Account"], button[aria-label="Cuenta"], a[aria-label="Conta"], .account-trigger');

  function getStoredAccount() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); }
    catch { return null; }
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function setAccountFeedback(form, message, type = 'error') {
    const feedback = form.querySelector('.account-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `account-feedback is-show is-${type}`;
  }

  function clearAccountFeedback(form) {
    const feedback = form.querySelector('.account-feedback');
    if (!feedback) return;
    feedback.textContent = '';
    feedback.className = 'account-feedback';
  }

  function updateAccountTriggers() {
    const session = getSession();
    const copy = languageCopy[getCurrentLanguage()] || languageCopy.pt;
    accountTriggers.forEach(trigger => {
      trigger.classList.add('account-trigger');
      trigger.classList.toggle('is-signed', Boolean(session));
      trigger.setAttribute('aria-label', session ? `${copy.accountOf} ${session.name}` : copy.account);
      trigger.setAttribute('title', session ? `${copy.accountOf} ${session.name}` : copy.accountTitle);
    });
  }

  function accountIcon(name) {
    const icons = {
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
      cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
      truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      google: '<svg viewBox="0 0 24 24"><path fill="#4285f4" d="M22.5 12.27c0-.7-.06-1.4-.2-2.07H12v3.92h5.92a5.06 5.06 0 0 1-2.2 3.32v2.75h3.55c2.08-1.92 3.27-4.75 3.27-7.92z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.27-2.66l-3.55-2.75c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#fbbc05" d="M5.84 14.11c-.22-.66-.35-1.37-.35-2.11s.13-1.45.35-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24"><path fill="#1877f2" d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-3h2.5V9.5C10.5 7 12 5.7 14.2 5.7c1 0 2.1.2 2.1.2V8h-1.2c-1.2 0-1.6.7-1.6 1.5V12h2.7l-.4 3h-2.3v7A10 10 0 0 0 22 12z"/></svg>'
    };
    return icons[name] || icons.check;
  }

  function createAccountModal() {
    let modal = document.getElementById('accountModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.id = 'accountModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="account-backdrop" data-account-close></div>
      <section class="account-panel" role="dialog" aria-modal="true" aria-labelledby="accountTitle">
        <button class="account-close" type="button" data-account-close aria-label="Fechar">${accountIcon('close')}</button>
        <div class="account-shell">
          <aside class="account-aside">
            <div class="account-aside-brand">
              <span class="mark">${accountIcon('shield')}</span>
              Champion · Saúde Animal
            </div>
            <div>
              <span class="section-eyebrow">Minha conta</span>
              <h2 id="accountTitle">Bem-vindo ao <em>universo Champion</em>.</h2>
              <p>Compra rápida, dados salvos com segurança e atendimento técnico exclusivo. Acesse sua conta ou cadastre-se em poucos minutos.</p>
            </div>
            <div class="account-perks">
              <div><span class="ico-bubble">${accountIcon('cart')}</span> Compra mais rápida no carrinho</div>
              <div><span class="ico-bubble">${accountIcon('truck')}</span> Endereço de entrega salvo</div>
              <div><span class="ico-bubble">${accountIcon('shield')}</span> Dados protegidos e criptografados</div>
              <div><span class="ico-bubble">${accountIcon('mail')}</span> Suporte técnico veterinário</div>
            </div>
            <div class="account-aside-foot">
              ${accountIcon('shield')}
              Cadastro 100% protegido · LGPD
            </div>
          </aside>

          <div class="account-main">
            <div class="account-status" id="accountStatus" hidden>
              <div class="account-status-main">
                <span>Conta conectada</span>
                <strong id="accountStatusName"></strong>
                <small id="accountStatusMeta"></small>
              </div>
              <div class="account-status-actions">
                <button type="button" id="accountEdit">Editar cadastro</button>
                <button type="button" id="accountLogout">Sair</button>
              </div>
            </div>

            <div class="account-main-head">
              <h3 data-account-heading>Acesse sua conta</h3>
              <p data-account-subheading>Entre com seu e-mail e senha para continuar comprando.</p>
            </div>

            <div class="account-tabs" role="tablist" aria-label="Acesso à conta">
              <button class="account-tab is-active" type="button" role="tab" aria-selected="true" data-account-tab="login">Login</button>
              <button class="account-tab" type="button" role="tab" aria-selected="false" data-account-tab="register">Criar cadastro</button>
            </div>

            <div class="account-panel-body is-active" data-account-panel="login">
              <form class="account-form" id="accountLoginForm" novalidate>
                <div class="account-field">
                  <label for="loginEmail">E-mail</label>
                  <input id="loginEmail" name="email" type="email" autocomplete="email" placeholder="seu@email.com" required />
                </div>
                <div class="account-field">
                  <div class="account-field-row">
                    <label for="loginPassword">Senha</label>
                    <a href="#recuperar" class="account-forgot" data-account-forgot>Esqueci minha senha</a>
                  </div>
                  <div class="account-password">
                    <input id="loginPassword" name="password" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres" required minlength="6" />
                    <button type="button" data-password-toggle aria-label="Mostrar senha">${accountIcon('eye')}</button>
                  </div>
                </div>
                <label class="account-check">
                  <input type="checkbox" name="remember" checked />
                  Manter acesso neste navegador
                </label>
                <div class="account-feedback" aria-live="polite"></div>
                <button class="btn btn-primary" type="submit">Entrar na conta</button>
                <p class="account-form-note">
                  Ainda não tem cadastro?
                  <button type="button" data-account-tab-jump="register">Criar conta grátis</button>
                </p>
              </form>
            </div>

            <div class="account-panel-body" data-account-panel="register">
              <form class="account-form" id="accountRegisterForm" novalidate>
                <h3 class="account-section-title">Dados de acesso</h3>
                <div class="account-grid">
                  <div class="account-field">
                    <label for="regName">Nome completo</label>
                    <input id="regName" name="fullName" autocomplete="name" required />
                  </div>
                  <div class="account-field">
                    <label for="regCustomerType">Tipo de cliente</label>
                    <select id="regCustomerType" name="customerType" required>
                      <option value="">Selecione</option>
                      <option>Produtor rural</option>
                      <option>Fazenda / empresa</option>
                      <option>Revenda</option>
                      <option>Veterinário</option>
                      <option>Técnico / consultor</option>
                    </select>
                  </div>
                  <div class="account-field">
                    <label for="regDocument">CPF ou CNPJ</label>
                    <input id="regDocument" name="document" inputmode="numeric" autocomplete="off" required />
                  </div>
                  <div class="account-field">
                    <label for="regPhone">Celular / WhatsApp</label>
                    <input id="regPhone" name="phone" inputmode="tel" autocomplete="tel" required />
                  </div>
                  <div class="account-field">
                    <label for="regEmail">E-mail</label>
                    <input id="regEmail" name="email" type="email" autocomplete="email" required />
                  </div>
                  <div class="account-field">
                    <label for="regIe">Inscrição estadual</label>
                    <input id="regIe" name="stateRegistration" autocomplete="off" />
                  </div>
                  <div class="account-field">
                    <label for="regPassword">Senha</label>
                    <div class="account-password">
                      <input id="regPassword" name="password" type="password" autocomplete="new-password" required minlength="6" />
                      <button type="button" data-password-toggle aria-label="Mostrar senha">${accountIcon('eye')}</button>
                    </div>
                    <div class="password-meter" data-password-meter data-score="0"><span></span></div>
                    <p class="account-hint" data-password-hint>Use 6+ caracteres com letras, números e símbolo.</p>
                  </div>
                  <div class="account-field">
                    <label for="regConfirmPassword">Confirmar senha</label>
                    <div class="account-password">
                      <input id="regConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required minlength="6" />
                      <button type="button" data-password-toggle aria-label="Mostrar senha">${accountIcon('eye')}</button>
                    </div>
                    <p class="account-hint" data-confirm-hint>Repita a senha para confirmar o acesso.</p>
                  </div>
                </div>

                <h3 class="account-section-title">Endereço de entrega</h3>
                <div class="account-grid-3">
                  <div class="account-field">
                    <label for="regCep">CEP</label>
                    <input id="regCep" name="cep" inputmode="numeric" autocomplete="postal-code" required />
                  </div>
                  <div class="account-field">
                    <label for="regCity">Cidade</label>
                    <input id="regCity" name="city" autocomplete="address-level2" required />
                  </div>
                  <div class="account-field">
                    <label for="regState">UF</label>
                    <input id="regState" name="state" maxlength="2" autocomplete="address-level1" required />
                  </div>
                </div>
                <div class="account-grid">
                  <div class="account-field">
                    <label for="regStreet">Endereço</label>
                    <input id="regStreet" name="street" autocomplete="address-line1" required />
                  </div>
                  <div class="account-field">
                    <label for="regNumber">Número</label>
                    <input id="regNumber" name="number" autocomplete="address-line2" required />
                  </div>
                  <div class="account-field">
                    <label for="regDistrict">Bairro</label>
                    <input id="regDistrict" name="district" required />
                  </div>
                  <div class="account-field">
                    <label for="regComplement">Complemento</label>
                    <input id="regComplement" name="complement" />
                  </div>
                </div>

                <h3 class="account-section-title">Perfil de compra</h3>
                <div class="account-grid">
                  <div class="account-field">
                    <label for="regBusinessName">Fazenda / empresa</label>
                    <input id="regBusinessName" name="businessName" />
                  </div>
                  <div class="account-field">
                    <label for="regSpecies">Principal criação</label>
                    <select id="regSpecies" name="species">
                      <option value="">Selecione</option>
                      <option>Bovinos</option>
                      <option>Equinos</option>
                      <option>Aves</option>
                      <option>Suínos</option>
                      <option>Minerais / formulação</option>
                    </select>
                  </div>
                </div>
                <label class="account-check">
                  <input type="checkbox" name="newsletter" />
                  Quero receber ofertas e novidades da Champion
                </label>
                <label class="account-check">
                  <input type="checkbox" name="terms" required />
                  Li e aceito os termos de cadastro
                </label>
                <div class="account-feedback" aria-live="polite"></div>
                <button class="btn btn-primary" type="submit">Criar cadastro</button>
                <p class="account-form-note" data-register-login-note>
                  Já tenho cadastro.
                  <button type="button" data-account-tab-jump="login">Entrar na conta</button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-account-close]').forEach(button => {
      button.addEventListener('click', closeAccountModal);
    });

    modal.querySelectorAll('[data-account-tab]').forEach(tab => {
      tab.addEventListener('click', () => setAccountTab(tab.dataset.accountTab));
    });

    modal.querySelectorAll('[data-account-tab-jump]').forEach(button => {
      button.addEventListener('click', () => setAccountTab(button.dataset.accountTabJump));
    });

    modal.querySelectorAll('[data-password-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const input = button.closest('.account-password')?.querySelector('input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    const loginForm = modal.querySelector('#accountLoginForm');
    const registerForm = modal.querySelector('#accountRegisterForm');
    loginForm?.addEventListener('submit', handleAccountLogin);
    registerForm?.addEventListener('submit', handleAccountRegister);
    loginForm?.addEventListener('input', () => clearAccountFeedback(loginForm));
    registerForm?.addEventListener('input', () => {
      clearAccountFeedback(registerForm);
      updatePasswordUx(registerForm);
    });

    modal.querySelector('#accountLogout')?.addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY);
      updateAccountTriggers();
      updateAccountStatus();
      showToast('Você saiu da sua conta.');
    });

    modal.querySelector('#accountEdit')?.addEventListener('click', () => {
      const account = getStoredAccount();
      if (!account) return;
      prefillRegisterForm(account);
      setAccountTab('register');
    });

    registerForm?.querySelector('[name="document"]')?.addEventListener('input', maskDocument);
    registerForm?.querySelector('[name="phone"]')?.addEventListener('input', maskPhone);
    registerForm?.querySelector('[name="cep"]')?.addEventListener('input', maskCep);
    registerForm?.querySelector('[name="state"]')?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();
    });

    syncAccountForms();

    return modal;
  }

  function accountEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isEditingAccount(account = getStoredAccount()) {
    const session = getSession();
    return Boolean(session && account && accountEmail(session.email) === accountEmail(account.email));
  }

  function syncAccountForms() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    const account = getStoredAccount();
    const loginEmail = modal.querySelector('#loginEmail');
    if (loginEmail && account?.email && !loginEmail.value) loginEmail.value = account.email;
    const registerForm = modal.querySelector('#accountRegisterForm');
    setRegisterPasswordMode(registerForm, isEditingAccount(account));
    updatePasswordUx(registerForm);
    updateAccountStatus();
  }

  function setRegisterPasswordMode(form, editing) {
    if (!form) return;
    const password = form.elements.password;
    const confirmPassword = form.elements.confirmPassword;
    const submit = form.querySelector('button[type="submit"]');
    const loginNote = form.querySelector('[data-register-login-note]');
    if (password) {
      password.required = !editing;
      password.placeholder = editing ? 'Deixe em branco para manter' : '';
    }
    if (confirmPassword) {
      confirmPassword.required = !editing;
      confirmPassword.placeholder = editing ? 'Deixe em branco para manter' : '';
    }
    if (submit) {
      submit.dataset.defaultLabel = submit.dataset.defaultLabel || submit.textContent.trim();
      submit.textContent = editing ? 'Salvar alterações' : submit.dataset.defaultLabel;
    }
    if (loginNote) loginNote.hidden = editing;
  }

  function prefillRegisterForm(account) {
    const modal = createAccountModal();
    const form = modal.querySelector('#accountRegisterForm');
    if (!form || !account) return;

    Object.entries(account).forEach(([key, value]) => {
      if (key === 'passwordHash') return;
      const input = form.elements[key];
      if (!input) return;
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
        return;
      }
      input.value = value || '';
    });

    if (form.elements.password) form.elements.password.value = '';
    if (form.elements.confirmPassword) form.elements.confirmPassword.value = '';
    if (form.elements.terms) form.elements.terms.checked = true;
    setRegisterPasswordMode(form, true);
    updatePasswordUx(form);
  }

  function scorePassword(password) {
    const value = String(password || '');
    if (!value) return 0;
    let score = value.length >= 6 ? 1 : 0;
    if (value.length >= 10) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.min(score, 4);
  }

  function updatePasswordUx(form) {
    if (!form) return;
    const password = form.elements.password;
    const confirmPassword = form.elements.confirmPassword;
    const meter = form.querySelector('[data-password-meter]');
    const passwordHint = form.querySelector('[data-password-hint]');
    const confirmHint = form.querySelector('[data-confirm-hint]');
    if (!password || !confirmPassword) return;

    const score = scorePassword(password.value);
    if (meter) {
      meter.dataset.score = String(score);
      const bar = meter.querySelector('span');
      if (bar) bar.style.width = `${score * 25}%`;
    }

    if (passwordHint) {
      if (!password.value && !password.required) {
        passwordHint.textContent = 'Deixe em branco para manter a senha atual.';
      } else if (!password.value) {
        passwordHint.textContent = 'Use 6+ caracteres com letras, números e símbolo.';
      } else if (score < 3) {
        passwordHint.textContent = 'Senha fraca. Misture letras, números e símbolo.';
      } else if (score === 3) {
        passwordHint.textContent = 'Senha boa. Um símbolo deixa ainda mais forte.';
      } else {
        passwordHint.textContent = 'Senha forte.';
      }
    }

    if (confirmPassword.value && password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity('As senhas não conferem.');
      if (confirmHint) {
        confirmHint.textContent = 'As senhas ainda não conferem.';
        confirmHint.classList.add('is-error');
      }
      return;
    }

    confirmPassword.setCustomValidity('');
    if (confirmHint) {
      confirmHint.classList.remove('is-error');
      confirmHint.textContent = confirmPassword.value ? 'Senhas conferem.' : 'Repita a senha para confirmar o acesso.';
    }
  }

  function setAccountBusy(form, busy, busyLabel) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) button.dataset.busyPreviousLabel = button.textContent.trim();
    button.disabled = busy;
    button.textContent = busy ? busyLabel : (button.dataset.busyPreviousLabel || button.dataset.defaultLabel || button.textContent);
    if (!busy) delete button.dataset.busyPreviousLabel;
  }

  async function hashPassword(password) {
    const text = String(password || '');
    if (window.crypto?.subtle && window.TextEncoder) {
      const data = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    return btoa(unescape(encodeURIComponent(text)));
  }

  function setAccountTab(tabName) {
    const modal = createAccountModal();
    if (tabName === 'register') {
      const account = getStoredAccount();
      if (isEditingAccount(account)) {
        prefillRegisterForm(account);
      } else {
        setRegisterPasswordMode(modal.querySelector('#accountRegisterForm'), false);
      }
    }
    modal.querySelectorAll('[data-account-tab]').forEach(tab => {
      const active = tab.dataset.accountTab === tabName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    modal.querySelectorAll('[data-account-panel]').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.accountPanel === tabName);
    });

    // Update heading + subheading
    const heading = modal.querySelector('[data-account-heading]');
    const sub = modal.querySelector('[data-account-subheading]');
    if (heading && sub) {
      if (tabName === 'register') {
        heading.textContent = 'Criar cadastro Champion';
        sub.textContent = 'Compra rápida, dados protegidos e suporte técnico exclusivo.';
      } else {
        heading.textContent = 'Acesse sua conta';
        sub.textContent = 'Entre com seu e-mail e senha para continuar comprando.';
      }
    }
  }

  function updateAccountStatus() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    const session = getSession();
    const account = getStoredAccount();
    const status = modal.querySelector('#accountStatus');
    const statusName = modal.querySelector('#accountStatusName');
    const statusMeta = modal.querySelector('#accountStatusMeta');
    if (!status || !statusName) return;
    status.hidden = !session;
    statusName.textContent = session?.name || account?.fullName || '';
    if (statusMeta) {
      const cityState = [account?.city, account?.state].filter(Boolean).join(' / ');
      const pieces = [account?.email || session?.email, account?.phone, cityState].filter(Boolean);
      statusMeta.textContent = pieces.join(' • ');
    }
  }

  function openAccountModal(tabName = 'login') {
    const modal = createAccountModal();
    Cart.close();
    syncAccountForms();
    setAccountTab(tabName);
    updateAccountStatus();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      const activePanel = modal.querySelector('.account-panel-body.is-active');
      activePanel?.querySelector('input, select, button')?.focus();
    }, 40);
  }

  function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('cartDrawer')?.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
  }

  async function handleAccountLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearAccountFeedback(form);
    if (!form.reportValidity()) return;

    const email = accountEmail(form.elements.email.value);
    const password = form.elements.password.value;
    const account = getStoredAccount();
    if (!account || accountEmail(account.email) !== email) {
      setAccountFeedback(form, 'Cadastro não encontrado para este e-mail.');
      setAccountTab('register');
      const registerEmail = document.getElementById('regEmail');
      if (registerEmail) registerEmail.value = email;
      const registerForm = document.getElementById('accountRegisterForm');
      if (registerForm) setAccountFeedback(registerForm, 'Complete seus dados para criar o cadastro.', 'success');
      return;
    }

    setAccountBusy(form, true, 'Entrando...');
    const passwordHash = await hashPassword(password);
    if (account.passwordHash && account.passwordHash !== passwordHash) {
      setAccountBusy(form, false);
      setAccountFeedback(form, 'Senha incorreta. Confira e tente novamente.');
      form.elements.password.focus();
      return;
    }

    if (!account.passwordHash) {
      account.passwordHash = passwordHash;
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: account.fullName,
      email: account.email,
      loggedAt: new Date().toISOString()
    }));
    setAccountFeedback(form, 'Login realizado com sucesso.', 'success');
    updateAccountTriggers();
    updateAccountStatus();
    showToast(`Bem-vindo, ${account.fullName.split(' ')[0]}!`);
    setAccountBusy(form, false);
    window.setTimeout(closeAccountModal, 700);
  }

  async function handleAccountRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearAccountFeedback(form);
    updatePasswordUx(form);
    if (!form.reportValidity()) return;

    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;
    const storedAccount = getStoredAccount();
    const editing = isEditingAccount(storedAccount);
    if ((password || confirmPassword) && password !== confirmPassword) {
      setAccountFeedback(form, 'As senhas não conferem.');
      form.elements.confirmPassword.focus();
      return;
    }
    if (!editing && password.length < 6) {
      setAccountFeedback(form, 'Crie uma senha com pelo menos 6 caracteres.');
      form.elements.password.focus();
      return;
    }

    const email = accountEmail(form.elements.email.value);
    if (!editing && storedAccount && accountEmail(storedAccount.email) === email) {
      setAccountFeedback(form, 'Este e-mail já tem cadastro. Entre na sua conta para continuar.');
      const loginEmail = document.getElementById('loginEmail');
      if (loginEmail) loginEmail.value = form.elements.email.value;
      const loginForm = document.getElementById('accountLoginForm');
      if (loginForm) setAccountFeedback(loginForm, 'Este e-mail já tem cadastro. Digite sua senha para entrar.', 'success');
      setAccountTab('login');
      return;
    }

    setAccountBusy(form, true, editing ? 'Salvando...' : 'Criando...');
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.password;
    delete data.confirmPassword;
    data.newsletter = form.elements.newsletter.checked;
    data.terms = form.elements.terms.checked;
    data.updatedAt = new Date().toISOString();
    data.createdAt = storedAccount?.createdAt || data.updatedAt;
    data.passwordHash = password ? await hashPassword(password) : storedAccount?.passwordHash;

    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data));
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      name: data.fullName,
      email: data.email,
      loggedAt: new Date().toISOString()
    }));

    setAccountFeedback(form, editing ? 'Cadastro atualizado com sucesso.' : 'Cadastro criado com sucesso.', 'success');
    updateAccountTriggers();
    updateAccountStatus();
    showToast(editing ? 'Cadastro atualizado.' : 'Cadastro criado e conta acessada.');
    setAccountBusy(form, false);
    window.setTimeout(closeAccountModal, 900);
  }

  function maskDocument(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      event.target.value = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return;
    }
    event.target.value = digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function maskPhone(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
    event.target.value = digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }

  function maskCep(event) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    event.target.value = digits.replace(/^(\d{5})(\d)/, '$1-$2');
  }

  accountTriggers.forEach(trigger => {
    trigger.classList.add('account-trigger');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      /* New auth flow: dedicated pages instead of modal. */
      var logged = window.ChampionCustomers && window.ChampionCustomers.isLogged();
      window.location.href = logged ? 'minha-conta.html' : 'cliente-conta.html';
    });
  });
  updateAccountTriggers();

  /* Reflect logged-in state on header account triggers (uses new store) */
  if (window.ChampionCustomers) {
    var current = window.ChampionCustomers.currentSession();
    if (current) {
      accountTriggers.forEach(function (t) {
        t.classList.add('is-signed');
        t.setAttribute('title', 'Minha conta — ' + current.email);
      });
    }
  }

  // Favorite toggle (visual only)
  document.querySelectorAll('.product-fav').forEach(b => {
    b.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.toggle('is-fav');
      if (b.classList.contains('is-fav')) {
        b.style.background = 'var(--orange)';
        b.style.color = 'white';
        showToast('Adicionado aos favoritos');
      } else {
        b.style.background = '';
        b.style.color = '';
      }
    });
  });

  // ------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------
  let toastTimer;
  function showToast(msg) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toastMsg');
    if (!t || !m) return;
    m.textContent = msg;
    t.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 2400);
  }

  // Expose
  window.ChampionCart = {
    add: (item, options) => Cart.add(item, options),
    open: () => Cart.open(),
    close: () => Cart.close()
  };
  window.ChampionToast = showToast;

})();
