// Issue #492: faixa "Curso" no Início, ao lado da fila de vídeos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCourseStripModel, renderCourseStrip } from '../dashboard/js/ui/courses/courseHomeStrip.js';

const course = (id, ids, done, extra = {}) => ({
  id, title: `Curso ${id}`, level: 'B1',
  lessons: ids.map((l, i) => ({ id: l, title: `Aula ${l}`, chapter_number: i + 1, unit_count: 20, my_best_answered: 0 })),
  my: { completed_lessons: done, in_my_courses: true },
  ...extra,
});

test('sem catálogo: nenhuma faixa (o atalho de histórias continua)', () => {
  assert.equal(buildCourseStripModel({ catalog: [], summary: {} }).kind, 'none');
  assert.equal(renderCourseStrip({ kind: 'none' }), '');
});

test('sem progresso: convite para começar o primeiro curso', () => {
  const m = buildCourseStripModel({ catalog: [course('a', ['a1'], [])], summary: {} });
  assert.equal(m.kind, 'start');
  assert.equal(m.courseId, 'a');
});

test('em andamento: capítulo pendente, revisões vencidas e erros abertos', () => {
  const a = course('a', ['a1', 'a2'], ['a1']);
  a.lessons[1].my_best_answered = 11;
  const m = buildCourseStripModel({
    catalog: [a],
    summary: { continue: { lesson_id: 'a1' }, recent: [], reviews_due_count: 12, mistakes_count: 6 },
  });
  assert.equal(m.kind, 'continue');
  assert.equal(m.lessonId, 'a2');
  assert.equal(m.percent, 55);
  assert.equal(m.reviewsDue, 12);
  assert.equal(m.mistakes, 6);
});

test('tudo concluído: aponta para Meus cursos, não para o capítulo 1', () => {
  const a = course('a', ['a1'], ['a1']);
  const m = buildCourseStripModel({ catalog: [a], summary: { continue: { lesson_id: 'a1' }, recent: [{ lesson_id: 'a1' }] } });
  assert.equal(m.kind, 'done');
});

test('HTML: botão único primário, barra de progresso acessível e contagens', () => {
  const html = renderCourseStrip({ kind: 'continue', courseId: 'a', lessonId: 'a2', courseTitle: 'Curso a', level: 'B1', chapter: 2, lessonTitle: 'Aula a2', percent: 55, reviewsDue: 12, mistakes: 6 });
  assert.match(html, /id="btn-home-course-continue"/);
  assert.equal((html.match(/btn-action/g) || []).length, 1);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="55"/);
  assert.match(html, /12/);
  assert.match(html, /6/);
});

test('HTML: escapa título vindo do catálogo', () => {
  const html = renderCourseStrip({ kind: 'continue', courseId: 'a', lessonId: 'a2', courseTitle: '<img onerror=x>', level: 'B1', chapter: 1, lessonTitle: '"><b>', percent: 0, reviewsDue: 0, mistakes: 0 });
  assert.doesNotMatch(html, /<img onerror/);
  assert.doesNotMatch(html, /"><b>/);
});

test('HTML: estado de erro oferece nova tentativa', () => {
  const html = renderCourseStrip({ kind: 'error' });
  assert.match(html, /id="btn-home-course-retry"/);
  assert.match(html, /role="status"/);
});

test('Início: carrega cursos sem bloquear, mantém atalho de histórias e liga os botões', async () => {
  const { readFileSync } = await import('node:fs');
  const home = readFileSync(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');
  assert.match(home, /renderCourseStrip/);
  assert.match(home, /btn-home-course-continue/);
  assert.match(home, /id="btn-primary-stories"/);
});
