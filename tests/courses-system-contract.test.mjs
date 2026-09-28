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
  assert.match(schema, /course_user_vocabulary \(\r?\n  user_id UUID NOT NULL DEFAULT auth\.uid\(\)/, 'cliente não envia user_id');
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
  const views = ['coursesView', 'coursePracticeView', 'coursePrepareModal',
    'courses/courseUi', 'courses/courseHome', 'courses/courseStore', 'courses/courseNotebooks',
    'courses/courseAnalysis', 'courses/courseLeaderboard']
    .map((name) => read(`dashboard/js/ui/${name}.js`)).join('\n');
  assert.doesNotMatch(views, /SITUATIONAL_COURSES|FALLBACK_UNITS|DEMO_MISTAKES|DEMO_VOCABULARY/);
  assert.doesNotMatch(views, /speechSynthesis/, 'áudio pela voz neural (tts.js)');
  assert.doesNotMatch(views, /\bprompt\(/, 'nota com campo acessível, não prompt()');
  assert.doesNotMatch(views, /db\._fetch|db\.rpc\(/, 'acesso ao banco só pelo CoursesRepository');
  assert.doesNotMatch(views, /members only|Membros|assinatura|\$\d/i, 'tudo gratuito');
});

test('UI: player registra um único listener global e o remove ao sair', () => {
  const player = read('dashboard/js/ui/coursePracticeView.js');
  const adds = player.match(/container\.addEventListener\('keydown'/g) || [];
  assert.equal(adds.length, 1);
  assert.match(player, /container\.removeEventListener\('keydown', onKeydown\)/);
  assert.match(player, /window\.removeEventListener\('beforeunload', onBeforeUnload\)/);
  assert.match(player, /app\.onLeaveView\?\.\(/);
  const showUnitBody = player.slice(player.indexOf('function showUnit()'), player.indexOf('function updateActionStates()'));
  assert.doesNotMatch(showUnitBody, /container\.addEventListener/, 'trocar de frase não adiciona listener no container');
});

test('UI: player tem as funções do YouType mapeadas', () => {
  const player = read('dashboard/js/ui/coursePracticeView.js');
  for (const action of ['previous', 'replay', 'hint', 'submit', 'reveal', 'skip', 'settings', 'pause', 'theme', 'pop-speed', 'pop-readings']) {
    assert.match(player, new RegExp(`data-action="${action}"`), `ação ${action}`);
  }
  assert.match(player, /isSemicolon && e\.shiftKey/, 'Ctrl+Shift+; = dica da palavra');
  assert.match(player, /e\.code === 'Quote'/, "Ctrl+' = repetir áudio");
  assert.match(player, /HARD_SLOT_CH/, 'difícil sem pista de tamanho');
  assert.match(player, /commitIncomplete/, 'sair no meio grava sessão incompleta');
});

test('repositório: endpoints corretos e escrita sem user_id', async () => {
  const calls = [];
  const repo = new CoursesRepository({
    _fetch: async (endpoint, options = {}) => {
      calls.push({ endpoint, options });
      if (endpoint === 'rpc/rpc_course_catalog') {
        return [
          { id: 'c1', title: 'A', lessons: [
            { id: 'l1', chapter_number: 1, title: 'L1', unit_count: 10 },
            { id: 'l3', chapter_number: 3, title: 'vazia', unit_count: 0 },
          ] },
          { id: 'c2', title: 'Sem frases', lessons: [] },
        ];
      }
      return [];
    },
  });

  const catalog = await repo.listCatalog();
  assert.deepEqual(catalog.map((c) => c.id), ['c1'], 'curso sem frases não aparece');
  assert.deepEqual(catalog[0].lessons.map((l) => l.id), ['l1'], 'lição sem frases não aparece');

  await repo.saveVocabulary('unit-street-a1-01-01');
  assert.deepEqual(calls.at(-1).options.body, { unit_id: 'unit-street-a1-01-01' });

  await repo.getLesson('lesson-street-a1-01');
  assert.equal(calls.at(-1).options.throwOnReadError, true, 'falha de leitura vira estado de erro, não vazio');

  await assert.rejects(() => repo.getLesson('x&select=*'), /inválido/, 'id não injeta parâmetros no PostgREST');
  await assert.rejects(() => repo.getUnits(['ok-1', 'bad)']), /inválido/);
  await assert.rejects(() => repo.saveNote('unit-1', '   '), /vazia/);
  assert.throws(() => repo.getLeaderboard('yearly'), /período/);

  await repo.commitPractice({ clientSessionId: 'id', kind: 'mistakes', lessonId: 'l1', difficulty: 'hard', startedAt: 't', activeTimeSeconds: 5, score: 1, highestCombo: 1, results: [], completed: true });
  const commit = calls.at(-1);
  assert.equal(commit.endpoint, 'rpc/rpc_course_commit_practice');
  assert.equal(commit.options.body.p_lesson_id, null, 'prática de caderno não tem lição');
  assert.equal(commit.options.body.p_kind, 'mistakes');
  assert.ok(!('p_user_id' in commit.options.body));

  await repo.commitSession({ clientSessionId: 'id2', lessonId: 'l1', difficulty: 'easy', startedAt: 't', activeTimeSeconds: 1, score: 1, highestCombo: 1, results: [{ unit_id: 'u', attempts: 1, used_hint: true }] });
  assert.equal(calls.at(-1).options.body.p_results[0].hint_count, 1, 'pendência antiga (used_hint) é convertida');
});

test('plataforma: migration com sessões incompletas, resultados por frase e RPCs protegidas', () => {
  const sql = read('supabase/migrations/20260927180000_course_platform.sql');
  for (const fn of ['rpc_course_commit_practice', 'rpc_set_course_in_my_courses', 'rpc_course_catalog', 'rpc_course_analysis', 'rpc_course_leaderboard']) {
    assert.ok(new RegExp('REVOKE ALL ON FUNCTION public[.]' + fn + '[(][^)]*[)] FROM PUBLIC, anon;').test(sql), `${fn} sem anon`);
  }
  assert.match(sql, /course_session_results_select_own/);
  assert.match(sql, /CASE WHEN v_status = 'completed' THEN ARRAY\[p_lesson_id\]/, 'só sessão concluída conclui a lição');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.rpc_commit_course_session/, 'compatibilidade com clientes antigos');
  for (const idx of sql.match(/CREATE INDEX[^;]+;/g)) assert.doesNotMatch(idx, /now\(\)/);
});

test('conteúdo: seed gerado bate com a fonte e cobre 90 frases novas', async () => {
  const { generate } = await import('../scripts/generate-course-seed.mjs');
  const { sql, errors } = await generate();
  assert.deepEqual(errors, []);
  assert.equal(read('supabase/migrations/20260927180100_course_content.sql').replace(/\r\n/g, '\n'), sql, 'migration igual à saída do gerador');
  assert.equal((sql.match(/\('unit-[a-z0-9-]+', 'lesson-/g) || []).length, 90);
});

test('app: rotas de curso recebem os parâmetros de navegação', () => {
  const app = read('dashboard/js/core/app.js');
  assert.match(app, /const ROUTES_WITH_PARAMS = new Set\(\['study', 'courses', 'course-practice'\]\)/);
  assert.match(app, /ROUTES_WITH_PARAMS\.has\(route\)\s*\?\s*renderer\(guardedContainer, guardedApp, params\)/);
  assert.match(app, /courses: renderCourses,\s*'course-practice': renderCoursePractice,/);
});

test('conteúdo: cada lote publicado bate com o gerador e usa trilha válida', async () => {
  const { generateBatch } = await import('../scripts/generate-course-seed.mjs');
  const batches = {
    'fundamentos-1': 'supabase/migrations/20260928000100_course_content_fundamentos_1.sql',
    'verbos-1': 'supabase/migrations/20260928010000_course_content_verbos_1.sql',
    'viagem-1': 'supabase/migrations/20260928020000_course_content_viagem_1.sql',
    'palavras-1': 'supabase/migrations/20260928030000_course_content_palavras_1.sql',
    'viagem-2': 'supabase/migrations/20260928040000_course_content_viagem_2.sql',
    'viagem-3': 'supabase/migrations/20260928050000_course_content_viagem_3.sql',
    'viagem-4': 'supabase/migrations/20260928060000_course_content_viagem_4.sql',
    'viagem-5': 'supabase/migrations/20260928070000_course_content_viagem_5.sql',
    'viagem-6': 'supabase/migrations/20260928080000_course_content_viagem_6.sql',
    'palavras-2': 'supabase/migrations/20260928090000_course_content_palavras_2.sql',
    'palavras-3': 'supabase/migrations/20260928100000_course_content_palavras_3.sql',
    'palavras-4': 'supabase/migrations/20260928110000_course_content_palavras_4.sql',
    'verbos-2': 'supabase/migrations/20260928120000_course_content_verbos_2.sql',
  };
  for (const [name, file] of Object.entries(batches)) {
    const { sql, errors, courses } = await generateBatch(name);
    assert.deepEqual(errors, [], name);
    assert.equal(read(file).replace(/\r\n/g, '\n'), sql, `${file} igual à saída do gerador`);
    for (const c of courses) assert.ok(c.track && c.trackOrder >= 1, `${c.id} com trilha`);
  }
});

test('trilha: RPC protegida, nível por 80% e nivelamento como ponto de partida', () => {
  const sql = read('supabase/migrations/20260928000000_course_path.sql').replace(/\r\n/g, '\n');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.rpc_course_path\(\) FROM PUBLIC, anon;/);
  assert.match(sql, />= 0\.8\) AS is_completed/);
  assert.match(sql, /s\.key = 'lf_cefr_level'/);
  assert.match(sql, /'word', 'verb_forms', 'phrasal', 'story'/);
  const player = read('dashboard/js/ui/coursePracticeView.js');
  assert.match(player, /WORD_KINDS\.has\(unit\.kind\)/, 'pista de significado para palavra/verbo');
  const home = read('dashboard/js/ui/courses/courseHome.js');
  assert.match(home, /data-path-next/, 'próxima aula recomendada');
});

test('catálogo: expõe unit_kind e a UI nomeia a contagem pelo tipo', async () => {
  const sql = read('supabase/migrations/20260928000200_course_catalog_unit_kind.sql');
  assert.match(sql, /'unit_kind', \(SELECT mode\(\) WITHIN GROUP \(ORDER BY u\.kind\)/);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  const { unitCount, plural } = await import('../dashboard/js/ui/courses/courseUi.js');
  assert.equal(unitCount({ unit_kind: 'word' }, 20), '20 palavras');
  assert.equal(unitCount({ unit_kind: 'verb_forms' }, 1), '1 verbo');
  assert.equal(unitCount({}, 3), '3 frases');
  assert.equal(plural(1, 'capítulo', 'capítulos'), '1 capítulo');
});

test('conteúdo: lotes novos exigem nota gramatical em toda unidade que não é palavra', async () => {
  const { generateFrom } = await import('../scripts/generate-course-seed.mjs');
  const course = (unit) => [{ id: 'c', slug: 'c', title: 'C', level: 'A1', category: 'grammar', track: 'fundamentos', trackOrder: 1, order: 1,
    lessons: [{ id: 'lesson-c-01', chapter: 1, title: 'T', units: [unit] }] }];
  const lexicon = { go: ['verb', '/ɡoʊ/', 'ir'] };
  const missing = generateFrom(course({ kind: 'sentence', text: 'go', pt: 'ir' }), { lexicon, requireNotes: true });
  assert.ok(missing.errors.some((e) => e.includes('nota gramatical obrigatória')));
  const word = generateFrom(course({ kind: 'word', text: 'go', pt: 'ir' }), { lexicon, requireNotes: true });
  assert.deepEqual(word.errors, []);
  const retired = generateFrom([{ ...course({ kind: 'word', text: 'go', pt: 'ir' })[0], retireUnits: ["unit-x-'01"] }], { lexicon });
  assert.ok(retired.sql.includes("DELETE FROM public.course_units WHERE id IN ('unit-x-''01');"));
});

test('UI: sair da prática usa diálogo próprio e a rota sobrevive ao recarregar', () => {
  const player = read('dashboard/js/ui/coursePracticeView.js');
  assert.doesNotMatch(player, /[^.\w]confirm\(/, 'sem confirm() nativo, que congela a página');
  assert.match(player, /id="course-exit" role="alertdialog" aria-modal="true"/);
  assert.match(player, /'confirm-exit': leavePractice/);
  const app = read('dashboard/js/core/app.js');
  assert.match(app, /const RESTORABLE_ROUTES = new Set\(\[[^\]]*'courses'/);
  assert.match(app, /this\.navigate\(RESTORABLE_ROUTES\.has\(hashRoute\) \? hashRoute : 'home'\)/);
  assert.match(app, /route === 'course-practice' \? 'courses'/);
  assert.match(app, /addEventListener\('hashchange'/);
});

test('UI: tema com opção Sistema e indicador de áudio no modo difícil', () => {
  const app = read('dashboard/js/core/app.js');
  assert.match(app, /\['light', 'dark', 'system'\]\.includes\(theme\)/);
  assert.match(app, /prefers-color-scheme: dark/);
  const player = read('dashboard/js/ui/coursePracticeView.js');
  assert.match(player, /<option value="system"/);
  assert.match(player, /id="course-audio-cue" aria-hidden="true"/);
  const css = read('dashboard/css/course-player.css');
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*course-audio-cue\.is-playing span \{ animation: none/);
  assert.match(css, /\.course-reduce-motion \.course-audio-cue\.is-playing span \{ animation: none/);
});
