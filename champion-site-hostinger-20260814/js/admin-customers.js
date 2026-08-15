/* Champion · Admin — aba de Clientes
 * Renderiza a lista, KPIs e ações (editar, bloquear/desbloquear, lixeira).
 * Exclusão é soft: o cliente fica em "Lixeira" por 3 dias antes de ser
 * removido em definitivo (purga automática na próxima abertura da aba).
 */
(function () {
  'use strict';
  if (!window.ChampionCustomers) return;

  var TRASH_TTL_MS = 3 * 24 * 60 * 60 * 1000; /* 3 dias */
  var DAY_MS = 24 * 60 * 60 * 1000;

  var panel         = document.querySelector('[data-admin-panel="customers"]');
  var tableBody     = document.querySelector('#customersTable tbody');
  var totalTag      = document.getElementById('customersTotalTag');
  var kpisEl        = document.getElementById('customersKpis');
  var searchInput   = document.getElementById('customersSearch');
  var profileFilter = document.getElementById('customersProfileFilter');
  var statusFilter  = document.getElementById('customersStatusFilter');
  var drawer        = document.getElementById('customerDrawer');
  var form          = document.getElementById('adminCustomerForm');
  var feedback      = document.getElementById('adminCustomerFeedback');

  if (!panel || !tableBody || !drawer || !form) return;

  var customersCache = [];
  var ordersByCustomer = new Map();
  var isInitialized = false;
  var isRendering = false;

  /* ───── Helpers ───── */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmtBRL(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return '—'; }
  }
  function fmtRelDays(iso) {
    if (!iso) return '';
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
    if (days <= 0) return 'hoje';
    if (days === 1) return 'há 1 dia';
    return 'há ' + days + ' dias';
  }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    var s = parts.map(function (p) { return p[0] || ''; }).join('').toUpperCase();
    return s || '?';
  }
  function profileLabel(p) {
    if (p === 'pecuarista') return 'Pecuarista';
    if (p === 'revenda') return 'Revenda';
    return 'Pessoa Física';
  }
  function profilePillClass(p) {
    if (p === 'pecuarista') return 'ap-pill blue';
    if (p === 'revenda') return 'ap-pill purple';
    return 'ap-pill gray';
  }
  function statusPill(c) {
    if (c.deletedAt) return '<span class="ap-pill red">Lixeira</span>';
    if (c.status === 'blocked') return '<span class="ap-pill red">Bloqueado</span>';
    return '<span class="ap-pill green">Ativo</span>';
  }
  function showToast(msg) { try { if (window.ChampionToast) window.ChampionToast(msg); } catch (e) {} }
  function cityOf(c) {
    var a = c.address || {};
    return a.city || a.cidade || a.municipio || '—';
  }

  /* ───── Data ───── */
  async function purgeExpiredTrash(list) {
    var cutoff = Date.now() - TRASH_TTL_MS;
    var expired = list.filter(function (c) {
      return c.deletedAt && new Date(c.deletedAt).getTime() < cutoff;
    });
    if (!expired.length) return list;
    await Promise.all(expired.map(function (c) {
      return window.ChampionCustomers.remove(c.id).catch(function () {});
    }));
    var expiredIds = new Set(expired.map(function (c) { return c.id; }));
    return list.filter(function (c) { return !expiredIds.has(c.id); });
  }

  async function loadData() {
    var list = [];
    try { list = await window.ChampionCustomers.list(); } catch (e) { list = []; }
    list = await purgeExpiredTrash(list);
    customersCache = list;

    var orders = [];
    try {
      orders = window.ChampionOrders ? await window.ChampionOrders.list() : [];
    } catch (e) { orders = []; }
    ordersByCustomer = new Map();
    orders.forEach(function (o) {
      if (!o.customerId) return;
      if (!ordersByCustomer.has(o.customerId)) ordersByCustomer.set(o.customerId, []);
      ordersByCustomer.get(o.customerId).push(o);
    });
  }

  function getFiltered() {
    var q = (searchInput && searchInput.value || '').trim().toLowerCase();
    var fp = profileFilter && profileFilter.value || '';
    var fs = statusFilter && statusFilter.value || '';
    return customersCache.filter(function (c) {
      var inTrash = !!c.deletedAt;
      /* Filtro de status: "Todos status" esconde a lixeira; "Lixeira" mostra só lixeira */
      if (fs === 'trashed') { if (!inTrash) return false; }
      else if (fs === 'active')  { if (inTrash || c.status === 'blocked') return false; }
      else if (fs === 'blocked') { if (inTrash || c.status !== 'blocked') return false; }
      else                       { if (inTrash) return false; }
      if (fp && c.profile !== fp) return false;
      if (q) {
        var hay = (c.name + ' ' + c.email + ' ' + (c.cpfCnpj || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ───── Render ───── */
  function renderKpis() {
    if (!kpisEl) return;
    var total = 0, blocked = 0, trashed = 0;
    customersCache.forEach(function (c) {
      if (c.deletedAt) { trashed++; return; }
      total++;
      if (c.status === 'blocked') blocked++;
    });
    var active = total - blocked;
    kpisEl.innerHTML = ''
      + '<div class="dash-kpi">'
      +   '<div class="dash-kpi-head"><span class="dash-kpi-label">Total</span>'
      +     '<span class="dash-kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>'
      +   '</div>'
      +   '<strong class="dash-kpi-value">' + total + '</strong>'
      + '</div>'
      + '<div class="dash-kpi">'
      +   '<div class="dash-kpi-head"><span class="dash-kpi-label">Ativos</span>'
      +     '<span class="dash-kpi-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
      +   '</div>'
      +   '<strong class="dash-kpi-value">' + active + '</strong>'
      + '</div>'
      + '<div class="dash-kpi">'
      +   '<div class="dash-kpi-head"><span class="dash-kpi-label">Bloqueados</span>'
      +     '<span class="dash-kpi-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
      +   '</div>'
      +   '<strong class="dash-kpi-value">' + blocked + '</strong>'
      + '</div>'
      + '<div class="dash-kpi">'
      +   '<div class="dash-kpi-head"><span class="dash-kpi-label">Na lixeira</span>'
      +     '<span class="dash-kpi-icon pink"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></span>'
      +   '</div>'
      +   '<strong class="dash-kpi-value">' + trashed + '</strong>'
      + '</div>';
  }

  function renderActiveActions(c) {
    var blocked = c.status === 'blocked';
    return ''
      + '<button type="button" class="customer-action" data-action="edit" data-id="' + esc(c.id) + '" title="Editar">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>'
      + '</button>'
      + '<button type="button" class="customer-action" data-action="toggle-block" data-id="' + esc(c.id) + '" title="' + (blocked ? 'Desbloquear acesso' : 'Bloquear acesso') + '">'
      +   (blocked
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>')
      + '</button>'
      + '<button type="button" class="customer-action danger" data-action="delete" data-id="' + esc(c.id) + '" title="Excluir (vai para a lixeira)">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
      + '</button>';
  }

  function renderTrashedActions(c) {
    var daysLeft = Math.max(0, Math.ceil((TRASH_TTL_MS - (Date.now() - new Date(c.deletedAt).getTime())) / DAY_MS));
    return ''
      + '<button type="button" class="customer-action" data-action="restore" data-id="' + esc(c.id) + '" title="Restaurar (' + daysLeft + 'd restantes)">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>'
      +   '<span>Restaurar (' + daysLeft + 'd)</span>'
      + '</button>'
      + '<button type="button" class="customer-action danger" data-action="purge" data-id="' + esc(c.id) + '" title="Excluir agora (definitivo)">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
      + '</button>';
  }

  function renderTable() {
    if (!tableBody) return;
    var rows = getFiltered();
    if (totalTag) totalTag.textContent = rows.length + ' cliente' + (rows.length === 1 ? '' : 's');
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#9EA6B4;padding:34px 12px">'
        + 'Nenhum cliente encontrado com os filtros atuais.</td></tr>';
      return;
    }
    tableBody.innerHTML = rows.map(function (c) {
      var list = ordersByCustomer.get(c.id) || [];
      var totalSpent = list.reduce(function (a, o) { return a + Number(o.total || 0); }, 0);
      var lastOrder = list[0]; /* ordens já vêm desc por createdAt */
      var actions = c.deletedAt ? renderTrashedActions(c) : renderActiveActions(c);
      return ''
        + '<tr data-customer-id="' + esc(c.id) + '">'
        +   '<td>'
        +     '<div style="display:flex;align-items:center;gap:10px;min-width:0">'
        +       '<span class="ap-init">' + esc(initials(c.name || c.email)) + '</span>'
        +       '<div style="min-width:0">'
        +         '<div class="strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name || '(sem nome)') + '</div>'
        +         '<div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.email) + '</div>'
        +       '</div>'
        +     '</div>'
        +   '</td>'
        +   '<td><span class="' + profilePillClass(c.profile) + '">' + esc(profileLabel(c.profile)) + '</span></td>'
        +   '<td>' + esc(cityOf(c)) + '</td>'
        +   '<td class="num">' + list.length + '</td>'
        +   '<td class="num">' + fmtBRL(totalSpent) + '</td>'
        +   '<td>' + (lastOrder
              ? fmtDate(lastOrder.createdAt) + '<div class="muted">' + fmtRelDays(lastOrder.createdAt) + '</div>'
              : '<span class="muted">—</span>') + '</td>'
        +   '<td>' + statusPill(c) + '</td>'
        +   '<td class="col-actions"><div class="customer-actions">' + actions + '</div></td>'
        + '</tr>';
    }).join('');
  }

  async function render() {
    if (isRendering) return;
    isRendering = true;
    try {
      await loadData();
      renderKpis();
      renderTable();
    } finally {
      isRendering = false;
    }
  }

  /* ───── Drawer / Edição ───── */
  function openDrawer() {
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    if (feedback) feedback.textContent = '';
  }
  function openEdit(id) {
    var c = customersCache.find(function (x) { return x.id === id; });
    if (!c) return;
    form.elements.id.value       = c.id;
    form.elements.name.value     = c.name || '';
    form.elements.email.value    = c.email || '';
    form.elements.phone.value    = c.phone || '';
    form.elements.cpfCnpj.value  = c.cpfCnpj || '';
    form.elements.profile.value  = c.profile || 'pessoa-fisica';
    openDrawer();
  }

  /* ───── Ações ───── */
  async function handleAction(action, id) {
    var c = customersCache.find(function (x) { return x.id === id; });
    if (!c) return;
    if (action === 'edit') return openEdit(id);
    if (action === 'toggle-block') {
      var newStatus = c.status === 'blocked' ? 'active' : 'blocked';
      await window.ChampionCustomers.save(Object.assign({}, c, { status: newStatus }));
      showToast(newStatus === 'blocked' ? 'Acesso do cliente bloqueado.' : 'Acesso do cliente liberado.');
      return render();
    }
    if (action === 'delete') {
      if (!window.confirm('Mover "' + (c.name || c.email) + '" para a lixeira?\nVocê terá 3 dias para restaurar antes da exclusão definitiva.')) return;
      await window.ChampionCustomers.save(Object.assign({}, c, { deletedAt: new Date().toISOString() }));
      showToast('Cliente enviado para a lixeira.');
      return render();
    }
    if (action === 'restore') {
      await window.ChampionCustomers.save(Object.assign({}, c, { deletedAt: null }));
      showToast('Cliente restaurado.');
      return render();
    }
    if (action === 'purge') {
      if (!window.confirm('Excluir "' + (c.name || c.email) + '" definitivamente?\nEsta ação não pode ser desfeita.')) return;
      await window.ChampionCustomers.remove(c.id);
      showToast('Cliente excluído.');
      return render();
    }
  }

  /* ───── Wiring ───── */
  function bindEvents() {
    tableBody.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      handleAction(btn.dataset.action, btn.dataset.id).catch(function (err) {
        console.error('[admin-customers]', err);
        showToast((err && err.message) || 'Erro ao processar.');
      });
    });

    if (searchInput)   searchInput.addEventListener('input', renderTable);
    if (profileFilter) profileFilter.addEventListener('change', renderTable);
    if (statusFilter)  statusFilter.addEventListener('change', renderTable);

    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-drawer]')) closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = form.elements.id.value;
      var current = customersCache.find(function (x) { return x.id === id; });
      if (!current) return;
      var patch = Object.assign({}, current, {
        name:    form.elements.name.value.trim(),
        email:   form.elements.email.value.trim().toLowerCase(),
        phone:   form.elements.phone.value.trim(),
        cpfCnpj: form.elements.cpfCnpj.value.trim(),
        profile: form.elements.profile.value
      });
      var submitBtn = drawer.querySelector('button[type="submit"]');
      var prevHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
      try {
        await window.ChampionCustomers.save(patch);
        showToast('Cliente atualizado.');
        closeDrawer();
        await render();
      } catch (err) {
        if (feedback) feedback.textContent = (err && err.message) || 'Erro ao salvar.';
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = prevHtml || 'Salvar cliente'; }
      }
    });
  }

  function ensureInit() {
    if (isInitialized) return;
    isInitialized = true;
    bindEvents();
    render();
  }

  /* Init preguiçoso quando a aba Clientes ficar visível, e refresh a cada reabertura. */
  if (!panel.hidden) ensureInit();
  new MutationObserver(function () {
    if (panel.hidden) return;
    if (!isInitialized) ensureInit();
    else render();
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
})();
