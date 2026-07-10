-- Recuperação Codex: Learning Engine aplicado em produção.

alter table public.user_stats
  add column if not exists daily_counters jsonb not null default '{}'::jsonb,
  add column if not exists counters_date date not null default current_date;

create or replace function public.apply_learning_xp(_user_id uuid, _xp integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  last_date date; diff_days integer; streak integer;
  xp_today integer; xp_week integer; xp_total integer; freezes integer;
  first_of_day boolean := false;
begin
  if _xp is null or _xp <= 0 then return '{}'::jsonb; end if;
  perform public.ensure_user_stats(_user_id);
  select last_study_date, streak, xp_today, xp_week, xp_total, streak_freezes
  into last_date, streak, xp_today, xp_week, xp_total, freezes
  from public.user_stats where user_id = _user_id for update;
  diff_days := current_date - last_date;

  if diff_days = 0 then
    if streak = 0 then streak := 1; first_of_day := true; end if;
    if xp_today = 0 then first_of_day := true; end if;
    xp_today := xp_today + _xp; xp_week := xp_week + _xp;
  elsif diff_days = 1 then
    streak := streak + 1; first_of_day := true; xp_today := _xp;
    if date_trunc('week', current_date) > date_trunc('week', last_date) then xp_week := _xp; else xp_week := xp_week + _xp; end if;
  elsif diff_days = 2 and freezes > 0 then
    freezes := freezes - 1; streak := streak + 1; first_of_day := true; xp_today := _xp;
    if date_trunc('week', current_date) > date_trunc('week', last_date) then xp_week := _xp; else xp_week := xp_week + _xp; end if;
  else
    streak := 1; first_of_day := true; xp_today := _xp;
    if date_trunc('week', current_date) > date_trunc('week', last_date) then xp_week := _xp; else xp_week := xp_week + _xp; end if;
  end if;

  if first_of_day then xp_today := xp_today + 15; xp_week := xp_week + 15; _xp := _xp + 15; end if;
  if streak > 0 and streak % 7 = 0 and diff_days >= 1 then freezes := least(freezes + 1, 2); end if;
  xp_total := xp_total + _xp;

  update public.user_stats set
    xp_today = xp_today, xp_week = xp_week, xp_total = xp_total,
    streak = streak, streak_freezes = freezes, last_study_date = current_date,
    updated_at = now(),
    counters_date = case when counters_date <> current_date then current_date else counters_date end,
    daily_counters = case when counters_date <> current_date then '{}'::jsonb else daily_counters end
  where user_id = _user_id;
  return jsonb_build_object('xp_awarded', _xp, 'xp_today', xp_today, 'streak', streak, 'first_of_day', first_of_day);
end;
$$;

create or replace function public.record_learning_event(p_type text, p_amount integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid(); counters jsonb; counter_date date;
  used_amount integer; xp integer := 0; cap integer; result jsonb;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  p_amount := greatest(1, least(coalesce(p_amount, 1), 50));
  perform public.ensure_user_stats(v_user_id);
  select daily_counters, counters_date into counters, counter_date
  from public.user_stats where user_id = v_user_id for update;
  if counter_date <> current_date then counters := '{}'::jsonb; end if;
  used_amount := coalesce((counters ->> p_type)::integer, 0);

  if p_type = 'game_match' then cap := 40; xp := least(p_amount, 10) * 2;
  elsif p_type = 'story_read' then cap := 60; xp := 20;
  elsif p_type = 'story_quiz' then cap := 30; xp := least(p_amount, 3) * 5;
  elsif p_type = 'quests_complete' then cap := 30; xp := 30;
  elsif p_type = 'video_session' then cap := 30; xp := least(p_amount, 6) * 5;
  else raise exception 'unknown event type: %', p_type;
  end if;
  xp := least(xp, greatest(0, cap - used_amount));
  if xp <= 0 then return jsonb_build_object('xp_awarded', 0, 'capped', true); end if;
  counters := jsonb_set(counters, array[p_type], to_jsonb(used_amount + xp));
  update public.user_stats set daily_counters = counters, counters_date = current_date where user_id = v_user_id;
  result := public.apply_learning_xp(v_user_id, xp);
  return result || jsonb_build_object('capped', false);
end;
$$;

revoke all on function public.apply_learning_xp(uuid, integer) from public;
revoke all on function public.record_learning_event(text, integer) from public;
grant execute on function public.record_learning_event(text, integer) to authenticated;
