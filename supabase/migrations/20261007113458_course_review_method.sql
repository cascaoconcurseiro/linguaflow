-- Revisão guiada (#531): teto Fácil 30 dias, uma alteração de estágio/dia,
-- práticas antecipadas não adiam a agenda. Reforço na sessão é frontend-only.
-- Autoridade, autenticação, RLS e assinatura da RPC permanecem.
ALTER TABLE public.course_user_reviews ADD COLUMN last_schedule_change_at TIMESTAMPTZ;
COMMENT ON COLUMN public.course_user_reviews.last_schedule_change_at IS
  'Última alteração da agenda; repetir antes do vencimento não muda este marcador.';

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
  v_review RECORD;
  v_today DATE;
  v_timezone TEXT;
  v_changed_at TIMESTAMPTZ;
  v_eligible BOOLEAN;
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

  -- Serializa sessões da mesma conta, inclusive unidades sem linha prévia.
  -- Evita dupla promoção com duas abas e mantém a idempotência da sessão.
  PERFORM pg_advisory_xact_lock(hashtextextended('course-review:' || v_user_id::TEXT, 531));
  SELECT coalesce((SELECT timezone FROM public.user_stats WHERE user_id = v_user_id), 'UTC') INTO v_timezone;
  v_today := (v_now AT TIME ZONE v_timezone)::DATE;

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

    -- Fácil é aprendizagem válida, com intervalo de no máximo 30 dias.
    -- Só práticas vencidas avançam; reforços no mesmo dia não adiam a agenda.
    SELECT repetition_number, interval_days, due_date, last_reviewed_at, last_schedule_change_at
    INTO v_review FROM public.course_user_reviews
    WHERE user_id = v_user_id AND unit_id = v_unit_id FOR UPDATE;
    v_rep := greatest(0, least(8, coalesce(v_review.repetition_number, 0)));
    v_changed_at := coalesce(v_review.last_schedule_change_at, v_review.last_reviewed_at);
    v_eligible := v_changed_at IS NULL OR (v_changed_at AT TIME ZONE v_timezone)::DATE < v_today;
    IF v_clean AND v_eligible AND (v_review.due_date IS NULL OR v_review.due_date <= v_now) THEN
      v_rep := least(8, v_rep + 1);
      v_interval := CASE v_rep WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 15
        ELSE least(180, round(15 * power(2.2, v_rep - 4))::INT) END;
      IF p_difficulty = 'easy' THEN v_interval := least(30, v_interval); END IF;
      INSERT INTO public.course_user_reviews
        (user_id, unit_id, repetition_number, interval_days, due_date, last_reviewed_at, last_schedule_change_at)
      VALUES (v_user_id, v_unit_id, v_rep, v_interval, v_now + make_interval(days => v_interval), v_now, v_now)
      ON CONFLICT (user_id, unit_id) DO UPDATE SET
        repetition_number = EXCLUDED.repetition_number, interval_days = EXCLUDED.interval_days,
        due_date = EXCLUDED.due_date, last_reviewed_at = v_now, last_schedule_change_at = v_now;
    ELSIF NOT v_clean THEN
      -- Erros consecutivos no mesmo dia não rebaixam repetidamente o degrau.
      IF v_eligible THEN v_rep := v_rep / 2; END IF;
      INSERT INTO public.course_user_reviews
        (user_id, unit_id, repetition_number, interval_days, due_date, last_reviewed_at, last_schedule_change_at)
      VALUES (v_user_id, v_unit_id, v_rep, 1, v_now + INTERVAL '1 day', v_now, v_now)
      ON CONFLICT (user_id, unit_id) DO UPDATE SET
        repetition_number = EXCLUDED.repetition_number,
        interval_days = 1,
        due_date = CASE WHEN public.course_user_reviews.due_date <= v_now THEN EXCLUDED.due_date
          ELSE least(public.course_user_reviews.due_date, EXCLUDED.due_date) END,
        last_reviewed_at = v_now, last_schedule_change_at = v_now;
    ELSE
      -- Prática antecipada / mesmo dia conta na sessão, sem mover o vencimento.
      UPDATE public.course_user_reviews SET last_reviewed_at = v_now,
        last_schedule_change_at = v_changed_at
      WHERE user_id = v_user_id AND unit_id = v_unit_id;
    END IF;
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

