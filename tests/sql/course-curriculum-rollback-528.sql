-- Exercita reversão de metadados e RPCs sem persistir mudanças, só no Postgres descartável (#528).
BEGIN;
\ir ../../supabase/rollback/course_curriculum_528.sql
DO $$ DECLARE p jsonb; BEGIN
  IF (SELECT level FROM public.course_catalog WHERE id='course-street-a1') <> 'A1' THEN RAISE EXCEPTION 'nível anterior não restaurado'; END IF;
  IF EXISTS(SELECT 1 FROM public.course_lessons WHERE curriculum_order IS NOT NULL OR level IS NOT NULL) THEN RAISE EXCEPTION 'metadados não restaurados'; END IF;
  IF (SELECT count(*) FROM public.course_units) <> 4088 THEN RAISE EXCEPTION 'rollback alterou conteúdo'; END IF;
  p:=public.rpc_course_path();
  IF p->'next'->>'lesson_id' <> 'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'RPC antiga não restaurada'; END IF;
END $$;
ROLLBACK;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE curriculum_order IS NOT NULL) <> 372 THEN RAISE EXCEPTION 'reversão vazou fora da transação'; END IF;
END $$;
\echo course-curriculum-rollback-528: OK
