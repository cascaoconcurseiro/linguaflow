// Issue #448 — redesenhar a legenda (ex.: tradução chegando) não pode tirar o
// foco da palavra escolhida pelo atalho F.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const start = source.indexOf('  renderDual(orig, trans) {');
const end = source.indexOf('\n  _makeClickable(', start);
assert.ok(start >= 0 && end > start, 'renderDual deve existir');
const render = source.slice(start, end);

const before = render.indexOf("origDiv.innerHTML = '';");
const focusSave = render.indexOf('focusedWordIndex');
assert.ok(focusSave >= 0 && focusSave < before, 'guarda a posição da palavra com foco antes de redesenhar');
assert.match(render, /origDiv\.contains\(active\)/, 'só conta foco dentro da linha original');
const restore = render.indexOf('.focus()', before);
assert.ok(restore > before, 'devolve o foco depois de recriar as palavras');

console.log('subtitle-word-focus: ok');
