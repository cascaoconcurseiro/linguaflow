// Regressão #391: "Continue seu curso" nunca oferece capítulo de curso já concluído.
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueLessonOf, pickContinueTarget } from '../dashboard/js/ui/courses/courseUi.js';

const course = (id, ids, done) => ({
  id, title: id,
  lessons: ids.map((l, i) => ({ id: l, chapter_number: i + 1, unit_count: 10 })),
  my: { completed_lessons: done },
});
const index = (cs) => new Map(cs.flatMap((c) => c.lessons.map((l) => [l.id, { course: c, lesson: l }])));

test('continueLessonOf: curso concluído não volta ao capítulo 1', () => {
  assert.equal(continueLessonOf(course('a', ['a1', 'a2'], ['a1', 'a2'])), null);
  assert.equal(continueLessonOf(course('a', ['a1', 'a2'], ['a1']))?.id, 'a2');
});

test('pickContinueTarget: último curso concluído cede lugar a outro em andamento', () => {
  const a = course('a', ['a1', 'a2'], ['a1', 'a2']);
  const b = course('b', ['b1', 'b2'], ['b1']);
  const target = pickContinueTarget({
    lessonIndex: index([a, b]),
    summary: { continue: { lesson_id: 'a1' }, recent: [{ lesson_id: 'a1' }, { lesson_id: 'b1' }] },
  });
  assert.equal(target.lesson.id, 'b2');
});

test('pickContinueTarget: curso em andamento continua no próximo capítulo pendente', () => {
  const a = course('a', ['a1', 'a2', 'a3'], ['a1']);
  const target = pickContinueTarget({ lessonIndex: index([a]), summary: { continue: { lesson_id: 'a1' }, recent: [] } });
  assert.equal(target.lesson.id, 'a2');
});

test('pickContinueTarget: tudo concluído devolve null', () => {
  const a = course('a', ['a1'], ['a1']);
  assert.equal(pickContinueTarget({ lessonIndex: index([a]), summary: { continue: { lesson_id: 'a1' }, recent: [] } }), null);
});

test('cartão do curso: rótulo do botão reflete o progresso real', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../dashboard/js/ui/courses/courseStore.js', import.meta.url), 'utf8');
  assert.match(src, /percent >= 100 \? 'Revisar curso' : percent > 0 \? 'Continuar' : 'Ver capítulos'/);
  assert.doesNotMatch(src, /course\.my \? 'Continuar'/);
});

test('revisão: lista truncada em 100 avisa quantas frases existem', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../dashboard/js/ui/courses/courseNotebooks.js', import.meta.url), 'utf8');
  assert.match(src, /Mostrando as 100 primeiras de \$\{rows\.length\}/);
});
