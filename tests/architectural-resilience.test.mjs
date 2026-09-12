import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sanitizeString,
  sanitizeNumber,
  sanitizeBoolean,
  sanitizeArray,
  sanitizeCardEnrichment,
  sanitizeStoryQuiz,
  sanitizeEvaluationFeedback,
} from '../utils/schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const appJs = read('dashboard/js/core/app.js');

test('Schema Hardening: Primitives sanitization handles edge cases', () => {
  // Strings
  assert.equal(sanitizeString('  hello world  '), 'hello world');
  assert.equal(sanitizeString(null, 'default'), 'default');
  assert.equal(sanitizeString(undefined, 'fallback'), 'fallback');
  assert.equal(sanitizeString(123), '123');

  // Numbers
  assert.equal(sanitizeNumber('42'), 42);
  assert.equal(sanitizeNumber('invalid', 10), 10);
  assert.equal(sanitizeNumber(NaN, 5), 5);
  assert.equal(sanitizeNumber(Infinity, 0), 0);
  assert.equal(sanitizeNumber(-15, 0, { min: 0, max: 100 }), 0);
  assert.equal(sanitizeNumber(150, 0, { min: 0, max: 100 }), 100);

  // Booleans
  assert.equal(sanitizeBoolean(true), true);
  assert.equal(sanitizeBoolean(false), false);
  assert.equal(sanitizeBoolean('true'), true);
  assert.equal(sanitizeBoolean('false'), false);
  assert.equal(sanitizeBoolean('unknown', true), true);

  // Arrays
  assert.deepEqual(sanitizeArray(null), []);
  assert.deepEqual(sanitizeArray([1, '  two  ', null], (x) => sanitizeString(x)), ['1', 'two']);
});

test('Schema Hardening: AI Card Enrichment sanitizes broken LLM responses', () => {
  const malformedLLM = `\`\`\`json
  {
    "portuguese_sentence": "Ele deu um passo à frente.",
    "word_pt": "passo",
    "phonetic_sentence": "El deu um pass a frent"
  }
  \`\`\``;

  const res = sanitizeCardEnrichment(malformedLLM);
  assert.equal(res.isValid, true);
  assert.equal(res.sentence_pt, 'Ele deu um passo à frente.');
  assert.equal(res.word_pt, 'passo');
  assert.equal(res.sentence_phon, 'El deu um pass a frent');
  assert.equal(res.word_phon, '');

  const invalidRes = sanitizeCardEnrichment('Desculpe, não consigo responder a isso.');
  assert.equal(invalidRes.isValid, false);
  assert.equal(invalidRes.sentence_pt, '');
});

test('Schema Hardening: Story Quiz parser tolerates unexpected formats', () => {
  const rawQuizWithNoise = `Aqui está o questionário solicitado:
  \`\`\`json
  {
    "questions": [
      {
        "question": "O que aconteceu no final?",
        "options": ["Ele viajou", "Ele dormiu", "Ele comeu"],
        "answer": 1,
        "explanation": "Ele foi dormir após a viagem."
      },
      {
        "question": "Pergunta inválida com só uma opção",
        "options": ["Apenas uma"]
      }
    ]
  }
  \`\`\`
  Espero que goste!`;

  const quiz = sanitizeStoryQuiz(rawQuizWithNoise);
  assert.equal(quiz.length, 1);
  assert.equal(quiz[0].question, 'O que aconteceu no final?');
  assert.equal(quiz[0].options.length, 3);
  assert.equal(quiz[0].answer, 1);
  assert.equal(quiz[0].explanation, 'Ele foi dormir após a viagem.');
});

test('Schema Hardening: Evaluation feedback clamps scores and filters mistakes', () => {
  const rawEvaluation = {
    nota: 105,
    comentario: 'Muito bom!',
    erros: ['pronúncia de "though"', null, 123],
  };

  const evalResult = sanitizeEvaluationFeedback(rawEvaluation);
  assert.equal(evalResult.isValid, true);
  assert.equal(evalResult.score, 100);
  assert.equal(evalResult.feedback, 'Muito bom!');
  assert.deepEqual(evalResult.mistakes, ['pronúncia de "though"', '123']);
});

test('App Lifecycle Hardening: registerCleanup and runCleanups are integrated in guardedApp', () => {
  assert.match(appJs, /registerCleanup\(fn\)/, 'App implementa registerCleanup');
  assert.match(appJs, /_runCleanups\(\)/, 'App implementa _runCleanups');
  assert.match(appJs, /this\._runCleanups\(\);[\s\S]{0,80}this\.navigationEpoch \+= 1;/, 'navigate executa limpezas pendentes antes da troca de época');
  assert.match(appJs, /const effectMethods = new Set\(\[[^\]]*'registerCleanup'[^\]]*\]\);/, 'createGuardedApp expõe registerCleanup protegido');
});
