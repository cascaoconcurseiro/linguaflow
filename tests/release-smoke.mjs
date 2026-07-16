#!/usr/bin/env node
/*
 * Verificações locais e determinísticas de release.
 *
 * Não acessa Supabase, Vercel, rede, Docker ou segredos. A validação de
 * replay real das migrations é deliberadamente separada em
 * scripts/replay-migrations-local.ps1, pois exige um ambiente local.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'acorn';

const root = path.resolve(import.meta.dirname, '..');
const allowDirty = process.argv.includes('--allow-dirty');
let failures = 0;

function pass(message) { console.log(`  ✓ ${message}`); }
function fail(message) { failures += 1; console.error(`  ✗ ${message}`); }
function assert(condition, message) { condition ? pass(message) : fail(message); }
function file(relative) { return path.join(root, relative); }
function read(relative) { return readFileSync(file(relative), 'utf8'); }

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

console.log('Release smoke — LinguaFlow');

// A source tree with tracked edits has no immutable release candidate. This
// guard can be bypassed only for pre-commit diagnostics.
const dirtyTracked = git(['status', '--porcelain']).split(/\r?\n/)
  .filter(Boolean)
  .filter((line) => !line.startsWith('?? '));
if (allowDirty || dirtyTracked.length === 0) {
  pass(allowDirty ? 'árvore com alterações aceita para diagnóstico' : 'nenhuma alteração rastreada pendente');
} else {
  fail(`há alterações rastreadas sem commit: ${dirtyTracked.join(', ')}`);
}

console.log('\nSintaxe JavaScript rastreada');
const jsFiles = git(['ls-files', '--', '*.js']).split(/\r?\n/)
  .filter(Boolean)
  // Em diagnóstico pré-commit, `git ls-files` ainda lista arquivos removidos
  // até que a exclusão seja staged. O release final continua verificando todos
  // os JavaScript que efetivamente compõem a árvore candidata.
  .filter((relative) => existsSync(file(relative)));
let syntaxFailures = 0;
for (const relative of jsFiles) {
  try {
    parse(read(relative), { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (error) {
    syntaxFailures += 1;
    fail(`${relative}: ${error.message}`);
  }
}
if (syntaxFailures === 0) pass(`${jsFiles.length} arquivos JavaScript parseados`);

console.log('\nExtensão Chrome');
let extensionManifest;
try {
  extensionManifest = JSON.parse(read('manifest.json'));
  assert(extensionManifest.manifest_version === 3, 'manifest Chrome é MV3');
  const referenced = [
    extensionManifest.background?.service_worker,
    extensionManifest.action?.default_popup,
    ...Object.values(extensionManifest.icons || {}),
    ...Object.values(extensionManifest.action?.default_icon || {}),
    ...(extensionManifest.content_scripts || []).flatMap((entry) => [...(entry.js || []), ...(entry.css || [])]),
  ].filter(Boolean);
  const missing = referenced.filter((relative) => !existsSync(file(relative)));
  assert(missing.length === 0, `todos os ${referenced.length} arquivos referenciados pelo manifest existem${missing.length ? `: ${missing.join(', ')}` : ''}`);
  assert(!extensionManifest.chrome_url_overrides?.newtab, 'extensão não sequestra a nova aba do Chrome');
  const legacyNewTabFiles = ['dashboard/newtab.html', 'dashboard/newtab.js'].filter((relative) => existsSync(file(relative)));
  assert(legacyNewTabFiles.length === 0, `recurso legado de nova aba foi removido${legacyNewTabFiles.length ? `: ${legacyNewTabFiles.join(', ')}` : ''}`);
} catch (error) {
  fail(`manifest.json inválido: ${error.message}`);
}

console.log('\nCaminhos críticos de performance');
const dbSource = read('utils/db.js');
const workerSource = read('background/service-worker.js');
const popupSource = read('content/word-popup.js');
const extensionPopupSource = read('popup/popup.js');
assert(!/[`'\"]words\?select=\*/.test(dbSource) && !/words\(\*\)/.test(dbSource), 'leituras de palavras não baixam snapshot base64 via select=*');
assert(workerSource.includes('QUEUE_WORD_SAVE') && workerSource.includes('word-save-sync'), 'save local-first possui fila persistente e retry');
assert(popupSource.includes("type: 'QUEUE_WORD_SAVE'") && popupSource.includes('queued: true'), 'popup confirma a intenção local sem esperar enriquecimento remoto');
assert(workerSource.includes("args[0].category = classifyWordStatic") && workerSource.includes('refineSavedWord'), 'classificação por IA roda após a gravação inicial');
assert(workerSource.includes('openOrFocusLinguaFlow') && extensionPopupSource.includes("type: 'OPEN_DASHBOARD'") && !extensionPopupSource.includes('chrome.tabs.create'), 'CTAs internos reutilizam uma única guia LinguaFlow');
assert(workerSource.includes("chrome.storage.sync.get(['nativeLang', 'targetLangs']"), 'atualização da extensão preserva preferências existentes');

console.log('\nPWA estático e rotas Vercel');
const pwaWorkerSource = read('dashboard/sw.js');
const appSource = read('dashboard/js/core/app.js');
const dashboardHtml = read('dashboard/dashboard.html');
const clientBuild = appSource.match(/CLIENT_BUILD = '([^']+)'/)?.[1];
assert(Boolean(clientBuild)
  && pwaWorkerSource.includes(`CACHE_NAME = 'linguaflow-v${clientBuild}'`)
  && dashboardHtml.includes(`app.js?v=${clientBuild}`),
  'HTML, cliente e cache PWA usam a mesma versão de build');
assert(pwaWorkerSource.includes("req.destination === 'script'") && pwaWorkerSource.includes("fetch(req)"), 'JavaScript do PWA usa rede primeiro com fallback offline');
const pwaFiles = [
  'dashboard/dashboard.html', 'dashboard/manifest.webmanifest', 'dashboard/sw.js',
  'dashboard/js/core/app.js', 'dashboard/css/globals.css',
  'dashboard/icons/icon128.png', 'dashboard/icons/icon192.png', 'dashboard/icons/icon512.png',
];
assert(pwaFiles.every((relative) => existsSync(file(relative))), `shell PWA contém ${pwaFiles.length} arquivos críticos`);
try {
  const vercel = JSON.parse(read('vercel.json'));
  const rewrites = vercel.rewrites || [];
  const rewriteText = JSON.stringify(rewrites);
  assert(rewriteText.includes('/dashboard/css/') && rewriteText.includes('/dashboard/icons/') && rewriteText.includes('/dashboard/manifest.webmanifest'), 'rewrites expõem CSS, ícones e manifest do PWA');
  const spaRoutes = ['/', '/study', '/settings', '/learn', '/progress'];
  const dashboardDestinations = rewrites.filter((entry) => entry.destination === '/dashboard/dashboard.html');
  assert(
    dashboardDestinations.length >= 2
      && spaRoutes.every((route) => route === '/' || rewriteText.includes(route.slice(1))),
    `fallback SPA cobre ${spaRoutes.join(', ')}`,
  );
} catch (error) {
  fail(`vercel.json inválido: ${error.message}`);
}

console.log('\nMigrations Supabase (validação estática)');
const migrationDir = file('supabase/migrations');
const migrations = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
assert(migrations.length > 0, 'há migrations versionadas');
const namesValid = migrations.every((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name));
assert(namesValid, 'toda migration segue timestamp de 14 dígitos + slug');
assert(new Set(migrations).size === migrations.length, 'não há nomes de migration duplicados');
const ordered = migrations.every((name, index) => index === 0 || migrations[index - 1] < name);
assert(ordered, 'migrations têm ordem lexicográfica estrita');
const empty = migrations.filter((name) => !read(path.join('supabase/migrations', name)).trim());
assert(empty.length === 0, `nenhuma migration SQL está vazia${empty.length ? `: ${empty.join(', ')}` : ''}`);

const sql = Object.fromEntries(migrations.map((name) => [name, read(path.join('supabase/migrations', name))]));
function migrationContaining(fragment) {
  return Object.entries(sql).find(([, value]) => value.includes(fragment));
}
const reviewGrant = migrationContaining('record_card_review');
assert(Boolean(reviewGrant), 'migration de revisão atômica está presente');
if (reviewGrant) {
  const revokesReviewForAnon = Object.entries(sql).some(([name, content]) =>
    name >= reviewGrant[0] && /REVOKE\s+EXECUTE[\s\S]*record_card_review[\s\S]*FROM\s+anon/i.test(content));
  assert(revokesReviewForAnon, 'cadeia de migrations revoga record_card_review de anon');
}
const evidenceFoundation = migrationContaining('CREATE TABLE public.learning_events');
assert(Boolean(evidenceFoundation), 'migration expand-only da Fundação de Evidência está presente');
if (evidenceFoundation) {
  const [name, content] = evidenceFoundation;
  assert(/CREATE TABLE public\.xp_ledger/i.test(content), `${name} cria os dois ledgers`);
  assert((content.match(/ENABLE ROW LEVEL SECURITY/gi) || []).length === 2, `${name} habilita RLS nos dois ledgers`);
  assert(/REVOKE ALL ON TABLE public\.learning_events FROM PUBLIC, anon, authenticated/i.test(content) &&
    /REVOKE ALL ON TABLE public\.xp_ledger FROM PUBLIC, anon, authenticated/i.test(content),
  `${name} não depende de grants implícitos`);
  assert(!/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]*?TO authenticated/i.test(content), `${name} não permite escrita direta do cliente`);
}
const evidenceCommit = migrationContaining('private.commit_qualified_learning_event');
assert(Boolean(evidenceCommit), 'migration expand-only do portão privado P0.1 está presente');
if (evidenceCommit) {
  const [name, content] = evidenceCommit;
  assert(/SECURITY DEFINER[\s\S]*SET search_path = ''/i.test(content), `${name} fixa search_path vazio`);
  assert(/REVOKE ALL ON FUNCTION private\.commit_qualified_learning_event[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i.test(content), `${name} mantém a helper fora da Data API`);
  assert(!/CREATE OR REPLACE FUNCTION public\./i.test(content), `${name} não expõe RPC genérica nova`);
  assert(!/apply_learning_xp\s*\(/i.test(content), `${name} não usa projeção legada com bônus`);
}
const timezoneMigration = migrationContaining('set_user_timezone');
assert(Boolean(timezoneMigration), 'migration de timezone está presente');
if (timezoneMigration) {
  const [name, content] = timezoneMigration;
  assert(/auth\.uid\(\)/i.test(content) && /REVOKE\s+EXECUTE[\s\S]*set_user_timezone[\s\S]*FROM\s+PUBLIC,\s*anon/i.test(content), `${name} autentica e revoga timezone para anon`);
}
const pushMigration = migrationContaining('push_subscriptions');
if (pushMigration) {
  const [name, content] = pushMigration;
  assert(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(content) && /WITH\s+CHECK\s*\(\(select\s+auth\.uid\(\)\)\s*=\s*user_id\)/i.test(content), `${name} protege subscriptions com RLS e WITH CHECK do dono`);
  assert(/UNIQUE\s*\(user_id,\s*endpoint\)/i.test(content), `${name} impede duplicação de endpoint por usuário`);
  const restricted = ['get_push_secrets', 'get_push_candidates'].every((fn) => new RegExp(`REVOKE\\s+EXECUTE[\\s\\S]*${fn}[\\s\\S]*FROM\\s+PUBLIC,\\s*anon,\\s*authenticated`, 'i').test(content));
  assert(restricted, `${name} não expõe RPCs internas de Push ao cliente`);
  const leakedSecret = /(SUPABASE_SERVICE_ROLE_KEY|VAPID_(?:PRIVATE|PUBLIC)_KEY\s*[=:])/i.test(content);
  assert(!leakedSecret, `${name} não contém segredo VAPID/service-role literal`);
} else {
  pass('Web Push ainda não versionado; invariantes de Push não se aplicam');
}

const pushPublicKeyMigration = migrationContaining('get_push_public_key');
assert(Boolean(pushPublicKeyMigration), 'migration de chave VAPID pública está presente');
if (pushPublicKeyMigration) {
  const [name, content] = pushPublicKeyMigration;
  assert(/auth\.uid\(\)/i.test(content) &&
    /WHERE\s+name\s*=\s*'lf_vapid_public'/i.test(content) &&
    /REVOKE\s+EXECUTE[\s\S]*get_push_public_key[\s\S]*FROM\s+PUBLIC,\s*anon/i.test(content) &&
    /GRANT\s+EXECUTE[\s\S]*get_push_public_key[\s\S]*TO\s+authenticated/i.test(content),
  `${name} expõe somente a chave VAPID pública a usuários autenticados`);
  assert(!/lf_vapid_private|lf_push_cron_key/i.test(content), `${name} não menciona segredo privado ou chave do cron`);
}

if (failures > 0) {
  console.error(`\nRelease smoke falhou: ${failures} problema(s).`);
  process.exitCode = 1;
} else {
  console.log('\nRelease smoke passou. Para replay local: powershell -File scripts/replay-migrations-local.ps1 -Execute');
}
