-- Uma única linha por usuário torna o tempo de atividade exclusivo entre abas,
-- datas e origens. Sessions continua sendo a projeção diária por origem.
create table public.study_time_heartbeats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_heartbeat_at timestamptz not null
);

alter table public.study_time_heartbeats enable row level security;
revoke all on table public.study_time_heartbeats
  from public, anon, authenticated, service_role;

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
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_last_heartbeat timestamptz;
  v_elapsed_seconds integer;
  v_credit_seconds integer;
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
  if p_source not in ('extension', 'pwa', 'video', 'review', 'reader') then
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
    insert into public.sessions (user_id, date, seconds, source)
    values (v_user_id, p_date, v_credit_seconds, p_source)
    on conflict (user_id, date, source) do update
      set seconds = public.sessions.seconds + excluded.seconds
    returning * into v_row;
  else
    select * into v_row
    from public.sessions
    where user_id = v_user_id and date = p_date and source = p_source;
  end if;

  return v_row;
end;
$$;

revoke all on function public.log_study_time(integer, date, text)
  from public, anon, service_role;
grant execute on function public.log_study_time(integer, date, text)
  to authenticated;
