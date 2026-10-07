-- Aceite humano do áudio em 2026-10-07 (#503/#505): incluir nove aulas já auditadas na trilha.
-- Preserva a migration curricular #528, conteúdo, níveis, ordem, requisitos e progresso.
-- Reversão: supabase/rollback/course_audio_acceptance_503.sql, sem apagar cursos.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE curriculum_order IS NOT NULL) <> 372
    OR (SELECT count(*) FROM public.course_units) <> 4088
    OR (SELECT md5(string_agg(concat_ws(chr(31), id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units) <> 'd0002890d367706d6d43090022638f99'
    OR (SELECT count(*) FROM public.course_catalog WHERE id IN ('course-spoken-reductions-a2','course-connected-speech-b2') AND is_published) <> 2
    OR (SELECT count(*) FROM public.course_lessons WHERE course_id IN ('course-spoken-reductions-a2','course-connected-speech-b2')) <> 9
  THEN RAISE EXCEPTION 'Conteúdo divergente do aceite #503/#505'; END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('lesson-spoken-reductions-a2-01','course-spoken-reductions-a2','B2'),
      ('lesson-connected-b2-01','course-connected-speech-b2','B2'),
      ('lesson-connected-b2-02','course-connected-speech-b2','B1'),
      ('lesson-connected-b2-03','course-connected-speech-b2','B1'),
      ('lesson-connected-b2-04','course-connected-speech-b2','B1'),
      ('lesson-connected-b2-05','course-connected-speech-b2','A2'),
      ('lesson-connected-b2-06','course-connected-speech-b2','B2'),
      ('lesson-connected-b2-07','course-connected-speech-b2','B2'),
      ('lesson-connected-b2-08','course-connected-speech-b2','B2')
    ) AS accepted(id,course_id,level)
    LEFT JOIN public.course_lessons l ON l.id=accepted.id
    WHERE l.id IS NULL OR l.course_id<>accepted.course_id OR l.level<>accepted.level OR l.curriculum_order IS NULL
  ) THEN RAISE EXCEPTION 'Aulas aprovadas sem classificação curricular esperada'; END IF;
END $$;

UPDATE public.course_catalog SET is_core=true
WHERE id IN ('course-spoken-reductions-a2','course-connected-speech-b2');
UPDATE public.course_lessons SET is_core=true
WHERE id IN (
  'lesson-spoken-reductions-a2-01',
  'lesson-connected-b2-01','lesson-connected-b2-02','lesson-connected-b2-03','lesson-connected-b2-04',
  'lesson-connected-b2-05','lesson-connected-b2-06','lesson-connected-b2-07','lesson-connected-b2-08'
);
