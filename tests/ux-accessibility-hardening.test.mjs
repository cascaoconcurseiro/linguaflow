import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, stories, library, settings, popup] = await Promise.all([
  read('dashboard/js/core/app.js'),
  read('dashboard/js/ui/storiesView.js'),
  read('dashboard/js/ui/libraryView.js'),
  read('dashboard/js/ui/settingsView.js'),
  read('popup/popup.html'),
]);

assert.match(stories, /id="lf-story-word-modal" role="dialog" aria-modal="true" aria-labelledby="lf-modal-word"/);
assert.match(stories, /aria-label="Fechar detalhes da palavra"/);
assert.match(stories, /event\.key === 'Escape'[\s\S]*closeWordModal/);
assert.match(stories, /event\.key !== 'Tab'[\s\S]*focusable/);
assert.match(stories, /modalReturnFocus\?\.focus/);
assert.doesNotMatch(stories, /div\.setAttribute\('role', 'button'\)/);
assert.match(stories, /class="story-open"/);
assert.match(stories, /aria-label="Excluir história para sempre"/);

assert.match(library, /setAttribute\('role', 'dialog'\)/);
assert.match(library, /setAttribute\('aria-modal', 'true'\)/);
assert.match(library, /setAttribute\('aria-labelledby', 'lf-edit-title'\)/);
for (const id of ['translation', 'sentence', 'category', 'level']) {
  assert.match(library, new RegExp(`label for="lf-edit-${id}"`));
}
assert.match(library, /const close = \(\) => \{[\s\S]*returnFocusTo\?\.focus[\s\S]*event\.key === 'Escape'/);

assert.match(settings, /w\.explanation[\s\S]*Por que significa isso nesta frase/);
assert.match(settings, /w\.mnemonic[\s\S]*Como lembrar/);

assert.match(app, /document\.title = `\$\{routeTitles\[route\]/);
assert.match(app, /role="status" aria-live="polite"[\s\S]*Carregando \$\{routeTitles/);
assert.match(app, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
assert.match(app, /targetContainer\.focus\(\{ preventScroll: true \}\)/);
assert.match(popup, /input:focus-visible[\s\S]*outline: 3px solid var\(--color-secondary\)/);

console.log('ux-accessibility-hardening: ok');
