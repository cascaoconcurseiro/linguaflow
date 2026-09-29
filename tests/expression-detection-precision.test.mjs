// tests/expression-detection-precision.test.mjs — Issue #345: precisão da
// detecção de phrasal verbs e gírias medida num conjunto de referência.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DETECTION_GOLD, DETECTION_HOLDOUT } from './fixtures/detection-gold.mjs';
import { detectExpressions, expressionKind } from '../utils/expression-detector.js';
import { slangMatchesContext, slangsDB } from '../utils/slangs-db.js';
import { detectExprType } from '../content/popup/popup-linguistics.js';
import { expressionsDB, matchExpressionCandidate } from '../utils/expressions-db.js';

function measure(set, type) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const errors = [];
  for (const sample of set) {
    const got = new Set(detectExpressions(sample.text).filter((d) => d.type === type).map((d) => d.canonical));
    const expected = new Set(sample[type]);
    for (const x of got) {
      if (expected.has(x)) tp += 1;
      else { fp += 1; errors.push(`FP ${x} ← ${sample.text}`); }
    }
    for (const x of expected) {
      if (!got.has(x)) { fn += 1; errors.push(`FN ${x} ← ${sample.text}`); }
    }
  }
  return { precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1), errors };
}

const pct = (v) => `${Math.round(v * 100)}%`;

test('conjunto de referência: precisão e recall', () => {
  for (const type of ['phrasal', 'slang']) {
    const m = measure(DETECTION_GOLD, type);
    console.log(`[gold] ${type}: precisão ${pct(m.precision)} · recall ${pct(m.recall)}`, m.errors);
    assert.ok(m.precision >= 0.95, `${type}: precisão ${pct(m.precision)} — ${m.errors.join(' | ')}`);
    assert.ok(m.recall >= 0.9, `${type}: recall ${pct(m.recall)} — ${m.errors.join(' | ')}`);
  }
});

test('frases fora da calibração: precisão não regride abaixo de 80%', () => {
  for (const type of ['phrasal', 'slang']) {
    const m = measure(DETECTION_HOLDOUT, type);
    console.log(`[holdout] ${type}: precisão ${pct(m.precision)} · recall ${pct(m.recall)}`, m.errors);
    assert.ok(m.precision >= 0.8, `${type}: precisão ${pct(m.precision)} — ${m.errors.join(' | ')}`);
  }
});

test('verbo + preposição transparente não é phrasal', () => {
  for (const phrase of ['look at', 'add to', 'act as', 'need to', 'talk about', 'depend on', 'wait for']) {
    assert.equal(expressionKind(phrase), 'prepositional', phrase);
  }
  for (const phrase of ['give up', 'run out of', 'look after', 'come across', 'put up with', 'go on']) {
    assert.equal(expressionKind(phrase), 'phrasal', phrase);
  }
});

test('gíria ambígua depende da frase; sem frase mantém o lookup', () => {
  assert.equal(slangMatchesContext('tea', 'I drink tea every morning'), false);
  assert.equal(slangMatchesContext('tea', "Okay here's the tea"), true);
  assert.equal(slangMatchesContext('sick', 'I was sick yesterday'), false);
  assert.equal(slangMatchesContext('sick', "Dude, that's sick"), true);
  assert.equal(slangMatchesContext('goat', ''), true);
  assert.equal(slangMatchesContext('dude', 'whatever'), true);
  assert.ok(slangsDB.has('no cap') && slangsDB.has('goat') && slangsDB.size >= 50);
});

test('popup: rótulo usa a frase e separa colocação de phrasal', () => {
  const base = { expressionsDB, matchExpressionCandidate, slangsDB, slangMatchesContext, expressionKind };
  assert.equal(detectExprType('tea', { ...base, context: 'I drink tea every morning' }).type, 'word');
  assert.equal(detectExprType('tea', { ...base, context: "So here's the tea" }).type, 'slang');
  assert.equal(detectExprType('look at', { ...base, context: 'Look at this' }).type, 'collocation');
  assert.equal(detectExprType('gave up', { ...base, context: 'She gave up' }).type, 'phrasal');
});
