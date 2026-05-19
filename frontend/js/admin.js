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

  const SPECIES_LABELS = {
    bovinos: 'Bovinos', equinos: 'Equinos', suinos: 'Suínos', aves: 'Aves',
    minerais: 'Minerais', ambientes: 'Ambientes', veterinario: 'Veterinário'
  };

  function updateCatalogKpis() {
    const total = productsCache.length;
    const pub = productsCache.filter((p) => p.status === 'published').length;
    const draft = total - pub;
    const prices = productsCache.map((p) => Number(p.price) || 0).filter((n) => n > 0);
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('catKpiTotal', total);
    set('catKpiPublished', pub);
    set('catKpiPubPct', total ? `${Math.round((pub / total) * 100)}% do catálogo` : '—');
    set('catKpiDrafts', draft);
    set('catKpiDraftHint', draft ? 'Aguardando publicação' : 'Tudo publicado ✓');
    set('catKpiAvgPrice', formatBRL(avg));
    set('catKpiPriceRange', prices.length ? `de ${formatBRL(min)} a ${formatBRL(max)}` : 'Sem preços definidos');
  }

  function renderResultBar(filtered) {
    const bar = document.getElementById('catResultBar');
    if (!bar) return;
    const term = String(refs.productSearch?.value || '').trim();
    const speciesFilter = String(document.getElementById('adminProductSpeciesFilter')?.value || '');
    const statusFilter = String(document.getElementById('adminProductStatusFilter')?.value || '');
    const chips = [];
    if (term) chips.push({ key: 'term', label: `Busca: "${term}"` });
    if (speciesFilter) chips.push({ key: 'species', label: `Espécie: ${SPECIES_LABELS[speciesFilter] || speciesFilter}` });
    if (statusFilter) chips.push({ key: 'status', label: `Status: ${statusFilter === 'published' ? 'Publicados' : 'Rascunhos'}` });

    const countStr = filtered.length === productsCache.length
      ? `<strong>${productsCache.length}</strong> produtos no catálogo`
      : `<strong>${filtered.length}</strong> de ${productsCache.length} produtos`;

    bar.innerHTML = `
      <div class="cat-result-count">${countStr}</div>
      <div class="cat-active-filters">
        ${chips.map((c) => `
          <span class="cat-filter-chip">${c.label}
            <button type="button" data-clear-filter="${c.key}" aria-label="Remover filtro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </span>
        `).join('')}
        ${chips.length > 1 ? '<button class="cat-clear-filters" type="button" data-clear-filter="all">Limpar todos</button>' : ''}
      </div>
    `;
  }

  function sortProducts(list, mode) {
    const arr = list.slice();
    if (mode === 'name-asc') return arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    if (mode === 'name-desc') return arr.sort((a, b) => String(b.name).localeCompare(String(a.name), 'pt-BR'));
    if (mode === 'price-asc') return arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    if (mode === 'price-desc') return arr.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (mode === 'newest') return arr.sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return arr; /* ordem padrão (já vem ordenada do store) */
  }

  function renderProducts() {
    const list = refs.productList;
    if (!list) return;
    const term = String(refs.productSearch?.value || '').trim().toLowerCase();
    const speciesFilter = String(document.getElementById('adminProductSpeciesFilter')?.value || '');
    const statusFilter = String(document.getElementById('adminProductStatusFilter')?.value || '');
    const sortMode = String(document.getElementById('adminProductSort')?.value || 'order');

    let products = productsCache.filter((product) => {
      const haystack = `${product.name} ${product.category} ${product.excerpt} ${product.id}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (speciesFilter && product.species !== speciesFilter) return false;
      if (statusFilter && product.status !== statusFilter) return false;
      return true;
    });
    products = sortProducts(products, sortMode);

    /* KPIs e barra de resultado */
    updateCatalogKpis();
    renderResultBar(products);

    /* Mantém o data-view-mode (controlado pelo toggle button) */
    if (!list.getAttribute('data-view-mode')) list.setAttribute('data-view-mode', 'grid');

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
      list.innerHTML = '<div class="prod-empty-state"><h3>Nenhum produto bate com os filtros</h3><p>Tente outra busca ou ajuste os filtros acima.</p><button class="ap-btn ap-btn-ghost" type="button" data-clear-filter="all" style="margin-top:14px">Limpar todos os filtros</button></div>';
      return;
    }

    list.innerHTML = products.map((product) => `
      <article class="prod-card" data-status="${escapeHtml(product.status)}">
        <div class="prod-card-img">
          <img src="${escapeHtml(product.image || 'assets/img/brand/icon.png')}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.opacity='0.3'" />
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

  const PAGE_LABELS = {
    home: 'Página Inicial', produtos: 'Produtos', blog: 'Blog',
    sobre: 'Quem Somos', 'calculo-dose': 'Cálculo de Dose'
  };

  function openBannerDrawer(title, subtitle) {
    const drawer = document.getElementById('bannerDrawer');
    const t = document.getElementById('bannerDrawerTitle');
    const s = document.getElementById('bannerDrawerSub');
    if (t && title) t.textContent = title;
    if (s && subtitle) s.textContent = subtitle;
    if (drawer) { drawer.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  }
  function closeBannerDrawer() {
    const drawer = document.getElementById('bannerDrawer');
    if (drawer) { drawer.classList.remove('is-open'); document.body.style.overflow = ''; }
  }

  /* In-memory slide state for the open banner */
  let _bannerSlides = [];
  function renderBannerSlides() {
    const wrap = document.getElementById('adminBannerSlides');
    const counter = document.getElementById('slidesCount');
    if (!wrap) return;
    if (counter) counter.textContent = _bannerSlides.length + '/5';
    if (!_bannerSlides.length) {
      wrap.innerHTML = '<div style="padding:24px 16px;text-align:center;color:#9EA6B4;font-size:13px;border:1.5px dashed #E4E8EF;border-radius:10px"><strong style="color:#15191F;display:block;margin-bottom:6px">Nenhuma foto ainda</strong>Clique em "+ Foto" para adicionar o primeiro slide do carrossel.</div>';
      return;
    }
    wrap.innerHTML = _bannerSlides.map((s, i) => `
      <div class="bp-row" data-slide-row="${i}" style="background:white;border:1px solid #E5E8EF;border-radius:10px;padding:14px">
        <div class="bp-row-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <strong style="font-size:13px;color:#15191F">Slide ${i + 1}</strong>
          <button type="button" data-remove-slide="${i}" style="background:none;border:none;color:#C13808;font-size:12px;font-weight:600;cursor:pointer;padding:2px 6px;border-radius:5px">Remover</button>
        </div>
        <div style="display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:start">
          <div>
            <div style="aspect-ratio:16/9;background:#F4F5F8;border:1.5px dashed #E4E8EF;border-radius:7px;overflow:hidden;cursor:pointer;position:relative" data-slide-upload="${i}">
              ${s.image ? `<img src="${escapeHtml(s.image)}" style="width:100%;height:100%;object-fit:cover" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9EA6B4;font-size:11px;text-align:center;padding:6px">Clique<br>p/ upload</div>'}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input type="text" data-slide-field="eyebrow" data-slide-idx="${i}" value="${escapeHtml(s.eyebrow || '')}" placeholder="Eyebrow (ex: Página Inicial)" style="padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:7px;font-size:13px;background:#F9FAFB;outline:none" />
            <input type="text" data-slide-field="title" data-slide-idx="${i}" value="${escapeHtml(s.title || '')}" placeholder="Título principal" style="padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:7px;font-size:13px;background:#F9FAFB;outline:none;font-weight:600" />
            <input type="text" data-slide-field="subtitle" data-slide-idx="${i}" value="${escapeHtml(s.subtitle || '')}" placeholder="Descrição/subtítulo" style="padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:7px;font-size:13px;background:#F9FAFB;outline:none" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <input type="text" data-slide-field="link" data-slide-idx="${i}" value="${escapeHtml(s.link || '')}" placeholder="Link (opcional)" style="padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:7px;font-size:13px;background:#F9FAFB;outline:none" />
              <input type="text" data-slide-field="cta" data-slide-idx="${i}" value="${escapeHtml(s.cta || '')}" placeholder="Texto do botão" style="padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:7px;font-size:13px;background:#F9FAFB;outline:none" />
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function resetBannerForm() {
    const form = refs.bannerForm;
    if (!form) return;
    form.reset();
    form.elements.id.value = '';
    form.elements.order.value = String(bannersCache.length + 1);
    if (form.elements.page) form.elements.page.value = 'home';
    if (form.elements.aspect) form.elements.aspect.value = '16/9';
    if (form.elements.transitionMs) form.elements.transitionMs.value = '6';
    _bannerSlides = [{ image: '', eyebrow: '', title: '', subtitle: '', link: '', cta: '' }];
    renderBannerSlides();
    $('#adminBannerSubmitLabel').textContent = 'Salvar banner';
    setFeedback(refs.bannerFeedback, '');
  }

  function openNewBannerDrawer() {
    resetBannerForm();
    openBannerDrawer('Novo banner', 'Configure página, proporção, slides e texto sobreposto.');
  }

  function fillBannerForm(banner) {
    const form = refs.bannerForm;
    if (!form || !banner) return;
    form.elements.id.value = banner.id || '';
    if (form.elements.page) form.elements.page.value = banner.page || 'home';
    if (form.elements.aspect) form.elements.aspect.value = banner.aspect || '16/9';
    if (form.elements.transitionMs) form.elements.transitionMs.value = String(Math.round((banner.transitionMs || 6000) / 1000));
    form.elements.alt.value = banner.alt || '';
    form.elements.status.value = banner.status || 'published';
    form.elements.order.value = String(banner.order || 1);
    _bannerSlides = (banner.slides && banner.slides.length)
      ? banner.slides.map((s) => Object.assign({ image: '', eyebrow: '', title: '', subtitle: '', link: '', cta: '' }, s))
      : [{ image: banner.image || '', eyebrow: banner.label || '', title: '', subtitle: '', link: banner.link || '', cta: '' }];
    renderBannerSlides();
    $('#adminBannerSubmitLabel').textContent = 'Salvar alterações';
    setFeedback(refs.bannerFeedback, '');
    openBannerDrawer('Editar banner', `Página: ${PAGE_LABELS[banner.page] || 'Página Inicial'}`);
  }

  function renderBanners() {
    const list = refs.bannerList;
    if (!list) return;
    const pageFilter = String(document.getElementById('bannerPageFilter')?.value || '');
    const items = bannersCache.filter((b) => !pageFilter || b.page === pageFilter);

    if (!bannersCache.length) {
      list.innerHTML = '<div class="prod-empty-state" style="grid-column:1/-1"><h3>Nenhum banner cadastrado</h3><p>Crie banners por página com carrossel de até 5 fotos e texto sobreposto.</p></div>';
      return;
    }
    if (!items.length) {
      list.innerHTML = '<div class="prod-empty-state" style="grid-column:1/-1"><h3>Sem banners nessa página</h3><p>Clique em "+ Novo banner" para criar.</p></div>';
      return;
    }

    list.innerHTML = items.map((b) => {
      const firstSlide = (b.slides && b.slides[0]) || {};
      const imgSrc = firstSlide.image || b.image || '';
      const slideCount = (b.slides && b.slides.length) || (imgSrc ? 1 : 0);
      return `
        <article class="prod-card">
          <div class="prod-card-img" style="aspect-ratio:${b.aspect || '16/9'}">
            ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(b.alt || '')}" loading="lazy" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9EA6B4;font-size:12px">Sem imagem</div>'}
            <span class="status-pill${b.status === 'draft' ? ' is-draft' : ''}">${b.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
            <span class="tag-pill">${escapeHtml(PAGE_LABELS[b.page] || b.page || 'Home')}</span>
          </div>
          <div class="prod-card-body">
            <h4>${escapeHtml(firstSlide.title || firstSlide.eyebrow || b.label || 'Banner sem título')}</h4>
            <div class="cat">${slideCount} ${slideCount === 1 ? 'foto' : 'fotos'} · ${b.aspect || '16/9'} · ${Math.round((b.transitionMs || 6000) / 1000)}s</div>
          </div>
          <div class="prod-card-actions">
            <button class="icon-btn primary" type="button" data-edit-banner="${escapeHtml(b.id)}" title="Editar banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
            <button class="icon-btn danger" type="button" data-delete-banner="${escapeHtml(b.id)}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
              Excluir
            </button>
          </div>
        </article>
      `;
    }).join('');
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
    $('#adminProductSort')?.addEventListener('change', renderProducts);

    /* View mode toggle (grid ↔ list) */
    document.querySelectorAll('.cat-view-toggle button[data-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-view-mode');
        document.querySelectorAll('.cat-view-toggle button').forEach((b) => b.classList.toggle('is-active', b === btn));
        if (refs.productList) refs.productList.setAttribute('data-view-mode', mode);
      });
    });

    /* Clear filter chips */
    document.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('[data-clear-filter]');
      if (!clearBtn) return;
      const which = clearBtn.getAttribute('data-clear-filter');
      if (which === 'term' || which === 'all') {
        if (refs.productSearch) refs.productSearch.value = '';
      }
      if (which === 'species' || which === 'all') {
        const f = $('#adminProductSpeciesFilter'); if (f) f.value = '';
      }
      if (which === 'status' || which === 'all') {
        const f = $('#adminProductStatusFilter'); if (f) f.value = '';
      }
      renderProducts();
    });

    /* Botões de fechar drawer (genérico — fecha o .prod-drawer mais próximo) */
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-drawer]');
      if (!closeBtn) return;
      const drawer = closeBtn.closest('.prod-drawer');
      if (drawer) {
        drawer.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.prod-drawer.is-open').forEach((d) => {
        d.classList.remove('is-open');
      });
      document.body.style.overflow = '';
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

    /* ── Banner form submit + slide management ── */
    $('#adminNewBanner')?.addEventListener('click', openNewBannerDrawer);
    $('#bannerPageFilter')?.addEventListener('change', renderBanners);

    /* Add slide */
    $('#adminBannerAddSlide')?.addEventListener('click', () => {
      if (_bannerSlides.length >= 5) {
        setFeedback(refs.bannerFeedback, 'Máximo de 5 fotos por banner.');
        return;
      }
      _bannerSlides.push({ image: '', eyebrow: '', title: '', subtitle: '', link: '', cta: '' });
      renderBannerSlides();
    });

    /* Slide events (delegation) */
    $('#adminBannerSlides')?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-slide]');
      if (removeBtn) {
        const idx = parseInt(removeBtn.getAttribute('data-remove-slide'), 10);
        _bannerSlides.splice(idx, 1);
        renderBannerSlides();
        return;
      }
      const upload = e.target.closest('[data-slide-upload]');
      if (upload) {
        const idx = parseInt(upload.getAttribute('data-slide-upload'), 10);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          if (file.size > 4 * 1024 * 1024) { alert('Imagem muito grande. Máximo 4 MB.'); return; }
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              _bannerSlides[idx].image = reader.result;
              renderBannerSlides();
              try {
                const url = await store.uploadImage(file, 'banners');
                _bannerSlides[idx].image = url;
                renderBannerSlides();
              } catch (err) {
                /* Fallback: mantém base64 (funciona localmente) */
                console.warn('Upload do banner falhou, usando preview local:', err.message);
              }
            };
            reader.readAsDataURL(file);
          } catch (err) {
            setFeedback(refs.bannerFeedback, 'Erro no upload: ' + err.message);
          }
        });
        input.click();
      }
    });
    $('#adminBannerSlides')?.addEventListener('input', (e) => {
      const field = e.target.closest('[data-slide-field]');
      if (!field) return;
      const idx = parseInt(field.getAttribute('data-slide-idx'), 10);
      const key = field.getAttribute('data-slide-field');
      if (_bannerSlides[idx]) _bannerSlides[idx][key] = field.value;
    });

    refs.bannerForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!refs.bannerForm.reportValidity()) return;
      const validSlides = _bannerSlides.filter((s) => s.image);
      if (!validSlides.length) {
        setFeedback(refs.bannerFeedback, 'Adicione ao menos uma foto ao carrossel.');
        return;
      }
      setBusy(refs.bannerForm, true);
      try {
        const data = Object.fromEntries(new FormData(refs.bannerForm).entries());
        /* Converte segundos do form em ms */
        data.transitionMs = Math.max(2, Number(data.transitionMs || 6)) * 1000;
        data.slides = validSlides;
        const saved = await store.saveBanner(data);
        bannersCache = await store.getBanners();
        renderBanners();
        window.ChampionToast?.('Banner salvo.');
        closeBannerDrawer();
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
      /* Se há form de login embarcado neste HTML, usa ele.
         Caso contrário, redireciona para a página dedicada login-admin.html. */
      if (refs.login) {
        refs.login.hidden = false;
        if (refs.app) refs.app.hidden = true;
        return;
      }
      window.location.replace('login-admin.html');
      return;
    }
    appEverLoaded = true;
    if (refs.login) refs.login.hidden = true;
    if (refs.app) refs.app.hidden = false;
    if (refs.mode) refs.mode.textContent = store.isFirebase ? 'Firebase' : 'Local';
    if (refs.user) refs.user.textContent = user?.email || (store.isFirebase ? 'Administrador Firebase' : LOCAL_USER_LABEL);
    await loadAdminData();
  }

  /* ── Taxonomia (Categorias) ─────────────────────────────────── */
  let taxonomyCache = { groups: [], species: [], uses: [] };

  function taxonomySlugify(str) {
    return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function renderTaxonomyList(type) {
    const wrap = document.getElementById('taxonomy' + type.charAt(0).toUpperCase() + type.slice(1));
    if (!wrap) return;
    const items = taxonomyCache[type] || [];
    if (!items.length) {
      wrap.innerHTML = '<div style="padding:18px;text-align:center;color:#9EA6B4;font-size:12.5px;border:1.5px dashed #E4E8EF;border-radius:8px">Nenhum item. Clique em "+ Adicionar" para criar.</div>';
      return;
    }
    wrap.innerHTML = items.map((it, i) => `
      <div class="bp-row" data-tax-row="${type}-${i}" style="background:#FAFBFC;border:1px solid #E5E8EF;border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;margin-bottom:6px">
        <input data-tax-field="name" data-tax-type="${type}" data-tax-idx="${i}" type="text" value="${escapeHtml(it.name)}" placeholder="Nome exibido" style="padding:7px 10px;border:1.5px solid #E4E8EF;border-radius:6px;font-size:12.5px;background:white;outline:none" />
        <input data-tax-field="slug" data-tax-type="${type}" data-tax-idx="${i}" type="text" value="${escapeHtml(it.slug)}" placeholder="slug" style="padding:7px 10px;border:1.5px solid #E4E8EF;border-radius:6px;font-size:12.5px;background:white;outline:none;font-family:monospace" />
        <button type="button" data-tax-remove="${type}-${i}" style="background:none;border:none;color:#C13808;font-size:18px;cursor:pointer;padding:0 8px;line-height:1">×</button>
      </div>
    `).join('');
  }

  async function loadTaxonomy() {
    try {
      taxonomyCache = await store.getTaxonomy();
    } catch (err) {
      console.warn('[admin] taxonomy load:', err.message);
    }
    renderTaxonomyList('groups');
    renderTaxonomyList('species');
    renderTaxonomyList('uses');
  }

  /* Wire taxonomy events */
  document.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-tax-add]');
    if (addBtn) {
      const type = addBtn.getAttribute('data-tax-add');
      if (!taxonomyCache[type]) taxonomyCache[type] = [];
      taxonomyCache[type].push({ slug: '', name: '', order: taxonomyCache[type].length + 1 });
      renderTaxonomyList(type);
      return;
    }
    const removeBtn = e.target.closest('[data-tax-remove]');
    if (removeBtn) {
      const [type, idxStr] = removeBtn.getAttribute('data-tax-remove').split('-');
      const idx = parseInt(idxStr, 10);
      if (taxonomyCache[type]) {
        taxonomyCache[type].splice(idx, 1);
        renderTaxonomyList(type);
      }
      return;
    }
    if (e.target.id === 'adminSaveTaxonomy') {
      const feedback = document.getElementById('taxonomyFeedback');
      try {
        /* auto-generate slug se vazio */
        ['groups', 'species', 'uses'].forEach((type) => {
          taxonomyCache[type].forEach((it) => {
            if (it.name && !it.slug) it.slug = taxonomySlugify(it.name);
          });
        });
        await store.saveTaxonomy(taxonomyCache);
        taxonomyCache = await store.getTaxonomy();
        renderTaxonomyList('groups');
        renderTaxonomyList('species');
        renderTaxonomyList('uses');
        setFeedback(feedback, 'Categorias salvas. Os filtros do catálogo já refletem as mudanças.', 'success');
        window.ChampionToast?.('Categorias salvas.');
      } catch (err) {
        setFeedback(feedback, friendlyAdminError(err));
      }
    }
  });
  document.addEventListener('input', (e) => {
    const field = e.target.closest('[data-tax-field]');
    if (!field) return;
    const type = field.getAttribute('data-tax-type');
    const idx = parseInt(field.getAttribute('data-tax-idx'), 10);
    const key = field.getAttribute('data-tax-field');
    if (taxonomyCache[type] && taxonomyCache[type][idx]) {
      taxonomyCache[type][idx][key] = field.value;
    }
  });

  /* ── Cálculo de Dose ─────────────────────────────────────────── */
  let doseConfigCache = { products: {} };
  const DOSE_KEY = 'champion-admin-dose-config';

  function readDoseConfig() {
    try {
      if (store.isFirebase) return null; /* loaded from settings doc later */
      const raw = localStorage.getItem(DOSE_KEY);
      return raw ? JSON.parse(raw) : { products: {} };
    } catch (e) { return { products: {} }; }
  }
  function writeDoseConfig(cfg) {
    try { localStorage.setItem(DOSE_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  async function loadDoseConfig() {
    /* In Firebase mode, store config inside siteSettings/main as 'doseConfig' field */
    if (store.isFirebase) {
      try {
        const settings = await store.getSettings();
        doseConfigCache = settings.doseConfig || { products: {} };
      } catch (err) {
        doseConfigCache = { products: {} };
      }
    } else {
      doseConfigCache = readDoseConfig() || { products: {} };
    }
    renderDoseList();
  }

  function renderDoseList() {
    const wrap = document.getElementById('doseProductList');
    if (!wrap) return;
    if (!productsCache.length) {
      wrap.innerHTML = '<div style="padding:24px;text-align:center;color:#9EA6B4;font-size:13px;border:1.5px dashed #E4E8EF;border-radius:10px">Nenhum produto cadastrado. Cadastre produtos na aba Catálogo primeiro.</div>';
      return;
    }
    wrap.innerHTML = productsCache.map((p) => {
      const cfg = doseConfigCache.products[p.id] || { enabled: false, formula: '', unit: 'g', description: '' };
      const checked = cfg.enabled ? 'checked' : '';
      return `
        <div data-dose-row="${escapeHtml(p.id)}" style="background:white;border:1px solid #E5E8EF;border-radius:10px;padding:14px 16px;${cfg.enabled ? '' : 'opacity:0.7'}">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:${cfg.enabled ? '12px' : '0'}">
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;flex:1">
              <input type="checkbox" data-dose-enabled="${escapeHtml(p.id)}" ${checked} style="width:18px;height:18px;accent-color:#EC4815" />
              <img src="${escapeHtml(p.image || 'assets/img/brand/icon.png')}" alt="" style="width:42px;height:42px;border-radius:6px;object-fit:contain;background:#F4F5F8;border:1px solid #EEF0F4;padding:3px" />
              <div style="flex:1">
                <div style="font-weight:600;font-size:13.5px;color:#15191F">${escapeHtml(p.name)}</div>
                <div style="font-size:11.5px;color:#9EA6B4">${escapeHtml(p.category)}</div>
              </div>
            </label>
          </div>
          <div data-dose-config="${escapeHtml(p.id)}" style="${cfg.enabled ? 'display:grid' : 'display:none'};grid-template-columns:2fr 100px;gap:10px;margin-top:8px">
            <div>
              <label style="font-size:11.5px;font-weight:600;color:#687080;display:block;margin-bottom:4px">Fórmula (JavaScript)</label>
              <input type="text" data-dose-formula="${escapeHtml(p.id)}" value="${escapeHtml(cfg.formula)}" placeholder="0.06 * cabecas * dias" style="width:100%;padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:6px;font-size:12.5px;font-family:monospace;background:#F9FAFB;outline:none" />
            </div>
            <div>
              <label style="font-size:11.5px;font-weight:600;color:#687080;display:block;margin-bottom:4px">Unidade</label>
              <select data-dose-unit="${escapeHtml(p.id)}" style="width:100%;padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:6px;font-size:12.5px;background:white;outline:none">
                <option value="g" ${cfg.unit === 'g' ? 'selected' : ''}>g</option>
                <option value="kg" ${cfg.unit === 'kg' ? 'selected' : ''}>kg</option>
                <option value="ml" ${cfg.unit === 'ml' ? 'selected' : ''}>ml</option>
                <option value="L" ${cfg.unit === 'L' ? 'selected' : ''}>L</option>
                <option value="cap" ${cfg.unit === 'cap' ? 'selected' : ''}>cápsulas</option>
              </select>
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:11.5px;font-weight:600;color:#687080;display:block;margin-bottom:4px">Observação exibida ao usuário</label>
              <input type="text" data-dose-description="${escapeHtml(p.id)}" value="${escapeHtml(cfg.description)}" placeholder="Misturar no sal ou ração. Não usar em fêmeas em lactação." style="width:100%;padding:8px 10px;border:1.5px solid #E4E8EF;border-radius:6px;font-size:12.5px;background:#F9FAFB;outline:none" />
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* Wire dose events */
  document.addEventListener('change', (e) => {
    const en = e.target.closest('[data-dose-enabled]');
    if (en) {
      const id = en.getAttribute('data-dose-enabled');
      if (!doseConfigCache.products[id]) doseConfigCache.products[id] = { enabled: false, formula: '', unit: 'g', description: '' };
      doseConfigCache.products[id].enabled = en.checked;
      renderDoseList();
      return;
    }
    const unit = e.target.closest('[data-dose-unit]');
    if (unit) {
      const id = unit.getAttribute('data-dose-unit');
      if (!doseConfigCache.products[id]) doseConfigCache.products[id] = { enabled: true, formula: '', unit: 'g', description: '' };
      doseConfigCache.products[id].unit = unit.value;
    }
  });
  document.addEventListener('input', (e) => {
    const formula = e.target.closest('[data-dose-formula]');
    if (formula) {
      const id = formula.getAttribute('data-dose-formula');
      if (!doseConfigCache.products[id]) doseConfigCache.products[id] = { enabled: true, formula: '', unit: 'g', description: '' };
      doseConfigCache.products[id].formula = formula.value;
      return;
    }
    const desc = e.target.closest('[data-dose-description]');
    if (desc) {
      const id = desc.getAttribute('data-dose-description');
      if (!doseConfigCache.products[id]) doseConfigCache.products[id] = { enabled: true, formula: '', unit: 'g', description: '' };
      doseConfigCache.products[id].description = desc.value;
    }
  });
  document.addEventListener('click', async (e) => {
    if (e.target.id !== 'adminSaveDose') return;
    const feedback = document.getElementById('doseFeedback');
    try {
      if (store.isFirebase) {
        const settings = await store.getSettings();
        await store.saveSettings(Object.assign({}, settings, { doseConfig: doseConfigCache }));
      } else {
        writeDoseConfig(doseConfigCache);
      }
      setFeedback(feedback, 'Configuração salva. A página /calculo-dose já reflete os produtos selecionados.', 'success');
      window.ChampionToast?.('Cálculo de dose salvo.');
    } catch (err) {
      setFeedback(feedback, friendlyAdminError(err));
    }
  });

  setupEvents();
  if (store.isFirebase) {
    store.onAuthChanged((logged, user) => {
      syncAuth(logged, user);
    });
  } else {
    await syncAuth(store.isAdminLogged());
  }

  /* Carrega taxonomia e dose após primeiro login */
  setTimeout(() => {
    loadTaxonomy().catch(() => {});
    loadDoseConfig().catch(() => {});
  }, 300);

  if (refs.mode) refs.mode.textContent = store.isFirebase ? 'Firebase' : 'Local';
})();
