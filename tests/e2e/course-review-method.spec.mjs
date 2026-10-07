import { test, expect } from '@playwright/test';

test('reforço reaparece no player, não duplica meta, pontos nem resultados enviados', async ({ page }) => {
  await page.route('**/supabase.co/**', (route) => route.abort());
  await page.goto('/tests/fixtures/course-review-method-preview.html');
  await page.waitForSelector('html[data-ready="true"]');
  const input = page.locator('#sentence-slots input').first();
  const answer = async (text, next) => {
    await input.fill(text);
    await input.press('Enter');
    await expect(page.locator('#course-question')).toHaveText(next);
  };
  await input.fill('wrong'); await input.press('Enter');
  await expect(page.locator('#sentence-slots input.is-wrong')).toHaveCount(1);
  await answer('one', '2 / 5');
  await answer('two', '3 / 5');
  await answer('three', '4 / 5');
  await expect(page.getByText(/Reforço: tente novamente/)).toBeVisible();
  await answer('one', '5 / 5');
  await input.fill('four'); await input.press('Enter');
  await expect(page.getByText('Revisão salva.')).toBeVisible();
  const commits = await page.evaluate(() => window.__review.commits);
  expect(commits).toHaveLength(1);
  expect(commits[0].results).toHaveLength(4);
  expect(commits[0].results[0].attempts).toBe(2);
  expect(commits[0].results[0].wrong_text).toBe('wrong');
  expect(commits[0].score).toBe(475);
});
