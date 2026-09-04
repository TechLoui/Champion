'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'frontend', 'admin.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'frontend', 'js', 'admin-downloads.js'), 'utf8');
const publicDownloadsRoute = fs.readFileSync(path.join(root, 'backend', 'routes', 'downloads.js'), 'utf8');
const downloadsStart = html.indexOf('<section data-admin-panel="downloads"');
const downloadsEnd = html.indexOf('<section data-admin-panel="settings"', downloadsStart);
assert.ok(downloadsStart >= 0 && downloadsEnd > downloadsStart, 'A seção de Downloads não foi encontrada.');
const downloadsHtml = html.slice(downloadsStart, downloadsEnd);

const refIds = Array.from(script.matchAll(/\$\('#([^']+)'\)/g), (match) => match[1]);
assert.ok(refIds.length > 40, 'O contrato da interface de Downloads parece incompleto.');

for (const id of new Set(refIds)) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  assert.equal(matches.length, 1, `O ID #${id} precisa existir exatamente uma vez no admin.html.`);
}

const allIds = Array.from(downloadsHtml.matchAll(/\sid=["']([^"']+)["']/g), (match) => match[1]);
const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
assert.deepEqual(Array.from(new Set(duplicates)), [], 'Há IDs HTML duplicados no painel.');

assert.match(html, /id="downloadEditDrawer"[^>]*aria-hidden="true"[^>]*inert/);
assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="downloadEditTitle"/);
assert.match(html, /id="downloadPreviewDrawer"[^>]*aria-hidden="true"[^>]*inert/);
assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="downloadPreviewTitle"[^>]*aria-describedby="downloadPreviewMeta"/);
const downloadDrawerHtml = downloadsHtml.slice(downloadsHtml.indexOf('id="downloadEditDrawer"'));
assert.doesNotMatch(downloadDrawerHtml, /data-close-drawer/, 'O fechamento genérico não pode ignorar o bloqueio durante o salvamento.');
assert.match(html, /id="driveItemsList"[^>]*aria-busy="true"/);
assert.match(html, /id="publishedDownloadList"[^>]*aria-busy="true"/);
assert.match(html, /id="driveStatusCard"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(downloadsHtml, /<span class="dl-source-label">Pasta do Google Drive<\/span>/);
assert.doesNotMatch(downloadsHtml, /driveAccountMeta|driveStatusPill|driveConfigHelp|driveHelpEmail|Detalhes da conexão|conta de serviço/i);
assert.match(html, /admin-downloads\.js\?v=20260904-5/);
assert.doesNotMatch(downloadsHtml, /role="(?:table|rowgroup|row|cell|columnheader)"/);
assert.match(html, /\.sr-only\s*\{/);
assert.doesNotMatch(downloadsHtml, /id="(?:driveItemsList|publishedDownloadList|driveSelectedPreview)"[^>]*aria-live/);

assert.match(script, /driveRequestId/);
assert.match(script, /data-selected-remove/);
assert.match(script, /hasCategorySelection/);
assert.match(script, /setDrawerFeedback/);
assert.match(script, /MAX_DIRECT_SELECTION = 100/);
assert.match(script, /MAX_CATEGORY_SELECTION = 20/);
assert.match(script, /isImportableDriveItem/);
assert.match(script, /isPreviewableDriveItem/);
assert.match(script, /pendingPublications/);
assert.match(script, /function driveRootName\(payload\)/);
const driveRootNameBody = script.slice(script.indexOf('function driveRootName'), script.indexOf('function updateRootFromStatus'));
assert.doesNotMatch(driveRootNameBody, /root\.(?:id|folderId)/, 'O ID técnico da pasta não pode ser usado como nome visível.');
assert.doesNotMatch(script, /accountEmail|serviceAccountEmail|refs\.statusPill|refs\.statusMeta|refs\.helpEmail/);
assert.match(script, /viewUrl,\s*\n\s*webViewLink: driveWebViewLink/);
assert.match(script, /canDownload: allowDownload && Boolean\(downloadUrl\)/);
assert.match(script, /safeDownloadEndpoint\(item\?\.viewUrl, item\?\.id, 'view'\)/);
assert.match(script, /data-publication-preview/);
assert.match(downloadsHtml, /data-download-preview-close/);
assert.match(script, /Download liberado/);
assert.match(script, /Download não liberado/);
assert.match(script, /Preview disponível/);
assert.match(script, /Preview indisponível/);
assert.match(script, /function clearPreviewStage\(\)/);
assert.match(script, /media\.pause\(\)/);
assert.match(script, /item\?\.status === 'published'/);
assert.match(script, /<iframe[^`]*referrerpolicy="no-referrer"/);
assert.doesNotMatch(script, /<iframe[^`]*\ssandbox(?:\s|>)/);
assert.match(publicDownloadsRoute, /if \(mode !== 'view'\) responseHeaders\['Content-Security-Policy'\] = 'sandbox'/);
assert.doesNotMatch(downloadsHtml, /dl-permission-badge/);

console.log(`admin-downloads UI contract: OK (${new Set(refIds).size} IDs verificados)`);
