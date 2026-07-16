import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseTodayAction } from '../dashboard/js/ui/homeView.js';

const [html, app, css, learn, progress] = await Promise.all([
  readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/css/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/learnView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/progressView.js', import.meta.url), 'utf8'),
]);

const desktopNav = html.match(/<nav class="nav-links">([\s\S]*?)<\/nav>/)?.[1] || '';
const mobileNav = html.match(/<nav id="mobile-nav"[\s\S]*?>([\s\S]*?)<\/nav>/)?.[1] || '';
for (const nav of [desktopNav, mobileNav]) {
  const labels = [...nav.matchAll(/<span[^>]*>([^<]+)<\/span>|<button[^>]*>([^<]+)<\/button>/g)]
    .map(match => (match[1] || match[2] || '').trim())
    .filter(label => ['Hoje', 'Aprender', 'Cofre', 'O Cofre', 'Progresso'].includes(label));
  assert.equal(labels.length, 4);
  assert.equal(labels[0], 'Hoje');
  assert.equal(labels[1], 'Aprender');
  assert.match(labels[2], /Cofre/);
  assert.equal(labels[3], 'Progresso');
}
assert.match(html, /id="profile-menu-toggle"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/);
assert.match(html, /id="profile-menu"[^>]*role="menu"[^>]*hidden/);
assert.match(html, /id="study-focus-header"[^>]*hidden/);
for (const route of ['home','learn','library','progress','study','stories','reader','game','stats','leagues','settings','login']) {
  assert.match(app, new RegExp(`${route}: render`));
}
assert.match(app, /const learnRoutes = new Set\(\['learn', 'stories', 'reader', 'game'\]\)/);
assert.match(app, /const progressRoutes = new Set\(\['progress', 'stats', 'leagues'\]\)/);
assert.match(app, /setProfileMenuOpen\(false, true\)/);
assert.match(css, /\.profile-menu\[hidden\] \{ display:none; \}/);
assert.match(css, /\.profile-menu button \{[^}]*min-height:44px/);
for (const route of ['stories', 'reader', 'game']) assert.match(learn, new RegExp(`route: '${route}'`));
for (const route of ['stats', 'leagues']) assert.match(progress, new RegExp(`route: '${route}'`));
assert.match(learn, /data-learn-route="\$\{item\.route\}"/);
assert.match(progress, /data-progress-route="\$\{item\.route\}"/);

const cases = [
  [{ totalWords:0 }, 'first-context', 'learn'],
  [{ totalWords:5, dueCards:7, dueLearning:2, daysAway:3 }, 'return-review', 'study'],
  [{ totalWords:5, dueCards:2, dueLearning:2 }, 'learning', 'study'],
  [{ totalWords:5, dueCards:4, dueLearning:1 }, 'review', 'study'],
  [{ totalWords:5, dueCards:0, reviewsToday:8 }, 'completed', 'learn'],
  [{ totalWords:5, dueCards:0, daysAway:3 }, 'return-clear', 'learn'],
  [{ totalWords:5, dueCards:0 }, 'clear', 'learn'],
];
for (const [state, kind, route] of cases) {
  const decision = chooseTodayAction(state);
  assert.equal(decision.kind, kind);
  assert.equal(decision.route, route);
  assert.ok(decision.label && decision.title && decision.reason && decision.meta);
}
assert.equal(chooseTodayAction({ totalWords:5, dueCards:1, retention30:null }).reason,
  'Estas frases chegaram ao momento certo de serem lembradas.');

console.log('Contratos P0-A de navegação e treinador diário passaram.');
