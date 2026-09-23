-- Accept selected audio-track metadata without labeling it user confirmation.
ALTER TABLE public.listening_intervals DROP CONSTRAINT listening_intervals_evidence_check;
ALTER TABLE public.listening_intervals ADD CONSTRAINT listening_intervals_evidence_check CHECK (evidence IN ('user_confirmed', 'audio_track'));

create or replace function public.record_listening_interval(
  p_event_id uuid, p_account_id uuid, p_seconds integer,
  p_started_at timestamptz, p_ended_at timestamptz,
  p_language text, p_date date, p_evidence text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_existing public.listening_intervals%rowtype;
  v_credit integer;
begin
  if v_user is null or p_account_id is distinct from v_user then
    raise exception 'account_mismatch' using errcode = '42501';
  end if;
  if p_event_id is null or p_seconds is null or p_seconds not between 1 and 60
    or p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at
    or p_ended_at > clock_timestamp() + interval '30 seconds'
    or p_started_at < clock_timestamp() - interval '7 days'
    or p_ended_at - p_started_at > interval '2 minutes'
    or p_seconds > floor(extract(epoch from (p_ended_at - p_started_at)))
    or p_language is null or p_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'
    or p_date is null or p_date < (p_started_at at time zone 'UTC')::date - 1
    or p_date > (p_ended_at at time zone 'UTC')::date + 1
    or p_evidence is null or p_evidence not in ('user_confirmed', 'audio_track') then
    raise exception 'invalid_listening_interval' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':listening', 0));
  delete from public.listening_intervals where user_id=v_user and ended_at < clock_timestamp() - interval '8 days';
  select * into v_existing from public.listening_intervals where user_id=v_user and event_id=p_event_id;
  if found then
    if v_existing.started_at is distinct from p_started_at or v_existing.ended_at is distinct from p_ended_at
      or v_existing.seconds is distinct from p_seconds or v_existing.language is distinct from p_language
      or v_existing.local_date is distinct from p_date or v_existing.evidence is distinct from p_evidence then
      raise exception 'listening_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('credited_seconds',v_existing.credited_seconds,'idempotent',true);
  end if;
  -- Concurrent/overlapping windows never receive double credit. Conservative overlap rejection.
  v_credit := p_seconds;
  if exists(select 1 from public.listening_intervals where user_id=v_user and credited_seconds > 0
    and started_at < p_ended_at and ended_at > p_started_at) then v_credit := 0; end if;
  insert into public.listening_intervals(user_id,event_id,started_at,ended_at,seconds,credited_seconds,language,local_date,evidence)
    values(v_user,p_event_id,p_started_at,p_ended_at,p_seconds,v_credit,p_language,p_date,p_evidence);
  if v_credit > 0 then
    insert into public.sessions(user_id,date,seconds,source,language) values(v_user,p_date,v_credit,'video',p_language)
    on conflict(user_id,date,source,language) do update set seconds=public.sessions.seconds+excluded.seconds;
  end if;
  return jsonb_build_object('credited_seconds',v_credit,'idempotent',false);
end;
$$;
revoke all on function public.record_listening_interval(uuid,uuid,integer,timestamptz,timestamptz,text,date,text) from public,anon,service_role;
grant execute on function public.record_listening_interval(uuid,uuid,integer,timestamptz,timestamptz,text,date,text) to authenticated;

