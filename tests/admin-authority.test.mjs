// tests/admin-authority.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

test('Migration 20260913100000_admin_authority_rpcs.sql contains role-based checks and zero PII', () => {
  const migPath = path.join(ROOT, 'supabase', 'migrations', '20260913100000_admin_authority_rpcs.sql');
  assert.ok(fs.existsSync(migPath), 'Migration file must exist');

  const content = fs.readFileSync(migPath, 'utf8');
  assert.match(content, /public\.admin_users/, 'Must define admin_users role table');
  assert.match(content, /admin_assert_authority/, 'Must define admin authority assertion helper');
  assert.match(content, /admin_verify_pin/, 'Must define admin_verify_pin RPC');
  assert.match(content, /admin_get_system_metrics/, 'Must define system metrics RPC');
  assert.match(content, /admin_list_users/, 'Must define list users RPC');
  assert.match(content, /admin_reset_user_deck/, 'Must define reset user deck RPC');
  assert.match(content, /admin_reset_all_decks/, 'Must define reset all decks RPC');
  assert.match(content, /admin_delete_user/, 'Must define delete user RPC');

  // Strict PII checks: no emails in migration!
  assert.doesNotMatch(content, /@gmail\.com|@hotmail\.com|@yahoo\.com/i, 'Migration must not contain personal email addresses');
});

test('utils/db.js exposes all required admin methods without hardcoding PII', () => {
  const dbPath = path.join(ROOT, 'utils', 'db.js');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.match(content, /isAdmin\(\)/, 'Must expose isAdmin()');
  assert.match(content, /adminVerifyPin\(/, 'Must expose adminVerifyPin()');
  assert.match(content, /adminGetMetrics\(\)/, 'Must expose adminGetMetrics()');
  assert.match(content, /adminListUsers\(\)/, 'Must expose adminListUsers()');
  assert.match(content, /adminResetUserDeck\(/, 'Must expose adminResetUserDeck()');
  assert.match(content, /adminResetAllDecks\(\)/, 'Must expose adminResetAllDecks()');
  assert.match(content, /adminDeleteUser\(/, 'Must expose adminDeleteUser()');
  assert.match(content, /adminClearErrors\(\)/, 'Must expose adminClearErrors()');

  assert.doesNotMatch(content, /@gmail\.com/i, 'db.js must not contain hardcoded email');
});

test('background/service-worker.js whitelists admin methods in DB_PROXY_METHODS', () => {
  const swPath = path.join(ROOT, 'background', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');

  assert.match(content, /'isAdmin'/, 'DB_PROXY_METHODS must include isAdmin');
  assert.match(content, /'adminVerifyPin'/, 'DB_PROXY_METHODS must include adminVerifyPin');
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

test('dashboard/js/ui/settingsView.js validates admin role and hashes PIN (zero PII/plain password)', () => {
  const settingsPath = path.join(ROOT, 'dashboard', 'js', 'ui', 'settingsView.js');
  const content = fs.readFileSync(settingsPath, 'utf8');

  assert.match(content, /lfDb\.isAdmin\(\)/, 'Must use lfDb.isAdmin() instead of hardcoded email');
  assert.match(content, /btn-admin-gate/, 'Must render btn-admin-gate');
  assert.match(content, /SHA-256/, 'Must hash PIN using SHA-256');
  assert.match(content, /lfDb\.adminVerifyPin\(/, 'Must verify PIN hash via server RPC');

  // Zero PII and zero plain PIN checks
  assert.doesNotMatch(content, /@gmail\.com/i, 'settingsView.js must not contain personal email');
  assert.doesNotMatch(content, /\b\d{6}\b/, 'settingsView.js must not contain hardcoded 6-digit PIN');
});

test('dashboard/js/ui/adminView.js protects against unauthorized access with zero PII', () => {
  const adminViewPath = path.join(ROOT, 'dashboard', 'js', 'ui', 'adminView.js');
  assert.ok(fs.existsSync(adminViewPath), 'adminView.js must exist');

  const content = fs.readFileSync(adminViewPath, 'utf8');
  assert.match(content, /lfDb\.isAdmin\(\)/, 'adminView must verify isAdmin()');
  assert.match(content, /btn-admin-reset-my-deck/, 'Must have button to reset own deck');
  assert.match(content, /btn-admin-reset-all-decks/, 'Must have button to reset all decks');
  assert.match(content, /LIMPAR TUDO/, 'Must require typed confirmation phrase for resetting all decks');
  assert.match(content, /admin-user-search/, 'Must have user search input');

  assert.doesNotMatch(content, /@gmail\.com/i, 'adminView.js must not contain personal email');
});

test('Security Hardening: Migration revokes public/anon and implements lockout', () => {
  const migPath = path.join(ROOT, 'supabase', 'migrations', '20260913110000_harden_admin_security.sql');
  assert.ok(fs.existsSync(migPath), 'Hardening migration must exist');

  const content = fs.readFileSync(migPath, 'utf8');
  assert.match(content, /REVOKE ALL ON FUNCTION public\.admin_verify_pin\(text\) FROM PUBLIC, anon;/i, 'Must revoke public/anon execution on admin_verify_pin');
  assert.match(content, /REVOKE ALL ON FUNCTION public\.admin_reset_all_decks\(\) FROM PUBLIC, anon;/i, 'Must revoke public/anon execution on admin_reset_all_decks');
  assert.match(content, /admin_pin_attempts/, 'Must create admin_pin_attempts table for rate limiting');
  assert.match(content, /locked_until/, 'Must track locked_until for lockout');
});

test('Security Hardening: Service Worker blocks admin calls from untrusted web contexts', () => {
  const swPath = path.join(ROOT, 'background', 'service-worker.js');
  const content = fs.readFileSync(swPath, 'utf8');

  assert.match(content, /ADMIN_SCOPE_VIOLATION/, 'Service worker must reject admin methods from non-extension pages');
  assert.match(content, /startsWith\(chrome\.runtime\.getURL\(''\)\)/, 'Must verify internal extension origin for admin methods');
});

test('Security Architecture: Server-enforced admin session tokens and zero credential seed in migrations', () => {
  const migPath = path.join(ROOT, 'supabase', 'migrations', '20260913113000_admin_session_token_and_lockout_fix.sql');
  assert.ok(fs.existsSync(migPath), 'Session token fix migration must exist');

  const migContent = fs.readFileSync(migPath, 'utf8');
  assert.match(migContent, /public\.admin_sessions/, 'Must create admin_sessions table');
  assert.match(migContent, /admin_assert_session/, 'Must implement admin_assert_session helper');
  assert.match(migContent, /REVOKE ALL ON FUNCTION public\.admin_reset_all_decks\(uuid\) FROM PUBLIC, anon;/i, 'Must revoke all on admin_reset_all_decks(uuid)');

  // Verify zero credential seeds in 20260913100000_admin_authority_rpcs.sql
  const initialMigPath = path.join(ROOT, 'supabase', 'migrations', '20260913100000_admin_authority_rpcs.sql');
  const initialContent = fs.readFileSync(initialMigPath, 'utf8');
  assert.doesNotMatch(initialContent, /INSERT INTO public\.admin_config/i, 'Must not seed credentials in initial migration');

  // Verify utils/db.js passes session token
  const dbPath = path.join(ROOT, 'utils', 'db.js');
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  assert.match(dbContent, /_getAdminSessionToken\(\)/, 'db.js must retrieve admin session token');
  assert.match(dbContent, /p_session_token:\s*this\._getAdminSessionToken\(\)/, 'db.js must pass p_session_token to admin RPCs');
});


