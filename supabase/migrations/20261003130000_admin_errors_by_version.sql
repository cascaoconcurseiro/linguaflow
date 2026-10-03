-- Migration: 20261003130000_admin_errors_by_version.sql
-- Issue #408 — agrupa erros do cliente também por versão do app, para separar o que já foi
-- corrigido em versões novas do que ainda acontece. Só substitui a função de leitura.
-- Rollback: reaplicar a definição anterior de admin_list_errors (sem app_version).

DROP FUNCTION IF EXISTS public.admin_list_errors(uuid, int, uuid);

CREATE FUNCTION public.admin_list_errors(p_session_token uuid, p_limit int DEFAULT 50, p_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN jsonb_build_object(
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('source', g.source, 'error_name', g.error_name,
                                          'app_version', g.app_version,
                                          'count', g.n, 'last_seen', g.last_seen) ORDER BY g.last_seen DESC)
      FROM (SELECT source, error_name, app_version, count(*) AS n, max(created_at) AS last_seen
            FROM public.client_errors
            WHERE created_at >= now() - interval '30 days' AND (p_user IS NULL OR user_id = p_user)
            GROUP BY 1, 2, 3 ORDER BY max(created_at) DESC LIMIT 20) g
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'user_id', r.user_id,
               'email', (SELECT email::text FROM auth.users u WHERE u.id = r.user_id),
               'source', r.source, 'error_name', r.error_name, 'route', r.route,
               'app_version', r.app_version, 'created_at', r.created_at) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.client_errors WHERE (p_user IS NULL OR user_id = p_user)
            ORDER BY created_at DESC LIMIT v_limit) r
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_errors(uuid, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_errors(uuid, int, uuid) TO authenticated;

-- Direitos de escrita de clientes autenticados em admin_users nunca foram necessários:
-- a leitura da própria linha (RLS) basta; escritas só pelas RPCs de equipe.
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public.admin_users FROM authenticated;
