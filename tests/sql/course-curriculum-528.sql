-- Auditoria #528: comportamento da trilha, níveis individuais e isolamento. Só em Postgres descartável.
BEGIN;
-- O shim mínimo omite USAGE em auth; no Supabase real authenticated já possui USAGE e EXECUTE em auth.uid().
-- Permissão somente nesta transação de teste; não altera a migration nem os grants de produção.
GRANT USAGE ON SCHEMA auth TO authenticated;
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000000528','curriculum@test.local'),
 ('00000000-0000-4000-8000-000000000529','other-curriculum@test.local');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000528',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000528","role":"authenticated"}',true);

DO $$ DECLARE p jsonb; cat jsonb; actual text; expected text; lev text; BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE curriculum_order IS NOT NULL) <> 372 THEN RAISE EXCEPTION 'cobertura de aulas'; END IF;
  IF (SELECT count(*) FROM public.course_units) <> 4088 THEN RAISE EXCEPTION 'conteúdo alterado'; END IF;
  IF EXISTS(SELECT 1 FROM public.course_lessons WHERE level='A1' AND (course_id='course-street-a1' OR course_id='course-essential-verbs-a1')) THEN RAISE EXCEPTION 'gírias/perfect no A1'; END IF;
  IF (SELECT level FROM public.course_lessons WHERE id='lesson-grammar-b2-07') <> 'C1' THEN RAISE EXCEPTION 'inversão não reclassificada'; END IF;
  IF EXISTS(SELECT 1 FROM public.course_lessons l JOIN public.course_catalog c ON c.id=l.course_id WHERE c.id IN('course-spoken-reductions-a2','course-connected-speech-b2') AND (c.is_core OR l.is_core)) THEN RAISE EXCEPTION 'áudio sem aceite na trilha'; END IF;
  IF EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) r(id) LEFT JOIN public.course_lessons previous ON previous.id=r.id WHERE previous.id IS NULL OR previous.curriculum_order >= l.curriculum_order) THEN RAISE EXCEPTION 'dependência inválida'; END IF;

  -- Seleção pelo nível usa a aula, inclusive num curso cujo nível conservador é superior.
  FOREACH lev IN ARRAY ARRAY['A1','A2','B1','B2','C1'] LOOP
    INSERT INTO public.settings(user_id,key,value) VALUES(auth.uid(),'lf_cefr_level',to_jsonb(lev)::text)
      ON CONFLICT(user_id,key) DO UPDATE SET value=EXCLUDED.value;
    p:=public.rpc_course_path(); actual:=p->'next'->>'lesson_id';
    expected:=CASE lev WHEN 'A1' THEN 'lesson-first-sentences-a1-01' WHEN 'A2' THEN 'lesson-tenses-b1-01'
      WHEN 'B1' THEN 'lesson-tenses-b1-03' WHEN 'B2' THEN 'lesson-tenses-b1-09' WHEN 'C1' THEN 'lesson-grammar-b2-06' END;
    IF actual IS DISTINCT FROM expected OR p->'next'->>'level' IS DISTINCT FROM lev THEN RAISE EXCEPTION 'início %: %, esperado %',lev,p,expected; END IF;
    IF jsonb_array_length(p->'levels') <> 5 THEN RAISE EXCEPTION 'níveis'; END IF;
  END LOOP;
  DELETE FROM public.settings WHERE user_id=auth.uid() AND key='lf_cefr_level';
END $$;

-- Outra conta concluiu a primeira aula: isso não muda a recomendação desta conta.
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
VALUES('00000000-0000-4000-8000-000000000529','course-first-sentences-a1',ARRAY['lesson-first-sentences-a1-01']);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; cat jsonb; course jsonb; lesson jsonb; BEGIN
  p:=public.rpc_course_path();
  IF p->'next'->>'lesson_id' <> 'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'progresso de outra conta vazou'; END IF;
  cat:=public.rpc_course_catalog();
  SELECT value INTO course FROM jsonb_array_elements(cat) WHERE value->>'id'='course-first-sentences-a1';
  IF course->>'level_min'<>'A1' OR course->>'level_max'<>'A2' THEN RAISE EXCEPTION 'faixa errada: %',course; END IF;
  SELECT value INTO lesson FROM jsonb_array_elements(course->'lessons') WHERE value->>'id'='lesson-first-sentences-a1-11';
  IF lesson->>'level'<>'A2' THEN RAISE EXCEPTION 'nível da aula no catálogo'; END IF;
END $$;
RESET ROLE;

-- Todos menos uma aula A1: não avança de nível nem perde a aula restante.
INSERT INTO public.user_course_enrollment(user_id,course_id,completed_lessons)
SELECT auth.uid(),c.id,array_agg(l.id) FROM public.course_catalog c JOIN public.course_lessons l ON l.course_id=c.id
 WHERE c.is_published AND c.is_core AND l.is_core AND l.level='A1' AND l.id<>'lesson-first-sentences-a1-02'
 GROUP BY c.id ON CONFLICT(user_id,course_id) DO UPDATE SET completed_lessons=EXCLUDED.completed_lessons;
SET LOCAL ROLE authenticated;
DO $$ DECLARE p jsonb; a1 jsonb; BEGIN
  p:=public.rpc_course_path();
  SELECT value INTO a1 FROM jsonb_array_elements(p->'levels') WHERE value->>'level'='A1';
  IF (a1->>'is_completed')::boolean THEN RAISE EXCEPTION '80%% não conclui todos os pré-requisitos'; END IF;
  IF p->>'current_level'<>'A1' OR p->'next'->>'lesson_id'<>'lesson-first-sentences-a1-02' THEN RAISE EXCEPTION 'saltou aula: %',p; END IF;
END $$;
RESET ROLE;

-- Simula aula nova não auditada: não pode entrar automaticamente na trilha.
INSERT INTO public.course_lessons(id,course_id,chapter_number,title) VALUES('lesson-curriculum-unreviewed','course-first-sentences-a1',99,'Não auditada');
INSERT INTO public.course_units(id,lesson_id,order_index,kind,text,translation_pt) VALUES('unit-curriculum-unreviewed','lesson-curriculum-unreviewed',1,'sentence','Hello.','Olá.');
DO $$ DECLARE p jsonb; a1 jsonb; BEGIN
  p:=public.rpc_course_path();
  SELECT value INTO a1 FROM jsonb_array_elements(p->'levels') WHERE value->>'level'='A1';
  IF (a1->>'total')::int<>(SELECT count(*) FROM public.course_lessons l JOIN public.course_catalog c ON c.id=l.course_id WHERE l.level='A1' AND l.is_core AND c.is_core AND c.is_published) THEN RAISE EXCEPTION 'aula nova entrou sem auditoria'; END IF;
END $$;
ROLLBACK;
\echo course-curriculum-528: OK
