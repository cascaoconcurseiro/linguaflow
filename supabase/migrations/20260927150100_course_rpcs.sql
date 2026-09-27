-- ============================================================================
-- RPCs autoritativas do domínio de Cursos.
-- O cliente envia só o que observou por frase; precisão, erros, progresso e
-- agenda de revisão são calculados aqui. Idempotente por client_session_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_commit_course_session(
  p_client_session_id UUID,
  p_lesson_id TEXT,
  p_difficulty TEXT,
  p_started_at TIMESTAMPTZ,
  p_active_time_seconds INT,
  p_score INT,
  p_highest_combo INT,
  p_results JSONB
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
  v_lesson_units INT;
  v_course_lessons INT;
  v_result JSONB;
  v_unit_id TEXT;
  v_clean BOOLEAN;
  v_attempts INT;
  v_used_hint BOOLEAN;
  v_wrong TEXT;
  v_first_try INT := 0;
  v_mistakes INT := 0;
  v_hints INT := 0;
  v_accuracy NUMERIC(5,2);
  v_active INT;
  v_session_id UUID;
  v_rep INT;
  v_interval INT;
  v_completed TEXT[];
  v_percent NUMERIC(5,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_client_session_id IS NULL THEN
    RAISE EXCEPTION 'client_session_id required' USING ERRCODE = '22023';
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

  SELECT l.course_id INTO v_course_id
  FROM public.course_lessons l
  JOIN public.course_catalog c ON c.id = l.course_id AND c.is_published
  WHERE l.id = p_lesson_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'lesson not found' USING ERRCODE = 'P0002';
  END IF;

  -- Replay (retry de rede): devolve o que já foi gravado, sem reaplicar.
  SELECT id INTO v_session_id
  FROM public.course_practice_sessions
  WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
  IF v_session_id IS NOT NULL THEN
    SELECT percent_completed INTO v_percent
    FROM public.user_course_enrollment
    WHERE user_id = v_user_id AND course_id = v_course_id;
    RETURN jsonb_build_object('session_id', v_session_id, 'replayed', true,
      'course_id', v_course_id, 'percent_completed', coalesce(v_percent, 0));
  END IF;

  -- Os resultados precisam cobrir exatamente as frases da lição.
  SELECT count(*) INTO v_lesson_units FROM public.course_units WHERE lesson_id = p_lesson_id;
  IF jsonb_array_length(p_results) <> v_lesson_units OR v_lesson_units = 0 OR (
    SELECT count(DISTINCT u.id)
    FROM jsonb_array_elements(p_results) r
    JOIN public.course_units u ON u.id = r->>'unit_id' AND u.lesson_id = p_lesson_id
  ) <> v_lesson_units THEN
    RAISE EXCEPTION 'results do not match lesson units' USING ERRCODE = '22023';
  END IF;

  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_attempts := greatest(1, least(coalesce((v_result->>'attempts')::INT, 1), 50));
    v_used_hint := coalesce((v_result->>'used_hint')::BOOLEAN, false);
    IF v_attempts = 1 THEN v_first_try := v_first_try + 1; END IF;
    v_mistakes := v_mistakes + (v_attempts - 1);
    IF v_used_hint THEN v_hints := v_hints + 1; END IF;
  END LOOP;

  v_accuracy := round(v_first_try::NUMERIC * 100 / v_lesson_units, 2);
  v_active := greatest(0, least(coalesce(p_active_time_seconds, 0),
    floor(extract(epoch FROM (v_now - p_started_at)))::INT));

  INSERT INTO public.course_practice_sessions (
    user_id, client_session_id, lesson_id, difficulty, active_time_seconds, score,
    highest_combo, accuracy_rate, hints_used, mistakes_count, started_at, completed_at
  ) VALUES (
    v_user_id, p_client_session_id, p_lesson_id, p_difficulty, v_active,
    greatest(0, least(coalesce(p_score, 0), v_lesson_units * 400)),
    greatest(0, least(coalesce(p_highest_combo, 0), v_lesson_units)),
    v_accuracy, v_hints, v_mistakes, p_started_at, v_now
  )
  ON CONFLICT (user_id, client_session_id) DO NOTHING
  RETURNING id INTO v_session_id;

  IF v_session_id IS NULL THEN
    -- Outra chamada concorrente com o mesmo id venceu.
    SELECT id INTO v_session_id FROM public.course_practice_sessions
    WHERE user_id = v_user_id AND client_session_id = p_client_session_id;
    RETURN jsonb_build_object('session_id', v_session_id, 'replayed', true, 'course_id', v_course_id);
  END IF;

  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_unit_id := v_result->>'unit_id';
    v_attempts := greatest(1, least(coalesce((v_result->>'attempts')::INT, 1), 50));
    v_used_hint := coalesce((v_result->>'used_hint')::BOOLEAN, false);
    v_clean := v_attempts = 1 AND NOT v_used_hint;
    v_wrong := left(nullif(trim(coalesce(v_result->>'wrong_text', '')), ''), 500);

    -- Caderno de erros: registra a primeira tentativa errada; uma frase limpa resolve.
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

    -- Revisão espaçada: acerto limpo avança 1 → 3 → 7 → 15 → ×2,2 (teto 180 dias);
    -- erro ou dica volta para 1 dia.
    SELECT repetition_number INTO v_rep
    FROM public.course_user_reviews
    WHERE user_id = v_user_id AND unit_id = v_unit_id
    FOR UPDATE;

    IF v_clean THEN
      v_rep := coalesce(v_rep, 0) + 1;
      v_interval := CASE v_rep
        WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 15
        ELSE least(180, round(15 * power(2.2, v_rep - 4))::INT)
      END;
    ELSE
      v_rep := 0;
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

  -- Progresso: lições concluídas / lições existentes no curso.
  SELECT count(*) INTO v_course_lessons FROM public.course_lessons WHERE course_id = v_course_id;

  INSERT INTO public.user_course_enrollment (user_id, course_id, current_lesson_id, completed_lessons, last_studied_at)
  VALUES (v_user_id, v_course_id, p_lesson_id, ARRAY[p_lesson_id], v_now)
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    current_lesson_id = p_lesson_id,
    completed_lessons = CASE
      WHEN p_lesson_id = ANY (public.user_course_enrollment.completed_lessons)
        THEN public.user_course_enrollment.completed_lessons
      ELSE public.user_course_enrollment.completed_lessons || p_lesson_id
    END,
    last_studied_at = v_now
  RETURNING completed_lessons INTO v_completed;

  v_percent := least(100, round(cardinality(v_completed)::NUMERIC * 100 / greatest(v_course_lessons, 1), 2));
  UPDATE public.user_course_enrollment
  SET percent_completed = v_percent
  WHERE user_id = v_user_id AND course_id = v_course_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'replayed', false,
    'course_id', v_course_id,
    'percent_completed', v_percent,
    'accuracy_rate', v_accuracy,
    'mistakes_count', v_mistakes,
    'active_time_seconds', v_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_commit_course_session(UUID, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_commit_course_session(UUID, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB) TO authenticated;

-- Resumo do hub: curso recente, erros pendentes e revisões vencidas.
CREATE OR REPLACE FUNCTION public.rpc_get_course_hub_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'active_course', (
      SELECT jsonb_build_object(
        'course_id', e.course_id,
        'current_lesson_id', e.current_lesson_id,
        'percent_completed', e.percent_completed,
        'last_studied_at', e.last_studied_at
      )
      FROM public.user_course_enrollment e
      WHERE e.user_id = (select auth.uid())
      ORDER BY e.last_studied_at DESC
      LIMIT 1
    ),
    'enrollments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'course_id', e.course_id,
        'completed_lessons', e.completed_lessons,
        'percent_completed', e.percent_completed
      ))
      FROM public.user_course_enrollment e
      WHERE e.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'mistakes_count', (
      SELECT count(*) FROM public.course_user_mistakes m
      WHERE m.user_id = (select auth.uid()) AND NOT m.is_resolved
    ),
    'reviews_due_count', (
      SELECT count(*) FROM public.course_user_reviews r
      WHERE r.user_id = (select auth.uid()) AND r.due_date <= now()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_get_course_hub_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_course_hub_summary() TO authenticated;
