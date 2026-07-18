import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260718203504_production_least_privilege.sql', 'utf8');
const authenticatedGrants = readFileSync('supabase/migrations/20260718203916_production_authenticated_grants.sql', 'utf8');
const emailFunction = readFileSync('supabase/functions/email-reengagement/index.ts', 'utf8');
const pushFunction = readFileSync('supabase/functions/push-reminder/index.ts', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

for (const table of [
  'api_usage_log', 'card_review_undos', 'cards', 'client_errors', 'known_words',
  'learning_events', 'push_subscriptions', 'reader_texts', 'review_log',
  'sentences', 'sessions', 'settings', 'stories', 'translation_cache',
  'user_stats', 'words', 'xp_ledger',
]) {
  assert.match(migration, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public,\\s*anon`, 'i'));
}
assert.match(migration, /grant\s+select\s+on\s+table\s+public\.keep_alive\s+to\s+anon/i);
assert.match(migration, /alter\s+function\s+public\.ensure_user_stats[\s\S]*set\s+search_path\s*=\s*''/i);
assert.match(authenticatedGrants, /revoke\s+all\s+on\s+table\s+public\.api_usage_log\s+from\s+authenticated/i);
assert.doesNotMatch(authenticatedGrants, /grant[\s\S]*api_usage_log[\s\S]*to\s+authenticated/i);
assert.match(authenticatedGrants, /revoke\s+all\s+on\s+table\s+public\.client_errors\s+from\s+authenticated/i);
assert.match(authenticatedGrants, /grant\s+insert\s+on\s+table\s+public\.client_errors\s+to\s+authenticated/i);
assert.match(authenticatedGrants, /revoke\s+all\s+on\s+table\s+public\.league_meta\s+from\s+public,\s*anon,\s*authenticated/i);
assert.match(authenticatedGrants, /grant\s+select\s+on\s+table\s+public\.league_meta\s+to\s+authenticated/i);

assert.match(emailFunction, /https:\/\/linguaflow-web-tau\.vercel\.app\/study/);
assert.doesNotMatch(emailFunction, /https:\/\/linguaflow\.vercel\.app/);
assert.doesNotMatch(pushFunction, /wesley\.lima@/i);

const headers = Object.fromEntries(
  (vercel.headers || []).flatMap((rule) => rule.headers || []).map(({ key, value }) => [key.toLowerCase(), value]),
);
assert.equal(headers['x-content-type-options'], 'nosniff');
assert.equal(headers['x-frame-options'], 'DENY');
assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
assert.match(headers['permissions-policy'] || '', /microphone=\(self\)/);

assert.match(releaseWorkflow, /timeout-minutes:/);
assert.match(releaseWorkflow, /npm audit --omit=dev --audit-level=high/);
assert.match(packageJson.scripts['test:release'], /production-readiness\.test\.mjs/);

console.log('30 contratos de prontidão para produção passaram ✅');
