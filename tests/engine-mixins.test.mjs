// Contrato da divisão do SubtitleEngine em módulos por assunto (content/subtitles/engine/*.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { installEngineMethods } from '../content/subtitles/engine/install-methods.js';
import { ENGINE_FILES } from './helpers/engine-source.mjs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const exposed = manifest.web_accessible_resources.flatMap((entry) => entry.resources);
const partFiles = ENGINE_FILES.filter((file) => file.startsWith('content/subtitles/engine/'));

test('os métodos de cada módulo chegam ao protótipo do motor', () => {
  for (const name of [
    '_fetchYoutubeSubtitles', '_startSyncLoop', 'renderDual', '_createWordSpan', 'toggleLoop', '_toggleSpeedMenu',
    '_injectYouTubeControls', '_createSubtitlePanel', '_rebuildSubtitleList', '_rebuildWordsList', '_generatePDF', '_exportCSV',
    'init', 'destroy', 'toggleSubtitles',
  ]) {
    assert.equal(typeof SubtitleEngine.prototype[name], 'function', name);
  }
});

test('o instalador recusa método duplicado em vez de sobrescrever em silêncio', () => {
  class Alvo { existente() {} }
  class Parte { existente() {} }
  assert.throws(() => installEngineMethods(Alvo, [Parte]), /método duplicado "existente"/);
});

test('o instalador copia os métodos como não enumeráveis, igual a um método de classe', () => {
  class Alvo {}
  class Parte { novo() { return 1; } }
  installEngineMethods(Alvo, [Parte]);
  assert.equal(new Alvo().novo(), 1);
  assert.equal(Object.keys(Alvo.prototype).length, 0);
});

test('todo módulo do motor está exposto no manifest da extensão', () => {
  assert.ok(partFiles.length >= 9);
  for (const file of partFiles) assert.ok(exposed.includes(file), `${file} falta em web_accessible_resources`);
});
