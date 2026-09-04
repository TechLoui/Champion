'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'frontend', 'admin.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'frontend', 'js', 'admin-downloads.js'), 'utf8');
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
const downloadDrawerHtml = downloadsHtml.slice(downloadsHtml.indexOf('id="downloadEditDrawer"'));
assert.doesNotMatch(downloadDrawerHtml, /data-close-drawer/, 'O fechamento genérico não pode ignorar o bloqueio durante o salvamento.');
assert.match(html, /id="driveItemsList"[^>]*aria-busy="true"/);
assert.match(html, /id="publishedDownloadList"[^>]*aria-busy="true"/);
assert.match(html, /admin-downloads\.js\?v=20260904-3/);
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

console.log(`admin-downloads UI contract: OK (${new Set(refIds).size} IDs verificados)`);
