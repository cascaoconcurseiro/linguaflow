-- Retenção das cópias de dados de alunos (auditoria #559, parte 3).
--
-- 1. admin_backups promete expirar cada cópia de reset em 7 dias (expires_at),
--    mas admin_purge_expired_backups() só rodava dentro de um novo reset com
--    backup. Sem reset novo, a cópia vencida, que contém o snapshot completo
--    dos dados do aluno, ficava no banco indefinidamente. Agora a limpeza roda
--    todo dia, no mesmo padrão de prune-stale-sessions, e registra no log de
--    auditoria quando apaga algo.
--
-- 2. O schema backup_20261006 foi criado à mão (nenhuma migration o cria) antes
--    de um reset intencional feito pelo console admin em 2026-10-06. Verificado
--    em 2026-11-19, antes de remover:
--      - nenhuma função, view, cron ou dependência referencia o schema;
--      - das 3 contas presentes nele, 2 têm hoje os mesmos dados (nada perdido);
--      - a 3ª foi resetada de propósito pelo admin, com backup próprio, que
--        segue a política de 7 dias; a cópia avulsa já tinha 44 dias.
--    A remoção segue a política de retenção do produto e a minimização da LGPD.
--    É IRREVERSÍVEL por definição: não há rollback dos dados removidos.
--
-- Rollback (só do agendamento): select cron.unschedule('purge-expired-admin-backups');

do $retention$
declare
  v_tables int;
begin
  if to_regnamespace('backup_20261006') is not null then
    select count(*) into v_tables
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'backup_20261006' and c.relkind = 'r';
    execute 'drop schema backup_20261006 cascade';
    if to_regclass('public.admin_audit_log') is not null then
      insert into public.admin_audit_log (actor_id, actor_email, action, params, result)
      values (null, 'sistema (migration)', 'drop_backup_schema',
              jsonb_build_object('schema', 'backup_20261006', 'reason', 'retencao_vencida_44_dias'),
              jsonb_build_object('tables', v_tables));
    end if;
  end if;

  -- pg_cron pode não existir fora do Supabase (ex.: validação local/CI).
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron indisponível: limpeza diária de cópias vencidas não agendada';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'purge-expired-admin-backups') then
    perform cron.unschedule('purge-expired-admin-backups');
  end if;
  perform cron.schedule(
    'purge-expired-admin-backups', '27 4 * * *',
    $job$
    with r as (select public.admin_purge_expired_backups() as n)
    insert into public.admin_audit_log (actor_id, actor_email, action, params, result)
    select null, 'sistema (pg_cron)', 'purge_backups_auto', '{}'::jsonb, jsonb_build_object('backups', n)
      from r where n > 0
    $job$
  );
end
$retention$;
