-- Teste comportamental de rpc_course_path (trilha por nível). Só em banco LOCAL.
-- Sucesso = 'course_path_ok'.

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@test.local', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@test.local', '{}', '{}', now(), now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);

DO $$
DECLARE p JSONB; a1 JSONB; a1_total INT; expected INT;
BEGIN
  -- Sem progresso nem nivelamento: começa no A1, pela trilha Fundamentos
  p := public.rpc_course_path();
  IF p->>'current_level' <> 'A1' THEN RAISE EXCEPTION 'nível inicial: %', p; END IF;
  IF p->'next'->>'lesson_id' <> 'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'primeira aula: %', p->'next'; END IF;
  IF jsonb_array_length(p->'levels') <> 4 THEN RAISE EXCEPTION 'níveis: %', p->'levels'; END IF;
  SELECT l INTO a1 FROM jsonb_array_elements(p->'levels') l WHERE l->>'level' = 'A1';
  a1_total := (a1->>'total')::INT;
  SELECT count(*) INTO expected FROM public.course_catalog c JOIN public.course_lessons l ON l.course_id = c.id
    WHERE c.is_published AND c.is_core AND c.level = 'A1' AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id);
  IF a1_total <> expected OR a1_total < 5 THEN RAISE EXCEPTION 'A1: % capítulos centrais, esperado %', a1, expected; END IF;

END $$;
RESET ROLE;
-- Conclui todos os capítulos centrais do A1 menos um (≥ 80% com 5+ capítulos).
-- A matrícula só é gravável pela RPC; aqui o teste escreve direto como postgres.
INSERT INTO public.user_course_enrollment (user_id, course_id, completed_lessons)
SELECT '00000000-0000-4000-8000-0000000000e1', c.id, array_agg(l.id)
FROM public.course_catalog c JOIN public.course_lessons l ON l.course_id = c.id
WHERE c.is_published AND c.is_core AND c.level = 'A1' AND l.id <> 'lesson-street-a1-04'
  AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
GROUP BY c.id
ON CONFLICT (user_id, course_id) DO UPDATE SET completed_lessons = EXCLUDED.completed_lessons;
INSERT INTO public.settings (user_id, key, value) VALUES ('00000000-0000-4000-8000-0000000000e2', 'lf_cefr_level', '"B1"');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
DO $$
DECLARE p JSONB; a1 JSONB;
BEGIN
  p := public.rpc_course_path();
  SELECT l INTO a1 FROM jsonb_array_elements(p->'levels') l WHERE l->>'level' = 'A1';
  IF NOT (a1->>'is_completed')::BOOLEAN THEN RAISE EXCEPTION 'A1 com todos menos um deveria estar concluído: %', a1; END IF;
  IF p->>'current_level' <> 'A2' THEN RAISE EXCEPTION 'nível atual deveria ser A2: %', p; END IF;
  IF p->'next'->>'lesson_id' <> 'lesson-street-a1-04' THEN RAISE EXCEPTION 'próxima aula (restante do A1 vem primeiro): %', p->'next'; END IF;
END $$;

-- Aluno com nivelamento B1: A1 e A2 pulados, começa no B1
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
DO $$
DECLARE p JSONB;
BEGIN
  p := public.rpc_course_path();
  IF p->>'placement_level' <> 'B1' THEN RAISE EXCEPTION 'nivelamento: %', p; END IF;
  IF p->>'current_level' <> 'B1' THEN RAISE EXCEPTION 'nível atual pelo nivelamento: %', p; END IF;
  IF p->'next'->>'level' <> 'B1' THEN RAISE EXCEPTION 'próxima aula no B1: %', p->'next'; END IF;
  IF NOT ((SELECT l FROM jsonb_array_elements(p->'levels') l WHERE l->>'level' = 'A1')->>'skipped')::BOOLEAN THEN RAISE EXCEPTION 'A1 pulado'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.rpc_course_path();
    RAISE EXCEPTION 'anon executou';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'course_path_ok' AS result;
ROLLBACK;
