import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_contain_translation_cache_free_tier.sql'));

assert.ok(migrationName, 'migration de contenção do translation_cache ausente');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
const dbTest = fs.readFileSync(
  path.join(root, 'tests', 'db', 'translation-cache-budget.sql'),
  'utf8',
);
const replay = fs.readFileSync(
  path.join(root, 'tests', 'db', 'validate-migrations.sh'),
  'utf8',
);

assert.match(sql, /create index if not exists translation_cache_created_at_idx/i);
assert.match(sql, /translation_cache_user_recency_idx[\s\S]*user_id, created_at desc, id desc/i);
assert.match(sql, /revoke all on table public\.translation_cache from public, anon, authenticated/i);
assert.match(sql, /grant select, insert, update, delete[\s\S]*to authenticated/i);
assert.doesNotMatch(sql, /grant\s+truncate[\s\S]*to\s+authenticated/i);

for (const operation of ['select', 'insert', 'update', 'delete']) {
  assert.match(
    sql,
    new RegExp(`create policy "translation_cache_${operation}_own"`, 'i'),
    `policy estreita de ${operation} ausente`,
  );
}
assert.match(sql, /drop policy if exists "Users see own cache"/i);

assert.match(sql, /create or replace function private\.prune_translation_cache/i);
assert.match(sql, /security definer\s+set search_path = ''/i);
assert.match(sql, /pg_try_advisory_xact_lock/i);
assert.match(sql, /for update skip locked/i);
assert.match(sql, /row_number\(\) over[\s\S]*partition by c\.user_id/i);
assert.match(sql, /p_max_rows_per_user integer default 5000/i);

assert.match(sql, /create trigger translation_cache_enforce_budget/i);
assert.match(sql, /pg_advisory_xact_lock/i);
assert.match(sql, /referencing new table as inserted_rows\s+for each statement/i);
assert.match(sql, /select distinct inserted\.user_id\s+from inserted_rows/i);
assert.doesNotMatch(sql, /for each row execute function private\.enforce_translation_cache_budget/i);
assert.match(sql, /order by overflow\.created_at desc, overflow\.id desc\s+offset 5000/i);
assert.match(sql, /interval '30 days'/i);

assert.match(sql, /revoke all on function private\.prune_translation_cache[\s\S]*authenticated/i);
assert.match(sql, /revoke all on function public\.prune_translation_cache[\s\S]*authenticated/i);
assert.match(sql, /cron\.unschedule\('translation-cache-prune'\)/i);
assert.match(sql, /cron\.schedule\([\s\S]*'translation-cache-prune'[\s\S]*'17 3 \* \* \*'/i);
assert.doesNotMatch(
  sql.slice(sql.indexOf('do $schedule_translation_cache_prune$')),
  /exception\s+when\s+others/i,
  'falha de cron não pode ser engolida quando pg_cron existe',
);

assert.match(dbTest, /v_count <> 5000/i);
assert.match(dbTest, /cache_key = 'budget-test-1'/i);
assert.match(dbTest, /excedeu 15s para 5\.001 linhas/i);
assert.match(dbTest, /has_function_privilege[\s\S]*authenticated/i);
assert.match(dbTest, /jobname = 'translation-cache-prune'/i);
assert.match(replay, /translation-cache-budget\.sql/);

console.log('translation-cache-budget-contract: ok');
