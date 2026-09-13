-- Migration: 20260913100000_admin_authority_rpcs.sql
-- Autoridade Administrativa do LinguaFlow:
-- Funções com SECURITY DEFINER protegidas por tabela privada de papéis (admin_users)
-- sem expor e-mails ou senhas em texto puro no repositório.

-- ── 1. Tabela de Administradores Autorizados ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM public, anon;
GRANT SELECT ON public.admin_users TO authenticated;

DROP POLICY IF EXISTS "Users check own admin status" ON public.admin_users;
CREATE POLICY "Users check own admin status" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Registra o primeiro usuário criado no sistema (proprietário) como admin inicial
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

-- ── 2. Configurações de Segurança do Admin (Hash do PIN) ──────────────────────
CREATE TABLE IF NOT EXISTS public.admin_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_config FROM public, anon, authenticated;

-- Armazena o hash SHA-256 do PIN mestre (o PIN nunca vive em texto puro no código)
INSERT INTO public.admin_config (key, value)
VALUES ('pin_hash', '99f56fb64e3f0eefd31db691f887eea5db220fa78b75845473f411eaa560f17e')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 3. Função Auxiliar de Assertiva de Autoridade ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assert_authority()
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
END;
$$;

-- ── 4. Verificação de PIN no Servidor via Hash ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_verify_pin(p_pin_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  PERFORM public.admin_assert_authority();

  SELECT value INTO v_stored_hash FROM public.admin_config WHERE key = 'pin_hash';
  IF v_stored_hash IS NULL THEN
    RETURN true;
  END IF;

  RETURN p_pin_hash = v_stored_hash;
END;
$$;

-- ── 5. Métricas do Sistema ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_system_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_authority();

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

-- ── 6. Listagem de Usuários ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_users()
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
  PERFORM public.admin_assert_authority();

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

-- ── 7. Limpar Deck de um Usuário Específico (ou do Admin) ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_user_deck(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_words_deleted int;
  v_cards_deleted int;
BEGIN
  PERFORM public.admin_assert_authority();

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

-- ── 8. Limpar Decks de Todos os Usuários ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_all_decks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_words_deleted int;
  v_cards_deleted int;
BEGIN
  PERFORM public.admin_assert_authority();

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

-- ── 9. Excluir Conta de Usuário ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target_email text;
BEGIN
  PERFORM public.admin_assert_authority();

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID de usuário obrigatório.';
  END IF;

  -- Proteção contra auto-exclusão do admin
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação cancelada: o administrador não pode excluir a própria conta.';
  END IF;

  -- Proteção contra exclusão de outros administradores
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Operação cancelada: contas de administradores não podem ser excluídas por esta via.';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- Exclui da tabela auth.users (as FKs ON DELETE CASCADE limpam as tabelas públicas)
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'deleted_email', v_target_email
  );
END;
$$;

-- ── 10. Limpeza de Logs de Erros ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_clear_client_errors()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM public.admin_assert_authority();

  WITH del_e AS (
    DELETE FROM public.client_errors RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM del_e;

  RETURN jsonb_build_object('ok', true, 'errors_cleared', v_count);
END;
$$;

-- ── 11. Concessão de Privilégios de Execução ─────────────────────────────────
GRANT EXECUTE ON FUNCTION public.admin_assert_authority() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_deck(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_decks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_client_errors() TO authenticated;
