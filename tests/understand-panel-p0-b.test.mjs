import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const study = await readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');

assert.match(study, /<summary><span>Entender melhor<\/span>/);
assert.doesNotMatch(study, /<summary><span>Explorar esta frase<\/span>/);

const video = study.indexOf('id="video-resource-section"');
const native = study.indexOf('id="native-examples-title"');
assert.ok(video > 0 && video < native,
  'recursos laterais contêm Ouvir no contexto e Ouvir em outros contextos');

// Seções removidas a pedido do dono para eliminar poluição lateral e manter foco estrito no áudio
assert.doesNotMatch(study, /id="practice-resource-title"/, 'seção Praticar foi removida da lateral');
assert.doesNotMatch(study, /study-context-summary/, 'resumo redundante de sentido foi removido da lateral');
assert.doesNotMatch(study, /tutor|grammar-chat|data-tutor-prompt/i, 'chat/tutor redundante removido');
assert.doesNotMatch(study, /id="isolated-word-box"/);
assert.doesNotMatch(study, /tatoeba-box/, 'Tatoeba foi removido e não deve voltar');

const menu = study.indexOf('id="study-card-menu"');
const cardMeta = study.indexOf('class="study-card-meta"');
const explore = study.indexOf('class="study-explore"');
assert.ok(menu > cardMeta && menu < explore, 'ações administrativas ficam no cabeçalho do card');
assert.doesNotMatch(study.slice(explore), /id="study-card-menu"/, 'menu do card não fica dentro do aprofundamento');
for (const id of ['btn-undo', 'improve-btn', 'bury-btn']) assert.ok(study.indexOf(`id="${id}"`, menu) > menu);

assert.match(study, /id="close-study-resources"/);

// IDs dos recursos essenciais e contratos do player continuam intactos.
for (const id of ['saved-video-context', 'study-yt-mount', 'youglish-box']) {
  assert.match(study, new RegExp('id="' + id + '"'));
}
assert.match(study, /is_learning_unit/);
assert.match(study, /renderVideoContext\(wordData, 'study-video-context'\)/);
assert.match(study, /hidePlayer\(\)/);

console.log('Contratos P0-B do painel Entender melhor passaram.');
