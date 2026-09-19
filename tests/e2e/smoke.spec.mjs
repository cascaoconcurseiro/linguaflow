import { expect, test } from '@playwright/test';

test('PWA shell renders the dashboard entry point', async ({ page }) => {
  await page.goto('/dashboard/dashboard.html');
  await expect(page).toHaveTitle(/LinguaFlow/i);
  await expect(page.locator('body')).toBeVisible();
});
