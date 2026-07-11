-- Missão SEMANAL (Onda 1.5): meta de XP na semana com recompensa maior (+100 XP),
-- reivindicável 1x por semana. Anti-farm no banco: a semana é a do FUSO do
-- usuário, e o claim é gravado em user_stats.weekly_claim_week.

ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS weekly_claim_week date;

CREATE OR REPLACE FUNCTION public.claim_weekly_quest(p_threshold integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _xp_week int; _claimed date; _tz text; _week_start date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  p_threshold := GREATEST(100, LEAST(COALESCE(p_threshold, 500), 5000));

  PERFORM public.ensure_user_stats(_uid);
  SELECT xp_week, weekly_claim_week, timezone
    INTO _xp_week, _claimed, _tz
    FROM public.user_stats WHERE user_id = _uid FOR UPDATE;

  _week_start := date_trunc('week', (now() AT TIME ZONE coalesce(_tz, 'UTC')))::date;

  IF COALESCE(_xp_week, 0) < p_threshold THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'below_threshold', 'xp_week', _xp_week);
  END IF;
  IF _claimed IS NOT NULL AND _claimed >= _week_start THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  -- Marca ANTES de creditar (o apply_learning_xp também mexe em xp_week)
  UPDATE public.user_stats SET weekly_claim_week = _week_start WHERE user_id = _uid;
  PERFORM public.apply_learning_xp(_uid, 100);

  RETURN jsonb_build_object('ok', true, 'xp_awarded', 100);
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_weekly_quest(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_weekly_quest(integer) TO authenticated;
