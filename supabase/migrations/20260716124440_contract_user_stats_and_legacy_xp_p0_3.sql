-- P0.3 contract — executar somente depois que o dashboard 3.0.11, que usa
-- rpc/get_leaderboard, estiver em produção.

-- Eventos declarados pelo navegador não são evidência competitiva.
REVOKE ALL ON FUNCTION public.record_learning_event(text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_weekly_quest(integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- A linha completa de user_stats é privada. O próprio usuário continua lendo
-- sua linha; o placar coletivo passa exclusivamente pela projeção mínima.
DROP POLICY IF EXISTS "Anyone can read user_stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users read own user_stats" ON public.user_stats;

CREATE POLICY "Users read own user_stats"
  ON public.user_stats
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_stats TO authenticated;
