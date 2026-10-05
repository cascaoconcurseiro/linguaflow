// tests/today-plan.test.mjs — Plano de hoje e freio de entrada (#495): regras puras, liberação e contratos de fiação.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_INTAKE_PAUSE_DUE,
  INTAKE_RELEASE_PER_DAY,
  INTAKE_WAIT_TAG,
  canReleaseHeldWords,
  countOverdueReviews,
  nextReleaseState,
  releaseQuota,
  resolveIntakePauseDue,
  shouldHoldNewWord,
  wordFrequencyRank,
} from '../utils/intake-guard.js';
import { releaseHeldWords } from '../dashboard/js/core/intakeRelease.js';
import {
  DEFAULT_REVIEW_PACING_CAP,
  SECONDS_PER_CARD,
  buildTodayPlan,
  estimateMinutes,
} from '../dashboard/js/core/todayPlan.js';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const past = '2026-10-04T12:00:00Z';
const future = '2026-10-06T12:00:00Z';

test('freio: limiar vazio/inválido usa o padrão, 0 desliga, negativo vira 0', () => {
  assert.equal(resolveIntakePauseDue(undefined), DEFAULT_INTAKE_PAUSE_DUE);
  assert.equal(resolveIntakePauseDue(''), DEFAULT_INTAKE_PAUSE_DUE);
  assert.equal(resolveIntakePauseDue('abc'), DEFAULT_INTAKE_PAUSE_DUE);
  assert.equal(resolveIntakePauseDue('0'), 0);
  assert.equal(resolveIntakePauseDue(-5), 0);
  assert.equal(resolveIntakePauseDue('25'), 25);
});

test('freio: só vencidas de verdade contam; card novo, suspenso e futuro não são dívida', () => {
  const cards = [
    { status: 'review', due_date: past },
    { status: 'learning', due_date: past },
    { status: 'mature', due_date: past, suspended: true },
    { status: 'new', due_date: past },
    { status: 'review', due_date: future },
    { status: 'review' },
    null,
  ];
  assert.equal(countOverdueReviews(cards, NOW), 2);
});

test('freio: segura só acima do limiar e solta com histerese; limiar 0 nunca segura e sempre solta', () => {
  assert.equal(shouldHoldNewWord({ overdue: 40, threshold: 40 }), false);
  assert.equal(shouldHoldNewWord({ overdue: 41, threshold: 40 }), true);
  assert.equal(shouldHoldNewWord({ overdue: 999, threshold: 0 }), false);
  assert.equal(canReleaseHeldWords({ overdue: 21, threshold: 40 }), false);
  assert.equal(canReleaseHeldWords({ overdue: 20, threshold: 40 }), true);
  assert.equal(canReleaseHeldWords({ overdue: 999, threshold: 0 }), true);
});

test('freio: cota diária de liberação reinicia no dia seguinte', () => {
  const today = '2026-10-05';
  assert.equal(releaseQuota({ threshold: 40, state: null, todayKey: today }), INTAKE_RELEASE_PER_DAY);
  assert.equal(releaseQuota({ threshold: 40, state: `${today}:3`, todayKey: today }), INTAKE_RELEASE_PER_DAY - 3);
  assert.equal(releaseQuota({ threshold: 40, state: `${today}:5`, todayKey: today }), 0);
  assert.equal(releaseQuota({ threshold: 40, state: '2026-10-04:5', todayKey: today }), INTAKE_RELEASE_PER_DAY);
  assert.equal(releaseQuota({ threshold: 0, state: `${today}:5`, todayKey: today }), Number.POSITIVE_INFINITY);
  assert.equal(nextReleaseState({ state: `${today}:2`, todayKey: today, released: 3 }), `${today}:5`);
  assert.equal(nextReleaseState({ state: '2026-10-04:5', todayKey: today, released: 2 }), `${today}:2`);
});

function fakeDb({ threshold = '40', overdueCount = 0, held = 8, state = null } = {}) {
  const settings = { lf_intake_pause_due: threshold, lf_intake_release_state: state };
  const cards = [];
  const words = [];
  for (let i = 0; i < overdueCount; i++) cards.push({ id: `r${i}`, word_id: `rw${i}`, status: 'review', due_date: past });
  for (let i = 0; i < held; i++) {
    words.push({ id: `h${i}`, tags: ['x', INTAKE_WAIT_TAG] });
    cards.push({ id: `hc${i}`, word_id: `h${i}`, status: 'new', suspended: true, due_date: `2026-10-0${1 + (i % 3)}T00:00:0${i}Z` });
  }
  const calls = { unsuspended: [], tags: {}, events: [] };
  return {
    calls,
    settings,
    getSetting: async (k) => settings[k] ?? null,
    setSetting: async (k, v) => { settings[k] = v; },
    getAllCards: async () => cards,
    getAllWords: async () => words,
    setCardSuspended: async (id, v) => { if (!v) calls.unsuspended.push(id); },
    addTagsToWord: async (id, tags) => { calls.tags[id] = tags; },
    logUsageEvent: async (e) => { calls.events.push(e); },
  };
}

test('liberação: fila baixa devolve só a cota do dia, as mais antigas primeiro, e remove a tag', async () => {
  const db = fakeDb({ overdueCount: 10, held: 8 });
  const r = await releaseHeldWords(db, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(r.released, INTAKE_RELEASE_PER_DAY);
  assert.equal(r.held, 8 - INTAKE_RELEASE_PER_DAY);
  assert.equal(db.calls.unsuspended.length, INTAKE_RELEASE_PER_DAY);
  assert.ok(Object.values(db.calls.tags).every((t) => !t.includes(INTAKE_WAIT_TAG) && t.includes('x')));
  assert.equal(db.settings.lf_intake_release_state, `2026-10-05:${INTAKE_RELEASE_PER_DAY}`);
  assert.deepEqual(db.calls.events, ['intake_released']);
  const again = await releaseHeldWords(db, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(again.released, 0, 'segunda abertura no mesmo dia não libera de novo');
  assert.equal(again.blocked, 'daily_limit');
});

test('liberação: dívida ainda alta mantém tudo em espera', async () => {
  const db = fakeDb({ overdueCount: 30, held: 3 });
  const r = await releaseHeldWords(db, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(r.released, 0);
  assert.equal(r.blocked, 'backlog');
  assert.equal(db.calls.unsuspended.length, 0);
});

test('liberação: limiar 0 (reversão) devolve tudo de uma vez, mesmo com dívida alta', async () => {
  const db = fakeDb({ threshold: '0', overdueCount: 200, held: 8 });
  const r = await releaseHeldWords(db, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(r.released, 8);
  assert.equal(r.held, 0);
});

test('liberação: sem palavras seguradas não faz nada; falha do banco nunca lança', async () => {
  const none = await releaseHeldWords(fakeDb({ held: 0 }), { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(none.released, 0);
  const broken = { getSetting: async () => { throw new Error('rede'); }, getAllCards: async () => [], getAllWords: async () => [] };
  const r = await releaseHeldWords(broken, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(r.blocked, 'error');
});

test('plano: passos na ordem cards → revisões do curso → lição, com tempo estimado', () => {
  const plan = buildTodayPlan({
    dueCards: 20, dueLearning: 4, courseReviewsDue: 6, courseState: 'continue',
    lesson: { courseId: 'c1', lessonId: 'l1', title: 'Cumprimentos', chapter: 3 }, courseTodaySeconds: 0,
  });
  assert.equal(plan.state, 'pending');
  assert.deepEqual(plan.steps.map((s) => s.id), ['cards', 'course-reviews', 'lesson']);
  assert.equal(plan.primary.id, 'cards');
  assert.equal(plan.steps[0].seconds, 20 * SECONDS_PER_CARD);
  assert.deepEqual(plan.steps[2].params, { tab: 'course', courseId: 'c1', openLessonId: 'l1' });
  assert.equal(plan.totalMinutes, estimateMinutes(plan.steps.reduce((a, s) => a + s.seconds, 0)));
});

test('plano: respeita o teto diário de revisões e nunca adia as que voltam em minutos', () => {
  const plan = buildTodayPlan({ dueCards: 120, dueLearning: 10, courseState: 'none' });
  const cards = plan.steps[0];
  assert.equal(cards.count, 10 + DEFAULT_REVIEW_PACING_CAP);
  assert.equal(cards.overflow, 120 - cards.count);
  assert.equal(cards.learning, 10);
});

test('plano: lição já praticada hoje sai do plano; sem nada vencido o estado é "acabou"', () => {
  const plan = buildTodayPlan({ courseState: 'continue', lesson: { courseId: 'c1', lessonId: 'l1' }, courseTodaySeconds: 600 });
  assert.equal(plan.state, 'done');
  assert.equal(plan.primary, null);
  assert.equal(plan.totalMinutes, 0);
});

test('plano: curso fora do ar é declarado, não vira zero silencioso; entradas inválidas não quebram', () => {
  const plan = buildTodayPlan({ dueCards: 3, courseState: 'error' });
  assert.equal(plan.courseUnavailable, true);
  assert.deepEqual(plan.steps.map((s) => s.id), ['cards']);
  const junk = buildTodayPlan({ dueCards: 'x', dueLearning: -4, courseReviewsDue: null, heldCount: 'a' });
  assert.equal(junk.state, 'done');
  assert.equal(junk.heldCount, 0);
  const start = buildTodayPlan({ courseState: 'start', lesson: { courseId: 'c9', title: 'Primeiras frases' } });
  assert.deepEqual(start.steps[0].params, { tab: 'course', courseId: 'c9', openLessonId: null });
});

// ── Contratos de fiação (estruturais: não substituem QA no navegador) ──
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('contrato: o freio está no salvamento, usa o mecanismo de espera existente e não bloqueia o save', () => {
  const words = read('utils/db/words.js');
  assert.match(words, /resolveIntakePauseDue\(await this\.getSetting\('lf_intake_pause_due'\)\)/);
  assert.match(words, /INTAKE_WAIT_TAG/);
  assert.match(words, /o freio nunca pode bloquear o save/);
  assert.match(words, /waitingReason/);
});

test('contrato: Início só troca o bloco quando a chave não é "off"; a liberação roda sempre', () => {
  const home = read('dashboard/js/ui/homeView.js');
  assert.match(home, /export const TODAY_PLAN_KEY = 'lf_today_plan'/);
  assert.match(home, /!== 'off'/);
  assert.match(home, /const releasePromise = releaseHeldWords\(db\)/, 'liberar não depende da chave do plano');
  assert.match(home, /planHtml \|\| `<section id="home-primary-plan" class="home-primary-plan" data-plan-kind=/, 'bloco antigo preservado como fallback');
});

test('contrato: configurações salvam as duas chaves e a migration libera os eventos novos', () => {
  const settings = read('dashboard/js/ui/settingsView.js');
  for (const key of ['lf_intake_pause_due', 'lf_today_plan']) {
    assert.ok(settings.includes(`'${key}'`), `${key} deve estar nas chaves lidas e gravadas`);
    assert.ok(settings.includes(`setSetting('${key}'`), `${key} deve ser gravada`);
  }
  const migration = read('supabase/migrations/20261005100000_usage_events_today_plan.sql');
  for (const event of ['today_plan_step', 'today_plan_done', 'intake_held', 'intake_released']) {
    assert.ok(migration.includes(`'${event}'`), `${event} deve estar na lista fechada`);
  }
  assert.match(migration, /Rollback:/);
});

test('contrato: a view do plano escapa conteúdo do curso e expõe lista numerada e estados anunciáveis', () => {
  const view = read('dashboard/js/ui/todayPlanView.js');
  assert.match(view, /escapeHTML\(title\)/);
  assert.match(view, /escapeHTML\(detail\)/);
  assert.match(view, /<ol class="today-steps" aria-label=/);
  assert.match(view, /role="status"/);
  assert.match(view, /:focus-visible/);
  assert.doesNotMatch(view, /animation|transition|@keyframes/, 'sem movimento ornamental');
});

test('contrato: o aviso de espera chega ao popup do vídeo (service worker → motor → popup), sem perder o salvamento', () => {
  const sw = read('background/service-worker.js');
  assert.match(sw, /notifyDashboards\(item\.payload\.word, \{ held: result\.waitingReason === 'backlog' \}\)/);
  assert.match(sw, /type: 'REFRESH_VOCAB', word: word \|\| null, held/);
  const engine = read('content/subtitle-engine.js');
  assert.match(engine, /request\.held && request\.word\) this\.wordPopup\?\.showHeldNotice\?\.\(request\.word\)/);
  const popup = read('content/word-popup/save.js');
  assert.match(popup, /showHeldNotice\(word\)/);
  assert.match(popup, /ficou em espera/);
  assert.match(popup, /aria-live', 'polite'/);
  assert.match(popup, /prefers-reduced-motion: reduce\) \{ #lf-save-toast/);
});

test('frequência: Top N vem antes de sem marca, que vem antes de rara', () => {
  assert.equal(wordFrequencyRank(['x', '🔥 Top 312']), 312);
  assert.equal(wordFrequencyRank(['📊 Top 2400', '🔥 Top 900']), 900);
  assert.ok(wordFrequencyRank(['📊 Top 4999']) < wordFrequencyRank([]));
  assert.ok(wordFrequencyRank([]) < wordFrequencyRank(['✨ Rara (>5k)']));
  assert.equal(wordFrequencyRank(null), wordFrequencyRank([]));
});

test('liberação: sai primeiro a palavra mais frequente, não a mais antiga', async () => {
  const db = fakeDb({ overdueCount: 0, held: 0 });
  const tagsById = { rara: ['✨ Rara (>5k)', INTAKE_WAIT_TAG], comum: ['🔥 Top 120', INTAKE_WAIT_TAG], media: ['📊 Top 3000', INTAKE_WAIT_TAG], semmarca: [INTAKE_WAIT_TAG] };
  const words = Object.entries(tagsById).map(([id, tags]) => ({ id, tags }));
  // A rara foi salva primeiro (due_date mais antigo) e ainda assim deve sair por último.
  const dates = { rara: '2026-10-01T00:00:00Z', semmarca: '2026-10-02T00:00:00Z', media: '2026-10-03T00:00:00Z', comum: '2026-10-04T00:00:00Z' };
  const cards = Object.keys(tagsById).map((id) => ({ id: `c-${id}`, word_id: id, status: 'new', suspended: true, due_date: dates[id] }));
  Object.assign(db, { getAllWords: async () => words, getAllCards: async () => cards });
  db.settings.lf_intake_release_state = `2026-10-05:${INTAKE_RELEASE_PER_DAY - 3}`; // sobram 3 vagas hoje
  const r = await releaseHeldWords(db, { todayKey: '2026-10-05', nowMs: NOW });
  assert.equal(r.released, 3);
  assert.deepEqual(db.calls.unsuspended, ['c-comum', 'c-media', 'c-semmarca']);
});
