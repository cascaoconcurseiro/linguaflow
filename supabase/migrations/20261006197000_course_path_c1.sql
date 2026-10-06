-- #519: o primeiro curso C1 entra na trilha guiada. Só acrescenta ('C1', 5) à lista de níveis de
-- rpc_course_path; o resto da função é idêntico à definição publicada.
-- Rollback: recriar a função com a lista de níveis A1–B2.
CREATE OR REPLACE FUNCTION public.rpc_course_path()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  levels(level, pos) AS (VALUES ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5)),
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
