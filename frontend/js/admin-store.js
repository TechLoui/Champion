import { CHAMPION_BLOG_FIREBASE, CHAMPION_FIREBASE_CONFIG } from './firebase-config.js';
import { DEFAULT_PRODUCTS, normalizeProduct, sortProducts } from './product-data.js';

const LOCAL_BANNERS_KEY = 'champion-admin-banners';

/* Páginas que podem ter banners gerenciáveis */
const VALID_BANNER_PAGES = ['home', 'produtos', 'blog', 'sobre', 'calculo-dose'];
const VALID_BANNER_ASPECTS = ['21/9', '16/9', '16/7', '4/3', '3/2'];

const DEFAULT_BANNERS = [
  {
    id: 'banner-home-1', page: 'home', aspect: '21/9', transitionMs: 6000,
    slides: [
      { image: 'assets/img/hero/hero-1.png', eyebrow: 'Linha Difly', title: 'Proteção completa para o gado', subtitle: 'Controle da mosca-dos-chifres direto na origem.', link: 'produtos.html', cta: 'Ver produtos' },
      { image: 'assets/img/hero/hero-2.png', eyebrow: 'Linha Núcleo', title: 'Mais lucratividade na sua propriedade', subtitle: 'Nutrição mineral completa para bovinos.', link: 'produtos.html', cta: 'Ver linha' },
      { image: 'assets/img/hero/hero-3.png', eyebrow: 'VER-MI-SAL', title: 'Concentrado de microminerais', subtitle: 'Vermifugação contínua + mineralização no cocho.', link: 'produto.html?p=ver-mi-sal', cta: 'Conhecer' }
    ],
    status: 'published', order: 1
  }
];

function normalizeSlide(slide = {}) {
  return {
    image: String(slide.image || '').trim(),
    imageMobile: String(slide.imageMobile || '').trim(),
    eyebrow: String(slide.eyebrow || '').trim(),
    title: String(slide.title || '').trim(),
    subtitle: String(slide.subtitle || '').trim(),
    link: String(slide.link || '').trim(),
    cta: String(slide.cta || '').trim()
  };
}

function normalizeBanner(banner = {}, index = 0) {
  /* Compatibilidade: banner legado (sem slides[]) vira slides[0] */
  let slides = Array.isArray(banner.slides) ? banner.slides : null;
  if (!slides) {
    slides = [{
      image: banner.image || '',
      imageMobile: banner.imageMobile || '',
      eyebrow: banner.label || '',
      title: '',
      subtitle: '',
      link: banner.link || '',
      cta: ''
    }];
  }
  /* Limita a 5 slides */
  slides = slides.slice(0, 5).map(normalizeSlide);

  const page = VALID_BANNER_PAGES.includes(banner.page) ? banner.page : 'home';
  const aspect = VALID_BANNER_ASPECTS.includes(banner.aspect) ? banner.aspect : '16/9';
  let transitionMs = Number(banner.transitionMs);
  if (!Number.isFinite(transitionMs) || transitionMs < 2000) transitionMs = 6000;

  return {
    id: String(banner.id || `banner-${Date.now()}-${index}`),
    page,
    aspect,
    transitionMs,
    slides,
    /* Campos legados mantidos para retrocompatibilidade no front público */
    image: slides[0] ? slides[0].image : '',
    imageMobile: slides[0] ? slides[0].imageMobile : '',
    link: slides[0] ? slides[0].link : '',
    alt: String(banner.alt || (slides[0] && slides[0].title) || '').trim(),
    label: String(banner.label || (slides[0] && slides[0].eyebrow) || `Banner ${index + 1}`).trim(),
    status: banner.status === 'draft' ? 'draft' : 'published',
    order: Number.isFinite(Number(banner.order)) ? Number(banner.order) : index + 1
  };
}

const LOCAL_ADMIN_USER = 'admin@champion.com.br';
const LOCAL_ADMIN_PASSWORD = 'Champion@2026';
const LOCAL_SESSION_KEY = 'champion-admin-session';
const LOCAL_PRODUCTS_KEY = 'champion-admin-products';
const LOCAL_SETTINGS_KEY = 'champion-admin-settings';
const LOCAL_LEADS_KEY = 'champion-admin-leads';
const LOCAL_TAXONOMY_KEY = 'champion-admin-taxonomy';

const DEFAULT_TAXONOMY = {
  groups: [
    { slug: 'larvicida',     name: 'Larvicida',      order: 1 },
    { slug: 'inseticida',    name: 'Inseticida',     order: 2 },
    { slug: 'vermifugo',     name: 'Vermífugo',      order: 3 },
    { slug: 'mineralizacao', name: 'Mineralização',  order: 4 },
    { slug: 'nutricao',      name: 'Nutrição',       order: 5 },
    { slug: 'reproducao',    name: 'Reprodução',     order: 6 },
    { slug: 'parasitario',   name: 'Antiparasitário',order: 7 },
    { slug: 'suplemento',    name: 'Suplemento',     order: 8 }
  ],
  species: [
    { slug: 'bovinos',     name: 'Bovinos',         order: 1 },
    { slug: 'equinos',     name: 'Equinos',         order: 2 },
    { slug: 'suinos',      name: 'Suínos',          order: 3 },
    { slug: 'aves',        name: 'Aves',            order: 4 },
    { slug: 'ambientes',   name: 'Ambientes',       order: 5 },
    { slug: 'veterinario', name: 'Uso veterinário', order: 6 },
    { slug: 'minerais',    name: 'Minerais',        order: 7 }
  ],
  uses: [
    { slug: 'sal-racao',     name: 'Mistura no sal/ração', order: 1 },
    { slug: 'dieta-premix',  name: 'Pré-mix / formulação', order: 2 },
    { slug: 'pulverizacao',  name: 'Pulverização',         order: 3 },
    { slug: 'po-topico',     name: 'Aplicação em pó',      order: 4 },
    { slug: 'agua-parada',   name: 'Água parada',          order: 5 }
  ]
};

function normalizeTaxonomy(tax) {
  const t = tax && typeof tax === 'object' ? tax : {};
  const normalizeList = (list, fallback) => {
    if (!Array.isArray(list)) return fallback;
    const cleaned = list
      .map((item, i) => ({
        slug: String(item.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        name: String(item.name || '').trim(),
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : i + 1
      }))
      .filter((it) => it.slug && it.name)
      .sort((a, b) => a.order - b.order);
    return cleaned.length ? cleaned : fallback;
  };
  return {
    groups: normalizeList(t.groups, DEFAULT_TAXONOMY.groups),
    species: normalizeList(t.species, DEFAULT_TAXONOMY.species),
    uses: normalizeList(t.uses, DEFAULT_TAXONOMY.uses)
  };
}
const LOCAL_BLOG_POSTS_KEY = 'champion-blog-posts';
const LOCAL_BLOG_CONFIG_KEY = 'champion-blog-config';

const DEFAULT_SETTINGS = {
  promoText: 'FRETE GRÁTIS para pedidos acima de R$ 500',
  phone: '0800 723 1616',
  email: 'contato@champion.ind.br',
  whatsapp: '556240150742',
  updatedAt: ''
};

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

function isFirebaseConfigured(config) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return required.every((field) => {
    const value = String(config?.[field] || '').trim();
    return value && !/cole|your-|seu-|placeholder|firebase-config/i.test(value);
  });
}

function normalizeLead(lead = {}, index = 0) {
  return {
    id: String(lead.id || `lead-${Date.now()}-${index}`),
    name: String(lead.name || '').trim(),
    email: String(lead.email || '').trim(),
    phone: String(lead.phone || '').trim(),
    message: String(lead.message || '').trim(),
    source: String(lead.source || 'Site').trim(),
    status: lead.status === 'done' ? 'done' : 'open',
    createdAt: lead.createdAt || new Date().toISOString()
  };
}

class LocalAdminStore {
  constructor() {
    this.mode = 'local';
    this.isFirebase = false;
  }

  isAdminLogged() {
    try {
      const session = JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || 'null');
      return Boolean(session?.loggedAt);
    } catch {
      return false;
    }
  }

  async login(email, password) {
    const user = String(email || '').trim().toLowerCase();
    const pass = String(password || '').trim();
    if (user !== LOCAL_ADMIN_USER || pass !== LOCAL_ADMIN_PASSWORD) {
      throw new Error('Login ou senha incorretos.');
    }
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ user, loggedAt: new Date().toISOString() }));
  }

  async logout() {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }

  onAuthChanged(callback) {
    callback(this.isAdminLogged(), null);
    return () => {};
  }

  async getProducts({ includeDrafts = true } = {}) {
    const products = readJson(LOCAL_PRODUCTS_KEY, DEFAULT_PRODUCTS).map(normalizeProduct);
    const filtered = includeDrafts ? products : products.filter((product) => product.status === 'published');
    return sortProducts(filtered);
  }

  async saveProduct(product) {
    const products = await this.getProducts();
    const normalized = normalizeProduct(product, products.length);
    const index = products.findIndex((item) => item.id === normalized.id);
    if (index >= 0) products[index] = normalized;
    else products.push(normalized);
    writeJson(LOCAL_PRODUCTS_KEY, sortProducts(products));
    return normalized;
  }

  async deleteProduct(id) {
    const products = await this.getProducts();
    writeJson(LOCAL_PRODUCTS_KEY, products.filter((product) => product.id !== id));
  }

  async seedProducts() {
    writeJson(LOCAL_PRODUCTS_KEY, clone(DEFAULT_PRODUCTS));
  }

  async getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJson(LOCAL_SETTINGS_KEY, DEFAULT_SETTINGS));
  }

  async saveSettings(settings) {
    writeJson(LOCAL_SETTINGS_KEY, Object.assign({}, DEFAULT_SETTINGS, settings, {
      updatedAt: new Date().toISOString()
    }));
  }

  async getLeads() {
    return readJson(LOCAL_LEADS_KEY, []).map(normalizeLead).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async saveLead(lead) {
    const leads = await this.getLeads();
    const normalized = normalizeLead(lead, leads.length);
    const index = leads.findIndex((item) => item.id === normalized.id);
    if (index >= 0) leads[index] = normalized;
    else leads.unshift(normalized);
    writeJson(LOCAL_LEADS_KEY, leads);
    return normalized;
  }

  async deleteLead(id) {
    const leads = await this.getLeads();
    writeJson(LOCAL_LEADS_KEY, leads.filter((lead) => lead.id !== id));
  }

  async getBanners() {
    const stored = readJson(LOCAL_BANNERS_KEY, null);
    return (stored || DEFAULT_BANNERS).map(normalizeBanner).sort((a, b) => a.order - b.order);
  }

  async saveBanner(banner) {
    const banners = await this.getBanners();
    const normalized = normalizeBanner(banner, banners.length);
    const index = banners.findIndex((item) => item.id === normalized.id);
    if (index >= 0) banners[index] = normalized;
    else banners.push(normalized);
    banners.sort((a, b) => a.order - b.order);
    writeJson(LOCAL_BANNERS_KEY, banners);
    return normalized;
  }

  async deleteBanner(id) {
    const banners = await this.getBanners();
    writeJson(LOCAL_BANNERS_KEY, banners.filter((b) => b.id !== id));
  }

  async uploadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async getTaxonomy() {
    return normalizeTaxonomy(readJson(LOCAL_TAXONOMY_KEY, DEFAULT_TAXONOMY));
  }

  async saveTaxonomy(tax) {
    const normalized = normalizeTaxonomy(tax);
    writeJson(LOCAL_TAXONOMY_KEY, normalized);
    return normalized;
  }

  async getBlogStats() {
    const posts = readJson(LOCAL_BLOG_POSTS_KEY, []);
    const config = readJson(LOCAL_BLOG_CONFIG_KEY, {});
    return {
      posts: Array.isArray(posts) ? posts.length : 0,
      published: Array.isArray(posts) ? posts.filter((post) => post.status !== 'draft').length : 0,
      title: config.title || 'Blog Champion'
    };
  }
}

class FirebaseAdminStore {
  constructor(modules) {
    this.mode = 'firebase';
    this.isFirebase = true;
    this.app = modules.app;
    this.auth = modules.auth;
    this.db = modules.db;
    this.api = modules.api;
    this.collections = Object.assign({}, CHAMPION_BLOG_FIREBASE);
  }

  productRef(id) {
    return this.api.doc(this.db, this.collections.productsCollection, id);
  }

  settingsRef() {
    return this.api.doc(this.db, this.collections.settingsCollection, this.collections.settingsDoc);
  }

  adminRef(uid) {
    return this.api.doc(this.db, this.collections.adminsCollection, uid);
  }

  leadRef(id) {
    return this.api.doc(this.db, this.collections.leadsCollection, id);
  }

  configRef() {
    return this.api.doc(this.db, this.collections.configCollection, this.collections.configDoc);
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
      throw new Error('Usuário autenticado, mas sem permissão de administrador.');
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

  docsToProducts(snapshot) {
    return snapshot.docs.map((item, index) => normalizeProduct(Object.assign({ id: item.id }, item.data()), index));
  }

  async getProducts({ includeDrafts = true } = {}) {
    let snapshot;
    if (includeDrafts) {
      snapshot = await this.api.getDocs(this.api.collection(this.db, this.collections.productsCollection));
    } else {
      snapshot = await this.api.getDocs(this.api.query(
        this.api.collection(this.db, this.collections.productsCollection),
        this.api.where('status', '==', 'published')
      ));
    }
    return sortProducts(this.docsToProducts(snapshot));
  }

  async saveProduct(product) {
    const normalized = normalizeProduct(product);
    await this.api.setDoc(this.productRef(normalized.id), Object.assign({}, normalized, {
      updatedAt: this.api.serverTimestamp()
    }), { merge: true });
    return normalized;
  }

  async deleteProduct(id) {
    await this.api.deleteDoc(this.productRef(id));
  }

  async seedProducts() {
    const batch = this.api.writeBatch(this.db);
    DEFAULT_PRODUCTS.map(normalizeProduct).forEach((product) => {
      batch.set(this.productRef(product.id), Object.assign({}, product, {
        updatedAt: this.api.serverTimestamp()
      }), { merge: true });
    });
    await batch.commit();
  }

  async getSettings() {
    const snapshot = await this.api.getDoc(this.settingsRef());
    return Object.assign({}, DEFAULT_SETTINGS, snapshot.exists() ? snapshot.data() : {});
  }

  async saveSettings(settings) {
    await this.api.setDoc(this.settingsRef(), Object.assign({}, DEFAULT_SETTINGS, settings, {
      updatedAt: this.api.serverTimestamp()
    }), { merge: true });
  }

  async getLeads() {
    const snapshot = await this.api.getDocs(this.api.collection(this.db, this.collections.leadsCollection));
    return snapshot.docs
      .map((item, index) => normalizeLead(Object.assign({ id: item.id }, item.data()), index))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async saveLead(lead) {
    const normalized = normalizeLead(lead);
    await this.api.setDoc(this.leadRef(normalized.id), Object.assign({}, normalized, {
      updatedAt: this.api.serverTimestamp()
    }), { merge: true });
    return normalized;
  }

  async deleteLead(id) {
    await this.api.deleteDoc(this.leadRef(id));
  }

  bannerRef(id) {
    return this.api.doc(this.db, this.collections.bannersCollection, id);
  }

  async getBanners() {
    const snapshot = await this.api.getDocs(this.api.collection(this.db, this.collections.bannersCollection));
    if (snapshot.empty) return DEFAULT_BANNERS.map(normalizeBanner);
    return snapshot.docs
      .map((item, i) => normalizeBanner(Object.assign({ id: item.id }, item.data()), i))
      .sort((a, b) => a.order - b.order);
  }

  async saveBanner(banner) {
    const normalized = normalizeBanner(banner);
    await this.api.setDoc(this.bannerRef(normalized.id), Object.assign({}, normalized, {
      updatedAt: this.api.serverTimestamp()
    }), { merge: true });
    return normalized;
  }

  async deleteBanner(id) {
    await this.api.deleteDoc(this.bannerRef(id));
  }

  async _getStorage() {
    if (this._storage) return this._storage;
    const version = CHAMPION_BLOG_FIREBASE.sdkVersion || '12.12.0';
    const mod = await import(`https://www.gstatic.com/firebasejs/${version}/firebase-storage.js`);
    this._storageApi = mod;
    this._storage = mod.getStorage(this.app);
    return this._storage;
  }

  async uploadImage(file, folder = 'uploads') {
    const storage = await this._getStorage();
    const { ref, uploadBytes, getDownloadURL } = this._storageApi;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const snapshot = await uploadBytes(ref(storage, `${folder}/${Date.now()}-${safeName}`), file);
    return await getDownloadURL(snapshot.ref);
  }

  async getBlogStats() {
    const posts = await this.api.getDocs(this.api.collection(this.db, this.collections.postsCollection));
    const config = await this.api.getDoc(this.configRef());
    return {
      posts: posts.size,
      published: posts.docs.filter((post) => post.data()?.status !== 'draft').length,
      title: config.exists() ? (config.data().title || 'Blog Champion') : 'Blog Champion'
    };
  }

  taxonomyRef() {
    return this.api.doc(this.db, 'siteSettings', 'productTaxonomy');
  }

  async getTaxonomy() {
    try {
      const snap = await this.api.getDoc(this.taxonomyRef());
      return normalizeTaxonomy(snap.exists() ? snap.data() : DEFAULT_TAXONOMY);
    } catch (err) {
      console.warn('[admin-store] getTaxonomy:', err.message);
      return DEFAULT_TAXONOMY;
    }
  }

  async saveTaxonomy(tax) {
    const normalized = normalizeTaxonomy(tax);
    await this.api.setDoc(this.taxonomyRef(), Object.assign({}, normalized, {
      updatedAt: this.api.serverTimestamp()
    }), { merge: false });
    return normalized;
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

  return new FirebaseAdminStore({
    app,
    auth,
    db,
    api: Object.assign({}, authModule, firestoreModule)
  });
}

let storePromise;

export async function getAdminStore() {
  if (!storePromise) {
    storePromise = createFirebaseStore()
      .catch((error) => {
        console.error('Firebase não inicializado. Usando modo local.', error);
        return null;
      })
      .then((firebaseStore) => firebaseStore || new LocalAdminStore());
  }
  return storePromise;
}

export function friendlyAdminError(error) {
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
