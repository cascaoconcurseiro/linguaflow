import assert from 'node:assert/strict';
import { deriveAdaptivePlan, nextAdaptiveProfile, normalizeLearningSignal } from '../dashboard/js/core/adaptiveLearning.js';

assert.equal(deriveAdaptivePlan({ lapses: 0 }).mode, 'normal');
assert.equal(deriveAdaptivePlan({ lapses: 3 }).mode, 'word_focus');
assert.equal(normalizeLearningSignal({ correct: true, responseMs: 5000 }).unaided, true);
assert.equal(normalizeLearningSignal({ correct: true, helpCount: 1 }).unaided, false);
assert.equal(nextAdaptiveProfile({}, { correct: false }).recovery_stage, 1);
assert.equal(nextAdaptiveProfile({ recovery_stage: 1 }, { abandoned: true }).recovery_stage, 2);
assert.equal(nextAdaptiveProfile({ recovery_stage: 2 }, { correct: true, responseMs: 5000 }).recovery_stage, 2);
assert.equal(nextAdaptiveProfile({ recovery_stage: 2, unaided_success_streak: 1 }, { correct: true, responseMs: 5000 }).recovery_stage, 1);
assert.equal(nextAdaptiveProfile({ recovery_stage: 1, unaided_success_streak: 1 }, { correct: true, responseMs: 5000 }).recovery_stage, 0);
console.log('Motor adaptativo: 9 testes passaram ✅');
