// tests/modular-subtitles-contract.test.mjs — Teste de contrato da decomposição modular do motor de legendas
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTrustedSubtitleBridgeMessage,
  computeDockResponsiveClass,
  applyDockResponsiveClass,
  SubtitleEngine,
} from '../content/subtitle-engine.js';
import { parseVTT } from '../content/subtitles/vtt-parser.js';
import { setupPlayerHotkeys } from '../content/subtitles/player-hotkeys.js';
import {
  isTrustedSubtitleBridgeMessage as bridgeFn,
  SUBTITLE_BRIDGE_TYPES,
  MAX_SUBTITLE_PAYLOAD_BYTES,
} from '../content/subtitles/bridge-security.js';
import {
  computeDockResponsiveClass as dockComputeFn,
  applyDockResponsiveClass as dockApplyFn,
} from '../content/subtitles/dock-layout.js';

test('Reexportações em subtitle-engine.js preservam identidade de funções públicas', () => {
  assert.equal(isTrustedSubtitleBridgeMessage, bridgeFn);
  assert.equal(computeDockResponsiveClass, dockComputeFn);
  assert.equal(applyDockResponsiveClass, dockApplyFn);
  assert.equal(typeof SubtitleEngine, 'function');
  assert.ok(SUBTITLE_BRIDGE_TYPES.has('LF_SUBTITLE_HOOK'));
  assert.equal(MAX_SUBTITLE_PAYLOAD_BYTES, 5 * 1024 * 1024);
});

test('vtt-parser: parseVTT converte timestamps e remove tags com segurança', () => {
  const vttSample = `WEBVTT

00:00:01.500 --> 00:00:04.200
Hello <c.yellow>world</c>!

00:00:05.000 --> 00:00:08.000
<b>Second</b> cue here.
`;

  const cues = parseVTT(vttSample);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1.5);
  assert.equal(cues[0].end, 4.2);
  assert.equal(cues[0].text, 'Hello world!');
  assert.equal(cues[1].start, 5.0);
  assert.equal(cues[1].end, 8.0);
  assert.equal(cues[1].text, 'Second cue here.');

  // Teste de sanitizador customizado
  const cleaned = parseVTT(vttSample, (t) => t.toUpperCase());
  assert.equal(cleaned[0].text, 'HELLO WORLD!');

  // Casos de borda
  assert.deepEqual(parseVTT(''), []);
  assert.deepEqual(parseVTT(null), []);
});

test('dock-layout: computeDockResponsiveClass e applyDockResponsiveClass classificam larguras', () => {
  assert.equal(dockComputeFn(1920), 'lf-size-normal');
  assert.equal(dockComputeFn(820), 'lf-size-normal');
  assert.equal(dockComputeFn(720), 'lf-size-compact');
  assert.equal(dockComputeFn(500), 'lf-size-mini');
  assert.equal(dockComputeFn(300), 'lf-size-tiny');

  const mockDock = {
    classList: {
      _classes: new Set(),
      toggle(cls, force) {
        if (force) this._classes.add(cls);
        else this._classes.delete(cls);
      },
      contains(cls) {
        return this._classes.has(cls);
      },
    },
  };

  const res = dockApplyFn(mockDock, 400);
  assert.equal(res, 'lf-size-tiny');
  assert.ok(mockDock.classList.contains('lf-size-tiny'));
  assert.ok(!mockDock.classList.contains('lf-size-compact'));
});

test('player-hotkeys: setupPlayerHotkeys intercepta atalhos do teclado e respeita guards', () => {
  let prevCalled = false;
  let nextCalled = false;
  let repeatCalled = false;
  let notifications = [];

  const fakeVideo = { paused: true, play() { this.paused = false; }, pause() { this.paused = true; } };
  const fakeEngine = {
    videoElement: fakeVideo,
    prevSubtitle: () => { prevCalled = true; },
    nextSubtitle: () => { nextCalled = true; },
    repeatSubtitle: () => { repeatCalled = true; },
    _showNotification: (msg) => { notifications.push(msg); },
  };

  // Mock global document e activeElement
  const listeners = [];
  const fakeDocument = {
    activeElement: { tagName: 'BODY', isContentEditable: false },
    addEventListener: (type, fn) => listeners.push(fn),
    removeEventListener: (type, fn) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    querySelector: () => fakeVideo,
  };

  const origDocument = globalThis.document;
  globalThis.document = fakeDocument;

  try {
    const cleanup = setupPlayerHotkeys(fakeEngine);

    // Dispara KeyA
    listeners[0]({ code: 'KeyA', preventDefault() {} });
    assert.equal(prevCalled, true);
    assert.ok(notifications.includes('⏮️ Frase Anterior'));

    // Dispara KeyD
    listeners[0]({ code: 'KeyD', preventDefault() {} });
    assert.equal(nextCalled, true);
    assert.ok(notifications.includes('⏭️ Próxima Frase'));

    // Dispara KeyS
    listeners[0]({ code: 'KeyS', preventDefault() {} });
    assert.equal(repeatCalled, true);
    assert.ok(notifications.includes('🔄 Repetindo (Shadowing)'));

    // Dispara Espaço para Play/Pause
    let spacePrevented = false;
    let spaceStopped = false;
    fakeVideo.paused = true;
    fakeEngine._currentCue = { start: 10, end: 15, text: 'Hello' };
    listeners[0]({
      code: 'Space',
      preventDefault() { spacePrevented = true; },
      stopPropagation() { spaceStopped = true; },
    });
    assert.equal(fakeVideo.paused, false, 'Espaço deve iniciar reprodução quando pausado');
    assert.equal(fakeEngine._lastAutoPausedEndTime, 15, 'Espaço deve marcar cue.end para evitar re-pausa imediata em 16ms');
    assert.ok(notifications.includes('▶️ Play'));
    assert.equal(spacePrevented, true);
    assert.equal(spaceStopped, true);

    // Dispara Espaço novamente (deve pausar)
    listeners[0]({ code: 'Space', preventDefault() {} });
    assert.equal(fakeVideo.paused, true, 'Espaço subsequente deve pausar o vídeo');
    assert.ok(notifications.includes('⏸️ Pause'));

    // Dispara KeyQ (toggle autoPause)
    fakeEngine.autoPause = false;
    fakeEngine._showAutoPauseIndicator = () => {};
    let autoPauseDispatched = false;
    const origDispatch = globalThis.window?.dispatchEvent;
    if (!globalThis.window) globalThis.window = {};
    globalThis.window.dispatchEvent = (ev) => {
      if (ev.type === 'LF_UPDATE_AUTOPAUSE') autoPauseDispatched = true;
    };
    listeners[0]({ code: 'KeyQ', preventDefault() {} });
    assert.equal(fakeEngine.autoPause, true, 'KeyQ deve alternar autoPause');
    assert.equal(autoPauseDispatched, true, 'KeyQ deve despachar LF_UPDATE_AUTOPAUSE');

    // Dispara KeyL (painel de legendas)
    let panelCalled = false;
    fakeEngine.toggleSubtitlePanel = () => { panelCalled = true; };
    listeners[0]({ code: 'KeyL', preventDefault() {} });
    assert.equal(panelCalled, true, 'KeyL deve alternar o painel de legendas');

    // Dispara KeyO (configurações)
    let settingsDispatched = false;
    globalThis.window.dispatchEvent = (ev) => {
      if (ev.type === 'LF_TOGGLE_SETTINGS') settingsDispatched = true;
    };
    listeners[0]({ code: 'KeyO', preventDefault() {} });
    assert.equal(settingsDispatched, true, 'KeyO deve despachar LF_TOGGLE_SETTINGS');

    // Dispara KeyC (toggle legendas)
    let subtitlesToggled = false;
    fakeEngine.toggleSubtitles = () => { subtitlesToggled = true; };
    listeners[0]({ code: 'KeyC', preventDefault() {} });
    assert.equal(subtitlesToggled, true, 'KeyC deve alternar legendas');

    // Dispara KeyR (revisão rápida)
    let reviewDispatched = false;
    globalThis.window.dispatchEvent = (ev) => {
      if (ev.type === 'LF_TOGGLE_REVIEW') reviewDispatched = true;
    };
    listeners[0]({ code: 'KeyR', preventDefault() {} });
    assert.equal(reviewDispatched, true, 'KeyR deve despachar LF_TOGGLE_REVIEW');

    // Restaura window.dispatchEvent
    if (origDispatch) globalThis.window.dispatchEvent = origDispatch;

    // Dispara com modificadores (Ctrl+C, Ctrl+A, Cmd+S não devem disparar atalhos do player)
    subtitlesToggled = false;
    listeners[0]({ code: 'KeyC', ctrlKey: true, preventDefault() {} });
    assert.equal(subtitlesToggled, false, 'Ctrl+C não deve ser capturado pelo atalho de legenda');

    repeatCalled = false;
    listeners[0]({ code: 'KeyS', metaKey: true, preventDefault() {} });
    assert.equal(repeatCalled, false, 'Meta+S não deve ser capturado pelo atalho de repetição');

    // Dispara quando foco está em INPUT (não deve disparar)
    prevCalled = false;
    fakeDocument.activeElement = { tagName: 'INPUT', isContentEditable: false };
    listeners[0]({ code: 'KeyA', preventDefault() {} });
    assert.equal(prevCalled, false, 'Não deve disparar atalho quando usuário digita em input');

    cleanup();
    assert.equal(listeners.length, 0, 'Cleanup deve desregistrar os event listeners');
  } finally {
    globalThis.document = origDocument;
  }
});
