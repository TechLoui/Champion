'use strict';

const express = require('express');
const { getAdmin, getDb } = require('../lib/firebase');
const googleDrive = require('../lib/google-drive');
const { asyncRoute, HttpError } = require('../lib/http-error');
const { invalidateDownloadCache } = require('../lib/download-cache');

const downloadsRouter = express.Router();
const categoriesRouter = express.Router();

function dbRequired() {
  const db = getDb();
  if (!db) throw new HttpError(503, 'Firestore nao esta configurado.', 'FIRESTORE_NOT_CONFIGURED');
  return db;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeSearch(value, max = 300) {
  return text(value, max)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeSearch(value).replace(/\s+/g, '-').slice(0, 80);
}

function validDocumentId(value) {
  return /^[A-Za-z0-9_-]{1,200}$/.test(String(value || ''));
}

function booleanValue(body, key, fallback) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, key)) return fallback;
  if (typeof body[key] !== 'boolean') {
    throw new HttpError(422, `${key} deve ser booleano.`, 'INVALID_BOOLEAN');
  }
  return body[key];
}

function categoryInput(body) {
  const provided = Object.prototype.hasOwnProperty.call(body || {}, 'categoryIds')
    || Object.prototype.hasOwnProperty.call(body || {}, 'categoryId');
  const raw = Array.isArray(body?.categoryIds)
    ? body.categoryIds
    : (body?.categoryId ? [body.categoryId] : []);
  const ids = [...new Set(raw.map((id) => text(id, 200)).filter(Boolean))];
  if (ids.length > 20 || ids.some((id) => !validDocumentId(id))) {
    throw new HttpError(422, 'Lista de categorias invalida.', 'INVALID_CATEGORY_IDS');
  }
  return { provided, ids };
}

async function allCategories(db) {
  const snapshot = await db.collection('downloadCategories').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
      || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

async function validateCategories(db, ids) {
  if (!ids.length) return [];
  const refs = ids.map((id) => db.collection('downloadCategories').doc(id));
  const snapshots = await db.getAll(...refs);
  const invalid = snapshots.filter((doc) => !doc.exists || doc.data()?.active === false).map((doc) => doc.id);
  if (invalid.length) {
    throw new HttpError(422, 'Uma ou mais categorias nao existem ou estao inativas.', 'INVALID_CATEGORY_IDS', { ids: invalid });
  }
  return snapshots.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getMany(db, refs, chunkSize = 250) {
  const result = [];
  for (let index = 0; index < refs.length; index += chunkSize) {
    result.push(...await db.getAll(...refs.slice(index, index + chunkSize)));
  }
  return result;
}

async function commitOperations(db, operations, chunkSize = 400) {
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + chunkSize)) {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else if (operation.type === 'update') batch.update(operation.ref, operation.data);
      else if (operation.options) batch.set(operation.ref, operation.data, operation.options);
      else batch.set(operation.ref, operation.data);
    }
    await batch.commit();
  }
}

function requestedStatus(body, fallback = 'published') {
  if (Object.prototype.hasOwnProperty.call(body || {}, 'published')) {
    return booleanValue(body, 'published') ? 'published' : 'draft';
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'active')) {
    return booleanValue(body, 'active') ? 'published' : 'draft';
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'status')) {
    const status = text(body.status, 20).toLowerCase();
    if (!['published', 'draft'].includes(status)) {
      throw new HttpError(422, 'Status deve ser published ou draft.', 'INVALID_DOWNLOAD_STATUS');
    }
    return status;
  }
  return fallback;
}

function effectiveMime(data) {
  return data.deliveryMimeType || data.exportMimeType || data.mimeType || 'application/octet-stream';
}

function hasPublicAction(data) {
  return data.allowDownload !== false
    || (data.allowView !== false && googleDrive.isPreviewable(effectiveMime(data)));
}

/* Reimportar uma pasta serve principalmente para descobrir arquivos novos.
 * Por seguranca, isso nao deve reverter ajustes feitos individualmente depois
 * (rascunho, categorias ou permissao somente de visualizacao). A sobrescrita
 * de existentes precisa ser uma escolha explicita do cliente da API. */
function publicationSettings(previous, options) {
  const preserveExisting = Boolean(previous) && options.applyToExisting !== true;
  const previousCategoryIds = Array.isArray(previous?.categoryIds) ? previous.categoryIds : [];
  return {
    categoryIds: preserveExisting || !options.categoriesProvided
      ? previousCategoryIds
      : options.categoryIds,
    status: preserveExisting
      ? (previous.status === 'published' ? 'published' : 'draft')
      : options.status,
    allowView: preserveExisting
      ? previous.allowView !== false
      : (options.allowView ?? (previous?.allowView !== false)),
    allowDownload: preserveExisting
      ? previous.allowDownload !== false
      : (options.allowDownload ?? (previous?.allowDownload !== false))
  };
}

function categorySummary(ids, byId) {
  return (ids || []).map((id) => byId.get(id)).filter(Boolean).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    color: category.color || null
  }));
}

function serializeDownload(id, data, categoriesById) {
  const categoryIds = Array.isArray(data.categoryIds) ? data.categoryIds : [];
  const canPreview = data.allowView !== false && googleDrive.isPreviewable(effectiveMime(data));
  return {
    id,
    name: data.name || data.driveName || 'Sem nome',
    driveName: data.driveName || null,
    description: data.description || '',
    mimeType: data.mimeType || 'application/octet-stream',
    deliveryMimeType: effectiveMime(data),
    extension: data.extension || null,
    size: data.size !== null && data.size !== undefined && data.size !== '' && Number.isFinite(Number(data.size))
      ? Number(data.size)
      : null,
    categoryIds,
    categories: categorySummary(categoryIds, categoriesById),
    status: data.status || 'draft',
    published: data.status === 'published',
    allowView: data.allowView !== false,
    allowDownload: data.allowDownload !== false,
    canPreview,
    relativePath: data.relativePath || '',
    sourceRootName: data.sourceRootName || '',
    sourceRootDriveId: data.sourceRootDriveId || null,
    driveFileId: data.driveFileId || null,
    driveModifiedAt: data.driveModifiedAt || null,
    syncedAt: data.syncedAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    publishedAt: data.publishedAt || null,
    viewUrl: canPreview ? `/api/downloads/${encodeURIComponent(id)}/view` : null,
    downloadUrl: data.allowDownload === false ? null : `/api/downloads/${encodeURIComponent(id)}/download`
  };
}

function selectionIds(body) {
  const candidates = [];
  if (Array.isArray(body?.driveItemIds)) candidates.push(...body.driveItemIds);
  if (Array.isArray(body?.driveIds)) candidates.push(...body.driveIds);
  if (body?.driveId) candidates.push(body.driveId);
  if (Array.isArray(body?.driveItems)) {
    candidates.push(...body.driveItems.map((item) => item?.id));
  }
  return [...new Set(candidates.map(googleDrive.extractDriveId).filter(Boolean))];
}

downloadsRouter.get('/', asyncRoute(async (req, res) => {
  const db = dbRequired();
  const [snapshot, categories] = await Promise.all([
    db.collection('downloads').limit(5000).get(),
    allCategories(db)
  ]);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const query = normalizeSearch(req.query.q);
  const status = text(req.query.status || 'all', 20).toLowerCase();
  if (!['all', 'published', 'draft'].includes(status)) {
    throw new HttpError(422, 'Filtro de status invalido.', 'INVALID_DOWNLOAD_STATUS');
  }
  const category = text(req.query.category, 200);
  let items = snapshot.docs.map((doc) => serializeDownload(doc.id, doc.data(), byId));
  if (['published', 'draft'].includes(status)) items = items.filter((item) => item.status === status);
  if (category) items = items.filter((item) => item.categoryIds.includes(category));
  if (query) {
    items = items.filter((item) => normalizeSearch([
      item.name, item.description, item.relativePath, item.sourceRootName,
      ...item.categories.map((entry) => entry.name)
    ].join(' '), 8000).includes(query));
  }
  items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR', { numeric: true }));
  res.json({ items, downloads: items, total: items.length, categories });
}));

downloadsRouter.get('/:id', asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de download invalido.', 'INVALID_DOWNLOAD_ID');
  const db = dbRequired();
  const [snapshot, categories] = await Promise.all([
    db.collection('downloads').doc(id).get(),
    allCategories(db)
  ]);
  if (!snapshot.exists) throw new HttpError(404, 'Download nao encontrado.', 'DOWNLOAD_NOT_FOUND');
  res.json({
    item: serializeDownload(
      id,
      snapshot.data(),
      new Map(categories.map((category) => [category.id, category]))
    )
  });
}));

downloadsRouter.post('/', asyncRoute(async (req, res) => {
  const db = dbRequired();
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'recursive')) {
    booleanValue(req.body, 'recursive');
  }
  const applyToExisting = booleanValue(req.body, 'applyToExisting', false);
  const requested = requestedStatus(req.body || {}, 'published');
  const requestedAllowView = booleanValue(req.body, 'allowView', undefined);
  const requestedAllowDownload = booleanValue(req.body, 'allowDownload', undefined);
  const ids = selectionIds(req.body || {});
  const categoriesRequest = categoryInput(req.body || {});
  if (categoriesRequest.provided) await validateCategories(db, categoriesRequest.ids);

  const selection = await googleDrive.collectSelection(ids, {
    recursive: req.body?.recursive !== false
  });
  if (!selection.files.length) {
    throw new HttpError(422, 'A selecao nao contem arquivos que possam ser publicados.', 'NO_DOWNLOADABLE_FILES', {
      skipped: selection.skipped.slice(0, 50)
    });
  }

  const refs = selection.files.map(({ file }) => db.collection('downloads').doc(file.id));
  const existingSnapshots = await getMany(db, refs);
  const existingById = new Map(existingSnapshots.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data()]));
  const now = new Date().toISOString();
  const directSingleFile = selection.selected.length === 1
    && !selection.selected[0].isFolder
    && selection.files.length === 1;
  const customName = directSingleFile ? text(req.body?.name ?? req.body?.title, 240) : '';
  const customDescription = directSingleFile && Object.prototype.hasOwnProperty.call(req.body || {}, 'description')
    ? text(req.body.description, 3000)
    : null;

  let created = 0;
  let updated = 0;
  const saved = [];
  const operations = [];

  for (const entry of selection.files) {
    const file = entry.file;
    const previous = existingById.get(file.id) || null;
    const driveName = text(file.name, 240) || 'Sem nome';
    const exportFormat = googleDrive.defaultExport(file.mimeType);
    const extension = exportFormat?.extension || file.fileExtension
      || ((file.name || '').includes('.') ? (file.name || '').split('.').pop().toLowerCase().slice(0, 12) : null);
    const settings = publicationSettings(previous, {
      applyToExisting,
      categoriesProvided: categoriesRequest.provided,
      categoryIds: categoriesRequest.ids,
      status: requested,
      allowView: requestedAllowView,
      allowDownload: requestedAllowDownload
    });
    const categoryIds = settings.categoryIds;
    const nameCustomized = Boolean(customName) || Boolean(previous?.nameCustomized);
    const name = customName || (previous?.nameCustomized ? previous.name : null) || driveName;
    const description = customDescription !== null
      ? customDescription
      : (previous?.descriptionCustomized ? (previous.description || '') : text(file.description, 3000));
    const status = settings.status;
    const data = {
      driveFileId: file.id,
      driveName,
      name,
      nameCustomized,
      description,
      descriptionCustomized: customDescription !== null || Boolean(previous?.descriptionCustomized),
      mimeType: file.mimeType || 'application/octet-stream',
      deliveryMimeType: exportFormat?.mimeType || file.mimeType || 'application/octet-stream',
      exportMimeType: exportFormat?.mimeType || null,
      extension,
      size: file.size ? Number(file.size) : null,
      checksum: file.md5Checksum || null,
      categoryIds,
      status,
      allowView: settings.allowView,
      allowDownload: settings.allowDownload,
      relativePath: text(entry.relativePath, 1000),
      sourceRootDriveId: entry.sourceRootDriveId,
      sourceRootName: text(entry.sourceRootName, 240),
      driveCreatedAt: file.createdTime || null,
      driveModifiedAt: file.modifiedTime || null,
      syncedAt: now,
      updatedAt: now,
      updatedBy: req.adminUser,
      createdAt: previous?.createdAt || now,
      createdBy: previous?.createdBy || req.adminUser,
      publishedAt: status === 'published' ? (previous?.publishedAt || now) : null,
      publishedBy: status === 'published' ? (previous?.publishedBy || req.adminUser) : null
    };
    if (status === 'published' && !hasPublicAction(data)) {
      throw new HttpError(422, `O arquivo "${name}" ficaria publicado sem visualizacao nem download.`, 'DOWNLOAD_WITHOUT_ACTION');
    }
    if (previous) updated += 1;
    else created += 1;
    operations.push({
      type: 'set',
      ref: db.collection('downloads').doc(file.id),
      data,
      options: { merge: true }
    });
    saved.push({ id: file.id, data });
  }

  for (const source of selection.selected) {
    const sourceData = {
      driveId: source.id,
      name: text(source.name, 240) || 'Sem nome',
      mimeType: source.mimeType,
      type: source.isFolder ? 'folder' : 'file',
      recursive: source.isFolder ? req.body?.recursive !== false : false,
      ...(categoriesRequest.provided ? { categoryIds: categoriesRequest.ids } : {}),
      status: requested,
      syncedAt: now,
      updatedAt: now,
      updatedBy: req.adminUser
    };
    operations.push({
      type: 'set',
      ref: db.collection('downloadSources').doc(source.id),
      data: sourceData,
      options: { merge: true }
    });
  }

  await commitOperations(db, operations);
  invalidateDownloadCache();
  const categories = await allCategories(db);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const responseItems = saved.slice(0, 250).map(({ id, data }) => serializeDownload(id, data, byId));
  res.status(201).json({
    ok: true,
    created,
    updated,
    imported: saved.length,
    skipped: selection.skipped,
    skippedCount: selection.skippedCount,
    existingSettingsPreserved: !applyToExisting,
    items: responseItems,
    truncated: saved.length > responseItems.length
  });
}));

const updateDownload = asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de download invalido.', 'INVALID_DOWNLOAD_ID');
  const db = dbRequired();
  const ref = db.collection('downloads').doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, 'Download nao encontrado.', 'DOWNLOAD_NOT_FOUND');
  const current = snapshot.data();
  const changes = {};

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')
    || Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
    const name = text(req.body?.name ?? req.body?.title, 240);
    if (!name) throw new HttpError(422, 'Nome do download e obrigatorio.', 'DOWNLOAD_NAME_REQUIRED');
    changes.name = name;
    changes.nameCustomized = true;
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
    changes.description = text(req.body.description, 3000);
    changes.descriptionCustomized = true;
  }

  const categoriesRequest = categoryInput(req.body || {});
  if (categoriesRequest.provided) {
    await validateCategories(db, categoriesRequest.ids);
    changes.categoryIds = categoriesRequest.ids;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowView')) {
    changes.allowView = booleanValue(req.body, 'allowView');
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'allowDownload')) {
    changes.allowDownload = booleanValue(req.body, 'allowDownload');
  }

  const hasStatus = ['published', 'active', 'status'].some((key) => (
    Object.prototype.hasOwnProperty.call(req.body || {}, key)
  ));
  if (hasStatus) {
    changes.status = requestedStatus(req.body, current.status || 'draft');
    if (changes.status === 'published' && current.status !== 'published') {
      await googleDrive.assertWithinRoot(current.driveFileId, { fresh: true });
      changes.publishedAt = new Date().toISOString();
      changes.publishedBy = req.adminUser;
    } else if (changes.status === 'draft') {
      changes.publishedAt = null;
      changes.publishedBy = null;
    }
  }

  if (!Object.keys(changes).length) {
    throw new HttpError(422, 'Nenhum campo editavel foi informado.', 'NO_DOWNLOAD_CHANGES');
  }
  const prospective = { ...current, ...changes };
  if (prospective.status === 'published' && !hasPublicAction(prospective)) {
    throw new HttpError(422, 'Um item publicado precisa permitir visualizacao ou download.', 'DOWNLOAD_WITHOUT_ACTION');
  }
  changes.updatedAt = new Date().toISOString();
  changes.updatedBy = req.adminUser;
  await ref.update(changes);
  invalidateDownloadCache();

  const updated = { ...current, ...changes };
  const categories = await allCategories(db);
  res.json({
    ok: true,
    item: serializeDownload(id, updated, new Map(categories.map((category) => [category.id, category])))
  });
});

downloadsRouter.put('/:id', updateDownload);
downloadsRouter.patch('/:id', updateDownload);

downloadsRouter.delete('/:id', asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de download invalido.', 'INVALID_DOWNLOAD_ID');
  const db = dbRequired();
  const ref = db.collection('downloads').doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, 'Download nao encontrado.', 'DOWNLOAD_NOT_FOUND');
  await ref.delete();
  invalidateDownloadCache();
  res.json({ ok: true, id, driveFileDeleted: false });
}));

categoriesRouter.get('/', asyncRoute(async (req, res) => {
  const categories = await allCategories(dbRequired());
  const visible = String(req.query.active || '').toLowerCase() === 'true'
    ? categories.filter((category) => category.active !== false)
    : categories;
  res.json({ categories: visible, items: visible, total: visible.length });
}));

categoriesRouter.get('/:id', asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de categoria invalido.', 'INVALID_CATEGORY_ID');
  const snapshot = await dbRequired().collection('downloadCategories').doc(id).get();
  if (!snapshot.exists) throw new HttpError(404, 'Categoria nao encontrada.', 'CATEGORY_NOT_FOUND');
  res.json({ category: { id, ...snapshot.data() } });
}));

async function ensureUniqueSlug(db, slug, excludingId) {
  const snapshot = await db.collection('downloadCategories').where('slug', '==', slug).limit(2).get();
  if (snapshot.docs.some((doc) => doc.id !== excludingId)) {
    throw new HttpError(409, 'Ja existe uma categoria com este nome/slug.', 'CATEGORY_SLUG_CONFLICT');
  }
}

function categoryData(body, partial = false) {
  const result = {};
  const hasName = Object.prototype.hasOwnProperty.call(body || {}, 'name');
  const hasSlug = Object.prototype.hasOwnProperty.call(body || {}, 'slug');
  if (hasName || !partial) {
    const name = text(body?.name, 100);
    if (!name) throw new HttpError(422, 'Nome da categoria e obrigatorio.', 'CATEGORY_NAME_REQUIRED');
    result.name = name;
  }
  if (hasSlug || hasName || !partial) {
    const slug = slugify(hasSlug ? body.slug : result.name);
    if (!slug) throw new HttpError(422, 'Slug da categoria e invalido.', 'INVALID_CATEGORY_SLUG');
    result.slug = slug;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'description') || !partial) {
    result.description = text(body?.description, 500);
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'color') || !partial) {
    const color = text(body?.color || '#2F6BC4', 20).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color)) throw new HttpError(422, 'Cor deve estar no formato #RRGGBB.', 'INVALID_CATEGORY_COLOR');
    result.color = color;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'order') || !partial) {
    const order = Number(body?.order || 0);
    if (!Number.isFinite(order)) throw new HttpError(422, 'Ordem da categoria invalida.', 'INVALID_CATEGORY_ORDER');
    result.order = Math.max(-100000, Math.min(100000, Math.trunc(order)));
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'active') || !partial) {
    result.active = partial ? booleanValue(body, 'active') : booleanValue(body, 'active', true);
  }
  return result;
}

categoriesRouter.post('/', asyncRoute(async (req, res) => {
  const db = dbRequired();
  const data = categoryData(req.body || {});
  await ensureUniqueSlug(db, data.slug);
  const now = new Date().toISOString();
  const ref = db.collection('downloadCategories').doc();
  const category = {
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: req.adminUser,
    updatedBy: req.adminUser
  };
  await ref.set(category);
  invalidateDownloadCache();
  res.status(201).json({ ok: true, category: { id: ref.id, ...category } });
}));

const updateCategory = asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de categoria invalido.', 'INVALID_CATEGORY_ID');
  const db = dbRequired();
  const ref = db.collection('downloadCategories').doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, 'Categoria nao encontrada.', 'CATEGORY_NOT_FOUND');
  const changes = categoryData(req.body || {}, true);
  if (!Object.keys(changes).length) throw new HttpError(422, 'Nenhum campo editavel foi informado.', 'NO_CATEGORY_CHANGES');
  if (changes.slug) await ensureUniqueSlug(db, changes.slug, id);
  changes.updatedAt = new Date().toISOString();
  changes.updatedBy = req.adminUser;
  await ref.update(changes);
  invalidateDownloadCache();
  res.json({ ok: true, category: { id, ...snapshot.data(), ...changes } });
});

categoriesRouter.put('/:id', updateCategory);
categoriesRouter.patch('/:id', updateCategory);

categoriesRouter.delete('/:id', asyncRoute(async (req, res) => {
  const id = text(req.params.id, 200);
  if (!validDocumentId(id)) throw new HttpError(422, 'ID de categoria invalido.', 'INVALID_CATEGORY_ID');
  const db = dbRequired();
  const categoryRef = db.collection('downloadCategories').doc(id);
  const category = await categoryRef.get();
  if (!category.exists) throw new HttpError(404, 'Categoria nao encontrada.', 'CATEGORY_NOT_FOUND');

  const [downloads, sources] = await Promise.all([
    db.collection('downloads').where('categoryIds', 'array-contains', id).get(),
    db.collection('downloadSources').where('categoryIds', 'array-contains', id).get()
  ]);
  const fieldValue = getAdmin().firestore.FieldValue;
  const now = new Date().toISOString();
  const operations = [
    ...downloads.docs.map((doc) => ({
      type: 'update',
      ref: doc.ref,
      data: { categoryIds: fieldValue.arrayRemove(id), updatedAt: now, updatedBy: req.adminUser }
    })),
    ...sources.docs.map((doc) => ({
      type: 'update',
      ref: doc.ref,
      data: { categoryIds: fieldValue.arrayRemove(id), updatedAt: now, updatedBy: req.adminUser }
    })),
    { type: 'delete', ref: categoryRef }
  ];
  await commitOperations(db, operations);
  invalidateDownloadCache();
  res.json({ ok: true, id, affectedDownloads: downloads.size, affectedSources: sources.size });
}));

module.exports = { downloadsRouter, categoriesRouter, serializeDownload, normalizeSearch, publicationSettings };
