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

test('página do nível no padrão do sistema: cartão de progresso, métricas, avisos e abas de conteúdo', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A1');
  await page.waitForSelector('.course-level-detail');
  const hero = page.locator('.course-level-hero');
  await expect(hero.locator('.course-level-pill')).toHaveText('A1');
  await expect(hero.getByRole('heading', { name: 'Iniciante' })).toBeVisible();
  await expect(hero.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
  const metrics = page.getByRole('group', { name: 'Resumo do nível A1' });
  await expect(metrics).toContainText('2/3');
  await expect(metrics).toContainText('1/2');
  await expect(page.getByRole('list', { name: 'Avisos do nível' })).toContainText('Sua conquista permanece registrada');
  const tabs = page.getByRole('tablist', { name: 'Tipo de conteúdo' });
  await expect(tabs.getByRole('tab')).toHaveCount(4);
  await expect(tabs.getByRole('tab', { name: 'Base do nível' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Prática extra' }).focus();
  await page.keyboard.press('Enter');
  await expect(tabs.getByRole('tab', { name: 'Prática extra' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Nenhuma aula desta categoria neste nível.').first()).toBeVisible();
  await tabs.getByRole('tab', { name: 'Todos' }).click();
  await expect(page.locator('.course-curriculum-module')).toHaveCount(2);
});

test('página do nível: ícones de estado, barra do módulo e botão primário só na próxima', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A1');
  await page.waitForSelector('.course-level-detail');
  await expect(page.locator('.course-module-num').first()).toHaveText('✓');
  await expect(page.locator('.course-module-bar')).toHaveCount(2);
  await expect(page.locator('details[open] .course-lesson-icon.is-done')).toHaveText('✓');
  await expect(page.locator('details[open] .course-lesson-icon.is-todo')).toBeVisible();
  await expect(page.locator('.course-level-detail .course-btn-primary-lg')).toHaveCount(1);
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A2');
  await page.waitForSelector('.course-level-detail');
  await expect(page.locator('.course-lesson-icon.is-next')).toHaveText('▶');
});

for (const width of [320, 390]) {
  test(`página do nível em ${width} px não rola na horizontal e mantém alvos de toque`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A1');
    await page.waitForSelector('.course-level-detail');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const button of await page.locator('.course-level-detail button').all()) {
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });
}

test('página do nível no tema escuro mantém texto legível nos cartões', async ({ page }) => {
  await page.goto('/tests/fixtures/course-level-path-preview.html#courses/level/A1');
  await page.waitForSelector('.course-level-detail');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const contrast = await page.evaluate(() => {
    const parse = value => value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f = c => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = selector => {
      const el = document.querySelector(selector);
      let bg = el; let color = 'rgba(0, 0, 0, 0)';
      while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(color)) { color = getComputedStyle(bg).backgroundColor; bg = bg.parentElement; }
      const a = lum(parse(getComputedStyle(el).color)); const b = lum(parse(color));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    return ['.course-level-hero .course-hero-title', '.course-curriculum-module summary strong', '.course-lesson-main strong', '.course-metric strong'].map(ratio);
  });
  for (const value of contrast) expect(value).toBeGreaterThanOrEqual(4.5);
});
