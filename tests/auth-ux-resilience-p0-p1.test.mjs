import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('dashboard/js/core/app.js');
const login = read('dashboard/js/ui/loginView.js');
const reader = read('dashboard/js/ui/readerView.js');
const stories = read('dashboard/js/ui/storiesView.js');
const home = read('dashboard/js/ui/homeView.js');
const settings = read('dashboard/js/ui/settingsView.js');
const css = read('dashboard/css/globals.css');
const db = read('utils/db.js');
const stats = read('dashboard/js/ui/statsView.js');
const dashboard = read('dashboard/dashboard.html');

// Fronteira autenticada e shell público.
assert.match(app, /this\.authResolved = false/);
assert.match(app, /!this\.isAuthenticated && route !== 'login'/);
assert.match(app, /route = 'login'/);
assert.match(app, /setAuthenticated\(false\)[\s\S]{0,120}navigate\('login'\)/);
assert.match(app, /classList\.toggle\('lf-auth-route', route === 'login'\)/);
assert.match(css, /body\.lf-auth-pending \.mobile-nav/);
assert.match(css, /body\.lf-auth-route \.mobile-nav/);
assert.match(dashboard, /<body class="lf-auth-pending">/,
  'shell deve nascer oculto antes mesmo do JavaScript carregar');
assert.match(app, /this\.navigate\('login'\)[\s\S]*?requestAnimationFrame\([\s\S]*?classList\.remove\('lf-auth-pending'\)/,
  'primeira rota deve ser instalada antes de revelar o shell');
assert.match(dashboard, /maximum-scale=1, user-scalable=no, viewport-fit=cover/);
assert.match(css, /html \{[\s\S]*?overscroll-behavior: none;[\s\S]*?touch-action: manipulation;/);
assert.match(css, /#app-root \{[\s\S]*?overscroll-behavior: contain;[\s\S]*?touch-action: pan-y;/);
assert.doesNotMatch(login, /topbar\.style\.display/);
assert.match(db, /async logout\(\)[\s\S]*?this\._invalidateReadCache\(\)/,
  'logout elimina caches do usuário anterior');
assert.match(db, /await this\._saveSession\([\s\S]*?this\._invalidateReadCache\(\)/,
  'login elimina caches antes de servir o novo usuário');
assert.match(stats, /lfDb\.getStatsSnapshot\(60\)/,
  'estatísticas exigem snapshot fresco do banco sob a sessão atual');

// Cadastro com confirmação permanece na autenticação até existir sessão.
assert.match(login, /res\.session\?\.access_token \|\| await db\.checkSession/);
assert.match(login, /Confirme seu e-mail/);
assert.match(login, /Enviamos um link de confirmação/);
assert.match(login, /app\.setAuthenticated\?\.\(false\)/);

// Uma view que rejeita não pode manter o spinner indefinidamente.
assert.match(app, /renderRouteFailure\(context\)/);
assert.match(app, /Não foi possível abrir esta tela/);
assert.match(app, /btn-route-retry/);
assert.match(app, /renderRouteView\(context\.route, context\.container/);

// Reader redesenhável sem acumular listeners e popup dentro da viewport.
assert.match(reader, /readerDocumentController\?\.abort\(\)/);
assert.match(reader, /document\.addEventListener\('mousedown',[\s\S]*signal: documentController\.signal/);
assert.match(reader, /window\.addEventListener\('resize', hidePopup, \{ signal:/);
assert.match(reader, /const above = anchorRect\.top - popupRect\.height - 8/);
assert.match(reader, /mobileNavClearance/);
assert.match(stories, /storiesDocumentController\?\.abort\(\)/);
assert.match(stories, /document\.addEventListener\('selectionchange',[\s\S]*signal: documentController\.signal/);
assert.match(stories, /document\.addEventListener\('mousedown',[\s\S]*signal: documentController\.signal/);

// Dados suplementares nunca são silenciosamente apresentados como confirmados.
assert.match(home, /let supplementaryDataAvailable = true/);
assert.match(home, /supplementaryDataAvailable = false/);
assert.match(home, /Alguns detalhes não foram carregados/);
assert.match(home, /btn-home-details-retry/);

// Dashboard e extensão confirmam CEFR juntos.
const mirrors = [...settings.matchAll(/Promise\.all\(\[\s*lfDb\.setSetting\('lf_cefr_level',[\s\S]*?lfDb\.setSetting\('cefrTargetLevel'/g)];
assert.equal(mirrors.length, 2, 'teste de nível e seletor devem aguardar os dois espelhos CEFR');
assert.doesNotMatch(settings, /setSetting\('cefrTargetLevel'[^\n]+\.catch\(\(\) => \{\}\)/);

console.log('✓ P0/P1: autenticação, fallback de view, Reader, Home parcial e CEFR resilientes');
