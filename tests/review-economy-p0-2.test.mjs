#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL(
  '../supabase/migrations/20260714171353_card_review_evidence_expand_p0_2a.sql',
  import.meta.url,
), 'utf8');

function functionSql(name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = sql.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `${name} body must be complete`);
  return sql.slice(start, end + 4);
}

let passed = 0;
function check(condition, message) {
  assert.ok(condition, message);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

const review = functionSql('record_card_review');
const undo = functionSql('revert_card_review');

console.log('P0.2 review economy and pedagogy');

check(/p_quality\s+smallint[\s\S]+p_client_review_id\s+uuid/i.test(review),
  'review RPC preserves the compatible operation-id signature');
check(/p_quality NOT BETWEEN 1 AND 4/.test(review),
  'all and only the four honest grades are accepted');
check(/'card_review',\s*10,\s*true,\s*300/.test(review),
  'every eligible grade uses the same 10 XP and 300 XP competitive cap');
check(!/CASE\s+p_quality|p_quality\s*=\s*[1-4]/i.test(review),
  'quality never branches the XP amount');
check(/FOR UPDATE/.test(review) && /user_stats[\s\S]+FOR UPDATE[\s\S]+public\.cards[\s\S]+FOR UPDATE/i.test(review),
  'user and card locks serialize quota, cap, and state changes');

const dueGuard = review.indexOf("v_card.due_date > v_now + interval '30 seconds'");
const newBranch = review.indexOf("v_card.status = 'new'");
check(dueGuard !== -1 && newBranch !== -1 && dueGuard < newBranch,
  'a buried/future new card is rejected before new-card admission');
check(/FROM public\.learning_events[\s\S]+event_type\s*=\s*'card_reviewed'[\s\S]+eligibility_reason\s*=\s*'due_new'[\s\S]+local_date\s*=\s*v_today/i.test(review),
  '20-new quota counts immutable qualified introductions, including undone ones');
check(/v_new_today\s*>=\s*20[\s\S]+new_daily_limit/i.test(review),
  'the 21st new card is ineligible and cannot mutate');
check(!/p_state->>'suspended'/.test(review),
  'review payload cannot smuggle a suspend mutation');
check(/IF v_eligible THEN[\s\S]+UPDATE public\.cards/i.test(review),
  'only eligible evidence mutates the scheduler state');
check(/v_existing\.eligible[\s\S]+THEN 'duplicate'[\s\S]+ELSE 'ineligible'/i.test(review),
  'retry preserves the original ineligible outcome instead of advancing');
check(/card_review_attempt:v2:/.test(review) && /card_review:v2:/.test(review),
  'attempt and card/day idempotency keys are independent');
check(/v_stats_before\s*:=\s*jsonb_build_object/.test(review)
  && /v_stats_before,[\s\S]+v_event_id/.test(review),
  'undo snapshot is captured before any XP or streak projection');
check(/IF v_eligible AND v_xp = 0 THEN/.test(review)
  && /last_study_date = v_today/.test(review),
  'qualified zero-XP review still sustains streak without minting currency');
check(/'stats',\s*v_stats_current/.test(review),
  'RPC returns the current projection after zero-XP streak reconciliation');
check(/DROP TRIGGER IF EXISTS trigger_calculate_xp/.test(sql),
  'legacy XP trigger is removed at the atomic cutover');

check(/CREATE TABLE public\.card_review_undos/.test(sql)
  && /ALTER TABLE public\.card_review_undos ENABLE ROW LEVEL SECURITY/.test(sql),
  'undo is append-only, owned, and protected by RLS');
const undoBody = undo.slice(undo.indexOf('AS $$'));
check(!/p_previous_card/.test(undoBody),
  'undo never trusts the browser snapshot');
check(/only_latest_review_can_be_undone/.test(undo)
  && /newer_accounting_activity_prevents_undo/.test(undo),
  'undo cannot erase intervening review or accounting activity');
check(/newer_stats_activity_prevents_undo/.test(undo)
  && /stats_revision_after/.test(undo),
  'undo cannot overwrite non-ledger stats activity with a stale snapshot');
check(/entry_type, reason, amount/i.test(undo)
  && /reverses_entry_id/i.test(undo)
  && /-v_award\.amount/i.test(undo),
  'undo appends one exact ledger reversal');
check(!/DELETE\s+FROM/i.test(undo),
  'undo never deletes review, evidence, or reward history');
check(/card_review_reversal:v2:/.test(undo)
  && /INSERT INTO public\.card_review_undos/.test(undo),
  'undo reversal and audit fact are idempotently identifiable');

console.log(`\n${passed} P0.2 economy contracts passed.`);
