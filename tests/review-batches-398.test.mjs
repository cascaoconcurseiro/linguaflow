import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewBatchPlan } from '../dashboard/js/core/reviewBatches.js';

test('plano de sessão', () => {
  assert.deepEqual(reviewBatchPlan(0), { full: 0, quick: 0, backlog: false });
  assert.deepEqual(reviewBatchPlan(8), { full: 8, quick: 0, backlog: false });
  assert.deepEqual(reviewBatchPlan(25), { full: 20, quick: 10, backlog: false });
  assert.deepEqual(reviewBatchPlan(89), { full: 20, quick: 10, backlog: true });
  assert.deepEqual(reviewBatchPlan('x'), { full: 0, quick: 0, backlog: false });
});

test('tela de revisão oferece sessão rápida e alivia atraso', () => {
  const src = readFileSync(new URL('../dashboard/js/ui/courses/courseNotebooks.js', import.meta.url), 'utf8');
  assert.match(src, /reviewBatchPlan\(due\.length\)/);
  assert.match(src, /data-practice-quick/);
  assert.match(src, /Sessão rápida/);
  assert.match(src, /plan\.backlog/);
});
