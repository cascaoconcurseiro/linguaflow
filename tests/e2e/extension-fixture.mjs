// Fixture Playwright: carrega a extensão em um Chromium real e serve páginas-fixture nos
// domínios dos players (nenhuma chamada vai ao YouTube/Netflix de verdade).
import { chromium, test as base } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VIDEO = readFileSync(new URL('./fixtures/lf-test.webm', import.meta.url));
const EXTENSION_PATH = path.resolve(new URL('../..', import.meta.url).pathname);

// Legenda no formato json3 do YouTube. Entra pelo MESMO caminho do player real: um fetch para
// /api/timedtext que a extensão intercepta (youtube-hook.js).
export const TIMEDTEXT_JSON3 = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'Hello there my friend' }] },
    { tStartMs: 3000, dDurationMs: 3000, segs: [{ utf8: 'I really need some coffee' }] },
    { tStartMs: 6000, dDurationMs: 3000, segs: [{ utf8: 'Let us go home now' }] },
  ],
});

export const YOUTUBE_HTML = `<!doctype html><html><head><title>Vídeo de teste</title></head><body>
<div id="movie_player" class="html5-video-player" style="width:960px;height:540px;position:relative">
  <video class="html5-main-video" style="width:960px;height:540px" src="/lf-test.webm" muted loop playsinline autoplay></video>
  <div class="ytp-chrome-bottom"><div class="ytp-right-controls">
    <button class="ytp-subtitles-button" aria-pressed="true" title="Legendas"></button>
  </div></div>
</div>
<script>
// Como no YouTube real: o botão CC alterna aria-pressed a cada clique.
document.querySelector('.ytp-subtitles-button').addEventListener('click', (e) => {
  e.currentTarget.setAttribute('aria-pressed', String(e.currentTarget.getAttribute('aria-pressed') !== 'true'));
});
setTimeout(() => fetch('https://www.youtube.com/api/timedtext?v=lf-test&lang=en&fmt=json3').catch(() => {}), 800);</script>
</body></html>`;

export const NETFLIX_HTML = `<!doctype html><html><head><title>Netflix teste</title></head><body>
<div class="watch-video" style="width:960px;height:540px;position:relative"><video style="width:960px;height:540px"></video></div>
</body></html>`;

export async function launchExtension() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'lf-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: process.env.LF_CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--headless=new'],
  });
  await context.route('https://www.youtube.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/timedtext')) return route.fulfill({ status: 200, contentType: 'application/json', body: TIMEDTEXT_JSON3 });
    if (url.endsWith('/lf-test.webm')) return route.fulfill({ status: 200, contentType: 'video/webm', body: VIDEO });
    return route.fulfill({ status: 200, contentType: 'text/html', body: YOUTUBE_HTML });
  });
  await context.route('https://www.netflix.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: NETFLIX_HTML }));
  if (!context.serviceWorkers().length) await context.waitForEvent('serviceworker');
  return { context, close: async () => { await context.close(); rmSync(userDataDir, { recursive: true, force: true }); } };
}

export const test = base.extend({
  // Cada teste usa um "navegador" novo: fechar = estado de sessão limpo.
  extension: async ({}, use) => {
    const ext = await launchExtension();
    await use(ext);
    await ext.close();
  },
});

export { expect } from '@playwright/test';
