import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'dashboard/js/ui/studyView.js'), 'utf8');
const aiSource = readFileSync(join(root, 'dashboard/js/core/ai.js'), 'utf8');

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
// 17/07 (A2 do backlog): o binário virou tri-estado — acerto oferece 2-4,
// "quase" (typo no ditado) oferece 2-3, erro real oferece somente 1.
assert.match(exerciseFinish, /if \(correct\) hide = grade === 1;/,
  'acerto oferece 2–4');
assert.match(exerciseFinish, /else if \(almost\) hide = grade === 1 \|\| grade === 4;/,
  'quase (typo) oferece somente Difícil/Bom — typo nunca vira lapso');
assert.match(exerciseFinish, /else hide = grade !== 1;/,
  'erro real oferece somente Errei');
assert.match(source, /levenshtein/,
  'ditado usa distância de edição, não igualdade exata');
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
assert.match(source, /card\._classicStage = 'word'/,
  'card clássico começa numa tela só com a palavra');
assert.match(source, /revealBtn\.textContent = 'Ver na frase \(Espaço\)'/,
  'primeira ação avança para o contexto, sem revelar a tradução');
assert.match(source, /card\._classicStage = 'context'/,
  'segunda tela mostra a palavra dentro da frase');
assert.match(source, /setClipLoop\(false\)/,
  'trecho original toca uma vez e não fica preso em loop');
assert.doesNotMatch(source, /voice-ai-consent|VOICE_AI_CONSENT_KEY/,
  'treino de voz não interrompe cada uso com checkbox redundante');
assert.doesNotMatch(source, /NVIDIA\/OpenRouter|aviso de IA|provedor de IA/,
  'treino de fala não exibe aviso técnico de IA ou fornecedor');
assert.match(source, /assessPronunciationAudio\(blob, expected\)/,
  'fallback de gravação recebe avaliação multimodal em vez de apenas eco');
assert.doesNotMatch(source, /Modo eco \(sem nuvem\)/,
  'interface não promete processamento local quando enviará a gravação à nuvem');
assert.match(source, /gravação será enviada para avaliação/,
  'interface informa o envio da gravação antes da avaliação');
assert.match(source, /card\._classicStage === 'word'[\s\S]{0,100}\? wordAlone[\s\S]{0,40}: sentence/,
  'primeiro estágio cobra somente a palavra; frase só nos estágios seguintes');
assert.match(source, /playback\.src = echoPlaybackUrl/,
  'falha externa mantém reprodução local da gravação no PC');
assert.match(aiSource, /preparedBlob = new Blob\(\[wav\], \{ type: 'audio\/wav' \}\)/,
  'PC e celular normalizam a gravação para WAV antes do envio');
const { pronunciationLab } = await import('../utils/pronunciation.js');
const maliciousFeedback = pronunciationLab.calculateDiff('<img src=x onerror=alert(1)>', 'outra coisa').htmlFeedback;
assert.doesNotMatch(maliciousFeedback, /<img/,
  'feedback de pronúncia escapa HTML vindo de frases importadas');
assert.match(maliciousFeedback, /&lt;img/,
  'feedback preserva a palavra perigosa somente como texto');

console.log('29 contratos do modo foco passaram — tudo verde ✅');
