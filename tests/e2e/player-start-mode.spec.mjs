// QA real no navegador (Issues #418–#424): a extensão é carregada de verdade; as páginas dos
// players são fixtures servidas nos domínios do YouTube e da Netflix.
import { expect, launchExtension, test } from './extension-fixture.mjs';

const WATCH = 'https://www.youtube.com/watch?v=lf-test';

async function openPlayer(context, url = WATCH) {
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('#lf-yt-horizontal-dock, #lf-max-controls').first().waitFor({ state: 'attached', timeout: 20_000 });
  return page;
}

test('começa desligado: só o botão LF aparece e o CC memorizado pelo YouTube é desligado (#438)', async ({ extension }) => {
  const page = await openPlayer(extension.context);
  const dock = page.locator('#lf-yt-horizontal-dock');
  const toggle = page.locator('#lf-yt-toggle-wrapper');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(dock).toHaveClass(/lf-off/);
  for (const action of ['previous', 'loop', 'next', 'speed', 'panel', 'settings']) {
    await expect(dock.locator(`[data-action="${action}"]`)).toBeHidden();
  }
  await expect(page.locator('.ytp-subtitles-button')).toHaveAttribute('aria-pressed', 'false');
});

test('desligado, o CC ligado pelo próprio usuário é respeitado (#438)', async ({ extension }) => {
  const page = await openPlayer(extension.context);
  const cc = page.locator('.ytp-subtitles-button');
  await expect(cc).toHaveAttribute('aria-pressed', 'false');
  await cc.click();
  await expect(cc).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    video.pause();
    return video.play().catch(() => {});
  });
  await page.waitForTimeout(1200);
  await expect(cc).toHaveAttribute('aria-pressed', 'true');
});

test('ligar avisa o atalho com Shift + ? (#439)', async ({ extension }) => {
  const page = await openPlayer(extension.context);
  await page.locator('#lf-yt-toggle-wrapper').click();
  await expect(page.getByRole('status').filter({ hasText: 'Shift + ? mostra os atalhos' })).toBeVisible();
  await expect(page.locator('.ytp-subtitles-button')).toHaveAttribute('aria-pressed', 'true');
});

test('ligar mostra os controles, avisa o usuário e vale para o próximo vídeo e outra aba', async ({ extension }) => {
  const page = await openPlayer(extension.context);
  await page.locator('#lf-yt-toggle-wrapper').click();
  await expect(page.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'LinguaFlow ligado' })).toBeVisible();
  for (const action of ['previous', 'loop', 'next', 'speed', 'panel', 'settings']) {
    await expect(page.locator(`#lf-yt-horizontal-dock [data-action="${action}"]`)).toBeVisible();
  }

  const second = await openPlayer(extension.context, `${WATCH}-2`);
  await expect(second.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'true');
  await expect(second.locator('#lf-yt-horizontal-dock')).not.toHaveClass(/lf-off/);
});

test('fechar o navegador volta a desligado', async ({ extension }) => {
  const first = await openPlayer(extension.context);
  await first.locator('#lf-yt-toggle-wrapper').click();
  await expect(first.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'true');

  const fresh = await launchExtension(); // novo navegador = sessão nova
  try {
    const page = await openPlayer(fresh.context);
    await expect(page.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await fresh.close();
  }
});

test('desligado, atalhos do player não são interceptados; C liga', async ({ extension }) => {
  const page = await openPlayer(extension.context);
  const intercepted = await page.evaluate(() => new Promise((resolve) => {
    const seen = [];
    window.addEventListener('keydown', (e) => seen.push(e.defaultPrevented), { once: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l', bubbles: true, cancelable: true }));
    setTimeout(() => resolve(seen), 50);
  }));
  expect(intercepted.every((prevented) => prevented === false)).toBe(true);
  await page.keyboard.press('c');
  await expect(page.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'true');
});

test('Netflix: dock lateral aparece desligado e liga com um clique', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto('https://www.netflix.com/watch/123');
  const toggle = page.locator('#lf-max-controls [data-action="toggle"]');
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lf-max-controls [data-action="panel"]')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lf-max-controls [data-action="panel"]')).toBeVisible();
});
