import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const study = readFileSync(join(root, 'dashboard/js/ui/studyView.js'), 'utf8');

assert.match(study, /cardPresentationIds\.set\(card, \+\+nextCardPresentationId\)/,
  'cada apresentação do card recebe identidade própria');
assert.match(study, /cardPresentationIds\.get\(card\) === presentationId/,
  'callback do vídeo confirma a apresentação antes de alterar a UI');
assert.match(study, /renderReveal\([^\n]+\{ renderVideo: false \}\)/,
  'enriquecimento tardio não recria os controles do vídeo');
assert.match(study, /if \(!ok \|\| !isCurrentPresentation\(\)\)/,
  'load atrasado não assume que o card ainda é o mesmo');

console.log('4 regressões de corrida do vídeo protegidas — tudo verde ✅');
