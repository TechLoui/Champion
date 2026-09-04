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
    publishedMetric: $('#downloadPublishedMetric'),
    draftMetric: $('#downloadDraftMetric'),
    categoryMetric: $('#downloadCategoryMetric'),
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
    searchClear: $('#driveSearchClear'),
    breadcrumb: $('#driveBreadcrumb'),
    tableHead: $('#driveTableHead'),
    selectAll: $('#driveSelectAll'),
    driveList: $('#driveItemsList'),
    driveCount: $('#driveItemCount'),
    loadMoreWrap: $('#driveLoadMoreWrap'),
    loadMore: $('#driveLoadMore'),
    publishBar: $('#drivePublishBar'),
    publishEmpty: $('#drivePublishEmpty'),
    publishContent: $('#drivePublishContent'),
    selectionCount: $('#driveSelectionCount'),
    selectedPreview: $('#driveSelectedPreview'),
    clearSelection: $('#driveClearSelection'),
    recursive: $('#driveRecursive'),
    recursiveWrap: $('#driveRecursiveWrap'),
    publishCategories: $('#drivePublishCategories'),
    publishSelected: $('#drivePublishSelected'),
    allowView: $('#driveAllowView'),
    allowDownload: $('#driveAllowDownload'),
    permissionHint: $('#drivePermissionHint'),
    categoriesPanel: $('#downloadCategoriesPanel'),
    categoriesJump: $('#downloadCategoriesJump'),
    categoryForm: $('#downloadCategoryForm'),
    categoryActive: $('#downloadCategoryActive'),
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
    publishedClearFilters: $('#publishedDownloadClearFilters'),
    publishedResultCount: $('#publishedDownloadResultCount'),
    publishedTableHead: $('#publishedDownloadTableHead'),
    editDrawer: $('#downloadEditDrawer'),
    editForm: $('#downloadEditForm'),
    editSubmit: $('#downloadEditSubmit'),
    editFeedback: $('#downloadEditFeedback'),
    editCategories: $('#downloadEditCategories'),
    editAllowView: $('#downloadEditAllowView'),
    editAllowDownload: $('#downloadEditAllowDownload'),
    editPermissionHint: $('#downloadEditPermissionHint')
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
    driveRequestId: 0,
    categoryRequestId: 0,
    publicationRequestId: 0,
    lastFocusedElement: null,
    lastFocusedPublicationId: '',
    editorOriginalActiveCategoryIds: [],
    editorSaving: false,
    publishing: false,
    categoryMutating: false,
    pendingPublications: new Set(),
    nextPageToken: '',
    currentFolderId: '',
    currentFolderName: 'Meu Drive',
    breadcrumbs: [{ id: '', name: 'Meu Drive' }]
  };

  const MAX_DIRECT_SELECTION = 100;
  const MAX_CATEGORY_SELECTION = 20;

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
    refs.feedback.setAttribute('role', message && type === 'error' ? 'alert' : 'status');
  }

  function announce(message, type = 'success') {
    setFeedback(message, type);
    if (typeof window.ChampionToast === 'function') window.ChampionToast(message);
  }

  function reportActionError(error) {
    const message = friendlyError(error);
    setFeedback(message);
    if (typeof window.ChampionToast === 'function') window.ChampionToast(message);
  }

  function setDrawerFeedback(message, focus = true) {
    refs.editFeedback.textContent = message || '';
    if (message && focus) {
      refs.editFeedback.focus({ preventScroll: true });
      refs.editFeedback.scrollIntoView({ block: 'nearest' });
    }
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.dataset.busy = 'true';
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      if (label) button.textContent = label;
    } else {
      delete button.dataset.busy;
      button.removeAttribute('aria-busy');
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function loadingState(label) {
    return `<div class="dl-state" role="status"><span class="dl-spinner" aria-hidden="true"></span><strong>${escapeHtml(label)}</strong></div>`;
  }

  function emptyState(title, message, icon = true, actionHtml = '') {
    return `<div class="dl-state" role="status">${icon ? ICONS.empty : ''}<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>${actionHtml}</div>`;
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
    const isShortcut = Boolean(
      firstDefined(item.isShortcut, false)
      || mimeType === 'application/vnd.google-apps.shortcut'
      || explicitType === 'shortcut'
    );
    return {
      id,
      name: String(firstDefined(item.name, item.title, item.fileName, isFolder ? 'Pasta sem nome' : 'Arquivo sem nome')),
      mimeType,
      isFolder,
      isShortcut,
      size: firstDefined(item.size, item.sizeBytes, item.fileSize, null),
      modifiedTime: firstDefined(item.modifiedTime, item.driveModifiedAt, item.updatedAt, item.modifiedAt, ''),
      webViewLink: firstDefined(item.webViewLink, item.viewUrl, item.url, ''),
      description: String(item.description || ''),
      iconLink: String(item.iconLink || ''),
      canDownload: firstDefined(item.canDownload, item.capabilities?.canDownload, true) !== false
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
    const allowView = firstDefined(item.allowView, true) !== false;
    const allowDownload = firstDefined(item.allowDownload, true) !== false;
    const downloadUrl = firstDefined(item.downloadUrl, '');
    return Object.assign({}, drive, {
      id: String(firstDefined(item.id, item.publicationId, item.downloadId, drive.id, `download-${index}`)),
      driveId: String(firstDefined(item.driveId, item.driveFileId, item.fileId, item.googleDriveId, drive.id)),
      name: String(firstDefined(item.title, item.name, drive.name)),
      description: String(firstDefined(item.description, drive.description, '') || ''),
      categoryIds: categoryIdsFrom(item),
      status: status === 'draft' || status === 'unpublished' || rawPublished === false ? 'draft' : 'published',
      allowView,
      allowDownload,
      canPreview: firstDefined(item.canPreview, true) !== false,
      canDownload: allowDownload && firstDefined(item.canDownload, Boolean(downloadUrl), true) !== false,
      deliveryMimeType: String(firstDefined(item.deliveryMimeType, item.exportMimeType, drive.mimeType, '') || ''),
      webViewLink: firstDefined(item.webViewLink, item.viewUrl, drive.webViewLink, ''),
      downloadUrl
    });
  }

  function isPreviewableMime(mimeType) {
    const type = String(mimeType || '').toLowerCase();
    return type === 'application/pdf'
      || type === 'text/plain'
      || type === 'text/csv'
      || (type.startsWith('image/') && type !== 'image/svg+xml')
      || type.startsWith('audio/')
      || type.startsWith('video/');
  }

  function isImportableDriveItem(item) {
    if (!item) return false;
    if (item.isFolder) return true;
    if (item.isShortcut || item.canDownload === false) return false;
    const type = String(item.mimeType || '').toLowerCase();
    if (type === 'application/vnd.google-apps.shortcut') return false;
    if (type.startsWith('application/vnd.google-apps.')) {
      return [
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation',
        'application/vnd.google-apps.drawing'
      ].includes(type);
    }
    return true;
  }

  function isPreviewableDriveItem(item) {
    if (!isImportableDriveItem(item) || item.isFolder) return false;
    const type = String(item.mimeType || '').toLowerCase();
    if ([
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.google-apps.presentation',
      'application/vnd.google-apps.drawing'
    ].includes(type)) return true;
    return isPreviewableMime(type);
  }

  function publicationHasPublicAction(item) {
    return Boolean((item?.allowDownload && item?.canDownload) || (item?.allowView && item?.canPreview));
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
      if (last) return `<span class="dl-crumb" aria-current="page">${escapeHtml(crumb.name)}</span>`;
      return `<button class="dl-crumb" type="button" data-drive-crumb="${index}">${escapeHtml(crumb.name)}</button>` +
        '<span class="dl-crumb-sep" aria-hidden="true">›</span>';
    }).join('');
  }

  function renderDriveList() {
    refs.driveCount.textContent = String(state.driveItems.length);
    refs.tableHead.hidden = state.driveItems.length === 0;
    refs.loadMoreWrap.hidden = !state.nextPageToken;
    refs.driveList.setAttribute('aria-busy', 'false');

    const term = refs.search.value.trim();
    refs.searchClear.hidden = !term;

    if (!state.driveItems.length) {
      refs.driveList.removeAttribute('role');
      refs.driveList.innerHTML = emptyState(
        term ? 'Nenhum resultado' : 'Esta pasta está vazia',
        term ? `Não encontramos arquivos ou pastas para “${term}”.` : 'Abra outra pasta ou adicione conteúdo no Google Drive.',
        true,
        term ? '<button class="ap-btn ap-btn-ghost ap-btn-sm" type="button" data-drive-clear-search>Limpar busca</button>' : ''
      );
      updateSelectionUi();
      return;
    }

    refs.driveList.setAttribute('role', 'list');
    refs.driveList.innerHTML = state.driveItems.map((item) => {
      const kind = fileKind(item);
      const selected = state.selected.has(item.id);
      const sourceAvailable = isImportableDriveItem(item);
      const selectionLimitReached = state.selected.size >= MAX_DIRECT_SELECTION;
      const selectionDisabled = state.publishing || !sourceAvailable || (!selected && selectionLimitReached);
      const url = safeUrl(item.webViewLink);
      const publication = state.publications.find((entry) => entry.driveId === item.id);
      const publicationBadge = publication
        ? `<span class="dl-sync-badge">${publication.status === 'published' ? 'No site' : 'Oculto'}</span>`
        : '';
      return `
        <div class="dl-drive-row${selected ? ' is-selected' : ''}${publication ? ' is-published' : ''}" data-drive-row="${escapeHtml(item.id)}" role="listitem">
          <label class="dl-check-cell"><input class="dl-check" type="checkbox" data-drive-select="${escapeHtml(item.id)}" ${!sourceAvailable ? 'data-drive-unavailable="true"' : ''} aria-label="${!sourceAvailable ? 'Indisponível para importar: ' : 'Selecionar '}${escapeHtml(item.name)}" ${selected ? 'checked' : ''} ${selectionDisabled ? 'disabled' : ''} /></label>
          <span class="dl-file-icon ${escapeHtml(kind.css)}" role="img" aria-label="${escapeHtml(kind.label)}">${item.isFolder ? ICONS.folder : ICONS.file}</span>
          <div class="dl-file-main">
            ${item.isFolder
              ? `<button class="dl-file-name" type="button" data-drive-folder="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`
              : `<span class="dl-file-name">${escapeHtml(item.name)}</span>`}
            <span class="dl-file-sub">${escapeHtml(kind.label)}${item.isFolder ? ' · abrir pasta' : ''}${!sourceAvailable ? ' · <span class="dl-file-unavailable">sem permissão para importar</span>' : ''}${publicationBadge}</span>
          </div>
          <span class="dl-file-cell dl-file-size"><span class="sr-only">Tamanho: </span>${item.isFolder ? '—' : escapeHtml(formatSize(item.size))}</span>
          <span class="dl-file-cell dl-file-date"><span class="sr-only">Modificado: </span>${escapeHtml(formatDate(item.modifiedTime))}</span>
          <span class="dl-row-action">${url
            ? `<a class="dl-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="Visualizar ${escapeHtml(item.name)} no Drive" title="Abrir no Drive">${ICONS.external}</a>`
            : ''}</span>
        </div>`;
    }).join('');
    updateSelectionUi();
  }

  function updateSummaryMetrics() {
    refs.publishedMetric.textContent = String(state.publications.filter((item) => item.status === 'published').length);
    refs.draftMetric.textContent = String(state.publications.filter((item) => item.status === 'draft').length);
    refs.categoryMetric.textContent = String(state.categories.length);
  }

  function renderSelectedPreview() {
    const items = Array.from(state.selected.values());
    const visibleIds = new Set(state.driveItems.map((item) => item.id));
    const outsideCount = items.filter((item) => !visibleIds.has(item.id)).length;
    refs.selectedPreview.innerHTML = items.map((item) => `
      <span class="dl-selected-chip">
        <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <button type="button" data-selected-remove="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)} da seleção" ${state.publishing ? 'disabled' : ''}>×</button>
      </span>`).join('') +
      (outsideCount ? `<span class="dl-selected-context">${outsideCount} ${outsideCount === 1 ? 'item selecionado está' : 'itens selecionados estão'} em outra pasta ou busca.</span>` : '');
  }

  function updateSelectionUi() {
    const count = state.selected.size;
    const hasSelection = count > 0;
    refs.publishBar.dataset.state = hasSelection ? 'ready' : 'empty';
    refs.publishEmpty.hidden = hasSelection;
    refs.publishContent.hidden = !hasSelection;
    refs.clearSelection.disabled = state.publishing;
    refs.selectionCount.textContent = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`;

    const visibleIds = state.driveItems
      .filter(isImportableDriveItem)
      .map((item) => item.id)
      .filter(Boolean);
    const selectedVisible = visibleIds.filter((id) => state.selected.has(id)).length;
    refs.selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    refs.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    refs.selectAll.disabled = state.publishing || visibleIds.length === 0;

    const selectedItems = Array.from(state.selected.values());
    const hasFolder = selectedItems.some((item) => item.isFolder);
    const hasDirectFile = selectedItems.some((item) => !item.isFolder);
    refs.recursiveWrap.hidden = !hasFolder;
    const hasCategories = state.categories.some((category) => category.active !== false);
    const hasCategorySelection = state.publishCategoryIds.size > 0;
    const hasPermission = refs.allowView.checked || refs.allowDownload.checked;
    const sourceAvailable = selectedItems.every(isImportableDriveItem);
    const previewOnlyValid = refs.allowDownload.checked || (
      refs.allowView.checked && !hasFolder && selectedItems.every(isPreviewableDriveItem)
    );
    const withinLimit = count <= MAX_DIRECT_SELECTION;
    const categoriesWithinLimit = state.publishCategoryIds.size <= MAX_CATEGORY_SELECTION;
    const selectionContainsFiles = hasDirectFile || (hasFolder && refs.recursive.checked);
    const canPublish = hasSelection && selectionContainsFiles && hasCategories && hasCategorySelection
      && hasPermission && previewOnlyValid && sourceAvailable && withinLimit && categoriesWithinLimit
      && state.driveReady && !state.publishing && !state.categoryMutating && !state.initializing
      && state.pendingPublications.size === 0;
    refs.publishSelected.disabled = !canPublish || refs.publishSelected.dataset.busy === 'true';

    if (!state.driveReady && hasSelection) {
      refs.permissionHint.textContent = 'Reconecte o Google Drive antes de publicar esta seleção.';
    } else if (!withinLimit) {
      refs.permissionHint.textContent = `Selecione no máximo ${MAX_DIRECT_SELECTION} itens por publicação.`;
    } else if (!categoriesWithinLimit) {
      refs.permissionHint.textContent = `Selecione no máximo ${MAX_CATEGORY_SELECTION} categorias.`;
    } else if (!sourceAvailable) {
      refs.permissionHint.textContent = 'Remova da seleção os arquivos sem permissão para importação.';
    } else if (hasSelection && !refs.allowDownload.checked && hasFolder) {
      refs.permissionHint.textContent = 'Para publicar pastas com segurança, mantenha “Baixar arquivo” ativo; a pasta pode conter formatos que não abrem no navegador.';
    } else if (hasSelection && refs.allowView.checked && !refs.allowDownload.checked && !selectedItems.every(isPreviewableDriveItem)) {
      refs.permissionHint.textContent = 'Um ou mais formatos selecionados não podem ser abertos no navegador. Ative “Baixar arquivo”.';
    } else if (count === MAX_DIRECT_SELECTION) {
      refs.permissionHint.textContent = `Limite de ${MAX_DIRECT_SELECTION} itens atingido. Publique esta seleção antes de adicionar outros.`;
    } else {
      refs.permissionHint.textContent = '';
    }

    const publishLabel = refs.publishSelected.querySelector('[data-publish-label]');
    if (publishLabel && refs.publishSelected.dataset.busy !== 'true') {
      let label = `Publicar ${count} ${count === 1 ? 'item' : 'itens'} no site`;
      if (!state.driveReady) label = 'Reconecte o Google Drive';
      else if (state.initializing || state.categoryMutating || state.pendingPublications.size) label = 'Aguarde a atualização';
      else if (!withinLimit) label = `Máximo de ${MAX_DIRECT_SELECTION} itens por vez`;
      else if (!selectionContainsFiles) label = 'Inclua os arquivos das pastas';
      else if (!hasCategories) label = 'Crie uma categoria para publicar';
      else if (!hasCategorySelection) label = 'Selecione uma categoria';
      else if (!previewOnlyValid) label = 'Ative o download para esta seleção';
      else if (!categoriesWithinLimit) label = `Máximo de ${MAX_CATEGORY_SELECTION} categorias`;
      publishLabel.textContent = label;
    }

    renderSelectedPreview();
    refs.driveList.querySelectorAll('[data-drive-row]').forEach((row) => {
      row.classList.toggle('is-selected', state.selected.has(row.dataset.driveRow));
      const checkbox = row.querySelector('[data-drive-select]');
      if (checkbox) {
        checkbox.checked = state.selected.has(row.dataset.driveRow);
        checkbox.disabled = state.publishing || checkbox.dataset.driveUnavailable === 'true'
          || (!checkbox.checked && count >= MAX_DIRECT_SELECTION);
      }
    });
    updateSummaryMetrics();
  }

  function renderCategoryChoices() {
    const available = state.categories.filter((category) => category.active !== false);
    for (const id of Array.from(state.publishCategoryIds)) {
      if (!available.some((category) => category.id === id)) state.publishCategoryIds.delete(id);
    }
    refs.publishCategories.innerHTML = available.length
      ? available.map((category) => `
          <label class="dl-category-choice">
            <input type="checkbox" data-publish-category="${escapeHtml(category.id)}" ${state.publishCategoryIds.has(category.id) ? 'checked' : ''} ${state.publishing || state.categoryMutating || state.initializing || (!state.publishCategoryIds.has(category.id) && state.publishCategoryIds.size >= MAX_CATEGORY_SELECTION) ? 'disabled' : ''} />
            <span>${escapeHtml(category.name)}</span>
          </label>`).join('')
      : '<span class="dl-choice-empty">Nenhuma categoria criada.</span>';
    updateSelectionUi();
  }

  function renderCategoryList() {
    refs.categoryCount.textContent = String(state.categories.length);
    refs.categoryList.setAttribute('aria-busy', 'false');
    refs.categoryMetric.textContent = String(state.categories.length);
    if (!state.categories.length) {
      refs.categoryList.removeAttribute('role');
      refs.categoriesPanel.open = true;
      refs.categoryList.innerHTML = emptyState('Nenhuma categoria', 'Crie a primeira categoria para organizar seus arquivos.');
      renderCategoryChoices();
      renderPublicationFilters();
      return;
    }
    refs.categoryList.setAttribute('role', 'list');
    refs.categoryList.innerHTML = state.categories.map((category, index) => `
      <div class="dl-category-row" data-category-row="${escapeHtml(category.id)}" role="listitem">
        <span class="dl-category-dot" style="opacity:${category.active ? 1 : .35}"></span>
        <div class="dl-category-main">
          <strong>${escapeHtml(category.name)}</strong>
          <small>${escapeHtml(category.slug)}${category.active ? '' : ' · inativa'}</small>
        </div>
        <button class="dl-icon-button" type="button" data-category-edit="${escapeHtml(category.id)}" title="Editar categoria" aria-label="Editar ${escapeHtml(category.name)}" ${state.publishing || state.categoryMutating || state.initializing || state.pendingPublications.size ? 'disabled' : ''}>${ICONS.edit}</button>
        <button class="dl-icon-button is-danger" type="button" data-category-delete="${escapeHtml(category.id)}" title="Excluir categoria" aria-label="Excluir ${escapeHtml(category.name)}" ${state.publishing || state.categoryMutating || state.initializing || state.pendingPublications.size ? 'disabled' : ''}>${ICONS.trash}</button>
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

    const hasFilters = Boolean(term || categoryId || status);
    refs.publishedClearFilters.hidden = !hasFilters;
    refs.publishedResultCount.textContent = `${rows.length} de ${state.publications.length} ${state.publications.length === 1 ? 'item' : 'itens'}`;
    refs.publishedTableHead.hidden = rows.length === 0;
    refs.publishedList.setAttribute('aria-busy', 'false');
    updateSummaryMetrics();

    if (!rows.length) {
      refs.publishedList.removeAttribute('role');
      refs.publishedList.innerHTML = emptyState(
        state.publications.length ? 'Nenhum item neste filtro' : 'Nenhum download liberado',
        state.publications.length ? 'Altere a busca ou limpe os filtros para ver outros itens.' : 'Selecione arquivos ou pastas acima para publicá-los.',
        true,
        hasFilters ? '<button class="ap-btn ap-btn-ghost ap-btn-sm" type="button" data-published-clear-filters>Limpar filtros</button>' : ''
      );
      return;
    }

    refs.publishedList.setAttribute('role', 'list');
    refs.publishedList.innerHTML = rows.map((item) => {
      const kind = fileKind(item);
      const url = safeUrl(item.webViewLink);
      const busy = state.pendingPublications.has(item.id);
      const controlsLocked = busy || state.publishing || state.categoryMutating || state.initializing;
      const categories = item.categoryIds.length
        ? item.categoryIds.map((id) => `<span class="dl-category-tag">${escapeHtml(categoryName(id))}</span>`).join('')
        : '<span class="dl-category-tag is-muted">Sem categoria</span>';
      return `
        <div class="dl-published-row${busy ? ' is-busy' : ''}" data-publication-row="${escapeHtml(item.id)}" role="listitem" ${busy ? 'aria-busy="true"' : ''}>
          <span class="dl-file-icon ${escapeHtml(kind.css)}" role="img" aria-label="${escapeHtml(kind.label)}">${item.isFolder ? ICONS.folder : ICONS.file}</span>
          <div class="dl-file-main">
            <span class="dl-file-name">${escapeHtml(item.name)}</span>
            <span class="dl-file-sub">${escapeHtml(kind.label)}${item.size != null && !item.isFolder ? ' · ' + escapeHtml(formatSize(item.size)) : ''}${item.modifiedTime ? ' · atualizado ' + escapeHtml(formatDate(item.modifiedTime)) : ''}</span>
          </div>
          <div class="dl-pub-categories"><span class="sr-only">Categorias: </span>${categories}</div>
          <div class="dl-permission-summary"><span class="sr-only">Permissões: </span>
            <span class="dl-permission-badge${item.allowView && item.canPreview ? '' : ' is-off'}">Abrir online</span>
            <span class="dl-permission-badge${item.allowDownload && item.canDownload ? '' : ' is-off'}">Baixar</span>
          </div>
          <div class="dl-status-cell">
            <button class="dl-status-button${item.status === 'draft' ? ' is-draft' : ''}" type="button" data-publication-status="${escapeHtml(item.id)}" aria-label="${item.status === 'published' ? 'Ocultar' : 'Tornar visível'} ${escapeHtml(item.name)}" title="${item.status === 'published' ? 'Clique para ocultar do site' : 'Clique para tornar visível no site'}" ${controlsLocked ? 'disabled' : ''}>
              <span class="dl-status-dot" aria-hidden="true"></span>${item.status === 'published' ? 'Visível' : 'Oculto'}
            </button>
          </div>
          <div class="dl-pub-actions">
            ${item.status === 'published' && item.allowView && item.canPreview && url ? `<a class="dl-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="Abrir como visitante" aria-label="Abrir ${escapeHtml(item.name)} como visitante" ${busy ? 'aria-disabled="true" tabindex="-1"' : ''}>${ICONS.external}</a>` : ''}
            <button class="dl-icon-button" type="button" data-publication-edit="${escapeHtml(item.id)}" title="Editar download" aria-label="Editar ${escapeHtml(item.name)}" ${controlsLocked ? 'disabled' : ''}>${ICONS.edit}</button>
            <button class="dl-icon-button is-danger" type="button" data-publication-delete="${escapeHtml(item.id)}" title="Remover do site" aria-label="Remover ${escapeHtml(item.name)} do site" ${controlsLocked ? 'disabled' : ''}>${ICONS.trash}</button>
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
    const requestId = ++state.driveRequestId;
    if (!state.driveReady) {
      state.driveItems = [];
      state.nextPageToken = '';
      refs.driveCount.textContent = '0';
      refs.tableHead.hidden = true;
      refs.loadMoreWrap.hidden = true;
      refs.driveList.setAttribute('aria-busy', 'false');
      refs.driveList.removeAttribute('role');
      refs.driveList.innerHTML = emptyState('Drive indisponível', 'Conclua a configuração indicada acima para navegar pelos arquivos.');
      updateSelectionUi();
      return;
    }

    if (append) setButtonBusy(refs.loadMore, true, 'Carregando…');
    else {
      if (refs.loadMore.dataset.busy === 'true') setButtonBusy(refs.loadMore, false);
      state.driveItems = [];
      state.nextPageToken = '';
      refs.driveCount.textContent = '…';
      refs.tableHead.hidden = true;
      refs.loadMoreWrap.hidden = true;
      refs.driveList.setAttribute('aria-busy', 'true');
      refs.driveList.removeAttribute('role');
      refs.driveList.innerHTML = loadingState('Carregando arquivos…');
    }

    try {
      const params = new URLSearchParams();
      if (state.currentFolderId) params.set('folderId', state.currentFolderId);
      const term = refs.search.value.trim();
      if (term) params.set('q', term);
      if (append && state.nextPageToken) params.set('pageToken', state.nextPageToken);
      const response = await api('/drive/items' + (params.toString() ? `?${params}` : ''));
      if (requestId !== state.driveRequestId) return;
      const incoming = arrayFrom(response, ['items', 'files', 'driveItems']).map(normalizeDriveItem).filter((item) => item.id);
      incoming.forEach((item) => {
        if (state.selected.has(item.id)) state.selected.set(item.id, item);
      });
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
      if (requestId !== state.driveRequestId) return;
      if (!append) {
        state.driveItems = [];
        state.nextPageToken = '';
        refs.driveCount.textContent = '0';
        refs.tableHead.hidden = true;
        refs.driveList.innerHTML = emptyState(
          'Não foi possível listar os arquivos',
          friendlyError(error),
          false,
          '<button class="ap-btn ap-btn-ghost ap-btn-sm" type="button" data-drive-retry>Tentar novamente</button>'
        );
        updateSelectionUi();
      }
      setFeedback(friendlyError(error));
    } finally {
      if (requestId === state.driveRequestId) {
        refs.driveList.setAttribute('aria-busy', 'false');
        if (append) setButtonBusy(refs.loadMore, false);
      }
    }
  }

  async function loadCategories() {
    const requestId = ++state.categoryRequestId;
    refs.categoryList.setAttribute('aria-busy', 'true');
    refs.categoryList.removeAttribute('role');
    refs.categoryList.innerHTML = loadingState('Carregando categorias…');
    try {
      const response = await api('/download-categories');
      if (requestId !== state.categoryRequestId) return false;
      state.categories = arrayFrom(response, ['categories', 'items'])
        .map(normalizeCategory)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      renderCategoryList();
      return true;
    } catch (error) {
      if (requestId !== state.categoryRequestId) return false;
      state.categories = [];
      state.publishCategoryIds.clear();
      refs.categoryCount.textContent = '0';
      refs.categoryMetric.textContent = '0';
      refs.categoryList.setAttribute('aria-busy', 'false');
      refs.categoryList.removeAttribute('role');
      refs.categoryList.innerHTML = emptyState(
        'Categorias indisponíveis',
        friendlyError(error),
        false,
        '<button class="ap-btn ap-btn-ghost ap-btn-sm" type="button" data-categories-retry>Tentar novamente</button>'
      );
      renderCategoryChoices();
      renderPublicationFilters();
      throw error;
    }
  }

  async function loadPublications() {
    const requestId = ++state.publicationRequestId;
    refs.publishedList.setAttribute('aria-busy', 'true');
    refs.publishedList.removeAttribute('role');
    refs.publishedTableHead.hidden = true;
    refs.publishedResultCount.textContent = 'Atualizando…';
    refs.publishedList.innerHTML = loadingState('Carregando publicações…');
    try {
      const response = await api('/downloads');
      if (requestId !== state.publicationRequestId) return false;
      state.publications = arrayFrom(response, ['items', 'downloads', 'publications'])
        .map(normalizePublication)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      renderPublications();
      if (state.driveItems.length) renderDriveList();
      return true;
    } catch (error) {
      if (requestId !== state.publicationRequestId) return false;
      state.publications = [];
      refs.publishedCount.textContent = '0';
      refs.publishedMetric.textContent = '0';
      refs.draftMetric.textContent = '0';
      refs.publishedResultCount.textContent = 'Não disponível';
      refs.publishedList.setAttribute('aria-busy', 'false');
      refs.publishedList.removeAttribute('role');
      refs.publishedTableHead.hidden = true;
      refs.publishedList.innerHTML = emptyState(
        'Publicações indisponíveis',
        friendlyError(error),
        false,
        '<button class="ap-btn ap-btn-ghost ap-btn-sm" type="button" data-publications-retry>Tentar novamente</button>'
      );
      if (state.driveItems.length && refs.driveList.getAttribute('aria-busy') !== 'true') renderDriveList();
      throw error;
    }
  }

  async function refreshAll() {
    if (state.initializing || state.publishing || state.categoryMutating || state.pendingPublications.size) return;
    state.initializing = true;
    setFeedback('');
    setButtonBusy(refs.refresh, true, 'Atualizando…');
    syncDownloadManagementLocks();
    updateSelectionUi();
    try {
      const dataTask = Promise.allSettled([loadCategories(), loadPublications()]);
      let statusError = null;
      try {
        await loadStatus();
      } catch (error) {
        statusError = error;
        setFeedback(friendlyError(error));
      }
      /* Categorias e publicações começam em paralelo com o status. Somente a
         navegação do Drive depende da confirmação da conexão. */
      const [dataResults, driveResult] = await Promise.all([
        dataTask,
        Promise.allSettled([loadDrive()])
      ]);
      const results = [...dataResults, ...driveResult];
      if (dataResults[1].status === 'fulfilled' && dataResults[1].value !== false) renderPublications();
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected && !refs.feedback.textContent) setFeedback(friendlyError(rejected.reason));
      if (statusError && !refs.feedback.textContent) setFeedback(friendlyError(statusError));
      state.initialized = true;
    } finally {
      state.initializing = false;
      setButtonBusy(refs.refresh, false);
      syncDownloadManagementLocks();
      updateSelectionUi();
    }
  }

  async function publishSelection() {
    const items = Array.from(state.selected.values());
    const categoryIds = Array.from(state.publishCategoryIds);
    if (!items.length) return;
    if (state.publishing || state.categoryMutating || state.initializing || state.pendingPublications.size) return;
    if (!state.driveReady) {
      setFeedback('Reconecte o Google Drive antes de publicar esta seleção.');
      return;
    }
    if (items.length > MAX_DIRECT_SELECTION) {
      setFeedback(`Selecione no máximo ${MAX_DIRECT_SELECTION} itens por publicação.`);
      return;
    }
    if (items.some((item) => !isImportableDriveItem(item))) {
      setFeedback('Remova da seleção os arquivos sem permissão para importação.');
      return;
    }
    if (categoryIds.length > MAX_CATEGORY_SELECTION) {
      setFeedback(`Selecione no máximo ${MAX_CATEGORY_SELECTION} categorias.`);
      return;
    }
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
    if (!refs.allowDownload.checked && items.some((item) => item.isFolder || !isPreviewableDriveItem(item))) {
      setFeedback('Ative “Baixar arquivo”: esta seleção contém pasta ou formato que não pode ser garantido para abertura online.');
      refs.allowDownload.focus();
      return;
    }

    setFeedback('');
    state.publicationRequestId += 1;
    setPublishingBusy(true);
    setButtonBusy(refs.publishSelected, true, 'Liberando…');
    let mutationSucceeded = false;
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
      const skipped = resultCount(firstDefined(response.skippedCount, response.skipped, 0));
      let message = `${items.length === 1 ? 'Item publicado' : 'Itens publicados'} na página de Downloads.`;
      if (created || updated || skipped) {
        const parts = [];
        if (created) parts.push(`${created} ${created === 1 ? 'novo' : 'novos'}`);
        if (updated) parts.push(`${updated} ${updated === 1 ? 'atualizado' : 'atualizados'}`);
        if (skipped) parts.push(`${skipped} ${skipped === 1 ? 'ignorado' : 'ignorados'}`);
        message = `Publicação concluída: ${parts.join(', ')}. Ajustes individuais existentes foram preservados.`;
      }
      state.selected.clear();
      renderDriveList();
      mutationSucceeded = true;
      announce(message);
      try {
        await loadPublications();
      } catch (_) {
        announce(`${message} A lista não pôde ser atualizada agora; use “Sincronizar dados” para conferir.`, 'info');
      }
    } catch (error) {
      reportActionError(error);
      if (!mutationSucceeded) renderPublications();
    } finally {
      setButtonBusy(refs.publishSelected, false);
      setPublishingBusy(false);
    }
  }

  function resetCategoryForm() {
    refs.categoryForm.reset();
    refs.categoryForm.elements.id.value = '';
    refs.categoryActive.checked = true;
    refs.categorySubmit.textContent = 'Adicionar';
    refs.categoryEditActions.hidden = true;
  }

  function editCategory(id) {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    refs.categoryForm.elements.id.value = category.id;
    refs.categoryForm.elements.name.value = category.name;
    refs.categoryForm.elements.description.value = category.description;
    refs.categoryActive.checked = category.active !== false;
    refs.categorySubmit.textContent = 'Salvar';
    refs.categoryEditActions.hidden = false;
    refs.categoryForm.elements.name.focus();
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (state.publishing || state.categoryMutating || state.initializing || state.pendingPublications.size) return;
    const id = String(refs.categoryForm.elements.id.value || '');
    const name = String(refs.categoryForm.elements.name.value || '').trim();
    const description = String(refs.categoryForm.elements.description.value || '').trim();
    if (!name) return;
    setFeedback('');
    setButtonBusy(refs.categorySubmit, true, id ? 'Salvando…' : 'Adicionando…');
    state.categoryRequestId += 1;
    setCategoryMutationBusy(true);
    try {
      await api('/download-categories' + (id ? `/${encodeURIComponent(id)}` : ''), {
        method: id ? 'PUT' : 'POST',
        body: { name, slug: slugify(name), description, active: refs.categoryActive.checked }
      });
      resetCategoryForm();
      const message = id ? 'Categoria atualizada.' : 'Categoria criada.';
      announce(message);
      try {
        const loaded = await loadCategories();
        if (loaded !== false) renderPublications();
      } catch (_) {
        announce(`${message} A lista de categorias não pôde ser recarregada agora.`, 'info');
      }
    } catch (error) {
      reportActionError(error);
      renderCategoryList();
    } finally {
      setButtonBusy(refs.categorySubmit, false);
      setCategoryMutationBusy(false);
      refs.categorySubmit.textContent = refs.categoryForm.elements.id.value ? 'Salvar' : 'Adicionar';
    }
  }

  async function deleteCategory(id, button) {
    if (state.publishing || state.categoryMutating || state.initializing || state.pendingPublications.size) return;
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    if (!window.confirm(`Excluir a categoria “${category.name}”? Os arquivos não serão excluídos do Drive.`)) return;
    const visibleIds = Array.from(refs.categoryList.querySelectorAll('[data-category-row]'))
      .map((row) => row.dataset.categoryRow);
    const visibleIndex = visibleIds.indexOf(id);
    const nextFocusId = visibleIds[visibleIndex + 1] || visibleIds[visibleIndex - 1] || '';
    setFeedback('');
    setButtonBusy(button, true);
    state.categoryRequestId += 1;
    setCategoryMutationBusy(true);
    try {
      await api(`/download-categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.publishCategoryIds.delete(id);
      if (refs.categoryForm.elements.id.value === id) resetCategoryForm();
      announce('Categoria removida.');
      const results = await Promise.allSettled([loadCategories(), loadPublications()]);
      if (results.every((result) => result.status === 'fulfilled' && result.value !== false)) {
        renderPublications();
      } else {
        announce('Categoria removida. Uma das listas não pôde ser recarregada agora.', 'info');
      }
      focusCategoryControl(nextFocusId);
    } catch (error) {
      reportActionError(error);
      renderCategoryList();
      focusCategoryControl(id);
    } finally {
      if (button?.isConnected) setButtonBusy(button, false);
      setCategoryMutationBusy(false);
    }
  }

  function hasPublicPermission(viewInput, downloadInput, changedInput, showFeedback = setFeedback) {
    if (viewInput.checked || downloadInput.checked) return true;
    if (changedInput) changedInput.checked = true;
    showFeedback('Ao menos “Abrir online” ou “Baixar arquivo” deve permanecer ativo.');
    return false;
  }

  function updateEditorPermissionHint() {
    const id = String(refs.editForm.elements.id.value || '');
    const publication = state.publications.find((item) => item.id === id);
    if (publication && refs.editAllowView.checked && !refs.editAllowDownload.checked
      && !isPreviewableMime(publication.deliveryMimeType || publication.mimeType)) {
      refs.editPermissionHint.textContent = 'Este formato não abre no navegador. Mantenha o download ativo.';
      return false;
    }
    refs.editPermissionHint.textContent = 'Ao menos uma opção deve permanecer ativa.';
    return true;
  }

  function syncEditorCategoryLimit() {
    const inputs = Array.from(refs.editCategories.querySelectorAll('[data-edit-category-active="true"]'));
    const checkedCount = inputs.filter((input) => input.checked).length;
    inputs.forEach((input) => {
      input.disabled = state.editorSaving || (!input.checked && checkedCount >= MAX_CATEGORY_SELECTION);
    });
    return checkedCount;
  }

  function setEditorBusy(busy) {
    state.editorSaving = busy;
    refs.editDrawer.toggleAttribute('aria-busy', busy);
    refs.editForm.querySelectorAll('input, textarea, select').forEach((control) => {
      if (busy) {
        control.dataset.editorWasDisabled = control.disabled ? 'true' : 'false';
        control.disabled = true;
      } else {
        control.disabled = control.dataset.editorWasDisabled === 'true';
        delete control.dataset.editorWasDisabled;
      }
    });
    refs.editDrawer.querySelectorAll('[data-download-edit-close]').forEach((control) => {
      control.disabled = busy;
    });
  }

  function findPublicationControl(attribute, id) {
    return Array.from(refs.publishedList.querySelectorAll(`[${attribute}]`))
      .find((element) => element.getAttribute(attribute) === String(id)) || null;
  }

  function focusPublicationControl(attribute, id) {
    window.setTimeout(() => {
      const target = id ? findPublicationControl(attribute, id) : null;
      (target || refs.publishedResultCount).focus({ preventScroll: true });
    }, 0);
  }

  function focusCategoryControl(id) {
    window.setTimeout(() => {
      const target = id
        ? Array.from(refs.categoryList.querySelectorAll('[data-category-edit]'))
          .find((element) => element.dataset.categoryEdit === String(id))
        : null;
      (target || refs.categoriesPanel.querySelector('summary') || refs.categoryList).focus({ preventScroll: true });
    }, 0);
  }

  function setPublicationPending(id, busy) {
    if (busy) state.pendingPublications.add(id);
    else state.pendingPublications.delete(id);
    const row = Array.from(refs.publishedList.querySelectorAll('[data-publication-row]'))
      .find((element) => element.dataset.publicationRow === String(id));
    if (row) {
      row.classList.toggle('is-busy', busy);
      row.toggleAttribute('aria-busy', busy);
      row.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
      row.querySelectorAll('a').forEach((link) => {
        link.toggleAttribute('aria-disabled', busy);
        if (busy) link.setAttribute('tabindex', '-1');
        else link.removeAttribute('tabindex');
      });
    }
    syncDownloadManagementLocks();
    updateSelectionUi();
  }

  function syncDownloadManagementLocks() {
    const publicationLocked = state.publishing || state.categoryMutating || state.initializing;
    const categoryLocked = publicationLocked || state.categoryMutating || state.pendingPublications.size > 0;
    const selectionConfigLocked = state.publishing || state.categoryMutating || state.initializing;
    refs.refresh.disabled = categoryLocked;
    refs.allowView.disabled = selectionConfigLocked;
    refs.allowDownload.disabled = selectionConfigLocked;
    refs.recursive.disabled = selectionConfigLocked;
    refs.categoriesJump.disabled = selectionConfigLocked;
    refs.publishCategories.querySelectorAll('input').forEach((input) => {
      input.disabled = selectionConfigLocked
        || (!input.checked && state.publishCategoryIds.size >= MAX_CATEGORY_SELECTION);
    });
    refs.selectedPreview.querySelectorAll('button').forEach((button) => { button.disabled = state.publishing; });
    refs.categoryForm.querySelectorAll('input, button').forEach((control) => { control.disabled = categoryLocked; });
    refs.categoryList.querySelectorAll('button').forEach((control) => { control.disabled = categoryLocked; });
    refs.publishedList.querySelectorAll('[data-publication-row]').forEach((row) => {
      const rowLocked = publicationLocked || state.pendingPublications.has(row.dataset.publicationRow);
      row.querySelectorAll('button').forEach((control) => { control.disabled = rowLocked; });
    });
  }

  function setPublishingBusy(busy) {
    state.publishing = busy;
    syncDownloadManagementLocks();
    updateSelectionUi();
  }

  function setCategoryMutationBusy(busy) {
    state.categoryMutating = busy;
    syncDownloadManagementLocks();
    updateSelectionUi();
  }

  function openPublicationEditor(id) {
    if (state.editorSaving || state.publishing || state.categoryMutating || state.initializing) return;
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) return;
    state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.lastFocusedPublicationId = publication.id;
    setDrawerFeedback('');
    refs.editForm.elements.id.value = publication.id;
    refs.editForm.elements.name.value = publication.name;
    refs.editForm.elements.description.value = publication.description;
    refs.editAllowView.checked = publication.allowView;
    refs.editAllowDownload.checked = publication.allowDownload;
    const editorCategories = state.categories.filter((category) => (
      category.active !== false || publication.categoryIds.includes(category.id)
    ));
    state.editorOriginalActiveCategoryIds = editorCategories
      .filter((category) => category.active !== false && publication.categoryIds.includes(category.id))
      .map((category) => category.id)
      .sort();
    const hasInactiveAssociation = editorCategories.some((category) => (
      category.active === false && publication.categoryIds.includes(category.id)
    ));
    refs.editCategories.innerHTML = editorCategories.map((category) => `
      <label class="dl-category-choice">
        <input type="checkbox" value="${escapeHtml(category.id)}" data-edit-category-active="${category.active !== false}" ${publication.categoryIds.includes(category.id) ? 'checked' : ''} ${category.active === false ? 'disabled' : ''} />
        <span>${escapeHtml(category.name)}${category.active === false ? ' (inativa)' : ''}</span>
      </label>
    `).join('') + (hasInactiveAssociation
      ? '<span class="dl-choice-empty">Associações inativas serão preservadas enquanto as categorias ativas não forem alteradas.</span>'
      : '') || '<span class="dl-choice-empty">Nenhuma categoria cadastrada.</span>';
    syncEditorCategoryLimit();
    updateEditorPermissionHint();
    refs.editDrawer.removeAttribute('inert');
    refs.editDrawer.classList.add('is-open');
    refs.editDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => refs.editForm.elements.name.focus(), 0);
  }

  function closePublicationEditor(force = false) {
    if (refs.editDrawer.getAttribute('aria-hidden') === 'true') return;
    if (state.editorSaving && !force) {
      setDrawerFeedback('Aguarde o salvamento terminar antes de fechar.');
      return;
    }
    refs.editDrawer.classList.remove('is-open');
    refs.editDrawer.setAttribute('aria-hidden', 'true');
    refs.editDrawer.setAttribute('inert', '');
    document.body.style.overflow = '';
    const returnFocus = state.lastFocusedElement?.isConnected
      ? state.lastFocusedElement
      : findPublicationControl('data-publication-edit', state.lastFocusedPublicationId);
    state.lastFocusedElement = null;
    state.lastFocusedPublicationId = '';
    state.editorOriginalActiveCategoryIds = [];
    window.setTimeout(() => (returnFocus || refs.publishedResultCount).focus({ preventScroll: true }), 0);
  }

  async function savePublicationEditor(event) {
    event.preventDefault();
    setDrawerFeedback('');
    const id = String(refs.editForm.elements.id.value || '');
    const name = String(refs.editForm.elements.name.value || '').trim();
    if (!id || !name) return;
    if (!hasPublicPermission(refs.editAllowView, refs.editAllowDownload, null, setDrawerFeedback)) return;
    if (!updateEditorPermissionHint()) {
      setDrawerFeedback('Este formato não pode ser publicado somente com abertura online. Ative “Permitir download”.');
      refs.editAllowDownload.focus();
      return;
    }
    const categoryIds = Array.from(refs.editCategories.querySelectorAll('[data-edit-category-active="true"]:checked'))
      .map((input) => input.value)
      .sort();
    const categoriesChanged = categoryIds.join('\u0000') !== state.editorOriginalActiveCategoryIds.join('\u0000');
    if (categoriesChanged && categoryIds.length > MAX_CATEGORY_SELECTION) {
      setDrawerFeedback(`Selecione no máximo ${MAX_CATEGORY_SELECTION} categorias.`);
      return;
    }
    const body = {
      name,
      description: String(refs.editForm.elements.description.value || '').trim(),
      allowView: refs.editAllowView.checked,
      allowDownload: refs.editAllowDownload.checked
    };
    if (categoriesChanged) {
      body.categoryId = categoryIds[0] || null;
      body.categoryIds = categoryIds;
    }
    setEditorBusy(true);
    try {
      await updatePublication(id, body, refs.editSubmit, 'Download atualizado.');
      setEditorBusy(false);
      closePublicationEditor(true);
    } catch (error) {
      setEditorBusy(false);
      setDrawerFeedback(friendlyError(error));
    }
  }

  async function updatePublication(id, body, control, successMessage) {
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) throw new AdminApiError('Download não encontrado na lista atual.', 404);
    if (state.publishing || state.categoryMutating || state.initializing) {
      const error = new AdminApiError('Aguarde a atualização em andamento terminar.', 409);
      reportActionError(error);
      throw error;
    }
    if (state.pendingPublications.has(id)) {
      const error = new AdminApiError('Aguarde a alteração anterior deste item terminar.', 409);
      reportActionError(error);
      throw error;
    }
    const restoreStatusFocus = control?.matches('.dl-status-button');
    setFeedback('');
    setButtonBusy(control, true, control?.matches('.dl-status-button') ? 'Salvando…' : '');
    state.publicationRequestId += 1;
    setPublicationPending(id, true);
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
      state.pendingPublications.delete(id);
      renderPublications();
      if (state.driveItems.length) renderDriveList();
      announce(successMessage);
      if (restoreStatusFocus) focusPublicationControl('data-publication-status', id);
    } catch (error) {
      reportActionError(error);
      renderPublications();
      throw error;
    } finally {
      if (control?.isConnected) setButtonBusy(control, false);
      setPublicationPending(id, false);
    }
  }

  async function deletePublication(id, button) {
    const publication = state.publications.find((item) => item.id === id);
    if (!publication) return;
    if (state.publishing || state.categoryMutating || state.initializing) return;
    if (state.pendingPublications.has(id)) {
      reportActionError(new AdminApiError('Aguarde a alteração anterior deste item terminar.', 409));
      return;
    }
    if (!window.confirm(`Remover “${publication.name}” da página de Downloads? O arquivo continuará no Google Drive.`)) return;
    const visibleIds = Array.from(refs.publishedList.querySelectorAll('[data-publication-row]'))
      .map((row) => row.dataset.publicationRow);
    const visibleIndex = visibleIds.indexOf(id);
    const nextFocusId = visibleIds[visibleIndex + 1] || visibleIds[visibleIndex - 1] || '';
    setFeedback('');
    setButtonBusy(button, true);
    state.publicationRequestId += 1;
    setPublicationPending(id, true);
    try {
      await api(`/downloads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.publications = state.publications.filter((item) => item.id !== id);
      state.pendingPublications.delete(id);
      renderPublications();
      if (state.driveItems.length) renderDriveList();
      announce('Item removido da página de Downloads.');
      focusPublicationControl('data-publication-edit', nextFocusId);
    } catch (error) {
      reportActionError(error);
      renderPublications();
    } finally {
      if (button?.isConnected) setButtonBusy(button, false);
      setPublicationPending(id, false);
    }
  }

  function clearDriveSearch() {
    window.clearTimeout(searchTimer);
    if (!refs.search.value) return;
    setFeedback('');
    refs.search.value = '';
    refs.searchClear.hidden = true;
    state.nextPageToken = '';
    loadDrive();
    refs.driveList.focus({ preventScroll: true });
  }

  function clearPublicationFilters() {
    refs.publishedSearch.value = '';
    refs.publishedCategory.value = '';
    refs.publishedStatus.value = '';
    renderPublications();
    refs.publishedSearch.focus();
  }

  function revealCategories() {
    refs.categoriesPanel.open = true;
    const reduceMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const behavior = reduceMotion ? 'auto' : 'smooth';
    refs.categoriesPanel.scrollIntoView({ behavior, block: 'nearest' });
    window.setTimeout(() => refs.categoryForm.elements.name.focus(), reduceMotion ? 0 : 250);
  }

  refs.refresh.addEventListener('click', async () => {
    await refreshAll();
    if (!refs.feedback.textContent && state.driveReady) {
      announce('Dados do Drive e do site atualizados.', 'success');
    } else if (!refs.feedback.textContent) {
      setFeedback('Dados do site atualizados; a conexão com o Drive continua pendente.', 'info');
    }
  });
  refs.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    setFeedback('');
    state.nextPageToken = '';
    loadDrive();
    refs.driveList.focus({ preventScroll: true });
  });

  let searchTimer = 0;
  refs.search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    refs.searchClear.hidden = !refs.search.value;
    searchTimer = window.setTimeout(() => {
      setFeedback('');
      state.nextPageToken = '';
      loadDrive();
    }, 450);
  });

  refs.searchClear.addEventListener('click', clearDriveSearch);
  refs.loadMore.addEventListener('click', () => {
    setFeedback('');
    loadDrive({ append: true });
  });
  refs.publishSelected.addEventListener('click', publishSelection);
  refs.clearSelection.addEventListener('click', () => {
    state.selected.clear();
    renderDriveList();
    refs.search.focus();
  });
  refs.selectedPreview.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-selected-remove]');
    if (!removeButton) return;
    const buttons = Array.from(refs.selectedPreview.querySelectorAll('[data-selected-remove]'));
    const buttonIndex = buttons.indexOf(removeButton);
    state.selected.delete(removeButton.dataset.selectedRemove);
    renderDriveList();
    const remainingButtons = Array.from(refs.selectedPreview.querySelectorAll('[data-selected-remove]'));
    const focusTarget = remainingButtons[Math.min(buttonIndex, remainingButtons.length - 1)] || refs.search;
    window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 0);
  });
  refs.categoriesJump.addEventListener('click', revealCategories);
  refs.categoryForm.addEventListener('submit', saveCategory);
  refs.categoryCancel.addEventListener('click', () => {
    resetCategoryForm();
    refs.categoryForm.elements.name.focus();
  });
  refs.editForm.addEventListener('submit', savePublicationEditor);
  refs.publishedSearch.addEventListener('input', renderPublications);
  refs.publishedCategory.addEventListener('change', renderPublications);
  refs.publishedStatus.addEventListener('change', renderPublications);
  refs.publishedClearFilters.addEventListener('click', clearPublicationFilters);

  refs.selectAll.addEventListener('change', () => {
    let omitted = 0;
    state.driveItems.forEach((item) => {
      if (!isImportableDriveItem(item)) return;
      if (refs.selectAll.checked) {
        if (!state.selected.has(item.id) && state.selected.size >= MAX_DIRECT_SELECTION) omitted += 1;
        else state.selected.set(item.id, item);
      }
      else state.selected.delete(item.id);
    });
    renderDriveList();
    if (omitted) {
      setFeedback(`O limite é de ${MAX_DIRECT_SELECTION} itens por publicação. ${omitted} ${omitted === 1 ? 'item não foi adicionado' : 'itens não foram adicionados'}.`, 'info');
    }
  });

  refs.publishCategories.addEventListener('change', (event) => {
    const input = event.target.closest('[data-publish-category]');
    if (!input) return;
    if (input.checked && state.publishCategoryIds.size >= MAX_CATEGORY_SELECTION
      && !state.publishCategoryIds.has(input.dataset.publishCategory)) {
      input.checked = false;
      setFeedback(`Selecione no máximo ${MAX_CATEGORY_SELECTION} categorias.`, 'info');
    } else if (input.checked) state.publishCategoryIds.add(input.dataset.publishCategory);
    else state.publishCategoryIds.delete(input.dataset.publishCategory);
    syncDownloadManagementLocks();
    updateSelectionUi();
  });

  [refs.allowView, refs.allowDownload].forEach((input) => {
    input.addEventListener('change', () => {
      hasPublicPermission(refs.allowView, refs.allowDownload, input);
      updateSelectionUi();
    });
  });
  refs.recursive.addEventListener('change', updateSelectionUi);
  [refs.editAllowView, refs.editAllowDownload].forEach((input) => {
    input.addEventListener('change', () => {
      const hasPermission = hasPublicPermission(refs.editAllowView, refs.editAllowDownload, input, setDrawerFeedback);
      const previewValid = updateEditorPermissionHint();
      if (hasPermission && previewValid) setDrawerFeedback('');
    });
  });
  refs.editCategories.addEventListener('change', (event) => {
    const input = event.target.closest('[data-edit-category-active="true"]');
    if (!input) return;
    const checkedCount = syncEditorCategoryLimit();
    if (checkedCount >= MAX_CATEGORY_SELECTION) {
      setDrawerFeedback(`Limite de ${MAX_CATEGORY_SELECTION} categorias atingido.`, false);
    } else {
      setDrawerFeedback('');
    }
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
    window.clearTimeout(searchTimer);
    setFeedback('');
    refs.search.value = '';
    refs.searchClear.hidden = true;
    state.nextPageToken = '';
    renderBreadcrumb();
    loadDrive();
    refs.driveList.focus({ preventScroll: true });
  });

  refs.driveList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-drive-select]');
    if (!checkbox) return;
    const item = state.driveItems.find((entry) => entry.id === checkbox.dataset.driveSelect);
    if (!item) return;
    if (checkbox.checked && state.selected.size >= MAX_DIRECT_SELECTION && !state.selected.has(item.id)) {
      checkbox.checked = false;
      setFeedback(`Selecione no máximo ${MAX_DIRECT_SELECTION} itens por publicação.`, 'info');
    } else if (checkbox.checked && !isImportableDriveItem(item)) {
      checkbox.checked = false;
      setFeedback('Este arquivo não pode ser importado pela conta conectada ao Drive.');
    } else if (checkbox.checked) state.selected.set(item.id, item);
    else state.selected.delete(item.id);
    updateSelectionUi();
  });

  refs.driveList.addEventListener('click', (event) => {
    if (event.target.closest('[data-drive-retry]')) {
      setFeedback('');
      loadDrive();
      refs.driveList.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest('[data-drive-clear-search]')) {
      clearDriveSearch();
      return;
    }
    const folderButton = event.target.closest('[data-drive-folder]');
    if (!folderButton) return;
    const folder = state.driveItems.find((item) => item.id === folderButton.dataset.driveFolder);
    if (!folder) return;
    state.currentFolderId = folder.id;
    state.currentFolderName = folder.name;
    state.breadcrumbs.push({ id: folder.id, name: folder.name });
    window.clearTimeout(searchTimer);
    setFeedback('');
    refs.search.value = '';
    refs.searchClear.hidden = true;
    state.nextPageToken = '';
    renderBreadcrumb();
    loadDrive();
    refs.driveList.focus({ preventScroll: true });
  });

  refs.categoryList.addEventListener('click', (event) => {
    if (event.target.closest('[data-categories-retry]')) {
      setFeedback('');
      loadCategories().then((loaded) => {
        if (loaded !== false) renderPublications();
      }).catch(() => {});
      refs.categoryList.focus({ preventScroll: true });
      return;
    }
    const editButton = event.target.closest('[data-category-edit]');
    if (editButton) {
      editCategory(editButton.dataset.categoryEdit);
      return;
    }
    const deleteButton = event.target.closest('[data-category-delete]');
    if (deleteButton) deleteCategory(deleteButton.dataset.categoryDelete, deleteButton);
  });

  refs.publishedList.addEventListener('click', (event) => {
    if (event.target.closest('[data-publications-retry]')) {
      setFeedback('');
      loadPublications().catch(() => {});
      refs.publishedList.focus({ preventScroll: true });
      return;
    }
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
      if (publish && !publicationHasPublicAction(publication)) {
        openPublicationEditor(id);
        setDrawerFeedback('Antes de tornar este item visível, ative uma permissão compatível com o formato.');
        return;
      }
      updatePublication(
        id,
        { status: publish ? 'published' : 'draft', published: publish },
        statusButton,
        publish ? 'Item visível no site.' : 'Item ocultado do site.'
      ).catch(() => {});
      return;
    }
    const deleteButton = event.target.closest('[data-publication-delete]');
    if (deleteButton) deletePublication(deleteButton.dataset.publicationDelete, deleteButton);
  });

  refs.publishedList.addEventListener('click', (event) => {
    if (event.target.closest('[data-published-clear-filters]')) clearPublicationFilters();
  });

  refs.editDrawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-download-edit-close]')) closePublicationEditor();
  });
  document.addEventListener('keydown', (event) => {
    if (refs.editDrawer.getAttribute('aria-hidden') !== 'false') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePublicationEditor();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(refs.editDrawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      refs.editDrawer.querySelector('.prod-drawer-panel')?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.querySelectorAll('[data-admin-tab="downloads"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.initialized) refreshAll();
    });
  });

  renderBreadcrumb();
  if (!panel.hidden) refreshAll();
})();
