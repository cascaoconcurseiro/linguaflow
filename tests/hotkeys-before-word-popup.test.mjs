// Atalhos do player prontos assim que o botão LF aparece (#559).
// Antes, o registro esperava o import e o init do WordPopup: durante essa janela o
// botão LF já estava na tela, mas a tecla C não fazia nada (teste e2e instável).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');

test('atalhos são registrados antes de aguardar o WordPopup', () => {
  const controls = src.indexOf('this._injectYouTubeControls();');
  const hotkeys = src.indexOf('this._setupKeyboardShortcuts();');
  const popup = src.indexOf("await import('./word-popup.js')");
  assert.ok(controls > 0 && hotkeys > 0 && popup > 0, 'marcos da inicialização encontrados');
  assert.ok(controls < hotkeys, 'os atalhos vêm depois de o player ganhar os controles');
  assert.ok(hotkeys < popup, 'os atalhos não esperam o carregamento do WordPopup');
});
