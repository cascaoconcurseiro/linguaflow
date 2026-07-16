import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderViewState } from '../dashboard/js/ui/viewState.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const loading = renderViewState({ kind: 'loading', title: 'Preparando…' });
const empty = renderViewState({ kind: 'empty', title: 'Nada aqui', message: 'Comece agora.', actionLabel: 'Começar', actionId: 'start' });
const error = renderViewState({ kind: 'error', title: '<Falha>', actionLabel: 'Tentar novamente', actionId: 'retry' });

assert.match(loading, /view-state-loading/);
assert.match(loading, /role="status"/);
assert.match(loading, /aria-live="polite"/);
assert.doesNotMatch(loading, /<button/);
assert.match(empty, /view-state-empty/);
assert.match(empty, /id="start"/);
assert.match(error, /view-state-error/);
assert.match(error, /role="alert"/);
assert.match(error, /aria-live="assertive"/);
assert.match(error, /&lt;Falha&gt;/);

const surfaces = [
  'dashboard/js/ui/homeView.js',
  'dashboard/js/ui/libraryView.js',
  'dashboard/js/ui/statsView.js',
  'dashboard/js/ui/readerView.js',
  'dashboard/js/ui/gameView.js',
  'dashboard/js/ui/storiesView.js',
].map(read).join('\n');

for (const oldCopy of [
  'Carregando seu painel',
  'Carregando leitor',
  'Cards no total',
  'Nenhum card salvo ainda',
  'Maturidade dos cards',
  'Palavras Maduras',
  'Maduros no SRS',
  'Modo Jogo',
  'Minha biblioteca',
  'Adicionar à biblioteca',
  'Nenhuma palavra encontrada',
  'Está logado?',
]) assert.ok(!surfaces.includes(oldCopy), `microcopy antiga removida: ${oldCopy}`);

for (const file of ['homeView.js', 'libraryView.js', 'statsView.js', 'readerView.js', 'gameView.js', 'storiesView.js']) {
  assert.match(read(`dashboard/js/ui/${file}`), /renderViewState/, `${file} usa estados compartilhados`);
}

assert.match(read('dashboard/js/ui/statsView.js'), /btn-stats-retry/);
assert.match(read('dashboard/js/ui/gameView.js'), /Não foi possível preparar esta prática/);
assert.match(read('dashboard/js/ui/storiesView.js'), /remoteFailed && stories\.length === 0/);
assert.match(read('dashboard/js/ui/storiesView.js'), /btn-stories-retry/);
assert.match(read('dashboard/css/globals.css'), /\.view-state-error/);

console.log('✓ P0-C: linguagem pedagógica e estados de interface padronizados');
