// Recomendação A2 e os botões de início usam a aula e seu nível (#528), com catálogo simulado.
import { expect, test } from '@playwright/test';
for (const name of ['Começar', 'Continuar']) {
  test(`${name}: inicia a aula recomendada A2 num curso misto B2`, async ({ page }) => {
    await page.goto(`/tests/fixtures/course-curriculum-preview.html${name === 'Continuar' ? '?resume' : ''}`);
    await page.waitForSelector('html[data-ready="true"]');
    await page.getByRole('button', { name, exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('Presente simples e contínuo');
    await expect(modal.locator('.course-level-pill')).toHaveText('A2');
    await modal.getByRole('button', { name: 'Começar prática', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__preview.navigations[0]?.params.lessonId)).toBe('a2-first');
  });
}
