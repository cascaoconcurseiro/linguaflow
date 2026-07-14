import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, app] = await Promise.all([
  readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/css/globals.css', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
]);

assert.match(html, /id="study-focus-header"[^>]*hidden/);
assert.match(html, /id="study-focus-exit"/);
assert.match(html, /id="study-focus-status"[^>]*>Um card por vez</);
assert.match(html, /id="study-focus-track"[^>]*role="progressbar"[^>]*aria-valuenow="0"/);
assert.match(html, /aria-haspopup="menu"[^>]*aria-expanded="false"/);
assert.match(html, /data-focus-route="home"/);
assert.match(html, /data-focus-route="library"/);
assert.match(html, /data-focus-route="settings"/);

assert.match(app, /document\.body\.classList\.toggle\('lf-focus-mode', focus\)/);
assert.match(app, /this\.focusHeader\.hidden = !focus/);
assert.match(app, /if \(!focus\) this\.setFocusMenuOpen\(false\)/);
assert.match(app, /this\.syncShellForRoute\(route\)/);
assert.match(app, /this\.syncShellForRoute\(this\.currentRoute\)/);
assert.match(app, /this\.root\.scrollTop = 0/);
assert.match(app, /typeof progress === 'object'/);
assert.match(app, /this\._focusProgressBound = true/);
assert.match(app, /this\.currentRoute === 'study' && this\._focusProgressBound/);
assert.match(app, /--study-progress/);
assert.match(app, /'updateFocusStatus'/);

assert.match(css, /body\.lf-focus-mode \.topbar \{ display: none; \}/);
assert.match(css, /body\.lf-focus-mode #app-root[\s\S]*?overflow-y: auto/);
assert.match(css, /body\.lf-focus-mode \.study-main,[\s\S]*?overflow: visible !important/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /width: var\(--study-progress, 0%\)/);
assert.doesNotMatch(css, /lf-focus-progress/);

console.log('25 contratos do shell de modo foco passaram — tudo verde ✅');
