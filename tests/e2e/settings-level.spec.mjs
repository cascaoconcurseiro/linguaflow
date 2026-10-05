// tests/e2e/settings-level.spec.mjs — QA no navegador das Configurações (#498): só o seletor manual de nível, sem teste de nível.
import { expect, test } from '@playwright/test';

test('Configurações: seletor manual A1–C2, sem teste de nível, e escolher um nível salva', async ({ page }) => {
  await page.goto('/tests/fixtures/settings-preview.html');
  await page.waitForSelector('html[data-ready="true"]');
  const group = page.getByRole('group', { name: 'Nível CEFR' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('button')).toHaveCount(6);
  await expect(group.getByRole('button', { name: /^A2/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Não é uma avaliação formal e não precisa ser exato.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Estimar meu nível/ })).toHaveCount(0);
  await expect(page.locator('#btn-placement')).toHaveCount(0);

  await group.getByRole('button', { name: /^B1/ }).click();
  await expect(group.getByRole('button', { name: /^B1/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__preview.store.lf_cefr_level)).toBe('B1');
  expect(await page.evaluate(() => window.__preview.store.cefrTargetLevel)).toBe('B1');
  expect(await page.evaluate(() => window.__preview.toasts.join(' '))).toContain('Nível B1');
  expect(await page.evaluate(() => window.__preview.errors)).toEqual([]);
});
