import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const db = readFileSync(new URL('../utils/db.js', import.meta.url), 'utf8');

for (const method of [
  'issueFluencyTask',
  'submitFluencyTask',
  'assessFluencySubmission',
  'getFluencyProfiles',
  'getFluencyCheckStatus',
  'getFluencyCheckDraft',
  'saveFluencyCheckDraft',
  'clearFluencyCheckDraft',
  'submitFluencyCheck',
]) {
  assert.match(db, new RegExp(`async ${method}\\(`), `${method} existe`);
}

assert.match(db, /rpc\/issue_fluency_task/);
assert.match(db, /rpc\/submit_fluency_task/);
assert.match(db, /functions\/v1\/fluency-assessment/);
assert.match(db, /fluency_skill_profiles\?select=/);
assert.match(db, /lf_fluency_check_draft_v1/);
assert.match(db, /client_submission_id/);
assert.match(db, /p_client_issue_id/);
assert.match(db, /p_client_submission_id/);
assert.match(db, /for \(const record of records\)/);
assert.doesNotMatch(db, /Promise\.all\(records\.map[\s\S]{0,500}assessFluencySubmission/);

console.log('Contrato do cliente de fluência passou.');
