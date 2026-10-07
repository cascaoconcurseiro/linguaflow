-- #533: Postgres descartável; conteúdo, isolamento e progressão sem exigir extras.
BEGIN;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.settings,public.course_catalog,public.course_lessons,public.course_units,public.user_course_enrollment TO authenticated;
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000000533','pedagogy@test.local'),
 ('00000000-0000-4000-8000-000000000534','other-pedagogy@test.local');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000533',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000533","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons)<>414 OR (SELECT count(*) FROM public.course_units)<>4424 THEN RAISE EXCEPTION 'snapshot incorreto'; END IF;
 IF (SELECT count(*) FROM public.course_lessons WHERE lesson_role='base')<>212
 OR (SELECT count(*) FROM public.course_lessons WHERE lesson_role='extra')<>129
 OR (SELECT count(*) FROM public.course_lessons WHERE lesson_role='optional')<>73 THEN RAISE EXCEPTION 'categorias incorretas'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons WHERE module_title IS NULL OR module_order IS NULL OR is_core<>(lesson_role='base')) THEN RAISE EXCEPTION 'organização incompleta'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) p(id)
 JOIN public.course_lessons prior ON prior.id=p.id WHERE NOT prior.is_core OR prior.curriculum_order>=l.curriculum_order) THEN RAISE EXCEPTION 'extra bloqueia base'; END IF;
 IF (SELECT md5(string_agg(concat_ws(chr(31),id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units WHERE id NOT LIKE 'unit-pedagogy-%')<>'d0002890d367706d6d43090022638f99' THEN RAISE EXCEPTION 'conteúdo antigo alterado'; END IF;
END $$;
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
VALUES('00000000-0000-4000-8000-000000000534','course-first-sentences-a1',ARRAY['lesson-first-sentences-a1-01']);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; cat jsonb; l jsonb; BEGIN
 p:=public.rpc_course_path();
 IF p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'vazou outra conta'; END IF;
 IF jsonb_array_length(p->'modules')<20 THEN RAISE EXCEPTION 'módulos ausentes'; END IF;
 cat:=public.rpc_course_catalog();
 SELECT lesson INTO l FROM jsonb_array_elements(cat) c CROSS JOIN LATERAL jsonb_array_elements(c->'lessons') lesson WHERE lesson->>'id'='lesson-pedagogy-a1-articles';
 IF l->>'lesson_role'<>'base' OR l->>'module_title' IS NULL OR (l->>'unit_count')::int<>8 THEN RAISE EXCEPTION 'catálogo não entrega nova aula: %',l; END IF;
END $$;
RESET ROLE;
-- Todas as aulas históricas A1 completas ainda deixam os fundamentos novos pendentes.
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND id NOT LIKE 'lesson-pedagogy-%' GROUP BY course_id;
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; BEGIN
 p:=public.rpc_course_path();
 IF p->>'current_level'<>'A1' OR p->'next'->>'lesson_id'<>'lesson-pedagogy-a1-clarify' THEN RAISE EXCEPTION 'novas aulas omitidas: %',p; END IF;
END $$;
RESET ROLE;
DELETE FROM public.user_course_enrollment WHERE user_id=auth.uid();
-- Completar somente a base do A1 permite iniciar A2, mesmo sem extras/opcionais.
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),course_id,array_agg(id) FROM public.course_lessons WHERE level='A1' AND is_core GROUP BY course_id;
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; a1 jsonb; BEGIN
 p:=public.rpc_course_path();
 SELECT value INTO a1 FROM jsonb_array_elements(p->'levels') WHERE value->>'level'='A1';
 IF (a1->>'total')::int<>39 OR NOT (a1->>'is_completed')::boolean OR p->>'current_level'<>'A2' THEN RAISE EXCEPTION 'extras bloqueiam avanço: %',p; END IF;
END $$;
RESET ROLE;
-- Novas aulas sem organização editorial não entram automaticamente na trilha.
INSERT INTO public.course_lessons(id,course_id,chapter_number,title) VALUES('lesson-unreviewed-533','course-first-sentences-a1',99,'Não auditada');
DO $$ BEGIN
 IF (SELECT lesson_role FROM public.course_lessons WHERE id='lesson-unreviewed-533')<>'extra'
 OR (SELECT is_core FROM public.course_lessons WHERE id='lesson-unreviewed-533') THEN RAISE EXCEPTION 'default obriga aula não auditada'; END IF;
END $$;
ROLLBACK;
\echo course-pedagogy-533: OK
