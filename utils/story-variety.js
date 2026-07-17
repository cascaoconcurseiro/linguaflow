// story-variety.js — variedade obrigatória na geração de histórias.
// Bug relatado pelo dono (17/07): mesmo gênero => mesma história. Causa: o
// prompt era byte-idêntico a cada clique (gênero + CEFR + as mesmas palavras
// de reencontro em ordem estável), e a IA converge pro mesmo arquétipo.
// O quiz da MESMA tela já resolvia isso (focos sorteados + semente + lista de
// "não repita"); este módulo aplica o mesmo padrão à história, compartilhado
// entre web (ai.js) e extensão (service-worker).

const NAMES = ['Maya', 'Leo', 'Priya', 'Daniel', 'Sofia', 'Ethan', 'Amara',
  'Lucas', 'Nina', 'Omar', 'Clara', 'Felix', 'Grace', 'Mateo'];

const SETTINGS = ['a small coffee shop', 'a crowded train', 'an old bookstore',
  'a night market', 'an office on a Friday afternoon', 'a rainy bus stop',
  'a rooftop garden', 'an airport gate', 'a neighborhood gym',
  'a family kitchen', 'a beach town in winter', 'a busy hospital lobby',
  'a quiet library', 'a street food festival'];

const INGREDIENTS = ['an unexpected phone call', 'a small misunderstanding',
  'a lost object that matters', 'a stranger who helps',
  'a difficult decision', 'a funny coincidence', 'a promise kept too late',
  'a surprise invitation', 'a plan that goes wrong',
  'good news arriving at a bad time'];

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

// Primeiras linhas das histórias recentes DO MESMO gênero — viram a lista
// de "não repita" do prompt. Aceita tanto `content` (banco) quanto `text`
// (estado local da tela).
export function recentStorySnippets(stories = [], genre = '') {
  return (stories || [])
    .filter((s) => !genre || (s.genre || '') === genre)
    .slice(0, 5)
    .map((s) => String(s.content || s.text || '').replace(/\s+/g, ' ').trim().slice(0, 90))
    .filter(Boolean);
}

// rand injetável para teste determinístico (mesmo padrão do placement.js)
export function buildStoryVarietyNote(recentSnippets = [], rand = Math.random) {
  const name = pick(NAMES, rand);
  const setting = pick(SETTINGS, rand);
  const first = pick(INGREDIENTS, rand);
  let second = pick(INGREDIENTS, rand);
  if (second === first) {
    second = INGREDIENTS[(INGREDIENTS.indexOf(first) + 1) % INGREDIENTS.length];
  }
  const avoid = (recentSnippets || []).filter(Boolean).slice(0, 5);
  const avoidNote = avoid.length
    ? `\n- NÃO repita o enredo, os personagens nem a abertura destas histórias anteriores: ${JSON.stringify(avoid)}.`
    : '';
  return `\nVARIAÇÃO OBRIGATÓRIA desta história (cada geração deve ser diferente da anterior):
- Protagonista: ${name}.
- Cenário principal: ${setting}.
- A trama deve incluir ${first} e ${second}.${avoidNote}
- Semente de variação: ${Math.floor(rand() * 1e6)}.`;
}
