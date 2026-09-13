// tests/admin-authority.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('Migration 20260913100000_admin_authority_rpcs.sql contains authoritative security checks', () => {
  const migPath = path.join(ROOT, 'supabase', 'migrations', '20260913100000_admin_authority_rpcs.sql');
  assert.ok(fs.existsSync(migPath), 'Migration file must exist');

  const content = fs.readFileSync(migPath, 'utf8');
  assert.match(content, /admin_assert_authority/, 'Must define admin authority assertion helper');
  assert.match(content, /wesley\.diaslima@gmail\.com/, 'Must assert exact admin email');
  assert.match(content, /admin_get_system_metrics/, 'Must define system metrics RPC');
  assert.match(content, /admin_list_users/, 'Must define list users RPC');
  assert.match(content, /admin_reset_user_deck/, 'Must define reset user deck RPC');
  assert.match(content, /admin_reset_all_decks/, 'Must define reset all decks RPC');
  assert.match(content, /admin_delete_user/, 'Must define delete user RPC');
  assert.match(content, /p_target_user_id = auth\.uid\(\)/, 'Must protect admin from self-deletion');
});

test('utils/db.js exposes all required admin and user session methods', () => {
  const dbPath = path.join(ROOT, 'utils', 'db.js');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.match(content, /getCurrentUser\(\)/, 'Must expose getCurrentUser()');
  assert.match(content, /adminGetMetrics\(\)/, 'Must expose adminGetMetrics()');
  assert.match(content, /adminListUsers\(\)/, 'Must expose adminListUsers()');
  assert.match(content, /adminResetUserDeck\(/, 'Must expose adminResetUserDeck()');
  assert.match(content, /adminResetAllDecks\(\)/, 'Must expose adminResetAllDecks()');
  assert.match(content, /adminDeleteUser\(/, 'Must expose adminDeleteUser()');
  assert.match(content, /adminClearErrors\(\)/, 'Must expose adminClearErrors()');
});

test('background/service-worker.js whitelists admin methods in DB_PROXY_METHODS', () => {
  const swPath = path.join(ROOT, 'background', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');

  assert.match(content, /'getCurrentUser'/, 'DB_PROXY_METHODS must include getCurrentUser');
  assert.match(content, /'adminGetMetrics'/, 'DB_PROXY_METHODS must include adminGetMetrics');
  assert.match(content, /'adminListUsers'/, 'DB_PROXY_METHODS must include adminListUsers');
  assert.match(content, /'adminResetUserDeck'/, 'DB_PROXY_METHODS must include adminResetUserDeck');
  assert.match(content, /'adminResetAllDecks'/, 'DB_PROXY_METHODS must include adminResetAllDecks');
  assert.match(content, /'adminDeleteUser'/, 'DB_PROXY_METHODS must include adminDeleteUser');
  assert.match(content, /'adminClearErrors'/, 'DB_PROXY_METHODS must include adminClearErrors');
});

test('dashboard/js/core/app.js registers admin route', () => {
  const appPath = path.join(ROOT, 'dashboard', 'js', 'core', 'app.js');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.match(content, /renderAdmin/, 'Must import renderAdmin');
  assert.match(content, /admin:\s*renderAdmin/, 'Must register admin in renderers map');
});

test('dashboard/js/ui/settingsView.js validates admin email and 909496 PIN', () => {
  const settingsPath = path.join(ROOT, 'dashboard', 'js', 'ui', 'settingsView.js');
  const content = fs.readFileSync(settingsPath, 'utf8');

  assert.match(content, /wesley\.diaslima@gmail\.com/, 'Must check wesley.diaslima@gmail.com for admin gate button');
  assert.match(content, /btn-admin-gate/, 'Must render btn-admin-gate');
  assert.match(content, /909496/, 'Must check master PIN 909496');
  assert.match(content, /app\.navigate\(['"]admin['"]\)/, 'Must navigate to admin view on PIN success');
});

test('dashboard/js/ui/adminView.js protects against unauthorized access and provides admin capabilities', () => {
  const adminViewPath = path.join(ROOT, 'dashboard', 'js', 'ui', 'adminView.js');
  assert.ok(fs.existsSync(adminViewPath), 'adminView.js must exist');

  const content = fs.readFileSync(adminViewPath, 'utf8');
  assert.match(content, /wesley\.diaslima@gmail\.com/, 'adminView must verify wesley.diaslima@gmail.com');
  assert.match(content, /btn-admin-reset-my-deck/, 'Must have button to reset own deck');
  assert.match(content, /btn-admin-reset-all-decks/, 'Must have button to reset all decks');
  assert.match(content, /LIMPAR TUDO/, 'Must require typed confirmation phrase for resetting all decks');
  assert.match(content, /admin-user-search/, 'Must have user search input');
});
