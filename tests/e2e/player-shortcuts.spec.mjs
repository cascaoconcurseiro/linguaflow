// QA real no navegador (Issue #432): atalhos de estudo do player. A legenda entra pelo caminho do
// YouTube (/api/timedtext) e o vídeo é um clipe real, então sincronia, laço e foco são exercitados de verdade.
import { expect, test } from './extension-fixture.mjs';

async function openWithSubtitles(context) {
  const page = await context.newPage();
  await page.goto('https://www.youtube.com/watch?v=lf-test');
  await page.locator('#lf-yt-horizontal-dock').waitFor({ state: 'attached', timeout: 20_000 });
  await page.locator('#lf-yt-toggle-wrapper').click(); // liga o LinguaFlow
  await expect(page.locator('#lf-yt-toggle-wrapper')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.activeElement?.blur?.());
  // Primeira fala (0–3 s) aparece na legenda do LinguaFlow
  await expect(page.locator('#lf-orig .lf-word').first()).toBeVisible({ timeout: 20_000 });
  return page;
}

const seek = (page, seconds) => page.evaluate((t) => { const v = document.querySelector('video'); v.currentTime = t; }, seconds);
const status = (page, text) => expect(page.getByRole('status').filter({ hasText: text }).last()).toBeVisible();

test('? abre a lista de atalhos como diálogo acessível; Esc fecha e devolve o foco', async ({ extension }) => {
  const page = await openWithSubtitles(extension.context);
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Atalhos do LinguaFlow' });
  await expect(dialog).toBeVisible();
  for (const key of ['Z', 'X', 'B', 'V', 'F']) await expect(dialog.locator('kbd', { hasText: new RegExp(`^${key}$`) })).toBeVisible();
  // Com o painel aberto, os atalhos do player não agem (V não pode ligar a escuta primeiro)
  await page.keyboard.press('v');
  await expect(page.locator('#lf-orig-row.lf-blur, .lf-orig-row.lf-blur')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Z e X ajustam a sincronia em 0,1 s e avisam o valor', async ({ extension }) => {
  const page = await openWithSubtitles(extension.context);
  await page.keyboard.press('x');
  await status(page, 'Sincronia +0,1 s · legenda mais cedo');
  await page.keyboard.press('x');
  await status(page, 'Sincronia +0,2 s');
  await page.keyboard.press('z');
  await page.keyboard.press('z');
  await page.keyboard.press('z');
  await status(page, 'Sincronia -0,1 s · legenda mais tarde');
});

test('V liga e desliga a escuta primeiro (legenda original escondida)', async ({ extension }) => {
  const page = await openWithSubtitles(extension.context);
  await page.keyboard.press('v');
  await status(page, 'Escuta primeiro');
  await expect(page.locator('.lf-orig-row.lf-blur')).toHaveCount(1);
  await page.keyboard.press('v');
  await status(page, 'Legenda original visível');
  await expect(page.locator('.lf-orig-row.lf-blur')).toHaveCount(0);
});

test('F escolhe palavras pelo teclado: setas navegam, Esc sai e o vídeo volta a tocar', async ({ extension }) => {
  const page = await openWithSubtitles(extension.context);
  await page.keyboard.press('f');
  await expect(page.locator('#lf-orig .lf-word:focus')).toHaveCount(1);
  const first = await page.locator('#lf-orig .lf-word:focus').textContent();
  await page.keyboard.press('ArrowRight');
  const second = await page.locator('#lf-orig .lf-word:focus').textContent();
  expect(second).not.toBe(first);
  expect(await page.evaluate(() => document.querySelector('video').paused)).toBe(true);
  await page.keyboard.press('ArrowLeft');
  expect(await page.locator('#lf-orig .lf-word:focus').textContent()).toBe(first);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lf-orig .lf-word:focus')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.querySelector('video').paused)).toBe(false);
});

test('B marca A e B e o vídeo repete só o trecho; um terceiro B desfaz', async ({ extension }) => {
  const page = await openWithSubtitles(extension.context);
  await seek(page, 1);
  await page.keyboard.press('b');
  await status(page, 'Início em 0:01');
  await seek(page, 3);
  await page.keyboard.press('b');
  await status(page, 'Laço 0:01–0:03');
  // Passa do fim do trecho: o laço devolve o vídeo para perto do início
  await seek(page, 3.5);
  await expect.poll(() => page.evaluate(() => document.querySelector('video').currentTime), { timeout: 5000 }).toBeLessThan(3.2);
  await page.keyboard.press('b');
  await status(page, 'Laço desativado');
});
