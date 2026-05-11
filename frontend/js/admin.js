import { getAdminStore, friendlyAdminError } from './admin-store.js';
import { DEFAULT_PRODUCTS, formatBRL, normalizeProduct, slugify } from './product-data.js';

(async function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const store = await getAdminStore();
  let productsCache = [];
  let leadsCache = [];
  let bannersCache = [];
  let _pendingBannerFile = null;
  let _pendingProductFile = null;

  const refs = {
    login: $('[data-admin-login]'),
    app: $('[data-admin-app]'),
    loginForm: $('#adminLoginForm'),
    loginFeedback: $('#adminLoginFeedback'),
    mode: $('#adminMode'),
    user: $('#adminUser'),
    productForm: $('#adminProductForm'),
    productFeedback: $('#adminProductFeedback'),
    productList: $('#adminProductList'),
    productSearch: $('#adminProductSearch'),
    settingsForm: $('#adminSettingsForm'),
    settingsFeedback: $('#adminSettingsFeedback'),
    leadsList: $('#adminLeadsList'),
    statsProducts: $('#adminStatsProducts'),
    statsPublished: $('#adminStatsPublished'),
    statsDrafts: $('#adminStatsDrafts'),
    statsBlog: $('#adminStatsBlog'),
    statsLeads: $('#adminStatsLeads'),
    statsBanners: $('#adminStatsBanners'),
    bannerForm: $('#adminBannerForm'),
    bannerFeedback: $('#adminBannerFeedback'),
    bannerList: $('#adminBannerList'),
    bannerImageUrl: $('#adminBannerImageUrl'),
    bannerPreview: $('#adminBannerPreview'),
    bannerPlaceholder: $('#bannerUploadPlaceholder'),
    bannerFile: $('#adminBannerFile'),
    bannerUploadArea: $('#bannerUploadArea'),
    productFile: $('#adminProductFile'),
    productPreview: $('#adminProductPreview'),
    productPickFile: $('#adminProductPickFile')
  };

  function setFeedback(target, message, type = 'error') {
    if (!target) return;
    target.textContent = message || '';
    target.classList.toggle('is-success', type === 'success');
  }

  function setBusy(form, busy, label = 'Salvando...') {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) button.dataset.previousHtml = button.innerHTML;
    button.disabled = busy;
    button.innerHTML = busy ? label : (button.dataset.previousHtml || button.innerHTML);
    if (!busy) delete button.dataset.previousHtml;
  }

  function setTab(name) {
    $$('.admin-nav button[data-admin-tab]').forEach((button) => {
      const active = button.dataset.adminTab === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-admin-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== name;
    });
  }

  function splitLines(value) {
    return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
  }

  /* ── Drawer (criar/editar) ─────────────────────────────── */
  function openProductDrawer(title, subtitle) {
    const drawer = document.getElementById('productDrawer');
    const t = document.getElementById('productDrawerTitle');
    const s = document.getElementById('productDrawerSub');
    if (t && title) t.textContent = title;
    if (s && subtitle) s.textContent = subtitle;
    if (drawer) {
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeProductDrawer() {
    const drawer = document.getElementById('productDrawer');
    if (drawer) {
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  function resetProductForm() {
    const form = refs.productForm;
    if (!form) return;
    form.reset();
    form.dataset.slugEdited = 'false';
    form.elements.id.value = '';
    form.elements.status.value = 'published';
    form.elements.order.value = String(productsCache.length + 1);
    form.elements.presentations.value = 'Consultar embalagem';
    if (refs.productPreview) { refs.productPreview.hidden = true; refs.productPreview.src = ''; }
    _pendingProductFile = null;
    $('#adminProductSubmitLabel').textContent = 'Salvar produto';
    setFeedback(refs.productFeedback, '');
  }

  function openNewProductDrawer() {
    resetProductForm();
    openProductDrawer('Novo produto', 'Preencha as informações do produto abaixo.');
  }

  function fillProductForm(product) {
    const form = refs.productForm;
    if (!form || !product) return;
    form.dataset.slugEdited = 'true';
    _pendingProductFile = null;
    Object.entries(normalizeProduct(product)).forEach(([key, value]) => {
      const input = form.elements[key];
      if (!input) return;
      input.value = value ?? '';
    });
    if (refs.productPreview && product.image) {
      refs.productPreview.src = product.image;
      refs.productPreview.hidden = false;
    }
    $('#adminProductSubmitLabel').textContent = 'Salvar alterações';
    setFeedback(refs.productFeedback, '');
    openProductDrawer('Editar produto', `Editando: ${product.name}`);
  }

  function productStatusLabel(product) {
    return product.status === 'draft' ? 'Rascunho' : 'Publicado';
  }

  function renderProducts() {
    const list = refs.productList;
    if (!list) return;
    const term = String(refs.productSearch?.value || '').trim().toLowerCase();
    const speciesFilter = String(document.getElementById('adminProductSpeciesFilter')?.value || '');
    const statusFilter = String(document.getElementById('adminProductStatusFilter')?.value || '');

    const products = productsCache.filter((product) => {
      const haystack = `${product.name} ${product.category} ${product.excerpt} ${product.id}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (speciesFilter && product.species !== speciesFilter) return false;
      if (statusFilter && product.status !== statusFilter) return false;
      return true;
    });

    /* Stats no toolbar */
    const stats = document.getElementById('adminProductStats');
    if (stats) {
      const total = productsCache.length;
      const pub = productsCache.filter((p) => p.status === 'published').length;
      const draft = total - pub;
      stats.innerHTML = `<strong>${total}</strong> produtos · ${pub} publicados · ${draft} rascunhos`;
    }

    if (!productsCache.length) {
      list.innerHTML = `
        <div class="prod-empty-state">
          <h3>Nenhum produto cadastrado ainda</h3>
          <p>Cadastre o primeiro produto ou clique em "Restaurar padrão" para popular o catálogo com a linha Champion.</p>
          <button class="ap-btn ap-btn-primary" type="button" data-seed-from-empty>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
            Restaurar produtos padrão
          </button>
        </div>`;
      return;
    }

    if (!products.length) {
      list.innerHTML = '<div class="prod-empty-state"><h3>Nenhum produto bate com os filtros</h3><p>Tente outra busca ou limpe os filtros.</p></div>';
      return;
    }

    list.innerHTML = products.map((product) => `
      <article class="prod-card">
        <div class="prod-card-img">
          <img src="${escapeHtml(product.image || 'assets/img/brand/icon.png')}" alt="${escapeHtml(product.name)}" loading="lazy" />
          <span class="status-pill${product.status === 'draft' ? ' is-draft' : ''}">${productStatusLabel(product)}</span>
          ${product.tag ? `<span class="tag-pill">${escapeHtml(product.tag)}</span>` : ''}
        </div>
        <div class="prod-card-body">
          <h4>${escapeHtml(product.name)}</h4>
          <div class="cat">${escapeHtml(product.category)}</div>
          <div class="${product.price ? 'price' : 'price empty'}">${formatBRL(product.price)}</div>
        </div>
        <div class="prod-card-actions">
          <a class="icon-btn" href="produto.html?p=${encodeURIComponent(product.id)}" target="_blank" rel="noopener" title="Ver no site">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver
          </a>
          <button class="icon-btn primary" type="button" data-edit-product="${escapeHtml(product.id)}" title="Editar produto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button class="icon-btn danger" type="button" data-delete-product="${escapeHtml(product.id)}" title="Excluir produto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Excluir
          </button>
        </div>
      </article>
    `).join('');
  }

  function formatLeadDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  function renderLeads() {
    const list = refs.leadsList;
    if (!list) return;

    const filterEl = document.getElementById('adminLeadsFilter');
    const filter = filterEl?.value || 'all';
    const searchEl = document.getElementById('adminLeadsSearch');
    const term = String(searchEl?.value || '').trim().toLowerCase();

    const leads = leadsCache.filter((lead) => {
      if (filter === 'open' && lead.status !== 'open') return false;
      if (filter === 'done' && lead.status !== 'done') return false;
      if (term) {
        const hay = `${lead.name} ${lead.email} ${lead.phone} ${lead.message} ${lead.source}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    if (!leads.length) {
      list.innerHTML = '<div class="admin-empty">Nenhum contato encontrado.</div>';
      return;
    }

    list.innerHTML = leads.map((lead) => `
      <article class="admin-row admin-row-lead${lead.status === 'done' ? ' is-done' : ''}">
        <div class="admin-row-lead-avatar">${escapeHtml((lead.name || '?')[0].toUpperCase())}</div>
        <div class="admin-row-main">
          <div class="admin-row-lead-header">
            <h3>${escapeHtml(lead.name || 'Contato sem nome')}</h3>
            <span class="blog-admin-status${lead.status === 'done' ? '' : ' is-draft'}">${lead.status === 'done' ? 'Resolvido' : 'Aberto'}</span>
          </div>
          <p class="admin-row-lead-contact">${escapeHtml([lead.email, lead.phone].filter(Boolean).join(' · '))}${lead.source ? ` <span class="admin-row-lead-source">${escapeHtml(lead.source)}</span>` : ''}</p>
          ${lead.message ? `<p class="admin-row-lead-msg">${escapeHtml(lead.message)}</p>` : ''}
          <small class="admin-row-lead-date">${formatLeadDate(lead.createdAt)}</small>
        </div>
        <div class="admin-row-actions">
          ${lead.email ? `<a class="blog-admin-mini" href="mailto:${escapeHtml(lead.email)}?subject=Champion%20-%20Retorno%20de%20contato" title="Responder por e-mail">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </a>` : ''}
          <button class="blog-admin-mini" type="button" data-lead-toggle="${escapeHtml(lead.id)}" title="${lead.status === 'done' ? 'Reabrir' : 'Marcar como resolvido'}">
            ${lead.status === 'done'
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>'
              : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'}
          </button>
          <button class="blog-admin-mini is-danger" type="button" data-lead-delete="${escapeHtml(lead.id)}" title="Excluir">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </article>
    `).join('');
  }

  function exportLeadsCSV() {
    if (!leadsCache.length) return;
    const header = ['Nome', 'E-mail', 'Telefone', 'Mensagem', 'Origem', 'Status', 'Data'];
    const rows = leadsCache.map((l) => [
      l.name, l.email, l.phone, l.message, l.source,
      l.status === 'done' ? 'Resolvido' : 'Aberto',
      l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR') : ''
    ].map((v) => `"${String(v || '').replace(/"/g, '""')}"`));
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-champion-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function renderStats(blogStats = { posts: 0, published: 0 }) {
    const published = productsCache.filter((product) => product.status === 'published').length;
    const drafts = productsCache.length - published;
    if (refs.statsProducts) refs.statsProducts.textContent = String(productsCache.length);
    if (refs.statsPublished) refs.statsPublished.textContent = String(published);
    if (refs.statsDrafts) refs.statsDrafts.textContent = String(drafts);
    if (refs.statsBlog) refs.statsBlog.textContent = String(blogStats.posts || 0);
    if (refs.statsLeads) refs.statsLeads.textContent = String(leadsCache.filter((lead) => lead.status !== 'done').length);
    if (refs.statsBanners) refs.statsBanners.textContent = String(bannersCache.filter((b) => b.status === 'published').length);
  }

  function resetBannerForm() {
    const form = refs.bannerForm;
    if (!form) return;
    form.reset();
    form.elements.id.value = '';
    form.elements.order.value = String(bannersCache.length + 1);
    if (refs.bannerImageUrl) refs.bannerImageUrl.value = '';
    if (refs.bannerPreview) { refs.bannerPreview.hidden = true; refs.bannerPreview.src = ''; }
    if (refs.bannerPlaceholder) refs.bannerPlaceholder.hidden = false;
    _pendingBannerFile = null;
    $('#adminBannerSubmitLabel').textContent = 'Salvar banner';
    setFeedback(refs.bannerFeedback, '');
  }

  function fillBannerForm(banner) {
    const form = refs.bannerForm;
    if (!form || !banner) return;
    form.elements.id.value = banner.id || '';
    form.elements.label.value = banner.label || '';
    form.elements.alt.value = banner.alt || '';
    form.elements.link.value = banner.link || '';
    form.elements.status.value = banner.status || 'published';
    form.elements.order.value = String(banner.order || 1);
    if (refs.bannerImageUrl) refs.bannerImageUrl.value = banner.image || '';
    if (banner.image && refs.bannerPreview) {
      refs.bannerPreview.src = banner.image;
      refs.bannerPreview.hidden = false;
      if (refs.bannerPlaceholder) refs.bannerPlaceholder.hidden = true;
    }
    _pendingBannerFile = null;
    $('#adminBannerSubmitLabel').textContent = 'Salvar alterações';
    setFeedback(refs.bannerFeedback, '');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderBanners() {
    const list = refs.bannerList;
    if (!list) return;
    if (!bannersCache.length) {
      list.innerHTML = '<div class="admin-empty">Nenhum banner cadastrado.</div>';
      return;
    }
    list.innerHTML = bannersCache.map((b) => `
      <article class="admin-row admin-row-banner">
        <img src="${escapeHtml(b.image || 'assets/img/brand/icon.png')}" alt="" loading="lazy" />
        <div class="admin-row-main">
          <div class="admin-row-banner-label">${escapeHtml(b.label)}</div>
          <div class="admin-row-banner-link">${escapeHtml(b.link)}</div>
          <span class="blog-admin-status${b.status === 'draft' ? ' is-draft' : ''}">${b.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
        </div>
        <div class="admin-row-actions">
          <button class="blog-admin-mini" type="button" data-edit-banner="${escapeHtml(b.id)}">Editar</button>
          <button class="blog-admin-mini is-danger" type="button" data-delete-banner="${escapeHtml(b.id)}">Excluir</button>
        </div>
      </article>
    `).join('');
  }

  async function loadSettings() {
    const form = refs.settingsForm;
    if (!form) return;
    const settings = await store.getSettings();
    Object.entries(settings).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value || '';
    });
  }

  async function loadAdminData() {
    [productsCache, leadsCache, bannersCache] = await Promise.all([
      store.getProducts(),
      store.getLeads(),
      store.getBanners()
    ]);

    /* Auto-seed: se o catálogo está vazio, popula com os produtos do código.
       Útil no primeiro login pra já trazer a linha Champion pra dentro do BD. */
    if (productsCache.length === 0) {
      try {
        console.info('[admin] catálogo vazio, fazendo seed dos produtos padrão...');
        await store.seedProducts();
        productsCache = await store.getProducts();
        window.ChampionToast?.('Catálogo populado com a linha Champion.');
      } catch (err) {
        console.warn('[admin] seed automático falhou:', err.message);
      }
    }

    const blogStats = await store.getBlogStats().catch(() => ({ posts: 0, published: 0 }));
    renderProducts();
    renderLeads();
    renderBanners();
    renderStats(blogStats);
    await loadSettings();
    resetProductForm();
    resetBannerForm();
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

  function setupEvents() {
    $$('button[data-admin-tab]').forEach((button) => {
      button.addEventListener('click', () => setTab(button.dataset.adminTab));
    });

    refs.loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFeedback(refs.loginFeedback, '');
      setBusy(refs.loginForm, true, 'Entrando...');
      try {
        await store.login(refs.loginForm.elements.email.value, refs.loginForm.elements.password.value);
        await syncAuth(true);
      } catch (error) {
        setFeedback(refs.loginFeedback, friendlyAdminError(error));
      } finally {
        setBusy(refs.loginForm, false);
      }
    });

    $('#adminLogout')?.addEventListener('click', async () => {
      await store.logout();
      await syncAuth(false);
    });

    async function doSeedProducts(confirmed) {
      if (!confirmed && !window.confirm('Restaurar o catálogo padrão de produtos?')) return;
      try {
        await store.seedProducts();
        productsCache = await store.getProducts();
        renderProducts();
        renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
        window.ChampionToast?.('Produtos restaurados.');
      } catch (error) {
        setFeedback(refs.productFeedback, friendlyAdminError(error));
        window.ChampionToast?.(friendlyAdminError(error));
      }
    }

    $('#adminSeedProducts')?.addEventListener('click', () => doSeedProducts(false));
    $('#adminNewProduct')?.addEventListener('click', openNewProductDrawer);

    refs.productSearch?.addEventListener('input', renderProducts);
    $('#adminProductSpeciesFilter')?.addEventListener('change', renderProducts);
    $('#adminProductStatusFilter')?.addEventListener('change', renderProducts);

    /* Botões de fechar drawer */
    document.querySelectorAll('[data-close-drawer]').forEach((b) => {
      b.addEventListener('click', closeProductDrawer);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProductDrawer();
    });

    /* Botão de seed na empty state */
    refs.productList?.addEventListener('click', (e) => {
      if (e.target.closest('[data-seed-from-empty]')) doSeedProducts(true);
    });

    refs.productForm?.elements.name?.addEventListener('input', () => {
      if (!refs.productForm.elements.id.value && refs.productForm.dataset.slugEdited !== 'true') {
        refs.productForm.elements.id.value = slugify(refs.productForm.elements.name.value);
      }
    });

    refs.productForm?.elements.id?.addEventListener('input', () => {
      refs.productForm.dataset.slugEdited = 'true';
    });

    refs.productForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!refs.productForm.reportValidity()) return;
      setBusy(refs.productForm, true);
      let savedProduct = null;
      try {
        const data = Object.fromEntries(new FormData(refs.productForm).entries());
        if (_pendingProductFile) {
          setFeedback(refs.productFeedback, 'Enviando imagem...', 'success');
          data.image = await store.uploadImage(_pendingProductFile, 'products');
          _pendingProductFile = null;
        }
        savedProduct = await store.saveProduct(data);
        productsCache = await store.getProducts();
        renderProducts();
        renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
        window.ChampionToast?.('Produto salvo.');
        closeProductDrawer();
        resetProductForm();
      } catch (error) {
        setFeedback(refs.productFeedback, friendlyAdminError(error));
      } finally {
        setBusy(refs.productForm, false);
      }
    });

    refs.productList?.addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-edit-product]');
      const del = event.target.closest('[data-delete-product]');
      if (edit) {
        fillProductForm(productsCache.find((product) => product.id === edit.dataset.editProduct));
      }
      if (del) {
        const product = productsCache.find((item) => item.id === del.dataset.deleteProduct);
        if (!product || !window.confirm(`Excluir "${product.name}"?\n\nEssa ação não pode ser desfeita.`)) return;
        try {
          await store.deleteProduct(product.id);
          productsCache = await store.getProducts();
          renderProducts();
          renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
          window.ChampionToast?.('Produto excluído.');
        } catch (error) {
          window.ChampionToast?.(friendlyAdminError(error));
        }
      }
    });

    refs.settingsForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      setBusy(refs.settingsForm, true);
      try {
        await store.saveSettings(Object.fromEntries(new FormData(refs.settingsForm).entries()));
        setFeedback(refs.settingsFeedback, 'Configurações salvas.', 'success');
        window.setTimeout(() => setFeedback(refs.settingsFeedback, ''), 2200);
      } catch (error) {
        setFeedback(refs.settingsFeedback, friendlyAdminError(error));
      } finally {
        setBusy(refs.settingsForm, false);
      }
    });

    $('#adminAddExampleLead')?.addEventListener('click', async () => {
      await store.saveLead({
        id: `lead-${Date.now()}`,
        name: 'Contato de demonstração',
        email: 'cliente@exemplo.com',
        phone: '(62) 99999-0000',
        message: 'Tenho interesse em receber orientação técnica sobre mineralização.',
        source: 'Painel administrativo'
      });
      leadsCache = await store.getLeads();
      renderLeads();
      renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
    });

    document.getElementById('adminExportLeads')?.addEventListener('click', exportLeadsCSV);

    document.getElementById('adminLeadsFilter')?.addEventListener('change', renderLeads);
    document.getElementById('adminLeadsSearch')?.addEventListener('input', renderLeads);

    /* ── Product image upload ── */
    refs.productPickFile?.addEventListener('click', () => refs.productFile?.click());
    refs.productFile?.addEventListener('change', () => {
      const file = refs.productFile.files[0];
      if (!file) return;
      _pendingProductFile = file;
      const url = URL.createObjectURL(file);
      if (refs.productPreview) { refs.productPreview.src = url; refs.productPreview.hidden = false; }
      if (refs.productForm?.elements.image) refs.productForm.elements.image.value = url;
    });

    /* ── Banner upload area ── */
    refs.bannerUploadArea?.addEventListener('click', () => refs.bannerFile?.click());
    refs.bannerFile?.addEventListener('change', () => {
      const file = refs.bannerFile.files[0];
      if (!file) return;
      _pendingBannerFile = file;
      const url = URL.createObjectURL(file);
      if (refs.bannerPreview) { refs.bannerPreview.src = url; refs.bannerPreview.hidden = false; }
      if (refs.bannerPlaceholder) refs.bannerPlaceholder.hidden = true;
    });

    /* ── Banner form submit ── */
    $('#adminNewBanner')?.addEventListener('click', resetBannerForm);

    refs.bannerForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!refs.bannerForm.reportValidity()) return;
      setBusy(refs.bannerForm, true);
      try {
        let imageUrl = refs.bannerImageUrl?.value || '';
        if (_pendingBannerFile) {
          setFeedback(refs.bannerFeedback, 'Enviando imagem...', 'success');
          imageUrl = await store.uploadImage(_pendingBannerFile, 'banners');
        }
        if (!imageUrl) {
          setFeedback(refs.bannerFeedback, 'Selecione uma imagem para o banner.');
          setBusy(refs.bannerForm, false);
          return;
        }
        const data = Object.fromEntries(new FormData(refs.bannerForm).entries());
        data.image = imageUrl;
        const saved = await store.saveBanner(data);
        bannersCache = await store.getBanners();
        renderBanners();
        renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
        setFeedback(refs.bannerFeedback, 'Banner salvo com sucesso.', 'success');
        fillBannerForm(saved);
        _pendingBannerFile = null;
        window.ChampionToast?.('Banner salvo.');
      } catch (error) {
        setFeedback(refs.bannerFeedback, friendlyAdminError(error));
      } finally {
        setBusy(refs.bannerForm, false);
      }
    });

    /* ── Banner list actions ── */
    refs.bannerList?.addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-edit-banner]');
      const del  = event.target.closest('[data-delete-banner]');
      if (edit) {
        fillBannerForm(bannersCache.find((b) => b.id === edit.dataset.editBanner));
      }
      if (del) {
        const banner = bannersCache.find((b) => b.id === del.dataset.deleteBanner);
        if (!banner || !window.confirm(`Excluir o banner "${banner.label}"?`)) return;
        try {
          await store.deleteBanner(banner.id);
          bannersCache = await store.getBanners();
          renderBanners();
          renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
          resetBannerForm();
          window.ChampionToast?.('Banner excluído.');
        } catch (error) {
          setFeedback(refs.bannerFeedback, friendlyAdminError(error));
        }
      }
    });

    refs.leadsList?.addEventListener('click', async (event) => {
      const toggle = event.target.closest('[data-lead-toggle]');
      const del    = event.target.closest('[data-lead-delete]');

      if (toggle) {
        const lead = leadsCache.find((l) => l.id === toggle.dataset.leadToggle);
        if (!lead) return;
        toggle.disabled = true;
        try {
          await store.saveLead(Object.assign({}, lead, { status: lead.status === 'done' ? 'open' : 'done' }));
          leadsCache = await store.getLeads();
          renderLeads();
          renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
        } catch (error) {
          console.error(error);
        }
      }

      if (del) {
        const lead = leadsCache.find((l) => l.id === del.dataset.leadDelete);
        if (!lead || !window.confirm(`Excluir contato de "${lead.name || 'sem nome'}"?`)) return;
        del.disabled = true;
        try {
          await store.deleteLead(lead.id);
          leadsCache = await store.getLeads();
          renderLeads();
          renderStats(await store.getBlogStats().catch(() => ({ posts: 0 })));
        } catch (error) {
          console.error(error);
        }
      }
    });
  }

  const LOCAL_USER_LABEL = 'admin@champion.com.br';
  let appEverLoaded = false;

  async function syncAuth(logged, user = null) {
    if (!logged) {
      /* After the app was shown (logout), redirect to the dedicated login page.
         On initial check (app never shown), always display the embedded form. */
      if (appEverLoaded) {
        window.location.replace('login-admin.html');
        return;
      }
      if (refs.login) refs.login.hidden = false;
      if (refs.app) refs.app.hidden = true;
      return;
    }
    appEverLoaded = true;
    if (refs.login) refs.login.hidden = true;
    if (refs.app) refs.app.hidden = false;
    if (refs.mode) refs.mode.textContent = store.isFirebase ? 'Firebase' : 'Local';
    if (refs.user) refs.user.textContent = user?.email || (store.isFirebase ? 'Administrador Firebase' : LOCAL_USER_LABEL);
    await loadAdminData();
  }

  setupEvents();
  if (store.isFirebase) {
    store.onAuthChanged((logged, user) => {
      syncAuth(logged, user);
    });
  } else {
    await syncAuth(store.isAdminLogged());
  }

  if (refs.mode) refs.mode.textContent = store.isFirebase ? 'Firebase' : 'Local';
})();
