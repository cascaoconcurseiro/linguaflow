-- #535: replay descartável; recomendação pós-commit, dependências e isolamento.
BEGIN;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.settings,public.course_catalog,public.course_lessons,public.course_units,public.user_course_enrollment TO authenticated;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000535','sequence@test.local'),('00000000-0000-4000-8000-000000000536','other-sequence@test.local');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000535',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000535","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons)<>449 OR (SELECT count(*) FROM public.course_units)<>4704 THEN RAISE EXCEPTION 'snapshot #535'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons WHERE lesson_stage IS NULL OR learning_objective IS NULL) THEN RAISE EXCEPTION 'etapas ausentes'; END IF;
 IF (SELECT count(*) FROM public.course_lessons WHERE is_core)<>247 OR (SELECT count(*) FROM public.course_lessons WHERE lesson_role='extra')<>129 OR (SELECT count(*) FROM public.course_lessons WHERE lesson_role='optional')<>73 THEN RAISE EXCEPTION 'categorias #535'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) p(id) LEFT JOIN public.course_lessons prior ON prior.id=p.id WHERE prior.id IS NULL OR NOT prior.is_core OR prior.curriculum_order>=l.curriculum_order) THEN RAISE EXCEPTION 'dependências #535'; END IF;
 IF (SELECT count(*) FROM public.course_lessons WHERE lesson_stage='consolidation')<>32 THEN RAISE EXCEPTION 'fechamentos #535'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons cap JOIN public.course_lessons l ON l.level=cap.level AND l.module_title=cap.module_title AND l.is_core AND l.id<>cap.id WHERE cap.lesson_stage='consolidation' AND NOT l.id=ANY(cap.prerequisite_lesson_ids)) THEN RAISE EXCEPTION 'fechamento omite base'; END IF;
 IF has_function_privilege('anon','public.rpc_course_path()','EXECUTE') OR has_function_privilege('anon','public.rpc_course_catalog()','EXECUTE') THEN RAISE EXCEPTION 'anon #535'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; cat jsonb; BEGIN
 p:=public.rpc_course_path();
 IF p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-01' OR p->'next'->>'title' IS NULL THEN RAISE EXCEPTION 'primeira recomendação #535'; END IF;
 cat:=public.rpc_course_catalog();
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cat) c CROSS JOIN LATERAL jsonb_array_elements(c->'lessons') l WHERE l->>'id'='lesson-sequence-a1-m1' AND l->>'lesson_stage'='consolidation' AND l->>'learning_objective' IS NOT NULL) THEN RAISE EXCEPTION 'catálogo #535'; END IF;
END $$;
-- Commit verdadeiro com todas as unidades da aula, depois leitura da trilha.
SELECT public.rpc_course_commit_practice(gen_random_uuid(),'lesson','lesson-first-sentences-a1-01','easy',now()-interval '2 minutes',90,100,1,
(SELECT jsonb_agg(jsonb_build_object('unit_id',id,'attempts',1,'hint_count',0,'revealed',false)) FROM public.course_units WHERE lesson_id='lesson-first-sentences-a1-01'),true);
DO $$ DECLARE p jsonb; BEGIN
 p:=public.rpc_course_path();
 IF p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-02' THEN RAISE EXCEPTION 'path não reflete commit: %',p; END IF;
END $$;
RESET ROLE;
DELETE FROM public.user_course_enrollment WHERE user_id=auth.uid();
-- Toda a base antiga pronta ainda precisa consolidar o primeiro bloco.
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND is_core AND id NOT LIKE 'lesson-sequence-%' GROUP BY course_id;
DO $$ DECLARE p jsonb; BEGIN
 p:=public.rpc_course_path();
 IF p->'next'->>'lesson_id'<>'lesson-sequence-a1-m1' THEN RAISE EXCEPTION 'consolidação omitida: %',p; END IF;
END $$;
DELETE FROM public.user_course_enrollment WHERE user_id=auth.uid();
DO $$ DECLARE lev text; p jsonb; total int; BEGIN
 FOREACH lev IN ARRAY ARRAY['A1','A2','B1','B2','C1'] LOOP
 INSERT INTO public.settings(user_id,key,value) VALUES(auth.uid(),'lf_cefr_level',to_jsonb(lev)::text) ON CONFLICT(user_id,key) DO UPDATE SET value=EXCLUDED.value;
 p:=public.rpc_course_path();total:=CASE lev WHEN 'A1' THEN 48 WHEN 'A2' THEN 79 WHEN 'B1' THEN 53 WHEN 'B2' THEN 53 ELSE 14 END;
 IF p->'next'->>'level' IS DISTINCT FROM lev OR (p->>'blocked')::boolean OR (SELECT (value->>'total')::int FROM jsonb_array_elements(p->'levels') WHERE value->>'level'=lev)<>total THEN RAISE EXCEPTION 'placement %: %',lev,p; END IF;
 END LOOP;
 DELETE FROM public.settings WHERE user_id=auth.uid() AND key='lf_cefr_level';
END $$;
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND is_core GROUP BY course_id;
DO $$ DECLARE p jsonb; BEGIN
 p:=public.rpc_course_path();IF p->'next'->>'level'<>'A2' THEN RAISE EXCEPTION 'extra bloqueia nível: %',p; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000536',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; BEGIN
 p:=public.rpc_course_path();IF p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'vazamento de progresso'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo course-sequence-535: OK
