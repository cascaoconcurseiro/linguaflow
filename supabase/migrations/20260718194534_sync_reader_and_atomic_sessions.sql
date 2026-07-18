-- Reader sincronizado e contagem de estudo concorrente/atômica.

create table public.reader_texts (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  source text not null default 'pasted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_texts_id_length check (length(id) between 1 and 100),
  constraint reader_texts_title_length check (length(title) between 1 and 300),
  constraint reader_texts_content_length check (length(content) between 1 and 2000000),
  constraint reader_texts_source_check check (source in ('pasted', 'url', 'epub', 'sample', 'migration')),
  constraint reader_texts_pkey primary key (user_id, id)
);

alter table public.reader_texts enable row level security;

create policy "reader_texts_select_own" on public.reader_texts
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "reader_texts_insert_own" on public.reader_texts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "reader_texts_update_own" on public.reader_texts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "reader_texts_delete_own" on public.reader_texts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.reader_texts to authenticated;
revoke all on public.reader_texts from anon;
create index reader_texts_user_updated_idx on public.reader_texts (user_id, updated_at desc);

-- A sessão diária passa a preservar a origem. Registros antigos continuam
-- identificados como legacy; novas somas são separadas por canal.
alter table public.sessions add column if not exists source text not null default 'legacy';
alter table public.sessions add constraint sessions_source_check
  check (source in ('legacy', 'extension', 'pwa', 'video', 'review', 'reader'));
alter table public.sessions drop constraint if exists sessions_user_id_date_key;
alter table public.sessions add constraint sessions_user_date_source_key unique (user_id, date, source);

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

  insert into public.sessions (user_id, date, seconds, source)
  values (v_user_id, p_date, p_seconds, p_source)
  on conflict (user_id, date, source) do update
    set seconds = public.sessions.seconds + excluded.seconds
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.log_study_time(integer, date, text) from public, anon;
grant execute on function public.log_study_time(integer, date, text) to authenticated;
