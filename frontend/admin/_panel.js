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
    { label: 'Produtos & Operação', items: [
      { name: 'Catálogo & preços', href: 'produtos-cadastro.html', key: 'produtos-cadastro',
        icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' },
      { name: 'Mídias & materiais', href: 'produtos-midia.html', key: 'produtos-midia',
        icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
      { name: 'Pedidos & frete', href: 'pedidos.html', key: 'pedidos',
        icon: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>' },
      { name: 'Lojas & filiais', href: 'lojas.html', key: 'lojas',
        icon: '<path d="M3 9l1-6h16l1 6"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M9 22V12h6v10"/>' }
    ]},
    { label: 'Conteúdo & Cadastros', items: [
      { name: 'Clientes', href: 'clientes.html', key: 'clientes',
        icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { name: 'FAQ, depoimentos & vagas', href: 'conteudo-faq.html', key: 'conteudo-faq',
        icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
      { name: 'Páginas institucionais', href: 'conteudo-paginas.html', key: 'conteudo-paginas',
        icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
      { name: 'Painel central', href: 'controle.html', key: 'controle',
        icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' }
    ]},
    { label: 'Relatórios & Performance', items: [
      { name: 'Vendas & financeiro', href: 'relatorios-vendas.html', key: 'relatorios-vendas',
        icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { name: 'Ticket & recorrência', href: 'relatorios-clientes.html', key: 'relatorios-clientes',
        icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
      { name: 'Tráfego & comportamento', href: 'relatorios-trafego.html', key: 'relatorios-trafego',
        icon: '<path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 21 6"/>' },
      { name: 'Pagamentos', href: 'relatorios-pagamentos.html', key: 'relatorios-pagamentos',
        icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>' }
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
