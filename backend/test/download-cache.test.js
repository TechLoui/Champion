'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rememberDownloadData, invalidateDownloadCache } = require('../lib/download-cache');

test('cache publico deduplica leituras e pode ser invalidado', async () => {
  const previous = process.env.PUBLIC_DOWNLOADS_CACHE_MS;
  process.env.PUBLIC_DOWNLOADS_CACHE_MS = '30000';
  invalidateDownloadCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return ['arquivo'];
  };

  try {
    const [first, second] = await Promise.all([
      rememberDownloadData('test', loader),
      rememberDownloadData('test', loader)
    ]);
    assert.deepEqual(first, ['arquivo']);
    assert.deepEqual(second, ['arquivo']);
    assert.equal(calls, 1);

    invalidateDownloadCache();
    await rememberDownloadData('test', loader);
    assert.equal(calls, 2);
  } finally {
    invalidateDownloadCache();
    if (previous === undefined) delete process.env.PUBLIC_DOWNLOADS_CACHE_MS;
    else process.env.PUBLIC_DOWNLOADS_CACHE_MS = previous;
  }
});
