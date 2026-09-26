import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuiz, generateStoryQuiz } from '../dashboard/js/ui/storiesQuiz.js';
import { runPlacementTest } from '../dashboard/js/ui/cefrPlacementTest.js';

test('storiesQuiz: normalizeQuiz sanitiza e valida estrutura de 3 a 5 perguntas', () => {
  const invalidEmpty = normalizeQuiz(null);
  assert.deepEqual(invalidEmpty, []);

  const invalidFewerThan3 = [
    { q: 'Pergunta 1?', options: ['A', 'B', 'C', 'D'], answer: 0 },
    { q: 'Pergunta 2?', options: ['A', 'B', 'C', 'D'], answer: 1 }
  ];
  assert.deepEqual(normalizeQuiz(invalidFewerThan3), [], 'Menos de 3 perguntas deve ser rejeitado');

  const validQuestions = [
    { q: 'Pergunta 1?', options: ['Alpha', 'Beta', 'Gamma', 'Delta'], answer: 0 },
    { q: 'Pergunta 2?', options: ['One', 'Two', 'Three', 'Four'], answer: 2 },
    { q: 'Pergunta 3?', options: ['Red', 'Green', 'Blue', 'Yellow'], answer: 3 },
    { q: 'Pergunta 4?', options: ['Cat', 'Dog', 'Bird', 'Fish'], answer: 1 }
  ];
  const normalized = normalizeQuiz(validQuestions);
  assert.equal(normalized.length, 4);
  assert.equal(normalized[0].q, 'Pergunta 1?');
  assert.equal(normalized[0].answer, 0);

  // Pergunta com opções duplicadas deve ser descartada
  const withDuplicateOptions = [
    ...validQuestions,
    { q: 'Pergunta 5 com duplicação?', options: ['Same', 'Same', 'Other', 'Another'], answer: 0 }
  ];
  const normalizedDup = normalizeQuiz(withDuplicateOptions);
  assert.equal(normalizedDup.length, 4, 'Pergunta com opções repetidas deve ser filtrada');
});

test('storiesQuiz: generateStoryQuiz gera quiz embaralhado com mock de IA', async () => {
  const mockAiChat = async () => JSON.stringify({
    questions: [
      { q: 'Where did they go?', options: ['Park', 'Beach', 'Museum', 'Cinema'], answer: 1 },
      { q: 'Who called John?', options: ['Mary', 'Bob', 'Alice', 'David'], answer: 0 },
      { q: 'What time was it?', options: ['Morning', 'Noon', 'Night', 'Dusk'], answer: 2 }
    ]
  });

  const previous = [];
  const quiz = await generateStoryQuiz('Sample story text', previous, {
    aiChat: mockAiChat,
    safeParseJson: JSON.parse
  });

  assert.equal(quiz.length, 3);
  assert.equal(previous.length, 3, 'Deve registrar perguntas usadas no histórico');
  for (const item of quiz) {
    assert.equal(item.options.length, 4);
    assert.ok(item.answer >= 0 && item.answer < 4);
  }
});

test('cefrPlacementTest: runPlacementTest é uma função assíncrona exportada', () => {
  assert.equal(typeof runPlacementTest, 'function');
});
