export const CATALOG_VERSION = '2026.07.1';
export const RUBRIC_VERSION = 'fluency-rubric-v1';

const LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2']);
const SKILLS = Object.freeze([
  'listening',
  'speaking_spontaneous',
  'writing',
  'interaction',
]);

const LEVEL_CONTRACTS = Object.freeze({
  A1: Object.freeze({
    listening: { durationSeconds: { min: 15, max: 35 } },
    speaking_spontaneous: { durationSeconds: { min: 30, max: 45 } },
    writing: { wordCount: { min: 25, max: 40 } },
    interaction: { turns: { min: 3, max: 4 } },
  }),
  A2: Object.freeze({
    listening: { durationSeconds: { min: 45, max: 75 } },
    speaking_spontaneous: { durationSeconds: { min: 45, max: 60 } },
    writing: { wordCount: { min: 50, max: 80 } },
    interaction: { turns: { min: 4, max: 5 } },
  }),
  B1: Object.freeze({
    listening: { durationSeconds: { min: 90, max: 120 } },
    speaking_spontaneous: { durationSeconds: { min: 75, max: 90 } },
    writing: { wordCount: { min: 100, max: 140 } },
    interaction: { turns: { min: 5, max: 6 } },
  }),
  B2: Object.freeze({
    listening: { durationSeconds: { min: 120, max: 180 } },
    speaking_spontaneous: { durationSeconds: { min: 105, max: 135 } },
    writing: { wordCount: { min: 180, max: 220 } },
    interaction: { turns: { min: 6, max: 8 } },
  }),
});

const FAMILIES = Object.freeze({
  A1: Object.freeze({
    listening: ['immediate_need', 'simple_direction'],
    speaking_spontaneous: ['self_introduction', 'immediate_need'],
    writing: ['personal_note', 'simple_request'],
    interaction: ['basic_purchase', 'personal_information'],
  }),
  A2: Object.freeze({
    listening: ['public_announcement', 'routine_message'],
    speaking_spontaneous: ['past_experience', 'simple_comparison'],
    writing: ['informal_message', 'short_account'],
    interaction: ['change_booking', 'service_request'],
  }),
  B1: Object.freeze({
    listening: ['clear_narrative', 'familiar_explanation'],
    speaking_spontaneous: ['experience_narrative', 'supported_opinion'],
    writing: ['connected_account', 'reasoned_message'],
    interaction: ['solve_complication', 'clarify_misunderstanding'],
  }),
  B2: Object.freeze({
    listening: ['structured_argument', 'viewpoint_contrast'],
    speaking_spontaneous: ['compare_tradeoffs', 'defend_position'],
    writing: ['formal_argument', 'audience_adaptation'],
    interaction: ['negotiate_outcome', 'manage_disagreement'],
  }),
});

const CRITICAL_DIMENSIONS = Object.freeze({
  listening: Object.freeze(['task_completion', 'global_meaning']),
  speaking_spontaneous: Object.freeze(['task_completion', 'comprehensibility']),
  writing: Object.freeze(['task_completion', 'coherence']),
  interaction: Object.freeze(['task_completion', 'responsiveness']),
});

const ASSISTANCE_BY_LEVEL = Object.freeze({
  A1: Object.freeze({ maxReplays: 2, maxPartnerRephrases: 2 }),
  A2: Object.freeze({ maxReplays: 1, maxPartnerRephrases: 1 }),
  B1: Object.freeze({ maxReplays: 1, maxPartnerRephrases: 1 }),
  B2: Object.freeze({ maxReplays: 1, maxPartnerRephrases: 0 }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function buildAllowedAssistance(level, skill) {
  const limits = ASSISTANCE_BY_LEVEL[level];
  return deepFreeze({
    modelAnswer: false,
    translation: false,
    transcript: false,
    glossary: false,
    maxReplays: skill === 'listening' ? limits.maxReplays : 0,
    maxPartnerRephrases: skill === 'interaction' ? limits.maxPartnerRephrases : 0,
    planningSeconds: skill === 'speaking_spontaneous'
      ? ({ A1: 20, A2: 20, B1: 15, B2: 15 })[level]
      : 0,
  });
}

function buildCatalog() {
  const tasks = [];
  for (const level of LEVELS) {
    for (const skill of SKILLS) {
      for (const family of FAMILIES[level][skill]) {
        tasks.push(deepFreeze({
          id: `${level.toLowerCase()}.${skill}.${family}.v1`,
          catalogVersion: CATALOG_VERSION,
          rubricVersion: RUBRIC_VERSION,
          level,
          ceilingLevel: level,
          skill,
          family,
          contract: LEVEL_CONTRACTS[level][skill],
          allowedAssistance: buildAllowedAssistance(level, skill),
          criticalDimensions: CRITICAL_DIMENSIONS[skill],
        }));
      }
    }
  }
  return Object.freeze(tasks);
}

export const FLUENCY_TASK_CATALOG = buildCatalog();

export function getTaskFamilies(level, skill, catalog = FLUENCY_TASK_CATALOG) {
  if (!LEVELS.includes(level)) throw new RangeError(`Nível inválido: ${level}`);
  if (!SKILLS.includes(skill)) throw new RangeError(`Habilidade inválida: ${skill}`);
  return Object.freeze(
    (Array.isArray(catalog) ? catalog : [])
      .filter((task) => task?.level === level && task?.skill === skill),
  );
}

export function normalizeTransferText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu)?.join(' ') || '';
}

function ngrams(text, size) {
  const tokens = normalizeTransferText(text).split(' ').filter(Boolean);
  const values = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    values.add(tokens.slice(index, index + size).join(' '));
  }
  return values;
}

function intersectionSize(left, right) {
  let matches = 0;
  for (const value of left) {
    if (right.has(value)) matches += 1;
  }
  return matches;
}

export function calculateTransferOverlap(candidateText, studiedTexts = []) {
  const candidateThree = ngrams(candidateText, 3);
  const candidateFive = ngrams(candidateText, 5);
  const studiedFive = new Set();
  let maxThreeGramJaccard = 0;

  for (const text of Array.isArray(studiedTexts) ? studiedTexts : []) {
    const textThree = ngrams(text, 3);
    const sharedThree = intersectionSize(candidateThree, textThree);
    const unionThree = new Set([...candidateThree, ...textThree]).size;
    const similarity = unionThree === 0 ? 0 : sharedThree / unionThree;
    maxThreeGramJaccard = Math.max(maxThreeGramJaccard, similarity);
    ngrams(text, 5).forEach((value) => studiedFive.add(value));
  }

  return Object.freeze({
    exactFiveGramMatches: intersectionSize(candidateFive, studiedFive),
    threeGramJaccard: maxThreeGramJaccard,
  });
}

export function validateTaskCandidate({
  task,
  stimulusText = '',
  studiedTexts = [],
  seenTaskIds = [],
  recentFamilies = [],
  maxThreeGramJaccard = 0.25,
} = {}) {
  if (!Number.isFinite(maxThreeGramJaccard)
    || maxThreeGramJaccard < 0
    || maxThreeGramJaccard > 1) {
    throw new RangeError('Limiar de overlap deve estar entre 0 e 1.');
  }

  const reasons = [];
  if (!task || typeof task !== 'object') {
    return Object.freeze({
      valid: false,
      reasons: Object.freeze(['task_invalid']),
      overlap: calculateTransferOverlap(stimulusText, studiedTexts),
    });
  }

  if ((Array.isArray(seenTaskIds) ? seenTaskIds : []).includes(task.id)) {
    reasons.push('task_seen');
  }
  if ((Array.isArray(recentFamilies) ? recentFamilies : []).includes(task.family)) {
    reasons.push('family_recent');
  }

  const overlap = calculateTransferOverlap(stimulusText, studiedTexts);
  if (overlap.exactFiveGramMatches > 0) reasons.push('exact_five_gram_overlap');
  if (overlap.threeGramJaccard >= maxThreeGramJaccard) {
    reasons.push('three_gram_overlap');
  }

  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    overlap,
  });
}

export function validateTaskCatalog(catalog = FLUENCY_TASK_CATALOG) {
  const errors = [];
  const tasks = Array.isArray(catalog) ? catalog : [];
  const ids = new Set();

  for (const task of tasks) {
    if (!task || typeof task !== 'object') {
      errors.push('task_invalid');
      continue;
    }
    if (ids.has(task.id)) errors.push(`duplicate_id:${task.id}`);
    ids.add(task.id);
    if (!LEVELS.includes(task.level)) errors.push(`invalid_level:${task.id}`);
    if (!SKILLS.includes(task.skill)) errors.push(`invalid_skill:${task.id}`);
    if (task.ceilingLevel !== task.level) errors.push(`invalid_ceiling:${task.id}`);
    if (task.catalogVersion !== CATALOG_VERSION) errors.push(`invalid_catalog_version:${task.id}`);
    if (task.rubricVersion !== RUBRIC_VERSION) errors.push(`invalid_rubric_version:${task.id}`);
    if (!task.family) errors.push(`missing_family:${task.id}`);
    if (!task.contract || typeof task.contract !== 'object') {
      errors.push(`missing_contract:${task.id}`);
    } else {
      const range = task.skill === 'writing'
        ? task.contract.wordCount
        : task.skill === 'interaction'
          ? task.contract.turns
          : task.contract.durationSeconds;
      if (!range
        || !Number.isFinite(range.min)
        || !Number.isFinite(range.max)
        || range.min <= 0
        || range.max < range.min) {
        errors.push(`invalid_contract_range:${task.id}`);
      }
    }
    if (!task.allowedAssistance || typeof task.allowedAssistance !== 'object') {
      errors.push(`missing_assistance:${task.id}`);
    } else if (task.allowedAssistance.modelAnswer !== false
      || task.allowedAssistance.translation !== false) {
      errors.push(`invalid_assistance:${task.id}`);
    }
    if (!Array.isArray(task.criticalDimensions)
      || !task.criticalDimensions.includes('task_completion')) {
      errors.push(`invalid_critical_dimensions:${task.id}`);
    }
  }

  for (const level of LEVELS) {
    for (const skill of SKILLS) {
      const families = new Set(
        tasks
          .filter((task) => task?.level === level && task?.skill === skill)
          .map((task) => task.family),
      );
      if (families.size < 2) errors.push(`insufficient_families:${level}:${skill}`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}
