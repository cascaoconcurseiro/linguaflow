import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'dashboard/js/ui/studyView.js'), 'utf8');

assert.doesNotMatch(source, /class="study-sidebar"/,
  'recursos não ocupam uma sidebar permanente');
assert.match(source, /app\.updateFocusStatus\?\.\(/,
  'view publica progresso para o shell de foco');
assert.ok(source.indexOf('id="grading-area"') < source.indexOf('id="study-resources"'),
  'notas aparecem no DOM antes dos recursos auxiliares');
assert.match(source, /id="study-resources" class="study-resources hidden"/,
  'gaveta Explorar começa invisível na frente');
assert.match(source, /getElementById\('study-resources'\)\?\.classList\.remove\('hidden'\)/,
  'gaveta só fica disponível depois da revelação');
assert.match(source, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
  'notas usam uma linha de quatro colunas');
assert.doesNotMatch(source, /186px/,
  'compensação móvel antiga de 186px foi removida');

const exerciseFinish = source.slice(source.indexOf('function exerciseFinish'), source.indexOf('// Montar frase'));
assert.doesNotMatch(exerciseFinish, /setTimeout|scheduleStudyTask\([^]*handleGrade/,
  'exercício não avança por timer');
assert.match(exerciseFinish, /correct \? grade === 1 : grade !== 1/,
  'acerto oferece 2–4 e erro oferece somente 1');
assert.match(source, /id="ex-answer" role="status" aria-live="polite"/,
  'builder anuncia a resposta montada');
assert.match(source, /<label for="ex-input" class="sr-only">/,
  'ditado possui rótulo acessível');
assert.match(source, /animation-play-state:paused/,
  'waveform fica parada por padrão');
assert.match(source, /@media \(prefers-reduced-motion: reduce\)/,
  'movimento reduzido é respeitado');
assert.match(source, /button\?\.setAttribute\('aria-busy', 'true'\)/,
  'estado do áudio é comunicado sem simular botão toggle');

console.log('14 contratos do modo foco passaram — tudo verde ✅');
