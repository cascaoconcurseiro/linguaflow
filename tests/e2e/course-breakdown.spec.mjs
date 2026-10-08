import { test, expect } from '@playwright/test';

const open = async (page, query) => {
  await page.route('**/supabase.co/**', route => route.abort());
  await page.goto(`/tests/fixtures/course-breakdown-preview.html?${query}`);
  await page.waitForSelector('html[data-ready="true"]');
};
const reveal = async page => { await page.getByRole('button', { name: /Mostrar resposta/ }).click(); return page.locator('#course-breakdown'); };
const wordList = panel => panel.getByRole('group', { name: 'Palavra por palavra' });

test('etapa do exemplo: explica a frase de exemplo e lista suas palavras, não as da palavra', async ({ page }) => {
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
  await expect(wordList(panel).locator('li')).toHaveText([/I[\s\S]*eu/, /lost[\s\S]*perdi/, /my[\s\S]*meu/, /keys[\s\S]*chaves/]);
});

test('sem estrutura: palavra por palavra completo, sem seção de estrutura', async ({ page }) => {
  await open(page, 'u=1');
  const panel = await reveal(page);
  await expect(panel.locator('.course-breakdown-translation')).toHaveText('I am here.');
  await expect(wordList(panel).locator('li')).toHaveCount(3);
  await expect(wordList(panel)).toContainText('estou');
  await expect(panel.getByLabel('Estrutura da frase')).toHaveCount(0);
  await expect(panel).toContainText('Verbo to be.');
  await expect(panel.locator('[data-breakdown-focus]')).toHaveText('Foco da aula: Instruções curtas com imperativo');
});

test('sem anotações: toda palavra aparece mesmo assim, e o foco da aula acompanha', async ({ page }) => {
  await open(page, 'u=2');
  const panel = await reveal(page);
  await expect(panel).toContainText('Vá agora.');
  await expect(wordList(panel).locator('li')).toHaveText([/Go/, /now/]);
  await expect(panel.locator('[data-breakdown-focus]')).toBeVisible();
});

test('sem objetivo da aula não inventa foco', async ({ page }) => {
  await open(page, 'u=2&noobjective');
  const panel = await reveal(page);
  await expect(panel.locator('[data-breakdown-focus]')).toHaveCount(0);
});

test('com estrutura mostra os grupos E a lista palavra por palavra, sem repetir o foco', async ({ page }) => {
  await open(page, 'u=3');
  const panel = await reveal(page);
  const structure = panel.getByLabel('Estrutura da frase');
  await expect(structure).toContainText('works');
  await expect(structure.locator('.course-structure-group')).toHaveCount(2);
  await expect(structure.locator('.course-structure-group').nth(0)).toContainText('ela');
  await expect(structure.locator('.course-structure-group').nth(1)).toContainText('trabalha');
  await expect(wordList(panel).locator('li')).toHaveCount(2);
  await expect(panel.locator('[data-breakdown-focus]')).toHaveCount(0);
});

test('hífen, apóstrofo e pontuação: cada palavra uma vez, sem a pontuação colada', async ({ page }) => {
  await open(page, 'u=4');
  const panel = await reveal(page);
  await expect(wordList(panel).locator('li')).toHaveText([/It's[\s\S]*é/, /a[\s\S]*um/, /rip-off[\s\S]*roubo/, /Ana/]);
});

test('conteúdo HTML da frase e da nota é escapado e mostrar de novo fecha o painel', async ({ page }) => {
  await open(page, 'u=5');
  const panel = await reveal(page);
  await expect(panel.locator('img, script, b')).toHaveCount(0);
  await expect(panel).toContainText('<b>nota</b>');
  await page.getByRole('button', { name: /Mostrar resposta/ }).click();
  await expect(panel).toBeHidden();
});
