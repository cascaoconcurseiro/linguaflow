// Modo shadowing (#456): lógica pura + contratos de fiação (atalho M, dock, lista de atalhos, manifesto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  shadowContext, shadowProgress, readShadowPref, writeShadowPref, SHADOW_STORAGE_KEY, SHADOW_CSS,
} from '../content/subtitles/shadow-mode.js';
import { SHORTCUT_GROUPS } from '../content/subtitles/shortcuts-help.js';
import { setupPlayerHotkeys } from '../content/subtitles/player-hotkeys.js';
import { readEngineSource } from './helpers/engine-source.mjs';

const cues = [
  { start: 0, end: 2, text: 'one' },
  { start: 2, end: 4, text: 'two' },
  { start: 4, end: 6, text: 'three' },
];

test('contexto: anterior, atual e próxima; bordas ficam vazias e nunca passa de 3 linhas', () => {
  assert.deepEqual(shadowContext(cues, 1), { prev: 'one', current: 'two', next: 'three' });
  assert.deepEqual(shadowContext(cues, 0), { prev: '', current: 'one', next: 'two' });
  assert.deepEqual(shadowContext(cues, 2), { prev: 'two', current: 'three', next: '' });
  assert.deepEqual(shadowContext(cues, -1), { prev: '', current: '', next: '' });
  assert.deepEqual(shadowContext([], 0), { prev: '', current: '', next: '' });
  assert.deepEqual(shadowContext(null, 0), { prev: '', current: '', next: '' });
});

test('contexto: pula falas vazias e limpa espaços', () => {
  const list = [{ start: 0, end: 1, text: ' a ' }, { start: 1, end: 2, text: '  ' }, { start: 2, end: 3, text: 'b' }];
  assert.deepEqual(shadowContext(list, 0), { prev: '', current: 'a', next: 'b' });
  assert.deepEqual(shadowContext(list, 2), { prev: 'a', current: 'b', next: '' });
});

test('progresso: 0 a 1, preso ao intervalo da fala e seguro contra cue inválida', () => {
  assert.equal(shadowProgress({ start: 10, end: 14 }, 12), 0.5);
  assert.equal(shadowProgress({ start: 10, end: 14 }, 9), 0);
  assert.equal(shadowProgress({ start: 10, end: 14 }, 99), 1);
  assert.equal(shadowProgress({ start: 10, end: 10 }, 10), 0);
  assert.equal(shadowProgress(null, 5), 0);
  assert.equal(shadowProgress({ start: 1, end: 2 }, Number.NaN), 0);
});

test('preferência: desligado por padrão, grava e lê, e tolera storage quebrado', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(readShadowPref(storage), false);
  writeShadowPref(storage, true);
  assert.equal(mem.get(SHADOW_STORAGE_KEY), '1');
  assert.equal(readShadowPref(storage), true);
  writeShadowPref(storage, false);
  assert.equal(readShadowPref(storage), false);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(readShadowPref(broken), false);
  assert.doesNotThrow(() => writeShadowPref(broken, true));
  assert.equal(readShadowPref(undefined), false);
});

test('CSS: movimento só com transform/opacity e respeita prefers-reduced-motion', () => {
  assert.match(SHADOW_CSS, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(SHADOW_CSS, /transition:[^;}]*(top|left|height|width|margin)/);
});

function runKeys(engine, events) {
  const listeners = [];
  const prev = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { dispatchEvent() {} };
  globalThis.document = {
    activeElement: { tagName: 'BODY' },
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener() {},
    querySelector: () => engine.videoElement,
    getElementById: () => null,
  };
  try {
    setupPlayerHotkeys(engine);
    for (const e of events) listeners[0]({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e });
  } finally {
    globalThis.window = prev.window; globalThis.document = prev.document;
  }
}

test('atalho M alterna o shadowing só com o LinguaFlow ligado e sem modificadores', () => {
  const calls = [];
  const engine = { isActivated: true, videoElement: { paused: false }, toggleShadowMode: () => calls.push('shadow'), isWordNavActive: () => false, _showNotification() {} };
  runKeys(engine, [{ code: 'KeyM', key: 'm' }, { code: 'KeyM', key: 'M', ctrlKey: true }]);
  assert.deepEqual(calls, ['shadow']);
  engine.isActivated = false;
  runKeys(engine, [{ code: 'KeyM', key: 'm' }]);
  assert.deepEqual(calls, ['shadow'], 'desligado, M volta ao player nativo (mudo)');
});

test('contrato: M na lista de atalhos, módulo no manifesto, botão no dock e motor com os ganchos', async () => {
  const keys = SHORTCUT_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  assert.ok(keys.includes('M'), 'lista de atalhos precisa mostrar M');
  const manifest = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
  assert.match(manifest, /content\/subtitles\/shadow-mode\.js/);
  const src = await readEngineSource();
  assert.match(src, /data-action="shadow"/);
  assert.match(src, /toggleShadowMode\(\)/);
  assert.match(src, /from '\.\/subtitles\/shadow-mode\.js'/);
  assert.match(src, /id="lf-shadow-prev"[^>]*aria-hidden="true"/);
  assert.match(src, /id="lf-shadow-next"[^>]*aria-hidden="true"/);
});

test('#458: o dock lateral (Netflix, Max, Disney+, Prime) também tem o botão de shadowing, ligado ao motor', async () => {
  const ui = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /data-action="shadow"[^>]*aria-pressed="\$\{Boolean\(this\.engine\?\.shadowMode\)\}"/);
  assert.match(ui, /action === 'shadow'[\s\S]{0,200}this\.engine\.toggleShadowMode\(\)/);
  assert.match(ui, /button\[data-action="shadow"\]\[aria-pressed="true"\]/, 'estado ligado precisa de estilo próprio');
});
