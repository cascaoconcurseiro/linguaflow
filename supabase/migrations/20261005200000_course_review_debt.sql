-- Dívida de revisão do curso (Issue #501). Append-only sobre 20260927180000_course_platform.sql.
--
-- 1) rpc_course_commit_practice: erro, dica ou resposta revelada continua voltando em 1 dia, mas o degrau da
--    escada passa de 0 para floor(degrau / 2). Acerto limpo e o resto da função não mudam.
-- 2) rpc_get_course_hub_summary: acrescenta a meta diária de revisão do curso e a medição de atraso, sem mudar
--    o significado de reviews_due_count (continua o total de vencidas):
--      reviews_due_total, reviews_daily_cap (20), reviews_done_today (fuso do usuário, só sessões "review"),
--      reviews_due_today = max(0, min(total, 20 - feitas hoje)) e reviews_overdue_7d.
--
-- Nenhuma tabela, coluna ou dado é alterado.
-- Rollback: nova migration com CREATE OR REPLACE das duas funções copiadas de 20260927180000_course_platform.sql
-- (rpc_course_commit_practice: linhas 53-267; rpc_get_course_hub_summary: linhas 367-411). Os GRANTs não mudam.

CREATE OR REPLACE FUNCTION public.rpc_course_commit_practice(
  p_client_session_id UUID,
  p_kind TEXT,
  p_lesson_id TEXT,
  p_difficulty TEXT,
  p_started_at TIMESTAMPTZ,
  p_active_time_seconds INT,
  p_score INT,
  p_highest_combo INT,
  p_results JSONB,
  p_completed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_course_id TEXT;
  v_total INT;
  v_answered INT;
  v_valid INT;
  v_status TEXT;
  v_result JSONB;
  v_unit_id TEXT;
  v_attempts INT;
  v_hints INT;
  v_revealed BOOLEAN;
  v_clean BOOLEAN;
  v_wrong TEXT;
  v_first_try INT := 0;
  v_mistakes INT := 0;
  v_hinted INT := 0;
  v_accuracy NUMERIC(5,2);
  v_active INT;
  v_session_id UUID;
  v_rep INT;
  v_interval INT;
  v_completed_lessons TEXT[];
  v_course_lessons INT;
  v_percent NUMERIC(5,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_client_session_id IS NULL THEN
    RAISE EXCEPTION 'client_session_id required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('lesson', 'review', 'mistakes') THEN
    RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023';
  END IF;
  IF p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'invalid difficulty' USING ERRCODE = '22023';
  END IF;
  IF p_started_at IS NULL OR p_started_at > v_now OR p_started_at < v_now - INTERVAL '6 hours' THEN
    RAISE EXCEPTION 'invalid started_at' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'results must be an array' USING ERRCODE = '22023';
  END IF;

  -- Retry de rede: devolve o que já foi gravado.
  SELECT id INTO v_session_id FROM public.course_practice_sessions
  WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
  IF v_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('session_id', v_session_id, 'replayed', true);
  END IF;

  v_answered := jsonb_array_length(p_results);

  IF p_kind = 'lesson' THEN
    SELECT l.course_id INTO v_course_id
    FROM public.course_lessons l
    JOIN public.course_catalog c ON c.id = l.course_id AND c.is_published
    WHERE l.id = p_lesson_id;
    IF v_course_id IS NULL THEN
      RAISE EXCEPTION 'lesson not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT count(*) INTO v_total FROM public.course_units WHERE lesson_id = p_lesson_id;
    SELECT count(DISTINCT u.id) INTO v_valid
    FROM jsonb_array_elements(p_results) r
    JOIN public.course_units u ON u.id = r->>'unit_id' AND u.lesson_id = p_lesson_id;
  ELSE
    IF p_lesson_id IS NOT NULL THEN
      RAISE EXCEPTION 'notebook practice has no lesson' USING ERRCODE = '22023';
    END IF;
    v_total := v_answered;
    SELECT count(DISTINCT u.id) INTO v_valid
    FROM jsonb_array_elements(p_results) r
    JOIN public.course_units u ON u.id = r->>'unit_id'
    JOIN public.course_lessons l ON l.id = u.lesson_id
    JOIN public.course_catalog c ON c.id = l.course_id AND c.is_published;
  END IF;

  IF v_answered = 0 OR v_answered > 200 OR v_valid <> v_answered OR v_answered > v_total THEN
    RAISE EXCEPTION 'results do not match practice units' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'lesson' AND coalesce(p_completed, false) AND v_answered <> v_total THEN
    RAISE EXCEPTION 'results do not match lesson units' USING ERRCODE = '22023';
  END IF;
  v_status := CASE WHEN coalesce(p_completed, false) AND v_answered = v_total THEN 'completed' ELSE 'incomplete' END;

  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_attempts := greatest(1, least(coalesce((v_result->>'attempts')::INT, 1), 50));
    v_hints := greatest(0, least(coalesce((v_result->>'hint_count')::INT, 0), 100));
    v_revealed := coalesce((v_result->>'revealed')::BOOLEAN, false);
    IF v_attempts = 1 THEN v_first_try := v_first_try + 1; END IF;
    v_mistakes := v_mistakes + (v_attempts - 1);
    IF v_hints > 0 OR v_revealed THEN v_hinted := v_hinted + 1; END IF;
  END LOOP;

  v_accuracy := round(v_first_try::NUMERIC * 100 / v_answered, 2);
  v_active := greatest(0, least(coalesce(p_active_time_seconds, 0),
    floor(extract(epoch FROM (v_now - p_started_at)))::INT));

  INSERT INTO public.course_practice_sessions (
    user_id, client_session_id, kind, status, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, answered_questions, total_questions,
    started_at, completed_at
  ) VALUES (
    v_user_id, p_client_session_id, p_kind, v_status, p_lesson_id, p_difficulty, v_active,
    greatest(0, least(coalesce(p_score, 0), v_answered * 400)),
    greatest(0, least(coalesce(p_highest_combo, 0), v_answered)),
    v_accuracy, v_hinted, v_mistakes, v_answered, v_total, p_started_at, v_now
  )
  ON CONFLICT (user_id, client_session_id) DO NOTHING
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    SELECT id INTO v_session_id FROM public.course_practice_sessions
    WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
    RETURN jsonb_build_object('session_id', v_session_id, 'replayed', true);
  END IF;

  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_unit_id := v_result->>'unit_id';
    v_attempts := greatest(1, least(coalesce((v_result->>'attempts')::INT, 1), 50));
    v_hints := greatest(0, least(coalesce((v_result->>'hint_count')::INT, 0), 100));
    v_revealed := coalesce((v_result->>'revealed')::BOOLEAN, false);
    v_clean := v_attempts = 1 AND v_hints = 0 AND NOT v_revealed;
    v_wrong := left(nullif(trim(coalesce(v_result->>'wrong_text', '')), ''), 500);

    INSERT INTO public.course_session_results (session_id, user_id, unit_id, attempts, hint_count, revealed, wrong_text)
    VALUES (v_session_id, v_user_id, v_unit_id, v_attempts, v_hints, v_revealed, v_wrong);

    -- Erro fica no caderno (com histórico); acerto limpo o marca como resolvido.
    IF v_attempts > 1 AND v_wrong IS NOT NULL THEN
      INSERT INTO public.course_user_mistakes (user_id, unit_id, wrong_text_submitted, mistake_count, is_resolved, last_practiced_at)
      VALUES (v_user_id, v_unit_id, v_wrong, v_attempts - 1, false, v_now)
      ON CONFLICT (user_id, unit_id) DO UPDATE SET
        wrong_text_submitted = EXCLUDED.wrong_text_submitted,
        mistake_count = public.course_user_mistakes.mistake_count + EXCLUDED.mistake_count,
        is_resolved = false,
        last_practiced_at = v_now;
    ELSIF v_clean THEN
      UPDATE public.course_user_mistakes
      SET is_resolved = true, last_practiced_at = v_now
      WHERE user_id = v_user_id AND unit_id = v_unit_id AND NOT is_resolved;
    END IF;

    -- Revisão: acerto limpo avança 1 → 3 → 7 → 15 → ×2,2 (máx. 180). Erro, dica ou resposta
    -- revelada traz a frase de volta em 1 dia, mas só leva metade do caminho de volta (#501).
    SELECT repetition_number INTO v_rep FROM public.course_user_reviews
    WHERE user_id = v_user_id AND unit_id = v_unit_id FOR UPDATE;
    IF v_clean THEN
      v_rep := coalesce(v_rep, 0) + 1;
      v_interval := CASE v_rep WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 15
        ELSE least(180, round(15 * power(2.2, v_rep - 4))::INT) END;
    ELSE
      v_rep := coalesce(v_rep, 0) / 2;
      v_interval := 1;
    END IF;
    INSERT INTO public.course_user_reviews (user_id, unit_id, repetition_number, interval_days, due_date, last_reviewed_at)
    VALUES (v_user_id, v_unit_id, v_rep, v_interval, v_now + make_interval(days => v_interval), v_now)
    ON CONFLICT (user_id, unit_id) DO UPDATE SET
      repetition_number = EXCLUDED.repetition_number,
      interval_days = EXCLUDED.interval_days,
      due_date = EXCLUDED.due_date,
      last_reviewed_at = v_now;
  END LOOP;

  IF p_kind = 'lesson' THEN
    INSERT INTO public.user_course_enrollment (user_id, course_id, current_lesson_id, completed_lessons, last_studied_at, in_my_courses)
    VALUES (v_user_id, v_course_id, p_lesson_id,
      CASE WHEN v_status = 'completed' THEN ARRAY[p_lesson_id] ELSE '{}'::TEXT[] END, v_now, true)
    ON CONFLICT (user_id, course_id) DO UPDATE SET
      current_lesson_id = p_lesson_id,
      completed_lessons = CASE
        WHEN v_status <> 'completed' OR p_lesson_id = ANY (public.user_course_enrollment.completed_lessons)
          THEN public.user_course_enrollment.completed_lessons
        ELSE public.user_course_enrollment.completed_lessons || p_lesson_id
      END,
      in_my_courses = true,
      last_studied_at = v_now
    RETURNING completed_lessons INTO v_completed_lessons;

    SELECT count(*) INTO v_course_lessons FROM public.course_lessons WHERE course_id = v_course_id;
    v_percent := least(100, round(cardinality(v_completed_lessons)::NUMERIC * 100 / greatest(v_course_lessons, 1), 2));
    UPDATE public.user_course_enrollment SET percent_completed = v_percent
    WHERE user_id = v_user_id AND course_id = v_course_id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'replayed', false,
    'status', v_status,
    'course_id', v_course_id,
    'percent_completed', v_percent,
    'accuracy_rate', v_accuracy,
    'mistakes_count', v_mistakes,
    'active_time_seconds', v_active
  );
END;
$$;

-- Os GRANT/REVOKE de rpc_course_commit_practice e rpc_get_course_hub_summary vêm de 20260927180000 e
-- permanecem (CREATE OR REPLACE preserva privilégios); reafirmados aqui por segurança.
REVOKE ALL ON FUNCTION public.rpc_course_commit_practice(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_commit_practice(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_get_course_hub_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  tz AS (
    SELECT coalesce((SELECT u.timezone FROM public.user_stats u, me WHERE u.user_id = me.uid), 'UTC') AS name
  ),
  due AS (
    SELECT count(*)::INT AS total,
           count(*) FILTER (WHERE r.due_date < now() - INTERVAL '7 days')::INT AS overdue_7d
    FROM public.course_user_reviews r, me WHERE r.user_id = me.uid AND r.due_date <= now()
  ),
  done AS (
    SELECT coalesce(sum(s.answered_questions), 0)::INT AS today
    FROM public.course_practice_sessions s, me, tz
    WHERE s.user_id = me.uid AND s.kind = 'review'
      AND (s.started_at AT TIME ZONE tz.name)::DATE = (now() AT TIME ZONE tz.name)::DATE
  ),
  week AS (
    SELECT (date_trunc('week', timezone('utc', now())))::DATE AS monday
  ),
  sessions AS (
    SELECT s.*, (timezone('utc', s.started_at))::DATE AS day
    FROM public.course_practice_sessions s, me WHERE s.user_id = me.uid
  )
  SELECT jsonb_build_object(
    'enrollments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('course_id', e.course_id, 'completed_lessons', e.completed_lessons,
        'percent_completed', e.percent_completed, 'in_my_courses', e.in_my_courses))
      FROM public.user_course_enrollment e, me WHERE e.user_id = me.uid), '[]'::jsonb),
    'continue', (
      SELECT jsonb_build_object('course_id', e.course_id, 'lesson_id', e.current_lesson_id,
        'percent_completed', e.percent_completed, 'last_studied_at', e.last_studied_at)
      FROM public.user_course_enrollment e, me
      WHERE e.user_id = me.uid AND e.current_lesson_id IS NOT NULL AND e.in_my_courses
      ORDER BY e.last_studied_at DESC LIMIT 1),
    'week', (
      SELECT jsonb_agg(jsonb_build_object('date', d::DATE,
        'seconds', coalesce((SELECT sum(active_time_seconds) FROM sessions WHERE day = d::DATE), 0)) ORDER BY d)
      FROM week, generate_series(week.monday, week.monday + 6, INTERVAL '1 day') d),
    'today_seconds', coalesce((SELECT sum(active_time_seconds) FROM sessions WHERE day = (timezone('utc', now()))::DATE), 0),
    'week_days', (SELECT count(DISTINCT day) FROM sessions, week WHERE day >= week.monday AND active_time_seconds > 0),
    'total_seconds', coalesce((SELECT sum(active_time_seconds) FROM sessions), 0),
    'study_days', (SELECT count(DISTINCT day) FROM sessions WHERE active_time_seconds > 0),
    'mistakes_count', (SELECT count(*) FROM public.course_user_mistakes m, me WHERE m.user_id = me.uid AND NOT m.is_resolved),
    'reviews_due_count', (SELECT total FROM due),
    'reviews_due_total', (SELECT total FROM due),
    'reviews_daily_cap', 20,
    'reviews_done_today', (SELECT today FROM done),
    'reviews_due_today', greatest(0, least((SELECT total FROM due), 20 - (SELECT today FROM done))),
    'reviews_overdue_7d', (SELECT overdue_7d FROM due),
    'next_review_at', (SELECT min(r.due_date) FROM public.course_user_reviews r, me WHERE r.user_id = me.uid AND r.due_date > now()),
    'recent', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'last_at') DESC) FROM (
        SELECT jsonb_build_object('lesson_id', s.lesson_id, 'last_at', max(s.started_at),
          'best_answered', max(s.answered_questions), 'total', max(s.total_questions)) AS x
        FROM sessions s WHERE s.kind = 'lesson'
        GROUP BY s.lesson_id ORDER BY max(s.started_at) DESC LIMIT 3) r), '[]'::jsonb)
  );
$$;
