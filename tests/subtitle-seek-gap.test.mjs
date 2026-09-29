// tests/subtitle-seek-gap.test.mjs — Issue #361: pular o vídeo para um trecho
// sem fala precisa limpar a legenda anterior, tocando ou pausado.
import assert from 'node:assert/strict';
import test from 'node:test';

const cues = [
  { start: 1.64, end: 5.0, text: 'Enjoy life, man.' },
  { start: 5.0, end: 7.914, text: 'Make her' },
  { start: 10.4, end: 14.465, text: "I'm getting" },
  { start: 48.0, end: 50.0, text: 'Good morning, everyone.' },
];

async function mountEngine() {
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const listeners = {};
  let frame = null;
  const vid = {
    currentTime: 0,
    paused: false,
    readyState: 4,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    requestVideoFrameCallback: (fn) => { frame = fn; return 1; },
    cancelVideoFrameCallback: () => {},
  };
  globalThis.document = { querySelector: (s) => (s === 'video' ? vid : null), getElementById: () => null, hidden: false };
  let firstInterval = true;
  globalThis.setInterval = (fn) => { if (firstInterval) { firstInterval = false; fn(); } return 1; };
  globalThis.clearInterval = () => {};
  globalThis.setTimeout = () => 0;

  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, { platform: 'youtube', isActivated: false, videoElement: vid, lastText: '', cues: [], xhrCues: [] });
  engine._injectSubtitleUI = async () => {};
  engine._injectYouTubeControls = () => {};
  engine._ensureNativeSubtitlesActive = () => {};
  engine._syncYouTubeNativeCaptions = () => {};
  const screen = { text: '' };
  engine.onSubtitle = (cue) => { engine._currentCue = cue; screen.text = cue.text; };
  engine.renderDual = (text) => { screen.text = text; };
  engine._waitForVideo();
  engine.xhrCues = cues;
  engine._startSyncLoop();

  const tick = (t) => { vid.currentTime = t; frame(0, { mediaTime: t }); return screen.text; };
  const seek = (t) => { listeners.seeking(); return tick(t); };
  return { vid, tick, seek };
}

const saved = {
  document: globalThis.document,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
};
test.afterEach(() => Object.assign(globalThis, saved));

test('reprodução normal atravessando um silêncio limpa a legenda', async () => {
  const { tick } = await mountEngine();
  assert.equal(tick(5.5), 'Make her');
  assert.equal(tick(9), '');
});

test('seek tocando para um trecho sem fala limpa a legenda anterior', async () => {
  const { tick, seek } = await mountEngine();
  assert.equal(tick(5.5), 'Make her');
  assert.equal(seek(30), '', 'a fala de 0:05 não pode continuar na tela em 0:30');
  assert.equal(tick(31), '');
  assert.equal(tick(48.5), 'Good morning, everyone.');
});

test('seek pausado para um trecho sem fala limpa a legenda anterior', async () => {
  const { vid, tick, seek } = await mountEngine();
  assert.equal(tick(5.5), 'Make her');
  vid.paused = true;
  assert.equal(seek(30), '');
  assert.equal(seek(11), "I'm getting", 'seek pausado para outra fala continua trocando a legenda');
});
