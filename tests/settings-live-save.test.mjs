import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SettingsPanel } from '../content/settings-panel.js';
import { readSettingsPanelSource } from './helpers/settings-panel-source.mjs';

function panelWith() {
  const panel = Object.create(SettingsPanel.prototype);
  panel.cfg = {};
  panel._saveTimers = new Map();
  panel._pendingSaves = new Map();
  panel._writeQueue = Promise.resolve();
  panel.written = [];
  panel.applied = 0;
  panel._applyToEngine = () => { panel.applied += 1; };
  panel._writeSetting = async (key, value) => {
    // Respostas lentas e fora de ordem não podem inverter a ordem das gravações.
    await new Promise((resolve) => setTimeout(resolve, key === 'fontSize' ? 15 : 1));
    panel.written.push([key, value]);
  };
  return panel;
}

test('arrastar o slider aplica ao vivo, mas grava uma única vez com o último valor', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const panel = panelWith();

  for (const value of [20, 21, 22, 23, 24, 30]) panel._saveLive('fontSize', value);
  assert.equal(panel.cfg.fontSize, 30, 'valor ao vivo na hora');
  assert.equal(panel.applied, 6, 'efeito ao vivo em cada movimento');
  assert.deepEqual(panel.written, [], 'nenhuma gravação durante o arraste');

  t.mock.timers.tick(399);
  assert.equal(panel._pendingSaves.size, 1, 'ainda dentro dos 400 ms');
  t.mock.timers.tick(1);
  assert.equal(panel._pendingSaves.size, 0, 'a espera acabou e a gravação foi para a fila');
  t.mock.timers.reset();

  await panel._writeQueue;
  assert.deepEqual(panel.written, [['fontSize', 30]]);
});

test('soltar o slider, fechar o painel ou destruí-lo grava o pendente na hora', async () => {
  const panel = panelWith();
  panel._saveLive('translationDelay', 2);
  panel._saveLive('bgOpacity', 0.5);
  await panel.flushPendingSaves();
  assert.deepEqual(panel.written.sort(), [['bgOpacity', 0.5], ['translationDelay', 2]]);
  assert.equal(panel._pendingSaves.size, 0);
  assert.equal(panel._saveTimers.size, 0, 'sem timers sobrando');
  await panel.flushPendingSaves();
  assert.equal(panel.written.length, 2, 'sem pendente, não grava de novo');
});

test('gravações de chaves diferentes saem na ordem em que foram pedidas', async () => {
  const panel = panelWith();
  panel._saveLive('fontSize', 40); // a gravação mais lenta
  panel._saveLive('subtitleBottom', 120);
  await panel.flushPendingSaves();
  assert.deepEqual(panel.written, [['fontSize', 40], ['subtitleBottom', 120]]);
});

test('contrato: todos os sliders usam gravação agrupada e close/destroy descarregam', async () => {
  const code = await readSettingsPanelSource();
  for (const key of ['fontSize', 'fontSizeTrans', 'bgOpacity', 'subtitleBottom', 'subtitleHorizontal', 'translationDelay', 'translationAnticipation', 'flashDuration']) {
    assert.match(code, new RegExp(`_saveLive\\('${key}'`), key);
    assert.doesNotMatch(code, new RegExp(`this\\._save\\('${key}'`), `${key} não pode gravar a cada movimento`);
  }
  assert.match(code, /close\(\) \{\s*if \(!this\.shadow\) return;\s*this\.flushPendingSaves\(\);/);
  assert.match(code, /destroy\(\) \{\s*this\.flushPendingSaves\(\);/);
  assert.match(code, /input\[type="range"\][\s\S]*?addEventListener\('change', \(\) => this\.flushPendingSaves\(\)/);
});
