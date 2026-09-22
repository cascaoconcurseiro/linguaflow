import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [popup, popupJs, html, css, home, study] = await Promise.all([
  read('popup/popup.html'),
  read('popup/popup.js'),
  read('dashboard/dashboard.html'),
  read('dashboard/css/globals.css'),
  read('dashboard/js/ui/homeView.js'),
  read('dashboard/js/ui/studyView.js'),
]);

// A superfície de estudo e a extensão não usam emoji como substituto de
// rótulo, estado ou ação. Ícones de conteúdo podem existir em outras áreas;
// esta regra protege exatamente o fluxo que recebeu o passe editorial.
const emoji = /[\u{1F300}-\u{1FAFF}]/u;
for (const [name, source] of [['popup', popup], ['popup.js', popupJs], ['Home', home], ['estudo', study]]) {
  assert.doesNotMatch(source, emoji, `${name} não deve depender de emoji na interface`);
}

assert.match(popup, /id="btn-dash" class="btn btn-primary">Abrir dashboard<\/button>/);
assert.match(popup, /id="listening-today"/);
assert.match(popupJs, /getStudyStats\?\.\(sourceLang\)/);
assert.match(html, /<span class="stat-label">Ofensiva<\/span>/);
assert.match(html, /<button id="topbar-settings-btn"[^>]*>Configurações<\/button>/);

assert.match(home, /id="home-primary-plan"/);
assert.match(home, /class="study-hours-language"/);
assert.match(home, /class="quest-mark"/);
assert.match(css, /\.home-primary-plan \{ border: 0; border-left: 4px solid/);
assert.match(css, /\.stat-card \{ background: transparent; border: 0;/);

assert.match(study, /id="study-resources" class="study-resources hidden"/);
assert.match(study, /class="chunk-action-btn chunk-audio-btn"[^>]*>Ouvir<\/button>/);
assert.match(study, /class="chunk-action-btn chunk-save-btn"[^>]*>Salvar<\/button>/);
assert.match(study, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(study, /animation: slideIn/);

console.log('human-interface-pass: ok');
