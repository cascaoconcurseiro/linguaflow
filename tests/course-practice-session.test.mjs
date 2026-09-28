import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeSession, comboMultiplier } from '../dashboard/js/core/coursePracticeSession.js';

const UNITS = [
  { id: 'u1', text: "Hey, what's up?" },
  { id: 'u2', text: 'My bad!' },
  { id: 'u3', text: 'No worries.' },
];
const result = (s, i) => s.buildResults()[i];

test('acerto limpo soma combo e pontos; resultado registra 1 tentativa sem dica', () => {
  const s = createPracticeSession(UNITS);
  const r = s.submit(['hey', "what's", 'up']);
  assert.equal(r.clean, true);
  assert.equal(s.streak, 1);
  assert.equal(s.score, Math.round(100 * comboMultiplier(1)));
  s.next();
  assert.equal(s.index, 1);
  assert.deepEqual(result(s, 0), { unit_id: 'u1', attempts: 1, hint_count: 0, revealed: false, wrong_text: null });
});

test('erro zera o combo, guarda a primeira resposta errada e preserva acertos', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['hey', "what's", 'up']); s.next();
  const wrong = s.submit(['my', 'bed']);
  assert.deepEqual(wrong.errorIndices, [1]);
  assert.deepEqual(wrong.correctIndices, [0]);
  assert.equal(s.streak, 0);
  s.submit(['my', 'bud']);
  const ok = s.submit(['my', 'bad']);
  assert.equal(ok.clean, false);
  assert.equal(ok.gained, 25);
  assert.deepEqual(result(s, 1), { unit_id: 'u2', attempts: 3, hint_count: 0, revealed: false, wrong_text: 'my bed' });
});

test('dica por palavra devolve a palavra, conta uma vez por campo e quebra o combo', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['hey', "what's", 'up']); s.next();
  assert.equal(s.streak, 1);
  assert.equal(s.hintWord(1), 'bad');
  assert.equal(s.hintWord(1), 'bad');
  assert.equal(s.hintWord(0), 'My');
  assert.equal(s.streak, 0);
  assert.equal(s.submit(['my', 'bad']).clean, false);
  assert.equal(result(s, 1).hint_count, 2);
  assert.equal(s.hintWord(99), null);
});

test('revelar resposta quebra combo e marca a frase como revelada', () => {
  const s = createPracticeSession(UNITS);
  assert.equal(s.reveal(), true);
  assert.equal(s.reveal(), false);
  assert.equal(s.submit(['hey', "what's", 'up']).clean, false);
  assert.equal(result(s, 0).revealed, true);
});

test('pular conta como não acertada, guarda o que foi digitado e quebra o combo', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['hey', "what's", 'up']); s.next();
  assert.equal(s.skip(['my', 'b']), true);
  assert.equal(s.streak, 0);
  assert.deepEqual(result(s, 1), { unit_id: 'u2', attempts: 2, hint_count: 0, revealed: true, wrong_text: 'my b' });
  s.next();
  assert.equal(s.index, 2);
});

test('voltar para frases anteriores só consulta; avançar retoma de onde parou', () => {
  const s = createPracticeSession(UNITS);
  assert.equal(s.previous(), false);
  s.submit(['hey', "what's", 'up']); s.next();
  s.submit(['my', 'bad']); s.next();
  assert.equal(s.previous(), true);
  assert.equal(s.index, 1);
  assert.equal(s.isReviewingPrevious, true);
  assert.equal(s.currentDone, true);
  assert.throws(() => s.submit(['my', 'bad']));
  s.next();
  assert.equal(s.index, 2);
  assert.equal(s.isReviewingPrevious, false);
});

test('termina após a última; resumo e parciais corretos', () => {
  const s = createPracticeSession(UNITS);
  assert.throws(() => s.next());
  s.submit(['hey', "what's", 'up']); s.next();
  assert.equal(s.buildResults({ onlyAnswered: true }).length, 1, 'sessão incompleta envia só o respondido');
  s.submit(['my', 'bad']); s.next();
  s.submit(['no', 'worries']);
  assert.equal(s.next(), false);
  assert.equal(s.finished, true);
  assert.equal(s.highestCombo, 3);
  assert.deepEqual(s.summary(), { answered: 3, accuracy: 100, mistakes: 0, hints: 0 });
});

test('resposta em branco vira erro legível; lição vazia é recusada; combo tem teto', () => {
  const s = createPracticeSession(UNITS);
  s.submit(['', '', '']);
  assert.equal(result(s, 0).wrong_text, '(em branco)');
  assert.throws(() => createPracticeSession([]), /sem frases/);
  assert.equal(comboMultiplier(4), 2);
  assert.equal(comboMultiplier(100), 4);
});
