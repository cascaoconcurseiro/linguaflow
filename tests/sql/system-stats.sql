-- Teste comportamental de rpc_system_stats. Só em banco LOCAL descartável.
-- Sucesso = 'system_stats_ok'.

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1@test.local', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2@test.local', '{}', '{}', now(), now());

-- Dados como o próprio sistema gravaria (postgres ignora RLS aqui).
INSERT INTO public.sessions (user_id, date, seconds, source, language) VALUES
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE,     600, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE,     300, 'video', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 1, 900, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 2, 120, 'reader', 'en'),
  -- sequência antiga de 4 dias (recorde) separada por um buraco
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 40, 60, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 41, 60, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 42, 60, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d1', (now() AT TIME ZONE 'UTC')::DATE - 43, 60, 'pwa', 'en'),
  ('00000000-0000-4000-8000-0000000000d2', (now() AT TIME ZONE 'UTC')::DATE, 999, 'pwa', 'en');

INSERT INTO public.words (id, user_id, word, lang, translation, level, added_at) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d1', 'bounce', 'en', 'vazar', 'A2', now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000d1', 'swamped', 'en', 'atolado', 'B1', now() - INTERVAL '60 days');

INSERT INTO public.cards (id, user_id, word_id, status, due_date, suspended, is_leech) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000001', 'review', now() - INTERVAL '1 hour', false, false),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000002', 'learning', now() + INTERVAL '3 days', false, true);

INSERT INTO public.review_log (user_id, card_id, quality, date, ts, previous_status, response_time_ms) VALUES
  ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-000000000001', 3, (now() AT TIME ZONE 'UTC')::DATE, now(), 'review', 2000),
  ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-000000000001', 1, (now() AT TIME ZONE 'UTC')::DATE, now(), 'review', 4000),
  ('00000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-000000000002', 4, (now() AT TIME ZONE 'UTC')::DATE - 1, now(), 'learning', 1000);

INSERT INTO public.listening_intervals (user_id, event_id, started_at, ended_at, seconds, credited_seconds, language, local_date, evidence)
SELECT '00000000-0000-4000-8000-0000000000d1', gen_random_uuid(), now() - make_interval(mins => i + 1), now() - make_interval(mins => i),
  60, 60, 'en', (now() AT TIME ZONE 'UTC')::DATE, 'user_confirmed'
FROM generate_series(0, 3) AS i;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);

DO $$
DECLARE s JSONB;
BEGIN
  s := public.rpc_system_stats(7);
  IF (s->'time'->>'total_seconds')::INT <> 1920 THEN RAISE EXCEPTION 'tempo 7d: %', s->'time'; END IF;
  IF (s->'time'->'by_source'->>'video')::INT <> 300 THEN RAISE EXCEPTION 'por fonte: %', s->'time'->'by_source'; END IF;
  IF (s->'time'->>'active_days')::INT <> 3 THEN RAISE EXCEPTION 'dias ativos: %', s->'time'; END IF;
  IF (s->'streak'->>'current')::INT <> 3 THEN RAISE EXCEPTION 'sequência atual: %', s->'streak'; END IF;
  IF (s->'streak'->>'best')::INT <> 4 THEN RAISE EXCEPTION 'recorde: %', s->'streak'; END IF;
  IF NOT (s->'streak'->>'studied_today')::BOOLEAN THEN RAISE EXCEPTION 'estudou hoje'; END IF;
  IF jsonb_array_length(s->'daily') <> 7 THEN RAISE EXCEPTION 'série diária: %', jsonb_array_length(s->'daily'); END IF;
  IF (s->'vocabulary'->>'total')::INT <> 2 OR (s->'vocabulary'->>'added_in_period')::INT <> 1 THEN RAISE EXCEPTION 'vocabulário: %', s->'vocabulary'; END IF;
  IF (s->'vocabulary'->>'leeches')::INT <> 1 THEN RAISE EXCEPTION 'leeches: %', s->'vocabulary'; END IF;
  IF (s->'reviews'->>'count')::INT <> 3 THEN RAISE EXCEPTION 'revisões: %', s->'reviews'; END IF;
  IF (s->'reviews'->>'success_rate')::NUMERIC <> 66.7 THEN RAISE EXCEPTION 'acerto: %', s->'reviews'; END IF;
  IF (s->'reviews'->>'retention_mature')::NUMERIC <> 50 THEN RAISE EXCEPTION 'retenção madura: %', s->'reviews'; END IF;
  IF (s->'reviews'->>'due_now')::INT <> 1 THEN RAISE EXCEPTION 'vencidas agora: %', s->'reviews'; END IF;
  IF jsonb_array_length(s->'reviews'->'forecast') <> 14 THEN RAISE EXCEPTION 'previsão'; END IF;
  IF (s->'listening'->>'verified_seconds')::INT <> 240 THEN RAISE EXCEPTION 'escuta: %', s->'listening'; END IF;

  s := public.rpc_system_stats(0); -- todo o período
  IF (s->'time'->>'total_seconds')::INT <> 2160 THEN RAISE EXCEPTION 'tempo total: %', s->'time'; END IF;
  IF s->'time'->'previous_seconds' <> 'null'::jsonb THEN RAISE EXCEPTION 'sem período anterior em "tudo"'; END IF;
END $$;

-- Outra conta não enxerga nada da primeira
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
DO $$
DECLARE s JSONB;
BEGIN
  s := public.rpc_system_stats(30);
  IF (s->'time'->>'total_seconds')::INT <> 999 THEN RAISE EXCEPTION 'isolamento tempo: %', s->'time'; END IF;
  IF (s->'vocabulary'->>'total')::INT <> 0 OR (s->'reviews'->>'count')::INT <> 0 THEN RAISE EXCEPTION 'isolamento dados'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.rpc_system_stats(30);
    RAISE EXCEPTION 'anon executou';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'system_stats_ok' AS result;
ROLLBACK;
