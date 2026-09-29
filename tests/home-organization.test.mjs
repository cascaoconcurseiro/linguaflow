// Issue #336 — organização da navegação e da Home.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickHomeBanner, selectStrugglingCards } from '../dashboard/js/ui/homeView.js';

const [html, home] = await Promise.all([
  readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8'),
]);

// 1. "Hoje" é a rota inicial: vem antes de Cursos nas duas navegações.
const desktopNav = html.match(/<nav class="nav-links">([\s\S]*?)<\/nav>/)?.[1] || '';
const mobileNav = html.match(/<nav id="mobile-nav"[\s\S]*?>([\s\S]*?)<\/nav>/)?.[1] || '';
for (const nav of [desktopNav, mobileNav]) {
  const routes = [...nav.matchAll(/data-route="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(routes.slice(0, 2), ['home', 'courses'], 'Hoje primeiro, Cursos em segundo');
}

// 2. Palavras fracas: mesmo critério da sessão de reforço (isWeakCard).
const now = new Date('2026-09-29T12:00:00Z');
const past = '2026-09-28T12:00:00Z';
const future = '2026-10-05T12:00:00Z';
const words = {
  a: { word: 'forward', translation: 'encaminhar' },
  b: { word: 'bump', translation: 'bater de leve' },
  c: { word: 'gross', translation: 'nojento' },
  d: { word: 'despite', translation: 'apesar de' },
  e: { word: 'awkward', translation: 'desconfortável' },
};
const cards = [
  { id: 1, word_id: 'a', lapses: 1, difficulty: 7.6, due_date: past },           // 1 lapso: não é fraca
  { id: 2, word_id: 'c', lapses: 0, difficulty: 8.4, due_date: past },           // só dificuldade: não é fraca
  { id: 3, word_id: 'b', lapses: 4, difficulty: 6, due_date: future },
  { id: 4, word_id: 'd', lapses: 3, difficulty: 5, due_date: past },
  { id: 5, word_id: 'e', lapses: 1, is_leech: true, due_date: past },
  { id: 6, word_id: 'a', lapses: 9, suspended: true, due_date: past },            // suspensa: fora
];
const result = selectStrugglingCards(cards, words, now);
assert.equal(result.total, 3);
assert.equal(result.dueCount, 2, 'só as vencidas contam para o botão de reforço');
assert.deepEqual(result.items.map(i => i.word), ['bump', 'despite', 'awkward'], 'ordenadas por esquecimentos');
assert.equal(result.items.find(i => i.word === 'awkward').isLeech, true);
assert.equal('difficulty' in result.items[0], false, 'dificuldade FSRS não é exibida');

const many = Array.from({ length: 8 }, (_, i) => ({ id: i, word_id: 'a', lapses: 3 + i, due_date: past }));
assert.equal(selectStrugglingCards(many, words, now).items.length, 5);
assert.equal(selectStrugglingCards(many, words, now).total, 8);
assert.deepEqual(selectStrugglingCards(null, null, now), { items: [], total: 0, dueCount: 0 });

// 3. No máximo um banner de alerta, por prioridade.
assert.equal(pickHomeBanner({ returning: true, streakAtRisk: true, vault: true }), 'return');
assert.equal(pickHomeBanner({ returning: false, streakAtRisk: true, vault: true }), 'streak');
assert.equal(pickHomeBanner({ returning: false, streakAtRisk: false, vault: true }), 'vault');
assert.equal(pickHomeBanner({}), null);

// 4. Estrutura da Home.
const today = home.slice(home.indexOf("section('home-today'"), home.indexOf("more.id = 'home-more'"));
const moreBody = home.slice(home.indexOf("more.id = 'home-more'"), home.indexOf('main.replaceChildren'));
assert.doesNotMatch(today, /home-study-hours-card/, 'horas de estudo saíram da seção Hoje');
assert.match(moreBody, /home-study-hours-card/, 'horas de estudo ficam em Métricas detalhadas');
assert.match(today, /home-struggling-words/);
assert.ok(!/Cards Críticos|badge-diff|Dificuldade \$\{/.test(home), 'bloco antigo e badge de dificuldade removidos');
assert.ok(/navigate(\?\.)?\('study', \{ weakOnly: true \}\)/.test(home), 'botão abre a sessão de reforço');
assert.ok(/import \{ isWeakCard \} from '\.\.\/core\/sessionQueue\.js'/.test(home), 'fonte única do critério');

console.log('home-organization: ok');
