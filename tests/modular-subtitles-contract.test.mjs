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
