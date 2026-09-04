'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const drive = require('../lib/google-drive');

test('extrai ID puro ou URL de pasta do Google Drive', () => {
  const id = '1Abc_def-GHIjklmnOP';
  assert.equal(drive.extractDriveId(id), id);
  assert.equal(drive.extractDriveId(`https://drive.google.com/drive/folders/${id}?usp=sharing`), id);
  assert.equal(drive.extractDriveId(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(drive.validDriveId(id), true);
  assert.equal(drive.validDriveId('../fora'), false);
});

test('Google Docs usa PDF como exportacao padrao', () => {
  assert.deepEqual(drive.defaultExport('application/vnd.google-apps.document'), {
    key: 'pdf',
    mimeType: 'application/pdf',
    extension: 'pdf'
  });
  assert.equal(drive.defaultExport('application/octet-stream'), null);
});

test('preview aceita formatos seguros e recusa SVG/HTML', () => {
  assert.equal(drive.isPreviewable('application/pdf'), true);
  assert.equal(drive.isPreviewable('image/png'), true);
  assert.equal(drive.isPreviewable('video/mp4'), true);
  assert.equal(drive.isPreviewable('image/svg+xml'), false);
  assert.equal(drive.isPreviewable('text/html'), false);
});

test('status de configuracao nao expoe valores secretos', () => {
  const names = [
    'GOOGLE_DRIVE_SERVICE_ACCOUNT', 'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_DRIVE_CLIENT_EMAIL', 'GOOGLE_DRIVE_PRIVATE_KEY',
    'GOOGLE_DRIVE_ROOT_FOLDER_ID', 'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = '1Abc_def-GHIjklmnOP';
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL = 'drive@example.iam.gserviceaccount.com';
    process.env.GOOGLE_DRIVE_PRIVATE_KEY = 'segredo-que-nao-pode-sair';
    const summary = drive.getConfigurationSummary();
    assert.equal(summary.configured, true);
    assert.equal(summary.accountEmail, 'drive@example.iam.gserviceaccount.com');
    assert.equal(JSON.stringify(summary).includes('segredo-que-nao-pode-sair'), false);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
