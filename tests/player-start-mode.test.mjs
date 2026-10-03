import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  START_MODES,
  normalizeStartMode,
  resolveInitialActivation,
  saveActivation,
  loadStoredActivation,
  SESSION_KEY,
  REMEMBER_KEY,
} from '../content/subtitles/activation-state.js';
import { setupPlayerHotkeys } from '../content/subtitles/player-hotkeys.js';

test('padrão: desligado; só liga se o usuário ligou nesta sessão do navegador', () => {
  for (const platform of ['youtube', 'max']) {
    assert.equal(resolveInitialActivation({ platform }), false);
    assert.equal(resolveInitialActivation({ platform, startMode: 'session', sessionValue: true }), true);
    assert.equal(resolveInitialActivation({ platform, startMode: 'session', rememberedValue: true }), false);
  }
});

test('cada modo respeita sua regra', () => {
  const base = { platform: 'youtube', sessionValue: true, rememberedValue: true };
  assert.equal(resolveInitialActivation({ ...base, startMode: START_MODES.OFF }), false);
  assert.equal(resolveInitialActivation({ ...base, startMode: START_MODES.ON, sessionValue: false }), true);
  assert.equal(resolveInitialActivation({ ...base, startMode: START_MODES.REMEMBER, sessionValue: false }), true);
  assert.equal(resolveInitialActivation({ ...base, startMode: START_MODES.REMEMBER, rememberedValue: false }), false);
  assert.equal(normalizeStartMode('lixo'), 'session');
});

test('todas as plataformas com dock iniciam desligadas; sem botão (genérico) fica ligada', () => {
  for (const platform of ['youtube', 'max', 'netflix', 'disney', 'prime']) {
    assert.equal(resolveInitialActivation({ platform }), false);
  }
  assert.equal(resolveInitialActivation({ platform: 'generic' }), true);
});

test('persistência: sessão em storage.session, "lembrar" em storage.local, falha não quebra', async () => {
  const mk = () => { const d = {}; return { d, get: async (k) => ({ [k]: d[k] }), set: async (o) => Object.assign(d, o) }; };
  const session = mk();
  const local = mk();
  globalThis.chrome = { storage: { session, local } };
  await saveActivation(true);
  assert.equal(session.d[SESSION_KEY], true);
  assert.equal(local.d[REMEMBER_KEY], true);
  assert.deepEqual(await loadStoredActivation(), { sessionValue: true, rememberedValue: true });

  globalThis.chrome = { storage: { session: { get: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); } } } };
  await saveActivation(true);
  assert.deepEqual(await loadStoredActivation(), { sessionValue: undefined, rememberedValue: undefined });
  delete globalThis.chrome;
});

test('desligado: atalhos A/S/D/Q/L/O/Espaço voltam ao player; C continua ligando', () => {
  const calls = [];
  const video = { paused: true, play() { calls.push('play'); return Promise.resolve(); }, pause() {} };
  const engine = {
    isActivated: false,
    videoElement: video,
    prevSubtitle: () => calls.push('prev'),
    repeatSubtitle: () => calls.push('repeat'),
    nextSubtitle: () => calls.push('next'),
    toggleSubtitlePanel: () => calls.push('panel'),
    userToggleSubtitles: () => { calls.push('toggle'); engine.isActivated = true; },
    _showNotification() {},
    _showAutoPauseIndicator() {},
  };
  const listeners = [];
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  globalThis.document = {
    activeElement: { tagName: 'BODY' },
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener() {},
    querySelector: () => video,
    getElementById: () => null,
  };
  globalThis.window = { dispatchEvent: (e) => calls.push(e.type) };
  try {
    setupPlayerHotkeys(engine);
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyL', 'KeyO', 'Space']) {
      listeners[0]({ code, preventDefault() { calls.push('prevented'); } });
    }
    assert.deepEqual(calls, [], 'nada deve ser interceptado com o LF desligado');
    listeners[0]({ code: 'KeyC', preventDefault() {} });
    assert.deepEqual(calls, ['toggle']);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('contrato: docks escondem controles quando desligado e só o clique persiste', async () => {
  const engineSrc = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
  const maxSrc = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
  assert.match(engineSrc, /#lf-yt-horizontal-dock\.lf-off > :not\(\.lf-dock-toggle\)/);
  assert.match(maxSrc, /#lf-max-controls\.lf-off>:not\(\.lf-dock-toggle\)/);
  assert.match(engineSrc, /userToggleSubtitles\(forceState = null\)[\s\S]*saveActivation/);
  assert.doesNotMatch(engineSrc, /lf_sub_visible/);
  const settings = await readFile(new URL('../content/settings-panel.js', import.meta.url), 'utf8');
  assert.match(settings, /id="sel-start-mode"/);
  const sw = await readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8');
  assert.match(sw, /storage\.session\?\.setAccessLevel/);
  const manifest = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
  assert.match(manifest, /content\/subtitles\/activation-state\.js/);
});

test('desligado: onSubtitle não traduz nem indexa; ao ligar a fala reaparece (#420)', async () => {
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = false;
  engine._currentCue = { text: 'x' };
  let sent = 0;
  globalThis.chrome = { runtime: { sendMessage: () => { sent++; } } };
  engine.onSubtitle({ text: 'hello', start: 1, end: 2 });
  assert.equal(sent, 0);
  assert.equal(engine._currentCue, null, 'zera a fala atual para repintar ao ligar');
  delete globalThis.chrome;
});

test('dock lateral: hosts, deslocamento limitado à tela e arraste sem religar (#423, #424)', async () => {
  const { isDockHost, clampDockOffset } = await import('../content/max-player-ui.js');
  for (const h of ['www.netflix.com', 'www.disneyplus.com', 'www.primevideo.com', 'play.max.com']) assert.equal(isDockHost(h), true);
  assert.equal(isDockHost('example.com'), false);
  assert.equal(clampDockOffset(9999, 800, 200), 292);
  assert.equal(clampDockOffset(-9999, 800, 200), -292);
  assert.equal(clampDockOffset('x', 800), 0);
  const src = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
  assert.match(src, /_justDragged/);
});

test('dica de primeira vez: posição dentro da tela e persistência única (#421)', async () => {
  const { tipPosition } = await import('../content/subtitles/start-tip.js');
  const above = tipPosition({ left: 5, top: 500, width: 40, height: 30 }, { viewportWidth: 1000, placement: 'above' });
  assert.ok(above.left >= 10 && above.top >= 10);
  const edge = tipPosition({ left: 990, top: 500, width: 40, height: 30 }, { viewportWidth: 1000, placement: 'above' });
  assert.ok(edge.left + 260 <= 1000);
  const left = tipPosition({ left: 900, top: 400, width: 44, height: 46 }, { viewportWidth: 1000, placement: 'left' });
  assert.ok(left.left + 260 < 900);
  const popup = await readFile(new URL('../popup/popup.js', import.meta.url), 'utf8');
  assert.match(popup, /LF_TOGGLE_SETTINGS/);
  const html = await readFile(new URL('../popup/popup.html', import.meta.url), 'utf8');
  assert.match(html, /id="btn-player-settings"/);
});

test('atalhos funcionam com a revisão rápida escondida por CSS (#425)', () => {
  const calls = [];
  const video = { paused: true, play() { return Promise.resolve(); }, pause() {} };
  const engine = {
    isActivated: true,
    videoElement: video,
    prevSubtitle: () => calls.push('prev'),
    _showNotification() {},
  };
  const listeners = [];
  const prev = { document: globalThis.document, window: globalThis.window, getComputedStyle: globalThis.getComputedStyle };
  const overlay = { style: { display: '' } }; // escondido só pela folha de estilo
  let computed = 'none';
  globalThis.getComputedStyle = () => ({ display: computed });
  globalThis.document = {
    activeElement: { tagName: 'BODY' },
    addEventListener: (_, fn) => listeners.push(fn),
    removeEventListener() {},
    querySelector: () => video,
    getElementById: (id) => (id === 'lf-review-overlay' ? overlay : null),
  };
  globalThis.window = { dispatchEvent() {} };
  try {
    setupPlayerHotkeys(engine);
    listeners[0]({ code: 'KeyA', preventDefault() {} });
    assert.deepEqual(calls, ['prev'], 'revisão escondida não bloqueia atalhos');
    computed = 'block'; // revisão aberta: ela fica com as teclas
    listeners[0]({ code: 'KeyA', preventDefault() {} });
    assert.deepEqual(calls, ['prev']);
  } finally {
    globalThis.document = prev.document;
    globalThis.window = prev.window;
    if (prev.getComputedStyle) globalThis.getComputedStyle = prev.getComputedStyle; else delete globalThis.getComputedStyle;
  }
});
