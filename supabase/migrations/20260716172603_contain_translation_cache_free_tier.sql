-- Onda 0 / free tier: translation_cache e descartavel, mas cresceu para mais
-- de 40 mil linhas em poucos dias. Este corte adiciona tres defesas:
--   1. TTL de 30 dias;
--   2. teto duro de 5.000 entradas por usuario em cada novo INSERT;
--   3. prune global em lotes diariamente quando pg_cron estiver presente.
--
-- A migration e forward-only. Nao toca em palavras/cards e nao depende do
-- cliente novo. O cache removido pode ser reconstruido pela traducao normal.

create schema if not exists private;

create index if not exists translation_cache_created_at_idx
  on public.translation_cache (created_at, id);

create index if not exists translation_cache_user_recency_idx
  on public.translation_cache (user_id, created_at desc, id desc);

-- O Data API precisa apenas das quatro operacoes cobertas por RLS. Em especial,
-- TRUNCATE ignora RLS e nao pode permanecer concedido a anon/authenticated.
revoke all on table public.translation_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.translation_cache to authenticated;
grant all on table public.translation_cache to service_role;

alter table public.translation_cache enable row level security;

drop policy if exists "Users see own cache" on public.translation_cache;
drop policy if exists "translation_cache_select_own" on public.translation_cache;
drop policy if exists "translation_cache_insert_own" on public.translation_cache;
drop policy if exists "translation_cache_update_own" on public.translation_cache;
drop policy if exists "translation_cache_delete_own" on public.translation_cache;

create policy "translation_cache_select_own"
  on public.translation_cache for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "translation_cache_insert_own"
  on public.translation_cache for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "translation_cache_update_own"
  on public.translation_cache for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "translation_cache_delete_own"
  on public.translation_cache for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Prune global em no maximo dois lotes por chamada: um para TTL e outro para
-- excesso por usuario. SKIP LOCKED evita bloquear escrita ativa. A rechecagem
-- de created_at no DELETE impede apagar uma linha que tenha mudado entre a
-- selecao e a exclusao. Como cache e descartavel, a operacao e idempotente.
create or replace function private.prune_translation_cache(
  p_keep_days integer default 30,
  p_max_rows_per_user integer default 5000,
  p_batch_size integer default 5000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ttl_removed integer := 0;
  v_cap_removed integer := 0;
begin
  if p_keep_days < 1 or p_keep_days > 365 then
    raise exception 'p_keep_days must be between 1 and 365';
  end if;
  if p_max_rows_per_user < 100 or p_max_rows_per_user > 100000 then
    raise exception 'p_max_rows_per_user must be between 100 and 100000';
  end if;
  if p_batch_size < 100 or p_batch_size > 50000 then
    raise exception 'p_batch_size must be between 100 and 50000';
  end if;

  -- Duas execucoes do cron nunca fazem o mesmo trabalho simultaneamente.
  if not pg_try_advisory_xact_lock(
    hashtextextended('linguaflow:translation_cache_prune', 0)
  ) then
    return jsonb_build_object(
      'ok', true,
      'skipped', 'already_running',
      'ttl_removed', 0,
      'cap_removed', 0
    );
  end if;

  with victims as (
    select c.id, c.created_at
    from public.translation_cache c
    where c.created_at < statement_timestamp() - make_interval(days => p_keep_days)
    order by c.created_at, c.id
    limit p_batch_size
    for update skip locked
  ), deleted as (
    delete from public.translation_cache c
    using victims v
    where c.id = v.id
      and c.created_at = v.created_at
    returning c.id
  )
  select count(*)::integer into v_ttl_removed from deleted;

  with ranked as (
    select
      c.id,
      c.created_at,
      row_number() over (
        partition by c.user_id
        order by c.created_at desc, c.id desc
      ) as recency_rank
    from public.translation_cache c
  ), victims as (
    select r.id, r.created_at
    from ranked r
    where r.recency_rank > p_max_rows_per_user
    order by r.created_at, r.id
    limit p_batch_size
  ), deleted as (
    delete from public.translation_cache c
    using victims v
    where c.id = v.id
      and c.created_at = v.created_at
    returning c.id
  )
  select count(*)::integer into v_cap_removed from deleted;

  return jsonb_build_object(
    'ok', true,
    'ttl_removed', v_ttl_removed,
    'cap_removed', v_cap_removed,
    'keep_days', p_keep_days,
    'max_rows_per_user', p_max_rows_per_user,
    'batch_size', p_batch_size
  );
end;
$$;

revoke all on function private.prune_translation_cache(integer, integer, integer)
  from public, anon, authenticated, service_role;

-- Teto sincrono por usuario. A transition table faz um INSERT de milhares de
-- linhas executar a limpeza uma unica vez por usuario, em vez de um scan por
-- linha. O advisory lock transacional serializa statements do mesmo dono sem
-- bloquear usuarios diferentes.
create or replace function private.enforce_translation_cache_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct inserted.user_id
    from inserted_rows inserted
    order by inserted.user_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('linguaflow:translation_cache:' || v_user_id::text, 0)
    );

    delete from public.translation_cache c
    where c.user_id = v_user_id
      and c.created_at < statement_timestamp() - interval '30 days';

    delete from public.translation_cache c
    where c.id in (
      select overflow.id
      from public.translation_cache overflow
      where overflow.user_id = v_user_id
      order by overflow.created_at desc, overflow.id desc
      offset 5000
    );
  end loop;

  return null;
end;
$$;

revoke all on function private.enforce_translation_cache_budget()
  from public, anon, authenticated, service_role;

drop trigger if exists translation_cache_enforce_budget
  on public.translation_cache;
create trigger translation_cache_enforce_budget
  after insert on public.translation_cache
  referencing new table as inserted_rows
  for each statement execute function private.enforce_translation_cache_budget();

-- Compatibilidade administrativa: preserva a assinatura historica, mas ela
-- deixa de ser endpoint da Data API. O cron chama a funcao private diretamente.
create or replace function public.prune_translation_cache(keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := private.prune_translation_cache(keep_days, 5000, 5000);
  return coalesce((v_result ->> 'ttl_removed')::integer, 0)
       + coalesce((v_result ->> 'cap_removed')::integer, 0);
end;
$$;

revoke all on function public.prune_translation_cache(integer)
  from public, anon, authenticated, service_role;

-- Agenda somente quando pg_cron existe. O replay em Postgres puro continua
-- valido; no Supabase hospedado o job e substituido de forma idempotente.
do $schedule_translation_cache_prune$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1 from cron.job where jobname = 'translation-cache-prune'
    ) then
      perform cron.unschedule('translation-cache-prune');
    end if;

    perform cron.schedule(
      'translation-cache-prune',
      '17 3 * * *',
      $cron$select private.prune_translation_cache(30, 5000, 5000);$cron$
    );
  else
    raise notice 'pg_cron indisponivel; teto por INSERT continua ativo e prune global nao foi agendado';
  end if;
end;
$schedule_translation_cache_prune$;

-- Contencao inicial. Um unico lote de 50 mil limita o custo da migration; se
-- houver mais backlog, o cron continua em lotes e o trigger impede novo abuso.
select private.prune_translation_cache(30, 5000, 50000);
