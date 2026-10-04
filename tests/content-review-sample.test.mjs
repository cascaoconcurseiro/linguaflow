import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewSample, loadAllCourses, REVIEW_COLUMNS, toCsv } from '../scripts/content-review-sample.mjs';

const course = (id, n) => ({ id, title: `Curso ${id}`, level: 'A1', units: Array.from({ length: n }, (_, i) => ({ lesson: 'L', id: `unit-${id}-${String(i + 1).padStart(2, '0')}`, kind: 'sentence', text: `Sentence ${i}`, pt: `Frase ${i}`, note: i % 2 ? 'nota' : '' })) });

test('amostra é determinística pela semente e muda com outra semente (#435)', () => {
  const courses = [course('a', 40), course('b', 40)];
  const one = buildReviewSample(courses, { perCourse: 5, seed: 'x' });
  assert.deepEqual(buildReviewSample(courses, { perCourse: 5, seed: 'x' }), one);
  assert.notDeepEqual(buildReviewSample(courses, { perCourse: 5, seed: 'y' }).map((r) => r.id_unidade), one.map((r) => r.id_unidade));
  assert.equal(one.length, 10);
});

test('cursos pequenos entram inteiros, sem repetição, e a ordem de entrada não importa', () => {
  const rows = buildReviewSample([course('b', 3), course('a', 3)], { perCourse: 5 });
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map((r) => r.id_unidade)).size, 6);
  assert.equal(rows[0].curso, 'Curso a');
});

test('CSV abre no Excel (BOM), escapa aspas/vírgulas/quebras e tem colunas para o revisor', () => {
  const csv = toCsv([{ curso: 'C', nivel: 'A1', licao: 'L', id_unidade: 'u', tipo: 'sentence', ingles: 'He said, "hi"', portugues: 'Ele disse\noi', ipa: '', nota: '', status_revisao: '', correcao_sugerida: '', revisor: '' }]);
  assert.ok(csv.startsWith('﻿curso,nivel'));
  assert.ok(csv.includes('"He said, ""hi"""'));
  assert.ok(csv.includes('"Ele disse\noi"'));
  for (const col of ['status_revisao', 'correcao_sugerida', 'revisor']) assert.ok(REVIEW_COLUMNS.includes(col));
});

test('lê os 20 cursos reais e gera amostra com todos os níveis presentes', async () => {
  const courses = await loadAllCourses();
  assert.ok(courses.length >= 20);
  const rows = buildReviewSample(courses, { perCourse: 3, seed: 'revisao-1' });
  assert.ok(rows.length >= 55);
  for (const level of ['A1', 'A2', 'B1', 'B2']) assert.ok(rows.some((r) => r.nivel === level), `nível ${level} fora da amostra`);
  assert.ok(rows.every((r) => r.ingles && r.portugues), 'todas as linhas têm inglês e português');
  assert.ok(rows.filter((r) => r.ipa.startsWith('/') && r.ipa.endsWith('/')).length >= rows.length * 0.9, 'quase todas têm IPA calculado como no gerador');
});
