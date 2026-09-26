import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeLexicalProfile, formatLexicalBadge } from '../utils/lexical-profile.js';

test('Lexical Profile: lida com textos vazios ou inválidos com fallback seguro', () => {
  const profile = analyzeLexicalProfile('', new Set());
  assert.equal(profile.totalTokens, 0);
  assert.equal(profile.uniqueLemmas, 0);
  assert.equal(profile.knownTokens, 0);
  assert.equal(profile.newTokens, 0);
  assert.equal(profile.coverageRatio, 1);
  assert.equal(profile.newRatio, 0);
  assert.equal(profile.isOptimalIPlusOne, false);
  assert.equal(profile.densityCategory, 'easy');
});

test('Lexical Profile: calcula cobertura e novidade i+1 para conjunto de vocabulário conhecido', () => {
  const text = 'The quick brown fox jumps over the lazy dog. A quick dog is barking.';
  // 13 tokens: the, quick, brown, fox, jumps, over, the, lazy, dog, a, quick, dog, is, barking -> 14 tokens
  const known = new Set(['the', 'quick', 'brown', 'fox', 'jump', 'over', 'lazy', 'dog', 'a', 'be']);
  // 'bark' / 'barking' é novo
  const profile = analyzeLexicalProfile(text, known);

  assert.equal(profile.totalTokens, 14);
  assert.equal(profile.newTokens, 1); // barking
  assert.equal(profile.knownTokens, 13);
  assert.ok(profile.coverageRatio > 0.90, 'cobertura deve ser > 90%');
  assert.ok(profile.newRatio > 0.05 && profile.newRatio < 0.10, 'novidade deve estar entre 5% e 10%');
  assert.equal(profile.isOptimalIPlusOne, true, 'deve ser identificado como faixa ótima de Krashen i+1');
  assert.equal(profile.densityCategory, 'optimal');
  assert.ok(profile.newLemmas.includes('bark'));
});

test('Lexical Profile: detecta textos com densidade de novidade excessiva (>15%) como frustrantes', () => {
  const text = 'Astrophysicists hypothesize quantum fluctuations perturb interstellar spacetime geometries.';
  const known = new Set(['the', 'a', 'is']);
  const profile = analyzeLexicalProfile(text, known);

  assert.ok(profile.newRatio > 0.5, 'deve ter novidade altíssima');
  assert.equal(profile.isOptimalIPlusOne, false);
  assert.equal(profile.densityCategory, 'frustrating');
  assert.match(profile.recommendation, /acessível/i);
});

test('Lexical Profile: calcula cobertura com base no nível CEFR do estudante e cefrMap', () => {
  const text = 'The teacher started a regular conversation in the university library.';
  const cefrMap = {
    the: 'A1',
    teacher: 'A2',
    started: 'A2',
    start: 'A2',
    a: 'A1',
    regular: 'A2',
    conversation: 'B1',
    in: 'A1',
    university: 'A1',
    library: 'A1',
  };

  // Estudante no nível A2: conversation (B1) é nova; o restante é conhecido
  const profileA2 = analyzeLexicalProfile(text, new Set(), { userCefr: 'A2', cefrMap });
  assert.equal(profileA2.newLemmas.includes('conversation'), true);
  assert.ok(profileA2.coverageRatio >= 0.88);

  // Estudante no nível B1: todas as palavras são conhecidas
  const profileB1 = analyzeLexicalProfile(text, new Set(), { userCefr: 'B1', cefrMap });
  assert.equal(profileB1.newTokens, 0);
  assert.equal(profileB1.coverageRatio, 1);
  assert.equal(profileB1.densityCategory, 'easy');
});

test('Lexical Profile: formatLexicalBadge formata adequadamente para a interface', () => {
  const badgeOptimal = formatLexicalBadge({
    coverageRatio: 0.95,
    newRatio: 0.05,
    isOptimalIPlusOne: true,
    densityCategory: 'optimal',
  });
  assert.match(badgeOptimal.label, /95% compreensível/);
  assert.match(badgeOptimal.label, /Ideal i\+1/);
  assert.equal(badgeOptimal.status, 'optimal');

  const badgeFrustrating = formatLexicalBadge({
    coverageRatio: 0.80,
    newRatio: 0.20,
    isOptimalIPlusOne: false,
    densityCategory: 'frustrating',
  });
  assert.match(badgeFrustrating.label, /Desafiador/);
  assert.equal(badgeFrustrating.status, 'frustrating');
});

test('Lexical Profile: storiesView.js integra análise lexical i+1', () => {
  const code = readFileSync('dashboard/js/ui/storiesView.js', 'utf8');
  assert.match(code, /analyzeLexicalProfile|formatLexicalBadge/, 'storiesView deve importar o analisador lexical');
});
