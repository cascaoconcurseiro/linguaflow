import { test, expect } from '@playwright/test';
async function finish(page,mode=''){
 await page.route('**/supabase.co/**',route=>route.abort());
 await page.goto(`/tests/fixtures/course-completion-preview.html?mode=${mode}`);
 await page.waitForSelector('html[data-ready="true"]');
 const input=page.locator('#sentence-slots input').first();await input.fill('hello');await input.press('Enter');
 await expect(page.locator('#course-commit-status')).toBeVisible();
}
test('conclusão consulta trilha depois de salvar e abre preparo em outro curso',async({page})=>{
 await finish(page);await expect(page.locator('#btn-next-lesson')).toBeHidden();
 expect(await page.evaluate(()=>window.__completion.reads)).toBe(0);
 await page.evaluate(()=>window.__completion.release());
 await expect(page.locator('#course-next-status')).toContainText('Aplicação no próximo curso');
 await page.getByRole('button',{name:'Continuar para esta aula'}).click();
 expect(await page.evaluate(()=>window.__completion.navigations)).toEqual([{route:'courses',params:{tab:'course',courseId:'other535',openLessonId:'next535'}}]);
});
test('erro apenas na recomendação permite retry sem duplicar commit',async({page})=>{
 await finish(page,'next-error');await page.evaluate(()=>window.__completion.release());
 await page.getByRole('button',{name:'Tentar buscar próxima aula'}).click();
 await expect(page.getByRole('button',{name:'Continuar para esta aula'})).toBeVisible();
 expect(await page.evaluate(()=>window.__completion.commits)).toBe(1);
});
test('erro de gravação mantém sessão local; não oferece próxima aula até salvar',async({page})=>{
 await finish(page,'save-error');await expect(page.locator('#btn-retry-commit')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lf_course_pending_commit')).lessonId)).toBe('l535');
 await expect(page.locator('#btn-next-lesson')).toBeHidden();
 await page.locator('#btn-retry-commit').click();await page.evaluate(()=>window.__completion.release());
 await expect(page.locator('#btn-next-lesson')).toBeVisible();
 expect(await page.evaluate(()=>window.__completion.commits)).toBe(2);
});
test('sem próxima aula oferece finalizar; saída durante save ignora resposta tardia',async({page})=>{
 await finish(page,'done');await page.evaluate(()=>window.__completion.release());
 await expect(page.locator('#course-next-status')).toContainText('base disponível');
 await expect(page.locator('#btn-next-lesson')).toBeHidden();await page.getByRole('button',{name:'Finalizar por hoje'}).click();
 expect(await page.evaluate(()=>window.__completion.navigations[0].route)).toBe('courses');
 await finish(page);await page.getByRole('button',{name:'Finalizar por hoje'}).click();
 await page.evaluate(()=>window.__completion.release());
 expect(await page.evaluate(()=>window.__completion.reads)).toBe(0);
});
