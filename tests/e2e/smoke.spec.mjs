import { expect, test } from '@playwright/test';

test('PWA shell renders the dashboard entry point', async ({ page }) => {
  await page.goto('/dashboard/dashboard.html');
  await expect(page).toHaveTitle(/LinguaFlow/i);
  await expect(page.locator('body')).toBeVisible();
});

test('communication check uses issued task content and handles unavailable audio', async ({ page }) => {
  await page.goto('/tests/fixtures/fluency-preview.html');
  await expect(page.getByRole('heading', {name:'Check de comunicação'})).toBeVisible();
  await page.getByRole('button', {name:'Começar check'}).click();
  await expect(page.getByText('Ela mudou o horário da reunião.')).toBeVisible();
  await page.getByRole('button', {name:'Ouvir mensagem em inglês'}).click();
  await expect(page.getByRole('button', {name:'Ouvir mensagem em inglês'})).toHaveText('Tentar ouvir novamente');
  await expect(page.getByRole('status')).toContainText('Nenhuma tentativa foi consumida');
});
