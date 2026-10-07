import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeSession } from '../dashboard/js/core/coursePracticeSession.js';

const units = ['one', 'two', 'three', 'four'].map((text, i) => ({ id: `r${i}`, text }));
const session = (items = units) => createPracticeSession(items, { reinforceErrors: true });
const answer = (s) => s.submit(s.tokens.map((t) => t.targetWord));

test('erro retorna depois de duas outras frases, sem pontuação ou resultado duplicados', () => {
  const s = session();
  s.submit(['wrong']); answer(s); s.next();
  assert.equal(s.unit.id, 'r1'); answer(s); s.next();
  assert.equal(s.unit.id, 'r2'); answer(s); s.next();
  assert.equal(s.unit.id, 'r0'); assert.equal(s.isReinforcement, true);
  const before = s.buildResults({ onlyAnswered: true });
  const score = s.score;
  assert.equal(answer(s).gained, 0);
  assert.equal(s.score, score);
  assert.deepEqual(s.buildResults({ onlyAnswered: true }), before);
  s.next(); assert.equal(s.unit.id, 'r3'); answer(s); s.next();
  assert.equal(s.finished, true);
  assert.equal(s.resolvedCount, 4);
  assert.equal(s.buildResults().length, 4);
  assert.equal(s.buildResults()[0].attempts, 2);
  assert.equal(s.buildResults()[0].wrong_text, 'wrong');
});

test('erro no reforço não cria outro reforço; pode pular e concluir', () => {
  const s = session([units[0]]);
  s.submit(['wrong']); answer(s);
  assert.equal(s.finished, false);
  s.next(); assert.equal(s.isReinforcement, true);
  s.submit(['wrong']); s.skip(); s.next();
  assert.equal(s.finished, true);
  assert.equal(s.total, 2);
  assert.equal(s.summary().answered, 1);
  assert.equal(s.summary().mistakes, 1);
});

test('dica isolada não cria reforço; consultas e saída parcial preservam resultados', () => {
  const s = session();
  s.hintWord(0); answer(s); s.next();
  assert.equal(s.total, 4);
  s.submit(['wrong']); answer(s); s.next();
  assert.equal(s.total, 5);
  s.previous(); assert.equal(s.isReviewingPrevious, true);
  s.resume(); assert.equal(s.unit.id, 'r2');
  assert.equal(s.buildResults({ onlyAnswered: true }).length, 2);
});

test('palavra com exemplo retorna só a palavra e preserva o resultado original', () => {
  const s = session([{ id: 'word', kind: 'word', text: 'red', example_en: 'A red car.' }]);
  s.submit(['blue']); answer(s); answer(s); s.next();
  assert.equal(s.isReinforcement, true);
  assert.equal(s.currentText, 'red');
  const original = s.buildResults(); answer(s); s.next();
  assert.equal(s.finished, true);
  assert.deepEqual(s.buildResults(), original);
});

test('vários erros retornam uma vez cada e a sessão termina com resultados únicos', () => {
  const s = session();
  let steps = 0;
  while (!s.finished && steps++ < 20) {
    s.submit(['wrong']); answer(s); s.next();
  }
  assert.equal(s.finished, true);
  assert.equal(steps, 8);
  assert.equal(new Set(s.buildResults().map((r) => r.unit_id)).size, 4);
});
