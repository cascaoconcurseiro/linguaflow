-- #537: desativa captura e restaura leitura #535; preserva conquistas e progresso.
DROP TRIGGER IF EXISTS capture_course_level_completion ON public.user_course_enrollment;
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
    SELECT c.id AS course_id, l.level, l.curriculum_order, l.prerequisite_lesson_ids, l.id AS lesson_id, l.chapter_number, l.module_title, l.module_order, l.title, c.title AS course_title, l.lesson_stage, l.learning_objective
    FROM public.course_catalog c
    JOIN public.course_lessons l ON l.course_id = c.id
    WHERE c.is_published AND c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
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
      (p.total > 0 AND p.completed = p.total) AS is_completed,
      (p.pos < coalesce((SELECT pos FROM placement), 1)) AS skipped_by_placement
    FROM per_level p
  ),
  current_level AS (
    SELECT level, pos FROM status
    WHERE NOT is_completed AND NOT skipped_by_placement AND total > 0
    ORDER BY pos LIMIT 1
  ),
  next_lesson AS (
    SELECT c.course_id, c.lesson_id, c.level, c.module_title, c.title, c.course_title, c.lesson_stage, c.learning_objective
    FROM core c
    WHERE c.lesson_id NOT IN (SELECT lesson_id FROM done)
      AND c.level = (SELECT level FROM current_level)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(c.prerequisite_lesson_ids) AS requirement(id)
        LEFT JOIN public.course_lessons pl ON pl.id=requirement.id
        WHERE pl.id IS NULL OR (pl.id NOT IN (SELECT lesson_id FROM done)
          AND pl.level NOT IN (SELECT level FROM status WHERE skipped_by_placement))
      )
    ORDER BY (SELECT pos FROM levels WHERE level = c.level),
      c.curriculum_order, c.lesson_id
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'placement_level', (SELECT l.level FROM placement p JOIN levels l ON l.pos = p.pos),
     'current_level', coalesce((SELECT level FROM next_lesson), (SELECT level FROM current_level)),
    'blocked', NOT EXISTS(SELECT 1 FROM next_lesson) AND EXISTS(SELECT 1 FROM core c WHERE c.lesson_id NOT IN(SELECT lesson_id FROM done) AND c.level IN(SELECT level FROM status WHERE NOT skipped_by_placement)),
     'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'level', m.level,'title',m.module_title,'order',m.module_order,'total',m.total,'completed',m.completed
    ) ORDER BY m.level,m.module_order),'[]'::jsonb) FROM (
      SELECT c.level,c.module_title,c.module_order,count(*) AS total,
        count(*) FILTER(WHERE c.lesson_id IN(SELECT lesson_id FROM done)) AS completed
      FROM core c GROUP BY c.level,c.module_title,c.module_order
    ) m),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level, 'module_title', module_title, 'title', title, 'course_title', course_title, 'lesson_stage', lesson_stage, 'learning_objective', learning_objective) FROM next_lesson)
  );
$$;


REVOKE ALL ON FUNCTION public.rpc_course_path() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_path() TO authenticated;
NOTIFY pgrst,'reload schema';
