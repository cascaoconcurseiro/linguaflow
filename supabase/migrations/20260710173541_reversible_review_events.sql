-- Codex 2026-07-10: revisão e undo são um único evento contábil.
-- O snapshot permite desfazer somente a última atividade, sem inventar XP.

alter table public.review_log
  add column if not exists xp_awarded integer not null default 0,
  add column if not exists stats_before jsonb;

create or replace function public.calculate_xp_on_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform public.ensure_user_stats(new.user_id);
  select jsonb_build_object(
    'xp_today', xp_today, 'xp_week', xp_week, 'xp_total', xp_total,
    'streak', streak, 'streak_freezes', streak_freezes,
    'last_study_date', last_study_date,
    'daily_counters', daily_counters, 'counters_date', counters_date
  ) into new.stats_before
  from public.user_stats where user_id = new.user_id for update;

  if new.quality >= 2 then
    v_result := public.apply_learning_xp(new.user_id,
      case new.quality when 2 then 8 when 3 then 10 else 12 end);
    new.xp_awarded := coalesce((v_result ->> 'xp_awarded')::integer, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_calculate_xp on public.review_log;
create trigger trigger_calculate_xp
before insert on public.review_log
for each row execute function public.calculate_xp_on_activity();

-- O histórico é append-only para o cliente. A SECURITY DEFINER abaixo é a
-- única remoção permitida, com verificação de ordem e restauração do snapshot.
drop policy if exists "Users see own data" on public.review_log;
create policy "Users read own review history"
  on public.review_log for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.review_log from authenticated;

create or replace function public.revert_card_review(
  p_review_log_id uuid,
  p_previous_card jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_log public.review_log%rowtype;
  v_card public.cards%rowtype;
  v_stats public.user_stats%rowtype;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if p_previous_card is null or jsonb_typeof(p_previous_card) <> 'object' then
    raise exception 'previous card state is required';
  end if;

  select * into v_log from public.review_log
  where id = p_review_log_id and user_id = v_user_id for update;
  if not found then raise exception 'review not found'; end if;
  if v_log.stats_before is null then raise exception 'this older review cannot be undone safely'; end if;
  if exists (select 1 from public.review_log where user_id = v_user_id and ts > v_log.ts) then
    raise exception 'only the most recent review can be undone';
  end if;

  select * into v_stats from public.user_stats where user_id = v_user_id for update;
  if v_stats.updated_at > v_log.ts + interval '2 seconds' then
    raise exception 'newer learning activity prevents a safe undo';
  end if;

  update public.cards
  set status = coalesce(p_previous_card->>'status', status),
      interval = coalesce((p_previous_card->>'interval')::double precision, interval),
      ease_factor = coalesce((p_previous_card->>'ease_factor')::double precision, ease_factor),
      step_index = coalesce((p_previous_card->>'step_index')::integer, step_index),
      reps = coalesce((p_previous_card->>'reps')::integer, reps),
      lapses = coalesce((p_previous_card->>'lapses')::integer, lapses),
      difficulty = coalesce((p_previous_card->>'difficulty')::double precision, difficulty),
      stability = coalesce((p_previous_card->>'stability')::double precision, stability),
      pre_lapse_interval = coalesce((p_previous_card->>'pre_lapse_interval')::double precision, pre_lapse_interval),
      due_date = coalesce((p_previous_card->>'due_date')::timestamptz, due_date),
      last_review = (p_previous_card->>'last_review')::timestamptz,
      introduced_at = (p_previous_card->>'introduced_at')::timestamptz,
      suspended = coalesce((p_previous_card->>'suspended')::boolean, suspended),
      is_leech = coalesce((p_previous_card->>'is_leech')::boolean, is_leech)
  where id = v_log.card_id and user_id = v_user_id
  returning * into v_card;
  if not found then raise exception 'card not found'; end if;

  update public.user_stats set
    xp_today = (v_log.stats_before->>'xp_today')::integer,
    xp_week = (v_log.stats_before->>'xp_week')::integer,
    xp_total = (v_log.stats_before->>'xp_total')::integer,
    streak = (v_log.stats_before->>'streak')::integer,
    streak_freezes = (v_log.stats_before->>'streak_freezes')::integer,
    last_study_date = (v_log.stats_before->>'last_study_date')::date,
    daily_counters = coalesce(v_log.stats_before->'daily_counters', '{}'::jsonb),
    counters_date = (v_log.stats_before->>'counters_date')::date,
    updated_at = now()
  where user_id = v_user_id;

  delete from public.review_log where id = v_log.id and user_id = v_user_id;
  return jsonb_build_object('card', to_jsonb(v_card), 'xp_reverted', v_log.xp_awarded);
end;
$$;

revoke all on function public.revert_card_review(uuid, jsonb) from public;
grant execute on function public.revert_card_review(uuid, jsonb) to authenticated;
