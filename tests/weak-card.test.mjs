// Issue #338 — "palavra fraca" tem uma única definição, compartilhada por
// site e extensão.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WEAK_LAPSES, isWeakCard } from '../utils/weak-card.js';
import { isWeakCard as queueIsWeak } from '../dashboard/js/core/sessionQueue.js';
import { deriveAdaptivePlan } from '../dashboard/js/core/adaptiveLearning.js';

assert.equal(WEAK_LAPSES, 2);
assert.equal(isWeakCard({ lapses: 2 }), true);
assert.equal(isWeakCard({ lapses: 1 }), false);
assert.equal(isWeakCard({ lapses: 0, is_leech: true }), true);
assert.equal(isWeakCard(null), false);
assert.equal(queueIsWeak, isWeakCard, 'sessionQueue reexporta a mesma função');
assert.equal(deriveAdaptivePlan({ lapses: 2 }).recovering, true, 'modo de recuperação segue a regra única');
assert.equal(deriveAdaptivePlan({ lapses: 1 }).recovering, false);

const files = [
  'dashboard/js/core/sessionQueue.js',
  'dashboard/js/core/adaptiveLearning.js',
  'dashboard/js/ui/storiesView.js',
  'background/ai-generator.js',
];
for (const file of files) {
  const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(!/lapses \|\| 0\) >= \d/.test(src), `${file} não pode redefinir o limite de palavra fraca`);
  assert.ok(/weak-card\.js'/.test(src), `${file} deve usar utils/weak-card.js`);
}

console.log('weak-card: ok');
