-- ============================================================================
-- Trilhas e progressão por nível (A1–B2) + novos tipos de unidade.
-- Append-only sobre a plataforma de cursos.
-- ============================================================================

ALTER TABLE public.course_catalog
  ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'dia-a-dia',
  ADD COLUMN IF NOT EXISTS track_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.course_catalog
  ADD CONSTRAINT course_catalog_track_check CHECK (track IN ('fundamentos', 'dia-a-dia', 'viagem', 'gramatica', 'trabalho', 'fluencia'));

-- Tipos: frase, palavra (com significado), formas verbais, phrasal verb, trecho de história.
ALTER TABLE public.course_units DROP CONSTRAINT IF EXISTS course_units_kind_check;
ALTER TABLE public.course_units
  ADD CONSTRAINT course_units_kind_check CHECK (kind IN ('sentence', 'dialogue', 'slang_idiom', 'paragraph', 'word', 'verb_forms', 'phrasal', 'story'));
ALTER TABLE public.course_units ADD COLUMN IF NOT EXISTS example_en TEXT;
ALTER TABLE public.course_units ADD COLUMN IF NOT EXISTS example_pt TEXT;

UPDATE public.course_catalog SET track = 'dia-a-dia', track_order = 1 WHERE id = 'course-street-a1';
UPDATE public.course_catalog SET track = 'viagem', track_order = 1 WHERE id = 'course-travel-a2';
UPDATE public.course_catalog SET track = 'trabalho', track_order = 1 WHERE id = 'course-work-b1';

CREATE INDEX IF NOT EXISTS idx_course_catalog_level_track ON public.course_catalog (level, track, track_order) WHERE is_published;

-- Catálogo: acrescenta trilha, ordem e se é curso central do nível.
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
      'track', c.track, 'track_order', c.track_order, 'is_core', c.is_core,
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

-- Trilha do aluno: nível atual, progresso por nível e próxima aula recomendada.
-- Nível concluído = 80% dos capítulos dos cursos centrais daquele nível.
-- O nivelamento (settings.lf_cefr_level) define o ponto de partida: níveis
-- abaixo dele contam como "pulados", não como pendentes.
CREATE OR REPLACE FUNCTION public.rpc_course_path()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  levels(level, pos) AS (VALUES ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4)),
  placement AS (
    SELECT l.pos
    FROM public.settings s, me, levels l
    WHERE s.user_id = me.uid AND s.key = 'lf_cefr_level'
      AND upper(trim(both '"' FROM trim(s.value))) = l.level
    LIMIT 1
  ),
  core AS (
    SELECT c.id AS course_id, c.level, c.track, c.track_order, c.order_index, l.id AS lesson_id, l.chapter_number
    FROM public.course_catalog c
    JOIN public.course_lessons l ON l.course_id = c.id
    WHERE c.is_published AND c.is_core AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
  ),
  done AS (
    SELECT DISTINCT unnest(e.completed_lessons) AS lesson_id
    FROM public.user_course_enrollment e, me WHERE e.user_id = me.uid
  ),
  per_level AS (
    SELECT lv.level, lv.pos,
      count(c.lesson_id) AS total,
      count(c.lesson_id) FILTER (WHERE c.lesson_id IN (SELECT lesson_id FROM done)) AS completed
    FROM levels lv LEFT JOIN core c ON c.level = lv.level
    GROUP BY lv.level, lv.pos
  ),
  status AS (
    SELECT p.*,
      CASE WHEN p.total = 0 THEN 0 ELSE round(p.completed::NUMERIC * 100 / p.total, 1) END AS percent,
      (p.total > 0 AND p.completed::NUMERIC / p.total >= 0.8) AS is_completed,
      (p.pos < coalesce((SELECT pos FROM placement), 1)) AS skipped_by_placement
    FROM per_level p
  ),
  current_level AS (
    SELECT level, pos FROM status
    WHERE NOT is_completed AND NOT skipped_by_placement AND total > 0
    ORDER BY pos LIMIT 1
  ),
  next_lesson AS (
    SELECT c.course_id, c.lesson_id, c.level
    FROM core c
    WHERE c.lesson_id NOT IN (SELECT lesson_id FROM done)
      AND c.level IN (SELECT level FROM status WHERE NOT skipped_by_placement)
    ORDER BY (SELECT pos FROM levels WHERE level = c.level),
      array_position(ARRAY['fundamentos', 'dia-a-dia', 'viagem', 'gramatica', 'trabalho', 'fluencia'], c.track),
      c.track_order, c.order_index, c.chapter_number
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'placement_level', (SELECT l.level FROM placement p JOIN levels l ON l.pos = p.pos),
    'current_level', coalesce((SELECT level FROM current_level), (SELECT level FROM next_lesson)),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level) FROM next_lesson)
  );
$$;
REVOKE ALL ON FUNCTION public.rpc_course_path() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_path() TO authenticated;
