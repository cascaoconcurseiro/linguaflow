-- #118: preserve legacy calls, keep unknown historical exposure honest.
-- The previous migration remains append-only and is applied first.
update public.sessions set language = 'und'
where language = 'en' and source in ('legacy', 'extension', 'video');
alter table public.sessions alter column language set default 'und';
-- Remove the overlapping default; three-argument PostgREST calls stay unambiguous.
drop function public.log_study_time(integer, date, text, text);
create or replace function public.log_study_time(
  p_seconds integer,
  p_date date,
  p_source text,
  p_language text
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_last_heartbeat timestamptz;
  v_elapsed_seconds integer;
  v_credit_seconds integer;
  v_lang text := coalesce(nullif(lower(trim(p_language)), ''), 'en');
  v_row public.sessions;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    raise exception 'seconds must be between 1 and 300' using errcode = '22023';
  end if;
  if p_date is null or p_date < current_date - 1 or p_date > current_date + 1 then
    raise exception 'invalid local date' using errcode = '22023';
  end if;
  if p_source not in (
    'extension', 'pwa', 'video', 'review', 'reader',
    'manual_reading', 'manual_speaking', 'manual_listening', 'manual_writing'
  ) then
    raise exception 'invalid session source' using errcode = '22023';
  end if;

  insert into public.study_time_heartbeats (user_id, last_heartbeat_at)
  values (v_user_id, v_now)
  on conflict (user_id) do nothing;

  if found then
    v_credit_seconds := least(p_seconds, 10);
  else
    select last_heartbeat_at into v_last_heartbeat
    from public.study_time_heartbeats
    where user_id = v_user_id
    for update;

    v_elapsed_seconds := greatest(
      0,
      floor(extract(epoch from (v_now - v_last_heartbeat)))::integer
    );
    v_credit_seconds := least(p_seconds, 10, v_elapsed_seconds);

    if v_credit_seconds > 0 then
      update public.study_time_heartbeats
      set last_heartbeat_at = v_now
      where user_id = v_user_id;
    end if;
  end if;

  if v_credit_seconds > 0 then
    insert into public.sessions (user_id, date, seconds, source, language)
    values (v_user_id, p_date, v_credit_seconds, p_source, v_lang)
    on conflict (user_id, date, source, language) do update
      set seconds = public.sessions.seconds + excluded.seconds
    returning * into v_row;
  else
    select * into v_row
    from public.sessions
    where user_id = v_user_id and date = p_date and source = p_source and language = v_lang;
  end if;

  return v_row;
end;
$$;

-- Overload para compatibilidade com chamadas legadas de 3 parâmetros
create or replace function public.log_study_time(
  p_seconds integer,
  p_date date,
  p_source text
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.log_study_time(p_seconds, p_date, p_source, 'und');
end;
$$;

revoke all on function public.log_study_time(integer, date, text, text)
  from public, anon, service_role;
grant execute on function public.log_study_time(integer, date, text, text)
  to authenticated;

revoke all on function public.log_study_time(integer, date, text)
  from public, anon, service_role;
grant execute on function public.log_study_time(integer, date, text)
  to authenticated;


create table public.listening_intervals (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seconds integer not null check (seconds between 1 and 60),
  credited_seconds integer not null default 0,
  language text not null,
  local_date date not null,
  evidence text not null check (evidence = 'user_confirmed'),
  primary key (user_id, event_id)
);
alter table public.listening_intervals enable row level security;
revoke all on public.listening_intervals from public, anon, authenticated;
create index listening_intervals_owner_time on public.listening_intervals(user_id, ended_at);

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
    or p_evidence is distinct from 'user_confirmed' then
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

-- Only the issued listening transcript, never the answer key or other users' tasks.
create or replace function public.get_fluency_listening_text(p_issue_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_text text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select catalog.answer_key->>'transcript' into v_text
  from public.fluency_task_issues issue join private.fluency_task_catalog catalog on catalog.id=issue.catalog_task_id
  where issue.id=p_issue_id and issue.user_id=auth.uid() and issue.skill='listening' and issue.expires_at>statement_timestamp();
  if v_text is null then raise exception 'listening_issue_not_available' using errcode='P0002'; end if;
  return v_text;
end;
$$;
revoke all on function public.get_fluency_listening_text(uuid) from public,anon,service_role;
grant execute on function public.get_fluency_listening_text(uuid) to authenticated;

notify pgrst, 'reload schema';
