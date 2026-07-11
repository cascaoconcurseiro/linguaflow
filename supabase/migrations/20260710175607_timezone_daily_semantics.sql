-- Dia de estudo por usuário, não pelo UTC do banco.
-- O cliente sincroniza um identificador IANA (ex.: America/Sao_Paulo) após login.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

CREATE OR REPLACE FUNCTION public.set_user_timezone(p_timezone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone
  ) THEN
    RAISE EXCEPTION 'invalid timezone';
  END IF;

  PERFORM public.ensure_user_stats(v_user_id);
  UPDATE public.user_stats
     SET timezone = p_timezone,
         updated_at = now()
   WHERE user_id = v_user_id;
  RETURN p_timezone;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_learning_xp(_user_id uuid, _xp integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _last_date date; _today date; _diff_days int; _streak int;
  _xp_today int; _xp_week int; _xp_total int; _freezes int;
  _timezone text; _first_of_day boolean := false;
BEGIN
  IF _xp IS NULL OR _xp <= 0 THEN RETURN '{}'::jsonb; END IF;

  PERFORM public.ensure_user_stats(_user_id);
  SELECT last_study_date, streak, xp_today, xp_week, xp_total, streak_freezes, timezone
    INTO _last_date, _streak, _xp_today, _xp_week, _xp_total, _freezes, _timezone
    FROM public.user_stats WHERE user_id = _user_id FOR UPDATE;

  _today := (now() AT TIME ZONE coalesce(_timezone, 'UTC'))::date;
  _diff_days := (_today - _last_date);

  IF _diff_days = 0 THEN
    IF _streak = 0 THEN _streak := 1; _first_of_day := true; END IF;
    IF _xp_today = 0 THEN _first_of_day := true; END IF;
    _xp_today := _xp_today + _xp;
    _xp_week := _xp_week + _xp;
  ELSIF _diff_days = 1 THEN
    _streak := _streak + 1; _first_of_day := true;
    _xp_today := _xp;
    IF date_trunc('week', _today) > date_trunc('week', _last_date)
      THEN _xp_week := _xp; ELSE _xp_week := _xp_week + _xp; END IF;
  ELSIF _diff_days = 2 AND _freezes > 0 THEN
    _freezes := _freezes - 1; _streak := _streak + 1; _first_of_day := true;
    _xp_today := _xp;
    IF date_trunc('week', _today) > date_trunc('week', _last_date)
      THEN _xp_week := _xp; ELSE _xp_week := _xp_week + _xp; END IF;
  ELSE
    _streak := 1; _first_of_day := true;
    _xp_today := _xp;
    IF date_trunc('week', _today) > date_trunc('week', _last_date)
      THEN _xp_week := _xp; ELSE _xp_week := _xp_week + _xp; END IF;
  END IF;

  IF _first_of_day THEN
    _xp_today := _xp_today + 15; _xp_week := _xp_week + 15; _xp := _xp + 15;
  END IF;
  IF _streak > 0 AND _streak % 7 = 0 AND _diff_days >= 1 THEN
    _freezes := least(_freezes + 1, 2);
  END IF;
  _xp_total := _xp_total + _xp;

  UPDATE public.user_stats SET
    xp_today = _xp_today, xp_week = _xp_week, xp_total = _xp_total,
    streak = _streak, streak_freezes = _freezes, last_study_date = _today, updated_at = now(),
    counters_date = CASE WHEN counters_date <> _today THEN _today ELSE counters_date END,
    daily_counters = CASE WHEN counters_date <> _today THEN '{}'::jsonb ELSE daily_counters END
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('xp_awarded', _xp, 'xp_today', _xp_today,
    'streak', _streak, 'first_of_day', _first_of_day);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_learning_event(p_type text, p_amount integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _counters jsonb; _cdate date; _today date; _timezone text;
  _used int; _xp int := 0; _cap int; _result jsonb;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  p_amount := greatest(1, least(coalesce(p_amount, 1), 50));
  PERFORM public.ensure_user_stats(_user_id);
  SELECT daily_counters, counters_date, timezone INTO _counters, _cdate, _timezone
    FROM public.user_stats WHERE user_id = _user_id FOR UPDATE;
  _today := (now() AT TIME ZONE coalesce(_timezone, 'UTC'))::date;
  IF _cdate <> _today THEN _counters := '{}'::jsonb; END IF;
  _used := coalesce((_counters ->> p_type)::int, 0);

  IF p_type = 'game_match' THEN _cap := 40; _xp := least(p_amount, 10) * 2;
  ELSIF p_type = 'story_read' THEN _cap := 60; _xp := 20;
  ELSIF p_type = 'story_quiz' THEN _cap := 30; _xp := least(p_amount, 3) * 5;
  ELSIF p_type = 'quests_complete' THEN _cap := 30; _xp := 30;
  ELSIF p_type = 'video_session' THEN _cap := 30; _xp := least(p_amount, 6) * 5;
  ELSE RAISE EXCEPTION 'unknown event type: %', p_type;
  END IF;

  _xp := least(_xp, greatest(0, _cap - _used));
  IF _xp <= 0 THEN RETURN jsonb_build_object('xp_awarded', 0, 'capped', true); END IF;
  _counters := jsonb_set(_counters, array[p_type], to_jsonb(_used + _xp));
  UPDATE public.user_stats SET daily_counters = _counters, counters_date = _today
    WHERE user_id = _user_id;
  _result := public.apply_learning_xp(_user_id, _xp);
  RETURN _result || jsonb_build_object('capped', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_timezone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_timezone(text) TO authenticated;
