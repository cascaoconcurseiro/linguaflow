-- RECUPERADA POR CODEX EM 2026-07-10.
-- A versão 20260710190558 já constava na produção, mas Fable não a colocou no Git.
-- Segredos VAPID e a chave do cron NÃO entram em migration: devem existir no Vault
-- antes do deploy da Edge Function. O cron foi deixado fora desta recuperação e
-- permanece pausado na produção até o envio ser testado ponta a ponta.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz,
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.get_push_secrets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_object_agg(name, decrypted_secret) INTO v
    FROM vault.decrypted_secrets
   WHERE name IN ('lf_vapid_public', 'lf_vapid_private', 'lf_push_cron_key');
  RETURN coalesce(v, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_push_candidates()
RETURNS TABLE(user_id uuid, due_count bigint, streak integer, at_risk boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT us.user_id,
    (SELECT count(*) FROM public.cards c
      WHERE c.user_id = us.user_id AND NOT c.suspended AND c.due_date <= now()) AS due_count,
    us.streak,
    (us.streak > 0 AND us.last_study_date < (now() AT TIME ZONE coalesce(us.timezone, 'UTC'))::date) AS at_risk
  FROM public.user_stats us
  WHERE EXISTS (
    SELECT 1 FROM public.push_subscriptions ps
      WHERE ps.user_id = us.user_id
        AND (ps.last_notified_at IS NULL OR ps.last_notified_at < now() - interval '20 hours')
  );
$$;

-- Defesa explícita: estas RPCs são somente para a Edge Function autenticada
-- com credencial de servidor, nunca para anon/authenticated via PostgREST.
REVOKE EXECUTE ON FUNCTION public.get_push_secrets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_push_candidates() FROM PUBLIC, anon, authenticated;
