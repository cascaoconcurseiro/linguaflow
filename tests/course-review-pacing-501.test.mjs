// Issue #501: meta diária de revisão do curso, erro mais brando e medição de atraso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXTRA_REVIEW_BATCH,
  courseReviewPacing,
  courseReviewsLabel,
  planReviewSession,
} from '../dashboard/js/core/courseReviewPacing.js';
import { buildCourseStripModel, renderCourseStrip } from '../dashboard/js/ui/courses/courseHomeStrip.js';
import { buildTodayPlan } from '../dashboard/js/core/todayPlan.js';

const read = (p) => readFileSync(p, 'utf8');
const ids = (n) => Array.from({ length: n }, (_, i) => `u${i + 1}`);

test('ritmo: usa a meta do servidor e o total continua visível', () => {
  const p = courseReviewPacing({ reviews_due_count: 204, reviews_due_total: 204, reviews_due_today: 20, reviews_done_today: 0, reviews_daily_cap: 20, reviews_overdue_7d: 3 });
  assert.deepEqual(p, { total: 204, today: 20, backlog: 184, doneToday: 0, cap: 20, overdue7d: 3, capped: true });
});

test('ritmo: sem os campos novos (migration ainda não publicada) cai no comportamento atual', () => {
  const p = courseReviewPacing({ reviews_due_count: 12 });
  assert.equal(p.capped, false);
  assert.equal(p.today, 12);
  assert.equal(p.backlog, 0);
  assert.equal(p.cap, null);
  assert.deepEqual(courseReviewPacing(undefined).total, 0);
  assert.deepEqual(courseReviewPacing(null).today, 0);
});

test('ritmo: valores estranhos nunca ficam negativos nem passam do total', () => {
  const p = courseReviewPacing({ reviews_due_total: 5, reviews_due_today: 99, reviews_daily_cap: 20, reviews_done_today: -3 });
  assert.equal(p.today, 5);
  assert.equal(p.backlog, 0);
  assert.equal(p.doneToday, 0);
  assert.equal(courseReviewPacing({ reviews_due_total: -4, reviews_due_today: -1 }).total, 0);
});

test('texto: legado, meta de hoje, meta cumprida e vazio', () => {
  assert.equal(courseReviewsLabel(courseReviewPacing({ reviews_due_count: 1 })), '1 revisão vencida');
  assert.equal(courseReviewsLabel(courseReviewPacing({ reviews_due_count: 12 })), '12 revisões vencidas');
  const cap = { reviews_daily_cap: 20, reviews_done_today: 0 };
  assert.equal(courseReviewsLabel(courseReviewPacing({ ...cap, reviews_due_total: 204, reviews_due_count: 204, reviews_due_today: 20 })), '20 revisões para hoje · +184 na fila');
  assert.equal(courseReviewsLabel(courseReviewPacing({ ...cap, reviews_due_total: 15, reviews_due_count: 15, reviews_due_today: 15 })), '15 revisões para hoje');
  assert.equal(courseReviewsLabel(courseReviewPacing({ ...cap, reviews_due_total: 1, reviews_due_count: 1, reviews_due_today: 1 })), '1 revisão para hoje');
  assert.equal(courseReviewsLabel(courseReviewPacing({ ...cap, reviews_done_today: 20, reviews_due_total: 184, reviews_due_count: 184, reviews_due_today: 0 })), 'Meta de hoje feita · 184 na fila');
  assert.equal(courseReviewsLabel(courseReviewPacing({ ...cap, reviews_due_total: 0, reviews_due_count: 0, reviews_due_today: 0 })), '');
});

test('sessão: pega só as mais antigas até a meta de hoje', () => {
  const pacing = courseReviewPacing({ reviews_due_total: 50, reviews_due_today: 8, reviews_daily_cap: 20, reviews_done_today: 12 });
  const plan = planReviewSession(ids(50), pacing);
  assert.equal(plan.state, 'pending');
  assert.deepEqual(plan.todayIds, ids(8));
  assert.deepEqual(plan.extraIds, []);
});

test('sessão: meta cumprida não bloqueia, oferece mais 10 opcionais', () => {
  const pacing = courseReviewPacing({ reviews_due_total: 50, reviews_due_today: 0, reviews_daily_cap: 20, reviews_done_today: 20 });
  const plan = planReviewSession(ids(50), pacing);
  assert.equal(plan.state, 'goal-done');
  assert.deepEqual(plan.todayIds, []);
  assert.deepEqual(plan.extraIds, ids(EXTRA_REVIEW_BATCH));
  assert.equal(EXTRA_REVIEW_BATCH, 10);
});

test('sessão: sem revisões é vazio; sem meta do servidor mantém a lista inteira', () => {
  assert.equal(planReviewSession([], courseReviewPacing({ reviews_due_total: 0, reviews_due_today: 0, reviews_daily_cap: 20 })).state, 'empty');
  assert.equal(planReviewSession(undefined, courseReviewPacing({})).state, 'empty');
  const legacy = planReviewSession(ids(30), courseReviewPacing({ reviews_due_count: 30 }));
  assert.equal(legacy.state, 'pending');
  assert.equal(legacy.todayIds.length, 30);
});

test('faixa do Início: mostra a meta de hoje e o resto como fila', () => {
  const catalog = [{
    id: 'a', title: 'Curso a', level: 'B1',
    lessons: [{ id: 'a1', title: 'Aula', chapter_number: 1, unit_count: 20, my_best_answered: 0 }],
    my: { completed_lessons: [], in_my_courses: true },
  }];
  const m = buildCourseStripModel({
    catalog,
    summary: { continue: { lesson_id: 'a1' }, recent: [], reviews_due_count: 204, reviews_due_total: 204, reviews_due_today: 20, reviews_daily_cap: 20, reviews_done_today: 0, mistakes_count: 0 },
  });
  assert.equal(m.reviewsDue, 20);
  assert.equal(m.reviewsBacklog, 184);
  const html = renderCourseStrip(m);
  assert.match(html, /20 revisões para hoje · \+184 na fila/);
  assert.doesNotMatch(html, /204/);
});

test('faixa do Início: sem os campos novos mantém "revisões vencidas"', () => {
  const m = { kind: 'continue', courseId: 'a', lessonId: 'a1', courseTitle: 'Curso a', level: 'B1', chapter: 1, lessonTitle: 'Aula', percent: 0, reviewsDue: 12, mistakes: 0 };
  assert.match(renderCourseStrip(m), /12 revisões vencidas/);
});

test('plano de hoje: o curso conta só a meta e o resto aparece como "fica para outro dia"', () => {
  const plan = buildTodayPlan({ courseReviewsDue: 20, courseReviewsBacklog: 184, courseState: 'none' });
  const step = plan.steps.find((s) => s.id === 'course-reviews');
  assert.equal(step.count, 20);
  assert.equal(step.overflow, 184);
  assert.equal(step.seconds, 20 * 20);
  const none = buildTodayPlan({ courseReviewsDue: 20, courseState: 'none' }).steps.find((s) => s.id === 'course-reviews');
  assert.equal(none.overflow, 0, 'sem fila informada, nada muda');
});

test('migration: erro leva metade do caminho; resto da RPC idêntico ao anterior', () => {
  const oldSql = read('supabase/migrations/20260927180000_course_platform.sql');
  const newSql = read('supabase/migrations/20261005200000_course_review_debt.sql');
  const fn = (sql, name) => {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    assert.ok(start >= 0, `${name} existe`);
    const end = sql.indexOf('\n$$;', start);
    return sql.slice(start, end + 4);
  };
  const oldCommit = fn(oldSql, 'rpc_course_commit_practice');
  const newCommit = fn(newSql, 'rpc_course_commit_practice');
  const oldElse = '    ELSE\n      v_rep := 0;\n      v_interval := 1;\n    END IF;';
  const newElse = '    ELSE\n      v_rep := coalesce(v_rep, 0) / 2;\n      v_interval := 1;\n    END IF;';
  const oldComment = '    -- Revisão: acerto limpo avança 1 → 3 → 7 → 15 → ×2,2 (máx. 180); erro/dica volta a 1 dia.\n';
  const newComment = '    -- Revisão: acerto limpo avança 1 → 3 → 7 → 15 → ×2,2 (máx. 180). Erro, dica ou resposta\n    -- revelada traz a frase de volta em 1 dia, mas só leva metade do caminho de volta (#501).\n';
  assert.ok(oldCommit.includes(oldElse) && oldCommit.includes(oldComment));
  assert.equal(newCommit.replace(newElse, oldElse).replace(newComment, oldComment), oldCommit, 'só o bloco de erro mudou');
  assert.match(newSql, /GRANT EXECUTE ON FUNCTION public\.rpc_course_commit_practice\([^)]*\) TO authenticated;/);
  assert.match(newSql, /REVOKE ALL ON FUNCTION public\.rpc_course_commit_practice\([^)]*\) FROM PUBLIC, anon;/);
});

test('migration: resumo mantém reviews_due_count como total e acrescenta meta e atraso, sem tabela nova', () => {
  const newSql = read('supabase/migrations/20261005200000_course_review_debt.sql');
  for (const key of ['reviews_due_count', 'reviews_due_total', 'reviews_daily_cap', 'reviews_done_today', 'reviews_due_today', 'reviews_overdue_7d']) {
    assert.match(newSql, new RegExp(`'${key}'`), key);
  }
  assert.match(newSql, /SECURITY INVOKER/, 'resumo continua sob RLS do usuário');
  assert.match(newSql, /AT TIME ZONE tz\.name/, 'dia no fuso do usuário');
  const outsideFunctions = newSql.replace(/\$\$[\s\S]*?\$\$/g, '');
  assert.doesNotMatch(newSql, /CREATE TABLE|ALTER TABLE|DROP |TRUNCATE/i, 'migration não altera o esquema');
  assert.doesNotMatch(outsideFunctions, /\b(INSERT INTO|UPDATE|DELETE FROM)\b/i, 'migration não altera dados');
});

test('fiação: aba Revisão, selo, Início e plano usam a meta de hoje', () => {
  const notebooks = read('dashboard/js/ui/courses/courseNotebooks.js');
  assert.match(notebooks, /getHubSummary\(\)/, 'a aba busca o resumo');
  assert.match(notebooks, /planReviewSession\(/);
  assert.match(notebooks, /overdue7d/, 'mostra as atrasadas há mais de 7 dias');
  assert.match(notebooks, /Meta de hoje/, 'estado de meta concluída');
  const view = read('dashboard/js/ui/coursesView.js');
  assert.match(view, /courseReviewPacing\(summary\)/, 'selo da aba usa a meta de hoje');
  const home = read('dashboard/js/ui/courses/courseHome.js');
  assert.match(home, /courseReviewsLabel\(/);
  const homeView = read('dashboard/js/ui/homeView.js');
  assert.match(homeView, /courseReviewsBacklog:\s*courseModel\?\.reviewsBacklog/);
});

test('replay: o teste SQL de comportamento está no replay de migrations', () => {
  assert.match(read('tests/db/validate-migrations.sh'), /tests\/sql\/course-review-debt\.sql/);
});
