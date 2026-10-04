import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  LOOKUP_DEBOUNCE_MS,
  LOOKUP_KEY,
  LOOKUP_MAX_ENTRIES,
  bumpLookup,
  lookupHintText,
  recordLookup,
} from '../content/subtitles/lookup-memory.js';

test('consulta repetida: conta, ignora rajada de hover e avisa a partir da 3ª', () => {
  let state = {};
  let count = 0;
  ({ counts: state, count } = bumpLookup(state, 'Meticulous', 1000));
  assert.equal(count, 1);
  ({ counts: state, count } = bumpLookup(state, 'meticulous', 1500)); // hover logo depois: mesma consulta
  assert.equal(count, 1);
  ({ counts: state, count } = bumpLookup(state, 'meticulous', 1000 + LOOKUP_DEBOUNCE_MS));
  assert.equal(count, 2);
  ({ counts: state, count } = bumpLookup(state, 'meticulous', 1000 + 2 * LOOKUP_DEBOUNCE_MS));
  assert.equal(count, 3);
  assert.equal(lookupHintText(2), '');
  assert.match(lookupHintText(3), /3 vezes/);
});

test('consulta repetida: limita o tamanho, descarta as mais antigas e ignora entradas inválidas', () => {
  let state = {};
  for (let i = 0; i < LOOKUP_MAX_ENTRIES + 20; i += 1) ({ counts: state } = bumpLookup(state, `w${i}`, 1000 + i));
  assert.equal(Object.keys(state).length, LOOKUP_MAX_ENTRIES);
  assert.ok(!('w0' in state));
  assert.equal(bumpLookup({}, '', 1).count, 0);
  assert.equal(bumpLookup(null, 'a'.repeat(41), 1).count, 0);
});

test('consulta repetida: persiste e nunca quebra sem storage', async () => {
  const previous = globalThis.chrome;
  try {
    globalThis.chrome = undefined;
    assert.equal(await recordLookup('word'), 0);
    const store = {};
    globalThis.chrome = { storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) } } };
    assert.equal(await recordLookup('word', 5000), 1);
    assert.equal(store[LOOKUP_KEY].word.n, 1);
    globalThis.chrome = { storage: { local: { get: async () => { throw new Error('x'); }, set: async () => {} } } };
    assert.equal(await recordLookup('word'), 0);
  } finally {
    globalThis.chrome = previous;
  }
});

test('contrato: aviso desligado por padrão, só em palavra não salva, com opção nas configurações', async () => {
  const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
  const [popup, panel, storage, engine, markup, manifest] = await Promise.all([
    '../content/word-popup.js', '../content/settings-panel.js', '../content/settings-panel/storage.js',
    '../content/subtitle-engine.js', '../content/settings-panel/markup.js', '../manifest.json',
  ].map(read));
  assert.ok(panel.includes('smartLookupHint: false'));
  assert.ok(storage.includes("'smartLookupHint'"));
  assert.ok(engine.includes('this.smartLookupHint = false'));
  assert.ok(engine.includes("getSetting('smartLookupHint')"));
  assert.ok(popup.includes('if (!this.engine?.smartLookupHint) return;'));
  assert.ok(popup.includes('savedWords?.has?.(key) || this.engine.knownWords?.has?.(key)'));
  assert.ok(markup.includes('sel-smart-lookup'));
  assert.ok(manifest.includes('content/subtitles/lookup-memory.js'));
});
