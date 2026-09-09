-- Fecha duas janelas de concorrência: colisões idempotentes divergentes nos
-- sinais adaptativos e envios concorrentes de lembretes externos.

alter table public.push_subscriptions
  add column if not exists notification_claim_token uuid,
  add column if not exists notification_claimed_at timestamptz,
  add column if not exists notification_delivery_key uuid;

alter table public.user_stats
  add column if not exists email_claim_token uuid,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists email_delivery_key uuid;

create or replace function public.claim_push_subscription(
  p_subscription_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_key uuid;
begin
  if p_subscription_id is null or p_claim_token is null then
    raise exception 'invalid notification claim' using errcode = '22023';
  end if;

  update public.push_subscriptions
     set notification_claim_token = p_claim_token,
         notification_claimed_at = clock_timestamp(),
         notification_delivery_key = coalesce(notification_delivery_key, gen_random_uuid())
   where id = p_subscription_id
     and (last_notified_at is null or last_notified_at < clock_timestamp() - interval '20 hours')
     and (notification_claimed_at is null or notification_claimed_at < clock_timestamp() - interval '15 minutes')
  returning notification_delivery_key into v_delivery_key;

  return jsonb_build_object(
    'claimed', found,
    'delivery_key', v_delivery_key
  );
end;
$$;

create or replace function public.finish_push_subscription_claim(
  p_subscription_id uuid,
  p_claim_token uuid,
  p_delivered boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_subscription_id is null or p_claim_token is null or p_delivered is null then
    raise exception 'invalid notification completion' using errcode = '22023';
  end if;

  update public.push_subscriptions
     set last_notified_at = case when p_delivered then clock_timestamp() else last_notified_at end,
         notification_claim_token = null,
         notification_claimed_at = null,
         notification_delivery_key = case when p_delivered then null else notification_delivery_key end
   where id = p_subscription_id
     and notification_claim_token = p_claim_token;
  return found;
end;
$$;

create or replace function public.claim_email_candidate(
  p_user_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_key uuid;
begin
  if p_user_id is null or p_claim_token is null then
    raise exception 'invalid email claim' using errcode = '22023';
  end if;

  update public.user_stats
     set email_claim_token = p_claim_token,
         email_claimed_at = clock_timestamp(),
         email_delivery_key = coalesce(email_delivery_key, gen_random_uuid())
   where user_id = p_user_id
     and email_opt_in = true
     and (email_last_sent_at is null or email_last_sent_at < clock_timestamp() - interval '7 days')
     and (email_claimed_at is null or email_claimed_at < clock_timestamp() - interval '15 minutes')
  returning email_delivery_key into v_delivery_key;

  return jsonb_build_object(
    'claimed', found,
    'delivery_key', v_delivery_key
  );
end;
$$;

create or replace function public.finish_email_candidate_claim(
  p_user_id uuid,
  p_claim_token uuid,
  p_delivered boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_claim_token is null or p_delivered is null then
    raise exception 'invalid email completion' using errcode = '22023';
  end if;

  update public.user_stats
     set email_last_sent_at = case when p_delivered then clock_timestamp() else email_last_sent_at end,
         email_claim_token = null,
         email_claimed_at = null,
         email_delivery_key = case when p_delivered then null else email_delivery_key end
   where user_id = p_user_id
     and email_claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.claim_push_subscription(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finish_push_subscription_claim(uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.claim_email_candidate(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finish_email_candidate_claim(uuid, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.claim_push_subscription(uuid, uuid) to service_role;
grant execute on function public.finish_push_subscription_claim(uuid, uuid, boolean) to service_role;
grant execute on function public.claim_email_candidate(uuid, uuid) to service_role;
grant execute on function public.finish_email_candidate_claim(uuid, uuid, boolean) to service_role;

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
  v_existing public.card_learning_signals%rowtype;
  v_profile public.card_adaptive_profiles%rowtype;
  v_stage smallint;
  v_streak smallint;
begin
  if v_user is null or p_client_event_id is null or not exists (
    select 1 from public.cards c where c.id = p_card_id and c.user_id = v_user
  ) then
    raise exception 'card_not_owned' using errcode = '42501';
  end if;

  if v_mode not in ('classic','builder','dictation','reverse') then v_mode := 'classic'; end if;
  v_unaided := v_correct and not v_abandoned and v_help = 0 and v_audio <= 1 and v_response <= 18000;
  v_issue := case
    when v_abandoned then 'avoidance'
    when not v_correct and v_mode = 'dictation' then 'listening'
    when not v_correct then 'recall'
    when v_help > 0 then 'dependency'
    when v_response > 18000 then 'fluency'
    else 'none'
  end;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_card_id::text, 0));
  insert into public.card_learning_signals
    (client_event_id,user_id,card_id,correct,abandoned,response_ms,help_count,audio_plays,mode,issue,unaided)
  values
    (p_client_event_id,v_user,p_card_id,v_correct,v_abandoned,v_response,v_help,v_audio,v_mode,v_issue,v_unaided)
  on conflict (user_id,client_event_id) do nothing;

  if not found then
    select * into strict v_existing
      from public.card_learning_signals
     where user_id = v_user and client_event_id = p_client_event_id;
    if v_existing.card_id is distinct from p_card_id
      or v_existing.correct is distinct from v_correct
      or v_existing.abandoned is distinct from v_abandoned
      or v_existing.response_ms is distinct from v_response
      or v_existing.help_count is distinct from v_help
      or v_existing.audio_plays is distinct from v_audio
      or v_existing.mode is distinct from v_mode
      or v_existing.issue is distinct from v_issue
      or v_existing.unaided is distinct from v_unaided
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    select * into v_profile from public.card_adaptive_profiles
     where user_id = v_user and card_id = p_card_id;
    return to_jsonb(v_profile);
  end if;

  select * into v_profile from public.card_adaptive_profiles
   where user_id = v_user and card_id = p_card_id for update;
  v_stage := coalesce(v_profile.recovery_stage, 0);
  v_streak := case when v_unaided then coalesce(v_profile.unaided_success_streak, 0) + 1 else 0 end;
  if v_abandoned or not v_correct or v_help > 0 or v_response > 18000 then
    v_stage := least(3, greatest(1, v_stage + case when v_abandoned or not v_correct then 1 else 0 end));
  elsif v_streak >= 2 then v_stage := greatest(0, v_stage - 1);
  end if;

  insert into public.card_adaptive_profiles
    (user_id,card_id,recovery_stage,dominant_issue,unaided_success_streak,signal_count)
  values (v_user,p_card_id,v_stage,
    case when v_stage = 0 then 'none' else coalesce(nullif(v_issue,'none'),v_profile.dominant_issue,'recall') end,
    case when v_stage = 0 then 0 else v_streak end,1)
  on conflict (user_id,card_id) do update set
    recovery_stage=excluded.recovery_stage,
    dominant_issue=coalesce(excluded.dominant_issue,public.card_adaptive_profiles.dominant_issue),
    unaided_success_streak=excluded.unaided_success_streak,
    signal_count=public.card_adaptive_profiles.signal_count+1,
    updated_at=now()
  returning * into v_profile;
  return to_jsonb(v_profile);
end;
$$;

revoke all on function public.record_card_learning_signal(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_card_learning_signal(uuid, uuid, jsonb) to authenticated;
