import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeSession, comboMultiplier } from '../dashboard/js/core/coursePracticeSession.js';

const UNITS = [
  { id: 'u1', text: "Hey, what's up?" },
  { id: 'u2', text: 'My bad!' },
  { id: 'u3', text: 'No worries.' },
];

test('acerto limpo soma combo e pontuação; resultado por frase registra 1 tentativa', () => {
  const s = createPracticeSession(UNITS);
  const r = s.submit(['hey', "what's", 'up']);
  assert.equal(r.isCorrect, true);
  assert.equal(r.clean, true);
  assert.equal(s.streak, 1);
  assert.equal(s.score, Math.round(100 * comboMultiplier(1)));
  s.next();
  assert.equal(s.index, 1);
  assert.deepEqual(s.buildResults()[0], { unit_id: 'u1', attempts: 1, used_hint: false, wrong_text: null });
});

test('erro zera o combo, guarda só a primeira resposta errada e preserva palavras certas', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['hey', "what's", 'up']);
  s.next();
  const wrong = s.submit(['my', 'bed']);
  assert.equal(wrong.isCorrect, false);
  assert.deepEqual(wrong.errorIndices, [1]);
  assert.deepEqual(wrong.correctIndices, [0]);
  assert.equal(s.streak, 0);
  s.submit(['my', 'bud']);
  const ok = s.submit(['my', 'bad']);
  assert.equal(ok.clean, false);
  assert.equal(s.highestCombo, 1);
  assert.deepEqual(s.buildResults()[1], { unit_id: 'u2', attempts: 3, used_hint: false, wrong_text: 'my bed' });
});

test('dica conta uma vez por frase, quebra combo e impede acerto limpo', () => {
  const s = createPracticeSession(UNITS);
  assert.equal(s.useHint(), true);
  assert.equal(s.useHint(), false, 'segunda revelação não conta de novo');
  const r = s.submit(['hey', "what's", 'up']);
  assert.equal(r.clean, false);
  assert.equal(s.streak, 0);
  assert.equal(s.buildResults()[0].used_hint, true);
});

test('não avança sem resolver a frase e termina após a última', () => {
  const s = createPracticeSession(UNITS);
  assert.throws(() => s.next());
  s.submit(['hey', "what's", 'up']); s.next();
  s.submit(['my', 'bad']); s.next();
  s.submit(['no', 'worries']);
  assert.equal(s.next(), false);
  assert.equal(s.finished, true);
  assert.equal(s.highestCombo, 3);
  assert.deepEqual(s.summary(), { accuracy: 100, mistakes: 0, hints: 0 });
});

test('resposta em branco é registrada como erro legível', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['', '', '']);
  assert.equal(s.buildResults()[0].wrong_text, '(em branco)');
});

test('lição sem frases é recusada', () => {
  assert.throws(() => createPracticeSession([]), /sem frases/);
});

test('multiplicador de combo tem teto', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(4), 2);
  assert.equal(comboMultiplier(100), 4);
});
