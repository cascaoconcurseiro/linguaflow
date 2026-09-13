-- 20260913123000_optimize_rls_initplan.sql
-- Substitui auth.uid() por (SELECT auth.uid()) nas políticas RLS para evitar reavaliação por linha (Auth RLS InitPlan)

-- 1. admin_users
DROP POLICY IF EXISTS "Users check own admin status" ON public.admin_users;
CREATE POLICY "Users check own admin status" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 2. media_watch_sessions
DROP POLICY IF EXISTS "media_watch_sessions_manage_own" ON public.media_watch_sessions;
CREATE POLICY "media_watch_sessions_manage_own" ON public.media_watch_sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3. user_achievements
DROP POLICY IF EXISTS "user_achievements_manage_own" ON public.user_achievements;
CREATE POLICY "user_achievements_manage_own" ON public.user_achievements
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
