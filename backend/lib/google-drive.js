'use strict';

const { HttpError } = require('./http-error');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const GOOGLE_MIME_PREFIX = 'application/vnd.google-apps.';

const FILE_FIELDS = [
  'id', 'name', 'mimeType', 'size', 'fileExtension', 'createdTime',
  'modifiedTime', 'description', 'parents', 'md5Checksum', 'iconLink',
  'thumbnailLink', 'webViewLink', 'driveId', 'trashed',
  'capabilities(canDownload)',
  'shortcutDetails(targetId,targetMimeType,targetResourceKey)'
].join(',');

const EXPORT_FORMATS = {
  'application/vnd.google-apps.document': [
    { key: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
    { key: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
    { key: 'txt', mimeType: 'text/plain', extension: 'txt' }
  ],
  'application/vnd.google-apps.spreadsheet': [
    { key: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
    { key: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
    { key: 'csv', mimeType: 'text/csv', extension: 'csv' }
  ],
  'application/vnd.google-apps.presentation': [
    { key: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
    { key: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' }
  ],
  'application/vnd.google-apps.drawing': [
    { key: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
    { key: 'png', mimeType: 'image/png', extension: 'png' },
    { key: 'svg', mimeType: 'image/svg+xml', extension: 'svg' }
  ]
};

let cachedContext = null;
const ancestryCache = new Map();

function boundedEnvInteger(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function apiRequestOptions(extra = {}) {
  return {
    timeout: boundedEnvInteger('GOOGLE_DRIVE_API_TIMEOUT_MS', 20000, 1000, 60000),
    ...extra
  };
}

function streamRequestOptions(extra = {}) {
  return {
    responseType: 'stream',
    timeout: boundedEnvInteger('GOOGLE_DRIVE_STREAM_TIMEOUT_MS', 300000, 10000, 3600000),
    ...extra
  };
}

function normalizePrivateKey(value) {
  let key = String(value || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function parseJsonCredential(raw, variableName) {
  if (!raw) return null;
  let text = String(raw).trim();
  try {
    if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('client_email/private_key ausentes');
    }
    parsed.private_key = normalizePrivateKey(parsed.private_key);
    return { credentials: parsed, source: variableName };
  } catch (err) {
    return { error: `${variableName} invalida: ${err.message}`, source: variableName };
  }
}

function credentialConfig() {
  const explicitJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (explicitJson) {
    return parseJsonCredential(
      explicitJson,
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT
        ? 'GOOGLE_DRIVE_SERVICE_ACCOUNT'
        : 'GOOGLE_SERVICE_ACCOUNT_JSON'
    );
  }

  if (process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
    return {
      source: 'GOOGLE_DRIVE_CLIENT_EMAIL/GOOGLE_DRIVE_PRIVATE_KEY',
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_DRIVE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        private_key: normalizePrivateKey(process.env.GOOGLE_DRIVE_PRIVATE_KEY)
      }
    };
  }

  /* A conta do Firebase tambem e uma service account Google. O fallback evita
     duplicar segredos; basta habilitar Drive API e compartilhar a pasta com o
     FIREBASE_CLIENT_EMAIL. Credenciais Drive dedicadas continuam prioritarias. */
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return parseJsonCredential(process.env.FIREBASE_SERVICE_ACCOUNT, 'FIREBASE_SERVICE_ACCOUNT');
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      source: 'FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY',
      credentials: {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      }
    };
  }
  return { error: 'Credenciais de service account do Google Drive nao configuradas.', source: null };
}

function extractDriveId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const folderMatch = raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  try {
    const url = new URL(raw);
    const id = url.searchParams.get('id');
    if (id) return id;
  } catch (err) { /* Era um ID, nao uma URL. */ }
  return raw;
}

function validDriveId(value) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(String(value || ''));
}

function rootFolderId() {
  return extractDriveId(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '');
}

function getConfigurationSummary() {
  const credential = credentialConfig();
  const rootId = rootFolderId();
  return {
    configured: Boolean(credential.credentials && rootId && validDriveId(rootId)),
    credentialsConfigured: Boolean(credential.credentials),
    rootConfigured: Boolean(rootId && validDriveId(rootId)),
    credentialSource: credential.source || null,
    accountEmail: credential.credentials?.client_email || null,
    rootFolderId: rootId || null,
    configurationError: credential.error
      || (!rootId
        ? 'GOOGLE_DRIVE_ROOT_FOLDER_ID nao configurada.'
        : (!validDriveId(rootId) ? 'GOOGLE_DRIVE_ROOT_FOLDER_ID invalida.' : null))
  };
}

function getContext() {
  if (cachedContext) return cachedContext;
  const config = getConfigurationSummary();
  const credential = credentialConfig();
  if (!config.configured) {
    throw new HttpError(503, config.configurationError || 'Google Drive nao configurado.', 'DRIVE_NOT_CONFIGURED');
  }

  try {
    /* Pacote especifico do Drive evita carregar centenas de APIs Google no
       cold start do Railway. */
    const { drive } = require('@googleapis/drive');
    const { GoogleAuth, JWT } = require('google-auth-library');
    const subject = String(process.env.GOOGLE_DRIVE_IMPERSONATE_USER || '').trim();
    let auth;
    if (subject) {
      auth = new JWT({
        email: credential.credentials.client_email,
        key: credential.credentials.private_key,
        scopes: [DRIVE_SCOPE],
        subject
      });
    } else {
      auth = new GoogleAuth({
        credentials: credential.credentials,
        scopes: [DRIVE_SCOPE]
      });
    }
    cachedContext = {
      drive: drive({ version: 'v3', auth }),
      auth,
      rootId: config.rootFolderId,
      accountEmail: credential.credentials.client_email,
      credentialSource: credential.source,
      impersonatedUser: subject || null
    };
    return cachedContext;
  } catch (err) {
    throw new HttpError(503, `Falha ao iniciar cliente Google Drive: ${err.message}`, 'DRIVE_INIT_FAILED');
  }
}

function googleStatus(err) {
  return Number(err?.code || err?.response?.status || err?.response?.statusCode || 0);
}

function driveError(err, fallback) {
  if (err instanceof HttpError) return err;
  const status = googleStatus(err);
  const providerMessage = String(
    err?.response?.data?.error?.message || err?.errors?.[0]?.message || err?.message || 'erro sem mensagem'
  ).replace(/[\r\n]+/g, ' ').slice(0, 300);
  console.error(`[google-drive] HTTP ${status || 'desconhecido'}: ${providerMessage}`);
  if (status === 404) return new HttpError(404, 'Arquivo ou pasta nao encontrado no Google Drive.', 'DRIVE_ITEM_NOT_FOUND');
  if (status === 400) return new HttpError(422, 'A solicitacao enviada ao Google Drive e invalida.', 'DRIVE_BAD_REQUEST');
  if (status === 416) return new HttpError(416, 'Intervalo solicitado fora do tamanho do arquivo.', 'DRIVE_RANGE_NOT_SATISFIABLE');
  if (status === 401) return new HttpError(503, 'Credencial do Google Drive recusada.', 'DRIVE_AUTH_FAILED');
  if (status === 403) return new HttpError(403, 'A conta de servico nao tem acesso a este item do Google Drive.', 'DRIVE_ACCESS_DENIED');
  if (status === 429) return new HttpError(503, 'Limite temporario da API do Google Drive atingido.', 'DRIVE_RATE_LIMITED');
  return new HttpError(502, fallback || 'Falha ao consultar o Google Drive.', 'DRIVE_REQUEST_FAILED');
}

async function getFile(fileId, fields = FILE_FIELDS) {
  if (!validDriveId(fileId)) throw new HttpError(422, 'ID do Google Drive invalido.', 'INVALID_DRIVE_ID');
  try {
    const context = getContext();
    const response = await context.drive.files.get(
      { fileId, supportsAllDrives: true, fields },
      apiRequestOptions()
    );
    return response.data;
  } catch (err) {
    throw driveError(err);
  }
}

async function assertWithinRoot(fileId, options = {}) {
  const context = getContext();
  if (fileId === context.rootId) return getFile(fileId);

  const cached = ancestryCache.get(fileId);
  if (!options.fresh && cached && cached.expiresAt > Date.now()) {
    if (!cached.allowed) throw new HttpError(403, 'Item fora da pasta autorizada do Google Drive.', 'DRIVE_OUTSIDE_ROOT');
    return getFile(fileId);
  }

  const original = await getFile(fileId);
  let current = original;
  const visited = new Set([fileId]);
  for (let depth = 0; depth < 100; depth += 1) {
    const parentIds = current.parents || [];
    if (parentIds.includes(context.rootId)) {
      ancestryCache.set(fileId, { allowed: true, expiresAt: Date.now() + 60_000 });
      return original;
    }
    if (!parentIds.length) break;
    const parentId = parentIds[0];
    if (visited.has(parentId)) break;
    visited.add(parentId);
    current = await getFile(parentId, 'id,parents');
  }

  ancestryCache.set(fileId, { allowed: false, expiresAt: Date.now() + 15_000 });
  throw new HttpError(403, 'Item fora da pasta autorizada do Google Drive.', 'DRIVE_OUTSIDE_ROOT');
}

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapDriveItem(file) {
  const shortcutTargetMime = file.shortcutDetails?.targetMimeType || null;
  return {
    id: file.id,
    name: String(file.name || 'Sem nome').trim().slice(0, 240) || 'Sem nome',
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.size ? Number(file.size) : null,
    fileExtension: file.fileExtension || null,
    modifiedTime: file.modifiedTime || null,
    createdTime: file.createdTime || null,
    description: String(file.description || '').trim().slice(0, 3000),
    isFolder: file.mimeType === FOLDER_MIME,
    isShortcut: file.mimeType === SHORTCUT_MIME,
    shortcutTargetMimeType: shortcutTargetMime,
    canDownload: file.capabilities?.canDownload !== false,
    iconLink: file.iconLink || null,
    thumbnailLink: file.thumbnailLink || null,
    webViewLink: file.webViewLink || null
  };
}

async function breadcrumbs(folder) {
  const context = getContext();
  const chain = [{ id: folder.id, name: folder.name || 'Pasta' }];
  let current = folder;
  const visited = new Set([folder.id]);
  while (current.id !== context.rootId && current.parents?.length) {
    const parentId = current.parents[0];
    if (visited.has(parentId)) break;
    visited.add(parentId);
    current = await getFile(parentId, 'id,name,parents,mimeType');
    chain.push({ id: current.id, name: current.name || 'Pasta' });
    if (current.id === context.rootId) break;
  }
  return chain.reverse();
}

async function listFolder(options = {}) {
  const context = getContext();
  const folderId = extractDriveId(options.folderId) || context.rootId;
  const folder = await assertWithinRoot(folderId);
  if (folder.trashed) {
    throw new HttpError(404, 'A pasta esta na lixeira do Google Drive.', 'DRIVE_ITEM_TRASHED');
  }
  if (folder.mimeType !== FOLDER_MIME) {
    throw new HttpError(422, 'O item informado nao e uma pasta.', 'DRIVE_NOT_A_FOLDER');
  }

  const search = String(options.q || '').trim().slice(0, 120);
  const clauses = [`'${escapeDriveQuery(folderId)}' in parents`, 'trashed = false'];
  if (search) clauses.push(`name contains '${escapeDriveQuery(search)}'`);

  try {
    const requestedPageSize = Number(options.pageSize);
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(Math.max(Math.trunc(requestedPageSize), 1), 200)
      : 100;
    const response = await context.drive.files.list({
      q: clauses.join(' and '),
      spaces: 'drive',
      pageSize,
      pageToken: options.pageToken || undefined,
      orderBy: 'folder,name_natural',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: `nextPageToken,files(${FILE_FIELDS})`
    }, apiRequestOptions());
    return {
      items: (response.data.files || []).map(mapDriveItem),
      parent: mapDriveItem(folder),
      root: { id: context.rootId },
      breadcrumbs: await breadcrumbs(folder),
      nextPageToken: response.data.nextPageToken || null
    };
  } catch (err) {
    throw driveError(err, 'Falha ao listar a pasta do Google Drive.');
  }
}

async function listAllChildren(folderId, maxItems = Infinity) {
  const context = getContext();
  const files = [];
  let pageToken;
  do {
    let response;
    try {
      response = await context.drive.files.list({
        q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
        spaces: 'drive',
        pageSize: 1000,
        pageToken,
        orderBy: 'folder,name_natural',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: `nextPageToken,files(${FILE_FIELDS})`
      }, apiRequestOptions());
    } catch (err) {
      throw driveError(err, 'Falha ao percorrer uma pasta do Google Drive.');
    }
    files.push(...(response.data.files || []));
    if (files.length > maxItems) {
      throw new HttpError(422, 'A pasta contem itens demais para uma unica importacao.', 'DRIVE_SCAN_LIMIT');
    }
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

function exportOptions(mimeType) {
  return EXPORT_FORMATS[mimeType] || null;
}

function defaultExport(mimeType) {
  return exportOptions(mimeType)?.[0] || null;
}

function isPreviewable(mimeType) {
  const type = String(mimeType || '').toLowerCase();
  return type === 'application/pdf'
    || type === 'text/plain'
    || type === 'text/csv'
    || (type.startsWith('image/') && type !== 'image/svg+xml')
    || type.startsWith('audio/')
    || type.startsWith('video/');
}

function downloadable(file) {
  if (file.trashed) return { ok: false, reason: 'trashed' };
  if (file.mimeType === FOLDER_MIME) return { ok: false, reason: 'folder' };
  if (file.mimeType === SHORTCUT_MIME) return { ok: false, reason: 'shortcut_not_supported' };
  if (file.capabilities?.canDownload === false) return { ok: false, reason: 'download_disabled' };
  if (file.mimeType?.startsWith(GOOGLE_MIME_PREFIX) && !exportOptions(file.mimeType)) {
    return { ok: false, reason: 'google_type_not_exportable' };
  }
  return { ok: true };
}

function pathJoin(parts) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' / ').slice(0, 1000);
}

async function collectSelection(ids, options = {}) {
  const uniqueIds = [...new Set((ids || []).map(extractDriveId).filter(Boolean))];
  if (!uniqueIds.length) throw new HttpError(422, 'Selecione ao menos um arquivo ou pasta.', 'DRIVE_SELECTION_REQUIRED');
  if (uniqueIds.length > 100) throw new HttpError(422, 'Selecione no maximo 100 itens por importacao.', 'DRIVE_SELECTION_TOO_LARGE');
  if (uniqueIds.some((id) => !validDriveId(id))) throw new HttpError(422, 'A selecao contem um ID invalido.', 'INVALID_DRIVE_ID');

  const recursive = options.recursive !== false;
  const maxFiles = Math.trunc(Math.min(Math.max(Number(process.env.GOOGLE_DRIVE_IMPORT_MAX_FILES) || 1000, 1), 5000));
  const maxDepth = Math.trunc(Math.min(Math.max(Number(process.env.GOOGLE_DRIVE_IMPORT_MAX_DEPTH) || 25, 1), 100));
  const maxItems = Math.trunc(Math.min(Math.max(
    Number(process.env.GOOGLE_DRIVE_IMPORT_MAX_ITEMS) || 5000,
    maxFiles
  ), 20000));
  const files = new Map();
  const skipped = [];
  let skippedCount = 0;
  let scannedCount = 0;
  const selected = [];

  for (const id of uniqueIds) selected.push(await assertWithinRoot(id));

  const addFile = (file, source, folderParts) => {
    const allowed = downloadable(file);
    if (!allowed.ok) {
      skippedCount += 1;
      if (skipped.length < 250) {
        skipped.push({ id: file.id, name: file.name || 'Sem nome', reason: allowed.reason });
      }
      return;
    }
    if (files.has(file.id)) return;
    if (files.size >= maxFiles) {
      throw new HttpError(422, `A selecao ultrapassa o limite de ${maxFiles} arquivos.`, 'DRIVE_IMPORT_LIMIT');
    }
    files.set(file.id, {
      file,
      sourceRootDriveId: source.id,
      sourceRootName: source.name || 'Pasta',
      relativePath: pathJoin(folderParts)
    });
  };

  for (const item of selected) {
    if (item.trashed) {
      skippedCount += 1;
      skipped.push({ id: item.id, name: item.name || 'Sem nome', reason: 'trashed' });
      continue;
    }
    if (item.mimeType !== FOLDER_MIME) {
      addFile(item, item, []);
      continue;
    }
    if (!recursive) {
      skippedCount += 1;
      skipped.push({ id: item.id, name: item.name, reason: 'recursive_disabled' });
      continue;
    }

    const queue = [{ folder: item, parts: [], depth: 0 }];
    let queueIndex = 0;
    const visitedFolders = new Set();
    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;
      if (visitedFolders.has(current.folder.id)) continue;
      visitedFolders.add(current.folder.id);
      if (current.depth > maxDepth) {
        throw new HttpError(422, `A pasta ultrapassa o limite de ${maxDepth} niveis.`, 'DRIVE_IMPORT_DEPTH_LIMIT');
      }
      const children = await listAllChildren(current.folder.id, maxItems - scannedCount);
      for (const child of children) {
        scannedCount += 1;
        if (scannedCount > maxItems) {
          throw new HttpError(422, `A selecao ultrapassa o limite de ${maxItems} itens examinados.`, 'DRIVE_SCAN_LIMIT');
        }
        if (child.mimeType === FOLDER_MIME) {
          queue.push({
            folder: child,
            parts: [...current.parts, child.name || 'Pasta'],
            depth: current.depth + 1
          });
        } else {
          addFile(child, item, current.parts);
        }
      }
    }
  }

  return {
    files: [...files.values()],
    skipped,
    skippedCount,
    scannedCount,
    selectedCount: selected.length,
    selected: selected.map((item) => ({
      id: item.id,
      name: String(item.name || 'Sem nome').trim().slice(0, 240) || 'Sem nome',
      mimeType: item.mimeType,
      isFolder: item.mimeType === FOLDER_MIME
    }))
  };
}

async function getStatus() {
  const config = getConfigurationSummary();
  if (!config.configured) return { ...config, connected: false, rootFolder: null };
  try {
    const context = getContext();
    const [root, about] = await Promise.all([
      getFile(context.rootId),
      context.drive.about.get(
        { fields: 'user(displayName,emailAddress,permissionId)' },
        apiRequestOptions()
      )
    ]);
    if (root.mimeType !== FOLDER_MIME || root.trashed) {
      return {
        ...config,
        connected: false,
        rootFolder: mapDriveItem(root),
        error: root.trashed
          ? 'A pasta raiz configurada esta na lixeira do Google Drive.'
          : 'GOOGLE_DRIVE_ROOT_FOLDER_ID nao aponta para uma pasta.'
      };
    }
    return {
      ...config,
      connected: true,
      accountEmail: context.impersonatedUser || about.data.user?.emailAddress || context.accountEmail,
      accountName: about.data.user?.displayName || null,
      impersonatedUser: context.impersonatedUser,
      rootFolder: mapDriveItem(root),
      error: null
    };
  } catch (err) {
    const mapped = driveError(err);
    return { ...config, connected: false, rootFolder: null, error: mapped.message, code: mapped.code };
  }
}

function chooseExport(mimeType, requested) {
  const choices = exportOptions(mimeType);
  if (!choices) return null;
  if (!requested) return choices[0];
  const normalized = String(requested).toLowerCase().trim();
  const selected = choices.find((choice) => (
    choice.key === normalized || choice.extension === normalized || choice.mimeType === normalized
  ));
  if (!selected) {
    throw new HttpError(422, `Formato de exportacao indisponivel. Opcoes: ${choices.map((c) => c.key).join(', ')}.`, 'INVALID_EXPORT_FORMAT');
  }
  return selected;
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

async function openFileStream(fileId, options = {}) {
  const context = getContext();
  const file = await assertWithinRoot(fileId, { fresh: true });
  const allowed = downloadable(file);
  if (!allowed.ok) throw new HttpError(409, 'Este item nao esta disponivel para download.', 'DRIVE_FILE_UNAVAILABLE');

  const nativeExport = chooseExport(file.mimeType, options.format);
  if (nativeExport) {
    if (options.range) throw new HttpError(416, 'Intervalos nao sao suportados para arquivos Google exportados.', 'RANGE_NOT_SUPPORTED');
    if (options.mode === 'view' && !isPreviewable(nativeExport.mimeType)) {
      throw new HttpError(415, 'Este formato nao possui visualizacao segura no navegador.', 'PREVIEW_NOT_SUPPORTED');
    }
    try {
      const response = await context.drive.files.export(
        { fileId, mimeType: nativeExport.mimeType },
        streamRequestOptions()
      );
      return {
        stream: response.data,
        mimeType: nativeExport.mimeType,
        extension: nativeExport.extension,
        size: Number(headerValue(response.headers, 'content-length')) || null,
        contentRange: null,
        status: 200,
        previewable: isPreviewable(nativeExport.mimeType),
        driveFile: file
      };
    } catch (err) {
      throw driveError(err, 'Falha ao exportar o arquivo do Google Drive.');
    }
  }

  const mimeType = file.mimeType || 'application/octet-stream';
  if (options.mode === 'view' && !isPreviewable(mimeType)) {
    throw new HttpError(415, 'Este tipo de arquivo nao possui visualizacao segura no navegador.', 'PREVIEW_NOT_SUPPORTED');
  }

  try {
    const requestOptions = streamRequestOptions();
    if (options.range) requestOptions.headers = { Range: options.range };
    const response = await context.drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      requestOptions
    );
    return {
      stream: response.data,
      mimeType,
      extension: file.fileExtension || null,
      size: Number(headerValue(response.headers, 'content-length')) || Number(file.size) || null,
      contentRange: headerValue(response.headers, 'content-range'),
      acceptRanges: headerValue(response.headers, 'accept-ranges'),
      etag: headerValue(response.headers, 'etag'),
      status: Number(response.status) || (options.range ? 206 : 200),
      previewable: isPreviewable(mimeType),
      driveFile: file
    };
  } catch (err) {
    throw driveError(err, 'Falha ao baixar o arquivo do Google Drive.');
  }
}

module.exports = {
  FOLDER_MIME,
  SHORTCUT_MIME,
  FILE_FIELDS,
  EXPORT_FORMATS,
  extractDriveId,
  validDriveId,
  getConfigurationSummary,
  getStatus,
  getFile,
  assertWithinRoot,
  listFolder,
  collectSelection,
  defaultExport,
  exportOptions,
  isPreviewable,
  mapDriveItem,
  openFileStream
};
