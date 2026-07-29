import assert from 'node:assert/strict';
import {
  FLUENCY_LEVELS,
  FLUENCY_SKILLS,
  decideFluencyAttempt,
  evidenceStrength,
  getFluencyDescriptor,
  isFluencyCheckDue,
} from '../dashboard/js/core/fluencyCheck.js';

assert.deepEqual(FLUENCY_LEVELS, ['A1', 'A2', 'B1', 'B2']);
assert.deepEqual(FLUENCY_SKILLS, [
  'listening',
  'speaking_spontaneous',
  'writing',
  'interaction',
]);

for (const level of FLUENCY_LEVELS) {
  for (const skill of FLUENCY_SKILLS) {
    const descriptor = getFluencyDescriptor(level, skill);
    assert.equal(descriptor.level, level);
    assert.equal(descriptor.skill, skill);
    assert.ok(descriptor.canDo.length >= 20);
    assert.ok(descriptor.taskFamily.length >= 3);
  }
}

assert.throws(() => getFluencyDescriptor('C2', 'writing'), /nível/i);
assert.throws(() => getFluencyDescriptor('A2', 'mediation'), /habilidade/i);

const meets = decideFluencyAttempt({
  targetLevel: 'A2',
  valid: true,
  assistanceExceeded: false,
  dimensions: {
    task_completion: 2,
    comprehensibility: 2,
    fluency: 2,
    linguistic_control: 2,
  },
  criticalDimensions: ['task_completion', 'comprehensibility'],
});
assert.equal(meets.meetsLevel, true);
assert.equal(meets.observedLevel, 'A2');
assert.equal(meets.median, 2);

const eloquentButOffTask = decideFluencyAttempt({
  targetLevel: 'B1',
  valid: true,
  assistanceExceeded: false,
  dimensions: {
    task_completion: 0,
    comprehensibility: 3,
    fluency: 3,
    linguistic_control: 3,
  },
  criticalDimensions: ['task_completion', 'comprehensibility'],
});
assert.equal(eloquentButOffTask.meetsLevel, false);
assert.equal(eloquentButOffTask.observedLevel, null);
assert.match(eloquentButOffTask.reasons.join(' '), /crítica/i);

const contaminated = decideFluencyAttempt({
  targetLevel: 'B2',
  valid: false,
  assistanceExceeded: false,
  dimensions: { task_completion: 3, comprehensibility: 3, fluency: 3 },
  criticalDimensions: ['task_completion'],
});
assert.equal(contaminated.meetsLevel, false);
assert.match(contaminated.reasons.join(' '), /inválida/i);

const overAssisted = decideFluencyAttempt({
  targetLevel: 'B1',
  valid: true,
  assistanceExceeded: true,
  dimensions: { task_completion: 3, comprehensibility: 3, fluency: 3 },
  criticalDimensions: ['task_completion'],
});
assert.equal(overAssisted.meetsLevel, false);
assert.match(overAssisted.reasons.join(' '), /ajuda/i);

assert.throws(
  () => decideFluencyAttempt({
    targetLevel: 'A1',
    valid: true,
    dimensions: { task_completion: 4 },
    criticalDimensions: ['task_completion'],
  }),
  /0 a 3/i,
);
assert.throws(
  () => decideFluencyAttempt({
    targetLevel: 'A2',
    valid: true,
    dimensions: { task_completion: 2 },
    criticalDimensions: ['task_completion', 'comprehensibility'],
  }),
  /crítica ausente/i,
);

assert.equal(evidenceStrength([]).status, 'sem_evidencia');
assert.equal(evidenceStrength([
  { valid: true, meetsLevel: true, occurredAt: '2026-07-01T10:00:00Z', taskFamily: 'message' },
]).status, 'amostra_inicial');
assert.equal(evidenceStrength([
  { valid: true, meetsLevel: true, occurredAt: '2026-07-01T10:00:00Z', taskFamily: 'message' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-02T10:00:00Z', taskFamily: 'request' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-02T11:00:00Z', taskFamily: 'request' },
]).status, 'provavel');
assert.equal(evidenceStrength([
  { valid: true, meetsLevel: false, occurredAt: '2026-07-01T10:00:00Z', taskFamily: 'message' },
  { valid: true, meetsLevel: false, occurredAt: '2026-07-02T10:00:00Z', taskFamily: 'request' },
  { valid: true, meetsLevel: false, occurredAt: '2026-07-03T10:00:00Z', taskFamily: 'request' },
]).status, 'amostra_inicial');
assert.equal(evidenceStrength([
  { valid: true, meetsLevel: true, occurredAt: '2026-07-01T10:00:00Z', taskFamily: 'message' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-05T10:00:00Z', taskFamily: 'request' },
  { valid: true, meetsLevel: false, occurredAt: '2026-07-10T10:00:00Z', taskFamily: 'narrative' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-15T10:00:00Z', taskFamily: 'message' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-20T10:00:00Z', taskFamily: 'request' },
  { valid: true, meetsLevel: true, occurredAt: '2026-07-22T10:00:00Z', taskFamily: 'narrative' },
]).status, 'consistente');

const now = new Date('2026-07-28T12:00:00Z');
assert.equal(isFluencyCheckDue(null, now), true);
assert.equal(isFluencyCheckDue('2026-07-20T11:59:59Z', now), true);
assert.equal(isFluencyCheckDue('2026-07-22T12:00:00Z', now), false);
assert.equal(isFluencyCheckDue('invalid-date', now), true);
assert.equal(isFluencyCheckDue('2026-08-22T12:00:00Z', now), true);

console.log('Motor de contrato de fluência passou.');
