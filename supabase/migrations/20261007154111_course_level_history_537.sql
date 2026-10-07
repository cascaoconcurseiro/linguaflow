-- #537: conquista imutável da base disponível; não altera aulas, agenda ou matrículas.
CREATE TABLE public.course_level_completions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1')),
  lesson_ids TEXT[] NOT NULL CHECK (cardinality(lesson_ids) > 0),
  completed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE public.course_level_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_level_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.course_level_completions TO authenticated;
-- A trilha invoker consulta o início da prática; a RLS existente limita à própria conta.
GRANT SELECT ON public.course_practice_sessions TO authenticated;
CREATE POLICY course_level_completions_select_own ON public.course_level_completions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION private.record_course_level_completion(p_user UUID, p_completed_at TIMESTAMPTZ)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH done AS (
    SELECT DISTINCT unnest(e.completed_lessons) AS id
    FROM public.user_course_enrollment e WHERE e.user_id = p_user
  ), base AS (
    SELECT l.id, l.level FROM public.course_lessons l
    JOIN public.course_catalog c ON c.id = l.course_id
    WHERE c.is_published AND c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
  )
  INSERT INTO public.course_level_completions (user_id, level, lesson_ids, completed_at)
  SELECT p_user, b.level, array_agg(b.id ORDER BY b.id), p_completed_at
  FROM base b GROUP BY b.level
  HAVING count(*) = count(*) FILTER (WHERE b.id IN (SELECT id FROM done))
  ON CONFLICT (user_id, level) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION private.record_course_level_completion(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.capture_course_level_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.completed_lessons IS NOT DISTINCT FROM OLD.completed_lessons THEN RETURN NEW; END IF;
  END IF;
  -- A RPC de prática já serializa as sessões do usuário pelo lock #531.
  PERFORM private.record_course_level_completion(NEW.user_id, now());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.capture_course_level_completion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_course_level_completion
  AFTER INSERT OR UPDATE OF completed_lessons ON public.user_course_enrollment
  FOR EACH ROW EXECUTE FUNCTION private.capture_course_level_completion();

-- Para progresso anterior, reconhece a conclusão sem inventar uma data histórica.
DO $$ DECLARE student UUID; BEGIN
  FOR student IN SELECT DISTINCT user_id FROM public.user_course_enrollment LOOP
    PERFORM private.record_course_level_completion(student, NULL);
  END LOOP;
END $$;

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
    SELECT p.*, h.lesson_ids AS completed_base_ids, h.completed_at AS base_completed_at, h.recorded_at AS completion_recorded_at,
      CASE WHEN p.total = 0 THEN 0 ELSE round(p.completed::NUMERIC * 100 / p.total, 1) END AS percent,
      (h.user_id IS NOT NULL OR (p.total > 0 AND p.completed = p.total)) AS is_completed,
      (p.pos < coalesce((SELECT pos FROM placement), 1)) AS skipped_by_placement
    FROM per_level p LEFT JOIN public.course_level_completions h ON h.user_id=(SELECT uid FROM me) AND h.level=p.level
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
    'blocked', NOT EXISTS(SELECT 1 FROM next_lesson) AND EXISTS(SELECT 1 FROM core c WHERE c.lesson_id NOT IN(SELECT lesson_id FROM done) AND c.level IN(SELECT level FROM status WHERE NOT skipped_by_placement AND NOT is_completed)),
     'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'level', m.level,'title',m.module_title,'order',m.module_order,'total',m.total,'completed',m.completed
    ) ORDER BY m.level,m.module_order),'[]'::jsonb) FROM (
      SELECT c.level,c.module_title,c.module_order,count(*) AS total,
        count(*) FILTER(WHERE c.lesson_id IN(SELECT lesson_id FROM done)) AS completed
      FROM core c GROUP BY c.level,c.module_title,c.module_order
    ) m),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement,
      'started_at', (SELECT min(s.started_at) FROM public.course_practice_sessions s JOIN public.course_lessons l ON l.id=s.lesson_id WHERE s.user_id=(SELECT uid FROM me) AND l.level=status.level AND s.answered_questions>0),
      'completion', CASE WHEN completed_base_ids IS NULL THEN NULL ELSE jsonb_build_object('total',cardinality(completed_base_ids),'completed_at',base_completed_at,'recorded_at',completion_recorded_at) END,
      'new_lessons', CASE WHEN completed_base_ids IS NULL THEN 0 ELSE (SELECT count(*) FROM core c WHERE c.level=status.level AND NOT c.lesson_id=ANY(completed_base_ids)) END) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level, 'module_title', module_title, 'title', title, 'course_title', course_title, 'lesson_stage', lesson_stage, 'learning_objective', learning_objective) FROM next_lesson)
  );
$$;


REVOKE ALL ON FUNCTION public.rpc_course_path() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_path() TO authenticated;
NOTIFY pgrst,'reload schema';
