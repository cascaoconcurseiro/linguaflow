-- Migration: 20260921160000_multimodal_study_and_language_tracking.sql
-- Adiciona suporte a rastreamento de horas de estudo por idioma (listening automático e registro manual de habilidades).
-- Adiciona telemetria de tempo de hesitação/resposta (response_time_ms) nas revisões de flashcards.

-- 1. Evolução da tabela public.sessions
alter table public.sessions
  add column if not exists language text not null default 'en';

-- Ajuste das fontes permitidas (incluindo habilidades manuais de estudo)
alter table public.sessions
  drop constraint if exists sessions_source_check;

alter table public.sessions
  add constraint sessions_source_check check (
    source in (
      'legacy', 'extension', 'pwa', 'video', 'review', 'reader',
      'manual_reading', 'manual_speaking', 'manual_listening', 'manual_writing'
    )
  );

-- Atualização da chave única para incluir idioma
alter table public.sessions
  drop constraint if exists sessions_user_date_source_key;

alter table public.sessions
  drop constraint if exists sessions_user_date_source_lang_key;

alter table public.sessions
  add constraint sessions_user_date_source_lang_key unique (user_id, date, source, language);

-- Índice por idioma para agregação rápida no dashboard e popup
create index if not exists idx_sessions_user_lang_date
  on public.sessions (user_id, language, date desc);

-- 2. Telemetria de latência nos flashcards
alter table public.review_log
  add column if not exists response_time_ms integer;

-- 3. Atualização atômica de log_study_time com suporte a p_language
create or replace function public.log_study_time(
  p_seconds integer,
  p_date date,
  p_source text,
  p_language text default 'en'
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
  return public.log_study_time(p_seconds, p_date, p_source, 'en');
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

-- 4. Função para registro manual de estudo externo (Reading, Speaking, etc.)
create or replace function public.log_manual_study(
  p_skill text,
  p_minutes integer,
  p_date date,
  p_language text default 'en',
  p_notes text default null
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source text;
  v_lang text := coalesce(nullif(lower(trim(p_language)), ''), 'en');
  v_seconds integer;
  v_row public.sessions;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_skill not in ('reading', 'speaking', 'listening', 'writing') then
    raise exception 'invalid study skill' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 720 then
    raise exception 'minutes must be between 1 and 720' using errcode = '22023';
  end if;
  if p_date is null or p_date < current_date - 90 or p_date > current_date then
    raise exception 'invalid study date' using errcode = '22023';
  end if;

  v_source := 'manual_' || p_skill;
  v_seconds := p_minutes * 60;

  insert into public.sessions (user_id, date, seconds, source, language)
  values (v_user_id, p_date, v_seconds, v_source, v_lang)
  on conflict (user_id, date, source, language) do update
    set seconds = public.sessions.seconds + excluded.seconds
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.log_manual_study(text, integer, date, text, text)
  from public, anon, service_role;
grant execute on function public.log_manual_study(text, integer, date, text, text)
  to authenticated;
