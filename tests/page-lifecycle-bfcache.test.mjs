import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { SettingsPanel } from '../content/settings-panel.js';
import { WordPopup } from '../content/word-popup.js';
import { ReviewOverlay } from '../content/review-overlay.js';

test('pagehide para o cache de voltar/avançar não destrói o engine; saída de verdade destrói', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  let destroyed = 0;
  engine.destroy = () => { destroyed += 1; };

  engine._onPageHide({ persisted: true });
  assert.equal(destroyed, 0, 'página que pode ser restaurada continua viva');

  engine._onPageHide({ persisted: false });
  assert.equal(destroyed, 1);

  engine._onPageHide(undefined);
  assert.equal(destroyed, 2, 'sem evento, trata como saída de verdade');
});

test('SettingsPanel.destroy remove os listeners globais e o painel', () => {
  const panel = Object.create(SettingsPanel.prototype);
  panel._abort = new AbortController();
  let removed = 0;
  panel.host = { remove: () => { removed += 1; } };

  panel.destroy();
  assert.equal(panel._abort.signal.aborted, true);
  assert.equal(removed, 1);
});

test('WordPopup.destroy remove o listener de mousedown do documento', () => {
  const previous = { document: globalThis.document, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const removedEvents = [];
  globalThis.document = {
    removeEventListener: (type, handler, capture) => removedEvents.push({ type, handler, capture }),
  };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const popup = Object.create(WordPopup.prototype);
    popup._mousedownHandler = () => {};
    popup._keydownHandler = () => {};
    popup.popup = { remove() {} };
    popup.destroy();
    const types = removedEvents.map((event) => event.type).sort();
    assert.deepEqual(types, ['keydown', 'mousedown']);
    assert.equal(removedEvents.find((event) => event.type === 'mousedown').handler, popup._mousedownHandler);
  } finally {
    globalThis.document = previous.document;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
  }
});

test('ReviewOverlay.toggle: R apertado duas vezes abre uma única vez', async () => {
  const overlay = Object.create(ReviewOverlay.prototype);
  overlay.visible = false;
  let loads = 0;
  let shows = 0;
  overlay._loadCards = () => {
    loads += 1;
    return new Promise((resolve) => setTimeout(resolve, 10));
  };
  overlay.show = () => { shows += 1; overlay.visible = true; };
  overlay.hide = () => { overlay.visible = false; };

  overlay.toggle();
  overlay.toggle();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(loads, 1, 'segunda tecla durante o carregamento é ignorada');
  assert.equal(shows, 1);

  overlay.toggle(); // aberto: fecha
  assert.equal(overlay.visible, false);
  overlay.toggle(); // pode abrir de novo depois de terminar
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(shows, 2);
});

test('contrato: index.js e web-reader só desmontam quando a página não é persistida', async () => {
  const [index, reader] = await Promise.all([
    readFile(new URL('../content/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../content/web-reader.js', import.meta.url), 'utf8'),
  ]);
  assert.match(index, /pagehide[\s\S]*?if \(event\.persisted\) return;[\s\S]*?settingsPanel\.destroy\(\)/);
  assert.match(index, /lifecycle\.abort\(\)/);
  assert.match(reader, /pagehide', \(event\) => \{\s*if \(!event\.persisted\) dispose\(\);/);
  assert.doesNotMatch(reader, /pagehide', dispose, \{ once: true \}/);
});
