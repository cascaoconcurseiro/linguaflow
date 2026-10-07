// #544: modelo do painel de explicação da frase praticada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBreakdown } from '../dashboard/js/core/courseBreakdown.js';

const word = { text: 'keys', translation_pt: 'chaves', ipa: '/kiz/', explanation_note: 'Plural.', example_en: 'I lost my keys.', example_pt: 'Perdi minhas chaves.', annotations: [{ surface: 'keys', pos: 'noun' }], syntax_groups: [{ role: 'object', surface: 'keys' }] };

test('etapa da palavra usa a unidade e mostra o exemplo como bloco extra', () => {
  const m = buildBreakdown(word, { stage: 'word' });
  assert.equal(m.sentence, 'keys');
  assert.equal(m.translation, 'chaves');
  assert.equal(m.ipa, '/kiz/');
  assert.equal(m.mode, 'structure');
  assert.deepEqual(m.exampleBlock, { text: 'I lost my keys.', translation: 'Perdi minhas chaves.' });
  assert.equal(m.source, null);
});

test('etapa do exemplo usa a frase do exemplo e não a estrutura da palavra', () => {
  const m = buildBreakdown(word, { stage: 'example' });
  assert.equal(m.inExample, true);
  assert.equal(m.sentence, 'I lost my keys.');
  assert.equal(m.translation, 'Perdi minhas chaves.');
  assert.equal(m.ipa, '');
  assert.equal(m.mode, 'none');
  assert.deepEqual(m.source, { text: 'keys', translation: 'chaves' });
  assert.equal(m.exampleBlock, null);
  assert.equal(m.note, 'Plural.');
});

test('etapa de exemplo sem example_en volta ao comportamento da unidade', () => {
  const m = buildBreakdown({ ...word, example_en: null }, { stage: 'example' });
  assert.equal(m.inExample, false);
  assert.equal(m.sentence, 'keys');
});

test('modo: grupos > palavras > nenhum; entradas inválidas são ignoradas', () => {
  assert.equal(buildBreakdown({ text: 'A', syntax_groups: [{ surface: 'A' }], annotations: [{ surface: 'A' }] }).mode, 'structure');
  assert.equal(buildBreakdown({ text: 'A', syntax_groups: [], annotations: [{ surface: 'A' }] }).mode, 'words');
  assert.equal(buildBreakdown({ text: 'A', syntax_groups: [null, {}], annotations: [null, {}] }).mode, 'none');
  assert.equal(buildBreakdown({ text: 'A', syntax_groups: 'x', annotations: 'y' }).mode, 'none');
  assert.equal(buildBreakdown({ text: 'A' }).mode, 'none');
});

test('objetivo é aparado e unidade vazia não quebra', () => {
  assert.equal(buildBreakdown({ text: 'A' }, { objective: '  Foco  ' }).objective, 'Foco');
  assert.equal(buildBreakdown({ text: 'A' }, { objective: null }).objective, '');
  const empty = buildBreakdown(null);
  assert.equal(empty.sentence, '');
  assert.equal(empty.mode, 'none');
});
