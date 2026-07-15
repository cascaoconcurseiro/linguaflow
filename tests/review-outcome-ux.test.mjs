import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [db, overlay, study, app, worker] = await Promise.all([
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/review-overlay.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8'),
]);

assert.match(db, /export function createOperationId/);
assert.match(db, /logReview\(cardId, quality, category, plannedState = null, operationId = null\)/);
assert.match(db, /operationId \|\| createOperationId\(\)/);
assert.match(db, /outcome:\s*saved\?\.outcome/,
  'Database adapter must preserve the authoritative RPC outcome');
assert.match(db, /eligibilityReason:\s*saved\?\.eligibility_reason/);
assert.match(db, /rewardReason:\s*saved\?\.reward_reason/);
assert.match(db, /persisted: true/);
assert.match(db, /xpAwarded: idempotent \? 0/);
assert.match(db, /response\.errorKind/);
assert.match(worker, /errorRetryable: Boolean\(error\?\.retryable\)/);

assert.match(overlay, /if \(this\._answerBusy \|\| !this\._currentCard\) return/);
assert.match(overlay, /operation\.operationId/);
assert.match(overlay, /if \(!result\?\.persisted\) throw/);
assert.match(overlay, /result\?\.outcome === 'ineligible'/,
  'Quick review must branch before treating an ineligible result as success');
assert.match(overlay, /stale_card_state[\s\S]+await this\._loadCards\(\)/,
  'Quick review refetches authoritative cards after stale state');
assert.match(overlay, /\['not_due', 'new_daily_limit', 'suspended'\][\s\S]+this\.cards\.splice/,
  'Quick review reconciles authoritatively ineligible cards without grading them');
assert.match(overlay, /A avaliação não foi salva; este card continua aqui/);
assert.match(overlay, /aria-live="polite"/);
const answerBody = overlay.slice(overlay.indexOf('async _answer'), overlay.indexOf('\n  destroy()', overlay.indexOf('async _answer')));
assert.ok(answerBody.indexOf('this.index++') > answerBody.indexOf('await this._db.logReview'));
assert.ok(answerBody.indexOf('this.index++') < answerBody.indexOf('} catch (e)'));

assert.match(study, /pendingReviewOperations/);
assert.match(study, /res\?\.outcome === 'ineligible'/,
  'Study must reconcile an ineligible result before the success path');
const ineligibleBody = study.slice(
  study.indexOf("if (res?.outcome === 'ineligible')"),
  study.indexOf('if (liveStatus) liveStatus.textContent = res.idempotent', study.indexOf("if (res?.outcome === 'ineligible')")),
);
assert.match(ineligibleBody, /app\.navigate\('study'\)/,
  'stale scheduler state forces an authoritative queue refetch');
assert.match(ineligibleBody, /\['not_due', 'new_daily_limit', 'suspended'\][\s\S]+dueQueue/,
  'not-due, capped-new, and suspended cards leave only the current due queue');
assert.doesNotMatch(ineligibleBody, /sessionCards\+\+|sessionXp|showXPAnimation|playFeedbackSound/,
  'ineligible reconciliation never counts a session answer, XP, or feedback success');
assert.match(study, /operation\.operationId/);
assert.match(study, /pendingReviewOperations\.delete\(gradedCard\.id\)/);
assert.match(study, /A avaliação não foi salva; este card continua aqui/);
assert.match(app, /toast\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
assert.match(app, /toast\.setAttribute\('aria-live'/);

console.log('Review outcome UX contracts passed.');
