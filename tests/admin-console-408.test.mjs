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

test('entrada Administração: oculta por padrão, só revelada para admin e abre o PIN direto', () => {
  const html = read('dashboard', 'dashboard.html');
  assert.match(html, /id="profile-admin-item" hidden>Administração<\/button>/, 'item nasce oculto');

  const app = read('dashboard', 'js', 'core', 'app.js');
  assert.match(app, /async revealAdminEntry\(\)/);
  assert.match(app, /const isAdmin = await db\.isAdmin\(\)\.catch\(\(\) => false\);\s+if \(!isAdmin\) return;\s+item\.hidden = false;/,
    'só revela depois de isAdmin() verdadeiro');
  assert.match(app, /this\.navigate\('settings', \{ adminPin: true \}\)/, 'sem sessão de PIN vai ao PIN');
  assert.match(app, /this\.clientBuild = CLIENT_BUILD;/, 'versão atual exposta ao painel');

  const settings = read('dashboard', 'js', 'ui', 'settingsView.js');
  assert.match(settings, /app\.routeParams\?\.adminPin\) openAdminPinModal\(app\)/);
  assert.match(settings, /\$\{isAdmin \? `[\s\S]*btn-admin-gate/, 'botão das Configurações só para admin');
});

test('erros agrupados por versão e marcados como versão antiga', () => {
  const sql = read('supabase', 'migrations', '20261003130000_admin_errors_by_version.sql');
  assert.match(sql, /GROUP BY 1, 2, 3/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON public\.admin_users FROM authenticated;/);
  const system = read('dashboard', 'js', 'ui', 'admin', 'adminSystem.js');
  assert.match(system, /function isOlderVersion/);
  assert.match(system, /versão antiga/);
});

test('central de segurança e relatos (#412): RPCs, limites e UI', () => {
  const sql = read('supabase', 'migrations', '20261003140000_security_center_and_reports.sql');
  assert.match(sql, /REVOKE ALL ON public\.user_reports FROM PUBLIC, anon, authenticated;\s*GRANT SELECT ON public\.user_reports TO authenticated;/,
    'clientes só leem; escrita só pela RPC');
  assert.match(sql, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/, 'cada usuário lê só os próprios relatos');
  assert.match(sql, />= 5 THEN\s+RAISE EXCEPTION 'Limite de 5 relatos por dia/, 'limite diário no servidor');
  assert.match(sql, /interval '10 minutes'/, 'deduplicação');
  assert.match(sql, /auth\.uid\(\) IS NULL|v_uid IS NULL/, 'login obrigatório');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.submit_user_report\(text, text, text, text, text\) FROM PUBLIC, anon;/);
  for (const name of ['admin_list_reports', 'admin_security_overview']) {
    assert.match(sql, new RegExp(String.raw`FUNCTION public\.${name}[\s\S]*?admin_assert_role\(p_session_token, false\)`), `${name} somente leitura`);
  }
  assert.match(sql, /FUNCTION public\.admin_update_report[\s\S]*?admin_assert_role\(p_session_token, true\)[\s\S]*?admin_write_audit\('update_report'/);
  assert.doesNotMatch(sql, /inet_client_addr|x-forwarded-for/i, 'não grava IP bruto em tabela nova');

  const db = read('utils', 'db.js');
  const sw = read('background', 'service-worker.js');
  for (const method of ['submitUserReport', 'listMyReports', 'adminSecurityOverview', 'adminListReports', 'adminUpdateReport']) {
    assert.ok(db.includes(`async ${method}(`), `${method} em db.js`);
    assert.ok(sw.includes(`'${method}'`), `${method} no proxy`);
  }

  const view = read('dashboard', 'js', 'ui', 'adminView.js');
  assert.match(view, /id: 'reports'/);
  assert.match(view, /id: 'security'/);

  const settings = read('dashboard', 'js', 'ui', 'settingsView.js');
  assert.match(settings, /Ajuda e relatos/);
  assert.match(settings, /mountReportCard/);
  const report = read('dashboard', 'js', 'ui', 'reportProblem.js');
  assert.match(report, /aria-live="polite"/);
  assert.match(report, /maxlength="2000"/);
  assert.match(report, /escapeHtml\(report\.message/, 'relatos são escapados ao renderizar');

  const security = read('dashboard', 'js', 'ui', 'admin', 'adminSecurity.js');
  assert.match(security, /Vercel → Firewall/);
  assert.match(security, /Challenge/);
  assert.match(security, /exige plano Pro|Exige plano Pro/, 'deixa claro o que é pago');
});

test('higiene de sessões e selo de alertas (#416)', () => {
  const sql = read('supabase', 'migrations', '20261003150000_session_hygiene_and_alert_summary.sql');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.prune_stale_sessions\(int\) FROM PUBLIC, anon, authenticated;/,
    'a rotina de limpeza não é chamável por clientes');
  assert.match(sql, /cron\.schedule\(\s*'prune-stale-sessions', '17 4 \* \* \*'/);
  assert.match(sql, /LEAST\(GREATEST\(COALESCE\(p_days, 30\), 7\), 365\)/, 'janela mínima de 7 dias');
  assert.ok(sql.includes("admin_assert_role(p_session_token, true);\n  v_n := public.prune_stale_sessions(p_days);"),
    'encerrar manualmente exige escrita');
  assert.match(sql, /admin_write_audit\('prune_sessions'/);
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM public\.admin_users WHERE user_id = auth\.uid\(\)\) THEN\s+RETURN jsonb_build_object\('admin', false\);/,
    'não-admin só recebe admin:false');
  assert.doesNotMatch(sql, /RETURN jsonb_build_object\(\s+'admin', true,[\s\S]*email/, 'resumo não expõe e-mails');

  const app = read('dashboard', 'js', 'core', 'app.js');
  assert.match(app, /db\.adminAlertSummary\(\)/);
  assert.match(app, /Administração \(\$\{pending\}\)/);
  const security = read('dashboard', 'js', 'ui', 'admin', 'adminSecurity.js');
  assert.match(security, /Higiene de sessões/);
  assert.match(security, /adminPruneStaleSessions\(30\)/);
  const sw = read('background', 'service-worker.js');
  for (const method of ['adminSessionHygiene', 'adminPruneStaleSessions', 'adminAlertSummary']) {
    assert.ok(sw.includes(`'${method}'`), method);
  }
});
