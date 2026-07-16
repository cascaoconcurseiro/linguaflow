import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const hub = read('dashboard/js/ui/readingHub.js');
const stories = read('dashboard/js/ui/storiesView.js');
const reader = read('dashboard/js/ui/readerView.js');
const css = read('dashboard/css/globals.css');

assert.match(hub, /Ler com contexto/);
assert.match(hub, /data-reading-route="stories"/);
assert.match(hub, /data-reading-route="reader"/);
assert.match(hub, /aria-current=/);
assert.match(stories, /renderReadingHeader\('stories'\)/);
assert.match(reader, /renderReadingHeader\('reader'\)/);
assert.match(stories, /bindReadingHeader\(container, app\)/);
assert.match(reader, /bindReadingHeader\(container, app\)/);
assert.match(reader, /const statusLoaded = await loadStatusSets\(\)/);
assert.match(reader, /return false/);
assert.match(reader, /algumas cores podem estar incompletas/);
assert.match(reader, /btn-reader-status-retry/);
assert.match(reader, /<details class="reading-help">/);
assert.match(stories, /Familiaridade estimada:/);
assert.doesNotMatch(stories, /Encontrá-las em contexto novo é o que fixa/);
assert.match(css, /\.reading-hub-nav/);

console.log('✓ P1-B: Histórias e Leitor compartilham uma experiência de leitura');
