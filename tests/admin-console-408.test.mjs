// tests/admin-console-408.test.mjs
// Contrato do console administrativo (#408). Estrutural: não substitui QA de navegador nem teste com RLS real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '20261003120000_admin_console.sql');

const WRITE_RPCS = [
  'admin_reset_user_data', 'admin_reset_all_users_data', 'admin_restore_backup', 'admin_delete_backup',
  'admin_set_user_suspended', 'admin_revoke_user_sessions', 'admin_delete_user', 'admin_clear_client_errors',
  'admin_export_user_data', 'admin_set_admin_role', 'admin_set_system_notice',
];

function functionBody(name) {
  const start = migration.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} deve existir`);
  const rest = migration.slice(start);
  const next = rest.indexOf('CREATE OR REPLACE FUNCTION', 10);
  return next === -1 ? rest : rest.slice(0, next);
}

test('toda RPC de escrita exige papel admin (escrita) e registra auditoria', () => {
  for (const name of WRITE_RPCS) {
    const body = functionBody(name);
    assert.match(body, /admin_assert_role\(p_session_token, (true|NOT p_dry_run)\)/, `${name} deve exigir papel de escrita`);
    assert.match(body, /admin_write_audit\(/, `${name} deve auditar`);
  }
});

test('RPCs de leitura aceitam suporte (somente leitura) e não escrevem', () => {
  for (const name of ['admin_users_page', 'admin_get_user_detail', 'admin_get_overview', 'admin_list_errors',
    'admin_api_usage', 'admin_list_audit', 'admin_list_admins', 'admin_list_backups', 'admin_get_system_notice']) {
    const body = functionBody(name);
    assert.match(body, /admin_assert_role\(p_session_token, false\)/, `${name} deve ser somente leitura`);
    assert.doesNotMatch(body, /\b(INSERT INTO|UPDATE|DELETE FROM)\b/i, `${name} não pode escrever`);
  }
});

test('reset global exige PIN recente e frase validada no servidor; reset de usuário faz dry-run e backup', () => {
  const all = functionBody('admin_reset_all_users_data');
  assert.match(all, /admin_assert_recent_session/);
  assert.match(all, /RESETAR TODOS/);
  const one = functionBody('admin_reset_user_data');
  assert.match(one, /p_dry_run/);
  assert.match(one, /INSERT INTO public\.admin_backups/);
});

test('auditoria é append-only e backups/flags não são acessíveis a clientes', () => {
  assert.match(migration, /admin_audit_log_no_change[\s\S]*BEFORE UPDATE OR DELETE/);
  for (const table of ['admin_audit_log', 'admin_backups', 'admin_flags']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated;`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
  }
});

test('helpers internos e funções antigas destrutivas não ficam expostos', () => {
  for (const helper of ['admin_assert_role(uuid, boolean)', 'admin_write_audit(text, uuid, jsonb, jsonb)',
    'admin_scope_tables(text[])', 'admin_snapshot_user(uuid, text[])']) {
    assert.ok(migration.includes(`REVOKE ALL ON FUNCTION public.${helper} FROM PUBLIC, anon, authenticated;`), helper);
  }
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.admin_reset_user_deck\(uuid, uuid\);/);
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.admin_reset_all_decks\(uuid\);/);
  assert.doesNotMatch(migration, /@gmail\.com|@hotmail\.com|@yahoo\.com/i, 'sem e-mails pessoais na migration');
});

test('suspensão e exclusão protegem o próprio admin e outros admins', () => {
  for (const name of ['admin_set_user_suspended', 'admin_delete_user']) {
    const body = functionBody(name);
    assert.match(body, /p_target_user_id = auth\.uid\(\)/, `${name} bloqueia autoalvo`);
    assert.match(body, /FROM public\.admin_users WHERE user_id = p_target_user_id/, `${name} bloqueia admins`);
  }
  assert.match(functionBody('admin_set_admin_role'), /p_target_user_id = auth\.uid\(\)/, 'não altera o próprio papel');
});

test('escopos cobrem todas as tabelas de usuário sem tocar catálogos', () => {
  const scopes = functionBody('admin_scope_tables');
  for (const table of ['cards', 'words', 'review_log', 'xp_ledger', 'learning_events', 'user_stats',
    'course_user_vocabulary', 'fluency_task_submissions', 'stories', 'client_errors', 'settings']) {
    assert.match(scopes, new RegExp(`'${table}'`), `${table} deve estar em algum escopo`);
  }
  for (const catalog of ['course_catalog', 'course_units', 'course_lessons', 'canonical_lexicon', 'admin_users']) {
    assert.doesNotMatch(scopes, new RegExp(`'${catalog}'`), `${catalog} não pode ser apagado por escopo`);
  }
  // review_log precisa sair antes de learning_events (FK NO ACTION)
  assert.ok(scopes.indexOf("'review_log'") < scopes.indexOf("'learning_events'"));
});

test('cliente: db.js expõe a API e o service worker a whitelista', () => {
  const db = read('utils', 'db.js');
  const sw = read('background', 'service-worker.js');
  const methods = ['adminGetRole', 'adminGetOverview', 'adminUsersPage', 'adminGetUserDetail', 'adminExportUserData',
    'adminResetUserData', 'adminResetAllUsersData', 'adminListBackups', 'adminRestoreBackup', 'adminDeleteBackup',
    'adminSetUserSuspended', 'adminRevokeUserSessions', 'adminDeleteUser', 'adminListErrors', 'adminClearErrors',
    'adminApiUsage', 'adminListAudit', 'adminListAdmins', 'adminSetAdminRole', 'adminGetSystemNotice',
    'adminSetSystemNotice', 'getSystemNotice'];
  for (const method of methods) {
    assert.match(db, new RegExp(`async ${method}\\(`), `${method} em db.js`);
    assert.ok(sw.includes(`'${method}'`), `${method} em DB_PROXY_METHODS`);
  }
  assert.doesNotMatch(db, /adminResetUserDeck|adminResetAllDecks|adminGetMetrics|adminListUsers\(/, 'métodos antigos removidos');
});

test('UI: abas acessíveis, papel de suporte sem escrita e estados assíncronos', () => {
  const view = read('dashboard', 'js', 'ui', 'adminView.js');
  assert.match(view, /role="tablist"/);
  assert.match(view, /role="tab"/);
  assert.match(view, /role="tabpanel"/);
  assert.match(view, /aria-selected/);
  assert.match(view, /ArrowRight/);
  assert.match(view, /writeOnly/, 'aba de perigo só para escrita');
  assert.match(view, /_getAdminSessionToken\(\)/);

  const shared = read('dashboard', 'js', 'ui', 'admin', 'adminShared.js');
  assert.match(shared, /role="dialog"/);
  assert.match(shared, /aria-modal="true"/);
  assert.match(shared, /Escape/);
  assert.match(shared, /renderSkeleton/);

  const css = read('dashboard', 'css', 'admin.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /linear-gradient\((?!100deg)/, 'sem gradientes decorativos além do skeleton');

  const detail = read('dashboard', 'js', 'ui', 'admin', 'adminUserDetail.js');
  assert.match(detail, /ctx\.canWrite/, 'ações do detalhe dependem do papel');
  const reset = read('dashboard', 'js', 'ui', 'admin', 'adminResetDialog.js');
  assert.match(reset, /dryRun: true/, 'reset mostra impacto antes de executar');
});

test('nenhum módulo do console contém e-mail pessoal ou PIN', () => {
  const dir = path.join(ROOT, 'dashboard', 'js', 'ui', 'admin');
  for (const file of fs.readdirSync(dir)) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(content, /@gmail\.com/i, file);
    assert.doesNotMatch(content, /\b\d{6}\b/, `${file} sem PIN literal`);
  }
});
