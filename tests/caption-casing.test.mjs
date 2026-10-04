import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSubtitleCasing, adjustFragmentCasing } from '../utils/caption-casing.js';

test('converte oração em ALL CAPS para Sentence Case preservando o pronome I', () => {
  // Caso real enviado pelo usuário: Linkin Park - Faint
  const input = "FEEL THE WAY I DID BEFORE. Don't turn";
  const expected = "Feel the way I did before. Don't turn";
  assert.equal(normalizeSubtitleCasing(input), expected);
});

test('preserva pronome I no início, no meio e em contrações em frases ALL CAPS', () => {
  assert.equal(
    normalizeSubtitleCasing("I CAN'T FEEL THE WAY I DID BEFORE."),
    "I can't feel the way I did before."
  );
  assert.equal(
    normalizeSubtitleCasing("DON'T TURN YOUR BACK ON ME, I WON'T BE IGNORED!"),
    "Don't turn your back on me, I won't be ignored!"
  );
  assert.equal(
    normalizeSubtitleCasing("I'M HERE AND I'VE SEEN IT ALL."),
    "I'm here and I've seen it all."
  );
});

test('preserva siglas consagradas em frases ALL CAPS', () => {
  assert.equal(
    normalizeSubtitleCasing("WE TRAVELED TO THE USA AND VISITED NASA."),
    "We traveled to the USA and visited NASA."
  );
  assert.equal(
    normalizeSubtitleCasing("WATCHING TV WITH THE FBI AND CIA."),
    "Watching TV with the FBI and CIA."
  );
});

test('não altera frases normais que já possuem capitalização correta', () => {
  const normal = "This is a normal subtitle with John and Sarah in London.";
  assert.equal(normalizeSubtitleCasing(normal), normal);
});

test('preserva siglas isoladas em frases normais', () => {
  const withAcronym = "He works for NASA and loves watching TV.";
  assert.equal(normalizeSubtitleCasing(withAcronym), withAcronym);
});

test('trata pontuações iniciais como travessões e aspas em ALL CAPS', () => {
  assert.equal(
    normalizeSubtitleCasing("- WHAT ARE YOU DOING?"),
    "- What are you doing?"
  );
  assert.equal(
    normalizeSubtitleCasing('"STOP RIGHT THERE!"'),
    '"Stop right there!"'
  );
});

test('ajusta casing de fragmento concatenado no meio da oração sem pontuação', () => {
  // Quando fragmentos do YouTube são agrupados:
  // "Because when you" + "Start to learn"
  const prev = "Because when you";
  const next = "Start to learn";
  assert.equal(adjustFragmentCasing(prev, next), "start to learn");
});

test('#364 preserva nomes próprios e início de citação ao concatenar fragmentos', () => {
  assert.equal(adjustFragmentCasing("That's the vibe for", 'September, but it is 8'), 'September, but it is 8');
  assert.equal(adjustFragmentCasing('I met', 'Sarah at the park'), 'Sarah at the park');
  assert.equal(adjustFragmentCasing('from a fortune cookie,', '"Enjoy life. It is better'), '"Enjoy life. It is better');
  assert.equal(adjustFragmentCasing('I said', 'And then we left'), 'and then we left');
});

test('preserva pronome I e siglas ao concatenar fragmentos no meio da oração', () => {
  const prev = "And then";
  assert.equal(adjustFragmentCasing(prev, "I saw him"), "I saw him");
  assert.equal(adjustFragmentCasing(prev, "I'm going home"), "I'm going home");
  assert.equal(adjustFragmentCasing(prev, "NASA announced a mission"), "NASA announced a mission");
});

test('mantém inicial maiúscula se o fragmento anterior terminou com pontuação terminal', () => {
  assert.equal(adjustFragmentCasing("Look at that.", "It is great."), "It is great.");
  assert.equal(adjustFragmentCasing("Are you ready?", "Yes I am."), "Yes I am.");
  assert.equal(adjustFragmentCasing("Amazing!", "Now let's go."), "Now let's go.");
});

test('trata entradas vazias, nulas ou não-string graciosamente', () => {
  assert.equal(normalizeSubtitleCasing(""), "");
  assert.equal(normalizeSubtitleCasing(null), "");
  assert.equal(normalizeSubtitleCasing(undefined), "");
  assert.equal(adjustFragmentCasing("", "Hello"), "Hello");
  assert.equal(adjustFragmentCasing("Hello", ""), "");
});

test('oração mista: trecho em CAIXA ALTA seguido de minúsculas vira Sentence Case (vídeo Gunter)', () => {
  assert.equal(
    normalizeSubtitleCasing("SMELLS LIKE IT'S coming from Gunter, are you blowing it up in here?"),
    "Smells like it's coming from Gunter, are you blowing it up in here?"
  );
  assert.equal(
    normalizeSubtitleCasing('THESE LUMPS, I KNOW YOU WANT TO slump up on these lumps.'),
    'These lumps, I know you want to slump up on these lumps.'
  );
  assert.equal(
    normalizeSubtitleCasing('ESSA MÚSICA É BOA NO MEU tímpano.'),
    'Essa música é boa no meu tímpano.'
  );
});

test('oração mista: primeira palavra isolada em caixa alta vira Title Case', () => {
  assert.equal(normalizeSubtitleCasing('What? GUNTER, something stinks.'), 'What? Gunter, something stinks.');
});

test('oração mista: siglas conhecidas e pronome I dentro do trecho gritado são preservados', () => {
  assert.equal(
    normalizeSubtitleCasing('I WATCH TV WITH THE FBI every day.'),
    'I watch TV with the FBI every day.'
  );
});

test('oração mista: palavra isolada em caixa alta no meio da frase não é alterada (pode ser sigla)', () => {
  const s = 'He works for NATO and loves it.';
  assert.equal(normalizeSubtitleCasing(s), s);
});
