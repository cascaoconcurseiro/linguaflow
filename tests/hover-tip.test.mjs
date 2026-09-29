// tests/hover-tip.test.mjs — Issue #369: hover mostra dica leve (sem IA);
// o card completo fica no clique (ou no hover se o card já está aberto).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hoverTipLines, hoverTipPosition } from '../content/subtitles/hover-tip.js';

test('conteúdo: palavra com tradução, até 2 classes sem repetir a principal e a frase', () => {
  const lines = hoverTipLines({
    word: 'let',
    translation: 'deixar',
    senses: [
      { label: 'verbo', terms: ['deixar', 'permitir', 'alugar', 'arrendar', 'impedir', 'causar'] },
      { label: 'substantivo', terms: ['impedimento'] },
      { label: 'adjetivo', terms: ['x'] },
    ],
    sentenceTranslation: 'Deixa eu ver.',
  });
  assert.deepEqual(lines, [
    { kind: 'word', text: 'let: deixar' },
    { kind: 'sense', label: 'verbo', text: 'permitir, alugar, arrendar, impedir' },
    { kind: 'sense', label: 'substantivo', text: 'impedimento' },
    { kind: 'sentence', text: 'Deixa eu ver.' },
  ]);
});

test('conteúdo: enquanto nada chegou mostra só a palavra; tradução igual não repete', () => {
  assert.deepEqual(hoverTipLines({ word: 'OK' }), [{ kind: 'word', text: 'OK' }]);
  assert.deepEqual(hoverTipLines({ word: 'OK', translation: 'ok' }), [{ kind: 'word', text: 'OK' }]);
});

test('posição: acima da palavra, abaixo se não couber, sempre dentro da tela', () => {
  const view = { width: 1000, height: 600 };
  const tip = { width: 200, height: 60 };
  assert.deepEqual(hoverTipPosition({ left: 400, width: 50, top: 300, bottom: 320 }, tip, view), { left: 325, top: 232 });
  assert.deepEqual(hoverTipPosition({ left: 400, width: 50, top: 20, bottom: 40 }, tip, view), { left: 325, top: 48 });
  assert.equal(hoverTipPosition({ left: 980, width: 20, top: 300, bottom: 320 }, tip, view).left, 792);
  assert.equal(hoverTipPosition({ left: 0, width: 10, top: 300, bottom: 320 }, tip, view).left, 8);
});

test('engine: dica usa tradução/classes do card e só traduz a frase se ela contém a palavra', async () => {
  globalThis.chrome ??= { runtime: { getURL: (p) => p, sendMessage() {}, onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } } };
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const engine = Object.create(SubtitleEngine.prototype);
  const shown = [];
  engine._hoverTip = { show: (rect, initial, load) => { const patches = []; shown.push({ initial, patches }); load((p) => patches.push(p)); }, hide() {} };
  engine.wordPopup = { _translate: async () => 'filmando', _senses: async () => [{ label: 'verbo', terms: ['filmar'] }] };
  engine._currentCue = { text: "Well, I'm filming this", translatedText: 'Bem, estou filmando isso' };
  engine._showHoverTip({ getBoundingClientRect: () => ({}) }, 'filming,');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(shown[0].initial, { word: 'filming', sentenceTranslation: 'Bem, estou filmando isso' });
  assert.deepEqual(shown[0].patches, [{ translation: 'filmando' }, { senses: [{ label: 'verbo', terms: ['filmar'] }] }]);
  engine._showHoverTip({ getBoundingClientRect: () => ({}) }, 'September');
  assert.equal(shown[1].initial.sentenceTranslation, '', 'palavra de outra fala não recebe tradução da fala atual');
});

test('fiação: hover com card fechado abre a dica, não o card; clique e saída escondem a dica', () => {
  const src = readFileSync(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
  const enter = src.slice(src.indexOf("span.addEventListener('pointerenter'"), src.indexOf("span.addEventListener('pointerleave'"));
  assert.match(enter, /if \(cardOpen\) \{\s*this\.wordPopup\.showForWord[\s\S]*\} else \{\s*this\._showHoverTip\(span, text\);/);
  const leave = src.slice(src.indexOf("span.addEventListener('pointerleave'"), src.indexOf('const onClickOrTouch'));
  assert.match(leave, /this\._hoverTip\?\.hide\(\)/);
  const click = src.slice(src.indexOf('const onClickOrTouch'), src.indexOf("span.addEventListener('click', onClickOrTouch)"));
  assert.match(click, /this\._hoverTip\?\.hide\(\);[\s\S]*this\.wordPopup\.showForWord/);
  const tip = readFileSync(new URL('../content/subtitles/hover-tip.js', import.meta.url), 'utf8');
  assert.match(tip, /setAttribute\('role', 'tooltip'\)/);
  assert.match(tip, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(tip, /innerHTML/, 'conteúdo de terceiros entra só como texto');
});
