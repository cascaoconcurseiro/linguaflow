// #548: aulas na ordem da trilha, nunca na do capítulo antigo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTrailOrder, sortLessonsByTrail } from '../utils/db/course-trail-order.js';
import { groupLessonsByLevel } from '../dashboard/js/ui/courses/courseStore.js';
import { continueLessonOf, nextLessonOf } from '../dashboard/js/ui/courses/courseUi.js';
import { CoursesRepository } from '../utils/db/courses-repo.js';
import { SEQUENCE_CURRICULUM } from '../supabase/content/curriculum-sequence.mjs';
import { loadCourseContentSnapshot } from '../scripts/course-content-snapshot.mjs';

const lesson = (id, chapter_number, level, curriculum_order, extra = {}) => ({ id, chapter_number, level, curriculum_order, unit_count: 8, ...extra });

test('ordena por nível e depois por curriculum_order, ignorando o capítulo antigo', () => {
  const sorted = sortLessonsByTrail([lesson('b1', 1, 'B1', 3000), lesson('a1b', 2, 'A1', 20), lesson('a2', 3, 'A2', 1000), lesson('a1a', 4, 'A1', 10)], 'A1');
  assert.deepEqual(sorted.map(l => l.id), ['a1a', 'a1b', 'a2', 'b1']);
  assert.deepEqual(sorted.map(l => l.chapter_number), [1, 2, 3, 4]);
  assert.deepEqual(sorted.map(l => l.source_chapter_number), [4, 2, 3, 1]);
});

test('sem curriculum_order cai no nível e no capítulo; com ordem vem antes de sem ordem no mesmo nível', () => {
  const sorted = sortLessonsByTrail([lesson('legacy2', 2, 'A1', null), lesson('legacy1', 1, 'A1', null), lesson('trail', 9, 'A1', 50), lesson('noLevel', 1, undefined, null)], 'A2');
  assert.deepEqual(sorted.map(l => l.id), ['trail', 'legacy1', 'legacy2', 'noLevel']);
  assert.equal(compareTrailOrder({ chapter_number: 1 }, { chapter_number: 2 }), -1);
});

test('é estável, não muda a entrada e aceita vazio', () => {
  const input = [lesson('x', 1, 'A1', 10), lesson('y', 2, 'A1', 10)];
  const copy = JSON.stringify(input);
  assert.deepEqual(sortLessonsByTrail(input).map(l => l.id), ['x', 'y']);
  assert.equal(JSON.stringify(input), copy);
  assert.deepEqual(sortLessonsByTrail(undefined), []);
});

test('agrupa por nível preservando a ordem e continuar segue a trilha', () => {
  const course = { level: 'A1', my: { completed_lessons: ['a1a'] }, lessons: sortLessonsByTrail([lesson('b1', 1, 'B1', 3000), lesson('a1b', 2, 'A1', 20), lesson('a1a', 4, 'A1', 10), lesson('a2', 3, 'A2', 1000)], 'A1') };
  assert.deepEqual(groupLessonsByLevel(course).map(g => [g.level, g.lessons.map(l => l.id)]), [['A1', ['a1a', 'a1b']], ['A2', ['a2']], ['B1', ['b1']]]);
  assert.equal(continueLessonOf(course).id, 'a1b');
  assert.equal(nextLessonOf(course, 'a1a'), null, 'com trilha a próxima vem da RPC, não da posição');
});

test('listCatalog aplica a ordem da trilha e descarta aulas sem frases', async () => {
  const rpc = [{ id: 'c', level: 'A1', lessons: [lesson('b1', 1, 'B1', 3000), lesson('a1', 2, 'A1', 10), lesson('empty', 3, 'A1', 5, { unit_count: 0 })] }];
  const repo = new CoursesRepository({ _fetch: async () => rpc });
  const [course] = await repo.listCatalog();
  assert.deepEqual(course.lessons.map(l => l.id), ['a1', 'b1']);
});

test('no currículo real, cada curso fica em ordem crescente de nível', async () => {
  const levelRank = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
  const byId = new Map(SEQUENCE_CURRICULUM.map(s => [s.id, s]));
  for (const course of await loadCourseContentSnapshot()) {
    const rows = sortLessonsByTrail(course.lessons.map(l => ({ id: l.id, chapter_number: l.chapter, level: byId.get(l.id).level, curriculum_order: byId.get(l.id).order })), course.level);
    const ranks = rows.map(r => levelRank[r.level]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), course.id);
    const orders = rows.map(r => byId.get(r.id).order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b), course.id);
  }
});
