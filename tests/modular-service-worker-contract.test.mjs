import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evictDisposableCache,
  sweepStaleCache,
  clearBadLingueeCache,
} from '../background/cache-cleaner.js';

import {
  getReencounterWordsSW,
  generateSentenceWithAI,
  generateStoryWithAI,
  generateAIVariation,
} from '../background/ai-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('cache-cleaner: evictDisposableCache limpa chaves voláteis e preserva dados essenciais', async () => {
  const store = {
    'linguee_test': { html: 'ok' },
    'reverso_test': { html: 'ok' },
    'lf_tr:hello': { translation: 'olá' },
    'en:pt:hello': { translation: 'olá' },
    'lastYoutubeSubtitleUrls': ['http://example.com'],
    'nativeLang': 'pt',
    'auth_token': 'xyz',
  };

  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: (_keys, cb) => cb({ ...store }),
        remove: (keys, cb) => {
          keys.forEach((k) => delete store[k]);
          if (cb) cb();
        },
      },
    },
    runtime: {},
  };

  try {
    await evictDisposableCache();
    assert.equal(store.linguee_test, undefined, 'linguee deve ser evictado');
    assert.equal(store.reverso_test, undefined, 'reverso deve ser evictado');
    assert.equal(store['lf_tr:hello'], undefined, 'lf_tr deve ser evictado');
    assert.equal(store['en:pt:hello'], undefined, 'translation key deve ser evictada');
    assert.equal(store.lastYoutubeSubtitleUrls, undefined, 'lastYoutubeSubtitleUrls deve ser evictado');
    assert.equal(store.nativeLang, 'pt', 'preferência nativa do usuário deve ser preservada');
    assert.equal(store.auth_token, 'xyz', 'token deve ser preservado');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('cache-cleaner: sweepStaleCache e clearBadLingueeCache limpam dados corrompidos ou vencidos', () => {
  const now = Date.now();
  const store = {
    'linguee_corrupted': { html: 'bad \uFFFD char' },
    'linguee_old': { html: 'old', ts: now - 5 * 86400000 },
    'linguee_fresh': { html: 'fresh', ts: now - 1000 },
  };

  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: (_keys, cb) => cb({ ...store }),
        remove: (keys, cb) => {
          keys.forEach((k) => delete store[k]);
          if (cb) cb();
        },
      },
    },
    runtime: {},
  };

  try {
    clearBadLingueeCache();
    assert.equal(store.linguee_corrupted, undefined, 'item corrompido com \uFFFD deve ser removido');

    sweepStaleCache(10, 10, 10);
    assert.equal(store.linguee_old, undefined, 'item com mais de 3 dias deve ser removido no sweep');
    assert.ok(store.linguee_fresh, 'item recente deve ser mantido');
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('ai-generator: getReencounterWordsSW prioriza palavras fracas seguidas por aprendizado recente', async () => {
  const mockDb = {
    getAllCards: async () => [
      { word_id: '1', suspended: false, lapses: 4, is_leech: true },
      { word_id: '2', suspended: false, lapses: 0, status: 'learning', last_review: '2026-09-25T10:00:00Z' },
      { word_id: '3', suspended: true, lapses: 10 }, // suspenso
      { word_id: '4', suspended: false, lapses: 1, status: 'new' }, // virgem
    ],
    getAllWords: async () => [
      { id: '1', word: 'leechy' },
      { id: '2', word: 'learning' },
      { id: '3', word: 'suspended' },
      { id: '4', word: 'virgin' },
    ],
  };

  const reencounter = await getReencounterWordsSW(mockDb);
  assert.ok(reencounter.includes('leechy'), 'palavra fraca/leech deve estar no reencontro');
  assert.ok(reencounter.includes('learning'), 'palavra em aprendizado ativo deve estar no reencontro');
  assert.ok(!reencounter.includes('suspended'), 'palavra suspensa não entra no reencontro');
  assert.ok(reencounter.length <= 8, 'máximo de 8 palavras de reencontro');
});

test('ai-generator: generateSentenceWithAI e generateStoryWithAI constroem contratos pedagógicos', async () => {
  let capturedBody = null;
  const mockContext = {
    getApiConfig: async () => ({ apiKey: 'test-key', apiUrl: 'https://api.test', model: 'deepseek-chat' }),
    fetchWithRetry: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Frase: He overcame adversity.\nTradução: Ele superou a adversidade.' } }],
        }),
      };
    },
  };

  const sentenceResult = await generateSentenceWithAI('overcome', mockContext);
  assert.equal(sentenceResult.sentence, 'He overcame adversity.');
  assert.equal(sentenceResult.translation, 'Ele superou a adversidade.');
  assert.match(capturedBody.messages[0].content, /professor de inglês nativo/);

  // Story generation
  const mockStoryContext = {
    db: {
      getSetting: async () => 'B1',
      getAllCards: async () => [],
      getAllWords: async () => [],
      getStories: async () => [],
    },
    getApiConfig: async () => ({ apiKey: 'test-key', apiUrl: 'https://api.test', model: 'deepseek-chat' }),
    fetchWithRetry: async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Once upon a time in London...\n\n"Hello," said Mark.' } }],
        }),
      };
    },
  };

  const storyResult = await generateStoryWithAI('adventure', { targetMinutes: 5, learningGoal: 'vocabulary' }, mockStoryContext);
  assert.equal(storyResult.level, 'B1');
  assert.equal(storyResult.targetMinutes, 5);
  assert.equal(storyResult.promptVersion, 'story-v2');
  assert.match(capturedBody.messages[0].content, /CEFR B1/);
});

test('service-worker: integridade estrutural e contratos de proxy', () => {
  const swCode = readFileSync(path.join(root, 'background/service-worker.js'), 'utf-8');
  assert.match(swCode, /import\s*{\s*evictDisposableCache,\s*sweepStaleCache/);
  assert.match(swCode, /import\s*{\s*generateSentenceWithAI\s+as\s+generateSentenceWithAIModule/);
  assert.match(swCode, /const\s+DB_PROXY_METHODS\s*=\s*new\s+Set/);
  assert.match(swCode, /function\s+_evictDisposableCache\(\)\s*{\s*return\s+evictDisposableCache\(\);\s*}/);
  assert.match(swCode, /function\s+_sweepStaleCache/);
  assert.match(swCode, /async\s+function\s+generateStoryWithAI/);
});
