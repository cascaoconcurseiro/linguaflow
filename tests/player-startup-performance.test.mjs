import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
const createUi = source.slice(source.indexOf('  async _createSubtitleUI() {'), source.indexOf('  _updateSubtitleColors()', source.indexOf('  async _createSubtitleUI() {')));
const waitForVideo = source.slice(source.indexOf('  _waitForVideo() {'), source.indexOf('  // ── Captura', source.indexOf('  _waitForVideo() {')));

assert.match(createUi, /document\.body\.appendChild\(host\)/, 'shell do player aparece no body sem esperar o container');
assert.match(createUi, /const settingsPromise = import\('\.\.\/utils\/db\.js'\)/, 'settings são carregadas em background');
assert.doesNotMatch(createUi, /for \(const delay of \[1000, 2000, 3000, 4000, 5000\]\)/, 'startup não aguarda retries longos para montar a UI');
assert.match(createUi, /settingsPromise\.then/, 'configurações reposicionam o shell após a montagem');
assert.match(waitForVideo, /\}, 250\);/, 'descoberta do vídeo usa polling curto');

console.log('player-startup-performance: ok');
