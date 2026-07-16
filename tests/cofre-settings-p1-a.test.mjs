import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../dashboard/js/ui/viewState.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const library = read('dashboard/js/ui/libraryView.js');
const settings = read('dashboard/js/ui/settingsView.js');

assert.equal(escapeHtml('<img src=x onerror=alert(1)> & "x"'), '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;x&quot;');
assert.match(library, /escapeHtml\(w\.word\)/);
assert.match(library, /escapeHtml\(w\.translation\)/);
assert.match(library, /escapeHtml\(w\.context_sentence\)/);
assert.match(library, /<article class="word-card/);
assert.ok(library.indexOf('class="word-context"') < library.indexOf('class="word-main"'), 'frase de contexto vem antes do termo');
assert.match(library, /renderStatus\(card\)/);
assert.doesNotMatch(library, /renderStatus\(w\.reps\)/);
for (const label of ['Revisar hoje', 'Nova', 'Começando', 'Consolidando', 'Memória estável', 'Revisões pausadas']) assert.match(library, new RegExp(label));
assert.match(library, /aria-pressed=/);
assert.match(library, /Pausar revisões/);
assert.match(library, /Retomar revisões/);
assert.match(library, /btn-empty-library-learn/);
assert.doesNotMatch(library, /opacity:0\.55/);
assert.match(library, /renderVideoContext/);
assert.match(library, /attachVideoContext/);

assert.match(settings, /try\s*\{[\s\S]*lfDb\.getSettings/);
assert.match(settings, /btn-settings-retry/);
assert.match(settings, /Nenhum valor padrão será salvo por cima/);
assert.match(settings, /id="srs-new-per-day"[^>]+max="20"/);
assert.match(settings, /srsNewPerDay \?\? 5/);
assert.match(settings, /Seu nível aproximado/);
assert.match(settings, /não substitui uma avaliação CEFR completa/);
assert.match(settings, /Salvar configurações/);

console.log('✓ P1-A: Cofre escaneável e Configurações seguras');
