-- Migration: 20261003160000_usage_events.sql
-- Issue #426 — funil de uso sem dados pessoais: abrir player → ligar LF → salvar palavra → revisar.
-- A tabela guarda só (usuário, evento, plataforma, dia): nada de texto, URL ou título de vídeo.
-- A chave primária torna a gravação idempotente e limita o volume (<= 4 eventos x 6 plataformas por dia).
-- Rollback: DROP FUNCTION public.admin_usage_funnel(uuid, int); DROP FUNCTION public.log_usage_event(text, text);
--           DROP TABLE public.usage_events;  (nada depende dela)

CREATE TABLE IF NOT EXISTS public.usage_events (
  user_id  uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event    text        NOT NULL CHECK (event IN ('player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done')),
  platform text        NOT NULL DEFAULT 'none' CHECK (platform IN ('none', 'youtube', 'max', 'netflix', 'disney', 'prime')),
  day      date        NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  first_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event, platform, day)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_event_day ON public.usage_events (event, day);

-- Ninguém lê nem escreve direto: só as RPCs abaixo (SECURITY DEFINER).
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_usage_event(p_event text, p_platform text DEFAULT 'none')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login obrigatório' USING ERRCODE = '28000';
  END IF;
  -- Evento ou plataforma fora da lista fechada violam o CHECK: erro, nunca gravação livre.
  INSERT INTO public.usage_events (user_id, event, platform)
  VALUES (auth.uid(), p_event, COALESCE(NULLIF(p_platform, ''), 'none'))
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.log_usage_event(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_usage_event(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_usage_funnel(p_session_token uuid, p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_days  int  := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
  v_start date := ((now() AT TIME ZONE 'utc')::date) - (LEAST(GREATEST(COALESCE(p_days, 14), 1), 90) - 1);
  v_result jsonb;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  WITH opened AS (
    SELECT DISTINCT user_id FROM public.usage_events WHERE event = 'player_opened' AND day >= v_start
  ), enabled AS (
    SELECT DISTINCT user_id FROM public.usage_events WHERE event = 'lf_enabled' AND day >= v_start
  ), disabled AS (
    SELECT DISTINCT user_id FROM public.usage_events WHERE event = 'lf_disabled' AND day >= v_start
  ), saved AS (
    SELECT DISTINCT e.user_id FROM enabled e
     WHERE EXISTS (SELECT 1 FROM public.words w WHERE w.user_id = e.user_id AND w.added_at >= v_start)
  ), reviewed AS (
    SELECT DISTINCT s.user_id FROM saved s
     WHERE EXISTS (SELECT 1 FROM public.review_log r WHERE r.user_id = s.user_id AND r.ts >= v_start)
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'player_opened', (SELECT count(*) FROM opened),
    'lf_enabled', (SELECT count(*) FROM enabled),
    'lf_disabled', (SELECT count(*) FROM disabled),
    'saved_word', (SELECT count(*) FROM saved),
    'reviewed', (SELECT count(*) FROM reviewed),
    'enabled_by_platform', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('platform', platform, 'users', users) ORDER BY users DESC)
        FROM (
          SELECT platform, count(DISTINCT user_id) AS users
            FROM public.usage_events
           WHERE event = 'lf_enabled' AND day >= v_start AND platform <> 'none'
           GROUP BY platform
        ) p
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_usage_funnel(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_usage_funnel(uuid, int) TO authenticated;
