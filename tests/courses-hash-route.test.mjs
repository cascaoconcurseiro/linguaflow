// #393: a seção de Cursos vive no hash (#courses/review, #courses/course/<id>).
import test from 'node:test';
import assert from 'node:assert/strict';
import { courseHashFor, parseRouteHash } from '../dashboard/js/core/routeHash.js';

test('courseHashFor: seção, curso e início', () => {
  assert.equal(courseHashFor({ tab: 'review' }), 'courses/review');
  assert.equal(courseHashFor({ tab: 'course', courseId: 'abc' }), 'courses/course/abc');
  assert.equal(courseHashFor({ tab: 'level', level: 'A1' }), 'courses/level/A1');
  assert.equal(courseHashFor({ tab: 'level', level: '<script>' }), 'courses');
  assert.equal(courseHashFor({}), 'courses');
  assert.equal(courseHashFor({ tab: 'home' }), 'courses');
  assert.equal(courseHashFor({ tab: 'nao-existe' }), 'courses');
});

test('parseRouteHash: rota base e parâmetros de Cursos', () => {
  assert.deepEqual(parseRouteHash('#courses/mistakes'), { route: 'courses', params: { tab: 'mistakes' } });
  assert.deepEqual(parseRouteHash('#courses/course/abc'), { route: 'courses', params: { tab: 'course', courseId: 'abc' } });
  assert.deepEqual(parseRouteHash('#courses/level/A2'), { route: 'courses', params: { tab: 'level', level: 'A2' } });
  assert.deepEqual(parseRouteHash('#courses/level/A9'), { route: 'courses', params: {} });
  assert.deepEqual(parseRouteHash('#courses'), { route: 'courses', params: {} });
  assert.deepEqual(parseRouteHash('#home'), { route: 'home', params: {} });
  assert.deepEqual(parseRouteHash(''), { route: '', params: {} });
});

test('parseRouteHash: seção inválida ou id malformado é descartado', () => {
  assert.deepEqual(parseRouteHash('#courses/xyz'), { route: 'courses', params: {} });
  assert.deepEqual(parseRouteHash('#courses/course/<script>'), { route: 'courses', params: {} });
  assert.deepEqual(parseRouteHash('#courses/course'), { route: 'courses', params: {} });
});

test('fiação: app.js usa o hash de Cursos no boot, hashchange e navegação interna', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../dashboard/js/ui/coursesView.js', import.meta.url), 'utf8');
  assert.match(app, /parseRouteHash\(window\.location\.hash\)/);
  assert.match(app, /syncCourseHash\(params\)/);
  assert.match(app, /route !== 'course-practice'/);
  assert.match(view, /app\.syncCourseHash\?\.\(\{ tab: target, courseId, level \}\)/);
});
