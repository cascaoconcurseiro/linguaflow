import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const migrationName = readdirSync(join(root, 'supabase', 'migrations'))
  .find((name) => name.includes('learning_task_attempts') && name.endsWith('.sql'));

assert.ok(migrationName, 'migration expand-only de learning_task_attempts existe');
const sql = read(`supabase/migrations/${migrationName}`);
const db = read('utils/db.js');
const app = read('dashboard/js/core/app.js');
const progress = read('dashboard/js/ui/progressView.js');
const view = read('dashboard/js/ui/fluencyCheckView.js');
const sqlGate = read('tests/db/learning-task-attempts.sql');
const migrationReplay = read('tests/db/validate-migrations.sh');

assert.match(sql, /create table public\.learning_task_attempts/i);
assert.match(sql, /alter table public\.learning_task_attempts enable row level security/i);
assert.match(sql, /unique\s*\(user_id,\s*client_attempt_id\)/i);
assert.match(sql, /check\s*\(task_type in\s*\(/i);
assert.match(sql, /check\s*\(skill in\s*\(/i);
assert.match(sql, /pg_column_size\(evidence\)\s*<=\s*16384/i);
assert.match(sql, /task_completion between 0 and 3/i);
assert.match(sql, /jsonb_object_keys\(v_evidence\)/i);
assert.match(sql, /unsupported_attempt_metadata/i);
assert.match(sql, /occurred_at_out_of_range/i);
assert.match(sql, /create index learning_task_attempts_user_occurred_idx/i);
assert.match(sql, /create index learning_task_attempts_user_skill_occurred_idx/i);
assert.match(sql, /create policy learning_task_attempts_select_own/i);
assert.match(sql, /revoke all on table public\.learning_task_attempts from public, anon, authenticated/i);
assert.match(sql, /grant select on table public\.learning_task_attempts to authenticated/i);
assert.match(sql, /create or replace function public\.record_learning_task_attempt/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = ''/i);
assert.match(sql, /on conflict \(user_id, client_attempt_id\) do nothing/i);
assert.match(sql, /idempotency_conflict/i);
assert.match(
  sql,
  /revoke all on function public\.record_learning_task_attempt\(uuid, jsonb\)[\s\S]*from public, anon, authenticated, service_role/i,
);
assert.match(sql, /grant execute on function public\.record_learning_task_attempt\(uuid, jsonb\) to authenticated/i);
assert.doesNotMatch(sql, /insert into public\.(review_log|learning_events|xp_ledger|user_stats)/i);
assert.doesNotMatch(sql, /references public\.(cards|review_log|learning_events|xp_ledger|user_stats)/i);
assert.match(sqlGate, /replay divergente foi aceito/i);
assert.match(sqlGate, /resposta livre foi aceita/i);
assert.match(sqlGate, /RLS não isolou tentativas/i);
assert.match(sqlGate, /contaminou SRS ou economia/i);
assert.match(migrationReplay, /tests\/db\/learning-task-attempts\.sql/);

assert.match(db, /async recordLearningTaskAttempt\(/);
assert.match(db, /rpc\/record_learning_task_attempt/);
assert.match(db, /async getLatestLearningTaskAttempt\(/);
assert.match(db, /learning_task_attempts\?select=/);

assert.match(app, /import \{ renderFluencyCheck \} from '\.\.\/ui\/fluencyCheckView\.js'/);
assert.match(app, /'fluency-check': renderFluencyCheck/);
assert.match(app, /const progressRoutes = new Set\(\[[^\]]*'fluency-check'/);
assert.match(progress, /route: 'fluency-check'/);
assert.ok(
  progress.indexOf("route: 'fluency-check'") < progress.indexOf("route: 'stats'"),
  'evidência de uso real aparece antes de memória e liga',
);

assert.match(view, /renderViewState/);
assert.match(view, /<main[^>]*aria-labelledby=/);
assert.match(view, /aria-busy/);
assert.match(view, /não altera (?:o )?FSRS, XP, ofensiva ou liga/i);
assert.match(view, /data-fluency-start/);
assert.match(view, /app\.onLeaveView/);
assert.doesNotMatch(view, /autoplay/i);
assert.doesNotMatch(view, /Você é [AB][12]/i);

console.log('Contrato vertical da fundação de fluência passou.');
