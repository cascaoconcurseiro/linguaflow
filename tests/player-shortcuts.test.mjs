import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { setupPlayerHotkeys } from '../content/subtitles/player-hotkeys.js';
import { SHORTCUT_GROUPS } from '../content/subtitles/shortcuts-help.js';
import { readEngineSource } from './helpers/engine-source.mjs';

function engineWith(overrides = {}) {
  const engine = Object.create(SubtitleEngine.prototype);
  const notes = [];
  Object.assign(engine, {
    isActivated: true,
    translationAnticipation: 0,
    blurSubtitles: false,
    videoElement: { currentTime: 10, paused: false, play() { return Promise.resolve(); }, pause() { this.paused = true; } },
    _showNotification: (m) => notes.push(m),
    _stopLoop() { this._abPoint = null; this.isLooping = false; },
    ...overrides,
  });
  return { engine, notes };
}

async function withDom(fn) {
  const prev = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { dispatchEvent() {}, addEventListener() {} };
  globalThis.document = { getElementById: () => null, querySelector: () => null, createElement: () => ({}) };
  try { return await fn(); } finally { globalThis.window = prev.window; globalThis.document = prev.document; }
}

test('Z/X: sincronia em passos de 0,1 s, limitada a ±2 s e sem erro de ponto flutuante', async () => withDom(() => {
  const { engine, notes } = engineWith();
  assert.equal(engine.nudgeSync(0.1), 0.1);
  assert.equal(engine.nudgeSync(0.1), 0.2);
  assert.equal(engine.nudgeSync(0.1), 0.3, '0.1+0.1+0.1 não vira 0.30000000000000004');
  assert.equal(engine.nudgeSync(-0.1), 0.2);
  engine.translationAnticipation = 2;
  assert.equal(engine.nudgeSync(0.1), 2, 'no limite não passa de +2');
  assert.match(notes.at(-1), /limite/);
  engine.translationAnticipation = -2;
  assert.equal(engine.nudgeSync(-0.1), -2);
  engine.translationAnticipation = 0.1;
  engine.nudgeSync(0.1);
  assert.match(notes.at(-1), /\+0,2 s · legenda mais cedo/);
}));

test('B: laço A–B marca início, marca fim e desfaz; fim muito perto do início é recusado', async () => withDom(() => {
  const started = [];
  const { engine, notes } = engineWith({
    _startPreciseLoopByCue(cue) { started.push(cue); this.isLooping = true; return true; },
  });
  engine.videoElement.currentTime = 12;
  assert.equal(engine.toggleAbLoop(), 'a');
  engine.videoElement.currentTime = 12.2;
  assert.equal(engine.toggleAbLoop(), 'invalid');
  assert.equal(started.length, 0);
  engine.videoElement.currentTime = 15;
  assert.equal(engine.toggleAbLoop(), 'loop');
  assert.deepEqual(started, [{ start: 12, end: 15 }]);
  assert.match(notes.at(-1), /0:12–0:15/);
  assert.equal(engine.toggleAbLoop(), 'off');
  assert.equal(engine.isLooping, false);
  assert.equal(engine._abPoint, null);
  engine.videoElement.currentTime = 20;
  assert.equal(engine.toggleAbLoop(), 'a', 'depois de desfazer, volta a marcar o início');
}));

test('V: escuta primeiro alterna, persiste pelo setSetting e repinta a legenda atual', async () => withDom(() => {
  const rendered = [];
  const { engine, notes } = engineWith({ _lastOrig: 'Hello there', _lastTrans: 'Olá', renderDual: (...a) => rendered.push(a) });
  assert.equal(engine.toggleListenFirst(), true);
  assert.deepEqual(rendered.at(-1), ['Hello there', 'Olá']);
  assert.match(notes.at(-1), /escondida/);
  assert.equal(engine.toggleListenFirst(), false);
}));

test('F e setas: foca a primeira palavra, pausa o vídeo, navega sem passar das pontas e Esc retoma', async () => withDom(() => {
  const mk = () => ({ focused: false, clicked: 0, classList: { contains: (c) => c === 'lf-word' }, focus() { this.focused = true; }, blur() { this.focused = false; }, click() { this.clicked++; } });
  const words = [mk(), mk(), mk()];
  let active = null;
  const shadow = {
    querySelectorAll: () => words,
    get activeElement() { return active; },
  };
  words.forEach((w) => { const f = w.focus; w.focus = function () { f.call(this); active = this; }; });
  const { engine } = engineWith({ shadowContainer: shadow });
  assert.equal(engine.isWordNavActive(), false);
  assert.equal(engine.focusSubtitleWords(), true);
  assert.equal(engine.videoElement.paused, true);
  assert.equal(engine.isWordNavActive(), true);
  engine.moveWordFocus(1); engine.moveWordFocus(1); engine.moveWordFocus(1);
  assert.equal(active, words[2], 'não passa da última palavra');
  engine.moveWordFocus(-5);
  assert.equal(active, words[0], 'não passa da primeira palavra');
  engine.moveWordFocus(1);
  assert.equal(engine.activateFocusedWord(), true);
  assert.equal(words[1].clicked, 1);
  let resumed = false;
  engine.videoElement.play = () => { resumed = true; return Promise.resolve(); };
  engine.leaveWordFocus();
  assert.equal(resumed, true, 'Esc retoma o vídeo que o atalho pausou');
}));

function runHotkeys(engine, events, docExtras = {}) {
  const listeners = [];
  const prev = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { dispatchEvent() {} };
  globalThis.document = {
    activeElement: { tagName: 'BODY' },
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener() {},
    querySelector: () => engine.videoElement,
    getElementById: (id) => docExtras[id] || null,
  };
  try {
    setupPlayerHotkeys(engine);
    for (const event of events) listeners[0]({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...event });
  } finally {
    globalThis.window = prev.window; globalThis.document = prev.document;
  }
}

test('atalhos novos chegam ao motor e só valem com o LF ligado', () => {
  const calls = [];
  const record = (name) => (...a) => calls.push([name, ...a]);
  const engine = {
    isActivated: true,
    videoElement: { paused: false, currentTime: 1 },
    nudgeSync: record('nudge'), toggleAbLoop: record('ab'), toggleListenFirst: record('listen'),
    focusSubtitleWords: record('focus'), showShortcuts: record('help'),
    isWordNavActive: () => false, _showNotification() {},
  };
  runHotkeys(engine, [{ code: 'KeyZ' }, { code: 'KeyX' }, { code: 'KeyB' }, { code: 'KeyV' }, { code: 'KeyF' }, { key: '?', code: 'Slash' }, { code: 'KeyH', key: 'h' }]);
  assert.deepEqual(calls, [['nudge', -0.1], ['nudge', 0.1], ['ab'], ['listen'], ['focus'], ['help'], ['help']]);

  calls.length = 0;
  engine.isActivated = false;
  runHotkeys(engine, [{ code: 'KeyZ' }, { code: 'KeyB' }, { code: 'KeyV' }, { code: 'KeyF' }, { key: '?' }]);
  assert.deepEqual(calls, [], 'desligado, nenhum atalho novo age');
});

test('#454: [ e ] mudam a velocidade em 0,05, só com o LF ligado e sem modificadores; L volta ao YouTube', () => {
  const calls = [];
  const engine = {
    isActivated: true,
    videoElement: { paused: false, currentTime: 1 },
    nudgePlaybackRate: (d) => calls.push(['rate', d]),
    toggleSubtitlePanel: () => calls.push(['panel']),
    isWordNavActive: () => false, _showNotification() {},
  };
  runHotkeys(engine, [{ key: '[', code: 'BracketRight' }, { key: ']', code: 'Backslash' }, { code: 'KeyP', key: 'p' }, { code: 'KeyL', key: 'l' }]);
  assert.deepEqual(calls, [['rate', -0.05], ['rate', 0.05], ['panel']], 'L não pode mais ser interceptado');
  calls.length = 0;
  runHotkeys(engine, [{ key: 'P', code: 'KeyP', shiftKey: true }, { key: '[', ctrlKey: true }]);
  assert.deepEqual(calls, [], 'Shift + P é do YouTube; Ctrl + [ é do sistema');
  engine.isActivated = false;
  runHotkeys(engine, [{ key: '[' }, { key: ']' }, { code: 'KeyP', key: 'p' }]);
  assert.deepEqual(calls, [], 'desligado, nada age');
});

test('com palavra em foco, setas/Enter/Esc são da palavra; com o painel de atalhos aberto, o painel manda', () => {
  const calls = [];
  const engine = {
    isActivated: true,
    videoElement: { paused: true, currentTime: 1 },
    isWordNavActive: () => true,
    moveWordFocus: (n) => calls.push(['move', n]),
    activateFocusedWord: () => calls.push(['open']),
    leaveWordFocus: () => calls.push(['leave']),
    nudgeSync: () => calls.push(['nudge']),
    _showNotification() {},
  };
  runHotkeys(engine, [{ code: 'ArrowRight' }, { code: 'ArrowLeft' }, { code: 'Enter' }, { code: 'Escape' }]);
  assert.deepEqual(calls, [['move', 1], ['move', -1], ['open'], ['leave']]);
  calls.length = 0;
  runHotkeys(engine, [{ code: 'KeyZ' }], { 'lf-shortcuts-help': {} });
  assert.deepEqual(calls, [], 'painel de atalhos aberto bloqueia os atalhos do player');
});

test('contrato: toda tecla da lista de atalhos existe no código e o painel está no manifesto', async () => {
  const hotkeys = await readFile(new URL('../content/subtitles/player-hotkeys.js', import.meta.url), 'utf8');
  const codes = { A: 'KeyA', S: 'KeyS', D: 'KeyD', B: 'KeyB', F: 'KeyF', P: 'KeyP', Q: 'KeyQ', V: 'KeyV', M: 'KeyM', R: 'KeyR', Z: 'KeyZ', X: 'KeyX', O: 'KeyO', C: 'KeyC', 'Espaço': 'Space', 'Shift + ?': "'?'", '[': "'['", ']': "']'" };
  const keys = SHORTCUT_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  for (const key of keys) {
    assert.ok(codes[key], `tecla ${key} sem mapeamento no teste`);
    assert.ok(hotkeys.includes(codes[key]), `${key} listada na ajuda mas ausente em player-hotkeys.js`);
  }
  const manifest = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
  assert.match(manifest, /content\/subtitles\/shortcuts-help\.js/);
  const settings = await readFile(new URL('../content/settings-panel.js', import.meta.url), 'utf8');
  for (const event of ['LF_UPDATE_ANTICIPATION', 'LF_UPDATE_AUTOPAUSE', 'LF_UPDATE_BLUR']) {
    assert.match(settings, new RegExp(`addEventListener\\('${event}'`), `painel precisa espelhar ${event}`);
  }
  assert.doesNotMatch(hotkeys + await readEngineSource(), /saveSetting/, 'db.saveSetting não existe; use setSetting');
});

test('#439: aviso ao ligar e lista de atalhos mostram Shift + ?', async () => {
  const keys = SHORTCUT_GROUPS.flatMap((g) => g.items.map(([k]) => k));
  assert.ok(keys.includes('Shift + ?'), 'lista deve mostrar Shift + ?');
  assert.ok(!keys.includes('?'), 'lista não pode mostrar ? sem o Shift');
  const engineSrc = await readEngineSource();
  assert.match(engineSrc, /LinguaFlow ligado · Shift \+ \? mostra os atalhos/);
});
