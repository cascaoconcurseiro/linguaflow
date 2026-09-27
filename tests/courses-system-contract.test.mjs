// Contratos do domínio de Cursos: banco (RLS, idempotência, RPC), conteúdo
// real do seed e ausência de dados fictícios / listeners vazados na UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokenizeSentence } from '../dashboard/js/core/inputEngine.js';
import { CoursesRepository } from '../utils/db/courses-repo.js';

const read = (p) => readFileSync(p, 'utf8');
const schema = read('supabase/migrations/20260927150000_course_system.sql');
const rpcs = read('supabase/migrations/20260927150100_course_rpcs.sql');
const seed = read('supabase/migrations/20260927150200_course_seed_street_english_a1.sql');

test('schema: índices sem funções voláteis e sem paywall', () => {
  // now() em predicado de índice parcial faz a migration falhar no Postgres.
  for (const idx of schema.match(/CREATE INDEX[^;]+;/g)) {
    assert.doesNotMatch(idx, /now\(\)/i, idx);
  }
  assert.doesNotMatch(schema, /members_only|free_chapters/i, 'tudo gratuito: sem capítulos restritos');
});

test('schema: progresso, sessões, erros e revisões não aceitam escrita direta do cliente', () => {
  for (const table of ['course_practice_sessions', 'course_user_mistakes', 'course_user_reviews']) {
    const policies = schema.match(new RegExp(`CREATE POLICY \\w+ ON public\\.${table}[^;]+;`, 'g')) || [];
    assert.ok(policies.length > 0, `${table} tem política`);
    for (const p of policies) assert.match(p, /FOR SELECT/, `${table} só leitura: ${p}`);
  }
  const enrollment = schema.match(/CREATE POLICY \w+ ON public\.user_course_enrollment[^;]+;/g);
  assert.ok(enrollment.every((p) => /FOR (SELECT|DELETE)/.test(p)), 'matrícula: sem INSERT/UPDATE direto');
  assert.match(schema, /UNIQUE \(user_id, client_session_id\)/, 'sessão idempotente');
  assert.match(schema, /course_user_vocabulary \(\n  user_id UUID NOT NULL DEFAULT auth\.uid\(\)/, 'cliente não envia user_id');
});

test('RPC: autoritativa, sem user_id do cliente e sem acesso anônimo', () => {
  assert.match(rpcs, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.doesNotMatch(rpcs, /p_user_id/);
  assert.match(rpcs, /v_user_id UUID := auth\.uid\(\)/);
  assert.match(rpcs, /REVOKE ALL ON FUNCTION public\.rpc_commit_course_session\([^)]*\) FROM PUBLIC, anon;/);
  assert.match(rpcs, /results do not match lesson units/, 'resultados precisam cobrir a lição');
  assert.match(rpcs, /v_accuracy := round\(v_first_try/, 'precisão calculada no servidor');
  assert.match(rpcs, /least\(coalesce\(p_active_time_seconds, 0\),/, 'tempo ativo limitado à duração real');
  assert.match(rpcs, /'replayed', true/, 'retry devolve a sessão existente');
  assert.doesNotMatch(rpcs, /EXCEPTION WHEN OTHERS THEN\s+NULL/i, 'sem erro engolido');
});

test('seed: 10 frases reais com tradução, IPA e anotações; sem áudio fictício', () => {
  assert.doesNotMatch(seed, /cdn\.linguaflow\.app|\.mp3/);
  const rows = [...seed.matchAll(/\(\s*'(unit-street-a1-01-\d+)', 'lesson-street-a1-01', (\d+), 'slang_idiom', '((?:[^']|'')+)', '((?:[^']|'')+)', '(\/[^']+\/)'/g)];
  assert.equal(rows.length, 10);
  for (const [, id, order, text] of rows) {
    const sentence = text.replace(/''/g, "'");
    const tokens = tokenizeSentence(sentence);
    assert.ok(tokens.length >= 2, `${id} tokeniza`);
    assert.ok(tokens.every((t) => t.cleanWord.length > 0), `${id} sem slot vazio`);
    assert.ok(Number(order) >= 1);
  }
  assert.match(seed, /ON CONFLICT \(id\) DO UPDATE/, 'seed idempotente');
});

test('UI: sem catálogo fixo, sem dados de demonstração, sem voz robótica', () => {
  const views = ['coursesView', 'coursePracticeView', 'courseNotebooksView', 'coursePrepareModal']
    .map((name) => read(`dashboard/js/ui/${name}.js`)).join('\n');
  assert.doesNotMatch(views, /SITUATIONAL_COURSES|FALLBACK_UNITS|DEMO_MISTAKES|DEMO_VOCABULARY/);
  assert.doesNotMatch(views, /speechSynthesis/, 'áudio pela voz neural (tts.js)');
  assert.doesNotMatch(views, /\bprompt\(/, 'nota com campo acessível, não prompt()');
  assert.doesNotMatch(views, /db\._fetch|db\.rpc/, 'acesso ao banco só pelo CoursesRepository');
});

test('UI: player registra um único listener global e o remove ao sair', () => {
  const player = read('dashboard/js/ui/coursePracticeView.js');
  const adds = player.match(/container\.addEventListener\('keydown'/g) || [];
  assert.equal(adds.length, 1);
  assert.match(player, /container\.removeEventListener\('keydown', onKeydown\)/);
  assert.match(player, /app\.onLeaveView\?\.\(/);
  const renderShellBody = player.slice(player.indexOf('function showUnit()'), player.indexOf('function updateHud()'));
  assert.doesNotMatch(renderShellBody, /container\.addEventListener/, 'trocar de frase não adiciona listener no container');
});

test('repositório: endpoints corretos e escrita sem user_id', async () => {
  const calls = [];
  const repo = new CoursesRepository({
    _fetch: async (endpoint, options = {}) => {
      calls.push({ endpoint, options });
      if (endpoint.startsWith('course_catalog')) {
        return [
          { id: 'c1', title: 'A', course_lessons: [
            { id: 'l2', chapter_number: 2, title: 'L2', course_units: [{ count: 5 }] },
            { id: 'l1', chapter_number: 1, title: 'L1', course_units: [{ count: 10 }] },
            { id: 'l3', chapter_number: 3, title: 'vazia', course_units: [{ count: 0 }] },
          ] },
          { id: 'c2', title: 'Sem frases', course_lessons: [] },
        ];
      }
      return [];
    },
  });

  const catalog = await repo.listCatalog();
  assert.deepEqual(catalog.map((c) => c.id), ['c1'], 'curso sem frases não aparece');
  assert.deepEqual(catalog[0].lessons.map((l) => l.id), ['l1', 'l2'], 'lições ordenadas e sem vazias');
  assert.equal(calls[0].options.throwOnReadError, true, 'falha de leitura vira estado de erro, não vazio');

  await repo.saveVocabulary('unit-street-a1-01-01');
  const vocab = calls.at(-1);
  assert.deepEqual(vocab.options.body, { unit_id: 'unit-street-a1-01-01' });

  await assert.rejects(() => repo.getLesson('x&select=*'), /inválido/, 'id não injeta parâmetros no PostgREST');
  await assert.rejects(() => repo.saveNote('unit-1', '   '), /vazia/);

  await repo.commitSession({ clientSessionId: 'id', lessonId: 'l1', difficulty: 'hard', startedAt: 't', activeTimeSeconds: 5, score: 1, highestCombo: 1, results: [] });
  const commit = calls.at(-1);
  assert.equal(commit.endpoint, 'rpc/rpc_commit_course_session');
  assert.equal(typeof commit.options.body, 'object', 'corpo como objeto: _fetch define Content-Type JSON');
  assert.ok(!('p_user_id' in commit.options.body));
});

test('app: rotas de curso recebem os parâmetros de navegação', () => {
  const app = read('dashboard/js/core/app.js');
  assert.match(app, /const ROUTES_WITH_PARAMS = new Set\(\['study', 'courses', 'course-practice'\]\)/);
  assert.match(app, /ROUTES_WITH_PARAMS\.has\(route\)\s*\?\s*renderer\(guardedContainer, guardedApp, params\)/);
  assert.match(app, /courses: renderCourses,\s*'course-practice': renderCoursePractice,/);
});
