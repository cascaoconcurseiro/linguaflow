// Regressão #514: quem não tem curso começa pelo primeiro da trilha, não pelo order_index do banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFirstCourse } from '../dashboard/js/ui/courses/courseUi.js';

const c = (id, level, track, track_order, extra = {}) => ({ id, level, track, track_order, is_core: true, ...extra });

test('sem matrícula: Fundamentos do A1 vem antes das gírias, mesmo com order_index menor no catálogo', () => {
  const catalog = [
    c('street', 'A1', 'dia-a-dia', 1),
    c('travel', 'A2', 'viagem', 1),
    c('frases', 'A1', 'fundamentos', 1),
  ];
  assert.equal(pickFirstCourse(catalog).id, 'frases');
});

test('matriculado em Meus cursos tem prioridade', () => {
  const catalog = [c('frases', 'A1', 'fundamentos', 1), c('work', 'B1', 'trabalho', 1, { my: { in_my_courses: true } })];
  assert.equal(pickFirstCourse(catalog).id, 'work');
});

test('curso fora da trilha guiada (is_core=false) não é o primeiro', () => {
  const catalog = [c('red', 'A1', 'fundamentos', 0, { is_core: false }), c('frases', 'A1', 'fundamentos', 1)];
  assert.equal(pickFirstCourse(catalog).id, 'frases');
});

test('catálogo só com cursos não centrais ainda devolve algum; vazio devolve undefined', () => {
  assert.equal(pickFirstCourse([c('x', 'A2', 'fluencia', 4, { is_core: false })]).id, 'x');
  assert.equal(pickFirstCourse([]), undefined);
});
