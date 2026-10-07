import { expect, test } from '@playwright/test';

test('nível abre página própria com progresso por aula e restaura após recarregar', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html');
  const path = page.locator('.course-path');
  await expect(path.locator('[data-course-curriculum]')).toHaveCount(0);
  await expect(page.locator('[data-course-curriculum]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver aulas do nível A1' }).click();
  await expect(page).toHaveURL(/#courses\/level\/A1$/);
  await expect(page.getByRole('heading', { name: 'Nível A1', exact: true })).toBeVisible();
  await page.reload();
  const levelPage = page.locator('.course-level-detail');
  await page.getByText('Apresentação', { exact: true }).click();
  await expect(levelPage.getByText('Concluída', { exact: true })).toBeVisible();
  await expect(levelPage.getByText('A fazer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à trilha' }).click();
  await page.getByRole('button', { name: 'Ver aulas do nível A2' }).click();
  await page.getByText('Rotinas', { exact: true }).click();
  await page.getByRole('button', { name: 'Fazer próxima aula' }).click();
  await expect(page.getByRole('dialog')).toContainText('Rotina A2');
  await page.getByRole('button', { name: 'Começar prática', exact: true }).click();
  expect(await page.evaluate(() => window.__preview.navigations[0].params.returnLevel)).toBe('A2');
});
test('evolução preserva conclusão e permite voltar a qualquer nível', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html?mine');
  const history = page.getByRole('region', { name: 'Sua evolução por nível' });
  await expect(history).toContainText('Base concluída');
  await expect(history).toContainText('1 aula acrescentada');
  await expect(history).toContainText('Dispensado pelo nível escolhido');
  await history.getByRole('button', { name: 'Ver aulas do nível A1' }).click();
  await expect(page).toHaveURL(/#courses\/level\/A1$/);
});
test('seleção de nível funciona por teclado no celular sem overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/fixtures/course-level-path-preview.html');
  const level = page.getByRole('button', { name: 'Ver aulas do nível A1' });
  await level.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#courses\/level\/A1$/);
  await expect(page.locator('#course-area-panel')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('falha da trilha permite recuperação e cursos vazios preservam evolução', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html?offline');
  await expect(page.getByText('A trilha não carregou.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Recarregar trilha' }).click();
  await expect(page.getByRole('button', { name: 'Ver aulas do nível A2' })).toBeVisible();
  await page.goto('/tests/fixtures/course-level-path-preview.html?mine&empty');
  await expect(page.getByRole('region', { name: 'Sua evolução por nível' })).toBeVisible();
  await expect(page.getByText('Você ainda não tem cursos', { exact: true })).toBeVisible();
});
