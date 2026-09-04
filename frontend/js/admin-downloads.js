/**
 * Champion · administração de arquivos do Google Drive.
 *
 * As credenciais do Drive nunca passam pelo navegador. Este módulo conversa
 * somente com as rotas administrativas do backend e autentica cada chamada
 * com o ID token do usuário Firebase que já acessou o painel.
 */
(async function () {
  'use strict';

  const panel = document.getElementById('adminDownloadsPanel');
  if (!panel) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const refs = {
    refresh: $('#downloadsRefresh'),
    feedback: $('#downloadsFeedback'),
    statusCard: $('#driveStatusCard'),
    statusTitle: $('#driveStatusTitle'),
    statusText: $('#driveStatusText'),
    statusMeta: $('#driveStatusMeta'),
    statusPill: $('#driveStatusPill'),
    accountMeta: $('#driveAccountMeta'),
    rootMeta: $('#driveRootMeta'),
    help: $('#driveConfigHelp'),
    helpEmail: $('#driveHelpEmail'),
    searchForm: $('#driveSearchForm'),
    search: $('#driveSearch'),
    breadcrumb: $('#driveBreadcrumb'),
    tableHead: $('#driveTableHead'),
    selectAll: $('#driveSelectAll'),
    driveList: $('#driveItemsList'),
    driveCount: $('#driveItemCount'),
    loadMoreWrap: $('#driveLoadMoreWrap'),
    loadMore: $('#driveLoadMore'),
    publishBar: $('#drivePublishBar'),
    selectionCount: $('#driveSelectionCount'),
    recursive: $('#driveRecursive'),
    publishCategories: $('#drivePublishCategories'),
    publishSelected: $('#drivePublishSelected'),
    allowView: $('#driveAllowView'),
    allowDownload: $('#driveAllowDownload'),
    categoryForm: $('#downloadCategoryForm'),
    categorySubmit: $('#downloadCategorySubmit'),
    categoryCancel: $('#downloadCategoryCancel'),
    categoryEditActions: $('#downloadCategoryEditActions'),
    categoryList: $('#downloadCategoryList'),
    categoryCount: $('#downloadCategoryCount'),
    publishedList: $('#publishedDownloadList'),
    publishedCount: $('#publishedDownloadCount'),
    publishedSearch: $('#publishedDownloadSearch'),
    publishedCategory: $('#publishedDownloadCategory'),
    publishedStatus: $('#publishedDownloadStatus'),
    editDrawer: $('#downloadEditDrawer'),
    editForm: $('#downloadEditForm'),
    editSubmit: $('#downloadEditSubmit'),
    editCategories: $('#downloadEditCategories'),
    editAllowView: $('#downloadEditAllowView'),
    editAllowDownload: $('#downloadEditAllowDownload')
  };

  const state = {
    initialized: false,
    initializing: false,
    driveReady: false,
    driveItems: [],
    selected: new Map(),
    publishCategoryIds: new Set(),
    categories: [],
    publications: [],
    nextPageToken: '',
    currentFolderId: '',
    currentFolderName: 'Meu Drive',
    breadcrumbs: [{ id: '', name: 'Meu Drive' }]
  };

  const ICONS = {
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M9 13h6"/></svg>'
  };

  function resolveApiBase() {
    const direct = String(window.CHAMPION_ADMIN_API || '').trim();
    if (direct) return direct.replace(/\/+$/, '');

    const generic = String(
      window.CHAMPION_API_URL ||
      'https://champion-production-cab6.up.railway.app/api/leads'
    ).trim().replace(/\/+$/, '');
    const origin = generic
      .replace(/\/api\/(?:leads|chat|conta)(?:\/.*)?$/i, '')
      .replace(/\/api$/i, '');
    return origin + '/api/admin';
  }

  const API_BASE = resolveApiBase();

  class AdminApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.name = 'AdminApiError';
      this.status = status || 0;
      this.payload = payload || null;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const apiOrigin = new URL(API_BASE, window.location.origin).origin;
      const url = new URL(raw, raw.startsWith('/api/') ? apiOrigin : window.location.origin);
      return /^(https?:)$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null);
  }

  function resultCount(value) {
    if (Array.isArray(value)) return value.length;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function arrayFrom(payload, keys) {
    if (Array.isArray(payload)) return payload;
    for (const key of keys) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload?.data && typeof payload.data === 'object' && payload.data !== payload) {
      return arrayFrom(payload.data, keys);
    }
    return [];
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 70);
  }

  function friendlyError(error) {
    const status = Number(error?.status || 0);
    if (status === 401 && /firebase/i.test(String(error?.message || ''))) {
      return 'A integração com o Drive exige login administrativo pelo Firebase; o modo local não envia credenciais ao servidor.';
    }
    if (status === 401) return 'Sua sessão administrativa expirou. Entre novamente com uma conta Firebase autorizada.';
    if (status === 403) return 'Sua conta não tem permissão para administrar os downloads.';
    if (status === 404) return 'A integração de Downloads ainda não está disponível no servidor publicado.';
    if (status === 409) return error.message || 'Não foi possível concluir porque este item está em uso.';
    if (status === 503) return error.message || 'O Google Drive ainda não foi configurado no servidor.';
    if (error?.name === 'AbortError') return 'A resposta do servidor demorou demais. Tente novamente.';
    if (/firebase/i.test(String(error?.message || '')) && /login|autentic/i.test(String(error?.message || ''))) {
      return 'Entre no painel usando o Firebase para acessar a integração com o Drive.';
    }
    if (error instanceof TypeError && /fetch|network|failed/i.test(String(error.message))) {
      return 'Não foi possível conectar ao servidor. Confira sua internet e tente novamente.';
    }
    return error?.message || 'Não foi possível concluir a operação.';
  }

  async function getFirebaseToken(forceRefresh = false) {
    const auth = window.ChampionAdminAuth;
    if (!auth || typeof auth.getIdToken !== 'function') {
      throw new AdminApiError('A autenticação administrativa não está disponível.', 401);
    }
    const token = await auth.getIdToken(forceRefresh);
    if (!token) throw new AdminApiError('A integração requer login administrativo pelo Firebase.', 401);
    return token;
  }

  async function api(path, options = {}, retry = true) {
    const token = await getFirebaseToken(false);
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 25000);
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const headers = Object.assign({ Accept: 'application/json' }, options.headers || {}, {
      Authorization: 'Bearer ' + token
    });
    if (options.body != null && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(API_BASE + path, {
        method: options.method || 'GET',
        headers,
        body: options.body == null || options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
        signal: controller.signal,
        credentials: 'omit'
      });
      const text = await response.text();
      let payload = {};
      if (text) {
        try { payload = JSON.parse(text); } catch (_) { payload = { message: text.slice(0, 240) }; }
      }
      if (response.status === 401 && retry) {
        const refreshed = await getFirebaseToken(true);
        return api(path, Object.assign({}, options, {
          headers: Object.assign({}, options.headers || {}, { Authorization: 'Bearer ' + refreshed })
        }), false);
      }
      if (!response.ok) {
        throw new AdminApiError(
          payload.error || payload.message || `Erro ${response.status} ao acessar o servidor.`,
          response.status,
          payload
        );
      }
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setFeedback(message, type = 'error') {
    refs.feedback.textContent = message || '';
    refs.feedback.classList.toggle('is-success', type === 'success');
    refs.feedback.classList.toggle('is-info', type === 'info');
  }

  function announce(message, type = 'success') {
    setFeedback(message, type);
    if (typeof window.ChampionToast === 'function') window.ChampionToast(message);
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      if (label) button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function loadingState(label) {
    return `<div class="dl-state"><span class="dl-spinner" aria-hidden="true"></span><strong>${escapeHtml(label)}</strong></div>`;
  }

  function emptyState(title, message, icon = true) {
    return `<div class="dl-state">${icon ? ICONS.empty : ''}<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
  }

  function formatSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '—';
    if (value === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);
    return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(date).replace('.', '');
  }

  function normalizeDriveItem(item = {}) {
    const mimeType = String(firstDefined(item.mimeType, item.mime, item.type, '') || '');
    const id = String(firstDefined(item.id, item.fileId, item.driveId, item.googleDriveId, '') || '');
    const explicitType = String(item.kind || item.itemType || item.type || '').toLowerCase();
    const isFolder = Boolean(
      firstDefined(item.isFolder, item.folder, false) ||
      mimeType === 'application/vnd.google-apps.folder' ||
      explicitType === 'folder'
    );
    return {
      id,
      name: String(firstDefined(item.name, item.title, item.fileName, isFolder ? 'Pasta sem nome' : 'Arquivo sem nome')),
      mimeType,
      isFolder,
      size: firstDefined(item.size, item.sizeBytes, item.fileSize, null),
      modifiedTime: firstDefined(item.modifiedTime, item.driveModifiedAt, item.updatedAt, item.modifiedAt, ''),
      webViewLink: firstDefined(item.webViewLink, item.viewUrl, item.url, ''),
      description: String(item.description || ''),
      iconLink: String(item.iconLink || '')
    };
  }

  function normalizeCategory(category = {}, index = 0) {
    const name = String(firstDefined(category.name, category.title, category.label, '') || '').trim();
    return {
      id: String(firstDefined(category.id, category.categoryId, category.slug, `category-${index}`)),
      name: name || 'Categoria sem nome',
      slug: String(category.slug || slugify(name)),
      description: String(category.description || ''),
      active: category.active !== false
    };
  }

  function categoryIdsFrom(item = {}) {
    const raw = firstDefined(item.categoryIds, item.categories, item.categoryId, []);
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return Array.from(new Set(list.map((category) => {
      if (category && typeof category === 'object') {
        return String(firstDefined(category.id, category.categoryId, category.slug, '') || '');
      }
      return String(category || '');
    }).filter(Boolean)));
  }

  function normalizePublication(item = {}, index = 0) {
    const drive = normalizeDriveItem(Object.assign({}, item.driveItem || {}, item));
    const rawPublished = firstDefined(item.published, item.isPublished, null);
    const status = String(item.status || (rawPublished === false ? 'draft' : 'published')).toLowerCase();
    return Object.assign({}, drive, {
      id: String(firstDefined(item.id, item.publicationId, item.downloadId, drive.id, `download-${index}`)),
      driveId: String(firstDefined(item.driveId, item.driveFileId, item.fileId, item.googleDriveId, drive.id)),
      name: String(firstDefined(item.title, item.name, drive.name)),
      description: String(firstDefined(item.description, drive.description, '') || ''),
      categoryIds: categoryIdsFrom(item),
      status: status === 'draft' || status === 'unpublished' || rawPublished === false ? 'draft' : 'published',
      allowView: firstDefined(item.allowView, true) !== false,
      allowDownload: firstDefined(item.allowDownload, true) !== false,
      canPreview: firstDefined(item.canPreview, true) !== false,
      canDownload: firstDefined(item.canDownload, true) !== false,
      webViewLink: firstDefined(item.webViewLink, item.viewUrl, drive.webViewLink, ''),
      downloadUrl: firstDefined(item.downloadUrl, '')
    });
  }

  function fileKind(item) {
    if (item.isFolder) return { css: 'folder', label: 'Pasta' };
    const mime = String(item.mimeType || '').toLowerCase();
    if (mime.includes('pdf')) return { css: 'pdf', label: 'PDF' };
    if (mime.startsWith('image/')) return { css: 'image', label: 'Imagem' };
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) return { css: 'sheet', label: 'Planilha' };
    if (mime.includes('document') || mime.includes('word') || mime.includes('text')) return { css: 'doc', label: 'Documento' };
    const extension = item.name.includes('.') ? item.name.split('.').pop().toUpperCase() : 'Arquivo';
    return { css: 'file', label: extension.slice(0, 10) };
  }

  function renderBreadcrumb() {
    refs.breadcrumb.innerHTML = state.breadcrumbs.map((crumb, index) => {
      const last = index === state.breadcrumbs.length - 1;
      const button = `<button class="dl-crumb" type="button" data-drive-crumb="${index}" ${last ? 'aria-current="page"' : ''}>${escapeHtml(crumb.name)}</button>`;
      return button + (last ? '' : '<span class="dl-crumb-sep" aria-hidden="true">›</span>');
    }).join('');
  }

  function renderDriveList() {
    refs.driveCount.textContent = String(state.driveItems.length);
    refs.tableHead.hidden = state.driveItems.length === 0;
    refs.loadMoreWrap.hidden = !state.nextPageToken;

    if (!state.driveItems.length) {
      const term = refs.search.value.trim();
      refs.driveList.innerHTML = emptyState(
        term ? 'Nenhum resultado' : 'Esta pasta está vazia',
        term ? `Não encontramos arquivos ou pastas para “${term}”.` : 'Abra outra pasta ou adicione conteúdo no Google Drive.'
      );
      updateSelectionUi();
      return;
    }

    refs.driveList.innerHTML = state.driveItems.map((item) => {
      const kind = fileKind(item);
      const selected = state.selected.has(item.id);
      const url = safeUrl(item.webViewLink);
      return `
        <div class="dl-drive-row${selected ? ' is-selected' : ''}" data-drive-row="${escapeHtml(item.id)}">
          <input class="dl-check" type="checkbox" data-drive-select="${escapeHtml(item.id)}" aria-label="Selecionar ${escapeHtml(item.name)}" ${selected ? 'checked' : ''} />
          <span class="dl-file-icon ${escapeHtml(kind.css)}">${item.isFolder ? ICONS.folder : ICONS.file}</span>
          <div class="dl-file-main">
            ${item.isFolder
              ? `<button class="dl-file-name" type="button" data-drive-folder="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`
              : `<span class="dl-file-name">${escapeHtml(item.name)}</span>`}
            <span class="dl-file-sub">${escapeHtml(kind.label)}${item.isFolder ? ' · clique para abrir' : ''}</span>
          </div>
          <span class="dl-file-cell">${item.isFolder ? '—' : escapeHtml(formatSize(item.size))}</span>
          <span class="dl-file-cell">${escapeHtml(formatDate(item.modifiedTime))}</span>
          ${url
            ? `<a class="dl-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="Visualizar ${escapeHtml(item.name)} no Drive" title="Abrir no Drive">${ICONS.external}</a>`
            : '<span aria-hidden="true"></span>'}
        </div>`;
    }).join('');
    updateSelectionUi();
  }

  function updateSelectionUi() {
    const count = state.selected.size;
    refs.publishBar.hidden = count === 0;
    refs.selectionCount.textContent = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`;
    const visibleIds = state.driveItems.map((item) => item.id).filter(Boolean);
    const selectedVisible = visibleIds.filter((id) => state.selected.has(id)).length;
    refs.selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    refs.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    refs.publishSelected.disabled = count === 0 || !state.categories.length;
    refs.driveList.querySelectorAll('[data-drive-row]').forEach((row) => {
      row.classList.toggle('is-selected', state.selected.has(row.dataset.driveRow));
    });
  }

  function renderCategoryChoices() {
    const available = state.categories.filter((category) => category.active !== false);
    for (const id of Array.from(state.publishCategoryIds)) {
      if (!available.some((category) => category.id === id)) state.publishCategoryIds.delete(id);
    }
    refs.publishCategories.innerHTML = available.length
      ? available.map((category) => `
          <label class="dl-category-choice">
            <input type="checkbox" data-publish-category="${escapeHtml(category.id)}" ${state.publishCategoryIds.has(category.id) ? 'checked' : ''} />
            <span>${escapeHtml(category.name)}</span>
          </label>`).join('')
      : '<span style="font-size:11.5px;color:#8A93A3">Crie uma categoria antes de publicar.</span>';
    updateSelectionUi();
  }

  function renderCategoryList() {
    refs.categoryCount.textContent = String(state.categories.length);
    if (!state.categories.length) {
      refs.categoryList.innerHTML = emptyState('Nenhuma categoria', 'Crie a primeira categoria para organizar seus arquivos.');
      renderCategoryChoices();
      renderPublicationFilters();
      return;
    }
    refs.categoryList.innerHTML = state.categories.map((category, index) => `
      <div class="dl-category-row">
        <span class="dl-category-dot" style="opacity:${category.active ? 1 : .35}"></span>
        <div class="dl-category-main">
          <strong>${escapeHtml(category.name)}</strong>
          <small>${escapeHtml(category.slug)}${category.active ? '' : ' · inativa'}</small>
        </div>
        <button class="dl-icon-button" type="button" data-category-edit="${escapeHtml(category.id)}" title="Editar categoria" aria-label="Editar ${escapeHtml(category.name)}">${ICONS.edit}</button>
        <button class="dl-icon-button is-danger" type="button" data-category-delete="${escapeHtml(category.id)}" title="Excluir categoria" aria-label="Excluir ${escapeHtml(category.name)}">${ICONS.trash}</button>
      </div>`).join('');
    renderCategoryChoices();
    renderPublicationFilters();
  }

  function renderPublicationFilters() {
    const current = refs.publishedCategory.value;
    refs.publishedCategory.innerHTML = '<option value="">Todas as categorias</option>' +
      state.categories.filter((category) => category.active !== false).map((category) =>
        `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
      ).join('');
    if (state.categories.some((category) => category.id === current)) refs.publishedCategory.value = current;
  }

  function categoryName(id) {
    return state.categories.find((category) => category.id === id)?.name || 'Categoria removida';
  }

  function renderPublications() {
    refs.publishedCount.textContent = String(state.publications.length);
    const term = refs.publishedSearch.value.trim().toLocaleLowerCase('pt-BR');
    const categoryId = refs.publishedCategory.value;
    const status = refs.publishedStatus.value;
    const rows = state.publications.filter((item) => {
      const haystack = `${item.name} ${item.description} ${item.categoryIds.map(categoryName).join(' ')}`.toLocaleLowerCase('pt-BR');
      return (!term || haystack.includes(term)) &&
        (!categoryId || item.categoryIds.includes(categoryId)) &&
        (!status || item.status === status);
    });

    if (!rows.length) {
      refs.publishedList.innerHTML = emptyState(
        state.publications.length ? 'Nenhum item neste filtro' : 'Nenhum download liberado',
        state.publications.length ? 'Altere a busca ou os filtros para ver outros itens.' : 'Selecione arquivos ou pastas acima para publicá-los.'
      );
      return;
    }

    refs.publishedList.innerHTML = rows.map((item) => {
      const kind = fileKind(item);
      const url = safeUrl(item.webViewLink);
      const categories = item.categoryIds.length
        ? item.categoryIds.map((id) => `<span class="dl-category-tag">${escapeHtml(categoryName(id))}</span>`).join('')
        : '<span class="dl-category-tag" style="color:#7C8491;background:#F0F2F6">Sem categoria</span>';
      const categoryOptions = state.categories.filter((category) => category.active !== false).map((category) => `
        <label><input type="checkbox" data-pub-category-option value="${escapeHtml(category.id)}" ${item.categoryIds.includes(category.id) ? 'checked' : ''} /> ${escapeHtml(category.name)}</label>
      `).join('') || '<span style="display:block;padding:7px;color:#8A93A3;font-size:11px">Nenhuma categoria cadastrada.</span>';
      return `
        <div class="dl-published-row" data-publication-row="${escapeHtml(item.id)}">
          <span class="dl-file-icon ${escapeHtml(kind.css)}">${item.isFolder ? ICONS.folder : ICONS.file}</span>
          <div class="dl-file-main">
            <span class="dl-file-name">${escapeHtml(item.name)}</span>
            <span class="dl-file-sub">${escapeHtml(kind.label)}${item.size != null && !item.isFolder ? ' · ' + escapeHtml(formatSize(item.size)) : ''}${item.modifiedTime ? ' · atualizado ' + escapeHtml(formatDate(item.modifiedTime)) : ''}</span>
            <div class="dl-pub-categories">${categories}</div>
          </div>
          <details class="dl-pub-category-editor" data-publication-categories="${escapeHtml(item.id)}">
            <summary>${item.categoryIds.length ? `Editar categorias (${item.categoryIds.length})` : 'Atribuir categoria'}</summary>
            <div class="dl-pub-category-menu">${categoryOptions}</div>
          </details>
          <div class="dl-pub-permissions" aria-label="Permissões de ${escapeHtml(item.name)}">
            <label class="${item.canPreview ? '' : 'is-unavailable'}" title="${item.canPreview ? 'Permitir visualização no navegador' : 'Este formato pode não ter pré-visualização'}">
              <input type="checkbox" data-publication-permission="view" ${item.allowView ? 'checked' : ''} /> Visualizar
            </label>
            <label class="${item.canDownload ? '' : 'is-unavailable'}" title="${item.canDownload ? 'Permitir baixar o arquivo' : 'Download indisponível para este arquivo'}">
              <input type="checkbox" data-publication-permission="download" ${item.allowDownload ? 'checked' : ''} ${item.canDownload ? '' : 'disabled'} /> Download
            </label>
          </div>
          <button class="dl-status-button${item.status === 'draft' ? ' is-draft' : ''}" type="button" data-publication-status="${escapeHtml(item.id)}" aria-label="${item.status === 'published' ? 'Despublicar' : 'Publicar'} ${escapeHtml(item.name)}">
            ${item.status === 'published' ? 'Publicado' : 'Despublicado'}
          </button>
          <div class="dl-pub-actions">
            ${item.status === 'published' && item.allowView && item.canPreview && url ? `<a class="dl-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="Visualizar" aria-label="Visualizar ${escapeHtml(item.name)}">${ICONS.external}</a>` : ''}
            <button class="dl-icon-button" type="button" data-publication-edit="${escapeHtml(item.id)}" title="Editar nome e descrição" aria-label="Editar ${escapeHtml(item.name)}">${ICONS.edit}</button>
            <button class="dl-icon-button is-danger" type="button" data-publication-delete="${escapeHtml(item.id)}" title="Remover de Downloads" aria-label="Remover ${escapeHtml(item.name)} de Downloads">${ICONS.trash}</button>
          </div>
        </div>`;
    }).join('');
  }

  function updateRootFromStatus(payload) {
    const root = firstDefined(payload?.rootFolder, payload?.root, payload?.folder, null);
    const id = root && typeof root === 'object'
      ? String(firstDefined(root.id, root.folderId, '') || '')
      : String(firstDefined(payload?.rootFolderId, typeof root === 'string' ? root : '', '') || '');
    const name = root && typeof root === 'object'
      ? String(firstDefined(root.name, root.title, 'Drive Champion'))
      : String(firstDefined(payload?.rootFolderName, 'Drive Champion'));
    state.currentFolderId = id;
    state.currentFolderName = name;
    state.breadcrumbs = [{ id, name }];
    renderBreadcrumb();
  }

  async function loadStatus() {
    refs.statusCard.dataset.state = 'loading';
    refs.statusTitle.textContent = 'Verificando integração…';
    refs.statusText.textContent = 'Consultando a configuração segura do servidor.';
    refs.statusPill.className = 'ap-pill gray';
    refs.statusPill.textContent = 'Verificando';
    refs.statusMeta.hidden = true;

    try {
      const response = await api('/drive/status');
      const payload = response.drive || response.data || response;
      const configured = Boolean(firstDefined(payload.configured, payload.enabled, false));
      const connected = Boolean(firstDefined(payload.connected, payload.ready, configured));
      const accountEmail = String(firstDefined(payload.accountEmail, payload.serviceAccountEmail, '') || '');
      const root = firstDefined(payload.rootFolder, payload.root, payload.folderName, '');
      const rootLabel = root && typeof root === 'object'
        ? String(firstDefined(root.name, root.title, root.id, '') || '')
        : String(root || '');

      refs.accountMeta.hidden = !accountEmail;
      refs.accountMeta.textContent = accountEmail ? `Conta: ${accountEmail}` : '';
      refs.rootMeta.hidden = !rootLabel;
      refs.rootMeta.textContent = rootLabel ? `Pasta: ${rootLabel}` : '';
      refs.statusMeta.hidden = !accountEmail && !rootLabel;
      if (accountEmail) refs.helpEmail.textContent = accountEmail;

      state.driveReady = configured && connected;
      if (state.driveReady) {
        refs.statusCard.dataset.state = 'ready';
        refs.statusTitle.textContent = 'Google Drive conectado';
        refs.statusText.textContent = 'A conta de serviço consegue acessar a pasta configurada.';
        refs.statusPill.className = 'ap-pill green';
        refs.statusPill.textContent = 'Operacional';
        refs.help.open = false;
        updateRootFromStatus(payload);
      } else {
        refs.statusCard.dataset.state = 'error';
        refs.statusTitle.textContent = configured ? 'Não foi possível acessar a pasta' : 'Integração ainda não configurada';
        refs.statusText.textContent = String(firstDefined(
          payload.message,
          payload.error,
          payload.configurationError,
          configured
            ? 'Revise o compartilhamento da pasta com a conta de serviço.'
            : 'Configure a conta de serviço e a pasta raiz nas variáveis do backend.'
        ));
        refs.statusPill.className = 'ap-pill red';
        refs.statusPill.textContent = configured ? 'Sem acesso' : 'Pendente';
        refs.help.open = true;
      }
      return payload;
    } catch (error) {
      state.driveReady = false;
      refs.statusCard.dataset.state = 'error';
      refs.statusTitle.textContent = 'Integração indisponível';
      refs.statusText.textContent = friendlyError(error);
      refs.statusPill.className = 'ap-pill red';
      refs.statusPill.textContent = 'Erro';
      refs.help.open = true;
      throw error;
    }
  }

  async function loadDrive(options = {}) {
    const append = options.append === true;
    if (!state.driveReady) {
      refs.driveCount.textContent = '0';
      refs.tableHead.hidden = true;
      refs.loadMoreWrap.hidden = true;
      refs.driveList.innerHTML = emptyState('Drive indisponível', 'Conclua a configuração indicada acima para navegar pelos arquivos.');
      return;
    }

    if (append) setButtonBusy(refs.loadMore, true, 'Carregando…');
    else {
      refs.tableHead.hidden = true;
      refs.loadMoreWrap.hidden = true;
      refs.driveList.innerHTML = loadingState('Carregando arquivos…');
    }

    try {
      const params = new URLSearchParams();
      if (state.currentFolderId) params.set('folderId', state.currentFolderId);
      const term = refs.search.value.trim();
      if (term) params.set('q', term);
      if (append && state.nextPageToken) params.set('pageToken', state.nextPageToken);
      const response = await api('/drive/items' + (params.toString() ? `?${params}` : ''));
      const incoming = arrayFrom(response, ['items', 'files', 'driveItems']).map(normalizeDriveItem).filter((item) => item.id);
      if (append) {
        const merged = new Map(state.driveItems.map((item) => [item.id, item]));
        incoming.forEach((item) => merged.set(item.id, item));
        state.driveItems = Array.from(merged.values());
      } else {
        state.driveItems = incoming;
      }
      state.nextPageToken = String(firstDefined(response.nextPageToken, response.pageToken, response.next, '') || '');

      const responseBreadcrumbs = arrayFrom(response, ['breadcrumbs']).map((crumb) => ({
        id: String(firstDefined(crumb?.id, crumb?.folderId, '') || ''),
        name: String(firstDefined(crumb?.name, crumb?.title, 'Pasta') || 'Pasta')
      })).filter((crumb) => crumb.id);
      if (responseBreadcrumbs.length) {
        state.breadcrumbs = responseBreadcrumbs;
        const current = responseBreadcrumbs[responseBreadcrumbs.length - 1];
        state.currentFolderId = current.id;
        state.currentFolderName = current.name;
        renderBreadcrumb();
      }

      const parent = response.parent;
      if (!responseBreadcrumbs.length && !term && parent && typeof parent === 'object' && state.breadcrumbs.length === 1 && !state.currentFolderId) {
        const parentItem = normalizeDriveItem(Object.assign({ isFolder: true }, parent));
        if (parentItem.id) {
          state.currentFolderId = parentItem.id;
          state.currentFolderName = parentItem.name;
          state.breadcrumbs = [{ id: parentItem.id, name: parentItem.name }];
          renderBreadcrumb();
        }
      }
      renderDriveList();
    } catch (error) {
      if (!append) {
        refs.driveCount.textContent = '0';
        refs.tableHead.hidden = true;
        refs.driveList.innerHTML = emptyState('Não foi possível listar os arquivos', friendlyError(error), false);
      }
      setFeedback(friendlyError(error));
    } finally {
      if (append) setButtonBusy(refs.loadMore, false);
    }
  }

  async function loadCategories() {
    refs.categoryList.innerHTML = loadingState('Carregando categorias…');
    try {
      const response = await api('/download-categories');
      state.categories = arrayFrom(response, ['categories', 'items'])
        .map(normalizeCategory)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      renderCategoryList();
      renderPublications();
    } catch (error) {
      refs.categoryCount.textContent = '0';
      refs.categoryList.innerHTML = emptyState('Categorias indisponíveis', friendlyError(error), false);
      throw error;
    }
  }

  async function loadPublications() {
    refs.publishedList.innerHTML = loadingState('Carregando publicações…');
    try {
      const response = await api('/downloads');
      state.publications = arrayFrom(response, ['items', 'downloads', 'publications'])
        .map(normalizePublication)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      renderPublications();
    } catch (error) {
      refs.publishedCount.textContent = '0';
      refs.publishedList.innerHTML = emptyState('Publicações indisponíveis', friendlyError(error), false);
      throw error;
    }
  }

  async function refreshAll() {
    if (state.initializing) return;
    state.initializing = true;
    setFeedback('');
    setButtonBusy(refs.refresh, true, 'Atualizando…');
    try {
      try {
        await loadStatus();
      } catch (error) {
        setFeedback(friendlyError(error));
      }
      const results = await Promise.allSettled([loadCategories(), loadPublications()]);
      /* loadDrive tambem renderiza o estado de configuracao pendente. Chama-lo
         sempre evita deixar o skeleton inicial preso quando status responde
         normalmente com configured:false. */
      await loadDrive();
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected && !refs.feedback.textContent) setFeedback(friendlyError(rejected.reason));
      state.initialized = true;
    } finally {
      state.initializing = false;
      setButtonBusy(refs.refresh, false);
    }
  }

  async function publishSelection() {
    const items = Array.from(state.selected.values());
    const categoryIds = Array.from(state.publishCategoryIds);
    if (!items.length) return;
    if (!categoryIds.length) {
      setFeedback('Selecione ao menos uma categoria para liberar os itens.');
      refs.publishCategories.querySelector('input')?.focus();
      return;
    }
    if (!refs.allowView.checked && !refs.allowDownload.checked) {
      setFeedback('Mantenha Visualização ou Download ativo para liberar os itens.');
      refs.allowView.focus();
      return;
    }

    setFeedback('');
    setButtonBusy(refs.publishSelected, true, 'Liberando…');
    try {
      const response = await api('/downloads', {
        method: 'POST',
        timeoutMs: 120000,
        body: {
          driveItemIds: items.map((item) => item.id),
          categoryId: categoryIds[0],
          categoryIds,
          recursive: refs.recursive.checked,
          applyToExisting: false,
          allowView: refs.allowView.checked,
          allowDownload: refs.allowDownload.checked
        }
      });
      const created = resultCount(firstDefined(response.created, response.createdCount, 0));
      const updated = resultCount(firstDefined(response.updated, response.updatedCount, 0));
      const skipped = resultCount(firstDefined(response.skipped, response.skippedCount, 0));
      let message = `${items.length === 1 ? 'Item sincronizado' : 'Itens sincronizados'} com a página de Downloads.`;
      if (created || updated || skipped) {
        const parts = [];
        if (created) parts.push(`${created} ${created === 1 ? 'novo' : 'novos'}`);
        if (updated) parts.push(`${updated} ${updated === 1 ? 'atualizado' : 'atualizados'}`);
        if (skipped) parts.push(`${skipped} ${skipped === 1 ? 'ignorado' : 'ignorados'}`);
        message = `Sincronização concluída: ${parts.join(', ')}. Ajustes individuais existentes foram preservados.`;
      }
      state.selected.clear();
      renderDriveList();
      await loadPublications();
      announce(message);
    } catch (error) {
      setFeedback(friendlyError(error));
    } finally {
      setButtonBusy(refs.publishSelected, false);
      updateSelectionUi();
    }
  }

  function resetCategoryForm() {
    refs.categoryForm.reset();
    refs.categoryForm.elements.id.value = '';
    refs.categorySubmit.textContent = 'Adicionar';
    refs.categoryEditActions.hidden = true;
  }

  function editCategory(id) {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    refs.categoryForm.elements.id.value = category.id;
    refs.categoryForm.elements.name.value = category.name;
    refs.categoryForm.elements.description.value = category.description;
    refs.categorySubmit.textContent = 'Salvar';
    refs.categoryEditActions.hidden = false;
    refs.categoryForm.elements.name.focus();
  }

  async function saveCategory(event) {
    event.preventDefault();
    const id = String(refs.categoryForm.elements.id.value || '');
    const name = String(refs.categoryForm.elements.name.value || '').trim();
    const description = String(refs.categoryForm.elements.description.value || '').trim();
    if (!name) return;
    setFeedback('');
    setButtonBusy(refs.categorySubmit, true, id ? 'Salvando…' : 'Adicionando…');
    try {
      await api('/download-categories' + (id ? `/${encodeURIComponent(id)}` : ''), {
        method: id ? 'PUT' : 'POST',
        body: { name, slug: slugify(name), description, active: true }
      });
      resetCategoryForm();
      await loadCategories();
      announce(id ? 'Categoria atualizada.' : 'Categoria criada.');
    } catch (error) {
      setFeedback(friendlyError(error));
    } finally {
      setButtonBusy(refs.categorySubmit, false);
      refs.categorySubmit.textContent = refs.categoryForm.elements.id.value ? 'Salvar' : 'Adicionar';
    }
  }

  async function deleteCategory(id, button) {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    if (!window.confirm(`Excluir a categoria “${category.name}”? Os arquivos não serão excluídos do Drive.`)) return;
    setFeedback('');
    setButtonBusy(button, true);
    try {
      await api(`/download-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.publishCategoryIds.delete(id);
      if (refs.categoryForm.elements.id.value === id) resetCategoryForm();
      await Promise.all([loadCategories(), loadPublications()]);
      announce('Categoria removida.');
    } catch (error) {
      setFeedback(friendlyError(error));
      setButtonBusy(button, false);
    }
  }

  function hasPublicPermission(viewInput, downloadInput, changedInput) {
    if (viewInput.checked || downloadInput.checked) return true;
    if (changedInput) changedInput.checked = true;
    setFeedback('Ao menos Visualização ou Download deve permanecer ativo.');
    return false;
  }

  function openPublicationEditor(id) {
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) return;
    refs.editForm.elements.id.value = publication.id;
    refs.editForm.elements.name.value = publication.name;
    refs.editForm.elements.description.value = publication.description;
    refs.editAllowView.checked = publication.allowView;
    refs.editAllowDownload.checked = publication.allowDownload;
    refs.editCategories.innerHTML = state.categories.filter((category) => category.active !== false).map((category) => `
      <label class="dl-category-choice">
        <input type="checkbox" value="${escapeHtml(category.id)}" ${publication.categoryIds.includes(category.id) ? 'checked' : ''} />
        <span>${escapeHtml(category.name)}</span>
      </label>
    `).join('') || '<span style="font-size:11.5px;color:#8A93A3">Nenhuma categoria cadastrada.</span>';
    refs.editDrawer.classList.add('is-open');
    refs.editDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => refs.editForm.elements.name.focus(), 0);
  }

  function closePublicationEditor() {
    refs.editDrawer.classList.remove('is-open');
    refs.editDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function savePublicationEditor(event) {
    event.preventDefault();
    const id = String(refs.editForm.elements.id.value || '');
    const name = String(refs.editForm.elements.name.value || '').trim();
    if (!id || !name) return;
    if (!hasPublicPermission(refs.editAllowView, refs.editAllowDownload)) return;
    const categoryIds = Array.from(refs.editCategories.querySelectorAll('input:checked')).map((input) => input.value);
    try {
      await updatePublication(id, {
        name,
        description: String(refs.editForm.elements.description.value || '').trim(),
        categoryId: categoryIds[0] || null,
        categoryIds,
        allowView: refs.editAllowView.checked,
        allowDownload: refs.editAllowDownload.checked
      }, refs.editSubmit, 'Download atualizado.');
      closePublicationEditor();
    } catch (_) {}
  }

  async function updatePublication(id, body, control, successMessage) {
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) return;
    setFeedback('');
    setButtonBusy(control, true, control?.matches('.dl-status-button') ? 'Salvando…' : '');
    try {
      const response = await api(`/downloads/${encodeURIComponent(id)}`, { method: 'PUT', body });
      const returned = firstDefined(response.item, response.download, response.data, null);
      if (returned && typeof returned === 'object') {
        const index = state.publications.findIndex((item) => item.id === id);
        state.publications[index] = normalizePublication(Object.assign({}, publication, returned));
      } else {
        Object.assign(publication, body);
        if (typeof body.published === 'boolean') publication.status = body.published ? 'published' : 'draft';
      }
      renderPublications();
      announce(successMessage);
    } catch (error) {
      setFeedback(friendlyError(error));
      throw error;
    } finally {
      if (control?.isConnected) setButtonBusy(control, false);
    }
  }

  async function deletePublication(id, button) {
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) return;
    if (!window.confirm(`Remover “${publication.name}” da página de Downloads? O arquivo continuará no Google Drive.`)) return;
    setFeedback('');
    setButtonBusy(button, true);
    try {
      await api(`/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.publications = state.publications.filter((item) => item.id !== id);
      renderPublications();
      announce('Item removido da página de Downloads.');
    } catch (error) {
      setFeedback(friendlyError(error));
      setButtonBusy(button, false);
    }
  }

  refs.refresh.addEventListener('click', refreshAll);
  refs.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.nextPageToken = '';
    loadDrive();
  });

  let searchTimer = 0;
  refs.search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.nextPageToken = '';
      loadDrive();
    }, 450);
  });

  refs.loadMore.addEventListener('click', () => loadDrive({ append: true }));
  refs.publishSelected.addEventListener('click', publishSelection);
  refs.categoryForm.addEventListener('submit', saveCategory);
  refs.categoryCancel.addEventListener('click', resetCategoryForm);
  refs.editForm.addEventListener('submit', savePublicationEditor);
  refs.publishedSearch.addEventListener('input', renderPublications);
  refs.publishedCategory.addEventListener('change', renderPublications);
  refs.publishedStatus.addEventListener('change', renderPublications);

  refs.selectAll.addEventListener('change', () => {
    state.driveItems.forEach((item) => {
      if (refs.selectAll.checked) state.selected.set(item.id, item);
      else state.selected.delete(item.id);
    });
    renderDriveList();
  });

  refs.publishCategories.addEventListener('change', (event) => {
    const input = event.target.closest('[data-publish-category]');
    if (!input) return;
    if (input.checked) state.publishCategoryIds.add(input.dataset.publishCategory);
    else state.publishCategoryIds.delete(input.dataset.publishCategory);
  });

  [refs.allowView, refs.allowDownload].forEach((input) => {
    input.addEventListener('change', () => hasPublicPermission(refs.allowView, refs.allowDownload, input));
  });
  [refs.editAllowView, refs.editAllowDownload].forEach((input) => {
    input.addEventListener('change', () => hasPublicPermission(refs.editAllowView, refs.editAllowDownload, input));
  });

  refs.breadcrumb.addEventListener('click', (event) => {
    const button = event.target.closest('[data-drive-crumb]');
    if (!button) return;
    const index = Number(button.dataset.driveCrumb);
    if (!Number.isInteger(index) || index < 0 || index >= state.breadcrumbs.length - 1) return;
    const crumb = state.breadcrumbs[index];
    state.breadcrumbs = state.breadcrumbs.slice(0, index + 1);
    state.currentFolderId = crumb.id;
    state.currentFolderName = crumb.name;
    refs.search.value = '';
    state.nextPageToken = '';
    renderBreadcrumb();
    loadDrive();
  });

  refs.driveList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-drive-select]');
    if (!checkbox) return;
    const item = state.driveItems.find((entry) => entry.id === checkbox.dataset.driveSelect);
    if (!item) return;
    if (checkbox.checked) state.selected.set(item.id, item);
    else state.selected.delete(item.id);
    updateSelectionUi();
  });

  refs.driveList.addEventListener('click', (event) => {
    const folderButton = event.target.closest('[data-drive-folder]');
    if (!folderButton) return;
    const folder = state.driveItems.find((item) => item.id === folderButton.dataset.driveFolder);
    if (!folder) return;
    state.currentFolderId = folder.id;
    state.currentFolderName = folder.name;
    state.breadcrumbs.push({ id: folder.id, name: folder.name });
    refs.search.value = '';
    state.nextPageToken = '';
    renderBreadcrumb();
    loadDrive();
  });

  refs.categoryList.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-category-edit]');
    if (editButton) {
      editCategory(editButton.dataset.categoryEdit);
      return;
    }
    const deleteButton = event.target.closest('[data-category-delete]');
    if (deleteButton) deleteCategory(deleteButton.dataset.categoryDelete, deleteButton);
  });

  refs.publishedList.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-publication-edit]');
    if (editButton) {
      openPublicationEditor(editButton.dataset.publicationEdit);
      return;
    }
    const statusButton = event.target.closest('[data-publication-status]');
    if (statusButton) {
      const id = statusButton.dataset.publicationStatus;
      const publication = state.publications.find((item) => item.id === id);
      if (!publication) return;
      const publish = publication.status !== 'published';
      updatePublication(
        id,
        { status: publish ? 'published' : 'draft', published: publish },
        statusButton,
        publish ? 'Item publicado.' : 'Item despublicado.'
      ).catch(() => {});
      return;
    }
    const deleteButton = event.target.closest('[data-publication-delete]');
    if (deleteButton) deletePublication(deleteButton.dataset.publicationDelete, deleteButton);
  });

  refs.publishedList.addEventListener('change', (event) => {
    const permission = event.target.closest('[data-publication-permission]');
    if (permission) {
      const row = permission.closest('[data-publication-row]');
      const id = row?.dataset.publicationRow;
      const viewInput = row?.querySelector('[data-publication-permission="view"]');
      const downloadInput = row?.querySelector('[data-publication-permission="download"]');
      if (!id || !viewInput || !downloadInput || !hasPublicPermission(viewInput, downloadInput, permission)) return;
      row.querySelectorAll('[data-publication-permission]').forEach((input) => { input.disabled = true; });
      updatePublication(id, {
        allowView: viewInput.checked,
        allowDownload: downloadInput.checked
      }, null, 'Permissões do item atualizadas.').catch(() => {
        row.querySelectorAll('[data-publication-permission]').forEach((input) => { input.disabled = false; });
      });
      return;
    }
    const option = event.target.closest('[data-pub-category-option]');
    if (!option) return;
    const editor = option.closest('[data-publication-categories]');
    const id = editor?.dataset.publicationCategories;
    if (!id) return;
    const categoryIds = Array.from(editor.querySelectorAll('[data-pub-category-option]:checked')).map((input) => input.value);
    editor.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    updatePublication(
      id,
      { categoryId: categoryIds[0] || null, categoryIds },
      null,
      'Categorias do item atualizadas.'
    ).catch(() => {
      editor.querySelectorAll('input').forEach((input) => { input.disabled = false; });
    });
  });

  refs.editDrawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-download-edit-close]')) closePublicationEditor();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && refs.editDrawer.classList.contains('is-open')) closePublicationEditor();
  });

  document.querySelectorAll('[data-admin-tab="downloads"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.initialized) refreshAll();
    });
  });

  renderBreadcrumb();
  if (!panel.hidden) refreshAll();
})();
