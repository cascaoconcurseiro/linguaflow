import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const migrationName = readdirSync(migrationsDir)
  .find((name) => name.includes('fluency_assessment_authority') && name.endsWith('.sql'));

assert.ok(migrationName, 'migration de autoridade da avaliação de fluência existe');
const sql = readFileSync(join(migrationsDir, migrationName), 'utf8');
const migrationChain = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
  .join('\n');

for (const table of [
  'private.fluency_task_catalog',
  'private.fluency_task_responses',
  'public.fluency_task_issues',
  'public.fluency_task_submissions',
  'public.fluency_skill_profiles',
]) {
  assert.match(sql, new RegExp(`create table ${table.replace('.', '\\.')}`, 'i'));
}

assert.match(sql, /answer_key jsonb not null/i);
assert.match(sql, /rubric jsonb not null/i);
assert.match(sql, /revoke all on table private\.fluency_task_catalog/i);
assert.match(sql, /revoke all on table private\.fluency_task_responses/i);
assert.match(sql, /alter table public\.fluency_task_issues enable row level security/i);
assert.match(sql, /alter table public\.fluency_task_submissions enable row level security/i);
assert.match(sql, /alter table public\.fluency_skill_profiles enable row level security/i);
assert.match(sql, /create policy fluency_task_issues_select_own/i);
assert.match(sql, /create policy fluency_task_submissions_select_own/i);
assert.match(sql, /create policy fluency_skill_profiles_select_own/i);

assert.match(sql, /create or replace function public\.issue_fluency_task/i);
assert.match(sql, /create or replace function public\.submit_fluency_task/i);
assert.match(sql, /create or replace function public\.get_fluency_submission_for_assessment/i);
assert.match(sql, /create or replace function public\.commit_fluency_assessment/i);
assert.match(sql, /grant execute on function public\.issue_fluency_task[\s\S]*to authenticated/i);
assert.match(sql, /grant execute on function public\.submit_fluency_task[\s\S]*to authenticated/i);
assert.match(sql, /grant execute on function public\.get_fluency_submission_for_assessment[\s\S]*to service_role/i);
assert.match(sql, /grant execute on function public\.commit_fluency_assessment[\s\S]*to service_role/i);
assert.doesNotMatch(
  sql,
  /grant execute on function public\.(?:get_fluency_submission_for_assessment|commit_fluency_assessment)[\s\S]{0,180}to authenticated/i,
);

assert.match(sql, /on conflict \(user_id, client_issue_id\) do nothing/i);
assert.match(sql, /on conflict \(user_id, client_submission_id\) do nothing/i);
assert.match(sql, /issue_idempotency_conflict/i);
assert.match(sql, /submission_idempotency_conflict/i);
assert.match(sql, /assessment_idempotency_conflict/i);
assert.match(sql, /evaluation_authority[\s\S]*authoritative/i);
assert.match(sql, /v_meets_level and v_task_completion < 2/i);
assert.match(sql, /v_distinct_days >= 2/i);
assert.match(sql, /v_task_families >= 2/i);
assert.match(sql, /v_span_days >= 21/i);
assert.match(sql, /v_recent_passes >= 4/i);
assert.match(sql, /v_latest_pass/i);
assert.match(sql, /'fluency-assessment'/i);
assert.match(sql, /pg_advisory_xact_lock/i);
assert.match(sql, /grant execute on function public\.consume_api_quota\(uuid, text, integer, integer\)[\s\S]*to service_role/i);
assert.match(sql, /insert into public\.learning_task_attempts/i);
assert.match(sql, /insert into public\.fluency_skill_profiles/i);
assert.doesNotMatch(sql, /insert into public\.(?:review_log|learning_events|xp_ledger|user_stats|cards)/i);
assert.doesNotMatch(sql, /update public\.(?:review_log|learning_events|xp_ledger|user_stats|cards)/i);
assert.match(
  migrationChain,
  /create index(?: if not exists)? fluency_task_responses_issue_id_idx\s+on private\.fluency_task_responses\s*\(issue_id\)/i,
);
assert.match(
  migrationChain,
  /create index(?: if not exists)? fluency_task_submissions_attempt_id_idx\s+on public\.fluency_task_submissions\s*\(attempt_id\)/i,
);

const gate = readFileSync(join(root, 'tests', 'db', 'fluency-assessment-authority.sql'), 'utf8');
assert.match(gate, /gabarito privado vazou/i);
assert.match(gate, /submissão divergente foi aceita/i);
assert.match(gate, /avaliação duplicada inflou o perfil/i);
assert.match(gate, /perfil não ficou provável/i);
assert.match(gate, /perfil não ficou consistente/i);
assert.match(gate, /task_completion baixo foi aceito como aprovação/i);
assert.match(gate, /contaminou fsrs ou xp/i);

console.log('Contrato de catálogo privado e autoridade de fluência passou.');
