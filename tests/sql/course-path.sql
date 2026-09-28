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
DECLARE p JSONB; a1 JSONB; a1_total INT;
BEGIN
  -- Sem progresso nem nivelamento: começa no A1, pela trilha Fundamentos
  p := public.rpc_course_path();
  IF p->>'current_level' <> 'A1' THEN RAISE EXCEPTION 'nível inicial: %', p; END IF;
  IF p->'next'->>'lesson_id' <> 'lesson-first-sentences-a1-01' THEN RAISE EXCEPTION 'primeira aula: %', p->'next'; END IF;
  IF jsonb_array_length(p->'levels') <> 4 THEN RAISE EXCEPTION 'níveis: %', p->'levels'; END IF;
  SELECT l INTO a1 FROM jsonb_array_elements(p->'levels') l WHERE l->>'level' = 'A1';
  a1_total := (a1->>'total')::INT;
  IF a1_total <> 7 THEN RAISE EXCEPTION 'A1 deveria ter 7 capítulos centrais: %', a1; END IF;

END $$;
RESET ROLE;
-- Conclui 6 dos 7 capítulos do A1 (86% ≥ 80%). A matrícula só é gravável pela
-- RPC; aqui o teste escreve direto como postgres para montar o cenário.
INSERT INTO public.user_course_enrollment (user_id, course_id, completed_lessons) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'course-first-sentences-a1', ARRAY['lesson-first-sentences-a1-01']),
  ('00000000-0000-4000-8000-0000000000e1', 'course-1000-words-a1', ARRAY['lesson-1000-words-a1-01']),
  ('00000000-0000-4000-8000-0000000000e1', 'course-essential-verbs-a1', ARRAY['lesson-essential-verbs-a1-01']),
  ('00000000-0000-4000-8000-0000000000e1', 'course-street-a1', ARRAY['lesson-street-a1-01', 'lesson-street-a1-02', 'lesson-street-a1-03'])
ON CONFLICT (user_id, course_id) DO UPDATE SET completed_lessons = EXCLUDED.completed_lessons;
INSERT INTO public.settings (user_id, key, value) VALUES ('00000000-0000-4000-8000-0000000000e2', 'lf_cefr_level', '"B1"');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
DO $$
DECLARE p JSONB; a1 JSONB;
BEGIN
  p := public.rpc_course_path();
  SELECT l INTO a1 FROM jsonb_array_elements(p->'levels') l WHERE l->>'level' = 'A1';
  IF NOT (a1->>'is_completed')::BOOLEAN THEN RAISE EXCEPTION 'A1 com 6/7 deveria estar concluído: %', a1; END IF;
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
