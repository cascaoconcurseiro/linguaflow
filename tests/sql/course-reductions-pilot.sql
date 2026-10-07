-- Curso piloto "Inglês Falado: Reduções" (Issue #503): conteúdo publicado, fora da trilha guiada e sem unidade vazia.
\set ON_ERROR_STOP on
DO $$
DECLARE c public.course_catalog; units int; empty int;
BEGIN
  SELECT * INTO c FROM public.course_catalog WHERE id = 'course-spoken-reductions-a2';
  IF c.id IS NULL THEN RAISE EXCEPTION 'curso piloto de reduções não foi publicado'; END IF;
  IF NOT c.is_published THEN RAISE EXCEPTION 'curso piloto deve estar publicado'; END IF;
  IF c.is_core THEN RAISE EXCEPTION 'piloto não pode entrar na trilha guiada (is_core deve ser false)'; END IF;
  IF c.level <> 'B2' OR c.track <> 'fluencia' OR c.category <> 'street-slang' THEN
    RAISE EXCEPTION 'nível, trilha ou categoria inesperados: %, %, %', c.level, c.track, c.category;
  END IF;
  SELECT count(*) INTO units FROM public.course_units u JOIN public.course_lessons l ON l.id = u.lesson_id WHERE l.course_id = c.id;
  IF units <> 10 THEN RAISE EXCEPTION 'o piloto deve ter 10 frases, veio %', units; END IF;
  SELECT count(*) INTO empty FROM public.course_units u JOIN public.course_lessons l ON l.id = u.lesson_id
   WHERE l.course_id = c.id AND (coalesce(u.explanation_note, '') = '' OR coalesce(u.ipa, '') = '' OR jsonb_array_length(u.annotations) = 0);
  IF empty <> 0 THEN RAISE EXCEPTION '% frases do piloto sem nota, IPA ou anotações', empty; END IF;
  -- Nenhum curso existente foi alterado: o piloto só acrescenta.
  IF (SELECT count(*) FROM public.course_catalog WHERE id = 'course-street-a1' AND is_core) <> 1 THEN
    RAISE EXCEPTION 'curso A1 existente não pode mudar';
  END IF;
END $$;
\echo course-reductions-pilot: OK
