'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeDownload, normalizeSearch, publicationSettings } = require('../routes/admin-downloads');

test('normaliza busca em portugues sem acentos', () => {
  assert.equal(normalizeSearch('  Nutri\u00e7\u00e3o Bovina / 2026  '), 'nutricao bovina 2026');
});

test('indice de busca pode incluir campos depois dos primeiros 300 caracteres', () => {
  const content = `${'descricao '.repeat(40)} Categoria Especial`;
  assert.equal(normalizeSearch(content, 8000).includes('categoria especial'), true);
});

test('serializacao administrativa nao transforma tamanho ausente em zero', () => {
  const item = serializeDownload('arquivo_1', {
    name: 'Ficha tecnica',
    mimeType: 'application/pdf',
    size: null,
    status: 'published',
    categoryIds: []
  }, new Map());
  assert.equal(item.size, null);
  assert.equal(item.canPreview, true);
  assert.equal(item.viewUrl, '/api/downloads/arquivo_1/view');
  assert.equal(item.downloadUrl, '/api/downloads/arquivo_1/download');
});

test('tipo inseguro nao recebe URL de preview', () => {
  const item = serializeDownload('arquivo_2', {
    name: 'Pagina HTML',
    mimeType: 'text/html',
    status: 'published',
    allowView: true,
    allowDownload: false,
    categoryIds: []
  }, new Map());
  assert.equal(item.canPreview, false);
  assert.equal(item.viewUrl, null);
  assert.equal(item.downloadUrl, null);
});

test('reimportacao preserva configuracoes individuais de arquivos existentes', () => {
  const settings = publicationSettings({
    status: 'draft',
    categoryIds: ['categoria-antiga'],
    allowView: true,
    allowDownload: false
  }, {
    applyToExisting: false,
    categoriesProvided: true,
    categoryIds: ['categoria-nova'],
    status: 'published',
    allowView: false,
    allowDownload: true
  });

  assert.deepEqual(settings, {
    status: 'draft',
    categoryIds: ['categoria-antiga'],
    allowView: true,
    allowDownload: false
  });
});

test('sobrescrita explicita aplica configuracoes novas a arquivos existentes', () => {
  const settings = publicationSettings({
    status: 'draft',
    categoryIds: ['categoria-antiga'],
    allowView: true,
    allowDownload: false
  }, {
    applyToExisting: true,
    categoriesProvided: true,
    categoryIds: ['categoria-nova'],
    status: 'published',
    allowView: false,
    allowDownload: true
  });

  assert.deepEqual(settings, {
    status: 'published',
    categoryIds: ['categoria-nova'],
    allowView: false,
    allowDownload: true
  });
});
