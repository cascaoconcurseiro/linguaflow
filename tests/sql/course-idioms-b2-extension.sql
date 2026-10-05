-- Idioms B2, capítulos 7–10 (Issue #505): o curso passa de 6 para 10 capítulos sem alterar os existentes.
\set ON_ERROR_STOP on
DO $$
DECLARE chapters int; units int; incomplete int; bad_chapter int; c public.course_catalog;
BEGIN
  SELECT * INTO c FROM public.course_catalog WHERE id = 'course-idioms-b2';
  IF c.id IS NULL OR NOT c.is_published THEN RAISE EXCEPTION 'curso de idioms B2 deve existir e estar publicado'; END IF;
  IF c.level <> 'B2' OR c.track <> 'fluencia' OR NOT c.is_core THEN
    RAISE EXCEPTION 'metadados do curso mudaram: %, %, %', c.level, c.track, c.is_core;
  END IF;
  SELECT count(*) INTO chapters FROM public.course_lessons WHERE course_id = c.id;
  IF chapters <> 10 THEN RAISE EXCEPTION 'idioms B2 deve ter 10 capítulos, veio %', chapters; END IF;
  SELECT count(*) INTO units FROM public.course_units u JOIN public.course_lessons l ON l.id = u.lesson_id WHERE l.course_id = c.id;
  IF units <> 100 THEN RAISE EXCEPTION 'idioms B2 deve ter 100 frases, veio %', units; END IF;
  SELECT count(*) INTO bad_chapter FROM (
    SELECT l.id FROM public.course_lessons l LEFT JOIN public.course_units u ON u.lesson_id = l.id
     WHERE l.course_id = c.id GROUP BY l.id HAVING count(u.id) <> 10) t;
  IF bad_chapter <> 0 THEN RAISE EXCEPTION '% capítulos sem exatamente 10 frases', bad_chapter; END IF;
  SELECT count(*) INTO incomplete FROM public.course_units u JOIN public.course_lessons l ON l.id = u.lesson_id
   WHERE l.course_id = c.id AND (coalesce(u.explanation_note, '') = '' OR coalesce(u.ipa, '') = '' OR jsonb_array_length(u.annotations) = 0);
  IF incomplete <> 0 THEN RAISE EXCEPTION '% frases de idioms B2 sem nota, IPA ou anotações', incomplete; END IF;
  -- Os capítulos novos são exatamente 7 a 10, em ordem.
  IF (SELECT array_agg(chapter_number ORDER BY chapter_number) FROM public.course_lessons WHERE course_id = c.id) <> ARRAY[1,2,3,4,5,6,7,8,9,10] THEN
    RAISE EXCEPTION 'capítulos devem ser 1 a 10';
  END IF;
  -- Capítulo 1 não foi tocado.
  IF (SELECT text FROM public.course_units WHERE id = 'unit-idioms-b2-01-01') <> 'Let''s touch base next week.' THEN
    RAISE EXCEPTION 'frase do capítulo 1 foi alterada';
  END IF;
END $$;
\echo course-idioms-b2-extension: OK
