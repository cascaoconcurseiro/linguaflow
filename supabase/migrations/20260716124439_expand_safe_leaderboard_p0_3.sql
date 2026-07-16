-- P0.3 expand — adiciona a projeção segura antes de trocar o cliente.
-- É deliberadamente compatível com o dashboard 3.0.10: nenhuma policy ou
-- permissão existente é removida nesta etapa.

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_league_index integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  username text,
  avatar_url text,
  xp_week integer,
  league_index integer,
  is_current_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league_index integer := greatest(0, least(coalesce(p_league_index, 0), 5));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT
    stats.username,
    stats.avatar_url,
    coalesce(stats.xp_week, 0),
    stats.league_index,
    stats.user_id = v_user_id
  FROM public.user_stats AS stats
  WHERE stats.league_index = v_league_index
  ORDER BY coalesce(stats.xp_week, 0) DESC,
           lower(coalesce(stats.username, '')),
           stats.user_id
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_leaderboard(integer, integer) IS
  'P0.3: leaderboard autenticado com projeção pública mínima; omite identificadores e estado privado.';
