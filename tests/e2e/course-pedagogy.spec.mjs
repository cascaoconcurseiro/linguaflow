import { expect, test } from '@playwright/test';
test('módulos filtram a mesma aula e abrem o preparo/player existente',async({page})=>{
 await page.goto('/tests/fixtures/course-pedagogy-preview.html');
 await page.waitForSelector('html[data-ready="true"]');
 await expect(page.locator('details')).toHaveCount(1);
 await page.getByLabel('Tipo de conteúdo').selectOption('optional');
 await expect(page.getByRole('status')).toContainText('Nenhuma aula');
 await page.getByLabel('Nível dos conteúdos').selectOption('B2');
 await expect(page.locator('details')).toHaveCount(2);
 await expect(page.locator('[data-curriculum-modules] img')).toHaveCount(0);
 await expect(page.locator('[data-curriculum-modules] script')).toHaveCount(0);
 await page.getByText('Trabalho',{exact:true}).click();
 await page.getByRole('button',{name:'Praticar aula'}).first().click();
 const modal=page.getByRole('dialog');
 await expect(modal).toContainText('Negociação profissional');
 await expect(modal.locator('.course-level-pill')).toHaveText('B2');
 await modal.getByRole('button',{name:'Começar prática',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__preview.navigations[0]?.params.lessonId)).toBe('optional-b2');
});
test('categoria extra é acessível por teclado e não aparece na base',async({page})=>{
 await page.goto('/tests/fixtures/course-pedagogy-preview.html');
 await expect(page.getByText('Reforço de números')).toHaveCount(0);
 await page.getByLabel('Tipo de conteúdo').selectOption('extra');
 const summary=page.locator('summary');
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(page.getByText('Reforço de números')).toBeVisible();
 await expect(page.getByRole('button',{name:'Praticar aula'})).toBeVisible();
});
