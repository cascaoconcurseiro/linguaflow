-- Migration: 20261003150000_session_hygiene_and_alert_summary.sql
-- Issue #416 — higiene de sessões e aviso de alertas do administrador.
-- 1) Sessões do Auth que não renovam há 30+ dias são encerradas todo dia (pg_cron) e podem ser
--    encerradas manualmente pelo painel (auditado). O usuário só precisa entrar de novo.
-- 2) admin_alert_summary() alimenta o selo do menu "Administração" sem exigir o PIN.
-- Rollback: SELECT cron.unschedule('prune-stale-sessions'); reverter o PR.

-- ── 1. Encerrar sessões inativas ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prune_stale_sessions(p_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_days int := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365);
  v_n int;
BEGIN
  DELETE FROM auth.sessions
   WHERE COALESCE(refreshed_at, updated_at, created_at) < now() - make_interval(days => v_days);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_stale_sessions(int) FROM PUBLIC, anon, authenticated;

DO $cron$
BEGIN
  -- pg_cron pode não existir fora do Supabase (ex.: validação local/CI): sem agendamento, só o botão manual.
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron indisponível: limpeza diária de sessões não agendada';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-stale-sessions') THEN
    PERFORM cron.unschedule('prune-stale-sessions');
  END IF;
  PERFORM cron.schedule(
    'prune-stale-sessions', '17 4 * * *',
    $job$
    WITH r AS (SELECT public.prune_stale_sessions(30) AS n)
    INSERT INTO public.admin_audit_log (actor_id, actor_email, action, params, result)
    SELECT NULL, 'sistema (pg_cron)', 'prune_sessions_auto', jsonb_build_object('days', 30), jsonb_build_object('sessions', n)
      FROM r WHERE n > 0
    $job$
  );
END
$cron$;

CREATE OR REPLACE FUNCTION public.admin_session_hygiene(p_session_token uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_days int := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);
  RETURN jsonb_build_object(
    'days', v_days,
    'total', (SELECT count(*) FROM auth.sessions),
    'stale', (SELECT count(*) FROM auth.sessions
               WHERE COALESCE(refreshed_at, updated_at, created_at) < now() - make_interval(days => v_days))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_prune_stale_sessions(p_session_token uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);
  v_n := public.prune_stale_sessions(p_days);
  PERFORM public.admin_write_audit('prune_sessions', NULL, jsonb_build_object('days', p_days),
                                   jsonb_build_object('sessions', v_n));
  RETURN jsonb_build_object('ok', true, 'sessions_ended', v_n);
END;
$$;

-- ── 2. Resumo de alertas para o menu (só administradores, sem PIN) ────────────
CREATE OR REPLACE FUNCTION public.admin_alert_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_locked boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('admin', false);
  END IF;

  SELECT COALESCE(bool_or(locked_until IS NOT NULL AND locked_until > now()), false)
    INTO v_locked FROM public.admin_pin_attempts;

  RETURN jsonb_build_object(
    'admin', true,
    'reports_new', (SELECT count(*) FROM public.user_reports WHERE status = 'novo'),
    'pin_locked', v_locked,
    'errors_1h', (SELECT count(*) FROM public.client_errors WHERE created_at > now() - interval '1 hour')
  );
END;
$$;

DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'admin_session_hygiene(uuid, int)',
    'admin_prune_stale_sessions(uuid, int)',
    'admin_alert_summary()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', v_sig);
  END LOOP;
END
$grants$;
