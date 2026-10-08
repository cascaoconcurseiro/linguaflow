import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, loadPrefs, savePrefs, stepPref, normalizePrefs } from '../dashboard/js/core/coursePrefs.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

test('padrões quando não há nada salvo ou o JSON está corrompido', () => {
  assert.deepEqual(loadPrefs(memoryStorage()), DEFAULT_PREFS);
  const bad = { getItem: () => '{oops', setItem() {} };
  assert.deepEqual(loadPrefs(bad), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs({ getItem() { throw new Error('blocked'); } }), DEFAULT_PREFS);
});

test('salva e recarrega; valores fora da faixa são ajustados ao passo', () => {
  const st = memoryStorage();
  savePrefs({ ...DEFAULT_PREFS, readings: 12, speed: 1.3, audio: false }, st);
  assert.deepEqual(loadPrefs(st), { ...DEFAULT_PREFS, readings: 8, speed: 1.25, audio: false });
  assert.equal(normalizePrefs({ speed: 0.1 }).speed, 0.5);
  assert.equal(normalizePrefs({ readings: 0 }).readings, 1);
});

test('botões de mais/menos andam no passo e param nos limites', () => {
  let p = { ...DEFAULT_PREFS };
  p = stepPref(p, 'speed', +1); assert.equal(p.speed, 1.25);
  p = stepPref(p, 'speed', -1); p = stepPref(p, 'speed', -1); assert.equal(p.speed, 0.75);
  for (let i = 0; i < 10; i++) p = stepPref(p, 'speed', -1);
  assert.equal(p.speed, 0.5);
  for (let i = 0; i < 20; i++) p = stepPref(p, 'readings', +1);
  assert.equal(p.readings, 8);
});

test('explain: padrão desligado, aceita só booleano e persiste', () => {
  assert.equal(DEFAULT_PREFS.explain, false);
  assert.equal(normalizePrefs({ explain: 'sim' }).explain, false);
  assert.equal(normalizePrefs({ explain: true }).explain, true);
  const st = memoryStorage();
  savePrefs({ ...DEFAULT_PREFS, explain: true }, st);
  assert.equal(loadPrefs(st).explain, true);
});
