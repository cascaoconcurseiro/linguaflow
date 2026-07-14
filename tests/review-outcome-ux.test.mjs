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
assert.match(db, /outcome: idempotent \? 'duplicate' : 'accepted'/);
assert.match(db, /persisted: true/);
assert.match(db, /xpAwarded: idempotent \? 0/);
assert.match(db, /response\.errorKind/);
assert.match(worker, /errorRetryable: Boolean\(error\?\.retryable\)/);

assert.match(overlay, /if \(this\._answerBusy \|\| !this\._currentCard\) return/);
assert.match(overlay, /operation\.operationId/);
assert.match(overlay, /if \(!result\?\.persisted\) throw/);
assert.match(overlay, /A avaliação não foi salva; este card continua aqui/);
assert.match(overlay, /aria-live="polite"/);
const answerBody = overlay.slice(overlay.indexOf('async _answer'), overlay.indexOf('\n  destroy()', overlay.indexOf('async _answer')));
assert.ok(answerBody.indexOf('this.index++') > answerBody.indexOf('await this._db.logReview'));
assert.ok(answerBody.indexOf('this.index++') < answerBody.indexOf('} catch (e)'));

assert.match(study, /pendingReviewOperations/);
assert.match(study, /operation\.operationId/);
assert.match(study, /pendingReviewOperations\.delete\(gradedCard\.id\)/);
assert.match(study, /A avaliação não foi salva; este card continua aqui/);
assert.match(app, /toast\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
assert.match(app, /toast\.setAttribute\('aria-live'/);

console.log('Review outcome UX contracts passed.');
