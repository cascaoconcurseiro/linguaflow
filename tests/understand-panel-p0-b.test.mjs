import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const study = await readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');

assert.match(study, /<summary><span>Entender melhor<\/span>/);
assert.doesNotMatch(study, /<summary><span>Explorar esta frase<\/span>/);

const video = study.indexOf('id="video-resource-section"');
const understand = study.indexOf('id="understand-resource-title"');
const practice = study.indexOf('id="practice-resource-title"');
const youglish = study.indexOf('class="learning-resource-section youglish-resource"');
assert.ok(video > 0 && video < understand && understand < practice && practice < youglish,
  'painel segue Ouvir no contexto → Entender → Praticar → YouGlish');

const menu = study.indexOf('id="study-card-menu"');
assert.ok(menu > youglish, 'ações administrativas ficam fora do conteúdo pedagógico');
for (const id of ['btn-undo', 'improve-btn', 'bury-btn']) assert.ok(study.indexOf(`id="${id}"`, menu) > menu);

assert.equal((study.match(/data-tutor-prompt=/g) || []).length, 3);
assert.match(study, /document\.querySelectorAll\('\[data-tutor-prompt\]'\)/);
assert.match(study, /button\.disabled = true/);
assert.match(study, /button\.disabled = false/);

assert.match(study, /const recommended = visible\.slice\(0, 2\)/);
assert.match(study, /const additional = visible\.slice\(2\)/);
assert.match(study, /class="chunk-more"/);

assert.match(study, /\.study-resources-content \{ position:fixed/);
assert.match(study, /width:min\(440px, 100vw\)/);
assert.match(study, /bottom:calc\(82px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(study, /height:min\(72dvh, 680px\)/);
assert.match(study, /\.study-layout:has\(\.study-resources\[open\]\) \.study-main/);
assert.match(study, /id="close-study-resources"/);

// IDs dos recursos e contratos do player continuam intactos.
for (const id of ['saved-video-context','study-yt-mount','isolated-word-box','grammar-chat','youglish-box','chunks-container']) {
  assert.match(study, new RegExp(`id="${id}"`));
}
assert.doesNotMatch(study, /tatoeba/i);
assert.doesNotMatch(study, /class="more-contexts"/);
assert.match(study, /if \(c\.is_word \|\| c\.is_context\) return false/);
assert.match(study, /renderVideoContext\(wordData, 'study-video-context'\)/);
assert.match(study, /hidePlayer\(\)/);

console.log('Contratos P0-B do painel Entender melhor passaram.');
