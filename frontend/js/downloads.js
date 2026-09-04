(function () {
  'use strict';

  var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var DEFAULT_API_ROOT = isLocalHost
    ? 'http://localhost:3000/api'
    : 'https://champion-production-cab6.up.railway.app/api';
  var configuredRoot = window.CHAMPION_DOWNLOADS_API_ROOT || window.CHAMPION_API_ROOT || DEFAULT_API_ROOT;
  var API_ROOT;

  try {
    API_ROOT = new URL(String(configuredRoot).replace(/\/$/, ''), window.location.href).href.replace(/\/$/, '');
  } catch (_error) {
    API_ROOT = DEFAULT_API_ROOT;
  }

  var API_ORIGIN = new URL(API_ROOT).origin;
  var PAGE_SIZE = 48;
  var state = {
    query: '',
    category: '',
    page: 1,
    total: 0,
    totalPages: 1,
    items: [],
    categories: [],
    requestId: 0,
    controller: null
  };

  var elements = {
    form: document.getElementById('downloadsSearchForm'),
    search: document.getElementById('downloadsSearch'),
    searchClear: document.getElementById('downloadsSearchClear'),
    categories: document.getElementById('downloadsCategories'),
    summary: document.getElementById('downloadsSummary'),
    reset: document.getElementById('downloadsReset'),
    grid: document.getElementById('downloadsGrid'),
    empty: document.getElementById('downloadsEmpty'),
    emptyReset: document.getElementById('downloadsEmptyReset'),
    error: document.getElementById('downloadsError'),
    errorMessage: document.getElementById('downloadsErrorMessage'),
    retry: document.getElementById('downloadsRetry'),
    heroCount: document.getElementById('downloadsHeroCount'),
    pagination: document.getElementById('downloadsPagination'),
    previous: document.getElementById('downloadsPrevious'),
    next: document.getElementById('downloadsNext'),
    pageLabel: document.getElementById('downloadsPageLabel'),
    preview: document.getElementById('downloadsPreview'),
    previewTitle: document.getElementById('downloadsPreviewTitle'),
    previewFrame: document.getElementById('downloadsPreviewFrame'),
    previewLoading: document.getElementById('downloadsPreviewLoading'),
    previewClose: document.getElementById('downloadsPreviewClose'),
    previewNewTab: document.getElementById('downloadsPreviewNewTab'),
    previewDownload: document.getElementById('downloadsPreviewDownload')
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function apiUrl(path) {
    return API_ROOT + path;
  }

  function safeAssetUrl(candidate, fallbackPath) {
    var fallback = apiUrl(fallbackPath);
    try {
      var resolved = new URL(candidate || fallback, API_ROOT + '/');
      return resolved.origin === API_ORIGIN ? resolved.href : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function requestJson(path, options) {
    return fetch(apiUrl(path), Object.assign({
      headers: { Accept: 'application/json' }
    }, options || {})).then(async function (response) {
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        var error = new Error(payload.error || payload.message || 'O servidor não conseguiu atender à solicitação.');
        error.status = response.status;
        throw error;
      }
      return payload;
    });
  }

  function normalizePage(value) {
    var page = Number(value);
    return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  }

  function normalizeCategory(category) {
    if (typeof category === 'string') {
      return { id: category, slug: category, name: category };
    }
    category = category || {};
    var id = String(category.id || category.slug || category.name || '').trim();
    return {
      id: id,
      slug: String(category.slug || id),
      name: String(category.name || category.label || id),
      count: Number(category.count || 0)
    };
  }

  function normalizeCategories(categories) {
    var seen = {};
    return (Array.isArray(categories) ? categories : [])
      .map(normalizeCategory)
      .filter(function (category) {
        var key = category.id || category.slug;
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function itemCategories(item) {
    if (Array.isArray(item.categories)) return item.categories.map(normalizeCategory).filter(function (category) { return category.name; });
    if (Array.isArray(item.categoryNames)) return item.categoryNames.map(normalizeCategory);
    return [];
  }

  function fileExtension(item) {
    var explicit = String(item.extension || '').replace(/^\./, '').trim();
    if (explicit) return explicit.slice(0, 6).toUpperCase();
    var match = String(item.name || '').match(/\.([a-zA-Z0-9]{1,8})$/);
    if (match) return match[1].slice(0, 6).toUpperCase();
    var mime = String(item.mimeType || '');
    if (mime === 'application/pdf') return 'PDF';
    if (mime.indexOf('google-apps') !== -1) return 'DOC';
    return 'ARQ';
  }

  function fileKind(item) {
    var mime = String(item.mimeType || '').toLowerCase();
    var extension = fileExtension(item).toLowerCase();
    if (mime.indexOf('pdf') !== -1 || extension === 'pdf') return 'pdf';
    if (mime.indexOf('image/') === 0) return 'image';
    if (mime.indexOf('video/') === 0) return 'video';
    if (mime.indexOf('audio/') === 0) return 'audio';
    if (mime.indexOf('spreadsheet') !== -1 || /^(xls|xlsx|csv|ods)$/.test(extension)) return 'sheet';
    if (mime.indexOf('zip') !== -1 || /^(zip|rar|7z|gz)$/.test(extension)) return 'archive';
    return 'document';
  }

  function fileIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';
  }

  function formatBytes(value) {
    var bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    var number = bytes / Math.pow(1024, unit);
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: unit ? 1 : 0 }).format(number) + ' ' + units[unit];
  }

  function formatDate(value) {
    if (!value) return '';
    var date;
    if (value && typeof value.toDate === 'function') date = value.toDate();
    else if (value && typeof value === 'object' && Number.isFinite(Number(value.seconds))) date = new Date(Number(value.seconds) * 1000);
    else date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
  }

  function typeLabel(item) {
    var labels = { pdf: 'PDF', image: 'Imagem', video: 'Vídeo', audio: 'Áudio', sheet: 'Planilha', archive: 'Arquivo compactado', document: 'Documento' };
    return labels[fileKind(item)] || 'Arquivo';
  }

  function renderSkeletons() {
    elements.grid.innerHTML = Array.from({ length: 6 }, function () {
      return '<div class="download-card-skeleton" aria-hidden="true"></div>';
    }).join('');
    elements.grid.setAttribute('aria-busy', 'true');
  }

  function renderCategories() {
    var focused = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('#downloadsCategories [data-category]')
      : null;
    var focusedValue = focused ? focused.getAttribute('data-category') : null;
    var previousScroll = elements.categories.scrollLeft;
    var allButton = '<button type="button" class="' + (state.category ? '' : 'is-active') + '" data-category="" aria-pressed="' + (!state.category) + '">Todos</button>';
    var buttons = state.categories.map(function (category) {
      var value = category.id || category.slug;
      var active = state.category === value || state.category === category.slug;
      var count = category.count > 0 ? ' <span>(' + category.count + ')</span>' : '';
      return '<button type="button" class="' + (active ? 'is-active' : '') + '" data-category="' + escapeHtml(value) + '" aria-pressed="' + active + '">' + escapeHtml(category.name) + count + '</button>';
    }).join('');
    elements.categories.innerHTML = allButton + buttons;
    elements.categories.scrollLeft = previousScroll;
    if (focusedValue !== null) {
      var replacement = Array.from(elements.categories.querySelectorAll('[data-category]')).find(function (button) {
        return button.getAttribute('data-category') === focusedValue;
      });
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }

  function metadataHtml(item) {
    var size = formatBytes(item.size);
    var date = formatDate(item.updatedAt || item.driveModifiedAt);
    var bits = [
      '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h5"/></svg>' + escapeHtml(typeLabel(item)) + '</span>'
    ];
    if (size) bits.push('<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>' + escapeHtml(size) + '</span>');
    if (date) bits.push('<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>' + escapeHtml(date) + '</span>');
    return bits.join('');
  }

  function renderCard(item) {
    var id = String(item.id || '');
    var itemName = String(item.name || 'Material Champion');
    var encodedId = encodeURIComponent(id);
    var viewUrl = safeAssetUrl(item.viewUrl, '/downloads/' + encodedId + '/view');
    var canDownload = item.canDownload !== false && item.downloadUrl !== null;
    var downloadUrl = canDownload
      ? safeAssetUrl(item.downloadUrl, '/downloads/' + encodedId + '/download')
      : '';
    var categories = itemCategories(item).slice(0, 3);
    var categoryHtml = categories.length ? '<div class="download-card-tags">' + categories.map(function (category) {
      return '<span class="download-card-tag">' + escapeHtml(category.name) + '</span>';
    }).join('') + '</div>' : '';
    var description = String(item.description || '').trim();
    var relativePath = String(item.relativePath || '').trim();
    var preview = item.canPreview === true && item.viewUrl !== null;
    var previewButton = preview
      ? '<button type="button" class="download-view" data-preview-id="' + escapeHtml(id) + '" aria-haspopup="dialog" aria-label="Visualizar ' + escapeHtml(itemName) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>Visualizar</button>'
      : '';
    var downloadButton = canDownload
      ? '<a class="download-get" href="' + escapeHtml(downloadUrl) + '" aria-label="Baixar ' + escapeHtml(itemName) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar</a>'
      : '';
    var singleAction = Number(preview) + Number(canDownload) === 1;
    var classes = singleAction ? ' is-single' : '';

    return '<article class="download-card" data-download-id="' + escapeHtml(id) + '">' +
      '<div class="download-card-top">' +
        '<span class="download-file-icon is-' + fileKind(item) + '" data-extension="' + escapeHtml(fileExtension(item)) + '">' + fileIcon() + '</span>' +
        '<div class="download-card-title-wrap"><h3>' + escapeHtml(itemName) + '</h3>' +
          (relativePath ? '<span class="download-card-path" title="' + escapeHtml(relativePath) + '">' + escapeHtml(relativePath) + '</span>' : '') +
        '</div>' +
      '</div>' +
      (description ? '<p class="download-card-description">' + escapeHtml(description) + '</p>' : '<p class="download-card-description">Material oficial Champion disponível para consulta.</p>') +
      categoryHtml +
      '<div class="download-card-meta">' + metadataHtml(item) + '</div>' +
      '<div class="download-card-actions' + classes + '">' + previewButton +
        downloadButton +
      '</div>' +
      '<span hidden data-view-url="' + escapeHtml(viewUrl) + '" data-download-url="' + escapeHtml(downloadUrl) + '"></span>' +
    '</article>';
  }

  function renderResults() {
    elements.grid.setAttribute('aria-busy', 'false');
    elements.pagination.removeAttribute('aria-busy');
    elements.grid.innerHTML = state.items.map(renderCard).join('');
    elements.empty.hidden = state.items.length !== 0;
    elements.error.hidden = true;

    var totalLabel = state.total === 1 ? '1 material encontrado' : state.total + ' materiais encontrados';
    elements.summary.innerHTML = '<strong>' + escapeHtml(totalLabel) + '</strong>' + (state.query ? ' para “' + escapeHtml(state.query) + '”' : '');
    elements.heroCount.textContent = new Intl.NumberFormat('pt-BR').format(state.total);
    elements.reset.hidden = !state.query && !state.category;
    elements.searchClear.hidden = !state.query && !elements.search.value;

    elements.pagination.hidden = state.totalPages <= 1;
    elements.pagination.style.display = state.totalPages > 1 ? 'flex' : '';
    elements.previous.disabled = state.page <= 1;
    elements.next.disabled = state.page >= state.totalPages;
    elements.pageLabel.textContent = 'Página ' + state.page + ' de ' + state.totalPages;
  }

  function renderError(error) {
    elements.grid.setAttribute('aria-busy', 'false');
    elements.pagination.removeAttribute('aria-busy');
    elements.grid.innerHTML = '';
    elements.empty.hidden = true;
    elements.error.hidden = false;
    elements.pagination.hidden = true;
    elements.summary.textContent = 'Materiais temporariamente indisponíveis';
    elements.errorMessage.textContent = error && error.message ? error.message : 'Tente novamente em instantes.';
    elements.heroCount.textContent = '—';
  }

  function syncUrl() {
    var params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.category) params.set('categoria', state.category);
    if (state.page > 1) params.set('pagina', String(state.page));
    var query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  }

  async function loadCategories() {
    try {
      var payload = await requestJson('/downloads/categories');
      var categories = normalizeCategories(payload.categories || payload.items || payload);
      if (categories.length) {
        state.categories = categories;
        renderCategories();
      }
    } catch (error) {
      console.warn('[downloads] Categorias indisponíveis:', error.message);
    }
  }

  async function loadItems(options) {
    options = options || {};
    if (!options.keepPage) state.page = 1;
    var requestId = ++state.requestId;
    if (state.controller) state.controller.abort();
    state.controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    renderSkeletons();
    elements.empty.hidden = true;
    elements.error.hidden = true;
    if (options.paginationFocus) elements.pagination.setAttribute('aria-busy', 'true');
    else elements.pagination.hidden = true;
    elements.summary.textContent = 'Carregando materiais…';
    syncUrl();

    var params = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE) });
    if (state.query) params.set('q', state.query);
    if (state.category) params.set('category', state.category);

    try {
      var payload = await requestJson('/downloads?' + params.toString(), state.controller ? { signal: state.controller.signal } : {});
      if (requestId !== state.requestId) return;
      state.items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.downloads) ? payload.downloads : []);
      state.total = Number(payload.total);
      if (!Number.isFinite(state.total)) state.total = state.items.length;
      var reportedPages = Number(payload.totalPages);
      state.totalPages = Number.isFinite(reportedPages) && reportedPages >= 1
        ? Math.floor(reportedPages)
        : Math.max(1, Math.ceil(state.total / PAGE_SIZE) || 1);
      var returnedPage = normalizePage(payload.page || state.page);
      if (state.total > 0 && returnedPage > state.totalPages) {
        state.page = state.totalPages;
        return loadItems({ keepPage: true, paginationFocus: options.paginationFocus });
      }
      state.page = Math.min(returnedPage, state.totalPages);
      syncUrl();
      var categories = normalizeCategories(payload.categories);
      if (categories.length) {
        state.categories = categories;
        renderCategories();
      }
      renderResults();
      if (options.paginationFocus) {
        var focusTarget = options.paginationFocus === 'previous' ? elements.previous : elements.next;
        if (!focusTarget.disabled && !elements.pagination.hidden) focusTarget.focus({ preventScroll: true });
        else {
          elements.summary.setAttribute('tabindex', '-1');
          elements.summary.focus({ preventScroll: true });
        }
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (requestId !== state.requestId) return;
      renderError(error);
    }
  }

  function resetFilters() {
    state.query = '';
    state.category = '';
    state.page = 1;
    elements.search.value = '';
    renderCategories();
    loadItems({ keepPage: true });
  }

  function openPreview(item) {
    if (!item || !elements.preview) return;
    var id = encodeURIComponent(String(item.id || ''));
    var viewUrl = safeAssetUrl(item.viewUrl, '/downloads/' + id + '/view');
    var downloadUrl = safeAssetUrl(item.downloadUrl, '/downloads/' + id + '/download');
    elements.previewTitle.textContent = item.name || 'Material Champion';
    elements.previewLoading.classList.remove('is-hidden');
    elements.previewFrame.src = viewUrl;
    elements.previewNewTab.href = viewUrl;
    elements.previewDownload.hidden = item.canDownload === false || item.downloadUrl === null;
    elements.previewDownload.href = elements.previewDownload.hidden ? '#' : downloadUrl;
    if (typeof elements.preview.showModal === 'function') elements.preview.showModal();
    else elements.preview.setAttribute('open', '');
  }

  function closePreview() {
    if (!elements.preview) return;
    if (typeof elements.preview.close === 'function' && elements.preview.open) elements.preview.close();
    else elements.preview.removeAttribute('open');
    elements.previewFrame.src = 'about:blank';
    elements.previewLoading.classList.remove('is-hidden');
  }

  var searchTimer;
  elements.form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    state.query = elements.search.value.trim();
    loadItems();
  });

  elements.search.addEventListener('input', function () {
    elements.searchClear.hidden = !elements.search.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.query = elements.search.value.trim();
      loadItems();
    }, 420);
  });

  elements.searchClear.addEventListener('click', function () {
    window.clearTimeout(searchTimer);
    elements.search.value = '';
    state.query = '';
    elements.searchClear.hidden = true;
    elements.search.focus();
    loadItems();
  });

  elements.categories.addEventListener('click', function (event) {
    var button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.getAttribute('data-category') || '';
    renderCategories();
    loadItems();
  });

  elements.grid.addEventListener('click', function (event) {
    var previewButton = event.target.closest('[data-preview-id]');
    if (!previewButton) return;
    var id = previewButton.getAttribute('data-preview-id');
    openPreview(state.items.find(function (item) { return String(item.id) === id; }));
  });

  elements.reset.addEventListener('click', resetFilters);
  elements.emptyReset.addEventListener('click', resetFilters);
  elements.retry.addEventListener('click', function () { loadItems({ keepPage: true }); });
  elements.previous.addEventListener('click', function () {
    if (state.page <= 1) return;
    state.page -= 1;
    loadItems({ keepPage: true, paginationFocus: 'previous' }).then(function () {
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      elements.summary.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
  });
  elements.next.addEventListener('click', function () {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    loadItems({ keepPage: true, paginationFocus: 'next' }).then(function () {
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      elements.summary.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
  });

  elements.previewClose.addEventListener('click', closePreview);
  elements.previewFrame.addEventListener('load', function () { elements.previewLoading.classList.add('is-hidden'); });
  elements.preview.addEventListener('click', function (event) {
    var rect = elements.preview.getBoundingClientRect();
    var outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) closePreview();
  });
  elements.preview.addEventListener('cancel', function (event) { event.preventDefault(); closePreview(); });

  var initialParams = new URLSearchParams(window.location.search);
  state.query = (initialParams.get('q') || '').trim();
  state.category = (initialParams.get('categoria') || initialParams.get('category') || '').trim();
  state.page = normalizePage(initialParams.get('pagina') || initialParams.get('page'));
  elements.search.value = state.query;
  elements.searchClear.hidden = !state.query;
  renderCategories();
  loadCategories();
  loadItems({ keepPage: true });
})();
