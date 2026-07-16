#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = (relative) => path.join(root, relative);
const read = (relative) => readFileSync(file(relative), 'utf8');

const removedFiles = [
  'assets/cefr.json',
  'content/engine/subtitle-fetcher.js',
  'content/engine/video-adapter.js',
];
for (const relative of removedFiles) {
  assert.equal(existsSync(file(relative)), false, `${relative} não deve voltar à árvore de produção`);
}

const popup = read('content/word-popup.js');
const removedPopupSymbols = [
  '_buildGrammar',
  '_usageChunks',
  '_simpleUsageLine',
  '_buildExamples',
  '_phrasals',
  '_posDetail',
  '_patterns',
  '_loadSavedChunks',
  '_formatUseRealAI',
  '_renderBasicGrammarFallback',
  '_gramBuilt',
  '_exBuilt',
  '_chunksBuilt',
];
for (const symbol of removedPopupSymbols) {
  assert.equal(popup.includes(symbol), false, `${symbol} não deve reaparecer sem um consumidor real`);
}

for (const liveContract of [
  'showForWord(',
  '_save(',
  '_aiSentence(',
  '_generateChunks(',
  '_position(',
  'hide(',
  'destroy(',
  'id="fsave"',
  'id="faisent"',
]) {
  assert.ok(popup.includes(liveContract), `contrato vivo do popup ausente: ${liveContract}`);
}

const engine = read('content/subtitle-engine.js');
assert.ok(engine.includes("await import('./word-popup.js')"), 'engine deve carregar o WordPopup');
assert.ok(engine.includes('new WordPopup(this, this.platform)'), 'engine deve instanciar o WordPopup');
assert.ok(engine.includes('this.wordPopup.init()'), 'engine deve inicializar o WordPopup');
assert.ok(engine.includes('this.wordPopup?.destroy?.()'), 'engine deve destruir o WordPopup');

const db = read('utils/db.js');
assert.equal(db.includes('exportDatabase('), false, 'stub exportDatabase não deve voltar');
assert.equal(db.includes('importDatabase('), false, 'stub importDatabase não deve voltar');

const settings = read('dashboard/js/ui/settingsView.js');
assert.ok(settings.includes('btn-backup-json'), 'backup JSON real deve permanecer nas configurações');
assert.ok(settings.includes('btn-restore-json'), 'restore JSON real deve permanecer nas configurações');

const background = read('background/service-worker.js');
assert.ok(background.includes("method === 'updateCard'"), 'bloqueio do método legado deve permanecer');
assert.ok(background.includes('LEGACY_CARD_WRITE_BLOCKED'), 'erro explícito do método legado deve permanecer');

console.log('✓ fronteira de código morto e contratos vivos preservados');
