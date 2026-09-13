-- Migration: 20260913110000_harden_admin_security.sql
-- Hardening rigoroso de segurança administrativa:
-- 1. Revoga privilégios de execução de PUBLIC e anon em todas as funções administrativas.
-- 2. Implementa controle de tentativas e bloqueio temporário (brute-force defense) em admin_verify_pin.
-- 3. Garante que search_path seja restrito e imutável.

-- ── 1. Revogação Explícita de PUBLIC e anon ────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_assert_authority() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_verify_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_system_metrics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_user_deck(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_all_decks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_client_errors() FROM PUBLIC, anon;

-- Concede estritamente a usuários autenticados (a verificação de autoridade interna valida se está em admin_users)
GRANT EXECUTE ON FUNCTION public.admin_assert_authority() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_deck(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_decks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_client_errors() TO authenticated;

-- ── 2. Tabela de Bloqueio contra Força Bruta de PIN ───────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_pin_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

ALTER TABLE public.admin_pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_pin_attempts FROM PUBLIC, anon, authenticated;

-- ── 3. Hardening de admin_verify_pin com Proteção contra Força Bruta ───────────
CREATE OR REPLACE FUNCTION public.admin_verify_pin(p_pin_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_stored_hash text;
  v_attempts int := 0;
  v_locked_until timestamptz;
BEGIN
  PERFORM public.admin_assert_authority();

  -- Verifica se o administrador está temporariamente bloqueado
  SELECT failed_attempts, locked_until INTO v_attempts, v_locked_until
  FROM public.admin_pin_attempts
  WHERE user_id = auth.uid();

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente mais tarde.'
      USING ERRCODE = '42501';
  END IF;

  SELECT value INTO v_stored_hash FROM public.admin_config WHERE key = 'pin_hash';
  IF v_stored_hash IS NULL THEN
    RETURN true;
  END IF;

  IF p_pin_hash = v_stored_hash THEN
    -- Sucesso: limpa tentativas e desbloqueia
    INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
    VALUES (auth.uid(), 0, NULL)
    ON CONFLICT (user_id) DO UPDATE SET failed_attempts = 0, locked_until = NULL;
    RETURN true;
  ELSE
    -- Falha: incrementa tentativas
    v_attempts := COALESCE(v_attempts, 0) + 1;
    IF v_attempts >= 5 THEN
      INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
      VALUES (auth.uid(), v_attempts, now() + interval '15 minutes')
      ON CONFLICT (user_id) DO UPDATE SET failed_attempts = v_attempts, locked_until = now() + interval '15 minutes';
      RAISE EXCEPTION 'Senha incorreta. Limite de 5 tentativas excedido. Acesso bloqueado por 15 minutos.'
        USING ERRCODE = '42501';
    ELSE
      INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
      VALUES (auth.uid(), v_attempts, NULL)
      ON CONFLICT (user_id) DO UPDATE SET failed_attempts = v_attempts, locked_until = NULL;
      RETURN false;
    END IF;
  END IF;
END;
$$;
