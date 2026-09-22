import assert from 'node:assert/strict';
import { mergeContextualChunks } from '../utils/context-chunks.js';

const merged = mergeContextualChunks([
  { eng: 'She got over it.', pt: 'Ela superou isso.', is_context: true },
  { eng: 'get over', pt: 'superar', is_word: true },
  { eng: 'I got over my fear.', pt: 'Superei meu medo.' },
], {
  context: 'She got over it.',
  learningUnit: 'get over',
  learningTranslation: 'superar / deixar para trás',
});

assert.deepEqual(merged.slice(0, 2), [
  { eng: 'She got over it.', pt: 'Ela superou isso.', phon: '', is_context: true },
  { eng: 'get over', pt: 'superar / deixar para trás', phon: '', is_learning_unit: true },
]);
assert.deepEqual(merged[2], {
  eng: 'I got over my fear.',
  pt: 'Superei meu medo.',
});

const recovered = mergeContextualChunks([
  { eng: 'I am up for it.', pt: 'Eu topo.', phon: 'Ai em ap for it', is_context: true },
  { eng: 'up for', pt: 'disposto a', phon: 'ap for', is_learning_unit: true },
]);
assert.equal(recovered[0].eng, 'I am up for it.');
assert.equal(recovered[0].pt, 'Eu topo.');
assert.equal(recovered[1].is_learning_unit, true);

const withoutContext = mergeContextualChunks([{ eng: 'take it easy', pt: 'fica tranquilo' }], { learningUnit: 'take it easy' });
assert.equal(withoutContext[0].is_learning_unit, true);
assert.equal(withoutContext.some((chunk) => chunk.is_context), false);

console.log('Contrato de chunks contextuais passou.');
