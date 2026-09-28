-- ============================================================================
-- Estatísticas de todo o sistema para a página Progresso (uma chamada).
-- SECURITY DEFINER porque listening_intervals não é legível diretamente pelo
-- cliente; TODA consulta abaixo filtra por auth.uid() (teste de isolamento em
-- tests/sql/system-stats.sql).
-- Datas no fuso do usuário (user_stats.timezone; UTC se ausente), como
-- sessions.date e review_log.date já são gravados.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_system_stats(p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tz TEXT;
  v_today DATE;
  v_days INT := CASE WHEN coalesce(p_days, 0) <= 0 THEN NULL ELSE least(p_days, 3650) END;
  v_since DATE;
  v_prev_since DATE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT nullif(trim(timezone), '') INTO v_tz FROM public.user_stats WHERE user_id = v_uid;
  BEGIN
    v_today := (now() AT TIME ZONE coalesce(v_tz, 'UTC'))::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_tz := NULL; -- fuso inválido gravado no perfil: usa UTC em todo o cálculo
    v_today := (now() AT TIME ZONE 'UTC')::DATE;
  END;
  v_since := CASE WHEN v_days IS NULL THEN NULL ELSE v_today - (v_days - 1) END;
  v_prev_since := CASE WHEN v_days IS NULL THEN NULL ELSE v_today - (2 * v_days - 1) END;

  RETURN (
    WITH
    sess AS (SELECT date, source, seconds FROM public.sessions WHERE user_id = v_uid AND seconds > 0),
    rev AS (SELECT date, quality, previous_status, response_time_ms FROM public.review_log WHERE user_id = v_uid),
    study_days AS (
      SELECT date FROM sess UNION SELECT date FROM rev
    ),
    islands AS (
      SELECT date, date - (row_number() OVER (ORDER BY date))::INT AS grp FROM (SELECT DISTINCT date FROM study_days) d
    ),
    runs AS (
      SELECT min(date) AS first_day, max(date) AS last_day, count(*)::INT AS len FROM islands GROUP BY grp
    ),
    cur AS (SELECT * FROM sess WHERE v_since IS NULL OR date >= v_since),
    prev AS (SELECT * FROM sess WHERE v_since IS NOT NULL AND date >= v_prev_since AND date < v_since),
    rev_cur AS (SELECT * FROM rev WHERE v_since IS NULL OR date >= v_since),
    rev_prev AS (SELECT * FROM rev WHERE v_since IS NOT NULL AND date >= v_prev_since AND date < v_since),
    course_cur AS (
      SELECT * FROM public.course_practice_sessions
      WHERE user_id = v_uid AND (v_since IS NULL OR (timezone(coalesce(v_tz, 'UTC'), started_at))::DATE >= v_since)
    )
    SELECT jsonb_build_object(
      'period', jsonb_build_object('days', v_days, 'since', v_since, 'today', v_today, 'timezone', coalesce(v_tz, 'UTC')),

      'time', jsonb_build_object(
        'total_seconds', coalesce((SELECT sum(seconds) FROM cur), 0),
        'previous_seconds', CASE WHEN v_since IS NULL THEN NULL ELSE coalesce((SELECT sum(seconds) FROM prev), 0) END,
        'active_days', (SELECT count(DISTINCT date) FROM cur),
        'by_source', coalesce((SELECT jsonb_object_agg(source, secs) FROM (
          SELECT source, sum(seconds) AS secs FROM cur GROUP BY source) s), '{}'::jsonb),
        'daily_average_seconds', CASE WHEN v_days IS NULL THEN NULL
          ELSE round(coalesce((SELECT sum(seconds) FROM cur), 0)::NUMERIC / v_days) END
      ),

      'streak', jsonb_build_object(
        'current', coalesce((SELECT len FROM runs WHERE last_day >= v_today - 1 ORDER BY last_day DESC LIMIT 1), 0),
        'best', coalesce((SELECT max(len) FROM runs), 0),
        'studied_today', EXISTS (SELECT 1 FROM study_days WHERE date = v_today),
        'total_days', (SELECT count(DISTINCT date) FROM study_days)
      ),

      'daily', coalesce((
        SELECT jsonb_agg(jsonb_build_object('date', d, 'seconds', coalesce(s.secs, 0), 'reviews', coalesce(r.n, 0)) ORDER BY d)
        FROM generate_series(coalesce(v_since, v_today - 89), v_today, INTERVAL '1 day') AS g(d)
        LEFT JOIN (SELECT date, sum(seconds) AS secs FROM sess GROUP BY date) s ON s.date = g.d::DATE
        LEFT JOIN (SELECT date, count(*) AS n FROM rev GROUP BY date) r ON r.date = g.d::DATE
      ), '[]'::jsonb),

      'heatmap', coalesce((
        SELECT jsonb_object_agg(date::TEXT, secs) FROM (
          SELECT date, sum(seconds) AS secs FROM sess
          WHERE date >= date_trunc('year', v_today)::DATE GROUP BY date) h
      ), '{}'::jsonb),

      'vocabulary', jsonb_build_object(
        'total', (SELECT count(*) FROM public.words WHERE user_id = v_uid),
        'added_in_period', (SELECT count(*) FROM public.words WHERE user_id = v_uid
          AND (v_since IS NULL OR (timezone(coalesce(v_tz, 'UTC'), added_at))::DATE >= v_since)),
        'by_level', coalesce((SELECT jsonb_object_agg(lvl, n) FROM (
          SELECT coalesce(nullif(level, ''), 'sem nível') AS lvl, count(*) AS n
          FROM public.words WHERE user_id = v_uid GROUP BY 1) l), '{}'::jsonb),
        'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (
          SELECT status, count(*) AS n FROM public.cards WHERE user_id = v_uid AND NOT coalesce(suspended, false) GROUP BY status) c), '{}'::jsonb),
        'suspended', (SELECT count(*) FROM public.cards WHERE user_id = v_uid AND coalesce(suspended, false)),
        'leeches', (SELECT count(*) FROM public.cards WHERE user_id = v_uid AND coalesce(is_leech, false))
      ),

      'reviews', jsonb_build_object(
        'count', (SELECT count(*) FROM rev_cur),
        'previous_count', CASE WHEN v_since IS NULL THEN NULL ELSE (SELECT count(*) FROM rev_prev) END,
        'success_rate', (SELECT round(avg(CASE WHEN quality > 1 THEN 100 ELSE 0 END), 1) FROM rev_cur),
        'previous_success_rate', CASE WHEN v_since IS NULL THEN NULL
          ELSE (SELECT round(avg(CASE WHEN quality > 1 THEN 100 ELSE 0 END), 1) FROM rev_prev) END,
        'retention_mature', (SELECT round(avg(CASE WHEN quality > 1 THEN 100 ELSE 0 END), 1) FROM rev_cur WHERE previous_status = 'review'),
        'by_grade', coalesce((SELECT jsonb_object_agg(quality, n) FROM (SELECT quality, count(*) AS n FROM rev_cur GROUP BY quality) q), '{}'::jsonb),
        'median_response_ms', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY response_time_ms) FROM rev_cur WHERE response_time_ms > 0),
        'due_now', (SELECT count(*) FROM public.cards WHERE user_id = v_uid AND NOT coalesce(suspended, false)
          AND status <> 'new' AND due_date <= now()),
        'forecast', coalesce((
          SELECT jsonb_agg(jsonb_build_object('date', d, 'count', coalesce(c.n, 0)) ORDER BY d)
          FROM generate_series(v_today, v_today + 13, INTERVAL '1 day') AS g(d)
          LEFT JOIN (
            SELECT greatest((timezone(coalesce(v_tz, 'UTC'), due_date))::DATE, v_today) AS day, count(*) AS n
            FROM public.cards WHERE user_id = v_uid AND NOT coalesce(suspended, false) AND status <> 'new'
              AND due_date < (v_today + 14)::TIMESTAMP
            GROUP BY 1) c ON c.day = g.d::DATE
        ), '[]'::jsonb)
      ),

      'courses', jsonb_build_object(
        'active_seconds', coalesce((SELECT sum(active_time_seconds) FROM course_cur), 0),
        'sessions_completed', (SELECT count(*) FROM course_cur WHERE status = 'completed'),
        'phrases_answered', coalesce((SELECT sum(answered_questions) FROM course_cur), 0),
        'accuracy', (SELECT round(avg(accuracy_rate), 1) FROM course_cur WHERE status = 'completed'),
        'chapters_completed', (SELECT count(DISTINCT lesson_id) FROM public.course_practice_sessions
          WHERE user_id = v_uid AND status = 'completed' AND kind = 'lesson'),
        'courses_in_progress', (SELECT count(*) FROM public.user_course_enrollment WHERE user_id = v_uid AND percent_completed > 0 AND percent_completed < 100),
        'courses_completed', (SELECT count(*) FROM public.user_course_enrollment WHERE user_id = v_uid AND percent_completed >= 100)
      ),

      'reading', jsonb_build_object(
        'texts', (SELECT count(*) FROM public.reader_texts WHERE user_id = v_uid),
        'texts_completed', (SELECT count(*) FROM public.reader_texts WHERE user_id = v_uid AND is_completed),
        'texts_in_progress', (SELECT count(*) FROM public.reader_texts WHERE user_id = v_uid AND NOT coalesce(is_completed, false) AND coalesce(reading_percentage, 0) > 0),
        'stories', (SELECT count(*) FROM public.stories WHERE user_id = v_uid AND NOT coalesce(archived, false)),
        'story_words', coalesce((SELECT sum(word_count) FROM public.stories WHERE user_id = v_uid AND NOT coalesce(archived, false)), 0)
      ),

      'listening', jsonb_build_object(
        'verified_seconds', coalesce((SELECT sum(credited_seconds) FROM public.listening_intervals
          WHERE user_id = v_uid AND (v_since IS NULL OR local_date >= v_since)), 0),
        'days', (SELECT count(DISTINCT local_date) FROM public.listening_intervals
          WHERE user_id = v_uid AND credited_seconds > 0 AND (v_since IS NULL OR local_date >= v_since))
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_system_stats(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_system_stats(INT) TO authenticated;

-- Único índice que faltava para as janelas por data (os de sessions/review_log já existem).
CREATE INDEX IF NOT EXISTS idx_listening_intervals_user_date ON public.listening_intervals (user_id, local_date);
