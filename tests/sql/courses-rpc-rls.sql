-- Teste comportamental do domínio de Cursos contra um banco LOCAL descartável
-- (scripts/replay-migrations-local.ps1). Nunca rodar em produção.
-- Uso: supabase db query --local -f tests/sql/courses-rpc-rls.sql
-- Falha = RAISE EXCEPTION; sucesso = 'courses_rpc_rls_ok'.

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '{}', '{}', now(), now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

DO $$
DECLARE
  v_results JSONB;
  v_res JSONB;
  v_res2 JSONB;
  v_count INT;
BEGIN
  -- Conteúdo publicado é legível
  SELECT count(*) INTO v_count FROM public.course_units WHERE lesson_id = 'lesson-street-a1-01';
  IF v_count <> 10 THEN RAISE EXCEPTION 'esperava 10 frases, veio %', v_count; END IF;

  -- Resultados: frase 1 com 3 tentativas, frase 2 com dica, demais limpas
  SELECT jsonb_agg(jsonb_build_object(
    'unit_id', id,
    'attempts', CASE WHEN order_index = 1 THEN 3 ELSE 1 END,
    'used_hint', order_index = 2,
    'wrong_text', CASE WHEN order_index = 1 THEN 'hey whats app' END
  ) ORDER BY order_index)
  INTO v_results
  FROM public.course_units WHERE lesson_id = 'lesson-street-a1-01';

  v_res := public.rpc_commit_course_session(
    '11111111-1111-4111-8111-111111111111', 'lesson-street-a1-01', 'hard',
    now() - INTERVAL '5 minutes', 99999, 999999, 99, v_results);

  IF (v_res->>'replayed')::BOOLEAN THEN RAISE EXCEPTION 'primeiro commit não pode ser replay'; END IF;
  IF (v_res->>'percent_completed')::NUMERIC <> 100 THEN RAISE EXCEPTION 'curso com 1 lição deveria ir a 100%%: %', v_res; END IF;
  IF (v_res->>'accuracy_rate')::NUMERIC <> 90 THEN RAISE EXCEPTION 'precisão esperada 90: %', v_res; END IF;
  IF (v_res->>'mistakes_count')::INT <> 2 THEN RAISE EXCEPTION 'erros esperados 2: %', v_res; END IF;
  IF (v_res->>'active_time_seconds')::INT > 301 THEN RAISE EXCEPTION 'tempo ativo não foi limitado: %', v_res; END IF;

  SELECT count(*) INTO v_count FROM public.course_practice_sessions WHERE score <= 4000 AND highest_combo <= 10;
  IF v_count <> 1 THEN RAISE EXCEPTION 'score/combo não foram limitados'; END IF;

  -- Idempotência: mesmo client_session_id não duplica nada
  v_res2 := public.rpc_commit_course_session(
    '11111111-1111-4111-8111-111111111111', 'lesson-street-a1-01', 'hard',
    now() - INTERVAL '5 minutes', 10, 10, 1, v_results);
  IF NOT (v_res2->>'replayed')::BOOLEAN THEN RAISE EXCEPTION 'retry deveria ser replay'; END IF;
  SELECT count(*) INTO v_count FROM public.course_practice_sessions;
  IF v_count <> 1 THEN RAISE EXCEPTION 'retry duplicou sessão'; END IF;
  SELECT mistake_count INTO v_count FROM public.course_user_mistakes WHERE unit_id = 'unit-street-a1-01-01';
  IF v_count <> 2 THEN RAISE EXCEPTION 'retry reaplicou erros: %', v_count; END IF;

  -- Caderno de erros e revisões
  SELECT count(*) INTO v_count FROM public.course_user_mistakes WHERE NOT is_resolved;
  IF v_count <> 1 THEN RAISE EXCEPTION 'esperava 1 erro pendente, veio %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.course_user_reviews WHERE interval_days = 1 AND repetition_number = 0;
  IF v_count <> 2 THEN RAISE EXCEPTION 'erro e dica deveriam resetar a revisão: %', v_count; END IF;

  -- Segunda sessão limpa resolve o erro e avança a revisão
  SELECT jsonb_agg(jsonb_build_object('unit_id', id, 'attempts', 1, 'used_hint', false) ORDER BY order_index)
  INTO v_results FROM public.course_units WHERE lesson_id = 'lesson-street-a1-01';
  PERFORM public.rpc_commit_course_session(
    '22222222-2222-4222-8222-222222222222', 'lesson-street-a1-01', 'easy',
    now() - INTERVAL '2 minutes', 60, 1000, 10, v_results);
  SELECT count(*) INTO v_count FROM public.course_user_mistakes WHERE NOT is_resolved;
  IF v_count <> 0 THEN RAISE EXCEPTION 'acerto limpo deveria resolver o erro'; END IF;
  SELECT repetition_number INTO v_count FROM public.course_user_reviews WHERE unit_id = 'unit-street-a1-01-03';
  IF v_count <> 2 THEN RAISE EXCEPTION 'revisão deveria avançar para a repetição 2, veio %', v_count; END IF;

  -- Validações de entrada
  BEGIN
    PERFORM public.rpc_commit_course_session(gen_random_uuid(), 'lesson-street-a1-01', 'hard',
      now() - INTERVAL '1 minute', 10, 0, 0, '[]'::jsonb);
    RAISE EXCEPTION 'aceitou resultados incompletos';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.rpc_commit_course_session(gen_random_uuid(), 'lesson-street-a1-01', 'hard',
      now() - INTERVAL '2 days', 10, 0, 0, v_results);
    RAISE EXCEPTION 'aceitou started_at antigo';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Escrita direta bloqueada pelo RLS
  BEGIN
    INSERT INTO public.course_practice_sessions (user_id, client_session_id, lesson_id, difficulty, active_time_seconds,
      score, highest_combo, accuracy_rate, hints_used, mistakes_count, started_at, completed_at)
    VALUES ('00000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'lesson-street-a1-01', 'hard', 99999,
      99999, 99, 100, 0, 0, now(), now());
    RAISE EXCEPTION 'insert direto em sessões foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Vocabulário e nota com user_id vindo de auth.uid()
  INSERT INTO public.course_user_vocabulary (unit_id) VALUES ('unit-street-a1-01-05');
  INSERT INTO public.course_user_notes (unit_id, note_content) VALUES ('unit-street-a1-01-05', 'hit me up = me chama');
END $$;

-- Usuário B não enxerga nada do usuário A
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
DO $$
DECLARE v_count INT;
BEGIN
  SELECT (SELECT count(*) FROM public.course_practice_sessions)
       + (SELECT count(*) FROM public.course_user_mistakes)
       + (SELECT count(*) FROM public.course_user_reviews)
       + (SELECT count(*) FROM public.course_user_vocabulary)
       + (SELECT count(*) FROM public.course_user_notes)
       + (SELECT count(*) FROM public.user_course_enrollment)
  INTO v_count;
  IF v_count <> 0 THEN RAISE EXCEPTION 'vazamento entre contas: % linhas visíveis para B', v_count; END IF;

  BEGIN
    INSERT INTO public.course_user_notes (user_id, unit_id, note_content)
    VALUES ('00000000-0000-4000-8000-00000000000a', 'unit-street-a1-01-06', 'forjada');
    RAISE EXCEPTION 'B gravou nota em nome de A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF (public.rpc_get_course_hub_summary()->>'mistakes_count')::INT <> 0 THEN
    RAISE EXCEPTION 'resumo de B mostra dados de A';
  END IF;
END $$;

-- Anônimo não chama a RPC
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.rpc_commit_course_session(gen_random_uuid(), 'lesson-street-a1-01', 'hard', now(), 1, 0, 0, '[]'::jsonb);
    RAISE EXCEPTION 'anon executou a RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'courses_rpc_rls_ok' AS result;
ROLLBACK;
