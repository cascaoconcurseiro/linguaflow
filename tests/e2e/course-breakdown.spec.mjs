import { test, expect } from '@playwright/test';

const open = async (page, query) => {
  await page.route('**/supabase.co/**', route => route.abort());
  await page.goto(`/tests/fixtures/course-breakdown-preview.html?${query}`);
  await page.waitForSelector('html[data-ready="true"]');
};
const reveal = async page => { await page.getByRole('button', { name: /Mostrar resposta/ }).click(); return page.locator('#course-breakdown'); };

test('etapa do exemplo: o painel explica a frase de exemplo praticada, não a palavra', async ({ page }) => {
  await open(page, 'u=0');
  const input = page.locator('#sentence-slots input').first();
  await input.fill('keys'); await input.press('Enter');
  await expect(page.locator('#sentence-slots input')).toHaveCount(4, { timeout: 5000 });
  const panel = await reveal(page);
  await expect(panel).toBeVisible();
  await expect(panel.locator('.course-breakdown-translation')).toHaveText('I lost my keys.');
  await expect(panel).toContainText('Perdi minhas chaves.');
  await expect(panel).toContainText('Palavra desta etapa: keys');
  await expect(panel).toContainText('Plural de key.');
  await expect(panel.locator('.course-structure')).toHaveCount(0);
});

test('sem grupos sintáticos: palavra por palavra, sem seção de estrutura vazia', async ({ page }) => {
  await open(page, 'u=1');
  const panel = await reveal(page);
  await expect(panel.locator('.course-breakdown-translation')).toHaveText('I am here.');
  await expect(panel.getByLabel('Palavra por palavra')).toContainText('estou');
  await expect(panel.getByLabel('Estrutura da frase')).toHaveCount(0);
  await expect(panel).toContainText('Verbo to be.');
  await expect(panel.locator('[data-breakdown-focus]')).toHaveText('Foco da aula: Instruções curtas com imperativo');
});

test('sem grupos nem palavras: mostra tradução e foco da aula, nunca um painel vazio', async ({ page }) => {
  await open(page, 'u=2');
  const panel = await reveal(page);
  await expect(panel).toContainText('Vá agora.');
  await expect(panel.locator('.course-structure')).toHaveCount(0);
  await expect(panel.locator('[data-breakdown-focus]')).toBeVisible();
});

test('sem objetivo da aula não inventa foco', async ({ page }) => {
  await open(page, 'u=2&noobjective');
  const panel = await reveal(page);
  await expect(panel.locator('[data-breakdown-focus]')).toHaveCount(0);
});

test('com grupos sintáticos mostra a estrutura e não repete o foco', async ({ page }) => {
  await open(page, 'u=3');
  const panel = await reveal(page);
  await expect(panel.getByLabel('Estrutura da frase')).toContainText('works');
  await expect(panel.locator('[data-breakdown-focus]')).toHaveCount(0);
});

test('conteúdo HTML da frase e da nota é escapado e mostrar de novo fecha o painel', async ({ page }) => {
  await open(page, 'u=4');
  const panel = await reveal(page);
  await expect(panel.locator('img, script, b')).toHaveCount(0);
  await expect(panel).toContainText('<b>nota</b>');
  await page.getByRole('button', { name: /Mostrar resposta/ }).click();
  await expect(panel).toBeHidden();
});
