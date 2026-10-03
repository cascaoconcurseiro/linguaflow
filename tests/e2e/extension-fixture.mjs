// Fixture Playwright: carrega a extensão em um Chromium real e serve páginas-fixture nos
// domínios dos players (nenhuma chamada vai ao YouTube/Netflix de verdade).
import { chromium, test as base } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(new URL('../..', import.meta.url).pathname);

export const YOUTUBE_HTML = `<!doctype html><html><head><title>Vídeo de teste</title></head><body>
<div id="movie_player" class="html5-video-player" style="width:960px;height:540px;position:relative">
  <video class="html5-main-video" style="width:960px;height:540px"></video>
  <div class="ytp-chrome-bottom"><div class="ytp-right-controls">
    <button class="ytp-subtitles-button" aria-pressed="true" title="Legendas"></button>
  </div></div>
</div></body></html>`;

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
  await context.route('https://www.youtube.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: YOUTUBE_HTML }));
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
