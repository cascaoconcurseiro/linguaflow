-- Menor privilégio para o papel anon em sequências (auditoria #559, parte 2).
--
-- A migration 20261119120000 corrigiu tabelas e funções, mas os privilégios
-- padrão de sequências do papel postgres ainda concedem USAGE/SELECT/UPDATE ao
-- anon. Hoje isso afeta só public.admin_audit_log_id_seq: o anon conseguiria
-- consumir ou ajustar a numeração do log de auditoria se a sequência fosse
-- exposta. As gravações do log são feitas por funções SECURITY DEFINER,
-- executadas como dono, que não dependem desse grant.
--
-- Idempotente. Rollback:
--   GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.admin_audit_log_id_seq TO anon;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon;

do $$
begin
  if to_regclass('public.admin_audit_log_id_seq') is not null then
    execute 'revoke all on sequence public.admin_audit_log_id_seq from public, anon';
  end if;
  -- Condicional ao papel: no Supabase ele sempre existe; no replay efêmero da CI, não.
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'alter default privileges for role postgres in schema public revoke all on sequences from anon';
  end if;
end
$$;
