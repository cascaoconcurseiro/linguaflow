-- Teste comportamental da plataforma de Cursos (sessões incompletas, prática de
-- caderno, Meus cursos, catálogo, início, análise e ranking). Só em banco LOCAL
-- descartável (scripts/replay-migrations-local.ps1). Sucesso = 'course_platform_ok'.

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@test.local', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@test.local', '{}', '{}', now(), now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

DO $$
DECLARE
  v_catalog JSONB;
  v_res JSONB;
  v_results JSONB;
  v_count INT;
  v_summary JSONB;
  v_analysis JSONB;
  v_board JSONB;
BEGIN
  -- Catálogo: 3 cursos, 10 lições, nenhuma lição vazia; ninguém matriculado ainda
  v_catalog := public.rpc_course_catalog();
  IF jsonb_array_length(v_catalog) <> 3 THEN RAISE EXCEPTION 'catálogo esperava 3 cursos: %', jsonb_array_length(v_catalog); END IF;
  SELECT sum(jsonb_array_length(c->'lessons')) INTO v_count FROM jsonb_array_elements(v_catalog) c;
  IF v_count <> 10 THEN RAISE EXCEPTION 'catálogo esperava 10 lições: %', v_count; END IF;

  -- Meus cursos: adicionar sem progresso
  PERFORM public.rpc_set_course_in_my_courses('course-travel-a2', true);
  SELECT count(*) INTO v_count FROM public.user_course_enrollment WHERE course_id = 'course-travel-a2' AND in_my_courses;
  IF v_count <> 1 THEN RAISE EXCEPTION 'adicionar a Meus cursos falhou'; END IF;

  -- Sessão incompleta: 3 de 10 respondidas; não conclui a lição, conta tempo
  SELECT jsonb_agg(jsonb_build_object('unit_id', id, 'attempts', 1, 'hint_count', 0, 'revealed', false) ORDER BY order_index)
  INTO v_results FROM (SELECT * FROM public.course_units WHERE lesson_id = 'lesson-travel-a2-01' ORDER BY order_index LIMIT 3) u;
  v_res := public.rpc_course_commit_practice('33333333-3333-4333-8333-333333333333', 'lesson', 'lesson-travel-a2-01', 'medium',
    now() - INTERVAL '3 minutes', 120, 300, 3, v_results, false);
  IF v_res->>'status' <> 'incomplete' THEN RAISE EXCEPTION 'esperava incompleta: %', v_res; END IF;
  SELECT cardinality(completed_lessons) INTO v_count FROM public.user_course_enrollment WHERE course_id = 'course-travel-a2';
  IF v_count <> 0 THEN RAISE EXCEPTION 'incompleta não pode concluir a lição'; END IF;

  -- Concluir exige todas as frases
  BEGIN
    PERFORM public.rpc_course_commit_practice(gen_random_uuid(), 'lesson', 'lesson-travel-a2-01', 'medium',
      now() - INTERVAL '1 minute', 10, 0, 0, v_results, true);
    RAISE EXCEPTION 'concluiu com frases faltando';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Lição completa com dica e erro
  SELECT jsonb_agg(jsonb_build_object('unit_id', id,
      'attempts', CASE WHEN order_index = 1 THEN 2 ELSE 1 END,
      'hint_count', CASE WHEN order_index = 2 THEN 1 ELSE 0 END,
      'revealed', false,
      'wrong_text', CASE WHEN order_index = 1 THEN 'id like to chek in' END) ORDER BY order_index)
  INTO v_results FROM public.course_units WHERE lesson_id = 'lesson-travel-a2-01';
  v_res := public.rpc_course_commit_practice('44444444-4444-4444-8444-444444444444', 'lesson', 'lesson-travel-a2-01', 'hard',
    now() - INTERVAL '6 minutes', 300, 1500, 8, v_results, true);
  IF v_res->>'status' <> 'completed' THEN RAISE EXCEPTION 'esperava concluída: %', v_res; END IF;
  IF (v_res->>'percent_completed')::NUMERIC <> 33.33 THEN RAISE EXCEPTION 'progresso esperado 33.33 (1 de 3 lições): %', v_res; END IF;
  SELECT count(*) INTO v_count FROM public.course_session_results WHERE session_id = (v_res->>'session_id')::UUID;
  IF v_count <> 10 THEN RAISE EXCEPTION 'resultado por frase não gravado: %', v_count; END IF;

  -- Prática do caderno de erros: sem lição, resolve o erro com acerto limpo
  SELECT jsonb_agg(jsonb_build_object('unit_id', unit_id, 'attempts', 1, 'hint_count', 0, 'revealed', false))
  INTO v_results FROM public.course_user_mistakes WHERE NOT is_resolved;
  IF jsonb_array_length(v_results) <> 1 THEN RAISE EXCEPTION 'esperava 1 erro pendente'; END IF;
  v_res := public.rpc_course_commit_practice('55555555-5555-4555-8555-555555555555', 'mistakes', NULL, 'hard',
    now() - INTERVAL '1 minute', 30, 100, 1, v_results, true);
  SELECT count(*) INTO v_count FROM public.course_user_mistakes WHERE NOT is_resolved;
  IF v_count <> 0 THEN RAISE EXCEPTION 'prática de erros não resolveu'; END IF;
  SELECT count(*) INTO v_count FROM public.course_user_mistakes;
  IF v_count <> 1 THEN RAISE EXCEPTION 'histórico do erro deve continuar'; END IF;
  BEGIN
    PERFORM public.rpc_course_commit_practice(gen_random_uuid(), 'mistakes', 'lesson-travel-a2-01', 'hard', now(), 1, 0, 0, v_results, true);
    RAISE EXCEPTION 'caderno aceitou lição';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Cliente antigo (assinatura de 8 argumentos) continua funcionando
  SELECT jsonb_agg(jsonb_build_object('unit_id', id, 'attempts', 1, 'used_hint', false) ORDER BY order_index)
  INTO v_results FROM public.course_units WHERE lesson_id = 'lesson-street-a1-01';
  v_res := public.rpc_commit_course_session('66666666-6666-4666-8666-666666666666', 'lesson-street-a1-01', 'easy',
    now() - INTERVAL '2 minutes', 60, 1000, 10, v_results);
  IF v_res->>'status' <> 'completed' THEN RAISE EXCEPTION 'wrapper antigo falhou: %', v_res; END IF;

  -- Início: continuar, semana com hoje, tempo total
  v_summary := public.rpc_get_course_hub_summary();
  -- Na mesma transação now() é igual para as duas matrículas; basta existir um capítulo para continuar.
  IF v_summary->'continue'->>'lesson_id' NOT IN ('lesson-street-a1-01', 'lesson-travel-a2-01') THEN RAISE EXCEPTION 'continuar errado: %', v_summary->'continue'; END IF;
  IF jsonb_array_length(v_summary->'week') <> 7 THEN RAISE EXCEPTION 'semana deve ter 7 dias'; END IF;
  IF (v_summary->>'total_seconds')::INT < 500 THEN RAISE EXCEPTION 'tempo total baixo: %', v_summary->>'total_seconds'; END IF;
  IF jsonb_array_length(v_summary->'recent') < 2 THEN RAISE EXCEPTION 'recentes: %', v_summary->'recent'; END IF;

  -- Análise
  v_analysis := public.rpc_course_analysis(7, NULL, NULL);
  IF (v_analysis->'kpis'->>'completed_sessions')::INT <> 3 THEN RAISE EXCEPTION 'sessões concluídas: %', v_analysis->'kpis'; END IF;
  IF (v_analysis->'content'->>'chapters_completed')::INT <> 2 THEN RAISE EXCEPTION 'capítulos: %', v_analysis->'content'; END IF;
  IF (v_analysis->'content'->>'words_encountered')::INT < 20 THEN RAISE EXCEPTION 'palavras: %', v_analysis->'content'; END IF;
  IF (v_analysis->'bests'->'streak'->>'value')::INT <> 10 THEN RAISE EXCEPTION 'recorde de combo: %', v_analysis->'bests'; END IF;
  IF jsonb_array_length(v_analysis->'history') <> 4 THEN RAISE EXCEPTION 'histórico: %', jsonb_array_length(v_analysis->'history'); END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(v_analysis->'heatmap')) <> 1 THEN RAISE EXCEPTION 'mapa de calor: %', v_analysis->'heatmap'; END IF;
  v_analysis := public.rpc_course_analysis(7, 'course-travel-a2', 'hard');
  IF (v_analysis->'kpis'->>'completed_sessions')::INT <> 1 THEN RAISE EXCEPTION 'filtro curso+modo: %', v_analysis->'kpis'; END IF;

  -- Ranking: eu no topo
  v_board := public.rpc_course_leaderboard('daily', 100);
  IF (v_board->'me'->>'position')::INT <> 1 THEN RAISE EXCEPTION 'posição: %', v_board; END IF;
  BEGIN
    PERFORM public.rpc_course_leaderboard('yearly', 10);
    RAISE EXCEPTION 'período inválido aceito';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Remover de Meus cursos mantém progresso
  PERFORM public.rpc_set_course_in_my_courses('course-travel-a2', false);
  SELECT cardinality(completed_lessons) INTO v_count FROM public.user_course_enrollment WHERE course_id = 'course-travel-a2' AND NOT in_my_courses;
  IF v_count <> 1 THEN RAISE EXCEPTION 'remover apagou progresso'; END IF;
END $$;

-- Outra conta: não vê resultados alheios; ranking mostra o outro sem expor id
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
DO $$
DECLARE v_board JSONB; v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.course_session_results;
  IF v_count <> 0 THEN RAISE EXCEPTION 'resultados de outra conta visíveis'; END IF;
  IF (public.rpc_get_course_hub_summary()->>'total_seconds')::INT <> 0 THEN RAISE EXCEPTION 'resumo vazou dados'; END IF;
  v_board := public.rpc_course_leaderboard('daily', 100);
  IF v_board->'me' IS NOT NULL AND v_board->>'me' <> 'null' THEN RAISE EXCEPTION 'conta sem estudo não deveria ter posição'; END IF;
  IF jsonb_array_length(v_board->'top') <> 1 THEN RAISE EXCEPTION 'ranking deveria ter 1 aluno'; END IF;
  IF (v_board->'top'->0) ? 'user_id' THEN RAISE EXCEPTION 'ranking expõe user_id'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.rpc_course_catalog();
    RAISE EXCEPTION 'anon leu o catálogo pela RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'course_platform_ok' AS result;
ROLLBACK;
