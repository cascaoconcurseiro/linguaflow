-- LinguaFlow — inventario canonico do schema de aplicacao.
--
-- Somente leitura: nao cria, altera ou apaga objetos e nao consulta linhas de
-- usuario. O resultado inclui metadados estruturais e hashes das definicoes de
-- funcoes; serve para comparar um replay local com o Supabase observado.
-- Escopo: objetos da aplicacao em public/private e triggers desses objetos que
-- vivem em schemas gerenciados (por exemplo, auth.users).

begin transaction read only;

with inventory as (
  select
    'table'::text as object_class,
    format('%I.%I', n.nspname, c.relname) as identity,
    jsonb_build_object(
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity,
      'kind', c.relkind
    ) as details
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm')

  union all

  select
    'column',
    format('%I.%I.%I', n.nspname, c.relname, a.attname),
    jsonb_build_object(
      'position', a.attnum,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid),
      'identity', nullif(a.attidentity, ''),
      'generated', nullif(a.attgenerated, '')
    )
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0
    and not a.attisdropped

  union all

  select
    'constraint',
    format('%I.%I.%I', n.nspname, c.relname, con.conname),
    jsonb_build_object(
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated
    )
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')

  union all

  select
    'index',
    format('%I.%I', n.nspname, i.relname),
    jsonb_build_object(
      'table', format('%I.%I', n.nspname, t.relname),
      'definition', pg_get_indexdef(i.oid)
    )
  from pg_class i
  join pg_namespace n on n.oid = i.relnamespace
  join pg_index x on x.indexrelid = i.oid
  join pg_class t on t.oid = x.indrelid
  where n.nspname in ('public', 'private')

  union all

  select
    'policy',
    format('%I.%I.%I', schemaname, tablename, policyname),
    jsonb_build_object(
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    )
  from pg_policies
  where schemaname in ('public', 'private')

  union all

  select
    'function',
    format('%I.%I(%s)', n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid)),
    jsonb_build_object(
      'returns', pg_get_function_result(p.oid),
      'language', l.lanname,
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb),
      'acl', coalesce(to_jsonb(p.proacl), '[]'::jsonb),
      'definition_md5', md5(pg_get_functiondef(p.oid))
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname in ('public', 'private')

  union all

  select
    'trigger',
    format('%I.%I.%I', target_n.nspname, target_c.relname, t.tgname),
    jsonb_build_object(
      'function', format('%I.%I', function_n.nspname, p.proname),
      'definition', pg_get_triggerdef(t.oid, true)
    )
  from pg_trigger t
  join pg_class target_c on target_c.oid = t.tgrelid
  join pg_namespace target_n on target_n.oid = target_c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace function_n on function_n.oid = p.pronamespace
  where not t.tgisinternal
    and function_n.nspname in ('public', 'private')

  union all

  select
    'table_grant',
    format('%I.%I:%s:%s', table_schema, table_name, grantee, privilege_type),
    jsonb_build_object('grantable', is_grantable)
  from information_schema.role_table_grants
  where table_schema in ('public', 'private')
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')

  union all

  select
    'routine_grant',
    format('%I.%I:%s:%s', routine_schema, routine_name, grantee, privilege_type),
    jsonb_build_object('grantable', is_grantable)
  from information_schema.role_routine_grants
  where routine_schema in ('public', 'private')
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')

  union all

  select
    'extension',
    e.extname,
    jsonb_build_object('schema', n.nspname, 'version', e.extversion)
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
), ordered as (
  select object_class, identity, details
  from inventory
  order by object_class, identity
)
select jsonb_build_object(
  'generated_at', now(),
  'server_version', current_setting('server_version'),
  'scope', jsonb_build_array('public', 'private', 'app-owned cross-schema triggers'),
  'objects', jsonb_agg(jsonb_build_object(
    'class', object_class,
    'identity', identity,
    'details', details
  )),
  'inventory_md5', md5(string_agg(
    object_class || E'\n' || identity || E'\n' || details::text,
    E'\n' order by object_class, identity
  ))
) as schema_inventory
from ordered;

commit;
