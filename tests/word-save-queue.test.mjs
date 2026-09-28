// Fila local-first de palavras: erro permanente para de repetir e fica
// visível; erro transitório (rede, 5xx, sessão, 429) continua na fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isPermanentSaveError, retryableEntries, summarizeWordSaveQueue,
} from '../background/word-save-queue.js';

test('só 4xx de validação/permissão é permanente; rede, sessão, timeout e limite continuam tentando', () => {
  for (const status of [400, 403, 404, 409, 422]) assert.equal(isPermanentSaveError({ status }), true, String(status));
  for (const status of [401, 408, 429, 500, 502, 503]) assert.equal(isPermanentSaveError({ status }), false, String(status));
  assert.equal(isPermanentSaveError(new Error('Failed to fetch')), false);
  assert.equal(isPermanentSaveError({ kind: 'auth' }), false);
  assert.equal(isPermanentSaveError(null), false);
});

test('itens com falha permanente saem da repetição automática, sem sumir da fila', () => {
  const queue = {
    'en:ok': { id: 'en:ok', queuedAt: 1, payload: { word: 'ok' } },
    'en:bad': { id: 'en:bad', queuedAt: 2, failed: true, payload: { word: 'bad' } },
  };
  assert.deepEqual(retryableEntries(queue, new Set()).map(([id]) => id), ['en:ok']);
  assert.deepEqual(retryableEntries(queue, new Set(['en:ok:1'])), []);
  assert.ok(queue['en:bad'], 'falha permanente continua guardada até o usuário decidir');
});

test('resumo para o popup separa pendentes de falhas e nunca expõe o payload inteiro', () => {
  const summary = summarizeWordSaveQueue({
    'en:a': { id: 'en:a', queuedAt: 1, payload: { word: 'a', context: 'segredo do contexto' } },
    'en:b': { id: 'en:b', queuedAt: 2, failed: true, lastError: 'x'.repeat(300), payload: { word: 'b' } },
  });
  assert.equal(summary.pending, 1);
  assert.deepEqual(summary.failed.map(item => item.word), ['b']);
  assert.ok(summary.failed[0].lastError.length <= 160);
  assert.ok(!JSON.stringify(summary).includes('segredo do contexto'));
  assert.deepEqual(summarizeWordSaveQueue(undefined), { pending: 0, failed: [] });
});

test('service worker usa a regra do módulo e expõe consulta, repetição e descarte', () => {
  const sw = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
  assert.match(sw, /from '\.\/word-save-queue\.js'/);
  assert.match(sw, /isPermanentSaveError\(error\)/);
  assert.match(sw, /retryableEntries\(queue, processedVersions\)/);
  for (const type of ['GET_WORD_SAVE_QUEUE', 'RETRY_FAILED_WORD_SAVES', 'DISCARD_FAILED_WORD_SAVES']) {
    assert.ok(sw.includes(`'${type}'`), type);
  }
  const popup = readFileSync(new URL('../popup/popup.js', import.meta.url), 'utf8');
  assert.match(popup, /GET_WORD_SAVE_QUEUE/);
  assert.match(popup, /confirm\(/, 'descartar pede confirmação');
});
