-- Recuperação Codex: estado aplicado em produção em 2026-07-10.
-- Cache descartável não pertence à tabela de configurações do usuário.

create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cache_key text not null,
  value text,
  created_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

alter table public.translation_cache enable row level security;

drop policy if exists "Users see own cache" on public.translation_cache;
create policy "Users see own cache"
  on public.translation_cache for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Migração idempotente dos registros que o cliente antigo gravava em settings.
insert into public.translation_cache (user_id, cache_key, value)
select user_id, key, value
from public.settings
where key like 'trans_%'
on conflict (user_id, cache_key) do update set value = excluded.value;

delete from public.settings where key like 'trans_%';

create or replace function public.prune_translation_cache(keep_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare removed integer;
begin
  if keep_days < 1 then raise exception 'keep_days must be positive'; end if;
  delete from public.translation_cache
  where created_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_translation_cache(integer) from public;
