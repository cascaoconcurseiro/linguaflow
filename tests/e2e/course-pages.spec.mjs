// Páginas do curso (#544): navegação lateral, loja, Meus cursos, detalhe, cadernos, análise e ranking,
// cada uma com dados, vazio, falha com recuperação e ações.
import { test, expect } from '@playwright/test';

const open = async (page, hash = '', query = '') => {
  await page.route('**/supabase.co/**', route => route.abort());
  await page.goto(`/tests/fixtures/course-pages-preview.html${query ? `?${query}` : ''}${hash}`);
  await page.waitForSelector('html[data-ready="true"]');
  await page.waitForSelector('#course-area-panel');
};
const pages = (page, key) => page.evaluate(k => window.__pages[k], key);
const nav = (page, name) => page.getByRole('navigation', { name: 'Seções de Cursos' }).getByRole('button', { name: new RegExp(`^${name}`) });

test.describe('navegação lateral', () => {
  test('lista todas as seções, marca a atual e troca de página com foco no painel', async ({ page }) => {
    await open(page);
    for (const name of ['Início', 'Meus cursos', 'Loja de cursos', 'Análise', 'Revisão', 'Erros', 'Vocabulário', 'Notas', 'Ranking']) await expect(nav(page, name)).toBeVisible();
    await expect(nav(page, 'Início')).toHaveAttribute('aria-current', 'page');
    await nav(page, 'Loja de cursos').click();
    await expect(page.getByRole('heading', { name: 'Loja de cursos', level: 1 })).toBeVisible();
    await expect(nav(page, 'Loja de cursos')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#course-area-panel')).toBeFocused();
  });
  test('selos de pendência aparecem em Revisão e Erros', async ({ page }) => {
    await open(page);
    await expect(nav(page, 'Revisão').locator('.course-tab-badge')).toBeVisible();
    await expect(nav(page, 'Erros').locator('.course-tab-badge')).toHaveText('2');
  });
  test('rota direta abre a seção e voltar do navegador restaura a anterior', async ({ page }) => {
    await open(page, '#courses/store');
    await expect(page.getByRole('heading', { name: 'Loja de cursos', level: 1 })).toBeVisible();
    await nav(page, 'Ranking').click();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Loja de cursos', level: 1 })).toBeVisible();
  });
});

test.describe('loja', () => {
  test('agrupa por trilha, conta cursos e filtra por busca, nível, trilha e ordenação', async ({ page }) => {
    await open(page, '#courses/store');
    await expect(page.locator('#course-store-count')).toHaveText('3 cursos');
    await page.getByRole('searchbox', { name: /Buscar cursos/ }).fill('comida');
    await expect(page.locator('#course-store-count')).toHaveText('1 curso');
    await expect(page.getByRole('heading', { name: 'Comida A2' })).toBeVisible();
    await page.getByRole('searchbox', { name: /Buscar cursos/ }).fill('zzz');
    await expect(page.getByText('Nenhum curso encontrado com esses filtros.')).toBeVisible();
    await page.getByRole('searchbox', { name: /Buscar cursos/ }).fill('');
    await page.locator('#course-level').selectOption('B1');
    await expect(page.locator('#course-store-count')).toHaveText('1 curso');
    await page.locator('#course-level').selectOption('');
    await page.locator('#course-sort').selectOption('popular');
    await expect(page.locator('.course-card-title').first()).toHaveText('Comida A2');
    await page.getByRole('tab', { name: 'Todas as trilhas' }).click();
    await expect(page.getByRole('tab', { name: 'Todas as trilhas' })).toHaveAttribute('aria-selected', 'true');
  });
  test('adicionar e remover de Meus cursos chama o serviço, avisa e atualiza o botão', async ({ page }) => {
    await open(page, '#courses/store');
    const food = page.locator('article', { hasText: 'Comida A2' });
    await food.getByRole('button', { name: /Adicionar a Meus cursos/ }).click();
    await expect(page.locator('article', { hasText: 'Comida A2' }).getByRole('button', { name: /Remover de Meus cursos/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await pages(page, 'calls')).toContainEqual(['setInMyCourses', 'c-food', true]);
    expect((await pages(page, 'toasts')).at(-1)).toMatchObject({ type: 'success' });
  });
  test('abrir curso mostra o detalhe com capítulos, progresso e ações', async ({ page }) => {
    await open(page, '#courses/store');
    await page.locator('article', { hasText: 'Cumprimentos A1' }).getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Cumprimentos A1', level: 2 })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Progresso no curso' })).toHaveAttribute('aria-valuenow', '50');
    await expect(page.locator('.course-chapter')).toHaveCount(2);
    await expect(page.locator('.course-chapter.is-done')).toHaveCount(1);
    await expect(page.locator('.course-chapter').nth(1)).toContainText('Próximo');
    await page.getByRole('button', { name: 'Praticar capítulo' }).nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '← Loja de cursos' }).click().catch(() => {});
  });
  test('curso inexistente mostra aviso e volta à loja', async ({ page }) => {
    await open(page, '#courses/course/nao-existe');
    await expect(page.getByText('Curso não encontrado')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à loja' }).click();
    await expect(page.getByRole('heading', { name: 'Loja de cursos', level: 1 })).toBeVisible();
  });
});

test.describe('meus cursos', () => {
  test('abas filtram por situação e a busca filtra por título', async ({ page }) => {
    await open(page, '#courses/my-courses');
    await expect(page.getByRole('heading', { name: 'Cursos que você acompanha' })).toBeVisible();
    await expect(page.locator('.course-card')).toHaveCount(2);
    await page.getByRole('tab', { name: /Concluídos/ }).click();
    await expect(page.locator('.course-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Verbos B1 concluído' })).toBeVisible();
    await page.getByRole('tab', { name: /Em andamento/ }).click();
    await expect(page.getByRole('heading', { name: 'Cumprimentos A1' })).toBeVisible();
    await page.getByRole('tab', { name: /Não iniciados/ }).click();
    await expect(page.getByText('Nenhum curso nesta aba.')).toBeVisible();
  });
  test('sem cursos mostra estado vazio com caminho para a loja', async ({ page }) => {
    await open(page, '#courses/my-courses', 'empty');
    await expect(page.getByText('Nenhum curso publicado ainda').or(page.getByText('Você ainda não tem cursos'))).toBeVisible();
  });
});

test.describe('cadernos', () => {
  test('erros: pendentes e resolvidos, com o que foi digitado, o correto e treino', async ({ page }) => {
    await open(page, '#courses/mistakes');
    await expect(page.getByText('I is here')).toBeVisible();
    await expect(page.locator('.course-mistake-correct').first()).toHaveText('I am here.');
    await page.getByRole('button', { name: 'Treinar 1 erros' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Começar prática', exact: true }).click();
    expect((await pages(page, 'navigations')).at(-1)).toMatchObject({ route: 'course-practice', params: { kind: 'mistakes', unitIds: ['m1'] } });
    await page.getByRole('tab', { name: /Resolvidos/ }).click();
    await expect(page.getByText('You is late')).toBeVisible();
    await expect(page.getByText('I is here')).toHaveCount(0);
  });
  test('erros: vazio e falha com recuperação', async ({ page }) => {
    await open(page, '#courses/mistakes', 'empty');
    await expect(page.getByText('Nenhum erro registrado')).toBeVisible();
    await open(page, '#courses/mistakes', 'fail');
    await expect(page.getByRole('button', { name: /Tentar/ })).toBeVisible();
    await page.getByRole('button', { name: /Tentar/ }).click();
    await expect(page.getByText('I is here')).toBeVisible();
  });
  test('vocabulário: lista, remove e mostra vazio e falha', async ({ page }) => {
    await open(page, '#courses/vocabulary');
    await expect(page.getByText('Good morning.')).toBeVisible();
    await page.getByRole('button', { name: 'Remover do vocabulário' }).click();
    await expect.poll(() => pages(page, 'removed')).toEqual(['v1']);
    await open(page, '#courses/vocabulary', 'empty');
    await expect(page.getByText('Nenhuma frase salva')).toBeVisible();
    await open(page, '#courses/vocabulary', 'fail');
    await expect(page.getByRole('button', { name: /Tentar/ })).toBeVisible();
  });
  test('notas: edita, salva, apaga e mostra vazio', async ({ page }) => {
    await open(page, '#courses/notes');
    const item = page.locator('.course-note-item');
    await expect(item.locator('textarea')).toHaveValue('Lembrar do plural');
    await item.locator('textarea').fill('Nota nova');
    await item.getByRole('button', { name: 'Salvar' }).click();
    await expect.poll(() => pages(page, 'savedNotes')).toEqual([['n1', 'Nota nova']]);
    page.once('dialog', dialog => dialog.dismiss());
    await item.getByRole('button', { name: 'Apagar nota' }).click();
    expect(await pages(page, 'deleted')).toEqual([]);
    page.once('dialog', dialog => { expect(dialog.message()).toBe('Apagar esta nota?'); return dialog.accept(); });
    await item.getByRole('button', { name: 'Apagar nota' }).click();
    await expect.poll(() => pages(page, 'deleted')).toEqual(['n1']);
    await open(page, '#courses/notes', 'empty');
    await expect(page.getByText('Nenhuma nota ainda')).toBeVisible();
  });
  test('revisão sem frases mostra o estado vazio explicando o método', async ({ page }) => {
    await open(page, '#courses/review', 'empty');
    await expect(page.getByText('Nenhuma frase em revisão ainda')).toBeVisible();
  });
});

test.describe('ranking e análise', () => {
  test('ranking: posição, destaque do aluno, períodos, paginação e atualizar', async ({ page }) => {
    await open(page, '#courses/leaderboard');
    await expect(page.getByLabel('Minha posição')).toContainText('#2');
    await expect(page.locator('tr.is-me')).toContainText('(você)');
    await expect(page.locator('.course-rank-table tbody tr')).toHaveCount(20);
    await page.getByRole('button', { name: 'Carregar mais' }).click();
    await expect(page.locator('.course-rank-table tbody tr')).toHaveCount(25);
    await page.getByRole('tab', { name: 'Hoje' }).click();
    await expect.poll(() => pages(page, 'periods')).toContain('daily');
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByText('Regras do ranking')).toBeVisible();
  });
  test('ranking: vazio e falha com tentar de novo', async ({ page }) => {
    await open(page, '#courses/leaderboard', 'empty');
    await expect(page.getByText('Ninguém praticou neste período ainda.')).toBeVisible();
    await expect(page.getByText(/Você ainda não pontuou/)).toBeVisible();
    await open(page, '#courses/leaderboard', 'fail');
    await page.getByRole('button', { name: /Tentar/ }).click();
    await expect(page.getByLabel('Minha posição')).toContainText('#2');
  });
  test('análise: indicadores e recuperação de falha', async ({ page }) => {
    await open(page, '#courses/analysis');
    await expect(page.getByRole('heading', { name: 'Conteúdo (todo o período)' })).toBeVisible();
    await expect(page.getByLabel('Indicadores')).toBeVisible();
    await open(page, '#courses/analysis', 'fail');
    await page.getByRole('button', { name: /Tentar/ }).click();
    await expect(page.getByLabel('Indicadores')).toBeVisible();
  });
});

test.describe('responsivo', () => {
  for (const hash of ['', '#courses/store', '#courses/my-courses', '#courses/mistakes', '#courses/leaderboard', '#courses/analysis']) {
    test(`celular 390 px sem rolagem horizontal em ${hash || 'início'}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, hash);
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
});

test.describe('diálogo de preparo da aula', () => {
  const openPrepare = async page => {
    await open(page, '#courses/mistakes');
    await page.getByRole('button', { name: 'Treinar 1 erros' }).click();
    return page.getByRole('dialog');
  };
  test('abre com médio, troca a dificuldade, descreve o modo e inicia com a escolha', async ({ page }) => {
    const dialog = await openPrepare(page);
    await expect(dialog.getByRole('button', { name: 'Começar prática', exact: true })).toBeFocused();
    await expect(dialog.locator('#course-mode-text')).toContainText('primeira letra');
    await dialog.getByText('Difícil', { exact: true }).click();
    await expect(dialog.locator('#course-mode-text')).toContainText('sem letras');
    await dialog.getByText('Fácil', { exact: true }).click();
    await expect(dialog.locator('#course-mode-text')).toContainText('frase completa');
    await dialog.getByRole('button', { name: 'Começar prática', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await pages(page, 'navigations')).at(-1).params.difficulty).toBe('easy');
    expect(await page.evaluate(() => localStorage.getItem('lf_course_last_mode'))).toBe('easy');
  });
  test('lembra a última dificuldade na próxima abertura', async ({ page }) => {
    let dialog = await openPrepare(page);
    await dialog.getByText('Difícil', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Começar prática', exact: true }).click();
    await page.getByRole('button', { name: 'Treinar 1 erros' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.locator('#course-mode-text')).toContainText('sem letras');
  });
  test('Esc, Cancelar e ✕ fecham sem iniciar e devolvem o foco', async ({ page }) => {
    for (const close of ['escape', 'cancelar', 'x']) {
      const dialog = await openPrepare(page);
      if (close === 'escape') await page.keyboard.press('Escape');
      else if (close === 'cancelar') await dialog.getByRole('button', { name: 'Cancelar' }).click();
      else await dialog.getByRole('button', { name: 'Fechar' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Treinar 1 erros' })).toBeFocused();
    }
    expect((await pages(page, 'navigations')).filter(n => n.route === 'course-practice')).toHaveLength(0);
  });
  test('Tab fica preso dentro do diálogo', async ({ page }) => {
    const dialog = await openPrepare(page);
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  });
  test('configurações alteram e persistem leituras, velocidade e áudio', async ({ page }) => {
    const dialog = await openPrepare(page);
    await dialog.getByText('Configurações', { exact: true }).click();
    const readings = dialog.getByRole('spinbutton', { name: 'Leituras' });
    const before = Number(await readings.getAttribute('aria-valuenow'));
    await dialog.getByRole('button', { name: 'Aumentar leituras' }).click();
    await expect(dialog.getByRole('spinbutton', { name: 'Leituras' })).toHaveAttribute('aria-valuenow', String(before + 1));
    await dialog.getByRole('switch', { name: 'Áudio da frase' }).check();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lf_course_prefs')));
    expect(stored.readings).toBe(before + 1);
    expect(stored.audio).toBe(true);
  });
});
