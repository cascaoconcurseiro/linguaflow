BEGIN;
CREATE TEMP TABLE review_before AS SELECT oid,md5(pg_get_functiondef(oid)) digest FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('rpc_course_commit_practice','rpc_course_review_summary');
\ir ../../supabase/rollback/course_pedagogy_533.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons WHERE is_core)<>372 THEN RAISE EXCEPTION 'rollback não restaurou a base histórica'; END IF;
 IF (SELECT count(*) FROM public.course_units)<>4424 THEN RAISE EXCEPTION 'rollback apagou unidades'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_catalog WHERE id LIKE 'course-pedagogy-%' AND is_published) THEN RAISE EXCEPTION 'novos cursos continuam publicados'; END IF;
 IF EXISTS(SELECT 1 FROM review_before b JOIN pg_proc p ON p.oid=b.oid WHERE b.digest<>md5(pg_get_functiondef(p.oid))) THEN RAISE EXCEPTION 'revisão alterada'; END IF;
END $$;
ROLLBACK;
\echo course-pedagogy-rollback-533: OK
