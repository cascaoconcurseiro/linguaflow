-- ============================================================================
-- Plataforma de Cursos: "Meus cursos", sessões incompletas e de caderno
-- (revisão/erros), resultado por frase, e RPCs de catálogo, início, análise e
-- ranking. Append-only sobre 20260927150000/150100.
-- ============================================================================

-- "Meus cursos": remover da lista não apaga o progresso.
ALTER TABLE public.user_course_enrollment
  ADD COLUMN IF NOT EXISTS in_my_courses BOOLEAN NOT NULL DEFAULT true;

-- Sessões: lição inteira ou prática avulsa de revisões/erros; concluída ou não.
ALTER TABLE public.course_practice_sessions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lesson',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS answered_questions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions INT NOT NULL DEFAULT 0;
ALTER TABLE public.course_practice_sessions ALTER COLUMN lesson_id DROP NOT NULL;
ALTER TABLE public.course_practice_sessions
  ADD CONSTRAINT course_sessions_kind_check CHECK (kind IN ('lesson', 'review', 'mistakes')),
  ADD CONSTRAINT course_sessions_status_check CHECK (status IN ('completed', 'incomplete')),
  ADD CONSTRAINT course_sessions_lesson_kind_check CHECK ((kind = 'lesson') = (lesson_id IS NOT NULL)),
  ADD CONSTRAINT course_sessions_answered_check CHECK (answered_questions BETWEEN 0 AND total_questions);

UPDATE public.course_practice_sessions s
SET answered_questions = n.cnt, total_questions = n.cnt
FROM (SELECT lesson_id, count(*)::INT AS cnt FROM public.course_units GROUP BY lesson_id) n
WHERE s.lesson_id = n.lesson_id AND s.total_questions = 0;

-- Resultado de cada frase em cada sessão (histórico, análise, detalhes).
CREATE TABLE IF NOT EXISTS public.course_session_results (
  session_id UUID NOT NULL REFERENCES public.course_practice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  attempts INT NOT NULL CHECK (attempts BETWEEN 1 AND 50),
  hint_count INT NOT NULL DEFAULT 0 CHECK (hint_count BETWEEN 0 AND 100),
  revealed BOOLEAN NOT NULL DEFAULT false,
  wrong_text TEXT,
  PRIMARY KEY (session_id, unit_id)
);
ALTER TABLE public.course_session_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_session_results_select_own ON public.course_session_results
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_course_results_user ON public.course_session_results (user_id);
CREATE INDEX IF NOT EXISTS idx_course_results_unit ON public.course_session_results (unit_id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_started ON public.course_practice_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_course_sessions_user_started ON public.course_practice_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_notes_user_updated ON public.course_user_notes (user_id, updated_at DESC);

-- ============================================================================
-- Commit genérico (lição completa/incompleta, revisão, erros)
-- ============================================================================
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

    -- Revisão: acerto limpo avança 1 → 3 → 7 → 15 → ×2,2 (máx. 180); erro/dica volta a 1 dia.
    SELECT repetition_number INTO v_rep FROM public.course_user_reviews
    WHERE user_id = v_user_id AND unit_id = v_unit_id FOR UPDATE;
    IF v_clean THEN
      v_rep := coalesce(v_rep, 0) + 1;
      v_interval := CASE v_rep WHEN 1 THEN 1 WHEN 2 THEN 3 WHEN 3 THEN 7 WHEN 4 THEN 15
        ELSE least(180, round(15 * power(2.2, v_rep - 4))::INT) END;
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

REVOKE ALL ON FUNCTION public.rpc_course_commit_practice(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_commit_practice(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT, INT, INT, JSONB, BOOLEAN) TO authenticated;

-- Compatibilidade: clientes da versão anterior continuam gravando lições completas.
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.rpc_course_commit_practice(
    p_client_session_id, 'lesson', p_lesson_id, p_difficulty, p_started_at,
    p_active_time_seconds, p_score, p_highest_combo,
    (SELECT coalesce(jsonb_agg(r || jsonb_build_object('hint_count', CASE WHEN coalesce((r->>'used_hint')::BOOLEAN, false) THEN 1 ELSE 0 END)), '[]'::jsonb)
     FROM jsonb_array_elements(p_results) r),
    true);
$$;

-- ============================================================================
-- "Meus cursos"
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_set_course_in_my_courses(p_course_id TEXT, p_in BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.course_catalog WHERE id = p_course_id AND is_published) THEN
    RAISE EXCEPTION 'course not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.user_course_enrollment (user_id, course_id, in_my_courses, last_studied_at)
  VALUES (v_user_id, p_course_id, coalesce(p_in, true), now())
  ON CONFLICT (user_id, course_id) DO UPDATE SET in_my_courses = coalesce(p_in, true);
  RETURN coalesce(p_in, true);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_set_course_in_my_courses(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_course_in_my_courses(TEXT, BOOLEAN) TO authenticated;

-- ============================================================================
-- Catálogo com alunos (agregado) e progresso do usuário por lição
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_course_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(course ORDER BY (course->>'order_index')::INT), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'short_description', c.short_description,
      'long_description', c.long_description, 'level', c.level, 'category', c.category,
      'order_index', c.order_index, 'created_at', c.created_at,
      'learners_count', (SELECT count(*) FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.in_my_courses),
      'my', (
        SELECT jsonb_build_object('in_my_courses', e.in_my_courses, 'percent_completed', e.percent_completed,
          'completed_lessons', e.completed_lessons, 'current_lesson_id', e.current_lesson_id, 'last_studied_at', e.last_studied_at)
        FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.user_id = auth.uid()
      ),
      'lessons', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id, 'chapter_number', l.chapter_number, 'title', l.title, 'description', l.description,
          'unit_count', (SELECT count(*) FROM public.course_units u WHERE u.lesson_id = l.id),
          'my_best_answered', (SELECT max(s.answered_questions) FROM public.course_practice_sessions s
            WHERE s.lesson_id = l.id AND s.user_id = auth.uid())
        ) ORDER BY l.chapter_number), '[]'::jsonb)
        FROM public.course_lessons l
        WHERE l.course_id = c.id AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
      )
    ) AS course
    FROM public.course_catalog c
    WHERE c.is_published
  ) t
  WHERE jsonb_array_length(course->'lessons') > 0;
$$;
REVOKE ALL ON FUNCTION public.rpc_course_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_catalog() TO authenticated;

-- ============================================================================
-- Início: continuar, semana (check-in), revisão, tempo e recentes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_course_hub_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
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
    'reviews_due_count', (SELECT count(*) FROM public.course_user_reviews r, me WHERE r.user_id = me.uid AND r.due_date <= now()),
    'next_review_at', (SELECT min(r.due_date) FROM public.course_user_reviews r, me WHERE r.user_id = me.uid AND r.due_date > now()),
    'recent', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'last_at') DESC) FROM (
        SELECT jsonb_build_object('lesson_id', s.lesson_id, 'last_at', max(s.started_at),
          'best_answered', max(s.answered_questions), 'total', max(s.total_questions)) AS x
        FROM sessions s WHERE s.kind = 'lesson'
        GROUP BY s.lesson_id ORDER BY max(s.started_at) DESC LIMIT 3) r), '[]'::jsonb)
  );
$$;

-- ============================================================================
-- Análise de aprendizado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_course_analysis(
  p_days INT DEFAULT 30,
  p_course_id TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  bounds AS (
    SELECT
      CASE WHEN coalesce(p_days, 0) > 0
        THEN (timezone('utc', now()))::DATE - (p_days - 1) END AS since,
      CASE WHEN coalesce(p_days, 0) > 0
        THEN (timezone('utc', now()))::DATE - (2 * p_days - 1) END AS prev_since
  ),
  s_all AS (
    SELECT s.*, (timezone('utc', s.started_at))::DATE AS day, l.course_id
    FROM public.course_practice_sessions s
    JOIN me ON s.user_id = me.uid
    LEFT JOIN public.course_lessons l ON l.id = s.lesson_id
  ),
  s_f AS (
    SELECT * FROM s_all
    WHERE (p_course_id IS NULL OR course_id = p_course_id)
      AND (p_difficulty IS NULL OR difficulty = p_difficulty)
  ),
  cur AS (SELECT s_f.* FROM s_f, bounds WHERE bounds.since IS NULL OR s_f.day >= bounds.since),
  prev AS (SELECT s_f.* FROM s_f, bounds WHERE bounds.since IS NOT NULL AND s_f.day >= bounds.prev_since AND s_f.day < bounds.since),
  r_cur AS (
    SELECT r.* FROM public.course_session_results r JOIN cur ON cur.id = r.session_id AND cur.status = 'completed'
  ),
  r_prev AS (
    SELECT r.* FROM public.course_session_results r JOIN prev ON prev.id = r.session_id AND prev.status = 'completed'
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'active_seconds', coalesce((SELECT sum(active_time_seconds) FROM cur), 0),
      'completed_sessions', (SELECT count(*) FROM cur WHERE status = 'completed'),
      'accuracy', (SELECT round(avg(CASE WHEN attempts = 1 THEN 100 ELSE 0 END), 1) FROM r_cur),
      'hint_usage', (SELECT round(avg(CASE WHEN hint_count > 0 OR revealed THEN 100 ELSE 0 END), 1) FROM r_cur),
      'completed_questions', (SELECT count(*) FROM r_cur)
    ),
    'previous', CASE WHEN (SELECT since FROM bounds) IS NULL THEN NULL ELSE jsonb_build_object(
      'active_seconds', coalesce((SELECT sum(active_time_seconds) FROM prev), 0),
      'completed_sessions', (SELECT count(*) FROM prev WHERE status = 'completed'),
      'accuracy', (SELECT round(avg(CASE WHEN attempts = 1 THEN 100 ELSE 0 END), 1) FROM r_prev),
      'hint_usage', (SELECT round(avg(CASE WHEN hint_count > 0 OR revealed THEN 100 ELSE 0 END), 1) FROM r_prev)
    ) END,
    'content', jsonb_build_object(
      'words_encountered', (
        SELECT count(DISTINCT lower(a->>'surface'))
        FROM public.course_session_results r
        JOIN me ON r.user_id = me.uid
        JOIN public.course_units u ON u.id = r.unit_id,
        jsonb_array_elements(u.annotations) a),
      'courses_studied', (SELECT count(DISTINCT course_id) FROM s_all WHERE course_id IS NOT NULL),
      'chapters_completed', (SELECT count(DISTINCT lesson_id) FROM s_all WHERE status = 'completed' AND kind = 'lesson')
    ),
    'bests', jsonb_build_object(
      'streak', (SELECT jsonb_build_object('value', highest_combo, 'session_id', id, 'lesson_id', lesson_id, 'at', started_at)
        FROM s_all WHERE highest_combo > 0 ORDER BY highest_combo DESC, started_at LIMIT 1),
      'score', (SELECT jsonb_build_object('value', score, 'session_id', id, 'lesson_id', lesson_id, 'at', started_at)
        FROM s_all WHERE status = 'completed' AND score > 0 ORDER BY score DESC, started_at LIMIT 1),
      'accuracy', (SELECT jsonb_build_object('value', accuracy_rate, 'session_id', id, 'lesson_id', lesson_id, 'at', started_at)
        FROM s_all WHERE status = 'completed' ORDER BY accuracy_rate DESC, started_at LIMIT 1)
    ),
    'heatmap', coalesce((
      SELECT jsonb_object_agg(day::TEXT, secs) FROM (
        SELECT day, sum(active_time_seconds) AS secs FROM s_all
        WHERE day >= date_trunc('year', timezone('utc', now()))::DATE
        GROUP BY day HAVING sum(active_time_seconds) > 0) h), '{}'::jsonb),
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', day, 'active_seconds', secs, 'accuracy', acc, 'hint_usage', hint) ORDER BY day)
      FROM (
        SELECT cur.day, sum(cur.active_time_seconds) AS secs,
          (SELECT round(avg(CASE WHEN r.attempts = 1 THEN 100 ELSE 0 END), 1)
             FROM r_cur r JOIN cur c2 ON c2.id = r.session_id WHERE c2.day = cur.day) AS acc,
          (SELECT round(avg(CASE WHEN r.hint_count > 0 OR r.revealed THEN 100 ELSE 0 END), 1)
             FROM r_cur r JOIN cur c2 ON c2.id = r.session_id WHERE c2.day = cur.day) AS hint
        FROM cur GROUP BY cur.day) d), '[]'::jsonb),
    'history', coalesce((
      SELECT jsonb_agg(jsonb_build_object('session_id', id, 'kind', kind, 'lesson_id', lesson_id, 'course_id', course_id,
        'difficulty', difficulty, 'started_at', started_at, 'active_seconds', active_time_seconds,
        'answered', answered_questions, 'total', total_questions, 'accuracy', accuracy_rate,
        'status', status, 'score', score) ORDER BY started_at DESC)
      FROM (SELECT * FROM cur ORDER BY started_at DESC LIMIT 50) h), '[]'::jsonb),
    'courses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('course_id', course_id, 'sessions', n, 'active_seconds', secs,
        'accuracy', acc, 'chapters_completed', done))
      FROM (
        SELECT course_id, count(*) AS n, sum(active_time_seconds) AS secs,
          round(avg(accuracy_rate) FILTER (WHERE status = 'completed'), 1) AS acc,
          count(DISTINCT lesson_id) FILTER (WHERE status = 'completed') AS done
        FROM cur WHERE course_id IS NOT NULL GROUP BY course_id) c), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.rpc_course_analysis(INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_analysis(INT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- Ranking por tempo ativo de estudo nos cursos (UTC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_course_leaderboard(p_period TEXT DEFAULT 'weekly', p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMP := timezone('utc', now());
  v_since TIMESTAMPTZ;
  v_limit INT := greatest(1, least(coalesce(p_limit, 100), 100));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  v_since := CASE p_period
    WHEN 'daily' THEN date_trunc('day', v_now) AT TIME ZONE 'utc'
    WHEN 'weekly' THEN date_trunc('week', v_now) AT TIME ZONE 'utc'
    WHEN 'monthly' THEN date_trunc('month', v_now) AT TIME ZONE 'utc'
    WHEN 'all' THEN '-infinity'::TIMESTAMPTZ
    ELSE NULL END;
  IF v_since IS NULL THEN
    RAISE EXCEPTION 'invalid period' USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH totals AS (
      SELECT s.user_id, sum(s.active_time_seconds)::INT AS seconds
      FROM public.course_practice_sessions s
      WHERE s.started_at >= v_since
      GROUP BY s.user_id
      HAVING sum(s.active_time_seconds) > 0
    ),
    ranked AS (
      SELECT t.user_id, t.seconds,
        rank() OVER (ORDER BY t.seconds DESC) AS position,
        coalesce(nullif(trim(st.username), ''), 'Aluno') AS username,
        st.avatar_url
      FROM totals t
      LEFT JOIN public.user_stats st ON st.user_id = t.user_id
    )
    SELECT jsonb_build_object(
      'period', p_period,
      'since', CASE WHEN p_period = 'all' THEN NULL ELSE v_since END,
      'total_ranked', (SELECT count(*) FROM ranked),
      'top', coalesce((
        SELECT jsonb_agg(jsonb_build_object('position', position, 'username', username, 'avatar_url', avatar_url,
          'seconds', seconds, 'is_current_user', user_id = v_user_id) ORDER BY position, username)
        FROM (SELECT * FROM ranked ORDER BY position, username LIMIT v_limit) top), '[]'::jsonb),
      'me', (SELECT jsonb_build_object('position', position, 'seconds', seconds) FROM ranked WHERE user_id = v_user_id),
      'updated_at', now()
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_course_leaderboard(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_leaderboard(TEXT, INT) TO authenticated;
