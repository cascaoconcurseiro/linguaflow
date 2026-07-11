-- A chave pública VAPID é necessária no navegador para criar uma assinatura
-- Web Push. A privada e a chave do cron permanecem exclusivamente no Vault/
-- Edge Function e nunca são retornadas por esta RPC.
CREATE OR REPLACE FUNCTION public.get_push_public_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_public_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT decrypted_secret
    INTO v_public_key
    FROM vault.decrypted_secrets
   WHERE name = 'lf_vapid_public';

  IF v_public_key IS NULL OR length(v_public_key) = 0 THEN
    RAISE EXCEPTION 'push public key not configured';
  END IF;

  RETURN v_public_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_push_public_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_push_public_key() TO authenticated;
