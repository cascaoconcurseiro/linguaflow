import test from 'node:test';
import assert from 'node:assert/strict';
import { translator } from '../utils/translator.js';
import { db } from '../utils/db.js';

test('content translation delegates cloud cache to worker and persists local result', async () => {
  const originals = { chrome: globalThis.chrome, location: globalThis.location, get: db.getTranslationCache, set: db.setTranslationCache };
  const local = {};
  const messages = [];
  globalThis.location = { protocol: 'https:', hostname: 'www.youtube.com' };
  globalThis.chrome = {
    runtime: { id: 'test', sendMessage: async (message) => { messages.push(message); return { translation: 'frase traduzida', source: 'google_api' }; } },
    storage: { local: { get: (_keys, cb) => cb(local), set: (values, cb) => { Object.assign(local, values); cb(); } } },
  };
  let cloudCalls = 0;
  db.getTranslationCache = async () => { cloudCalls++; return null; };
  db.setTranslationCache = async () => { cloudCalls++; };
  translator.memoryCache.clear();
  try {
    const result = await translator.translate('a unique sentence for testing', 'en', 'pt');
    assert.equal(result.translation, 'frase traduzida');
    assert.equal(cloudCalls, 0);
    assert.equal(messages.length, 1);
    assert.ok(Object.values(local).includes('frase traduzida'));
    translator.memoryCache.clear();
    assert.equal((await translator.translate('a unique sentence for testing', 'en', 'pt')).source, 'local_cache');
    assert.equal(messages.length, 1);
  } finally {
    globalThis.chrome = originals.chrome;
    globalThis.location = originals.location;
    db.getTranslationCache = originals.get;
    db.setTranslationCache = originals.set;
    translator.memoryCache.clear();
  }
});

test('cloud cache deadline bounds stalled token/network and aborts request', async () => {
  const original = db._fetch;
  const proxy = db.isProxyMode;
  db.isProxyMode = false;
  let signal;
  db._fetch = (_endpoint, options) => { signal = options.signal; return new Promise(() => {}); };
  try {
    const started = Date.now();
    assert.equal(await db.getTranslationCache('timeout-test'), null);
    assert.ok(Date.now() - started < 4000);
    assert.equal(signal.aborted, true);
    assert.equal(await db.setTranslationCache('timeout-test', 'value'), false);
    assert.equal(signal.aborted, true);
  } finally { db._fetch = original; db.isProxyMode = proxy; }
});

test('cloud cache preserves successful reads/writes and tolerates failure', async () => {
  const original = db._fetch;
  const proxy = db.isProxyMode;
  db.isProxyMode = false;
  try {
    db._fetch = async () => [{ value: 'cached' }];
    assert.equal(await db.getTranslationCache('success'), 'cached');
    assert.equal(await db.setTranslationCache('success', 'cached'), true);
    db._fetch = async () => { throw new Error('network unavailable'); };
    assert.equal(await db.getTranslationCache('failure'), null);
    assert.equal(await db.setTranslationCache('failure', 'value'), false);
  } finally { db._fetch = original; db.isProxyMode = proxy; }
});

test('expired cache deadline never starts REST after a late token refresh', async () => {
  const originalToken = db._getToken;
  const originalFetch = globalThis.fetch;
  const proxy = db.isProxyMode;
  const controller = new AbortController();
  let releaseToken;
  let requests = 0;
  db.isProxyMode = false;
  db._getToken = () => new Promise((resolve) => { releaseToken = resolve; });
  globalThis.fetch = async () => { requests++; throw new Error('unexpected network'); };
  try {
    const request = db._fetch('translation_cache', { signal: controller.signal, silent: true });
    controller.abort();
    releaseToken('late-token');
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(requests, 0);
  } finally { db._getToken = originalToken; globalThis.fetch = originalFetch; db.isProxyMode = proxy; }
});
