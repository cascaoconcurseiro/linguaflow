-- #531: ensaio de rollback em transação; nunca altera o banco final do replay.
\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/rollback/course_review_method_531.sql
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_user_reviews' AND column_name='last_schedule_change_at') THEN RAISE EXCEPTION 'rollback não removeu marcador'; END IF;
IF position('least(30' in pg_get_functiondef('public.rpc_course_commit_practice(uuid,text,text,text,timestamptz,integer,integer,integer,jsonb,boolean)'::regprocedure))>0 THEN RAISE EXCEPTION 'rollback não restaurou RPC'; END IF;
END $$;
ROLLBACK;
\echo course-review-method-rollback-531: OK
