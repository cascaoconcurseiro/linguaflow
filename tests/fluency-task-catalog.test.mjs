import assert from 'node:assert/strict';
import {
  CATALOG_VERSION,
  FLUENCY_TASK_CATALOG,
  RUBRIC_VERSION,
  calculateTransferOverlap,
  getTaskFamilies,
  validateTaskCandidate,
  validateTaskCatalog,
} from '../dashboard/js/core/fluencyTaskCatalog.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const SKILLS = ['listening', 'speaking_spontaneous', 'writing', 'interaction'];

assert.match(CATALOG_VERSION, /^\d{4}\.\d{2}\.\d+$/);
assert.match(RUBRIC_VERSION, /^fluency-rubric-v\d+$/);
assert.equal(validateTaskCatalog(FLUENCY_TASK_CATALOG).valid, true);

for (const level of LEVELS) {
  for (const skill of SKILLS) {
    const families = getTaskFamilies(level, skill);
    assert.ok(families.length >= 2, `${level}/${skill} precisa de ao menos duas famílias`);
    assert.equal(new Set(families.map((task) => task.family)).size, families.length);

    for (const task of families) {
      assert.equal(task.level, level);
      assert.equal(task.ceilingLevel, level);
      assert.equal(task.skill, skill);
      assert.equal(task.catalogVersion, CATALOG_VERSION);
      assert.equal(task.rubricVersion, RUBRIC_VERSION);
      assert.ok(task.criticalDimensions.includes('task_completion'));
      assert.equal(typeof task.allowedAssistance, 'object');
      assert.equal(task.allowedAssistance.modelAnswer, false);
      assert.equal(task.allowedAssistance.translation, false);
      assert.equal(Object.isFrozen(task.contract), true);
      assert.equal(Object.isFrozen(task.criticalDimensions), true);

      if (skill === 'listening' || skill === 'speaking_spontaneous') {
        assert.equal(Object.isFrozen(task.contract.durationSeconds), true);
        assert.ok(task.contract.durationSeconds.min > 0);
        assert.ok(task.contract.durationSeconds.max >= task.contract.durationSeconds.min);
      }
      if (skill === 'writing') {
        assert.equal(Object.isFrozen(task.contract.wordCount), true);
        assert.ok(task.contract.wordCount.min > 0);
        assert.ok(task.contract.wordCount.max >= task.contract.wordCount.min);
      }
      if (skill === 'interaction') {
        assert.equal(Object.isFrozen(task.contract.turns), true);
        assert.ok(task.contract.turns.min >= 3);
        assert.ok(task.contract.turns.max >= task.contract.turns.min);
      }
    }
  }
}

assert.throws(() => getTaskFamilies('C1', 'writing'), /nível/i);
assert.throws(() => getTaskFamilies('A1', 'reading'), /habilidade/i);

const cleanOverlap = calculateTransferOverlap(
  'Please move the appointment to Friday afternoon.',
  ['I drink coffee every morning.', 'The train leaves at nine.'],
);
assert.equal(cleanOverlap.exactFiveGramMatches, 0);
assert.ok(cleanOverlap.threeGramJaccard < 0.25);

const contaminatedOverlap = calculateTransferOverlap(
  'Please move the appointment to Friday afternoon.',
  ['Could you please move the appointment to Friday afternoon for me?'],
);
assert.ok(contaminatedOverlap.exactFiveGramMatches > 0);
assert.ok(contaminatedOverlap.threeGramJaccard >= 0.25);

const undilutedOverlap = calculateTransferOverlap(
  'Please move the appointment to Friday afternoon.',
  [
    'Could you please move the appointment to Friday afternoon for me?',
    ...Array.from({ length: 20 }, (_, index) => `Unrelated sample number ${index} discusses weather near the coast.`),
  ],
);
assert.ok(undilutedOverlap.threeGramJaccard >= 0.25);

const sampleTask = getTaskFamilies('A2', 'interaction')[0];
assert.equal(validateTaskCandidate({
  task: sampleTask,
  stimulusText: 'You need to change a reservation because your train is late.',
  studiedTexts: ['My favorite meal is rice and beans.'],
  seenTaskIds: [],
  recentFamilies: [],
}).valid, true);

const repeated = validateTaskCandidate({
  task: sampleTask,
  stimulusText: 'You need to change a reservation because your train is late.',
  studiedTexts: [],
  seenTaskIds: [sampleTask.id],
  recentFamilies: [],
});
assert.equal(repeated.valid, false);
assert.ok(repeated.reasons.includes('task_seen'));

const sameFamily = validateTaskCandidate({
  task: sampleTask,
  stimulusText: 'You need to change a reservation because your train is late.',
  studiedTexts: [],
  seenTaskIds: [],
  recentFamilies: [sampleTask.family],
});
assert.equal(sameFamily.valid, false);
assert.ok(sameFamily.reasons.includes('family_recent'));

const contaminated = validateTaskCandidate({
  task: sampleTask,
  stimulusText: 'You need to change a reservation because your train is late.',
  studiedTexts: ['Yesterday you need to change a reservation because your train is late again.'],
  seenTaskIds: [],
  recentFamilies: [],
});
assert.equal(contaminated.valid, false);
assert.ok(contaminated.reasons.includes('exact_five_gram_overlap'));

assert.throws(() => validateTaskCandidate({
  task: sampleTask,
  maxThreeGramJaccard: Number.NaN,
}), /limiar/i);

assert.equal(validateTaskCatalog([
  FLUENCY_TASK_CATALOG[0],
  { ...FLUENCY_TASK_CATALOG[0] },
]).valid, false);

const malformedCatalog = FLUENCY_TASK_CATALOG.map((task) => ({ ...task }));
malformedCatalog[0] = {
  ...malformedCatalog[0],
  contract: { durationSeconds: { min: 50, max: 20 } },
};
assert.equal(validateTaskCatalog(malformedCatalog).valid, false);

const duplicateFamilyCatalog = FLUENCY_TASK_CATALOG.map((task) => ({ ...task }));
duplicateFamilyCatalog[1] = {
  ...duplicateFamilyCatalog[1],
  id: `${duplicateFamilyCatalog[1].id}.different`,
  family: duplicateFamilyCatalog[0].family,
};
assert.equal(validateTaskCatalog(duplicateFamilyCatalog).valid, false);

console.log('Catálogo versionado de tarefas de fluência passou.');
