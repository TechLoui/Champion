/* Champion · Order store
 * Dual mode: Firestore (when ChampionCustomers is in Firebase mode) or localStorage.
 * Uses the Firebase app already initialized by customer-store.js — no double initialization.
 */
(function (global) {
  'use strict';

  var ORDERS_KEY = 'champion-orders';
  var SDK_VERSION = '12.12.0';

  function read(key, fb) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
  function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

  function nextOrderNumber(existing) {
    var max = 10400;
    existing.forEach(function (o) {
      var n = parseInt(String(o.number || '').replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
    return max + 1;
  }

  function normalizeOrder(o) {
    o = o || {};
    return {
      id: o.id || ('ord-' + Date.now().toString(36)),
      number: o.number || '10401',
      customerId: o.customerId || null,
      customer: o.customer || { name: '', email: '', phone: '' },
      address: o.address || null,
      items: Array.isArray(o.items) ? o.items : [],
      subtotal: Number(o.subtotal) || 0,
      shipping: Number(o.shipping) || 0,
      total: Number(o.total) || 0,
      paymentMethod: o.paymentMethod || 'pix',
      status: o.status || 'paid',
      paidAt: o.paidAt || new Date().toISOString(),
      createdAt: o.createdAt || new Date().toISOString(),
      updatedAt: o.updatedAt || new Date().toISOString(),
      notes: o.notes || ''
    };
  }

  /* ────────── localStorage backend ────────── */
  var LocalBackend = {
    mode: 'local',
    async list() {
      return read(ORDERS_KEY, []).map(normalizeOrder)
        .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    },
    async listByCustomer(customerId) {
      return (await this.list()).filter(function (o) { return o.customerId === customerId; });
    },
    async findById(id) {
      return (await this.list()).find(function (o) { return o.id === id; }) || null;
    },
    async create(input) {
      var existing = await this.list();
      var number = String(nextOrderNumber(existing));
      var order = normalizeOrder(Object.assign({}, input, { number: number }));
      existing.push(order);
      write(ORDERS_KEY, existing);
      return order;
    },
    async updateStatus(id, status) {
      var all = await this.list();
      var i = all.findIndex(function (o) { return o.id === id; });
      if (i < 0) return null;
      all[i].status = status;
      all[i].updatedAt = new Date().toISOString();
      write(ORDERS_KEY, all);
      return all[i];
    },
    async remove(id) {
      var all = await this.list();
      write(ORDERS_KEY, all.filter(function (o) { return o.id !== id; }));
    },
    async summary() {
      var orders = await this.list();
      var sum = function (arr, fn) { return arr.reduce(function (a, b) { return a + fn(b); }, 0); };
      return {
        total: orders.length,
        paid: orders.filter(function (o) { return o.status === 'paid'; }).length,
        separating: orders.filter(function (o) { return o.status === 'separating'; }).length,
        shipped: orders.filter(function (o) { return o.status === 'shipped'; }).length,
        delivered: orders.filter(function (o) { return o.status === 'delivered'; }).length,
        revenue: sum(orders.filter(function (o) { return o.status !== 'cancelled'; }), function (o) { return o.total; })
      };
    }
  };

  /* ────────── Firebase backend ────────── */
  function makeFirebaseBackend(modules) {
    var db = modules.db;
    var api = modules.api;
    var COL = 'orders';
    var ref = function (id) { return api.doc(db, COL, id); };

    async function listByCustomerId(customerId) {
      try {
        var q = api.query(api.collection(db, COL), api.where('customerId', '==', customerId));
        var snap = await api.getDocs(q);
        return snap.docs
          .map(function (d) { return normalizeOrder(Object.assign({ id: d.id }, d.data())); })
          .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      } catch (err) {
        console.warn('[ChampionOrders] listByCustomer falhou:', err.message);
        return [];
      }
    }

    return {
      mode: 'firebase',
      async list() {
        var snap = await api.getDocs(api.collection(db, COL));
        return snap.docs
          .map(function (d) { return normalizeOrder(Object.assign({ id: d.id }, d.data())); })
          .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      },
      async listByCustomer(customerId) { return listByCustomerId(customerId); },
      async findById(id) {
        var snap = await api.getDoc(ref(id));
        return snap.exists() ? normalizeOrder(Object.assign({ id: snap.id }, snap.data())) : null;
      },
      async create(input) {
        var others = input.customerId ? await listByCustomerId(input.customerId) : [];
        /* Try to get global last number; safe fallback if list fails (e.g. no admin rights). */
        var allExisting = others;
        try { allExisting = await this.list(); } catch (e) {}
        var number = String(nextOrderNumber(allExisting));
        var order = normalizeOrder(Object.assign({}, input, { number: number }));
        var data = Object.assign({}, order);
        delete data.id;
        data.updatedAt = api.serverTimestamp();
        await api.setDoc(ref(order.id), data, { merge: true });
        return order;
      },
      async updateStatus(id, status) {
        await api.setDoc(ref(id), { status: status, updatedAt: api.serverTimestamp() }, { merge: true });
        return this.findById(id);
      },
      async remove(id) { await api.deleteDoc(ref(id)); },
      async summary() {
        var orders = await this.list();
        var sum = function (arr, fn) { return arr.reduce(function (a, b) { return a + fn(b); }, 0); };
        return {
          total: orders.length,
          paid: orders.filter(function (o) { return o.status === 'paid'; }).length,
          separating: orders.filter(function (o) { return o.status === 'separating'; }).length,
          shipped: orders.filter(function (o) { return o.status === 'shipped'; }).length,
          delivered: orders.filter(function (o) { return o.status === 'delivered'; }).length,
          revenue: sum(orders.filter(function (o) { return o.status !== 'cancelled'; }), function (o) { return o.total; })
        };
      }
    };
  }

  /* ────────── Init ────────── */
  var backend = LocalBackend;
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  function isFirebaseConfigured(cfg) {
    if (!cfg) return false;
    var required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every(function (k) {
      var v = String(cfg[k] || '').trim();
      return v && !/cole|your-|seu-|placeholder/i.test(v);
    });
  }

  async function tryInitFirebase() {
    try {
      var cfgModule = await import('./firebase-config.js');
      var cfg = cfgModule.CHAMPION_FIREBASE_CONFIG;
      if (!isFirebaseConfigured(cfg)) return;
      var v = SDK_VERSION;
      var base = 'https://www.gstatic.com/firebasejs/' + v + '/';
      var [appMod, dbMod] = await Promise.all([
        import(base + 'firebase-app.js'),
        import(base + 'firebase-firestore.js')
      ]);
      var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
      var db = dbMod.getFirestore(app);
      backend = makeFirebaseBackend({ db: db, api: dbMod });
      console.info('[ChampionOrders] Modo Firebase ativo.');
    } catch (err) {
      console.warn('[ChampionOrders] Firebase indisponível, usando localStorage:', err.message);
    } finally {
      readyResolve();
    }
  }
  tryInitFirebase();

  /* ────────── Public API ────────── */
  global.ChampionOrders = {
    ready: ready,
    mode: function () { return backend.mode; },
    list:           function ()         { return ready.then(function () { return backend.list(); }); },
    listByCustomer: function (id)       { return ready.then(function () { return backend.listByCustomer(id); }); },
    findById:       function (id)       { return ready.then(function () { return backend.findById(id); }); },
    create:         function (i)        { return ready.then(function () { return backend.create(i); }); },
    updateStatus:   function (id, s)    { return ready.then(function () { return backend.updateStatus(id, s); }); },
    remove:         function (id)       { return ready.then(function () { return backend.remove(id); }); },
    summary:        function ()         { return ready.then(function () { return backend.summary(); }); }
  };
})(window);
