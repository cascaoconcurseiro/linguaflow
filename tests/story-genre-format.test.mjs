import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStoryPrompt, storyFormatFor, STORY_PROMPT_VERSION } from '../utils/story-variety.js';

// Issue #340: todo tema virava conto de ficção com diálogos. Auto-ajuda tem de
// ser texto de auto-ajuda, biografia tem de ser biografia de pessoa real.

const base = { cefr: 'B1', targetMinutes: 5, learningGoal: 'comfortable', rand: () => 0.3 };
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('storyFormatFor: cada tema do seletor cai no formato certo', () => {
  for (const genre of ['Motivação & Hábitos', 'Produtividade & Foco', 'Relacionamentos & Comunicação',
    'Saúde Mental & Equilíbrio', 'Finanças Pessoais']) {
    assert.equal(storyFormatFor(genre), 'selfhelp', genre);
  }
  assert.equal(storyFormatFor('Biografia Inspiradora'), 'biography');
  for (const genre of ['História (Fatos reais)', 'Ciência & Descobertas', 'Empreendedorismo & Inovação',
    'Natureza & Meio Ambiente']) {
    assert.equal(storyFormatFor(genre), 'nonfiction', genre);
  }
  for (const genre of ['Dia a Dia', 'Mistério', 'Ficção Científica', 'tema desconhecido', '']) {
    assert.equal(storyFormatFor(genre), 'narrative', genre);
  }
});

test('buildStoryPrompt: auto-ajuda pede texto de auto-ajuda, sem trama nem protagonista inventado', () => {
  const prompt = buildStoryPrompt({ ...base, genre: 'Motivação & Hábitos' });
  assert.match(prompt, /auto-ajuda/i);
  assert.match(prompt, /leitor/);
  assert.doesNotMatch(prompt, /Protagonista:/);
  assert.doesNotMatch(prompt, /DIÁLOGOS REAIS/);
  assert.doesNotMatch(prompt, /gerador de histórias/);
});

test('buildStoryPrompt: biografia exige pessoa real e proíbe diálogos inventados', () => {
  const prompt = buildStoryPrompt({ ...base, genre: 'Biografia Inspiradora' });
  assert.match(prompt, /biografia/i);
  assert.match(prompt, /pessoa real/i);
  assert.match(prompt, /NÃO invente/);
  assert.doesNotMatch(prompt, /Protagonista:/);
  assert.doesNotMatch(prompt, /DIÁLOGOS REAIS/);
});

test('buildStoryPrompt: não-ficção pede artigo informativo sobre fatos reais', () => {
  const prompt = buildStoryPrompt({ ...base, genre: 'Ciência & Descobertas' });
  assert.match(prompt, /informativ/i);
  assert.match(prompt, /fatos reais/i);
  assert.doesNotMatch(prompt, /Protagonista:/);
});

test('buildStoryPrompt: temas narrativos mantêm diálogos e variação de personagens', () => {
  const prompt = buildStoryPrompt({ ...base, genre: 'Dia a Dia' });
  assert.match(prompt, /Protagonista:/);
  assert.match(prompt, /DIÁLOGOS REAIS/);
});

test('buildStoryPrompt: todo formato respeita nível, duração e palavras de reencontro', () => {
  for (const genre of ['Dia a Dia', 'Finanças Pessoais', 'Biografia Inspiradora', 'Natureza & Meio Ambiente']) {
    const prompt = buildStoryPrompt({ ...base, genre, cefr: 'A2', targetMinutes: 3, reencounter: ['look forward to'] });
    assert.match(prompt, /CEFR A2/, genre);
    assert.match(prompt, /3 minutos/, genre);
    assert.match(prompt, /look forward to/, genre);
    assert.match(prompt, new RegExp(genre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), genre);
  }
});

test('web e extensão usam o mesmo buildStoryPrompt e a versão nova do prompt', () => {
  assert.equal(STORY_PROMPT_VERSION, 'story-v3');
  for (const path of ['dashboard/js/core/ai.js', 'background/ai-generator.js']) {
    const code = read(path);
    assert.match(code, /buildStoryPrompt\(/, path);
    assert.doesNotMatch(code, /gerador de histórias envolventes/, path);
    assert.doesNotMatch(code, /'story-v2'/, path);
  }
});

test('reuso na web não devolve texto não narrativo gerado com prompt antigo', () => {
  const code = read('dashboard/js/core/ai.js');
  assert.match(code, /prompt_version === STORY_PROMPT_VERSION/);
});
