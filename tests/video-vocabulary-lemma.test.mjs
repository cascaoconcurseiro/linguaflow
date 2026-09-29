// tests/video-vocabulary-lemma.test.mjs — Issue #371: o lema só reduz para
// uma forma de que a palavra é flexão de verdade ("thing" não é "the").
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractVideoVocabulary, lemmaOf } from '../content/subtitles/video-vocabulary.js';

const lexicon = new Set(['the', 'we', 'go', 'be', 'make', 'run', 'stop', 'study', 'cry', 'film', 'watch', 'hope', 'hop', 'use', 'do', 'love']);

test('não reduz para palavras que só coincidem no começo', () => {
  assert.equal(lemmaOf('thing', lexicon), 'thing');
  assert.equal(lemmaOf('wing', lexicon), 'wing');
  assert.equal(lemmaOf('hoping', lexicon), 'hope', '"hop" vira "hopping", não "hoping"');
});

test('continua reduzindo flexões reais', () => {
  const cases = {
    going: 'go', being: 'be', goes: 'go', doing: 'do', making: 'make', running: 'run',
    stopped: 'stop', studies: 'study', cries: 'cry', films: 'film', watches: 'watch',
    filmed: 'film', hopped: 'hop', hopping: 'hop', using: 'use', loved: 'love', loving: 'love',
  };
  for (const [word, base] of Object.entries(cases)) assert.equal(lemmaOf(word, lexicon), base, word);
});

test('"thing" aparece na aba Palavras mesmo com "the" no vídeo', () => {
  const vocab = extractVideoVocabulary(
    [{ text: 'The best things in life. One more thing, the end.' }],
    { stopWords: new Set(['the', 'one', 'more', 'in']) },
  );
  assert.equal(vocab.get('thing')?.count, 2);
});
