import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readPopupSource } from './helpers/popup-source.mjs';
import { readServiceWorkerSource } from './helpers/service-worker-source.mjs';
import { readStudySource } from './helpers/study-source.mjs';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const [popup, worker, webAi, study] = await Promise.all([
  readPopupSource(),
  readServiceWorkerSource(),
  read('dashboard/js/core/ai.js'),
  readStudySource(),
]);

assert.match(popup, /mergeContextualChunks\(this\.generatedChunks/);
assert.match(popup, /chunks: contextualChunks\.length \? contextualChunks : null/);
assert.match(worker, /generateChunksWithAI\(word, context\)/);
assert.match(worker, /is_learning_unit/);
assert.match(worker, /Frase de origem do vídeo/);
assert.match(webAi, /generateChunksWeb\(word, context = ''\)/);
assert.match(webAi, /is_learning_unit/);
assert.match(study, /generateChunksForWord\(word, context = ''\)/);
assert.match(study, /mergeContextualChunks/);
assert.match(study, /Trecho original/);
assert.match(study, /Unidade para guardar/);
assert.doesNotMatch(study, /rich-badge-cefr/);
assert.doesNotMatch(study, /rich-badge-pos/);

console.log('Contrato de integração do card contextual passou.');
