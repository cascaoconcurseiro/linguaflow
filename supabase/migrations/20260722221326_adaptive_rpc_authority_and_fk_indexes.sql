-- Adaptive learning writes are RPC-only. This migration is intentionally
-- forward-only: reads remain available to the owner through the existing RLS
-- policies, while mutations pass through record_card_learning_signal.

create index if not exists card_learning_signals_card_id_idx
  on public.card_learning_signals (card_id);

create index if not exists card_adaptive_profiles_card_id_idx
  on public.card_adaptive_profiles (card_id);

revoke all on table public.card_learning_signals, public.card_adaptive_profiles
  from authenticated;
grant select on table public.card_learning_signals, public.card_adaptive_profiles to authenticated;

-- Serialize the complete read/derive/write transition for one user/card. A
-- row lock alone is insufficient while the profile row does not exist yet.
create or replace function public.record_card_learning_signal(
  p_card_id uuid,
  p_client_event_id uuid,
  p_signal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_correct boolean := coalesce((p_signal->>'correct')::boolean, false);
  v_abandoned boolean := coalesce((p_signal->>'abandoned')::boolean, false);
  v_response integer := least(3600000, greatest(0, coalesce((p_signal->>'responseMs')::integer, 0)));
  v_help smallint := least(20, greatest(0, coalesce((p_signal->>'helpCount')::smallint, 0)));
  v_audio smallint := least(20, greatest(0, coalesce((p_signal->>'audioPlays')::smallint, 0)));
  v_mode text := coalesce(p_signal->>'mode', 'classic');
  v_issue text;
  v_unaided boolean;
  v_profile public.card_adaptive_profiles%rowtype;
  v_stage smallint;
  v_streak smallint;
begin
  if v_user is null or not exists (
    select 1 from public.cards c where c.id = p_card_id and c.user_id = v_user
  ) then
    raise exception 'card_not_owned' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || p_card_id::text, 0)
  );

  if v_mode not in ('classic','builder','dictation','reverse') then
    v_mode := 'classic';
  end if;
  v_unaided := v_correct and not v_abandoned and v_help = 0
    and v_audio <= 1 and v_response <= 18000;
  v_issue := case
    when v_abandoned then 'avoidance'
    when not v_correct and v_mode = 'dictation' then 'listening'
    when not v_correct then 'recall'
    when v_help > 0 then 'dependency'
    when v_response > 18000 then 'fluency'
    else 'none'
  end;

  insert into public.card_learning_signals
    (client_event_id,user_id,card_id,correct,abandoned,response_ms,help_count,audio_plays,mode,issue,unaided)
  values
    (p_client_event_id,v_user,p_card_id,v_correct,v_abandoned,v_response,v_help,v_audio,v_mode,v_issue,v_unaided)
  on conflict (user_id,client_event_id) do nothing;

  if not found then
    select * into v_profile
    from public.card_adaptive_profiles
    where user_id = v_user and card_id = p_card_id;
    return to_jsonb(v_profile);
  end if;

  select * into v_profile
  from public.card_adaptive_profiles
  where user_id = v_user and card_id = p_card_id
  for update;

  v_stage := coalesce(v_profile.recovery_stage, 0);
  v_streak := case
    when v_unaided then coalesce(v_profile.unaided_success_streak, 0) + 1
    else 0
  end;
  if v_abandoned or not v_correct or v_help > 0 or v_response > 18000 then
    v_stage := least(3, greatest(1, v_stage + case
      when v_abandoned or not v_correct then 1 else 0
    end));
  elsif v_streak >= 2 then
    v_stage := greatest(0, v_stage - 1);
  end if;

  insert into public.card_adaptive_profiles
    (user_id,card_id,recovery_stage,dominant_issue,unaided_success_streak,signal_count)
  values (
    v_user,
    p_card_id,
    v_stage,
    case
      when v_stage = 0 then 'none'
      else coalesce(nullif(v_issue,'none'),v_profile.dominant_issue,'recall')
    end,
    case when v_stage = 0 then 0 else v_streak end,
    1
  )
  on conflict (user_id,card_id) do update set
    recovery_stage = excluded.recovery_stage,
    dominant_issue = coalesce(excluded.dominant_issue,public.card_adaptive_profiles.dominant_issue),
    unaided_success_streak = excluded.unaided_success_streak,
    signal_count = public.card_adaptive_profiles.signal_count + 1,
    updated_at = now()
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

revoke all on function public.record_card_learning_signal(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_card_learning_signal(uuid, uuid, jsonb) to authenticated;
