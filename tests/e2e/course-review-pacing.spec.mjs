// tests/e2e/course-review-pacing.spec.mjs — QA no navegador da meta diária de revisão do curso (#501): aba Revisão real, banco simulado por cenário.
import { expect, test } from '@playwright/test';

const open = async (page, scenario) => {
  await page.goto(`/tests/fixtures/course-review-preview.html?scenario=${scenario}`);
  await page.waitForSelector('html[data-ready="true"]');
};
const modal = (page) => page.locator('#course-prepare-modal-root');

test('meta de hoje: 20 de 30, o resto fica na fila e a sessão pega as mais antigas', async ({ page }) => {
  await open(page, 'cap');
  const today = page.locator('section', { has: page.getByRole('heading', { name: 'Para hoje' }) });
  await expect(today).toContainText('20 frases para hoje');
  await expect(today).toContainText('Mais 10 ficam na fila');
  await page.getByRole('button', { name: 'Revisar 20 agora' }).click();
  await expect(modal(page)).toContainText('20 frases');
  await expect(modal(page)).not.toContainText('30 frases');
});

test('meta parcial: depois de 12 feitas hoje restam 8', async ({ page }) => {
  await open(page, 'partial');
  await expect(page.getByText('8 frases para hoje')).toBeVisible();
  await page.getByRole('button', { name: 'Revisar 8 agora' }).click();
  await expect(modal(page)).toContainText('8 frases');
});

test('meta cumprida: aviso anunciável, nada bloqueado e "Revisar mais 10" opcional', async ({ page }) => {
  await open(page, 'goaldone');
  const status = page.getByRole('status').filter({ hasText: 'Meta de hoje feita' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('30 frases ficam na fila');
  await expect(page.getByRole('button', { name: /Revisar \d+ agora/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar mais 10 (opcional)' }).click();
  await expect(modal(page)).toContainText('10 frases');
});

test('atraso: avisa quantas esperam há mais de 7 dias, sem alarmar', async ({ page }) => {
  await open(page, 'overdue');
  await expect(page.getByRole('status').filter({ hasText: '4 frases esperam há mais de 7 dias' })).toBeVisible();
});

test('sem os campos novos (migration ainda não publicada): comportamento anterior', async ({ page }) => {
  await open(page, 'legacy');
  await expect(page.getByText('12 frases vencidas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar 12 agora' })).toBeVisible();
  await expect(page.getByText('Meta de hoje')).toHaveCount(0);
});

test('resumo fora do ar: a aba continua útil com a lista completa', async ({ page }) => {
  await open(page, 'nosummary');
  await expect(page.getByText('12 frases vencidas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar 12 agora' })).toBeVisible();
});

test('vazio e erro: mensagens explícitas, com nova tentativa no erro', async ({ page }) => {
  await open(page, 'empty');
  await expect(page.getByText('Nenhuma frase em revisão ainda')).toBeVisible();
  await open(page, 'error');
  await expect(page.getByRole('button', { name: /tentar/i })).toBeVisible();
});

test('teclado e celular: botão principal alcançável por Tab e sem rolagem horizontal em 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, 'cap');
  const primary = page.getByRole('button', { name: 'Revisar 20 agora' });
  for (let i = 0; i < 20 && !(await primary.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(primary).toBeFocused();
  expect(await primary.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press('Enter');
  await expect(modal(page)).toContainText('20 frases');
});

test('conteúdo HTML das frases é escapado', async ({ page }) => {
  await open(page, 'cap');
  await expect(page.locator('.course-notebook-sentence b')).toHaveCount(0);
});
