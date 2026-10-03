-- Teste comportamental (Issue #426): RLS, idempotência, lista fechada, anônimo e admin.
-- Rodar SÓ num banco local efêmero (tests/db/validate-migrations.sh aplica as migrations antes).
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'a@test.dev'),
  ('00000000-0000-4000-8000-0000000000b2', 'b@test.dev')
ON CONFLICT DO NOTHING;

-- Usuário A grava: idempotente no mesmo dia.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
SELECT public.log_usage_event('player_opened', 'youtube');
SELECT public.log_usage_event('player_opened', 'youtube');
SELECT public.log_usage_event('lf_enabled', 'youtube');
DO $$ BEGIN
  -- leitura direta é negada para authenticated
  BEGIN PERFORM 1 FROM public.usage_events; RAISE EXCEPTION 'leitura direta permitida'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- evento fora da lista fechada falha
  BEGIN PERFORM public.log_usage_event('texto_livre', 'youtube'); RAISE EXCEPTION 'evento livre aceito'; EXCEPTION WHEN check_violation THEN NULL; END;
  -- plataforma fora da lista fechada falha
  BEGIN PERFORM public.log_usage_event('lf_enabled', 'https://exemplo.com/video?id=1'); RAISE EXCEPTION 'plataforma livre aceita'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- Anônimo não grava.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  BEGIN PERFORM public.log_usage_event('player_opened', 'youtube'); RAISE EXCEPTION 'anônimo gravou'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Verificação como dono do banco.
RESET ROLE;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.usage_events WHERE user_id = '00000000-0000-4000-8000-0000000000a1';
  IF n <> 2 THEN RAISE EXCEPTION 'esperado 2 linhas idempotentes, veio %', n; END IF;
END $$;

-- Funil: usuário não admin não acessa.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
DO $$ BEGIN
  BEGIN PERFORM public.admin_usage_funnel(gen_random_uuid(), 14); RAISE EXCEPTION 'não admin viu o funil'; EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'não admin viu o funil' THEN RAISE; END IF;
  END;
END $$;

-- Funil com dados: troca só a checagem de admin por um stub (a transação é desfeita no ROLLBACK).
RESET ROLE;
CREATE OR REPLACE FUNCTION public.admin_assert_role(p_session_token uuid, p_write boolean DEFAULT false)
RETURNS text LANGUAGE sql AS $$ SELECT 'admin'::text $$;
INSERT INTO public.words (user_id, word) VALUES ('00000000-0000-4000-8000-0000000000a1', 'hello');
INSERT INTO public.review_log (user_id, quality) VALUES ('00000000-0000-4000-8000-0000000000a1', 3);
INSERT INTO public.usage_events (user_id, event, platform) VALUES ('00000000-0000-4000-8000-0000000000b2', 'player_opened', 'netflix');
DO $$
DECLARE f jsonb;
BEGIN
  f := public.admin_usage_funnel(gen_random_uuid(), 14);
  IF (f->>'player_opened')::int <> 2 THEN RAISE EXCEPTION 'player_opened esperado 2: %', f; END IF;
  IF (f->>'lf_enabled')::int <> 1 THEN RAISE EXCEPTION 'lf_enabled esperado 1: %', f; END IF;
  IF (f->>'saved_word')::int <> 1 THEN RAISE EXCEPTION 'saved_word esperado 1: %', f; END IF;
  IF (f->>'reviewed')::int <> 1 THEN RAISE EXCEPTION 'reviewed esperado 1: %', f; END IF;
  IF f->'enabled_by_platform'->0->>'platform' <> 'youtube' THEN RAISE EXCEPTION 'plataforma: %', f; END IF;
END $$;
ROLLBACK;
\echo usage_events: OK
