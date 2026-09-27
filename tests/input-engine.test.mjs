import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeSentence,
  normalizeWord,
  calculateWidthCh,
  parsePastedText,
  evaluateSentenceAttempt
} from '../dashboard/js/core/inputEngine.js';

test('1. calculateWidthCh calcula largura com base nas unidades ch e margem 0.9', () => {
  assert.equal(calculateWidthCh('I'), 3.5); // Math.max(3.5, 1 + 0.9) = 3.5
  assert.equal(calculateWidthCh('to'), 3.5); // Math.max(3.5, 2 + 0.9) = 3.5
  assert.equal(calculateWidthCh('Hey'), 3.9); // 3 + 0.9 = 3.9
  assert.equal(calculateWidthCh('bounce'), 6.9); // 6 + 0.9 = 6.9
  assert.equal(calculateWidthCh('straightforward'), 15.9); // 15 + 0.9 = 15.9
});

test('2. normalizeWord remove pontuação acidental e padroniza apóstrofos tipográficos', () => {
  // Apóstrofos tipográficos (curly quotes / dead keys) normalizados para ASCII '
  assert.equal(normalizeWord("I’m"), "i'm");
  assert.equal(normalizeWord("don’t"), "don't");
  assert.equal(normalizeWord("we`ll"), "we'll");
  assert.equal(normalizeWord("it´s"), "it's");

  // Remoção de pontuação digitada acidentalmente dentro do slot
  assert.equal(normalizeWord("Hey,"), "hey");
  assert.equal(normalizeWord("alright?"), "alright");
  assert.equal(normalizeWord("...Wait!"), "wait");
});

test('3. tokenizeSentence isola pontuação externa e preserva contrações internas', () => {
  const sentence = "Hey, I'm gonna bounce, alright?";
  const tokens = tokenizeSentence(sentence);

  assert.equal(tokens.length, 5);

  // Palavra 0: "Hey,"
  assert.equal(tokens[0].targetWord, 'Hey');
  assert.equal(tokens[0].cleanWord, 'hey');
  assert.equal(tokens[0].punctuationAfter, ',');
  assert.equal(tokens[0].charWidth, 3.9);

  // Palavra 1: "I'm" (contração preservada intacta)
  assert.equal(tokens[1].targetWord, "I'm");
  assert.equal(tokens[1].cleanWord, "i'm");
  assert.equal(tokens[1].punctuationAfter, '');

  // Palavra 2: "gonna"
  assert.equal(tokens[2].targetWord, 'gonna');
  assert.equal(tokens[2].cleanWord, 'gonna');
  assert.equal(tokens[2].punctuationAfter, '');

  // Palavra 3: "bounce,"
  assert.equal(tokens[3].targetWord, 'bounce');
  assert.equal(tokens[3].punctuationAfter, ',');

  // Palavra 4: "alright?"
  assert.equal(tokens[4].targetWord, 'alright');
  assert.equal(tokens[4].punctuationAfter, '?');
});

test('4. parsePastedText divide o texto colado por espaços preservando palavras limpas', () => {
  const pasted = "  I'm   gonna bounce right now!  ";
  const words = parsePastedText(pasted);

  assert.deepEqual(words, ["I'm", "gonna", "bounce", "right", "now"]);
});

test('5. evaluateSentenceAttempt valida acertos parciais e identifica índices de erro exatos', () => {
  const sentence = "I'm gonna bounce, alright?";
  const tokens = tokenizeSentence(sentence);

  // Tentativa 1: Usuário errou a palavra 2 ("bunce" em vez de "bounce")
  const userAttempt = ["I'm", "gonna", "bunce", "alright"];
  const result1 = evaluateSentenceAttempt(tokens, userAttempt);

  assert.equal(result1.isCorrect, false);
  assert.deepEqual(result1.errorIndices, [2]);
  assert.deepEqual(result1.correctIndices, [0, 1, 3]);

  // Tentativa 2: Usuário corrigiu a palavra 2
  const correctedAttempt = ["I'm", "gonna", "bounce", "alright"];
  const result2 = evaluateSentenceAttempt(tokens, correctedAttempt);

  assert.equal(result2.isCorrect, true);
  assert.deepEqual(result2.errorIndices, []);
  assert.deepEqual(result2.correctIndices, [0, 1, 2, 3]);
});

test('6. evaluateSentenceAttempt aceita answer_variants quando configuradas', () => {
  const sentence = "I can't bounce right now.";
  const tokens = tokenizeSentence(sentence);
  const variants = [{ slot: 1, text: "cannot" }]; // Aceita "cannot" para o slot 1 ("can't")

  const attemptWithVariant = ["I", "cannot", "bounce", "right", "now"];
  const result = evaluateSentenceAttempt(tokens, attemptWithVariant, variants);

  assert.equal(result.isCorrect, true);
  assert.deepEqual(result.errorIndices, []);
});
