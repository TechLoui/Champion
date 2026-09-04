'use strict';

const entries = new Map();
let generation = 0;

function cacheDuration() {
  const value = Number(process.env.PUBLIC_DOWNLOADS_CACHE_MS);
  if (!Number.isFinite(value)) return 30000;
  return Math.min(Math.max(Math.trunc(value), 0), 300000);
}

async function rememberDownloadData(key, loader) {
  const ttl = cacheDuration();
  if (!ttl) return loader();

  const now = Date.now();
  const current = entries.get(key);
  if (current?.value !== undefined && current.expiresAt > now) return current.value;
  if (current?.promise) return current.promise;

  const startedAtGeneration = generation;
  const promise = Promise.resolve().then(loader);
  entries.set(key, { promise, expiresAt: 0 });
  try {
    const value = await promise;
    if (generation === startedAtGeneration) {
      entries.set(key, { value, expiresAt: Date.now() + ttl });
    }
    return value;
  } catch (err) {
    if (generation === startedAtGeneration) entries.delete(key);
    throw err;
  }
}

function invalidateDownloadCache() {
  generation += 1;
  entries.clear();
}

module.exports = { rememberDownloadData, invalidateDownloadCache };
