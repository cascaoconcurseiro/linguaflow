// #542: tipo da aula e módulo atual da página do nível, validados contra o currículo real (449 aulas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonKind, pickCurrentModule, lessonRole } from '../dashboard/js/ui/courses/courseCurriculum.js';
import { SEQUENCE_CURRICULUM } from '../supabase/content/curriculum-sequence.mjs';

test('todas as aulas do currículo têm tipo reconhecido', () => {
  const unknown = SEQUENCE_CURRICULUM.filter(l => lessonKind({ id: l.id }) === 'Aula').map(l => l.id);
  assert.deepEqual(unknown, [], `sem tipo: ${unknown.join(', ')}`);
  assert.equal(SEQUENCE_CURRICULUM.length, 449);
});

test('gramática e vocabulário aparecem como tipos dentro da base', () => {
  const base = SEQUENCE_CURRICULUM.filter(l => l.role === 'base' && l.level === 'A1').map(l => lessonKind({ id: l.id }));
  assert.ok(base.includes('Gramática'), 'A1 base tem gramática');
  assert.ok(base.includes('Vocabulário'), 'A1 base tem vocabulário');
});

test('lessonKind aceita prefixo lesson- e não confunde prefixos parecidos', () => {
  assert.equal(lessonKind({ id: 'lesson-pedagogy-a1-articles' }), 'Gramática');
  assert.equal(lessonKind({ id: 'pedagogy-a1-articles' }), 'Gramática');
  assert.equal(lessonKind({ id: 'lesson-1000-words-a1-04' }), 'Vocabulário');
  assert.equal(lessonKind({ id: 'lesson-first-sentences-a1-01' }), 'Frases essenciais');
  assert.equal(lessonKind({ id: 'lesson-pedagogyx-a1' }), 'Aula');
  assert.equal(lessonKind({}), 'Aula');
  assert.equal(lessonKind(null), 'Aula');
});

test('lessonRole prioriza lesson_role e cai em is_core', () => {
  assert.equal(lessonRole({ lesson_role: 'optional', is_core: true }), 'optional');
  assert.equal(lessonRole({ is_core: false }), 'extra');
  assert.equal(lessonRole({}), 'base');
});

const course = (done) => ({ my: { completed_lessons: done } });
const entry = (id, done) => ({ course: course(done ? [id] : []), lesson: { id, unit_count: 8 } });
test('módulo atual: o da próxima aula; sem ela o primeiro pendente; tudo concluído = nenhum', () => {
  const groups = new Map([['M1', [entry('a', true)]], ['M2', [entry('b', false)]], ['M3', [entry('c', false)]]]);
  assert.equal(pickCurrentModule(groups, 'c'), 'M3');
  assert.equal(pickCurrentModule(groups, 'inexistente'), 'M2');
  assert.equal(pickCurrentModule(groups, undefined), 'M2');
  assert.equal(pickCurrentModule(new Map([['M1', [entry('a', true)]]]), 'x'), null);
  assert.equal(pickCurrentModule(new Map(), 'x'), null);
});
