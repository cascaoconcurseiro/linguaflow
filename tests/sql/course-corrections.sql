-- Correções de conteúdo publicado (Issue #435): a migration de correção atualiza só a unidade errada.
\set ON_ERROR_STOP on
DO $$
DECLARE note text; total int;
BEGIN
  SELECT explanation_note INTO note FROM public.course_units WHERE id = 'unit-1000-words-a1-05-08';
  IF note IS NULL OR note NOT LIKE '%perde o "e"%' OR note LIKE '%Mantém o "e"%' THEN
    RAISE EXCEPTION 'nota de ninety não foi corrigida: %', note;
  END IF;
  SELECT count(*) INTO total FROM public.course_units WHERE lesson_id = 'lesson-1000-words-a1-05';
  IF total <> 20 THEN RAISE EXCEPTION 'a lição deveria manter 20 unidades, veio %', total; END IF;
  IF (SELECT explanation_note FROM public.course_units WHERE id = 'unit-1000-words-a1-05-03') NOT LIKE '%Sem "u"%' THEN
    RAISE EXCEPTION 'unidade vizinha foi alterada';
  END IF;
END $$;
\echo course-corrections: OK
