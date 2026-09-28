-- ============================================================================
-- Catálogo informa o tipo predominante de unidade de cada curso (palavra,
-- formas verbais, frase…) para a interface nomear a contagem corretamente.
-- Append-only: só substitui rpc_course_catalog, sem mudar tabelas.
-- ============================================================================

-- Catálogo: mesma forma de 20260928000000 + unit_kind (moda de course_units.kind).
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
      'unit_kind', (SELECT mode() WITHIN GROUP (ORDER BY u.kind) FROM public.course_units u
        JOIN public.course_lessons l ON l.id = u.lesson_id WHERE l.course_id = c.id),
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
