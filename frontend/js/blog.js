import { CHAMPION_BLOG_FIREBASE, CHAMPION_FIREBASE_CONFIG } from './firebase-config.js';

(async function () {
  'use strict';

  const POSTS_KEY = 'champion-blog-posts';
  const CONFIG_KEY = 'champion-blog-config';
  const ADMIN_SESSION_KEY = 'champion-blog-admin-session';
  const LOCAL_ADMIN_USER = 'admin@champion.com.br';
  const LOCAL_ADMIN_PASSWORD = 'Champion@2026';

  const defaultConfig = {
    title: 'Blog Champion',
    subtitle: 'Conteúdos técnicos, manejo e novidades para quem vive a rotina da pecuária brasileira.',
    heroImage: 'assets/img/about/pecuarista.jpg',
    featuredSlug: 'manejo-integrado-para-um-rebanho-mais-produtivo'
  };

  const defaultPosts = [
    {
      id: 'post-manejo-integrado',
      slug: 'manejo-integrado-para-um-rebanho-mais-produtivo',
      title: 'Manejo integrado para um rebanho mais produtivo',
      category: 'Manejo',
      author: 'Equipe Champion',
      date: '2026-05-01',
      image: 'assets/img/about/pecuarista.jpg',
      status: 'published',
      excerpt: 'Sanidade, nutrição e rotina de campo caminham juntas quando o objetivo é reduzir perdas e melhorar o desempenho do rebanho.',
      content: 'A produtividade no campo nasce de uma rotina bem acompanhada. Quando calendário sanitário, suplementação e observação diária trabalham juntos, o produtor identifica desvios mais cedo e toma decisões com mais segurança.\n\n## Rotina que protege resultado\n\nO primeiro passo é manter registros simples: lote, idade, peso aproximado, produto utilizado e data de aplicação. Esses dados ajudam a comparar ciclos, corrigir falhas e planejar compras com mais previsibilidade.\n\n- Acompanhe consumo e comportamento dos animais.\n- Organize o calendário de manejo por categoria.\n- Revise cochos, água, sombra e lotação.\n- Consulte suporte técnico quando houver queda de desempenho.\n\nCom consistência, pequenas melhorias de rotina aparecem no ganho de peso, na sanidade e na tranquilidade operacional da propriedade.'
    },
    {
      id: 'post-mineralizacao',
      slug: 'mineralizacao-na-estacao-seca',
      title: 'Mineralização na estação seca: pontos de atenção',
      category: 'Nutrição',
      author: 'Equipe Champion',
      date: '2026-04-24',
      image: 'assets/img/hero/background-bovinos.jpg',
      status: 'published',
      excerpt: 'A seca muda a disponibilidade de pasto e exige mais atenção ao consumo mineral, ao acesso aos cochos e ao planejamento do lote.',
      content: 'Na estação seca, o pasto perde qualidade e a suplementação mineral ganha ainda mais importância. A estratégia correta depende do objetivo produtivo, da categoria animal e da disponibilidade de forragem.\n\n## Ajustes práticos\n\nAntes de trocar produtos ou aumentar oferta, observe consumo real, distribuição dos cochos e acesso à água. Muitas respostas ruins no campo estão ligadas a manejo, não apenas à formulação.\n\n- Posicione cochos em locais secos e acessíveis.\n- Evite superlotação em pontos de consumo.\n- Monitore sobra, umidade e contaminação.\n- Reavalie a estratégia quando mudar o lote ou o clima.\n\nUm plano simples, acompanhado semanalmente, reduz desperdício e ajuda a manter o rebanho em melhor condição corporal.'
    },
    {
      id: 'post-larvicidas',
      slug: 'controle-de-moscas-com-planejamento',
      title: 'Controle de moscas com planejamento e constância',
      category: 'Sanidade',
      author: 'Equipe Champion',
      date: '2026-04-16',
      image: 'assets/img/hero/background-suinos.jpg',
      status: 'published',
      excerpt: 'O controle eficiente considera ambiente, fase larval e rotina de aplicação, evitando que o problema avance antes de ser percebido.',
      content: 'Moscas afetam bem-estar, produtividade e rotina da fazenda. O controle mais eficiente combina limpeza, acompanhamento dos pontos críticos e uso correto das soluções indicadas.\n\n## Onde observar\n\nCurrais, esterqueiras, áreas úmidas e locais com matéria orgânica acumulada merecem atenção especial. Atuar cedo reduz pressão de infestação e melhora a eficiência das aplicações.\n\n- Mapeie pontos de maior incidência.\n- Mantenha frequência de monitoramento.\n- Siga as orientações de dose e intervalo.\n- Integre manejo ambiental e produto adequado.\n\nConstância é o que transforma o controle de moscas em rotina previsível, e não em resposta emergencial.'
    }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `post-${Date.now()}`;
  }

  function normalizePost(post = {}, index = 0) {
    const title = String(post.title || `Post ${index + 1}`).trim();
    const validTemplates = ['standard', 'gallery', 'tutorial'];
    const template = validTemplates.includes(post.template) ? post.template : 'standard';
    const gallery = Array.isArray(post.gallery) ? post.gallery
      .map((g) => ({ image: String(g?.image || '').trim(), caption: String(g?.caption || '').trim() }))
      .filter((g) => g.image) : [];
    const steps = Array.isArray(post.steps) ? post.steps
      .map((s) => ({
        title: String(s?.title || '').trim(),
        image: String(s?.image || '').trim(),
        description: String(s?.description || '').trim()
      }))
      .filter((s) => s.title || s.image || s.description) : [];
    return {
      id: String(post.id || post._id || `post-${Date.now()}-${index}`),
      slug: slugify(post.slug || title),
      title,
      category: String(post.category || 'Champion').trim(),
      author: String(post.author || 'Equipe Champion').trim(),
      date: post.date || new Date().toISOString().slice(0, 10),
      image: String(post.image || defaultConfig.heroImage).trim(),
      status: post.status === 'draft' ? 'draft' : 'published',
      excerpt: String(post.excerpt || '').trim(),
      content: String(post.content || '').trim(),
      template,
      gallery,
      steps
    };
  }

  function sortPosts(posts) {
    return posts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function publishedOnly(posts) {
    return sortPosts(posts.map(normalizePost).filter((post) => post.status === 'published'));
  }

  function formatDate(value) {
    const date = new Date(`${value || new Date().toISOString().slice(0, 10)}T12:00:00`);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function readingTime(content) {
    const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 180))} min de leitura`;
  }

  function arrowIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
  }

  function postUrl(post) {
    return `blog.html?post=${encodeURIComponent(post.slug)}`;
  }

  function renderContent(raw) {
    const blocks = String(raw || '')
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks.map((block) => {
      if (/^###\s+/.test(block)) {
        return `<h3>${escapeHtml(block.replace(/^###\s+/, ''))}</h3>`;
      }

      if (/^##\s+/.test(block)) {
        return `<h2>${escapeHtml(block.replace(/^##\s+/, ''))}</h2>`;
      }

      if (/^>\s+/.test(block)) {
        return `<blockquote>${escapeHtml(block.replace(/^>\s+/, ''))}</blockquote>`;
      }

      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length && lines.every((line) => line.startsWith('- '))) {
        return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^-+\s*/, ''))}</li>`).join('')}</ul>`;
      }

      return `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  function isFirebaseConfigured(config) {
    const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every((field) => {
      const value = String(config?.[field] || '').trim();
      return value && !/cole|your-|seu-|placeholder|firebase-config/i.test(value);
    });
  }

  class LocalBlogStore {
    constructor() {
      this.mode = 'local';
      this.isFirebase = false;
    }

    async getConfig() {
      return Object.assign({}, defaultConfig, readJson(CONFIG_KEY, defaultConfig));
    }

    async saveConfig(config) {
      writeJson(CONFIG_KEY, Object.assign({}, defaultConfig, config));
    }

    async getAllPosts() {
      return sortPosts(readJson(POSTS_KEY, defaultPosts).map(normalizePost));
    }

    async getPublishedPosts() {
      return publishedOnly(await this.getAllPosts());
    }

    async savePost(post) {
      const posts = await this.getAllPosts();
      const normalized = normalizePost(post);
      const existingIndex = posts.findIndex((item) => item.id === normalized.id);
      if (existingIndex >= 0) posts[existingIndex] = normalized;
      else posts.unshift(normalized);
      writeJson(POSTS_KEY, posts.map(normalizePost));
      return normalized;
    }

    async deletePost(id) {
      const posts = await this.getAllPosts();
      writeJson(POSTS_KEY, posts.filter((post) => post.id !== id));
    }

    async seedDefaults() {
      writeJson(POSTS_KEY, clone(defaultPosts));
      writeJson(CONFIG_KEY, clone(defaultConfig));
    }

    isAdminLogged() {
      try {
        const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || 'null');
        return Boolean(session?.loggedAt);
      } catch {
        return false;
      }
    }

    async login(email, password) {
      const user = String(email || '').trim().toLowerCase();
      if (user !== LOCAL_ADMIN_USER || password !== LOCAL_ADMIN_PASSWORD) {
        throw new Error('Login ou senha incorretos.');
      }
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ user, loggedAt: new Date().toISOString() }));
    }

    async logout() {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  class FirebaseBlogStore {
    constructor(modules) {
      this.mode = 'firebase';
      this.isFirebase = true;
      this.app = modules.app;
      this.auth = modules.auth;
      this.db = modules.db;
      this.api = modules.api;
      this.collections = Object.assign({}, CHAMPION_BLOG_FIREBASE);
    }

    configRef() {
      return this.api.doc(this.db, this.collections.configCollection, this.collections.configDoc);
    }

    postRef(id) {
      return this.api.doc(this.db, this.collections.postsCollection, id);
    }

    adminRef(uid) {
      return this.api.doc(this.db, this.collections.adminsCollection, uid);
    }

    async getConfig() {
      const snapshot = await this.api.getDoc(this.configRef());
      return Object.assign({}, defaultConfig, snapshot.exists() ? snapshot.data() : {});
    }

    async saveConfig(config) {
      await this.api.setDoc(this.configRef(), {
        title: String(config.title || defaultConfig.title).trim(),
        subtitle: String(config.subtitle || defaultConfig.subtitle).trim(),
        heroImage: String(config.heroImage || defaultConfig.heroImage).trim(),
        featuredSlug: String(config.featuredSlug || defaultConfig.featuredSlug).trim(),
        updatedAt: this.api.serverTimestamp()
      }, { merge: true });
    }

    docsToPosts(snapshot) {
      return snapshot.docs.map((item, index) => normalizePost(Object.assign({ id: item.id }, item.data()), index));
    }

    async getAllPosts() {
      const snapshot = await this.api.getDocs(this.api.collection(this.db, this.collections.postsCollection));
      return sortPosts(this.docsToPosts(snapshot));
    }

    async getPublishedPosts() {
      const postsQuery = this.api.query(
        this.api.collection(this.db, this.collections.postsCollection),
        this.api.where('status', '==', 'published')
      );
      const snapshot = await this.api.getDocs(postsQuery);
      return publishedOnly(this.docsToPosts(snapshot));
    }

    async savePost(post) {
      const normalized = normalizePost(post);
      await this.api.setDoc(this.postRef(normalized.id), Object.assign({}, normalized, {
        updatedAt: this.api.serverTimestamp()
      }), { merge: true });
      return normalized;
    }

    async deletePost(id) {
      await this.api.deleteDoc(this.postRef(id));
    }

    async seedDefaults() {
      const batch = this.api.writeBatch(this.db);
      defaultPosts.map(normalizePost).forEach((post) => {
        batch.set(this.postRef(post.id), Object.assign({}, post, {
          updatedAt: this.api.serverTimestamp()
        }), { merge: true });
      });
      batch.set(this.configRef(), Object.assign({}, defaultConfig, {
        updatedAt: this.api.serverTimestamp()
      }), { merge: true });
      await batch.commit();
    }

    async isAdminUser(user) {
      if (!user) return false;
      const snapshot = await this.api.getDoc(this.adminRef(user.uid));
      return Boolean(snapshot.exists() && snapshot.data()?.active === true);
    }

    isAdminLogged() {
      return Boolean(this.auth.currentUser);
    }

    async login(email, password) {
      const credential = await this.api.signInWithEmailAndPassword(
        this.auth,
        String(email || '').trim().toLowerCase(),
        password
      );
      const isAdmin = await this.isAdminUser(credential.user);
      if (!isAdmin) {
        await this.logout();
        throw new Error('Usuário autenticado, mas sem permissão de administrador do blog.');
      }
    }

    async logout() {
      await this.api.signOut(this.auth);
    }

    onAuthChanged(callback) {
      return this.api.onAuthStateChanged(this.auth, async (user) => {
        const isAdmin = user ? await this.isAdminUser(user).catch(() => false) : false;
        callback(Boolean(user && isAdmin), user);
      });
    }
  }

  async function createFirebaseStore() {
    if (!isFirebaseConfigured(CHAMPION_FIREBASE_CONFIG)) return null;

    const version = CHAMPION_BLOG_FIREBASE.sdkVersion || '12.12.0';
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);

    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CHAMPION_FIREBASE_CONFIG);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);

    return new FirebaseBlogStore({
      app,
      auth,
      db,
      api: Object.assign({}, authModule, firestoreModule)
    });
  }

  let store = new LocalBlogStore();
  try {
    store = await createFirebaseStore() || store;
  } catch (error) {
    console.error('Firebase não inicializado. O blog continuará em modo local.', error);
  }

  function setFeedback(target, message, type = 'error') {
    if (!target) return;
    target.textContent = message || '';
    target.classList.toggle('is-success', type === 'success');
  }

  function showBusy(form, busy, label = 'Salvando...') {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) button.dataset.previousHtml = button.innerHTML;
    button.disabled = busy;
    if (busy) {
      const labelNode = button.querySelector('span') || button;
      labelNode.textContent = label;
      return;
    }
    if (button.dataset.previousHtml) {
      button.innerHTML = button.dataset.previousHtml;
    }
    delete button.dataset.previousHtml;
  }

  function renderFeatured(post, target) {
    if (!post || !target) return;
    target.innerHTML = `
      <div class="blog-featured-media">
        <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />
      </div>
      <div class="blog-featured-body">
        <span class="blog-kicker">${escapeHtml(post.category)}</span>
        <div class="blog-meta">
          <span>${escapeHtml(formatDate(post.date))}</span>
          <span>${escapeHtml(readingTime(post.content))}</span>
        </div>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.excerpt)}</p>
        <a class="blog-featured-link" href="${postUrl(post)}">Ler artigo ${arrowIcon()}</a>
      </div>
    `;
  }

  function renderPostCard(post) {
    return `
      <article class="blog-card">
        <a class="blog-card-media" href="${postUrl(post)}" aria-label="${escapeHtml(post.title)}">
          <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />
        </a>
        <div class="blog-card-body">
          <span class="blog-tag">${escapeHtml(post.category)}</span>
          <div class="blog-meta">
            <span>${escapeHtml(formatDate(post.date))}</span>
            <span>${escapeHtml(readingTime(post.content))}</span>
          </div>
          <h3><a href="${postUrl(post)}">${escapeHtml(post.title)}</a></h3>
          <p>${escapeHtml(post.excerpt)}</p>
          <a class="blog-card-link" href="${postUrl(post)}">Continuar ${arrowIcon()}</a>
        </div>
      </article>
    `;
  }

  function applyBlogConfig(config) {
    $$('[data-blog-config="title"]').forEach((node) => { node.textContent = config.title; });
    $$('[data-blog-config="subtitle"]').forEach((node) => { node.textContent = config.subtitle; });
    $$('[data-blog-hero-img]').forEach((img) => {
      img.src = config.heroImage || defaultConfig.heroImage;
      img.alt = config.title || 'Blog Champion';
    });
  }

  function renderSidebar(posts) {
    const latest = $('#blogLatest');
    const categories = $('#blogCategories');
    if (latest) {
      latest.innerHTML = posts.slice(0, 4).map((post) => `
        <a href="${postUrl(post)}">
          <strong>${escapeHtml(post.title)}</strong>
          <p>${escapeHtml(formatDate(post.date))} · ${escapeHtml(post.category)}</p>
        </a>
      `).join('');
    }

    if (categories) {
      const counts = posts.reduce((acc, post) => {
        acc[post.category] = (acc[post.category] || 0) + 1;
        return acc;
      }, {});
      categories.innerHTML = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `
        <a href="blog.html?categoria=${encodeURIComponent(name)}">
          <strong>${escapeHtml(name)}</strong>
          <p>${count} artigo${count === 1 ? '' : 's'}</p>
        </a>
      `).join('');
    }
  }

  function renderBlogList(posts, config) {
    const listView = $('[data-blog-list-view]');
    const detailView = $('[data-blog-detail-view]');
    if (!listView) return;

    const params = new URLSearchParams(window.location.search);
    const activeFromUrl = params.get('categoria') || '';
    const state = {
      search: '',
      category: activeFromUrl
    };

    const searchInput = $('#blogSearch');
    const filterRow = $('#blogFilters');
    const featured = $('#blogFeatured');
    const grid = $('#blogGrid');
    const empty = $('#blogEmpty');
    const count = $('#blogCount');

    if (detailView) detailView.hidden = true;
    listView.hidden = false;

    const categories = Array.from(new Set(posts.map((post) => post.category))).sort((a, b) => a.localeCompare(b));
    if (filterRow) {
      filterRow.innerHTML = [
        '<button class="blog-filter" type="button" data-category="">Todos</button>',
        ...categories.map((category) => `<button class="blog-filter" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
      ].join('');
    }

    function draw() {
      const term = state.search.trim().toLowerCase();
      const results = posts.filter((post) => {
        const haystack = `${post.title} ${post.excerpt} ${post.category} ${post.content}`.toLowerCase();
        return (!term || haystack.includes(term)) && (!state.category || post.category === state.category);
      });

      const featuredPost = posts.find((post) => post.slug === config.featuredSlug) || posts[0];
      const showFeatured = Boolean(featuredPost && !state.search && !state.category);
      if (featured) {
        featured.hidden = !showFeatured;
        if (showFeatured) renderFeatured(featuredPost, featured);
      }

      const cardPosts = showFeatured ? results.filter((post) => post.slug !== featuredPost.slug) : results;
      if (grid) grid.innerHTML = cardPosts.map(renderPostCard).join('');
      if (empty) {
        empty.textContent = 'Nenhum artigo encontrado para esta busca.';
        empty.hidden = results.length > 0;
      }
      if (count) count.textContent = `${results.length} artigo${results.length === 1 ? '' : 's'}`;

      $$('.blog-filter', filterRow || document).forEach((button) => {
        const active = button.dataset.category === state.category;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    searchInput?.addEventListener('input', (event) => {
      state.search = event.target.value;
      draw();
    }, { once: false });

    filterRow?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.category = button.dataset.category || '';
      draw();
    }, { once: false });

    renderSidebar(posts);
    draw();
  }

  function renderBlogDetail(slug, posts) {
    const listView = $('[data-blog-list-view]');
    const detailView = $('[data-blog-detail-view]');
    const article = $('#blogArticle');
    if (!detailView || !article) return;

    const post = posts.find((item) => item.slug === slug);
    if (listView) listView.hidden = true;
    detailView.hidden = false;

    if (!post) {
      article.innerHTML = `
        <div class="blog-article-head">
          <span class="blog-kicker">Blog</span>
          <h1>Artigo não encontrado</h1>
          <p>O conteúdo pode ter sido removido ou ainda estar como rascunho.</p>
          <a class="blog-card-link" href="blog.html">Voltar para o blog ${arrowIcon()}</a>
        </div>
      `;
      return;
    }

    document.title = `${post.title} · Blog Champion`;
    article.innerHTML = `
      <div class="blog-article-head">
        <span class="blog-kicker">${escapeHtml(post.category)}</span>
        <div class="blog-meta">
          <span>${escapeHtml(formatDate(post.date))}</span>
          <span>${escapeHtml(readingTime(post.content))}</span>
          <span>${escapeHtml(post.author)}</span>
        </div>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
      <div class="blog-article-hero">
        <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />
      </div>
      <div class="blog-article-content blog-template-${escapeHtml(post.template || 'standard')}">
        ${renderTemplate(post)}
      </div>
    `;
  }

  function renderTemplate(post) {
    if (post.template === 'gallery' && Array.isArray(post.gallery) && post.gallery.length) {
      return `
        ${renderContent(post.content)}
        <div class="blog-gallery">
          ${post.gallery.map((g) => `
            <figure class="blog-gallery-item">
              <img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.caption || '')}" loading="lazy" />
              ${g.caption ? `<figcaption>${escapeHtml(g.caption)}</figcaption>` : ''}
            </figure>
          `).join('')}
        </div>
      `;
    }
    if (post.template === 'tutorial' && Array.isArray(post.steps) && post.steps.length) {
      return `
        ${renderContent(post.content)}
        <ol class="blog-steps">
          ${post.steps.map((s, i) => `
            <li class="blog-step">
              <div class="blog-step-num">${i + 1}</div>
              <div class="blog-step-body">
                ${s.title ? `<h3>${escapeHtml(s.title)}</h3>` : ''}
                ${s.image ? `<img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.title || '')}" loading="lazy" />` : ''}
                ${s.description ? `<p>${escapeHtml(s.description).replace(/\n/g, '<br>')}</p>` : ''}
              </div>
            </li>
          `).join('')}
        </ol>
      `;
    }
    return renderContent(post.content);
  }

  async function initBlogPage() {
    if (!$('[data-blog-page]')) return;
    const grid = $('#blogGrid');
    const count = $('#blogCount');
    const empty = $('#blogEmpty');
    if (grid) grid.innerHTML = '<div class="blog-empty">Carregando artigos...</div>';
    if (count) count.textContent = 'Carregando';

    try {
      const [config, posts] = await Promise.all([
        store.getConfig(),
        store.getPublishedPosts()
      ]);
      applyBlogConfig(config);

      const slug = new URLSearchParams(window.location.search).get('post');
      if (slug) renderBlogDetail(slug, posts);
      else renderBlogList(posts, config);
    } catch (error) {
      console.error(error);
      if (grid) grid.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Não foi possível carregar o blog agora. Tente novamente em alguns instantes.';
      }
      if (count) count.textContent = '0 artigos';
    }
  }

  function ensureUniqueSlug(slug, id, posts) {
    const base = slugify(slug);
    let candidate = base;
    let index = 2;
    while (posts.some((post) => post.id !== id && post.slug === candidate)) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    return candidate;
  }

  async function fillConfigForm() {
    const form = $('#blogConfigForm');
    const select = $('#blogFeaturedSelect');
    if (!form) return;

    const [config, posts] = await Promise.all([
      store.getConfig(),
      store.getAllPosts()
    ]);
    form.elements.title.value = config.title;
    form.elements.subtitle.value = config.subtitle;
    form.elements.heroImage.value = config.heroImage;

    if (select) {
      select.innerHTML = posts.map((post) => `
        <option value="${escapeHtml(post.slug)}">${escapeHtml(post.title)}</option>
      `).join('');
      select.value = config.featuredSlug;
    }
  }

  function applyTemplate(template) {
    const form = $('#blogPostForm');
    if (!form) return;
    const valid = ['standard', 'gallery', 'tutorial'];
    const t = valid.includes(template) ? template : 'standard';
    if (form.elements.template) form.elements.template.value = t;

    document.querySelectorAll('.bp-template').forEach((card) => {
      const isActive = card.getAttribute('data-template') === t;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('[data-show-for]').forEach((field) => {
      const allow = String(field.getAttribute('data-show-for') || '').split(',').map((s) => s.trim());
      field.hidden = !allow.includes(t);
    });
  }

  function renderGalleryRows(items = []) {
    const wrap = $('#blogGalleryRows');
    if (!wrap) return;
    wrap.innerHTML = items.map((g, i) => `
      <div class="bp-row" data-gallery-row>
        <div class="bp-row-head"><span>Foto ${i + 1}</span><button type="button" data-remove-gallery>Remover</button></div>
        <div class="bp-form-field"><label>URL ou caminho da imagem</label><input data-g-image type="text" value="${escapeHtml(g.image || '')}" placeholder="assets/img/posts/foto.jpg" /></div>
        <div class="bp-form-field"><label>Legenda (opcional)</label><input data-g-caption type="text" value="${escapeHtml(g.caption || '')}" /></div>
      </div>
    `).join('');
  }

  function renderStepsRows(items = []) {
    const wrap = $('#blogStepsRows');
    if (!wrap) return;
    wrap.innerHTML = items.map((s, i) => `
      <div class="bp-row" data-step-row>
        <div class="bp-row-head"><span>Passo ${i + 1}</span><button type="button" data-remove-step>Remover</button></div>
        <div class="bp-form-field"><label>Título do passo</label><input data-s-title type="text" value="${escapeHtml(s.title || '')}" placeholder="Ex.: Preparação do cocho" /></div>
        <div class="bp-form-field"><label>Imagem (opcional)</label><input data-s-image type="text" value="${escapeHtml(s.image || '')}" placeholder="assets/img/posts/passo.jpg" /></div>
        <div class="bp-form-field"><label>Descrição</label><textarea data-s-description rows="2">${escapeHtml(s.description || '')}</textarea></div>
      </div>
    `).join('');
  }

  function collectGalleryFromForm() {
    return Array.from(document.querySelectorAll('[data-gallery-row]')).map((row) => ({
      image: row.querySelector('[data-g-image]')?.value || '',
      caption: row.querySelector('[data-g-caption]')?.value || ''
    }));
  }

  function collectStepsFromForm() {
    return Array.from(document.querySelectorAll('[data-step-row]')).map((row) => ({
      title: row.querySelector('[data-s-title]')?.value || '',
      image: row.querySelector('[data-s-image]')?.value || '',
      description: row.querySelector('[data-s-description]')?.value || ''
    }));
  }

  function resetPostForm() {
    const form = $('#blogPostForm');
    if (!form) return;
    form.reset();
    form.dataset.slugEdited = 'false';
    form.elements.id.value = '';
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    form.elements.author.value = 'Equipe Champion';
    form.elements.status.value = 'published';
    form.elements.image.value = 'assets/img/about/pecuarista.jpg';
    applyTemplate('standard');
    renderGalleryRows([]);
    renderStepsRows([]);
    $('#blogPostSubmitLabel').textContent = 'Publicar post';
    setFeedback($('#blogPostFeedback'), '');
  }

  function fillPostForm(post) {
    const form = $('#blogPostForm');
    if (!form || !post) return;
    form.dataset.slugEdited = 'true';
    form.elements.id.value = post.id;
    form.elements.title.value = post.title;
    form.elements.slug.value = post.slug;
    form.elements.category.value = post.category;
    form.elements.author.value = post.author;
    form.elements.date.value = post.date;
    form.elements.image.value = post.image;
    form.elements.status.value = post.status;
    form.elements.excerpt.value = post.excerpt;
    form.elements.content.value = post.content || '';
    applyTemplate(post.template || 'standard');
    renderGalleryRows(post.gallery || []);
    renderStepsRows(post.steps || []);
    $('#blogPostSubmitLabel').textContent = 'Salvar alterações';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function renderAdminPostList() {
    const list = $('#blogAdminPostList');
    if (!list) return;
    const posts = await store.getAllPosts();

    if (!posts.length) {
      list.innerHTML = '<div class="blog-empty">Nenhum post cadastrado.</div>';
      return;
    }

    list.innerHTML = posts.map((post) => `
      <article class="blog-admin-post">
        <img src="${escapeHtml(post.image)}" alt="" loading="lazy" />
        <div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(formatDate(post.date))} · ${escapeHtml(post.category)}</p>
          <span class="blog-admin-status${post.status === 'draft' ? ' is-draft' : ''}">${post.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
        </div>
        <div class="blog-admin-post-actions">
          <button class="blog-admin-mini" type="button" data-edit-post="${escapeHtml(post.id)}">Editar</button>
          <button class="blog-admin-mini is-danger" type="button" data-delete-post="${escapeHtml(post.id)}">Excluir</button>
        </div>
      </article>
    `).join('');
  }

  async function renderAdmin() {
    await fillConfigForm();
    await renderAdminPostList();
    resetPostForm();
  }

  function updateAdminNote() {
    const note = $('.blog-admin-note');
    if (!note) return;
    if (store.isFirebase) {
      note.textContent = 'Login via Firebase Authentication. Libere o usuário criando blogAdmins/{uid} com active: true no Firestore.';
      return;
    }
    note.textContent = 'Modo local de desenvolvimento: admin@champion.com.br · Champion@2026. Configure o Firebase para ativar o painel real.';
  }

  let blogAppEverLoaded = false;

  async function syncAdminAuth(isLogged = store.isAdminLogged()) {
    if (!isLogged) {
      if (blogAppEverLoaded) {
        window.location.replace('login-blog.html');
        return;
      }
      const login = $('[data-blog-admin-login]');
      const app = $('[data-blog-admin-app]');
      if (login) login.hidden = false;
      if (app) app.hidden = true;
      return;
    }
    blogAppEverLoaded = true;
    const login = $('[data-blog-admin-login]');
    const app = $('[data-blog-admin-app]');
    if (login) login.hidden = true;
    if (app) app.hidden = false;
    await renderAdmin();
  }

  function friendlyFirebaseError(error) {
    const code = String(error?.code || '');
    if (code.includes('auth/invalid-credential') || code.includes('auth/user-not-found') || code.includes('auth/wrong-password')) {
      return 'Login ou senha incorretos.';
    }
    if (code.includes('auth/too-many-requests')) {
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    }
    if (code.includes('permission-denied')) {
      return 'Sem permissão para acessar ou salvar esses dados no Firebase.';
    }
    return error?.message || 'Não foi possível concluir a ação.';
  }

  function initAdminEvents() {
    const loginForm = $('#blogAdminLoginForm');
    const loginFeedback = $('#blogLoginFeedback');
    const configForm = $('#blogConfigForm');
    const configFeedback = $('#blogConfigFeedback');
    const postForm = $('#blogPostForm');
    const postFeedback = $('#blogPostFeedback');

    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(loginFeedback, '');
      showBusy(loginForm, true, 'Entrando...');
      try {
        await store.login(loginForm.elements.email.value, loginForm.elements.password.value);
        await syncAdminAuth(true);
        window.ChampionToast?.('Painel do blog acessado.');
      } catch (error) {
        setFeedback(loginFeedback, friendlyFirebaseError(error));
      } finally {
        showBusy(loginForm, false);
      }
    });

    const handleLogout = async () => {
      await store.logout();
      await syncAdminAuth(false);
    };
    $('#blogAdminLogout')?.addEventListener('click', handleLogout);
    $('#blogAdminLogout2')?.addEventListener('click', handleLogout);

    $('#blogSeedDefaults')?.addEventListener('click', async () => {
      if (!window.confirm('Restaurar posts e configurações iniciais do blog?')) return;
      try {
        await store.seedDefaults();
        await renderAdmin();
        window.ChampionToast?.('Blog restaurado.');
      } catch (error) {
        setFeedback(configFeedback, friendlyFirebaseError(error));
      }
    });

    configForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(configForm).entries());
      showBusy(configForm, true);
      try {
        await store.saveConfig({
          title: data.title,
          subtitle: data.subtitle,
          heroImage: data.heroImage,
          featuredSlug: data.featuredSlug
        });
        setFeedback(configFeedback, 'Configurações salvas.', 'success');
        window.setTimeout(() => setFeedback(configFeedback, ''), 2200);
      } catch (error) {
        setFeedback(configFeedback, friendlyFirebaseError(error));
      } finally {
        showBusy(configForm, false);
      }
    });

    postForm?.elements.slug?.addEventListener('input', () => {
      postForm.dataset.slugEdited = 'true';
    });

    postForm?.elements.title?.addEventListener('input', () => {
      if (!postForm.elements.id.value && postForm.dataset.slugEdited !== 'true') {
        postForm.elements.slug.value = slugify(postForm.elements.title.value);
      }
    });

    $('#blogNewPost')?.addEventListener('click', resetPostForm);

    postForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!postForm.reportValidity()) return;

      showBusy(postForm, true);
      let savedPost = null;
      try {
        const posts = await store.getAllPosts();
        const data = Object.fromEntries(new FormData(postForm).entries());
        const id = data.id || `post-${Date.now()}`;
        const post = normalizePost({
          id,
          slug: ensureUniqueSlug(data.slug || data.title, id, posts),
          title: data.title,
          category: data.category,
          author: data.author,
          date: data.date,
          image: data.image,
          status: data.status,
          excerpt: data.excerpt,
          content: data.content,
          template: data.template || 'standard',
          gallery: collectGalleryFromForm(),
          steps: collectStepsFromForm()
        });

        savedPost = await store.savePost(post);
        await renderAdminPostList();
        await fillConfigForm();
        setFeedback(postFeedback, 'Post salvo com sucesso.', 'success');
        window.ChampionToast?.('Post salvo.');
      } catch (error) {
        setFeedback(postFeedback, friendlyFirebaseError(error));
      } finally {
        showBusy(postForm, false);
      }

      if (savedPost) fillPostForm(savedPost);
    });

    $('#blogAdminPostList')?.addEventListener('click', async (event) => {
      const editButton = event.target.closest('[data-edit-post]');
      const deleteButton = event.target.closest('[data-delete-post]');
      const posts = await store.getAllPosts();

      if (editButton) {
        const post = posts.find((item) => item.id === editButton.dataset.editPost);
        fillPostForm(post);
      }

      if (deleteButton) {
        const id = deleteButton.dataset.deletePost;
        const post = posts.find((item) => item.id === id);
        if (!post || !window.confirm(`Excluir "${post.title}"?`)) return;
        try {
          await store.deletePost(id);
          await renderAdmin();
          window.ChampionToast?.('Post excluído.');
        } catch (error) {
          setFeedback(postFeedback, friendlyFirebaseError(error));
        }
      }
    });
  }

  async function initAdminPage() {
    if (!$('[data-blog-admin-page]')) return;
    updateAdminNote();
    initAdminEvents();

    if (store.isFirebase) {
      store.onAuthChanged((logged) => {
        syncAdminAuth(logged);
      });
      return;
    }

    await syncAdminAuth();
  }

  await initBlogPage();
  await initAdminPage();

  window.ChampionBlog = {
    mode: store.mode,
    getPosts: () => store.getAllPosts(),
    getPublishedPosts: () => store.getPublishedPosts(),
    savePost: (post) => store.savePost(post),
    deletePost: (id) => store.deletePost(id),
    getConfig: () => store.getConfig(),
    saveConfig: (config) => store.saveConfig(config),
    seedDefaults: () => store.seedDefaults()
  };
})();
