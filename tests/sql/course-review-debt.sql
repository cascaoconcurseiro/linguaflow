-- Dívida de revisão do curso (Issue #501): erro mais brando, meta diária e atraso de 7 dias.
-- Roda no replay de migrations (tests/db/validate-migrations.sh) com o shim do auth.
\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES ('d5010000-0000-4000-8000-000000000001');
INSERT INTO public.user_stats (user_id) VALUES ('d5010000-0000-4000-8000-000000000001') ON CONFLICT (user_id) DO NOTHING;
SELECT set_config('request.jwt.claim.sub', 'd5010000-0000-4000-8000-000000000001', false);

DO $$
DECLARE
  uid constant uuid := 'd5010000-0000-4000-8000-000000000001';
  lesson_id text;
  u_ids text[] := ARRAY['unit-d501-01', 'unit-d501-02', 'unit-d501-03', 'unit-d501-04'];
  i int;
  r record;
  s jsonb;
  results jsonb;
BEGIN
  INSERT INTO public.course_catalog (id, slug, title, level, category, order_index, short_description, long_description, is_published)
  VALUES ('course-d501', 'd501', 'Teste #501', 'A1', 'street-slang', 999, 'x', 'x', true)
  ON CONFLICT (id) DO NOTHING;
  lesson_id := 'lesson-d501-01';
  INSERT INTO public.course_lessons (id, course_id, chapter_number, title)
  VALUES (lesson_id, 'course-d501', 1, 'Teste') ON CONFLICT (id) DO NOTHING;
  FOR i IN 1..4 LOOP
    INSERT INTO public.course_units (id, lesson_id, order_index, text, translation_pt)
    VALUES (u_ids[i], lesson_id, i, 'Sentence ' || i, 'Frase ' || i) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Estados de partida: degrau 6 (73 dias), degrau 1, degrau 0 e uma frase sem histórico.
  INSERT INTO public.course_user_reviews (user_id, unit_id, repetition_number, interval_days, due_date, last_reviewed_at) VALUES
    (uid, u_ids[1], 6, 73, now() - interval '1 hour', now() - interval '73 days'),
    (uid, u_ids[2], 1, 1, now() - interval '1 hour', now() - interval '1 day'),
    (uid, u_ids[3], 0, 1, now() - interval '9 days', now() - interval '10 days');

  -- Revisão: u1 erra (degrau 6 -> 3), u2 erra (1 -> 0), u3 acerta (0 -> 1), u4 nova com erro (-> 0).
  results := jsonb_build_array(
    jsonb_build_object('unit_id', u_ids[1], 'attempts', 2, 'hint_count', 0, 'revealed', false, 'wrong_text', 'wrong'),
    jsonb_build_object('unit_id', u_ids[2], 'attempts', 1, 'hint_count', 1, 'revealed', false),
    jsonb_build_object('unit_id', u_ids[3], 'attempts', 1, 'hint_count', 0, 'revealed', false),
    jsonb_build_object('unit_id', u_ids[4], 'attempts', 1, 'hint_count', 0, 'revealed', true)
  );
  s := public.rpc_course_commit_practice(
    gen_random_uuid(), 'review', NULL, 'medium', now() - interval '5 minutes', 60, 100, 2, results, true);
  IF (s->>'replayed')::boolean THEN RAISE EXCEPTION 'primeira gravação não pode ser replay'; END IF;

  SELECT * INTO r FROM public.course_user_reviews WHERE user_id = uid AND unit_id = u_ids[1];
  IF r.repetition_number <> 3 OR r.interval_days <> 1 THEN
    RAISE EXCEPTION 'erro no degrau 6 deve gravar degrau 3 e intervalo 1, veio % / %', r.repetition_number, r.interval_days;
  END IF;
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id = uid AND unit_id = u_ids[2];
  IF r.repetition_number <> 0 OR r.interval_days <> 1 THEN
    RAISE EXCEPTION 'dica no degrau 1 deve gravar degrau 0 e intervalo 1, veio % / %', r.repetition_number, r.interval_days;
  END IF;
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id = uid AND unit_id = u_ids[3];
  IF r.repetition_number <> 1 OR r.interval_days <> 1 THEN
    RAISE EXCEPTION 'acerto limpo no degrau 0 deve ir ao degrau 1 (1 dia), veio % / %', r.repetition_number, r.interval_days;
  END IF;
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id = uid AND unit_id = u_ids[4];
  IF r.repetition_number <> 0 OR r.interval_days <> 1 THEN
    RAISE EXCEPTION 'frase nova com resposta revelada deve gravar degrau 0, veio % / %', r.repetition_number, r.interval_days;
  END IF;

  -- Acerto limpo mantém a escada: degrau 3 (7 dias) -> 4 (15 dias) -> 5 (33 dias).
  UPDATE public.course_user_reviews SET repetition_number = 3, last_schedule_change_at = now() - interval '2 days', last_reviewed_at = now() - interval '2 days', due_date = now() - interval '1 hour' WHERE user_id = uid AND unit_id = u_ids[1];
  s := public.rpc_course_commit_practice(
    gen_random_uuid(), 'review', NULL, 'medium', now() - interval '5 minutes', 30, 100, 1,
    jsonb_build_array(jsonb_build_object('unit_id', u_ids[1], 'attempts', 1, 'hint_count', 0, 'revealed', false)), true);
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id = uid AND unit_id = u_ids[1];
  IF r.repetition_number <> 4 OR r.interval_days <> 15 THEN
    RAISE EXCEPTION 'acerto limpo no degrau 3 deve ir ao degrau 4 (15 dias), veio % / %', r.repetition_number, r.interval_days;
  END IF;
END $$;

-- Resumo: meta diária, feitas hoje, vencidas e atrasadas há mais de 7 dias.
DO $$
DECLARE
  uid constant uuid := 'd5010000-0000-4000-8000-000000000001';
  summary jsonb;
  total int;
  done int;
  cap int;
BEGIN
  -- Cenário controlado: 30 vencidas, 3 delas há mais de 7 dias; nenhuma revisão feita hoje.
  DELETE FROM public.course_practice_sessions WHERE user_id = uid;
  DELETE FROM public.course_user_reviews WHERE user_id = uid;
  INSERT INTO public.course_units (id, lesson_id, order_index, text, translation_pt)
  SELECT 'unit-d501-x' || g, 'lesson-d501-01', 100 + g, 'Extra ' || g, 'Extra ' || g FROM generate_series(1, 30) g
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.course_user_reviews (user_id, unit_id, repetition_number, interval_days, due_date, last_reviewed_at)
  SELECT uid, 'unit-d501-x' || g, 1, 1,
         CASE WHEN g <= 3 THEN now() - interval '8 days' ELSE now() - interval '1 hour' END, now() - interval '9 days'
  FROM generate_series(1, 30) g;

  summary := public.rpc_get_course_hub_summary();
  cap := (summary->>'reviews_daily_cap')::int;
  IF cap <> 20 THEN RAISE EXCEPTION 'meta diária deve ser 20, veio %', cap; END IF;
  IF (summary->>'reviews_due_total')::int <> 30 OR (summary->>'reviews_due_count')::int <> 30 THEN
    RAISE EXCEPTION 'total vencido deve ser 30 (reviews_due_count mantém o total), veio %', summary;
  END IF;
  IF (summary->>'reviews_done_today')::int <> 0 THEN RAISE EXCEPTION 'nada feito hoje, veio %', summary; END IF;
  IF (summary->>'reviews_due_today')::int <> 20 THEN RAISE EXCEPTION 'meta de hoje deve ser min(30, 20) = 20, veio %', summary; END IF;
  IF (summary->>'reviews_overdue_7d')::int <> 3 THEN RAISE EXCEPTION 'atrasadas há mais de 7 dias devem ser 3, veio %', summary; END IF;

  -- Depois de 12 revisões feitas hoje, restam 8; depois de 25, nunca fica negativo.
  INSERT INTO public.course_practice_sessions (user_id, client_session_id, kind, status, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, answered_questions, total_questions, started_at, completed_at)
  VALUES (uid, gen_random_uuid(), 'review', 'completed', NULL, 'medium', 60, 0, 0, 100, 0, 0, 12, 12, now(), now());
  summary := public.rpc_get_course_hub_summary();
  IF (summary->>'reviews_done_today')::int <> 12 OR (summary->>'reviews_due_today')::int <> 8 THEN
    RAISE EXCEPTION 'após 12 feitas hoje restam 8, veio %', summary;
  END IF;
  INSERT INTO public.course_practice_sessions (user_id, client_session_id, kind, status, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, answered_questions, total_questions, started_at, completed_at)
  VALUES (uid, gen_random_uuid(), 'review', 'completed', NULL, 'medium', 60, 0, 0, 100, 0, 0, 13, 13, now(), now());
  summary := public.rpc_get_course_hub_summary();
  IF (summary->>'reviews_due_today')::int <> 0 THEN RAISE EXCEPTION 'meta estourada não pode ficar negativa, veio %', summary; END IF;

  -- Sessão de lição e de erros não contam como revisão do dia; sessão de ontem (fuso do usuário) também não.
  DELETE FROM public.course_practice_sessions WHERE user_id = uid;
  INSERT INTO public.course_practice_sessions (user_id, client_session_id, kind, status, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, answered_questions, total_questions, started_at, completed_at)
  VALUES
    (uid, gen_random_uuid(), 'mistakes', 'completed', NULL, 'medium', 60, 0, 0, 100, 0, 0, 9, 9, now(), now()),
    (uid, gen_random_uuid(), 'review', 'completed', NULL, 'medium', 60, 0, 0, 100, 0, 0, 7, 7, now() - interval '30 hours', now() - interval '30 hours');
  summary := public.rpc_get_course_hub_summary();
  IF (summary->>'reviews_done_today')::int <> 0 OR (summary->>'reviews_due_today')::int <> 20 THEN
    RAISE EXCEPTION 'só revisão de hoje conta, veio %', summary;
  END IF;

  -- Fuso: com o usuário em UTC+14 o "hoje" dele começa antes; a sessão de agora conta sempre no dia dele.
  UPDATE public.user_stats SET timezone = 'Pacific/Kiritimati' WHERE user_id = uid;
  INSERT INTO public.course_practice_sessions (user_id, client_session_id, kind, status, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, answered_questions, total_questions, started_at, completed_at)
  VALUES (uid, gen_random_uuid(), 'review', 'completed', NULL, 'medium', 60, 0, 0, 100, 0, 0, 5, 5, now(), now());
  summary := public.rpc_get_course_hub_summary();
  IF (summary->>'reviews_done_today')::int <> 5 THEN RAISE EXCEPTION 'fuso do usuário: 5 feitas hoje, veio %', summary; END IF;
END $$;
\echo course-review-debt: OK
