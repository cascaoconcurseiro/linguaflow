// #544/#551: modelo do painel "Mostrar resposta": a frase praticada e a lista palavra por palavra de TODA frase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignWords, buildBreakdown } from '../dashboard/js/core/courseBreakdown.js';

const w = (surface, gloss = surface) => ({ surface, pos: 'noun', ipa: `/${surface}/`, gloss });
const word = {
  text: 'keys', translation_pt: 'chaves', ipa: '/kiz/', explanation_note: 'Plural.', example_en: 'I lost my keys.', example_pt: 'Perdi minhas chaves.',
  annotations: [w('keys', 'chaves')], syntax_groups: [{ role: 'object', surface: 'keys' }],
  example_annotations: [w('I', 'eu'), w('lost', 'perdi'), w('my', 'meu'), w('keys', 'chaves')],
};

test('etapa da palavra usa a unidade, mostra o exemplo como bloco extra e lista a palavra', () => {
  const m = buildBreakdown(word, { stage: 'word' });
  assert.equal(m.sentence, 'keys');
  assert.equal(m.translation, 'chaves');
  assert.equal(m.ipa, '/kiz/');
  assert.equal(m.mode, 'structure');
  assert.deepEqual(m.exampleBlock, { text: 'I lost my keys.', translation: 'Perdi minhas chaves.' });
  assert.equal(m.source, null);
  assert.deepEqual(m.words.map(x => x.surface), ['keys']);
});

test('etapa do exemplo usa a frase do exemplo e as palavras do exemplo, não as da palavra', () => {
  const m = buildBreakdown(word, { stage: 'example' });
  assert.equal(m.inExample, true);
  assert.equal(m.sentence, 'I lost my keys.');
  assert.equal(m.translation, 'Perdi minhas chaves.');
  assert.equal(m.ipa, '');
  assert.equal(m.mode, 'words');
  assert.deepEqual(m.words.map(x => `${x.surface}=${x.gloss}`), ['I=eu', 'lost=perdi', 'my=meu', 'keys=chaves']);
  assert.deepEqual(m.source, { text: 'keys', translation: 'chaves' });
  assert.equal(m.exampleBlock, null);
  assert.equal(m.note, 'Plural.');
});

test('etapa de exemplo sem example_en volta ao comportamento da unidade', () => {
  const m = buildBreakdown({ ...word, example_en: null }, { stage: 'example' });
  assert.equal(m.inExample, false);
  assert.equal(m.sentence, 'keys');
});

test('toda frase lista todas as palavras, com ou sem estrutura e com ou sem anotações', () => {
  const full = buildBreakdown({ text: 'I am here.', annotations: [w('I'), w('am'), w('here')] });
  assert.deepEqual(full.words.map(x => x.surface), ['I', 'am', 'here']);
  assert.equal(full.mode, 'words');
  const withGroups = buildBreakdown({ text: 'She works.', annotations: [w('She'), w('works')], syntax_groups: [{ role: 'subject', surface: 'She' }] });
  assert.equal(withGroups.mode, 'structure');
  assert.deepEqual(withGroups.words.map(x => x.surface), ['She', 'works']);
  const bare = buildBreakdown({ text: 'Go now.' });
  assert.deepEqual(bare.words, [{ surface: 'Go', pos: '', ipa: '', gloss: '' }, { surface: 'now', pos: '', ipa: '', gloss: '' }]);
  assert.equal(buildBreakdown({ text: 'A', syntax_groups: 'x', annotations: 'y' }).words.length, 1);
});

test('alinha por posição quando bate e pela forma da palavra quando não; palavras repetidas e hífen', () => {
  assert.deepEqual(alignWords('Go go, GO!', [w('Go', 'vá'), w('go', 'vá'), w('GO', 'vá')]).map(x => x.gloss), ['vá', 'vá', 'vá']);
  const hyphen = alignWords("It's a rip-off, Ana!", [w("It's", 'é'), w('a', 'um'), w('rip-off', 'roubo')]);
  assert.deepEqual(hyphen.map(x => `${x.surface}:${x.gloss}`), ["It's:é", 'a:um', 'rip-off:roubo', 'Ana:']);
  const unordered = alignWords('Hello world', [w('world', 'mundo'), w('hello', 'olá')]);
  assert.deepEqual(unordered.map(x => x.gloss), ['olá', 'mundo']);
  assert.deepEqual(alignWords('', []), []);
  assert.deepEqual(alignWords(null, null), []);
});

test('objetivo é aparado e unidade vazia não quebra', () => {
  assert.equal(buildBreakdown({ text: 'A' }, { objective: '  Foco  ' }).objective, 'Foco');
  assert.equal(buildBreakdown({ text: 'A' }, { objective: null }).objective, '');
  const empty = buildBreakdown(null);
  assert.equal(empty.sentence, '');
  assert.deepEqual(empty.words, []);
});
