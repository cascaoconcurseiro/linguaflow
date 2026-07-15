import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, app, home, library, stories, settings] = await Promise.all([
  readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/css/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/settingsView.js', import.meta.url), 'utf8'),
]);

// Navegação móvel: quatro destinos mentais, não uma cópia espremida do desktop.
for (const label of ['Início', 'Conteúdo', 'Cofre', 'Mais']) assert.match(html, new RegExp(`>${label}<`));
assert.match(html, /aria-label="Navegação principal"/);
assert.match(app, /aria-current', 'page'/);
assert.match(app, /event\.key === 'Escape'/);
assert.match(css, /@media \(max-width: 390px\)/);
assert.match(css, /@media \(max-width: 340px\)/);

// Home: próximo passo primeiro, informação diagnóstica depois.
const today = home.indexOf("section('home-today'");
const missions = home.indexOf("section('home-missions'");
const insights = home.indexOf("section('home-insights'");
const achievements = home.indexOf("section('home-achievements'");
assert.ok(today < missions && missions < insights && insights < achievements);
assert.match(home, /CONTINUAR SEU PLANO/);
assert.match(home, /competitive-details/);

// Cofre: busca é primária; filtros raros e ações destrutivas são progressivos.
assert.match(library, /id="library-search" type="search"/);
assert.match(library, /<details class="lib-filters"/);
assert.match(library, /class="status-chip/);
assert.match(library, /<details class="word-action-menu">/);
assert.doesNotMatch(library, /class="btn-delete"[^>]*title=/);
assert.match(library, /id="btn-library-retry"/);
assert.match(library, /id="btn-clear-library-filters"/);

// Histórias: criar e consumir são modos separados e operáveis por teclado.
assert.match(stories, /role="tablist"/);
assert.match(stories, />Criar<\/button>/);
assert.match(stories, />Ler<\/button>/);
assert.match(stories, /aria-selected', String\(isNew\)/);
assert.match(stories, /event\.key === 'Enter' \|\| event\.key === ' '/);

// Configurações: cinco grupos; controles técnicos ficam no último, fechado.
for (const label of ['Seu aprendizado', 'Memória', 'Som e lembretes', 'Dados e conta', 'Avançado']) {
  assert.match(settings, new RegExp(`group\\('${label}'`));
}
assert.match(settings, /group\('Seu aprendizado'[^\n]+open: true/);
assert.match(settings, /group\('Avançado'[^\n]+advanced: true/);
assert.match(css, /\.settings-save-bar/);

console.log('Contratos da Etapa 4 de produto/UX passaram.');
