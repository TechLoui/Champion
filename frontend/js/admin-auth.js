/* Champion · Admin auth (compartilhado entre painel admin e painel blog)
 *
 * Dual mode:
 *   - Firebase Auth + verificação de blogAdmins/{uid}.active quando firebase-config tem valores
 *   - Fallback local com credenciais hardcoded (admin@champion.com.br / Champion@2026)
 *
 * Sempre escreve uma chave de sessão em localStorage após login bem-sucedido,
 * para que páginas que fazem leitura síncrona (ex: _panel.js) funcionem em ambos os modos.
 *
 * Loaded como plain <script> (não module) — funciona em file://, HTTP, HTTPS.
 */
(function (global) {
  'use strict';

  var LOCAL_ADMIN_EMAIL    = 'admin@champion.com.br';
  var LOCAL_ADMIN_PASSWORD = 'Champion@2026';
  var SDK_VERSION = '12.12.0';

  /* Chaves localStorage (compatíveis com sessões antigas) */
  var ADMIN_SESSION_KEY = 'champion-admin-session';
  var BLOG_SESSION_KEY  = 'champion-blog-admin-session';

  function readSession(key) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function writeSession(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }
  function clearSession(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function isFirebaseConfigured(cfg) {
    if (!cfg) return false;
    var required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    return required.every(function (k) {
      var v = String(cfg[k] || '').trim();
      return v && !/cole|your-|seu-|placeholder/i.test(v);
    });
  }

  /* ────────── Backend Firebase ────────── */
  var firebase = null;          /* { auth, db, api } quando inicializado */
  var firebaseReady = null;     /* Promise<boolean> */

  function initFirebase() {
    if (firebaseReady) return firebaseReady;
    firebaseReady = (async function () {
      try {
        var cfgModule = await import('./firebase-config.js');
        var cfg = cfgModule.CHAMPION_FIREBASE_CONFIG;
        if (!isFirebaseConfigured(cfg)) return false;

        var base = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
        var [appMod, authMod, dbMod] = await Promise.all([
          import(base + 'firebase-app.js'),
          import(base + 'firebase-auth.js'),
          import(base + 'firebase-firestore.js')
        ]);
        var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
        firebase = {
          app: app,
          auth: authMod.getAuth(app),
          db: dbMod.getFirestore(app),
          api: Object.assign({}, authMod, dbMod)
        };
        console.info('[ChampionAdminAuth] Modo Firebase ativo.');
        return true;
      } catch (err) {
        console.warn('[ChampionAdminAuth] Firebase indisponível, usando modo local:', err.message);
        firebase = null;
        return false;
      }
    })();
    return firebaseReady;
  }

  async function isBlogAdmin(uid) {
    try {
      var snap = await firebase.api.getDoc(firebase.api.doc(firebase.db, 'blogAdmins', uid));
      return snap.exists() && snap.data().active === true;
    } catch (err) {
      console.error('[ChampionAdminAuth] erro ao verificar blogAdmins:', err.message);
      return false;
    }
  }

  /* ────────── API pública ────────── */

  async function login(email, password) {
    var e = String(email || '').trim().toLowerCase();
    var p = String(password || '').trim();
    if (!e || !p) throw new Error('Informe e-mail e senha.');

    var useFirebase = await initFirebase();

    if (useFirebase) {
      try {
        var cred = await firebase.api.signInWithEmailAndPassword(firebase.auth, e, p);
        var allowed = await isBlogAdmin(cred.user.uid);
        if (!allowed) {
          await firebase.api.signOut(firebase.auth);
          throw new Error('Usuário autenticado, mas sem permissão de administrador. Crie blogAdmins/{uid}.active=true no Firestore.');
        }
        /* Escreve ambas as chaves de sessão para que admin geral E blog admin reconheçam. */
        var sessionData = { user: e, uid: cred.user.uid, mode: 'firebase', loggedAt: new Date().toISOString() };
        writeSession(ADMIN_SESSION_KEY, sessionData);
        writeSession(BLOG_SESSION_KEY, sessionData);
        return sessionData;
      } catch (err) {
        /* Re-lança erro amigável */
        var code = String(err.code || '');
        if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
          throw new Error('E-mail ou senha incorretos.');
        }
        if (code.includes('too-many-requests')) {
          throw new Error('Muitas tentativas. Aguarde alguns minutos.');
        }
        if (code.includes('network-request-failed')) {
          throw new Error('Sem conexão com o Firebase. Tente novamente.');
        }
        throw err;
      }
    }

    /* Fallback local */
    if (e !== LOCAL_ADMIN_EMAIL || p !== LOCAL_ADMIN_PASSWORD) {
      throw new Error('E-mail ou senha incorretos.');
    }
    var local = { user: e, uid: null, mode: 'local', loggedAt: new Date().toISOString() };
    writeSession(ADMIN_SESSION_KEY, local);
    writeSession(BLOG_SESSION_KEY, local);
    return local;
  }

  async function logout() {
    var useFirebase = await initFirebase();
    if (useFirebase) {
      try { await firebase.api.signOut(firebase.auth); } catch (e) {}
    }
    clearSession(ADMIN_SESSION_KEY);
    clearSession(BLOG_SESSION_KEY);
  }

  function currentSession(sessionKey) {
    var key = sessionKey || ADMIN_SESSION_KEY;
    return readSession(key);
  }

  function isLogged(sessionKey) {
    var s = currentSession(sessionKey);
    return Boolean(s && s.loggedAt);
  }

  /* Pra páginas como _panel.js que abrem após o login:
     se Firebase está configurado mas a sessão localStorage não tem `mode: 'firebase'`,
     pode ser sessão local antiga ou estado inconsistente. Aceitar mesmo assim — a regra
     do Firestore vai bloquear escritas se auth.currentUser for nulo, e o usuário verá erro.
     Isso é melhor do que loop de redirect. */

  /* Inicia detecção em background */
  initFirebase();

  global.ChampionAdminAuth = {
    login: login,
    logout: logout,
    currentSession: currentSession,
    isLogged: isLogged,
    ADMIN_SESSION_KEY: ADMIN_SESSION_KEY,
    BLOG_SESSION_KEY: BLOG_SESSION_KEY,
    /* Aguarda detecção do modo Firebase concluir (true=firebase, false=local) */
    ready: function () { return initFirebase(); }
  };
})(window);
