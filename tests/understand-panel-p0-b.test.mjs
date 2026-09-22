import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const study = await readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');

assert.match(study, /<summary><span>Entender melhor<\/span>/);
assert.doesNotMatch(study, /<summary><span>Explorar esta frase<\/span>/);

const video = study.indexOf('id="video-resource-section"');
const practice = study.indexOf('id="practice-resource-title"');
const more = study.indexOf('class="more-contexts"');
assert.ok(video > 0 && video < practice && practice < more,
  'painel segue Ouvir no contexto → Praticar → Mais contextos');

const menu = study.indexOf('id="study-card-menu"');
assert.ok(menu > more, 'ações administrativas ficam fora do conteúdo pedagógico');
for (const id of ['btn-undo', 'improve-btn', 'bury-btn']) assert.ok(study.indexOf(`id="${id}"`, menu) > menu);

assert.doesNotMatch(study, /tutor|grammar-chat|data-tutor-prompt/i,
  'tutor foi removido: o card não oferece uma segunda explicação por chat');
assert.match(study, /Mais recursos/);
assert.match(study, /Sobre esta palavra/);

assert.match(study, /const recommended = visible\.slice\(0, 2\)/);
assert.match(study, /const additional = visible\.slice\(2\)/);
assert.match(study, /class="chunk-more"/);

assert.match(study, /\.study-resources-content \{ width:100%; max-width:720px/);
assert.doesNotMatch(study, /\.study-layout:has\(\.study-resources\[open\]\) \.study-main/);
assert.match(study, /id="close-study-resources"/);

// IDs dos recursos e contratos do player continuam intactos.
// (tatoeba-box saiu do contrato em 18/07: recurso removido a pedido do dono)
for (const id of ['saved-video-context','study-yt-mount','youglish-box','chunks-container']) {
  assert.match(study, new RegExp('id="' + id + '"'));
}
assert.doesNotMatch(study, /id="isolated-word-box"/);
assert.match(study, /is_learning_unit/);
assert.doesNotMatch(study, /tatoeba-box/, 'Tatoeba foi removido e não deve voltar');
assert.match(study, /renderVideoContext\(wordData, 'study-video-context'\)/);
assert.match(study, /hidePlayer\(\)/);

console.log('Contratos P0-B do painel Entender melhor passaram.');
