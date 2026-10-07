-- #537: banco descartável; commit verdadeiro, conquista, crescimento, isolamento e rollback.
BEGIN;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.settings,public.course_catalog,public.course_lessons,public.course_units,public.user_course_enrollment TO authenticated;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000537','levels@test.local'),('00000000-0000-4000-8000-000000000538','levels-other@test.local');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000537',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000537","role":"authenticated"}',true);
INSERT INTO public.settings(user_id,key,value) VALUES(auth.uid(),'lf_cefr_level','"A2"');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.course_level_completions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'placement inventou conquista'; END IF;
 IF has_table_privilege('authenticated','public.course_level_completions','INSERT') OR has_function_privilege('authenticated','private.record_course_level_completion(uuid,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'cliente pode forjar conquista'; END IF;
END $$;
DELETE FROM public.settings WHERE user_id=auth.uid() AND key='lf_cefr_level';
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND is_core AND id<>'lesson-sequence-a1-m8' GROUP BY course_id;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.course_level_completions WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'conquista prematura'; END IF; END $$;
SET LOCAL ROLE authenticated;
SELECT public.rpc_course_commit_practice('00000000-0000-4000-8000-000000005370','lesson','lesson-sequence-a1-m8','easy',now()-interval '2 minutes',90,100,1,
(SELECT jsonb_agg(jsonb_build_object('unit_id',id,'attempts',1,'hint_count',0,'revealed',false)) FROM public.course_units WHERE lesson_id='lesson-sequence-a1-m8'),true);
DO $$ DECLARE h public.course_level_completions; p jsonb; BEGIN
 SELECT * INTO h FROM public.course_level_completions WHERE user_id=auth.uid() AND level='A1';
 IF cardinality(h.lesson_ids)<>48 OR h.completed_at IS NULL THEN RAISE EXCEPTION 'snapshot da base não registrado'; END IF;
 p:=public.rpc_course_path();IF p->'next'->>'level'<>'A2' THEN RAISE EXCEPTION 'conclusão não avança'; END IF;
END $$;
-- Reenvio idempotente não altera a conquista.
SELECT public.rpc_course_commit_practice('00000000-0000-4000-8000-000000005370','lesson','lesson-sequence-a1-m8','easy',now()-interval '2 minutes',90,100,1,
(SELECT jsonb_agg(jsonb_build_object('unit_id',id,'attempts',1,'hint_count',0,'revealed',false)) FROM public.course_units WHERE lesson_id='lesson-sequence-a1-m8'),true);
RESET ROLE;
-- Reconhecer progresso anterior não inventa data; simula histórico antes do trigger.
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000539','levels-legacy@test.local');
ALTER TABLE public.user_course_enrollment DISABLE TRIGGER capture_course_level_completion;
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT '00000000-0000-4000-8000-000000000539',course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND is_core GROUP BY course_id;
ALTER TABLE public.user_course_enrollment ENABLE TRIGGER capture_course_level_completion;
SELECT private.record_course_level_completion('00000000-0000-4000-8000-000000000539',NULL);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.course_level_completions WHERE user_id='00000000-0000-4000-8000-000000000539' AND completed_at IS NULL AND recorded_at IS NOT NULL) THEN RAISE EXCEPTION 'data histórica inventada'; END IF;
END $$;
-- Simula expansão editorial sem criar aulas falsas fora da transação.
UPDATE public.course_lessons SET is_core=true,lesson_role='base' WHERE id='lesson-1000-words-a1-18';
DO $$ DECLARE p jsonb; l jsonb; BEGIN
 p:=public.rpc_course_path();SELECT value INTO l FROM jsonb_array_elements(p->'levels') WHERE value->>'level'='A1';
 IF p->'next'->>'level'<>'A2' OR (l->>'new_lessons')::int<>1 OR (l->'completion'->>'total')::int<>48 OR NOT (l->>'is_completed')::boolean THEN RAISE EXCEPTION 'novas aulas apagaram conquista: %',p; END IF;
 IF (SELECT count(*) FROM public.course_level_completions WHERE user_id=auth.uid())<>1 THEN RAISE EXCEPTION 'conquista duplicada'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000538',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM public.course_level_completions) THEN RAISE EXCEPTION 'histórico vazou entre usuários'; END IF;
 p:=public.rpc_course_path();IF p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'trilha vazou entre usuários'; END IF;
 BEGIN
  INSERT INTO public.course_level_completions(user_id,level,lesson_ids) VALUES(auth.uid(),'A1',ARRAY['fake']);
  RAISE EXCEPTION 'cliente forjou conquista';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
\ir ../../supabase/rollback/course_level_history_537.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_level_completions WHERE user_id='00000000-0000-4000-8000-000000000537')<>1 THEN RAISE EXCEPTION 'rollback apagou conquista'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='capture_course_level_completion') THEN RAISE EXCEPTION 'rollback não desativou captura'; END IF;
END $$;
ROLLBACK;
\echo course-level-history-537: OK
