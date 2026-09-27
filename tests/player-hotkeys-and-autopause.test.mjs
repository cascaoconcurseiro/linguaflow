// tests/player-hotkeys-and-autopause.test.mjs — Testes de regressão para atalhos do player e auto-pause
import assert from 'node:assert/strict';
import test from 'node:test';
import { setupPlayerHotkeys } from '../content/subtitles/player-hotkeys.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';

test('Player Hotkeys: cobertura integral de atalhos e prevenção de double-pause', async (t) => {
  await t.test('Espaço alterna play/pause e sincroniza _lastAutoPausedEndTime', () => {
    let playCount = 0;
    let pauseCount = 0;
    const fakeVideo = {
      paused: true,
      play() { this.paused = false; playCount++; return Promise.resolve(); },
      pause() { this.paused = true; pauseCount++; },
    };

    const notifications = [];
    const fakeEngine = {
      videoElement: fakeVideo,
      _currentCue: { start: 5, end: 8, text: 'Test subtitle' },
      _lastAutoPausedEndTime: -1,
      _showNotification: (msg) => notifications.push(msg),
    };

    const listeners = [];
    const origDocument = globalThis.document;
    globalThis.document = {
      activeElement: { tagName: 'BODY', isContentEditable: false },
      addEventListener: (type, fn) => listeners.push(fn),
      removeEventListener: (type, fn) => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      querySelector: () => fakeVideo,
      getElementById: () => null,
    };

    try {
      const cleanup = setupPlayerHotkeys(fakeEngine);
      assert.equal(listeners.length, 1);

      // 1. Vídeo está pausado -> pressiona Espaço -> dá Play
      let prevented = false;
      let stopped = false;
      let immediateStopped = false;
      listeners[0]({
        code: 'Space',
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; },
        stopImmediatePropagation: () => { immediateStopped = true; },
      });

      assert.equal(fakeVideo.paused, false);
      assert.equal(playCount, 1);
      assert.equal(fakeEngine._lastAutoPausedEndTime, 8, 'Marca cue.end para não re-pausar no syncLoop nos próximos 16ms');
      assert.equal(prevented, true);
      assert.equal(stopped, true);
      assert.equal(immediateStopped, true);
      assert.ok(notifications.includes('▶️ Play'));

      // 2. Vídeo está tocando -> pressiona Espaço -> dá Pause
      listeners[0]({
        code: 'Space',
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {},
      });

      assert.equal(fakeVideo.paused, true);
      assert.equal(pauseCount, 1);
      assert.ok(notifications.includes('⏸️ Pause'));

      // 3. Funciona com key === ' ' além de code === 'Space'
      listeners[0]({
        key: ' ',
        preventDefault: () => {},
        stopPropagation: () => {},
        stopImmediatePropagation: () => {},
      });
      assert.equal(fakeVideo.paused, false);
      assert.equal(playCount, 2);

      cleanup();
      assert.equal(listeners.length, 0);
    } finally {
      globalThis.document = origDocument;
    }
  });

  await t.test('Atalhos A, S, D, Q, L, O, C, R disparam ações correspondentes', () => {
    let prev = false;
    let repeat = false;
    let next = false;
    let panel = false;
    let subs = false;
    let settingsEvt = false;
    let reviewEvt = false;
    let autoPauseEvt = false;

    const fakeVideo = { paused: false, play() {}, pause() {} };
    const fakeEngine = {
      videoElement: fakeVideo,
      autoPause: false,
      prevSubtitle: () => { prev = true; },
      repeatSubtitle: () => { repeat = true; },
      nextSubtitle: () => { next = true; },
      toggleSubtitlePanel: () => { panel = true; },
      toggleSubtitles: () => { subs = true; },
      _showNotification: () => {},
      _showAutoPauseIndicator: () => {},
    };

    const listeners = [];
    const origDocument = globalThis.document;
    const origWindow = globalThis.window;

    globalThis.document = {
      activeElement: { tagName: 'BODY', isContentEditable: false },
      addEventListener: (type, fn) => listeners.push(fn),
      removeEventListener: (type, fn) => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      querySelector: () => fakeVideo,
      getElementById: () => null,
    };

    globalThis.window = {
      dispatchEvent: (e) => {
        if (e.type === 'LF_TOGGLE_SETTINGS') settingsEvt = true;
        if (e.type === 'LF_TOGGLE_REVIEW') reviewEvt = true;
        if (e.type === 'LF_UPDATE_AUTOPAUSE') autoPauseEvt = true;
      },
    };

    try {
      const cleanup = setupPlayerHotkeys(fakeEngine);

      // A
      listeners[0]({ code: 'KeyA', preventDefault() {} });
      assert.equal(prev, true);

      // S
      listeners[0]({ code: 'KeyS', preventDefault() {} });
      assert.equal(repeat, true);

      // D
      listeners[0]({ code: 'KeyD', preventDefault() {} });
      assert.equal(next, true);

      // Q
      listeners[0]({ code: 'KeyQ', preventDefault() {} });
      assert.equal(fakeEngine.autoPause, true);
      assert.equal(autoPauseEvt, true);

      // L
      listeners[0]({ code: 'KeyL', preventDefault() {} });
      assert.equal(panel, true);

      // O
      listeners[0]({ code: 'KeyO', preventDefault() {} });
      assert.equal(settingsEvt, true);

      // C
      listeners[0]({ code: 'KeyC', preventDefault() {} });
      assert.equal(subs, true);

      // R
      listeners[0]({ code: 'KeyR', preventDefault() {} });
      assert.equal(reviewEvt, true);

      // Teclas minúsculas (fallback e.key)
      prev = false;
      listeners[0]({ key: 'a', preventDefault() {} });
      assert.equal(prev, true);

      repeat = false;
      listeners[0]({ key: 's', preventDefault() {} });
      assert.equal(repeat, true);

      cleanup();
    } finally {
      globalThis.document = origDocument;
      globalThis.window = origWindow;
    }
  });

  await t.test('Guarda de modificadores e overlays', () => {
    let triggered = false;
    const fakeVideo = { paused: true, play() { triggered = true; }, pause() {} };
    const fakeEngine = {
      videoElement: fakeVideo,
      prevSubtitle: () => { triggered = true; },
      _showNotification: () => {},
    };

    const listeners = [];
    const origDocument = globalThis.document;

    let reviewVisible = false;
    globalThis.document = {
      activeElement: { tagName: 'BODY', isContentEditable: false },
      addEventListener: (type, fn) => listeners.push(fn),
      removeEventListener: (type, fn) => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      querySelector: () => fakeVideo,
      getElementById: (id) => {
        if (id === 'lf-review-overlay' && reviewVisible) {
          return { style: { display: 'block' } };
        }
        return null;
      },
    };

    try {
      const cleanup = setupPlayerHotkeys(fakeEngine);

      // Ctrl + A não deve acionar prevSubtitle
      triggered = false;
      listeners[0]({ code: 'KeyA', ctrlKey: true, preventDefault() {} });
      assert.equal(triggered, false);

      // Meta + S não deve acionar repeatSubtitle
      triggered = false;
      listeners[0]({ code: 'KeyS', metaKey: true, preventDefault() {} });
      assert.equal(triggered, false);

      // Alt + D não deve acionar nextSubtitle
      triggered = false;
      listeners[0]({ code: 'KeyD', altKey: true, preventDefault() {} });
      assert.equal(triggered, false);

      // Quando ReviewOverlay está visível, Espaço é ignorado pelo player
      reviewVisible = true;
      triggered = false;
      listeners[0]({ code: 'Space', preventDefault() {} });
      assert.equal(triggered, false, 'Player não deve interceptar Espaço se ReviewOverlay estiver aberto');

      cleanup();
    } finally {
      globalThis.document = origDocument;
    }
  });
});

test('SubtitleEngine: repeatSubtitle resiliente a tempo logo após fim de frase', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, {
    _lastFoundIdx: -1,
    _lastAutoPausedEndTime: 99,
    _currentCue: null,
    currentCueIndex: -1,
  });

  let played = false;
  let seekTime = -1;

  engine.videoElement = {
    currentTime: 10.5,
    play: () => { played = true; return Promise.resolve(); },
    set currentTime(val) { seekTime = val; },
    get currentTime() { return seekTime >= 0 ? seekTime : 10.5; },
  };

  engine.cues = [
    { start: 0, end: 4, text: 'Hello' },
    { start: 5, end: 10, text: 'How are you today?' },
    { start: 15, end: 20, text: 'Goodbye' },
  ];

  // Simula momento logo após o fim da frase (currentTime = 10.5, _currentCue = null)
  engine.repeatSubtitle();

  assert.equal(played, true, 'Deve dar play na repetição');
  assert.equal(seekTime, 5, 'Deve voltar para o início da frase que acabou de terminar (start: 5)');
  assert.equal(engine._lastAutoPausedEndTime, -1, 'Deve resetar _lastAutoPausedEndTime');
});
