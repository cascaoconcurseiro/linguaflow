import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanContextExplanation,
  detectFalseFriend,
  detectExprType,
  getPosLabel,
  getPosDetail,
  getPosPatterns,
  getFalseFriendsMap,
  getCommonIdiomsSet,
  getCommonChunksSet,
} from '../content/popup/popup-linguistics.js';

import { WordPopup } from '../content/word-popup.js';

test('popup-linguistics: cleanContextExplanation remove tags HTML e formata explicacoes', () => {
  const raw = '<b>Got over</b> significa superar.<br><br>**Atenção:** Uso comum.';
  const cleaned = cleanContextExplanation(raw);
  assert.equal(cleaned, 'Got over significa superar.\n\nAtenção: Uso comum.');
});

test('popup-linguistics: detectFalseFriend identifica falsos amigos comuns com case-insensitivity', () => {
  const friendsMap = getFalseFriendsMap();
  assert.ok(friendsMap.actually, 'actually deve estar no mapa');
  assert.ok(friendsMap.pretend, 'pretend deve estar no mapa');

  const res1 = detectFalseFriend('Actually');
  assert.match(res1, /na verdade/);

  const res2 = detectFalseFriend('  pretend  ');
  assert.match(res2, /fingir/);

  assert.equal(detectFalseFriend('dog'), null, 'palavra comum nao e falso amigo');
  assert.equal(detectFalseFriend(''), null);
});

test('popup-linguistics: detectExprType detecta idioms, chunks, phrasals, girias e palavras', () => {
  const idioms = getCommonIdiomsSet();
  const chunks = getCommonChunksSet();

  // Idiom
  const idiomRes = detectExprType('piece of cake', { idiomSet: idioms, chunkSet: chunks });
  assert.equal(idiomRes.type, 'idiom');
  assert.equal(idiomRes.label, '🌀 Idiom');

  // Chunk
  const chunkRes = detectExprType('in order to', { idiomSet: idioms, chunkSet: chunks });
  assert.equal(chunkRes.type, 'chunk');
  assert.equal(chunkRes.label, '🧩 Chunk');

  // Phrasal verb with mocked DB
  const mockPhrasals = {
    turn: [{ phrase: 'turn down' }],
  };
  const phrasalRes = detectExprType('turn down', {
    idiomSet: idioms,
    chunkSet: chunks,
    phrasalVerbsDB: mockPhrasals,
    getBaseVerbCandidates: (w) => [w],
  });
  assert.equal(phrasalRes.type, 'phrasal');
  assert.equal(phrasalRes.label, '🔗 Phrasal Verb');

  // Slang with mocked set
  const mockSlangs = new Set(['no cap', 'flex']);
  const slangRes = detectExprType('no cap', {
    idiomSet: idioms,
    chunkSet: chunks,
    slangsDB: mockSlangs,
    getBaseVerbCandidates: (w) => [w],
  });
  assert.equal(slangRes.type, 'slang');
  assert.equal(slangRes.label, '🔥 Gíria');

  // Collocation (multi-word desconhecido)
  const colocRes = detectExprType('heavy rain', { idiomSet: idioms, chunkSet: chunks });
  assert.equal(colocRes.type, 'collocation');
  assert.equal(colocRes.label, '🤝 Colocação');

  // Simple word
  const wordRes = detectExprType('apple', { idiomSet: idioms, chunkSet: chunks });
  assert.equal(wordRes.type, 'word');
  assert.equal(wordRes.label, '📖 Palavra');
});

test('popup-linguistics: getPosLabel, getPosDetail e getPosPatterns geram templates didaticos', () => {
  assert.equal(getPosLabel('noun'), 'substantivo');
  assert.equal(getPosLabel('verb'), 'verbo');
  assert.equal(getPosLabel('adjective'), 'adjetivo');

  const detailNoun = getPosDetail('noun', 'book');
  assert.match(detailNoun, /Substantivo/);
  assert.match(detailNoun, /book's/);

  const patternVerb = getPosPatterns('verb', 'read');
  assert.match(patternVerb, /S \+ read \+ O/);
});

test('WordPopup: instancia delega corretamente para o modulo linguistico', () => {
  const popup = Object.create(WordPopup.prototype);
  popup._initData();

  assert.ok(popup._falseFriends);
  assert.ok(popup._idiomSet);
  assert.ok(popup._chunkSet);

  const ff = popup._detectFalseFriend('eventually');
  assert.match(ff, /no fim/);

  const expr = popup._detectExprType('break a leg');
  assert.equal(expr.type, 'idiom');
  assert.equal(expr.label, '🌀 Idiom');

  assert.equal(popup._posLabel('adverb'), 'advérbio');
  assert.match(popup._posDetail('adverb', 'quickly'), /Advérbio/);
  assert.match(popup._patterns('noun', 'car'), /the\/a\/an \+ car/);
});
