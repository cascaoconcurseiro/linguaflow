// tests/e2e/today-plan.spec.mjs — QA no navegador do Plano de hoje (#495): renderiza o Início real com banco simulado por cenário.
import { expect, test } from '@playwright/test';

const open = async (page, scenario) => {
  await page.goto(`/tests/fixtures/today-plan-preview.html?scenario=${scenario}`);
  await page.waitForSelector('html[data-ready="true"]');
};

// Contraste WCAG calculado no navegador a partir dos estilos reais.
const contrast = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bg = el; let bgc = 'rgba(0, 0, 0, 0)';
  while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(bgc)) { bgc = getComputedStyle(bg).backgroundColor; bg = bg.parentElement; }
  const fg = lum(parse(getComputedStyle(el).color)); const back = lum(parse(bgc));
  return (Math.max(fg, back) + 0.05) / (Math.min(fg, back) + 0.05);
}, selector);

test('fila vencida: plano com 3 passos na ordem, tempo e teto diário de revisões', async ({ page }) => {
  await open(page, 'backlog');
  const plan = page.locator('#home-primary-plan');
  await expect(plan).toHaveAttribute('data-plan-kind', 'today-pending');
  await expect(plan.getByRole('heading', { level: 1 })).toContainText(/Cerca de \d+ min hoje/);
  const items = plan.getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Revisar cards');
  await expect(items.nth(0)).toContainText('41 cards');
  await expect(items.nth(0)).toContainText('6 voltando em minutos');
  await expect(items.nth(0)).toContainText('mais 39 ficam para outro dia');
  await expect(items.nth(1)).toContainText('Revisar frases do curso');
  await expect(items.nth(1)).toContainText('6 revisões vencidas');
  await expect(items.nth(2)).toContainText('Próxima lição do curso');
  await expect(items.nth(2)).toContainText('Capítulo 3: Cumprimentos');
  await expect(plan.locator('.today-steps b')).toHaveCount(0); // HTML do conteúdo do curso é escapado
});

test('teclado: Tab chega ao botão principal com foco visível e Enter abre a rota certa', async ({ page }) => {
  await open(page, 'backlog');
  const primary = page.getByRole('button', { name: 'Começar: Revisar cards' });
  for (let i = 0; i < 30 && !(await primary.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(primary).toBeFocused();
  const outline = await primary.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Ir para: Revisar frases do curso' }).click();
  await page.getByRole('button', { name: 'Ir para: Próxima lição do curso' }).click();
  const nav = await page.evaluate(() => window.__preview.navigations);
  expect(nav).toEqual([
    { route: 'study', params: null },
    { route: 'courses', params: { tab: 'review' } },
    { route: 'courses', params: { tab: 'course', courseId: 'c1', openLessonId: 'l1' } },
  ]);
  expect(await page.evaluate(() => window.__preview.events)).toContain('today_plan_step');
});

test('celular 375 px: sem rolagem horizontal e todos os botões ao alcance', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, 'backlog');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const name of ['Começar: Revisar cards', 'Ir para: Revisar frases do curso', 'Ir para: Próxima lição do curso']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44 - 1);
    expect(box.height).toBeGreaterThanOrEqual(44 - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  }
  await page.screenshot({ path: process.env.E2E_SHOT_DIR ? `${process.env.E2E_SHOT_DIR}/plan-mobile.png` : undefined });
});

test('contraste do texto do plano passa WCAG AA (4,5:1)', async ({ page }) => {
  await open(page, 'backlog');
  for (const sel of ['.today-step-body strong', '.today-step-body span', '.today-step-time', '.today-step-num', '.home-primary-reason']) {
    expect(await contrast(page, sel), sel).toBeGreaterThanOrEqual(4.5);
  }
});

test('movimento reduzido: o plano não anima nada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'backlog');
  const anim = await page.locator('.today-step').first().evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).transitionDuration]);
  expect(anim[0]).toBe('none');
  expect(anim[1]).toBe('0s');
});

test('sem nada vencido e lição feita: "Acabou por hoje", opcional claramente marcado', async ({ page }) => {
  await open(page, 'done');
  const plan = page.locator('#home-primary-plan');
  await expect(plan).toHaveAttribute('data-plan-kind', 'today-done');
  await expect(plan.getByRole('heading', { level: 1 })).toHaveText('Acabou por hoje');
  await expect(plan.getByRole('listitem')).toHaveCount(0);
  await expect(plan.getByText('OPCIONAL', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__preview.events)).toContain('today_plan_done');
});

test('chave desligada: o Início volta ao bloco antigo, com o curso ao lado', async ({ page }) => {
  await open(page, 'flagoff');
  await expect(page.locator('.today-steps')).toHaveCount(0);
  await expect(page.locator('#btn-study-now')).toBeVisible();
  await expect(page.locator('.home-course-strip')).toBeVisible();
});

test('palavras seguradas pelo freio aparecem como aviso anunciável, sem sumir', async ({ page }) => {
  await open(page, 'held');
  const note = page.locator('#home-primary-plan .today-note[role="status"]');
  await expect(note).toContainText('3 palavras novas esperam');
  await expect(note).toContainText('nada se perde');
  expect(await page.evaluate(() => window.__preview.settings.lf_intake_release_state ?? null)).toBeNull(); // dívida alta: nada liberado
});

test('curso fora do ar: avisa e o plano continua com os cards', async ({ page }) => {
  await open(page, 'courseerror');
  const plan = page.locator('#home-primary-plan');
  await expect(plan.getByRole('listitem')).toHaveCount(1);
  await expect(plan.getByRole('status')).toContainText('O curso não carregou agora');
  await expect(plan.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
});

test('meta diária do curso (#501): plano e faixa mostram a meta de hoje e a fila separada', async ({ page }) => {
  await open(page, 'coursecap');
  const plan = page.locator('#home-primary-plan');
  const step = plan.getByRole('listitem').filter({ hasText: 'Revisar frases do curso' });
  await expect(step).toContainText('20 revisões');
  await expect(step).toContainText('mais 184 ficam para outro dia');
});

test('meta diária do curso (#501): a faixa do Início (plano desligado) mostra a meta e a fila, nunca o total cru', async ({ page }) => {
  await open(page, 'coursecapoff');
  const counts = page.locator('.home-course-counts');
  await expect(counts).toContainText('20 revisões para hoje · +184 na fila');
  await expect(counts).not.toContainText('204');
});
