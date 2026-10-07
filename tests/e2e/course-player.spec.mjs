// Comportamento do player de aula (#544): níveis de dificuldade, acerto/erro, dica, revelar, pular, voltar,
// pausa, saída, configurações, teclado, conclusão, falhas de carregamento/gravação e sessão incompleta.
import { test, expect } from '@playwright/test';

const open = async (page, query = '') => {
  await page.route('**/supabase.co/**', route => route.abort());
  await page.goto(`/tests/fixtures/course-player-preview.html?${query}`);
  await page.waitForSelector('html[data-ready="true"]');
};
const slots = page => page.locator('#sentence-slots input');
const fillWords = async (page, text) => {
  const words = text.split(' ');
  for (const [i, word] of words.entries()) await slots(page).nth(i).fill(word);
};
const answer = async (page, text) => { await fillWords(page, text); await slots(page).last().press('Enter'); };
const state = (page, key) => page.evaluate(k => window.__player[k], key);
const counter = page => page.locator('#course-question');

test.describe('dificuldade', () => {
  test('fácil mostra a frase inteira e a instrução de cópia', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await expect(page.locator('#course-prompt')).toHaveText('I am here.');
    await expect(page.locator('#course-instruction')).toContainText('Copie a frase');
    await expect(slots(page)).toHaveCount(3);
  });
  test('médio mostra só as iniciais e a primeira letra de cada campo', async ({ page }) => {
    await open(page, 'difficulty=medium');
    const prompt = page.locator('#course-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).not.toHaveText('I am here.');
    await expect(slots(page).nth(0)).toHaveAttribute('placeholder', 'I');
    await expect(slots(page).nth(1)).toHaveAttribute('placeholder', 'a');
    await expect(slots(page).nth(2)).toHaveAttribute('placeholder', 'h');
  });
  test('difícil esconde o texto, mostra o indicador de áudio e campos sem dica', async ({ page }) => {
    await open(page, 'difficulty=hard');
    await expect(page.locator('#course-prompt')).toBeHidden();
    await expect(page.locator('#course-audio-cue')).toBeVisible();
    await expect(slots(page).nth(0)).toHaveAttribute('placeholder', '');
  });
  test('dificuldade inválida cai para médio', async ({ page }) => {
    await open(page, 'difficulty=impossivel');
    await expect(page.getByText('Curso de teste · Médio')).toBeVisible();
  });
});

test.describe('resposta', () => {
  test('acerto avança, soma pontos, atualiza progresso e aceita sem pontuação', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await expect(counter(page)).toHaveText('1 / 2');
    await expect(page.locator('#course-score')).toHaveText('0');
    await answer(page, 'I am here');
    await expect(counter(page)).toHaveText('2 / 2');
    await expect(page.locator('#course-score')).not.toHaveText('0');
    await expect(page.getByRole('progressbar', { name: 'Progresso' })).toHaveAttribute('aria-valuenow', '1');
  });
  test('maiúsculas e minúsculas não importam', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'i AM Here');
    await expect(counter(page)).toHaveText('2 / 2');
  });
  test('erro mantém as palavras certas, marca a errada e não avança', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'I was here');
    await expect(counter(page)).toHaveText('1 / 2');
    await expect(slots(page).nth(1)).toHaveClass(/is-wrong/);
    await expect(slots(page).nth(0)).toHaveClass(/is-correct/);
    await expect(page.locator('#course-feedback')).toContainText('1 palavra não confere');
    await expect(slots(page).nth(1)).toBeFocused();
    await slots(page).nth(1).fill('am');
    await slots(page).nth(2).press('Enter');
    await expect(counter(page)).toHaveText('2 / 2');
  });
  test('vários erros usam o plural', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'x y z');
    await expect(page.locator('#course-feedback')).toContainText('3 palavras não conferem');
  });
  test('colar o texto inteiro distribui as palavras pelos campos', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await slots(page).first().focus();
    await page.evaluate(() => {
      const input = document.querySelector('#sentence-slots input');
      const data = new DataTransfer(); data.setData('text', 'I am here');
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(slots(page).nth(0)).toHaveValue('I');
    await expect(slots(page).nth(1)).toHaveValue('am');
    await expect(slots(page).nth(2)).toHaveValue('here');
  });
  test('espaço passa ao próximo campo', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await slots(page).nth(0).focus();
    await page.keyboard.type('I');
    await page.keyboard.press('Space');
    await expect(slots(page).nth(1)).toBeFocused();
  });
  test('botão Conferir envia a resposta', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await fillWords(page, 'I am here');
    await page.getByRole('button', { name: /Conferir/ }).click();
    await expect(counter(page)).toHaveText('2 / 2');
  });
});

test.describe('ajudas e navegação', () => {
  test('dica mostra a palavra no campo, avisa e usa atalho Ctrl+Shift+;', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await slots(page).nth(1).focus();
    await page.getByRole('button', { name: /Dica desta palavra/ }).click();
    await expect(slots(page).nth(1)).toHaveAttribute('placeholder', 'am');
    await expect(page.locator('#course-feedback')).toContainText('Dica usada');
    await page.locator('#sentence-slots input.is-hinted').first().press('Control+Shift+;');
    await expect(page.locator('#course-feedback')).toContainText('Dica usada');
  });
  test('mostrar resposta avisa que a frase não soma combo e o atalho Ctrl+; alterna o painel', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await slots(page).first().press('Control+;');
    await expect(page.locator('#course-breakdown')).toBeVisible();
    await expect(page.locator('#course-feedback')).toContainText('Resposta revelada');
    await slots(page).first().press('Control+;');
    await expect(page.locator('#course-breakdown')).toBeHidden();
  });
  test('pular avança sem pontuar; anterior consulta a frase já respondida e volta à atual', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: 'Pular esta frase e ir para a próxima' }).click();
    await expect(counter(page)).toHaveText('2 / 2');
    await expect(page.locator('#course-score')).toHaveText('0');
    await page.getByRole('button', { name: 'Frase anterior' }).click();
    await expect(page.locator('#course-feedback')).toContainText('Frase já respondida');
    await expect(slots(page).first()).toHaveAttribute('readonly', '');
    await page.getByRole('button', { name: 'Voltar à frase atual' }).click();
    await expect(counter(page)).toHaveText('2 / 2');
    await expect(slots(page).first()).not.toHaveAttribute('readonly', '');
  });
  test('repetir áudio não quebra com áudio desligado', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: /Repetir áudio/ }).click();
    await expect(page.locator('#course-prompt')).toBeVisible();
  });
});

test.describe('pausa, saída e configurações', () => {
  test('Esc pausa e retoma; campos ficam somente leitura durante a pausa', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
    await expect(slots(page).first()).toHaveAttribute('readonly', '');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeHidden();
    await expect(slots(page).first()).not.toHaveAttribute('readonly', '');
  });
  test('botão de pausa funciona e Esc retoma', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: 'Pausar (Esc)' }).click();
    await expect(page.locator('#course-pause')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#course-pause')).toBeHidden();
  });
  test('sair sem respostas volta direto, sem diálogo e sem gravar', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: /Capítulos/ }).click();
    expect(await state(page, 'navigations')).toEqual([{ route: 'courses', params: { tab: 'course', courseId: 'c1' } }]);
    expect(await state(page, 'commits')).toHaveLength(0);
  });
  test('sair com respostas pede confirmação; continuar fecha; sair grava sessão incompleta', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'I am here');
    await page.getByRole('button', { name: /Capítulos/ }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Sair da prática?' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Continuar praticando' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /Capítulos/ }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /Capítulos/ }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    expect((await state(page, 'navigations'))[0].route).toBe('courses');
  });
  test('configurações pausam, alteram velocidade e persistem neste navegador', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: 'Configurações da prática' }).click();
    const dialog = page.getByRole('dialog', { name: 'Configurações' });
    await expect(dialog).toBeVisible();
    const before = await page.locator('#course-speed-pill').textContent();
    await dialog.getByRole('button', { name: 'Mais rápido' }).click();
    await expect(page.locator('#course-speed-pill')).not.toHaveText(before);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lf_course_prefs')));
    expect(stored.speed).toBeGreaterThan(1);
    await dialog.getByRole('switch', { name: 'Reduzir movimento' }).uncheck();
    await expect(page.locator('.course-player-shell')).not.toHaveClass(/course-reduce-motion/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
  test('popovers de velocidade e leituras abrem e fecham', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.locator('#course-readings-pill').click();
    await expect(page.locator('#course-pop-readings')).toBeVisible();
    const before = Number((await page.locator('#course-readings-pill').textContent()).match(/(\d+)x/)[1]);
    await page.getByRole('button', { name: 'Mais leituras' }).click();
    await expect(page.locator('#course-readings-pill')).toContainText(`${before + 1}x`);
    await page.locator('#course-speed-pill').click();
    await expect(page.locator('#course-pop-readings')).toBeHidden();
    await expect(page.locator('#course-pop-speed')).toBeVisible();
  });
});

test.describe('palavra com frase de exemplo', () => {
  test('após acertar a palavra pede a frase do exemplo e só então conclui', async ({ page }) => {
    await open(page, 'units=word&difficulty=medium');
    await expect(page.locator('#course-cue')).toHaveText('Significado: chaves');
    await expect(counter(page)).toHaveText('1 / 1');
    await answer(page, 'keys');
    await expect(page.locator('#course-cue')).toHaveText('Frase: Perdi minhas chaves.', { timeout: 5000 });
    await expect(slots(page)).toHaveCount(4);
    await answer(page, 'I lost my keys');
    await expect(page.getByRole('heading', { name: 'Capítulo concluído' })).toBeVisible();
  });
});

test.describe('conclusão e falhas', () => {
  test('concluir mostra o resumo, grava a sessão completa e oferece praticar de novo', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'I am here');
    await answer(page, 'You are late');
    await expect(page.getByRole('heading', { name: 'Capítulo concluído' })).toBeVisible();
    await expect(page.getByText('Progresso salvo: 40% do curso.')).toBeVisible();
    await expect(page.getByText('Melhor combo')).toBeVisible();
    const commits = await state(page, 'commits');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ kind: 'lesson', lessonId: 'l1', difficulty: 'easy', completed: true });
    expect(commits[0].results).toHaveLength(2);
    await page.getByRole('button', { name: 'Praticar de novo' }).click();
    expect((await state(page, 'navigations')).at(-1).route).toBe('course-practice');
  });
  test('erros e dicas viram aviso de revisão amanhã no resumo', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'x y z');
    await answer(page, 'I am here');
    await answer(page, 'You are late');
    await expect(page.getByText(/voltam amanhã na revisão/)).toBeVisible();
  });
  test('falha ao gravar guarda o resultado local e permite tentar de novo', async ({ page }) => {
    await open(page, 'difficulty=easy&fail=commit');
    await answer(page, 'I am here');
    await answer(page, 'You are late');
    await expect(page.getByText(/Não foi possível salvar agora/)).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('lf_course_pending_commit'))).toBeTruthy();
    await page.getByRole('button', { name: 'Tentar salvar de novo' }).click();
    await expect(page.getByText('Progresso salvo: 40% do curso.')).toBeVisible();
    expect(await state(page, 'commits')).toHaveLength(2);
    expect(await page.evaluate(() => sessionStorage.getItem('lf_course_pending_commit'))).toBeNull();
  });
  test('falha ao carregar mostra erro com tentar de novo', async ({ page }) => {
    await open(page, 'fail=load');
    await expect(page.getByRole('alert')).toContainText('Não deu para abrir a prática');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(counter(page)).toHaveText('1 / 2');
  });
  test('aula sem frases mostra aviso e botão voltar', async ({ page }) => {
    await open(page, 'fail=empty');
    await expect(page.getByRole('alert')).toContainText('ainda não tem frases publicadas');
    await page.getByRole('button', { name: 'Voltar' }).click();
    expect((await state(page, 'navigations'))[0].route).toBe('courses');
  });
  test('saída pela página no meio da prática guarda o que foi respondido', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await answer(page, 'I am here');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem('lf_course_pending_commit') || 'null'));
    expect(pending?.completed).toBe(false);
    expect(pending?.results).toHaveLength(1);
  });
});

test.describe('revisão e acessibilidade', () => {
  test('modo revisão não tem capítulo e o botão final é Voltar', async ({ page }) => {
    await open(page, 'kind=review&difficulty=easy');
    await expect(page.getByRole('button', { name: /Voltar/ }).first()).toBeVisible();
    await answer(page, 'I am here');
    await answer(page, 'You are late');
    await expect(page.getByRole('heading', { name: 'Prática concluída' })).toBeVisible();
    await expect(page.getByText('Revisão salva.')).toBeVisible();
  });
  test('campos, diálogos e progresso têm nomes acessíveis', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await expect(page.getByRole('group', { name: 'Escreva a frase, uma palavra por campo' })).toBeVisible();
    await expect(slots(page).first()).toHaveAttribute('aria-label', /Palavra 1 de 3/);
    await expect(page.locator('#course-feedback')).toHaveAttribute('aria-live', 'polite');
    for (const id of ['#course-pause', '#course-exit', '#course-settings']) await expect(page.locator(id)).toHaveAttribute('aria-modal', 'true');
  });
  test('tema alterna sem quebrar o player', async ({ page }) => {
    await open(page, 'difficulty=easy');
    await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Alternar tema claro/escuro' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });
  test('celular 390 px sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'difficulty=easy');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
