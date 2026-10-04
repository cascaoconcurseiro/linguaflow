import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildFirstSteps, parseFirstSteps, renderFirstSteps } from '../dashboard/js/ui/firstSteps.js';

test('começa pelo passo 1 e avança conforme o aluno marca', () => {
  let steps = buildFirstSteps();
  assert.deepEqual(steps.map((s) => s.current), [true, false, false]);
  steps = buildFirstSteps({ installed: true });
  assert.deepEqual(steps.map((s) => s.done), [true, false, false]);
  assert.equal(steps.findIndex((s) => s.current), 1);
  steps = buildFirstSteps({ installed: true, enabled: true });
  assert.equal(steps.findIndex((s) => s.current), 2);
});

test('estado salvo inválido não quebra a tela', () => {
  assert.deepEqual(parseFirstSteps('{lixo'), { installed: false, enabled: false });
  assert.deepEqual(parseFirstSteps(null), { installed: false, enabled: false });
  assert.deepEqual(parseFirstSteps('{"installed":true,"enabled":"sim"}'), { installed: true, enabled: false });
});

test('HTML: lista ordenada, passo atual anunciado, botões só no passo atual, sem HTML solto', () => {
  const html = renderFirstSteps(buildFirstSteps());
  assert.match(html, /<ol class="first-steps-list">/);
  assert.doesNotMatch(html, /<h3/, 'títulos dos passos são h2 (h1 → h2, sem pular nível)');
  assert.match(html, /<h2>Instale a extensão no Chrome/);
  assert.match(html, /aria-current="step"/);
  assert.equal((html.match(/data-first-step=/g) || []).length, 1);
  assert.match(html, /Baixar a extensão/);
  assert.match(html, /id="btn-primary-stories"/);
  const after = renderFirstSteps(buildFirstSteps({ installed: true }));
  assert.doesNotMatch(after, /Baixar a extensão/);
  assert.match(after, /Já liguei/);
  assert.match(after, /concluído/);
});

test('Home: mostra os primeiros passos só para quem não tem palavras e persiste a marcação', async () => {
  const home = await readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');
  assert.match(home, /todayAction\.kind === 'first-context'/);
  assert.match(home, /firstSteps \? renderFirstSteps\(firstSteps\)/);
  assert.match(home, /setSetting\?\.\(FIRST_STEPS_KEY/);
});
