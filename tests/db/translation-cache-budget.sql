\set ON_ERROR_STOP on

begin;

do $$
declare
  v_user uuid := '00000000-0000-4000-8000-000000000051';
  v_count integer;
  v_result jsonb;
  v_policy_count integer;
  v_started_at timestamptz;
begin
  insert into auth.users (id, email)
  values (v_user, 'translation-cache-budget@test.dev')
  on conflict (id) do nothing;

  -- O teto precisa funcionar numa unica insercao multi-row e manter exatamente
  -- as 5.000 entradas mais recentes do usuario.
  v_started_at := clock_timestamp();
  insert into public.translation_cache (user_id, cache_key, value, created_at)
  select
    v_user,
    'budget-test-' || g::text,
    'value-' || g::text,
    statement_timestamp() - make_interval(secs => 5002 - g)
  from generate_series(1, 5001) g;

  if clock_timestamp() - v_started_at > interval '15 seconds' then
    raise exception 'trigger por statement excedeu 15s para 5.001 linhas';
  end if;

  select count(*) into v_count
  from public.translation_cache
  where user_id = v_user;

  if v_count <> 5000 then
    raise exception 'teto por usuario falhou: esperado 5000, obtido %', v_count;
  end if;

  if exists (
    select 1 from public.translation_cache
    where user_id = v_user and cache_key = 'budget-test-1'
  ) then
    raise exception 'teto removeu a ordem errada: entrada mais antiga sobreviveu';
  end if;

  -- TTL tambem e aplicado no caminho sincrono.
  insert into public.translation_cache (user_id, cache_key, value, created_at)
  values (v_user, 'budget-expired', 'expired', now() - interval '31 days');

  if exists (
    select 1 from public.translation_cache
    where user_id = v_user and cache_key = 'budget-expired'
  ) then
    raise exception 'TTL sincrono nao removeu entrada expirada';
  end if;

  v_result := private.prune_translation_cache(30, 5000, 5000);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'prune global retornou contrato invalido: %', v_result;
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'translation_cache'
    and roles = array['authenticated']::name[];

  if v_policy_count <> 4 then
    raise exception 'esperadas 4 policies authenticated, obtidas %', v_policy_count;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'translation_cache'
      and policyname = 'Users see own cache'
  ) then
    raise exception 'policy ampla legada Users see own cache ainda existe';
  end if;

  if not has_table_privilege('authenticated', 'public.translation_cache', 'SELECT')
     or not has_table_privilege('authenticated', 'public.translation_cache', 'INSERT')
     or not has_table_privilege('authenticated', 'public.translation_cache', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.translation_cache', 'DELETE') then
    raise exception 'authenticated nao possui o CRUD minimo do cache';
  end if;

  if has_table_privilege('authenticated', 'public.translation_cache', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.translation_cache', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.translation_cache', 'TRIGGER') then
    raise exception 'authenticated manteve privilegio fora do CRUD minimo';
  end if;

  if has_table_privilege('anon', 'public.translation_cache', 'SELECT')
     or has_table_privilege('anon', 'public.translation_cache', 'INSERT')
     or has_table_privilege('anon', 'public.translation_cache', 'UPDATE')
     or has_table_privilege('anon', 'public.translation_cache', 'DELETE')
     or has_table_privilege('anon', 'public.translation_cache', 'TRUNCATE') then
    raise exception 'anon manteve acesso ao translation_cache';
  end if;

  if has_function_privilege(
       'authenticated',
       'private.prune_translation_cache(integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.prune_translation_cache(integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.prune_translation_cache(integer)',
       'EXECUTE'
     ) then
    raise exception 'funcao administrativa ficou exposta a papel da API';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'prune_translation_cache'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'prune private sem SECURITY DEFINER/search_path endurecido';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.translation_cache'::regclass
      and t.tgname = 'translation_cache_enforce_budget'
      and not t.tgisinternal
      and (t.tgtype & 1) = 0
  ) then
    raise exception 'budget trigger nao e FOR EACH STATEMENT';
  end if;

  -- No Postgres efemero pg_cron pode nao existir. Quando existe, a migration
  -- deve deixar exatamente um job ativo, diario as 03:17 UTC.
  if to_regclass('cron.job') is not null then
    select count(*) into v_count
    from cron.job
    where jobname = 'translation-cache-prune'
      and schedule = '17 3 * * *'
      and active;

    if v_count <> 1 then
      raise exception 'job translation-cache-prune nao e unico/ativo/diario';
    end if;
  end if;
end;
$$;

rollback;
