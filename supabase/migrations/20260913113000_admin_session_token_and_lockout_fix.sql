-- Migration: 20260913113000_admin_session_token_and_lockout_fix.sql
-- Correção crítica de arquitetura de segurança administrativa:
-- 1. Remove rollback inadvertido do bloqueio de força bruta (substitui RAISE EXCEPTION pós-insert por retorno com status).
-- 2. Implementa tokens de sessão administrativa de curta duração (30 min) emitidos pelo servidor após validação do PIN.
-- 3. Exige token de sessão ativa em TODAS as operações sensíveis do servidor, eliminando o bypass direto da API.

-- ── 1. Tabela de Sessões Administrativas Emitidas pelo Servidor ────────────────
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;

-- ── 2. Função de Assertiva de Sessão Administrativa ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assert_session(p_session_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos insuficientes.'
      USING ERRCODE = '42501';
  END IF;

  IF p_session_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_sessions 
    WHERE user_id = auth.uid() 
      AND token = p_session_token 
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Sessão administrativa expirada ou inválida. Revalide o PIN.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assert_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assert_session(uuid) TO authenticated;

-- ── 3. Remoção das Assinaturas Antigas (sem token de sessão) ───────────────────
DROP FUNCTION IF EXISTS public.admin_verify_pin(text);
DROP FUNCTION IF EXISTS public.admin_get_system_metrics();
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.admin_reset_user_deck(uuid);
DROP FUNCTION IF EXISTS public.admin_reset_all_decks();
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
DROP FUNCTION IF EXISTS public.admin_clear_client_errors();

-- ── 4. Verificação de PIN com Emissão de Token e Correção de Rollback ──────────
CREATE OR REPLACE FUNCTION public.admin_verify_pin(p_pin_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_stored_hash text;
  v_attempts int := 0;
  v_locked_until timestamptz;
  v_session_token uuid;
BEGIN
  -- 1. Verifica se usuário é administrador cadastrado
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: privilégios administrativos insuficientes.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Verifica se a conta está atualmente em bloqueio
  SELECT failed_attempts, locked_until INTO v_attempts, v_locked_until
  FROM public.admin_pin_attempts
  WHERE user_id = auth.uid();

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RAISE EXCEPTION 'Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente após %.', v_locked_until
      USING ERRCODE = '42501';
  END IF;

  -- Se o bloqueio temporário anterior já expirou, reseta o contador de tentativas
  IF v_locked_until IS NOT NULL AND v_locked_until <= now() THEN
    v_attempts := 0;
  END IF;

  -- Higiene: purga sessões administrativas expiradas
  DELETE FROM public.admin_sessions WHERE expires_at < now();

  SELECT value INTO v_stored_hash FROM public.admin_config WHERE key = 'pin_hash';

  -- 3. Validação do PIN
  IF v_stored_hash IS NOT NULL AND p_pin_hash = v_stored_hash THEN
    -- Sucesso: limpa tentativas e remove bloqueios
    INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
    VALUES (auth.uid(), 0, NULL)
    ON CONFLICT (user_id) DO UPDATE SET failed_attempts = 0, locked_until = NULL;

    -- Emite token criptográfico de sessão de 30 minutos
    INSERT INTO public.admin_sessions (user_id, expires_at)
    VALUES (auth.uid(), now() + interval '30 minutes')
    RETURNING token INTO v_session_token;

    RETURN jsonb_build_object(
      'ok', true,
      'session_token', v_session_token
    );
  ELSE
    -- Falha: incrementa o contador sem RAISE EXCEPTION para que a transação grave o bloqueio
    v_attempts := COALESCE(v_attempts, 0) + 1;
    IF v_attempts >= 5 THEN
      INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
      VALUES (auth.uid(), v_attempts, now() + interval '15 minutes')
      ON CONFLICT (user_id) DO UPDATE SET failed_attempts = v_attempts, locked_until = now() + interval '15 minutes';
      
      RETURN jsonb_build_object(
        'ok', false,
        'locked', true,
        'attempts', v_attempts,
        'message', 'Limite de 5 tentativas excedido. Acesso bloqueado por 15 minutos.'
      );
    ELSE
      INSERT INTO public.admin_pin_attempts (user_id, failed_attempts, locked_until)
      VALUES (auth.uid(), v_attempts, NULL)
      ON CONFLICT (user_id) DO UPDATE SET failed_attempts = v_attempts, locked_until = NULL;

      RETURN jsonb_build_object(
        'ok', false,
        'locked', false,
        'attempts', v_attempts,
        'remaining_attempts', 5 - v_attempts,
        'message', 'Senha incorreta.'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_pin(text) TO authenticated;

-- ── 5. Funções Administrativas Protegidas por Token de Sessão ───────────────────

CREATE OR REPLACE FUNCTION public.admin_get_system_metrics(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*)::int FROM auth.users),
    'total_words', (SELECT count(*)::int FROM public.words),
    'total_cards', (SELECT count(*)::int FROM public.cards),
    'total_reviews', (SELECT count(*)::int FROM public.review_log),
    'total_stories', (SELECT count(*)::int FROM public.stories),
    'total_errors', (SELECT count(*)::int FROM public.client_errors WHERE created_at >= now() - interval '24 hours')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_session_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  username text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  xp_total integer,
  streak integer,
  last_study_date text,
  total_words bigint,
  total_cards bigint,
  total_reviews bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(s.username, split_part(u.email::text, '@', 1))::text AS username,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(s.xp_total, 0)::integer AS xp_total,
    COALESCE(s.streak, 0)::integer AS streak,
    COALESCE(s.last_study_date::text, '')::text AS last_study_date,
    (SELECT count(*) FROM public.words w WHERE w.user_id = u.id) AS total_words,
    (SELECT count(*) FROM public.cards c WHERE c.user_id = u.id) AS total_cards,
    (SELECT count(*) FROM public.review_log rl WHERE rl.user_id = u.id) AS total_reviews
  FROM auth.users u
  LEFT JOIN public.user_stats s ON s.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_deck(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_words_deleted int;
  v_cards_deleted int;
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID de usuário obrigatório.';
  END IF;

  DELETE FROM public.card_review_undos WHERE user_id = p_target_user_id;
  DELETE FROM public.review_log WHERE user_id = p_target_user_id;
  
  WITH del_c AS (
    DELETE FROM public.cards WHERE user_id = p_target_user_id RETURNING id
  )
  SELECT count(*)::int INTO v_cards_deleted FROM del_c;

  WITH del_w AS (
    DELETE FROM public.words WHERE user_id = p_target_user_id RETURNING id
  )
  SELECT count(*)::int INTO v_words_deleted FROM del_w;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'words_deleted', v_words_deleted,
    'cards_deleted', v_cards_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_all_decks(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_words_deleted int;
  v_cards_deleted int;
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  DELETE FROM public.card_review_undos;
  DELETE FROM public.review_log;
  
  WITH del_c AS (
    DELETE FROM public.cards RETURNING id
  )
  SELECT count(*)::int INTO v_cards_deleted FROM del_c;

  WITH del_w AS (
    DELETE FROM public.words RETURNING id
  )
  SELECT count(*)::int INTO v_words_deleted FROM del_w;

  RETURN jsonb_build_object(
    'ok', true,
    'words_deleted', v_words_deleted,
    'cards_deleted', v_cards_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target_email text;
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID de usuário obrigatório.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação cancelada: o administrador não pode excluir a própria conta.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Operação cancelada: contas de administradores não podem ser excluídas por esta via.';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'deleted_email', v_target_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_client_errors(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  WITH del_e AS (
    DELETE FROM public.client_errors RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM del_e;

  RETURN jsonb_build_object('ok', true, 'errors_cleared', v_count);
END;
$$;

-- ── 6. Revogação de Acesso Público e Concessão a Autenticados ───────────────────
REVOKE ALL ON FUNCTION public.admin_get_system_metrics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_user_deck(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_all_decks(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_client_errors(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_deck(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_decks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_client_errors(uuid) TO authenticated;
