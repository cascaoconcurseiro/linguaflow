-- Onda 3.4 (Backend): reengajamento por e-mail opcional — resumo semanal +
-- aviso de ofensiva em risco. Espelha exatamente o padrão do Web Push
-- (Vault pros segredos, RPC de candidatos SECURITY DEFINER restrita a
-- service_role, cron chamando a Edge Function via pg_net com x-cron-key).
--
-- Igual ao push-daily-reminder, o cron nasce INATIVO: precisa de um
-- provedor de e-mail transacional configurado (lf_resend_api_key no Vault)
-- antes de disparar de verdade — ação do dono, documentada no HANDOFF.

ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS email_last_sent_at timestamptz;

-- O usuário liga/desliga o próprio opt-in (nunca o de outro user_id).
CREATE OR REPLACE FUNCTION public.set_email_opt_in(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.user_stats SET email_opt_in = coalesce(p_enabled, false) WHERE user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_stats_missing'; END IF;
  RETURN jsonb_build_object('ok', true, 'email_opt_in', coalesce(p_enabled, false));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_email_opt_in(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_email_opt_in(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_email_secrets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_object_agg(name, decrypted_secret) INTO v
    FROM vault.decrypted_secrets
   WHERE name IN ('lf_resend_api_key', 'lf_email_cron_key', 'lf_email_from');
  RETURN coalesce(v, '{}'::jsonb);
END;
$$;

-- Candidatos: opt-in ligado E (ofensiva em risco OU faz 7+ dias do último
-- e-mail) — throttle embutido na própria consulta, sem depender só do cron.
CREATE OR REPLACE FUNCTION public.get_email_candidates()
RETURNS TABLE(
  user_id uuid, email text, streak integer, at_risk boolean,
  xp_week integer, due_count bigint, username text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT us.user_id, u.email, us.streak,
    (us.streak > 0 AND us.last_study_date < (now() AT TIME ZONE coalesce(us.timezone, 'UTC'))::date) AS at_risk,
    coalesce(us.xp_week, 0) AS xp_week,
    (SELECT count(*) FROM public.cards c WHERE c.user_id = us.user_id AND NOT c.suspended AND c.due_date <= now()) AS due_count,
    us.username
  FROM public.user_stats us
  JOIN auth.users u ON u.id = us.user_id
  WHERE us.email_opt_in = true
    AND u.email IS NOT NULL
    AND (us.email_last_sent_at IS NULL OR us.email_last_sent_at < now() - interval '7 days');
$$;

REVOKE EXECUTE ON FUNCTION public.get_email_secrets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_secrets() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_email_candidates() TO service_role;

-- pg_cron pode não existir no banco efêmero de teste (validate-migrations.sh)
-- — degrada graciosamente em vez de quebrar a cadeia de migrations.
-- NASCE INATIVO (active:=false): só liga depois que o dono configurar
-- lf_resend_api_key no Vault e eu confirmar um envio de teste ponta a ponta.
-- IMPORTANTE: usa cron.alter_job (função SECURITY DEFINER do próprio pg_cron)
-- pra desativar, NUNCA "UPDATE cron.job" direto — a role usada pelas
-- migrations não tem permissão na tabela (só nas funções do schema cron),
-- e um erro de permissão ali dentro do bloco faria o EXCEPTION reverter até
-- o cron.schedule() bem-sucedido, deixando o job "sumir" silenciosamente.
DO $$
DECLARE _job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-weekly-reengagement') THEN
    PERFORM cron.unschedule('email-weekly-reengagement');
  END IF;
  _job_id := cron.schedule(
    'email-weekly-reengagement',
    '0 12 * * 1', -- toda segunda-feira 12:00 UTC
    $cron$
      select net.http_post(
        url := 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/email-reengagement',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'lf_email_cron_key')
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
  PERFORM cron.alter_job(job_id := _job_id, active := false);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível neste banco — job email-weekly-reengagement não agendado (ok em ambiente efêmero de teste)';
END $$;
