import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, study, db] = await Promise.all([
  readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
]);

assert.match(html, /<body class="lf-auth-pending">/,
  'o shell deve nascer oculto enquanto a autenticação é resolvida');
assert.doesNotMatch(app, /controllerchange[\s\S]{0,300}window\.location\.reload/,
  'troca do service worker não pode reiniciar uma Home já renderizada');
assert.doesNotMatch(app, /@keyframes lf-spin/,
  'o roteador não deve competir com o estado de loading de cada view');
assert.match(db, /signal: AbortSignal\.timeout\(10000\)/,
  'refresh de autenticação precisa liberar o bootstrap quando a rede trava');

assert.doesNotMatch(study, /tatoeba/i, 'Tatoeba foi removido do fluxo de estudo');
assert.match(study, /id="youglish-box"(?![^>]*class="hidden")/,
  'YouGlish deve ser descobrível sem um segundo details');
assert.match(study, /id="yg-widget-embed" class="hidden"/,
  'o widget pesado continua lazy até a ação do usuário');
assert.ok(study.indexOf('installYouglishReadyHandler(window') < study.indexOf("getElementById('yg-script')"),
  'reentrada no estudo reinstala o callback antes de reutilizar o script YouGlish');
assert.match(study, /renderStudyChunkCard\(c, i\)/,
  'chunks vindos de IA ou banco devem ser escapados antes do HTML');

console.log('Contratos P0 de startup e limpeza pedagógica passaram.');
