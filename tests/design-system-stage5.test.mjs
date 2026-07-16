import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [css, home, library, stories, settings] = await Promise.all([
  readFile(new URL('../dashboard/css/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/settingsView.js', import.meta.url), 'utf8'),
]);

for (const token of ['--color-link', '--color-focus', '--color-success-text', '--shadow-sm', '--shadow-md', '--space-4', '--touch-target', '--motion-fast']) {
  assert.match(css, new RegExp(token), `token ${token} deve existir`);
}
assert.match(css, /:where\(button, a, input, select, textarea, summary\):focus-visible/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /min-height:var\(--touch-target\)/);
assert.match(css, /\.view-state\s*\{[\s\S]*?min-block-size:240px/);

assert.match(home, /class="competitive-details-body"/);
assert.doesNotMatch(home, /<details class="competitive-details" style=/);
assert.match(library, /container\.setAttribute\('aria-busy', 'true'\)/);
assert.match(library, /container\.setAttribute\('aria-busy', 'false'\)/);
assert.doesNotMatch(library, /transition:\s*all/);
assert.match(stories, /historyList\.setAttribute\('aria-busy', 'true'\)/);
assert.match(stories, /btnGenerate\.setAttribute\('aria-busy', 'true'\)/);
assert.match(stories, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(stories, /transition:\s*all/);
assert.doesNotMatch(settings, /class="cefr-btn[^>]+style=/);
assert.match(settings, /class="settings-page-title"/);

console.log('Contratos transversais de design system da Etapa 5 passaram.');
