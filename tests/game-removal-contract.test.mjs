import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const [app, home, learn, vercel] = await Promise.all([
  read('dashboard/js/core/app.js'),
  read('dashboard/js/ui/homeView.js'),
  read('dashboard/js/ui/learnView.js'),
  read('vercel.json'),
]);

await assert.rejects(
  access(new URL('../dashboard/js/ui/gameView.js', import.meta.url)),
  'gameView.js não deve continuar como módulo de produto',
);
assert.doesNotMatch(app, /gameView\.js|renderGame/);
assert.doesNotMatch(home, /btn-game|btn-play-match|navigate\(['"]game['"]\)/);
assert.doesNotMatch(learn, /route:\s*['"]game['"]|Escolher prática/);
assert.match(app, /if \(route === 'game'\)[\s\S]*?route = 'learn'/,
  'links antigos para jogos devem cair em Aprender');
assert.match(vercel, /\{ "source": "\/game", "destination": "\/dashboard\/dashboard\.html" \}/,
  'bookmarks antigos devem carregar o shell para o roteador redirecionar');
assert.doesNotMatch(vercel, /:route\([^)]*\bgame\b[^)]*\)/,
  'Vercel não deve publicar assets específicos da rota aposentada');

console.log('game-removal-contract: ok');
