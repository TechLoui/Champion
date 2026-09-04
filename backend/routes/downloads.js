'use strict';

const express = require('express');
const { getDb } = require('../lib/firebase');
const googleDrive = require('../lib/google-drive');
const { asyncRoute, HttpError } = require('../lib/http-error');
const { rememberDownloadData } = require('../lib/download-cache');
const { normalizeSearch } = require('./admin-downloads');

const router = express.Router();

function dbRequired() {
  const db = getDb();
  if (!db) throw new HttpError(503, 'Catalogo de downloads temporariamente indisponivel.', 'FIRESTORE_NOT_CONFIGURED');
  return db;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validDocumentId(value) {
  return /^[A-Za-z0-9_-]{1,200}$/.test(String(value || ''));
}

async function publicCategories(db) {
  return rememberDownloadData('categories', async () => {
    const snapshot = await db.collection('downloadCategories').get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((category) => category.active !== false)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
        || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
      .map((category) => ({
        id: category.id,
        name: category.name || 'Categoria',
        slug: category.slug || category.id,
        description: category.description || '',
        color: category.color || null,
        order: Number(category.order) || 0
      }));
  });
}

function itemCategories(categoryIds, byId) {
  return (categoryIds || []).map((id) => byId.get(id)).filter(Boolean).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color
  }));
}

function publicItem(id, data, categoriesById) {
  const categoryIds = (Array.isArray(data.categoryIds) ? data.categoryIds : [])
    .filter((categoryId) => categoriesById.has(categoryId));
  const deliveredMime = data.deliveryMimeType || data.exportMimeType || data.mimeType || 'application/octet-stream';
  const canPreview = data.allowView !== false && googleDrive.isPreviewable(deliveredMime);
  const canDownload = data.allowDownload !== false;
  return {
    id,
    name: data.name || data.driveName || 'Sem nome',
    description: data.description || '',
    mimeType: data.mimeType || 'application/octet-stream',
    deliveryMimeType: deliveredMime,
    extension: data.extension || null,
    size: data.size !== null && data.size !== undefined && data.size !== '' && Number.isFinite(Number(data.size))
      ? Number(data.size)
      : null,
    categoryIds,
    categories: itemCategories(categoryIds, categoriesById),
    relativePath: data.relativePath || '',
    sourceRootName: data.sourceRootName || '',
    updatedAt: data.updatedAt || data.syncedAt || data.driveModifiedAt || null,
    driveModifiedAt: data.driveModifiedAt || null,
    canPreview,
    canDownload,
    viewUrl: canPreview ? `/api/downloads/${encodeURIComponent(id)}/view` : null,
    downloadUrl: canDownload ? `/api/downloads/${encodeURIComponent(id)}/download` : null
  };
}

function parsePage(query) {
  if (query.pageToken) {
    if (String(query.pageToken).length > 256) {
      throw new HttpError(422, 'Token de paginacao invalido.', 'INVALID_PAGE_TOKEN');
    }
    try {
      const decoded = Buffer.from(String(query.pageToken), 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (Number.isInteger(parsed.page) && parsed.page >= 1 && parsed.page <= 100000) return parsed.page;
    } catch (err) {
      throw new HttpError(422, 'Token de paginacao invalido.', 'INVALID_PAGE_TOKEN');
    }
    throw new HttpError(422, 'Token de paginacao invalido.', 'INVALID_PAGE_TOKEN');
  }
  const page = Number(query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) {
    throw new HttpError(422, 'Pagina invalida.', 'INVALID_PAGE');
  }
  return page;
}

function makePageToken(page) {
  return Buffer.from(JSON.stringify({ page }), 'utf8').toString('base64url');
}

async function loadPublished(db) {
  const limit = Math.trunc(Math.min(Math.max(Number(process.env.PUBLIC_DOWNLOADS_SCAN_LIMIT) || 5000, 100), 20000));
  return rememberDownloadData('published', async () => {
    const snapshot = await db.collection('downloads').where('status', '==', 'published').limit(limit + 1).get();
    if (snapshot.size > limit) {
      throw new HttpError(503, 'Catalogo muito grande para a busca atual. Refine os filtros.', 'DOWNLOAD_CATALOG_LIMIT');
    }
    return snapshot.docs;
  });
}

router.get('/categories', asyncRoute(async (_req, res) => {
  const categories = await publicCategories(dbRequired());
  res.json({ categories, items: categories, total: categories.length });
}));

router.get('/', asyncRoute(async (req, res) => {
  const db = dbRequired();
  const [documents, categories] = await Promise.all([loadPublished(db), publicCategories(db)]);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryQuery = text(req.query.category, 200);
  let categoryId = categoryQuery;
  if (categoryQuery && !categoriesById.has(categoryQuery)) {
    categoryId = categories.find((category) => category.slug === categoryQuery)?.id || '__not_found__';
  }

  const query = normalizeSearch(req.query.q);
  let items = documents
    .map((doc) => publicItem(doc.id, doc.data(), categoriesById))
    .filter((item) => item.canPreview || item.canDownload);
  if (categoryQuery) items = items.filter((item) => item.categoryIds.includes(categoryId));
  if (query) {
    items = items.filter((item) => normalizeSearch([
      item.name,
      item.description,
      item.relativePath,
      item.sourceRootName,
      ...item.categories.map((category) => category.name)
    ].join(' '), 8000).includes(query));
  }

  const sort = text(req.query.sort || 'name', 30).toLowerCase();
  if (sort === 'recent') {
    items.sort((a, b) => String(b.driveModifiedAt || b.updatedAt || '').localeCompare(String(a.driveModifiedAt || a.updatedAt || '')));
  } else {
    items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR', { numeric: true }));
  }

  const page = parsePage(req.query);
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : 24;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paginated = start >= total ? [] : items.slice(start, start + limit);
  const nextPageToken = start + limit < total ? makePageToken(page + 1) : null;

  res.json({
    items: paginated,
    downloads: paginated,
    categories,
    total,
    page,
    limit,
    totalPages,
    nextPageToken,
    hasMore: Boolean(nextPageToken)
  });
}));

async function findPublished(req) {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(404, 'Download nao encontrado.', 'DOWNLOAD_NOT_FOUND');
  const db = dbRequired();
  const snapshot = await db.collection('downloads').doc(id).get();
  if (!snapshot.exists || snapshot.data()?.status !== 'published') {
    throw new HttpError(404, 'Download nao encontrado.', 'DOWNLOAD_NOT_FOUND');
  }
  return { id, data: snapshot.data(), db };
}

router.get('/:id', asyncRoute(async (req, res) => {
  const found = await findPublished(req);
  const categories = await publicCategories(found.db);
  const byId = new Map(categories.map((category) => [category.id, category]));
  res.json({ item: publicItem(found.id, found.data, byId) });
}));

function safeRange(req) {
  const range = text(req.get('range'), 100);
  if (!range) return null;
  if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    throw new HttpError(416, 'Intervalo de bytes invalido.', 'INVALID_RANGE');
  }
  const explicit = range.match(/^bytes=(\d+)-(\d+)$/);
  if (explicit && Number(explicit[1]) > Number(explicit[2])) {
    throw new HttpError(416, 'Intervalo de bytes invalido.', 'INVALID_RANGE');
  }
  return range;
}

function filenameWithExtension(name, extension) {
  let result = text(name, 240)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '-') || 'download';
  if (extension && !result.toLowerCase().endsWith(`.${String(extension).toLowerCase()}`)) {
    result += `.${extension}`;
  }
  return result;
}

function dispositionHeader(disposition, filename) {
  const ascii = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180) || 'download';
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function sendContent(req, res, next, mode) {
  try {
    const found = await findPublished(req);
    if (mode === 'view' && found.data.allowView === false) {
      throw new HttpError(403, 'Visualizacao nao liberada para este arquivo.', 'PREVIEW_DISABLED');
    }
    if (mode === 'download' && found.data.allowDownload === false) {
      throw new HttpError(403, 'Download nao liberado para este arquivo.', 'DOWNLOAD_DISABLED');
    }

    const range = safeRange(req);
    const content = await googleDrive.openFileStream(found.data.driveFileId, {
      mode,
      format: req.query.format,
      range
    });
    const disposition = mode === 'view' ? 'inline' : 'attachment';
    const filename = filenameWithExtension(found.data.name || content.driveFile.name, content.extension);

    res.status(content.status || 200);
    res.set({
      'Content-Type': content.mimeType,
      'Content-Disposition': dispositionHeader(disposition, filename),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, no-store, max-age=0',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    if (content.size) res.set('Content-Length', String(content.size));
    if (content.contentRange) res.set('Content-Range', content.contentRange);
    if (content.acceptRanges) res.set('Accept-Ranges', content.acceptRanges);
    else if (!found.data.exportMimeType) res.set('Accept-Ranges', 'bytes');
    if (content.etag) res.set('ETag', content.etag);

    content.stream.once('error', (err) => {
      console.error('[downloads] stream do Drive falhou:', err?.message || err);
      if (!res.headersSent) return next(new HttpError(502, 'Falha ao transmitir o arquivo.', 'DOWNLOAD_STREAM_FAILED'));
      return res.destroy();
    });
    req.once('aborted', () => content.stream.destroy());
    content.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

router.get('/:id/view', (req, res, next) => sendContent(req, res, next, 'view'));
router.get('/:id/download', (req, res, next) => sendContent(req, res, next, 'download'));
router.get('/:id/content', (req, res, next) => {
  const mode = String(req.query.disposition || req.query.mode || '').toLowerCase() === 'inline'
    ? 'view'
    : 'download';
  return sendContent(req, res, next, mode);
});

module.exports = router;
