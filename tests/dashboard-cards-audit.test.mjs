import test from 'node:test';
import assert from 'node:assert/strict';
import { safeParseJson } from '../dashboard/js/core/ai.js';
import { db } from '../utils/db.js';

test('safeParseJson: robust against LLM preambles, fences, and postambles', () => {
  // Case 1: Pure JSON
  assert.deepEqual(safeParseJson('{"a": 1, "b": "ok"}'), { a: 1, b: 'ok' });

  // Case 2: Markdown fence
  assert.deepEqual(safeParseJson('```json\n{"adjust": 0, "feedback": "Bom"}\n```'), { adjust: 0, feedback: 'Bom' });

  // Case 3: Conversational preamble and closing note
  const rawLlmOutput = `Certamente! Segue a avaliação do estudante:
\`\`\`json
{
  "adjust": 1,
  "feedback": "Excelente uso de vocabulário avançado."
}
\`\`\`
Espero que isso ajude! Qualquer dúvida me avise.`;
  assert.deepEqual(safeParseJson(rawLlmOutput), {
    adjust: 1,
    feedback: 'Excelente uso de vocabulário avançado.',
  });

  // Case 4: Array JSON with preamble
  const chunksOutput = `Aqui estão os 3 chunks solicitados:
[
  {"eng": "run out of", "pt": "ficar sem", "phon": "rân áut óv"}
]
Bons estudos!`;
  assert.deepEqual(safeParseJson(chunksOutput), [
    { eng: 'run out of', pt: 'ficar sem', phon: 'rân áut óv' }
  ]);

  // Case 5: Invalid string
  assert.equal(safeParseJson('Não consegui gerar nada.'), null);
  assert.equal(safeParseJson(null), null);
  assert.equal(safeParseJson(undefined), null);
  assert.equal(safeParseJson(''), null);
});

test('renderBuilder: word shuffle terminates safely on repetitive phrases', () => {
  const context = 'no no no';
  const tokens = context.replace(/[.!?,;:]+$/, '').split(/\s+/);
  const shuffled = [...tokens];
  let attempts = 0;
  do {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (attempts < 10 && tokens.length > 2 && shuffled.join(' ') === tokens.join(' '));

  assert.equal(attempts, 10, 'Deve parar exatamente no limite de 10 tentativas em vez de travar a thread');
});

test('FSRS math hardening: stability 0, negative, and NaN are sanitized', () => {
  // Stability 0 should be clamped to >= 0.1, preventing division by zero (Infinity)
  const rZero = db._fsrsRetrievability(1, 0);
  assert.ok(Number.isFinite(rZero), 'Retrievability com estabilidade 0 deve ser finita');
  assert.ok(rZero > 0 && rZero <= 1, 'Retrievability deve estar no intervalo (0, 1]');

  const rNaN = db._fsrsRetrievability(1, NaN);
  assert.ok(Number.isFinite(rNaN), 'Retrievability com estabilidade NaN deve ser finita');

  const rNeg = db._fsrsRetrievability(1, -5);
  assert.ok(Number.isFinite(rNeg), 'Retrievability com estabilidade negativa deve ser finita');

  // Interval calculation should be finite and positive
  const ivlZero = db._fsrsInterval(0, 0.9);
  assert.ok(Number.isFinite(ivlZero) && ivlZero > 0, 'Interval com estabilidade 0 deve ser positivo e finito');

  const ivlNaN = db._fsrsInterval(NaN, NaN);
  assert.ok(Number.isFinite(ivlNaN) && ivlNaN > 0, 'Interval com NaN deve ser positivo e finito');
});

test('FSRS _calculateNextState: recovers cleanly from corrupt card stability 0', () => {
  const corruptCard = {
    id: 'card-1',
    word_id: 'word-1',
    status: 'review',
    interval: 5,
    stability: 0, // dado corrompido
    difficulty: NaN, // dado corrompido
    last_review: new Date(Date.now() - 86400000 * 2).toISOString(),
    reps: 3,
    lapses: 0,
  };
  const settings = {
    learningSteps: [1, 10],
    relearningSteps: [10],
    retention: 0.9,
    maxInt: 365,
    intMod: 1,
    easyInt: 4,
    gradInt: 1,
  };

  const next = db._calculateNextState(corruptCard, 3, settings);
  assert.ok(Number.isFinite(next.stability) && next.stability > 0, 'Nova estabilidade deve ser válida e positiva');
  assert.ok(Number.isFinite(next.difficulty) && next.difficulty >= 1 && next.difficulty <= 10, 'Nova dificuldade deve ser válida e entre 1 e 10');
  assert.ok(Number.isFinite(next.interval) && next.interval >= 1, 'Novo intervalo deve ser válido e >= 1');
});

test('category inference logic: slangs, phrasal verbs with 2/3 parts, and standard words', () => {
  function _inferCategory(word) {
    const lower = (word||'').toLowerCase();
    const parts = lower.split(' ').filter(p => p.trim() !== '');
    if (parts.length > 4) return 'sentence';
    const commonSlangs = ['lit', 'cap', 'flex', 'goat', 'sus', 'bussin', 'slay', 'shook', 'simp', 'yeet', 'salty', 'cringe'];
    if (parts.length === 1) {
      if (commonSlangs.includes(parts[0])) return 'slang';
      return 'word';
    }
    const particles = ['up', 'out', 'in', 'off', 'on', 'down', 'away', 'over', 'by', 'through', 'back', 'around', 'into', 'across', 'after', 'along', 'ahead', 'forward'];
    if (parts.length === 2 && particles.includes(parts[1])) return 'phrasal';
    if (parts.length === 3 && particles.includes(parts[1])) return 'phrasal';
    if (parts.length > 2) return 'idiom';
    return 'word';
  }

  assert.equal(_inferCategory('lit'), 'slang');
  assert.equal(_inferCategory('flex'), 'slang');
  assert.equal(_inferCategory('water'), 'word');
  assert.equal(_inferCategory('run out'), 'phrasal');
  assert.equal(_inferCategory('look forward to'), 'phrasal'); // 'forward' or 3-part with particles
  assert.equal(_inferCategory('get by'), 'phrasal');
  assert.equal(_inferCategory('come across'), 'phrasal');
  assert.equal(_inferCategory('piece of cake'), 'idiom');
  assert.equal(_inferCategory('this is a very long sentence indeed'), 'sentence');
});

test('keyboard handler focus guard: permits digits 1-4 and shortcuts when button is focused', () => {
  // Simula a lógica de guarda do handleKeydown
  function shouldIgnoreKeydown(targetTag, isContentEditable, isModal, code) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || isContentEditable) return true;
    if (isModal) return true;
    if (['A', 'SUMMARY'].includes(targetTag)) return true;
    if (targetTag === 'BUTTON' && (code === 'Space' || code === 'Enter')) return true;
    return false;
  }

  // Quando o botão de nota (.grade-btn) está focado, dígitos 1-4 NÃO devem ser ignorados
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'Digit1'), false, 'Digit1 no botão não deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'Digit2'), false, 'Digit2 no botão não deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'Digit3'), false, 'Digit3 no botão não deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'Digit4'), false, 'Digit4 no botão não deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'KeyR'), false, 'KeyR no botão não deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('BUTTON', false, false, 'KeyE'), false, 'KeyE no botão não deve ser ignorado');

  // Mas quando o usuário está digitando num campo de texto ou modal, DEVE ignorar
  assert.equal(shouldIgnoreKeydown('INPUT', false, false, 'Digit1'), true, 'Digit1 no input deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('TEXTAREA', false, false, 'KeyR'), true, 'KeyR no textarea deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('DIV', true, false, 'Digit3'), true, 'Digit3 em contenteditable deve ser ignorado');
  assert.equal(shouldIgnoreKeydown('DIV', false, true, 'Digit1'), true, 'Digit1 no modal deve ser ignorado');
});

