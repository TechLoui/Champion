/* Champion · Customer store
 * Dual mode: Firebase (Auth + Firestore) when firebase-config has values; localStorage otherwise.
 * All public methods are async (Promise-returning) so they work in either mode.
 *
 * Loaded as plain <script> so it works on file:// too. Lazy-imports Firebase modules from CDN
 * only when configuration is present.
 */
(function (global) {
  'use strict';

  var CUSTOMERS_KEY = 'champion-customers';
  var SESSION_KEY   = 'champion-customer-session';
  var SDK_VERSION   = '12.12.0';

  /* ────────── Helpers ────────── */
  function read(key, fb) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : (fb === undefined ? null : fb); } catch (e) { return fb === undefined ? null : fb; } }
  function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
  function rid() { return 'cli-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0; return 'h_' + Math.abs(h).toString(36); }

  function normalizeCustomer(c) {
    c = c || {};
    return {
      id: c.id || rid(),
      name: String(c.name || '').trim(),
      email: String(c.email || '').trim().toLowerCase(),
      phone: String(c.phone || '').trim(),
      cpfCnpj: String(c.cpfCnpj || '').trim(),
      profile: c.profile === 'pecuarista' || c.profile === 'revenda' ? c.profile : 'pessoa-fisica',
      address: c.address || null,
      passwordHash: c.passwordHash || '',
      status: c.status === 'blocked' || c.status === 'inactive' ? c.status : 'active',
      createdAt: c.createdAt || new Date().toISOString(),
      lastLoginAt: c.lastLoginAt || null
    };
  }

  function isFirebaseConfigured(cfg) {
    if (!cfg) return false;
    var required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every(function (k) {
      var v = String(cfg[k] || '').trim();
      return v && !/cole|your-|seu-|placeholder/i.test(v);
    });
  }

  /* ────────── localStorage backend (fallback / dev) ────────── */
  var LocalBackend = {
    mode: 'local',
    async list() { return read(CUSTOMERS_KEY, []).map(normalizeCustomer); },
    async findByEmail(email) {
      var e = String(email || '').trim().toLowerCase();
      return (await this.list()).find(function (c) { return c.email === e; }) || null;
    },
    async findById(id) {
      return (await this.list()).find(function (c) { return c.id === id; }) || null;
    },
    async save(customer) {
      var all = await this.list();
      var n = normalizeCustomer(customer);
      var i = all.findIndex(function (c) { return c.id === n.id; });
      if (i >= 0) all[i] = n; else all.push(n);
      write(CUSTOMERS_KEY, all);
      return n;
    },
    async remove(id) {
      var all = await this.list();
      write(CUSTOMERS_KEY, all.filter(function (c) { return c.id !== id; }));
    },
    async register(input) {
      var email = String(input.email || '').trim().toLowerCase();
      var password = String(input.password || '');
      if (!email) throw new Error('E-mail obrigatório.');
      if (password.length < 6) throw new Error('Senha precisa de pelo menos 6 caracteres.');
      if (await this.findByEmail(email)) throw new Error('Já existe uma conta com esse e-mail.');
      var c = await this.save({
        name: input.name, email: email, phone: input.phone,
        cpfCnpj: input.cpfCnpj, profile: input.profile,
        passwordHash: hash(password), createdAt: new Date().toISOString()
      });
      setSession(c);
      return c;
    },
    async login(email, password) {
      var c = await this.findByEmail(email);
      if (!c) throw new Error('E-mail ou senha inválidos.');
      if (c.passwordHash !== hash(String(password || ''))) throw new Error('E-mail ou senha inválidos.');
      if (c.status === 'blocked') throw new Error('Conta bloqueada. Entre em contato com a Champion.');
      c.lastLoginAt = new Date().toISOString();
      await this.save(c);
      setSession(c);
      return c;
    },
    async logout() { clearSession(); },
    async updateProfile(id, patch) {
      var c = await this.findById(id);
      if (!c) throw new Error('Cliente não encontrado.');
      Object.assign(c, patch || {});
      return this.save(c);
    }
  };

  /* ────────── Firebase backend ────────── */
  function makeFirebaseBackend(modules) {
    var auth = modules.auth;
    var db = modules.db;
    var api = modules.api;
    var COL = 'customers';
    var ref = function (id) { return api.doc(db, COL, id); };

    async function loadProfile(uid) {
      var snap = await api.getDoc(ref(uid));
      return snap.exists() ? normalizeCustomer(Object.assign({ id: uid }, snap.data())) : null;
    }

    return {
      mode: 'firebase',
      async list() {
        var snap = await api.getDocs(api.collection(db, COL));
        return snap.docs.map(function (d) { return normalizeCustomer(Object.assign({ id: d.id }, d.data())); });
      },
      async findByEmail(email) {
        var q = api.query(api.collection(db, COL), api.where('email', '==', String(email || '').trim().toLowerCase()));
        var snap = await api.getDocs(q);
        return snap.empty ? null : normalizeCustomer(Object.assign({ id: snap.docs[0].id }, snap.docs[0].data()));
      },
      async findById(id) { return loadProfile(id); },
      async save(customer) {
        var n = normalizeCustomer(customer);
        var data = Object.assign({}, n);
        delete data.id;
        delete data.passwordHash; /* never persist; Firebase Auth handles password */
        data.updatedAt = api.serverTimestamp();
        await api.setDoc(ref(n.id), data, { merge: true });
        return n;
      },
      async remove(id) { await api.deleteDoc(ref(id)); },
      async register(input) {
        var email = String(input.email || '').trim().toLowerCase();
        var password = String(input.password || '');
        if (!email) throw new Error('E-mail obrigatório.');
        if (password.length < 6) throw new Error('Senha precisa de pelo menos 6 caracteres.');
        try {
          var cred = await api.createUserWithEmailAndPassword(auth, email, password);
          var uid = cred.user.uid;
          var c = normalizeCustomer({
            id: uid,
            name: input.name, email: email, phone: input.phone,
            cpfCnpj: input.cpfCnpj, profile: input.profile,
            createdAt: new Date().toISOString()
          });
          await this.save(c);
          setSession(c);
          return c;
        } catch (err) {
          if (String(err.code || '').includes('email-already-in-use')) throw new Error('Já existe uma conta com esse e-mail.');
          if (String(err.code || '').includes('weak-password')) throw new Error('Senha muito fraca (mín. 6 caracteres).');
          if (String(err.code || '').includes('invalid-email')) throw new Error('E-mail inválido.');
          throw new Error(err.message || 'Não foi possível criar a conta.');
        }
      },
      async login(email, password) {
        try {
          var cred = await api.signInWithEmailAndPassword(auth, String(email || '').trim().toLowerCase(), String(password || ''));
          var profile = await loadProfile(cred.user.uid);
          if (!profile) {
            /* First-time login but no profile doc yet — create a minimal one */
            profile = normalizeCustomer({ id: cred.user.uid, email: cred.user.email });
            await this.save(profile);
          }
          if (profile.status === 'blocked') {
            await api.signOut(auth);
            throw new Error('Conta bloqueada. Entre em contato com a Champion.');
          }
          profile.lastLoginAt = new Date().toISOString();
          await this.save(profile);
          setSession(profile);
          return profile;
        } catch (err) {
          var code = String(err.code || '');
          if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
            throw new Error('E-mail ou senha inválidos.');
          }
          if (code.includes('too-many-requests')) throw new Error('Muitas tentativas. Aguarde alguns minutos.');
          throw err;
        }
      },
      async logout() {
        try { await api.signOut(auth); } catch (e) {}
        clearSession();
      },
      async updateProfile(id, patch) {
        var c = await loadProfile(id);
        if (!c) throw new Error('Cliente não encontrado.');
        Object.assign(c, patch || {});
        return this.save(c);
      }
    };
  }

  /* ────────── Session cache (sync access regardless of backend) ────────── */
  function setSession(customer) {
    write(SESSION_KEY, {
      id: customer.id, email: customer.email,
      name: customer.name || '',
      loggedAt: new Date().toISOString()
    });
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function getSession() { return read(SESSION_KEY, null); }

  /* ────────── Init ────────── */
  var backend = LocalBackend;
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  async function tryInitFirebase() {
    try {
      /* Dynamic import of firebase-config (ES module). Fails on file:// — falls back to local. */
      var cfgModule = await import('./firebase-config.js');
      var cfg = cfgModule.CHAMPION_FIREBASE_CONFIG;
      if (!isFirebaseConfigured(cfg)) return;

      var v = SDK_VERSION;
      var base = 'https://www.gstatic.com/firebasejs/' + v + '/';
      var [appMod, authMod, dbMod] = await Promise.all([
        import(base + 'firebase-app.js'),
        import(base + 'firebase-auth.js'),
        import(base + 'firebase-firestore.js')
      ]);

      var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
      var auth = authMod.getAuth(app);
      var db = dbMod.getFirestore(app);

      backend = makeFirebaseBackend({ app: app, auth: auth, db: db, api: Object.assign({}, authMod, dbMod) });
      console.info('[ChampionCustomers] Modo Firebase ativo.');
    } catch (err) {
      console.warn('[ChampionCustomers] Firebase indisponível, usando localStorage:', err.message);
    } finally {
      readyResolve();
    }
  }
  tryInitFirebase();

  /* ────────── Public API ────────── */
  global.ChampionCustomers = {
    ready: ready,
    mode: function () { return backend.mode; },

    list:           function ()        { return ready.then(function () { return backend.list(); }); },
    findByEmail:    function (e)       { return ready.then(function () { return backend.findByEmail(e); }); },
    findById:       function (id)      { return ready.then(function () { return backend.findById(id); }); },
    save:           function (c)       { return ready.then(function () { return backend.save(c); }); },
    remove:         function (id)      { return ready.then(function () { return backend.remove(id); }); },
    register:       function (i)       { return ready.then(function () { return backend.register(i); }); },
    login:          function (e, p)    { return ready.then(function () { return backend.login(e, p); }); },
    logout:         function ()        { return ready.then(function () { return backend.logout(); }); },
    updateProfile:  function (id, p)   { return ready.then(function () { return backend.updateProfile(id, p); }); },

    /* Sync helpers reading the cached session — work even before ready resolves */
    currentSession: function () { return getSession(); },
    isLogged:       function () { var s = getSession(); return Boolean(s && s.id); }
  };
})(window);
