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
  const openModule = levelPage.locator('details[open]');
  await expect(openModule.getByText('Concluída', { exact: true })).toBeVisible();
  await expect(openModule.getByText('A fazer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à trilha' }).click();
  await page.getByRole('button', { name: 'Ver aulas do nível A2' }).click();
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

test('página do nível: módulo atual aberto, concluído recolhido, chips e um único botão primário', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A1');
  await page.waitForSelector('.course-level-detail');
  const modules = page.locator('.course-curriculum-module');
  await expect(modules).toHaveCount(2);
  const done = modules.filter({ hasText: 'Primeiros contatos' });
  const current = modules.filter({ hasText: 'Apresentação' });
  await expect(done).not.toHaveAttribute('open', '');
  await expect(done).toContainText('Módulo concluído');
  await expect(current).toHaveAttribute('open', '');
  await expect(current).toContainText('Módulo atual');
  await expect(current.locator('.course-chip-kind').first()).toHaveText('Aula');
  await done.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(done).toHaveAttribute('open', '');
  await expect(done.locator('.course-chip-kind')).toHaveText('Gramática');
  await expect(done.locator('.course-chip', { hasText: 'Introdução' })).toBeVisible();
  await expect(done.getByRole('button', { name: /Revisar aula: Cumprimentos/ })).toBeVisible();
});

test('página do nível A2: próxima aula tem destaque, pré-requisitos e tipo; demais ficam sem botão primário', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A2');
  await page.waitForSelector('.course-level-detail');
  const next = page.locator('.course-lesson-row.is-next');
  await expect(next).toHaveCount(1);
  await expect(next).toContainText('Antes: Eu sou, você é');
  await expect(next.locator('.course-lesson-status')).toHaveText('Próxima recomendada');
  await expect(page.locator('.course-curriculum-lessons .course-btn-primary-lg')).toHaveCount(1);
});

test('início do curso: continuar, trilha e hoje; sem métricas nem recentes e próxima aula uma vez', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html');
  await page.waitForSelector('.course-path');
  await expect(page.getByRole('heading', { name: 'Continue seu curso' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.locator('.course-metrics')).toHaveCount(0);
  await expect(page.getByText('Estudados recentemente')).toHaveCount(0);
  await expect(page.locator('[data-continue], [data-path-next]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Meus cursos e evolução →' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tempo e análise →' })).toBeVisible();
  await page.getByRole('button', { name: 'Tempo e análise →' }).click();
  await expect(page.getByRole('heading', { name: 'Análise' })).toBeVisible();
});
