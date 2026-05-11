/* Champion Admin · shared sub-page bootstrap
 * Used by every page inside frontend/admin/.
 * Provides: login guard, sidebar render, logout button, active-link highlight.
 *
 * Loaded via plain <script> (not module) so it works on file:// too.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'champion-admin-session';
  var ADMIN_EMAIL = 'admin@champion.com.br';

  /* ---- Auth guard --------------------------------------------------- *
   * Lê sessão de localStorage (tanto modo Firebase quanto local escrevem essa chave
   * via ChampionAdminAuth). Não verifica auth.currentUser aqui porque o módulo
   * Firebase é assíncrono — confiamos no cache de sessão e as Firestore rules
   * cuidam de escritas não-autenticadas.                                */
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    var session = raw ? JSON.parse(raw) : null;
    if (!session || !session.loggedAt) {
      window.location.replace('../login-admin.html');
      return;
    }
    window.__championAdminSession = session;
  } catch (e) {
    window.location.replace('../login-admin.html');
    return;
  }

  /* ---- Navigation menu definition (single source of truth) ---------- */
  var MENU = [
    { label: 'Painel', items: [
      { name: 'Visão geral', href: '../admin.html#dashboard', key: 'dashboard',
        icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' }
    ]},
    { label: 'Operação', items: [
      { name: 'Catálogo & preços', href: 'produtos-cadastro.html', key: 'produtos-cadastro',
        icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' },
      { name: 'Pedidos & frete', href: 'pedidos.html', key: 'pedidos',
        icon: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>' },
      { name: 'Clientes', href: 'clientes.html', key: 'clientes',
        icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' }
    ]}
  ];

  /* ---- Render sidebar (looks for <nav data-admin-nav>) -------------- */
  function renderSidebar(activeKey) {
    var nav = document.querySelector('[data-admin-nav]');
    if (!nav) return;
    var html = '';
    MENU.forEach(function (group) {
      html += '<span class="ap-nav-label">' + group.label + '</span>';
      group.items.forEach(function (item) {
        var isActive = item.key === activeKey;
        html += '<a href="' + item.href + '"' + (isActive ? ' class="is-active"' : '') + '>'
              + '<svg class="ap-nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              + item.icon + '</svg>'
              + item.name + '</a>';
      });
    });
    nav.innerHTML = html;
  }

  /* ---- Wire up logout, user info ------------------------------------ */
  function wireUp() {
    var session = window.__championAdminSession || {};
    var email = session.user || ADMIN_EMAIL;

    var userEl = document.querySelector('[data-admin-user]');
    var avatarEl = document.querySelector('[data-admin-avatar]');
    if (userEl) userEl.textContent = email;
    if (avatarEl) avatarEl.textContent = (email[0] || 'A').toUpperCase();

    var logoutBtns = document.querySelectorAll('[data-admin-logout]');
    logoutBtns.forEach(function (btn) {
      btn.addEventListener('click', async function () {
        /* Se ChampionAdminAuth estiver carregado, deslogamos do Firebase também */
        if (window.ChampionAdminAuth) {
          try { await window.ChampionAdminAuth.logout(); } catch (e) {}
        } else {
          try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
        }
        window.location.replace('../login-admin.html');
      });
    });
  }

  /* ---- Init ---------------------------------------------------------- */
  function init() {
    var activeKey = document.body.getAttribute('data-admin-page') || '';
    renderSidebar(activeKey);
    wireUp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
