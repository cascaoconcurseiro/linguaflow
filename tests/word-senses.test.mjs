// tests/word-senses.test.mjs — Issue #366: traduções por classe gramatical
// a partir da resposta do Google (dt=bd) já usada pelo tradutor.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGoogleDictionary, posLabelPt, isSensesLookupTerm } from '../utils/word-senses.js';

// Respostas reais (2026-09-29), recortadas.
const LET = [[['deixar', 'let', null, null, 10]], [
  ['verb', ['deixar', 'alugar', 'permitir', 'arrendar', 'impedir', 'causar', 'concordar'], [], 'let', 2],
  ['noun', ['impedimento', 'obstáculo', 'dificuldade'], [], 'let', 1],
], 'en'];
const FILMING = [[['filmando', 'filming', null, null, 3]], [
  ['verb', ['filmar', 'velar', 'cobrir com película'], [], 'film', 2],
], 'en'];

test('agrupa as traduções por classe, na ordem do Google, com limite', () => {
  assert.deepEqual(parseGoogleDictionary(LET), [
    { pos: 'verb', label: 'verbo', base: 'let', terms: ['deixar', 'alugar', 'permitir', 'arrendar', 'impedir'] },
    { pos: 'noun', label: 'substantivo', base: 'let', terms: ['impedimento', 'obstáculo', 'dificuldade'] },
  ]);
  assert.equal(parseGoogleDictionary(LET, { maxPos: 1 }).length, 1);
});

test('mantém a forma base quando a palavra é flexionada', () => {
  assert.equal(parseGoogleDictionary(FILMING)[0].base, 'film');
});

test('resposta sem dicionário ou malformada vira lista vazia', () => {
  assert.deepEqual(parseGoogleDictionary([[['olá', 'hello']], null, 'en']), []);
  assert.deepEqual(parseGoogleDictionary(null), []);
  assert.deepEqual(parseGoogleDictionary('<html>'), []);
  assert.deepEqual(parseGoogleDictionary([[], [['verb', 'not-an-array']]]), []);
});

test('rótulos em português e classe desconhecida sem tradução inventada', () => {
  assert.equal(posLabelPt('adjective'), 'adjetivo');
  assert.equal(posLabelPt('adverb'), 'advérbio');
  assert.equal(posLabelPt('abbreviation'), 'abreviação');
  assert.equal(posLabelPt('something-new'), 'something-new');
});

test('só consulta termos curtos (palavra ou expressão), nunca frases', () => {
  assert.equal(isSensesLookupTerm('let'), true);
  assert.equal(isSensesLookupTerm('look after'), true);
  assert.equal(isSensesLookupTerm('It is better to be happy than to be wise'), false);
  assert.equal(isSensesLookupTerm(''), false);
});
