import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

test('manifest.json declares unlimitedStorage to prevent 10MB quota exhaustion', () => {
  assert.ok(
    manifest.permissions.includes('unlimitedStorage'),
    'manifest.json deve incluir a permissão unlimitedStorage'
  );
  assert.ok(
    manifest.permissions.includes('storage'),
    'manifest.json deve manter a permissão storage'
  );
});

test('db._evictDisposableStorage removes disposable keys and preserves critical learner data', async () => {
  const { db } = await import('../utils/db.js');

  const storageMap = new Map([
    ['lf_supabase_session', 'auth-token-123'],
    ['lf_listening_queue_v1:user_1', [{ id: 'item_1', seconds: 10 }]],
    ['lf_pending_word_saves_v1', { 'en:hello': { word: 'hello' } }],
    ['lf_fluency_draft_v1:user_1', { step: 1 }],
    ['lf_saved_stories', [{ id: 'story_1' }]],
    ['linguee_apple', { html: '<html>large content</html>', ts: Date.now() }],
    ['reverso_apple', { list: [{ en: 'apple', pt: 'maçã' }], ts: Date.now() }],
    ['lf_tr:en:pt:hello', 'olá'],
    ['en:pt:world', 'mundo'],
    ['lastYoutubeSubtitleUrls', ['https://youtube.com/api/timedtext?...']],
  ]);

  // Mock chrome.storage.local
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: (query, cb) => {
          if (query === null) {
            const all = {};
            for (const [k, v] of storageMap.entries()) all[k] = v;
            cb(all);
          } else if (Array.isArray(query)) {
            const res = {};
            for (const k of query) if (storageMap.has(k)) res[k] = storageMap.get(k);
            cb(res);
          } else if (typeof query === 'string') {
            cb({ [query]: storageMap.get(query) });
          }
        },
        remove: (keys, cb) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) storageMap.delete(k);
          if (cb) cb();
        },
        set: (obj, cb) => {
          for (const [k, v] of Object.entries(obj)) storageMap.set(k, v);
          if (cb) cb();
        },
      },
    },
    runtime: {},
  };

  try {
    await db._evictDisposableStorage();

    // Critical user data must be intact
    assert.equal(storageMap.has('lf_supabase_session'), true, 'lf_supabase_session deve ser preservado');
    assert.equal(storageMap.has('lf_listening_queue_v1:user_1'), true, 'lf_listening_queue deve ser preservada');
    assert.equal(storageMap.has('lf_pending_word_saves_v1'), true, 'lf_pending_word_saves deve ser preservada');
    assert.equal(storageMap.has('lf_fluency_draft_v1:user_1'), true, 'lf_fluency_draft deve ser preservado');
    assert.equal(storageMap.has('lf_saved_stories'), true, 'lf_saved_stories deve ser preservado');

    // Disposable caches must be pruned
    assert.equal(storageMap.has('linguee_apple'), false, 'linguee_ deve ser removido');
    assert.equal(storageMap.has('reverso_apple'), false, 'reverso_ deve ser removido');
    assert.equal(storageMap.has('lf_tr:en:pt:hello'), false, 'lf_tr: deve ser removido');
    assert.equal(storageMap.has('en:pt:world'), false, 'legado en:pt: deve ser removido');
    assert.equal(storageMap.has('lastYoutubeSubtitleUrls'), false, 'lastYoutubeSubtitleUrls deve ser removido');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('db._draftStorage recovers from QuotaExceededError by evicting disposable items and retrying', async () => {
  const { db } = await import('../utils/db.js');

  const storageMap = new Map([
    ['linguee_bloat', { html: 'huge html' }],
    ['lf_tr:en:pt:test', 'teste'],
  ]);

  let quotaTriggered = true;
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: (query, cb) => {
          globalThis.chrome.runtime.lastError = null;
          if (query === null) {
            const all = {};
            for (const [k, v] of storageMap.entries()) all[k] = v;
            cb(all);
          } else {
            cb({ [query]: storageMap.get(query) });
          }
        },
        remove: (keys, cb) => {
          globalThis.chrome.runtime.lastError = null;
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) storageMap.delete(k);
          if (cb) cb();
        },
        set: (obj, cb) => {
          if (quotaTriggered) {
            quotaTriggered = false;
            globalThis.chrome.runtime.lastError = { message: 'Resource::kQuotaBytes quota exceeded' };
            cb();
            return;
          }
          globalThis.chrome.runtime.lastError = null;
          for (const [k, v] of Object.entries(obj)) storageMap.set(k, v);
          cb();
        },
      },
    },
    runtime: {},
  };

  try {
    const queueData = [{ id: 'int_123', seconds: 10 }];
    await db._draftStorage('set', 'lf_listening_queue_v1:user_1', queueData);

    assert.equal(storageMap.has('lf_listening_queue_v1:user_1'), true, 'A fila de listening deve ser gravada no retry');
    assert.equal(storageMap.has('linguee_bloat'), false, 'Caches descartáveis foram limpos');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('translator namespaces keys and gracefully reads legacy keys', async () => {
  const { translator } = await import('../utils/translator.js');

  const cacheKey = translator._getCacheKey('Hello World', 'en', 'pt');
  assert.equal(cacheKey, 'lf_tr:en:pt:hello world', 'Chave deve ter namespace lf_tr:');

  const storageMap = new Map([
    ['en:pt:legacy text', 'texto legado'],
  ]);

  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          for (const k of keys) {
            if (storageMap.has(k)) res[k] = storageMap.get(k);
          }
          cb(res);
        },
      },
    },
    runtime: {},
  };

  try {
    const cached = await translator._getLocalCache('lf_tr:en:pt:legacy text');
    assert.equal(cached, 'texto legado', 'Deve encontrar chave legada sem o prefixo');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('subtitle-engine applies backoff and avoids 1s loop on flush errors', () => {
  const engineSource = readFileSync(join(root, 'content/subtitle-engine.js'), 'utf8');

  // Verify backoff tracking and interval checks
  assert.match(
    engineSource,
    /_listeningFlushNextAttempt/,
    'Engine deve controlar _listeningFlushNextAttempt'
  );
  assert.match(
    engineSource,
    /Date\.now\(\)\s*>=\s*\(this\._listeningFlushNextAttempt\s*\|\|\s*0\)/,
    'Engine deve respeitar janela de backoff antes de invocar _flushListeningInterval'
  );
  assert.match(
    engineSource,
    /Math\.min\(60000,\s*5000\s*\*\s*Math\.pow\(2,\s*failures\s*-\s*1\)\)/,
    'Engine deve aplicar backoff exponencial limitado a 60s'
  );
  assert.match(
    engineSource,
    /_listeningLastErrorLogged/,
    'Engine deve evitar log duplicado a cada segundo de erro de listening'
  );
});
