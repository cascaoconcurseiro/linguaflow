import { expect, test } from '@playwright/test';

test.describe('Jornada do Leitor (Web Reader)', () => {
  test('adiciona novo texto, lê com palavras interativas e marca conclusão', async ({ page }) => {
    // 1. Acessa o leitor através da fixture
    await page.goto('/tests/fixtures/reader-preview.html');
    await expect(page).toHaveTitle(/Web Reader/i);

    // 2. Preenche e salva um novo texto para leitura
    const titleInput = page.locator('#rd-title');
    const contentInput = page.locator('#rd-content');
    const addBtn = page.locator('#rd-add');

    await expect(contentInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill('Capítulo 1 - A Jornada');
    await contentInput.fill('Every morning brings new possibilities. Learning a language requires consistency and curiosity.');
    await addBtn.click();

    // 3. O leitor deve abrir o texto com título e palavras tokenizadas
    const viewTitle = page.locator('#rd-view-title');
    await expect(viewTitle).toHaveText('Capítulo 1 - A Jornada');

    const firstWord = page.locator('#rd-view-body .rw').first();
    await expect(firstWord).toBeVisible();

    // 4. Controles de progresso visíveis
    const progressEl = page.locator('#rd-reading-progress');
    const completeBtn = page.locator('#rd-mark-completed');

    await expect(progressEl).toBeVisible();
    await expect(completeBtn).toBeVisible();
    await expect(completeBtn).toHaveText(/Marcar como lido/i);

    // 5. Marca como concluído
    await completeBtn.click();
    await expect(progressEl).toHaveText(/100% lido ✓/i);
    await expect(completeBtn).toHaveText(/Marcar como não lido/i);

    // 6. Volta para a estante e verifica o badge de concluído
    const backBtn = page.locator('#rd-back');
    await backBtn.click();
    await expect(page.locator('#reader-shelf')).toBeVisible();
    await expect(page.locator('.rd-badge-completed')).toBeVisible();
  });
});
