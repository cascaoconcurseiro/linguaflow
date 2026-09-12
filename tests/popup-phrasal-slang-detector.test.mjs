import assert from 'node:assert/strict';
import { WordPopup } from '../content/word-popup.js';
import { phrasalVerbsDB } from '../utils/phrasal-verbs.js';
import { expressionsDB, matchExpressionCandidate, getBaseVerbCandidates } from '../utils/expressions-db.js';
import { slangsDB } from '../utils/slangs-db.js';

// Setup mock WordPopup instance
const popup = Object.create(WordPopup.prototype);
popup._phrasalVerbsDB = phrasalVerbsDB;
popup._expressionsDB = expressionsDB;
popup._slangsDB = slangsDB;
popup._matchExpressionCandidate = matchExpressionCandidate;
popup._getBaseVerbCandidates = getBaseVerbCandidates;
popup._idiomSet = new Set(['piece of cake', 'break a leg']);
popup._chunkSet = new Set(['in order to', 'as well as']);

console.log('Testing WordPopup _detectExprType with lemmatization & inflections...');

// 1. Phrasal Verbs (Inflected forms)
const testPhrasals = [
  'gave up',
  'gives up',
  'giving up',
  'took off',
  'taking off',
  'got over',
  'getting over',
  'turned down',
  'turning down',
  'gave it up', // separable with pronoun
  'freaked out', // phrasal verb
];

for (const phrase of testPhrasals) {
  const result = popup._detectExprType(phrase, phrasalVerbsDB);
  assert.equal(result.type, 'phrasal', `Expected "${phrase}" to be detected as phrasal verb, got: ${result.type}`);
  assert.equal(result.label, '🔗 Phrasal Verb', `Expected badge to be "🔗 Phrasal Verb" for "${phrase}"`);
}

// 2. Slangs (Base and Inflected forms)
const testSlangs = [
  'no cap',
  'cap',
  'capping',
  'flex',
  'flexing',
  'flexed',
  'boujee',
  'simp',
  'simping',
  'ghost',
  'ghosted',
  'stan',
  'stanned',
  'slay',
  'slayed',
  'goat',
  'lowkey',
  'salty',
  'sus',
];

for (const slang of testSlangs) {
  const result = popup._detectExprType(slang, phrasalVerbsDB);
  assert.equal(result.type, 'slang', `Expected slang "${slang}" to be detected as slang, got: ${result.type}`);
  assert.equal(result.label, '🔥 Gíria', `Expected badge to be "🔥 Gíria" for "${slang}"`);
}

// 3. Idioms & Chunks
const idiomResult = popup._detectExprType('piece of cake', phrasalVerbsDB);
assert.equal(idiomResult.type, 'idiom');
assert.equal(idiomResult.label, '🌀 Idiom');

const chunkResult = popup._detectExprType('in order to', phrasalVerbsDB);
assert.equal(chunkResult.type, 'chunk');
assert.equal(chunkResult.label, '🧩 Chunk');

// 4. Regular words
const wordResult = popup._detectExprType('computer', phrasalVerbsDB);
assert.equal(wordResult.type, 'word');
assert.equal(wordResult.label, '📖 Palavra');

console.log('Testing WordPopup _expandTermInContext...');

// Test expansion: clicking inflected verb in context
const expanded1 = await popup._expandTermInContext('gave', 'She gave up smoking last month.');
assert.equal(expanded1, 'gave up', 'Should expand "gave" to "gave up" in context');

const expanded2 = await popup._expandTermInContext('up', 'She gave up smoking last month.');
assert.equal(expanded2, 'gave up', 'Should expand "up" to "gave up" in context');

const expanded3 = await popup._expandTermInContext('freaked', 'He completely freaked out when he heard.');
assert.equal(expanded3, 'freaked out', 'Should expand "freaked" to slang "freaked out"');

const expanded4 = await popup._expandTermInContext('capping', 'Why are you capping right now?');
assert.equal(expanded4, 'capping', 'Single word slang should remain "capping"');

console.log('Testing WordPopup _buildGrammar inflected phrasal resolution...');

// Test grammar resolution for inflected verb
popup.word = 'gave up';
popup.cache = { 'gave up': {} };
popup._exprType = popup._detectExprType('gave up', phrasalVerbsDB);

// Check that tokens and base verbs map to canonical give up in phrasalVerbsDB
const tokens = 'gave up'.split(/\s+/);
const baseVerbs = popup._getBaseVerbCandidates(tokens[0]);
let exactPhrasal = [];
for (const b of baseVerbs) {
  const found = (phrasalVerbsDB[b] || []).filter((e) => {
    const ep = e.phrase?.toLowerCase();
    return ep === 'gave up' || ep === [b, ...tokens.slice(1)].join(' ');
  });
  if (found.length) {
    exactPhrasal = found;
    break;
  }
}
assert.ok(exactPhrasal.length > 0, 'Should find base entry for "gave up" in phrasalVerbsDB["give"]');
assert.equal(exactPhrasal[0].phrase.toLowerCase(), 'give up', 'Should resolve canonical phrase "give up"');

console.log('✅ All WordPopup Phrasal Verbs & Slangs detection with lemmatization tests passed successfully!');
