-- Menor privilégio para o papel anon (auditoria 2026-11-19).
--
-- Problema: os privilégios padrão do schema public (pg_default_acl do papel
-- postgres) concedem ao anon INSERT/UPDATE/DELETE/TRUNCATE em toda tabela nova.
-- As tabelas do curso e o canonical_lexicon nasceram depois de
-- 20260718203504_production_least_privilege e herdaram esses grants. Hoje o RLS
-- bloqueia a escrita (só existem policies de SELECT para anon/public), mas uma
-- policy futura com `to public` ou um RLS desligado por engano abriria escrita
-- anônima. Esta migration remove a segunda camada que faltava.
--
-- Idempotente: REVOKE/GRANT podem ser reaplicados sem erro.
-- Rollback: GRANT ALL ON TABLE <tabela> TO anon; e
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

-- Dados por usuário: o anon não lê nem grava nada.
revoke all on table public.course_practice_sessions from public, anon;
revoke all on table public.course_session_results from public, anon;
revoke all on table public.course_user_mistakes from public, anon;
revoke all on table public.course_user_notes from public, anon;
revoke all on table public.course_user_reviews from public, anon;
revoke all on table public.course_user_vocabulary from public, anon;
revoke all on table public.user_course_enrollment from public, anon;

-- Catálogo público e léxico canônico: o anon só lê (as policies de SELECT continuam valendo).
revoke all on table public.course_catalog from public, anon;
revoke all on table public.course_lessons from public, anon;
revoke all on table public.course_units from public, anon;
revoke all on table public.canonical_lexicon from public, anon;
grant select on table public.course_catalog to anon;
grant select on table public.course_lessons to anon;
grant select on table public.course_units to anon;
grant select on table public.canonical_lexicon to anon;

-- Sonda de keep-alive: só SELECT, como definido em production_least_privilege.
revoke all on table public.keep_alive from public, anon;
grant select on table public.keep_alive to anon;

-- Causa raiz: tabelas e funções novas criadas pelo postgres deixam de nascer abertas ao anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
