import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isEditableTarget } from '../utils/dom-events.js';

test('isEditableTarget: detecção de campos de digitação', async (t) => {
  await t.test('retorna false para elementos normais não editáveis', () => {
    const div = { nodeType: 1, tagName: 'DIV', isContentEditable: false };
    const event = { target: div, composedPath: () => [div] };
    assert.equal(isEditableTarget(event), false);
  });

  await t.test('retorna true para INPUT, TEXTAREA e SELECT convencionais', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      const el = { nodeType: 1, tagName: tag, isContentEditable: false };
      const event = { target: el, composedPath: () => [el] };
      assert.equal(isEditableTarget(event), true);
    }
  });

  await t.test('retorna true para elemento com isContentEditable', () => {
    const el = { nodeType: 1, tagName: 'DIV', isContentEditable: true };
    const event = { target: el, composedPath: () => [el] };
    assert.equal(isEditableTarget(event), true);
  });

  await t.test('atravessa o Shadow DOM via composedPath quando target é o Custom Element host', () => {
    // Simula YouTube Searchbox: target é <YTD-SEARCHBOX>, mas o input real está no composedPath
    const shadowInput = { nodeType: 1, tagName: 'INPUT', isContentEditable: false };
    const hostElement = {
      nodeType: 1,
      tagName: 'YTD-SEARCHBOX',
      isContentEditable: false,
      shadowRoot: { activeElement: shadowInput },
    };
    const event = {
      target: hostElement,
      composedPath: () => [shadowInput, hostElement],
    };
    assert.equal(isEditableTarget(event), true);
  });

  await t.test('retorna true quando shadowRoot do activeElement possui input focado', () => {
    const shadowInput = { nodeType: 1, tagName: 'INPUT', isContentEditable: false };
    const hostElement = {
      nodeType: 1,
      tagName: 'YTD-COMMENTS',
      isContentEditable: false,
      shadowRoot: { activeElement: shadowInput },
    };
    const event = { target: hostElement, composedPath: () => [hostElement] };
    assert.equal(isEditableTarget(event), true);
  });
});

test('Contratos de atalhos e Shadow DOM nos scripts de conteúdo', async (t) => {
  const [indexSrc, hotkeysSrc, reviewOverlaySrc] = await Promise.all([
    readFile(new URL('../content/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../content/subtitles/player-hotkeys.js', import.meta.url), 'utf8'),
    readFile(new URL('../content/review-overlay.js', import.meta.url), 'utf8'),
  ]);

  await t.test('player-hotkeys.js usa isEditableTarget para proteger digitação em shadow DOM', () => {
    assert.match(hotkeysSrc, /isEditableTarget/);
  });

  await t.test('content/index.js usa isEditableTarget no atalho de tecla R', () => {
    assert.match(indexSrc, /isEditableTarget/);
  });

  await t.test('content/review-overlay.js usa isEditableTarget no keydown', () => {
    assert.match(reviewOverlaySrc, /isEditableTarget/);
  });
});

test('Contrato do PWA Shell: updateGlobalStats sem Dead DOM', async (t) => {
  const appSrc = await readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8');

  await t.test('não busca elementos inexistentes streak-val ou due-val', () => {
    assert.doesNotMatch(appSrc, /getElementById\(['"]streak-val['"]\)/);
    assert.doesNotMatch(appSrc, /getElementById\(['"]due-val['"]\)/);
  });
});
