-- #535: reversão num banco descartável; não apaga progresso nem unidades.
BEGIN;
CREATE TEMP TABLE review_before AS SELECT oid,md5(pg_get_functiondef(oid)) digest FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('rpc_course_commit_practice','rpc_course_review_summary');
CREATE TEMP TABLE progress_before AS SELECT md5(coalesce(string_agg(row_to_json(e)::text,',' ORDER BY user_id,course_id),'empty')) digest FROM public.user_course_enrollment e;
\ir ../../supabase/rollback/course_sequence_535.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons WHERE is_core)<>212 OR (SELECT count(*) FROM public.course_units)<>4704 THEN RAISE EXCEPTION 'rollback #535'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_catalog WHERE id LIKE 'course-sequence-%' AND is_published) THEN RAISE EXCEPTION 'adições ainda publicadas'; END IF;
 IF EXISTS(SELECT 1 FROM review_before b JOIN pg_proc p ON p.oid=b.oid WHERE b.digest<>md5(pg_get_functiondef(p.oid))) THEN RAISE EXCEPTION 'revisão alterada'; END IF;
 IF (SELECT digest FROM progress_before) IS DISTINCT FROM (SELECT md5(coalesce(string_agg(row_to_json(e)::text,',' ORDER BY user_id,course_id),'empty')) FROM public.user_course_enrollment e) THEN RAISE EXCEPTION 'progresso alterado'; END IF;
END $$;
ROLLBACK;
\echo course-sequence-rollback-535: OK
