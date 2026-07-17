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

// Especificação de tamanho/estrutura POR BANDA (queixa do dono 17/07: todo
// nível recebia os mesmos "200-300 palavras" — um A1 ganha um texto 3x maior
// do que aguenta e desiste achando que o problema é ele). W5.1 do plano.
const LEVEL_SPECS = {
  A1: { words: '90 a 130', maxSentence: 8, maxTokens: 500,
    structures: 'APENAS presente simples, "there is/are" e imperativo. Vocabulário das 1000 palavras mais comuns.' },
  A2: { words: '140 a 200', maxSentence: 12, maxTokens: 650,
    structures: 'presente e passado simples, "going to", comparativos. Nada de perfect tenses.' },
  B1: { words: '220 a 300', maxSentence: 16, maxTokens: 900,
    structures: 'inclui present perfect, 1º condicional e passado contínuo.' },
  B2: { words: '320 a 420', maxSentence: 20, maxTokens: 1200,
    structures: 'inclui voz passiva, 2º/3º condicional, discurso indireto e phrasal verbs comuns.' },
  C1: { words: '450 a 600', maxSentence: 26, maxTokens: 1600,
    structures: 'inclui inversão, cleft sentences, nominalização e vocabulário idiomático.' },
  C2: { words: '600 a 800', maxSentence: 40, maxTokens: 2000,
    structures: 'estrutura livre, registro sofisticado, nuance e ironia bem-vindas.' },
};

export function levelSpecFor(cefr) {
  return LEVEL_SPECS[cefr] || LEVEL_SPECS.B1;
}

export function buildLevelNote(cefr) {
  const spec = levelSpecFor(cefr);
  return `\nCALIBRAGEM OBRIGATÓRIA para o nível ${cefr}:
- Comprimento: ${spec.words} palavras (respeite a faixa; não escreva mais).
- Frases de NO MÁXIMO ${spec.maxSentence} palavras cada.
- Estruturas: ${spec.structures}`;
}

// rand injetável para teste determinístico (mesmo padrão do placement.js)
export function buildStoryVarietyNote(recentSnippets = [], rand = Math.random) {
  // Queixa do dono (17/07, 2ª rodada): "mesmos personagens sempre". Além do
  // sorteio, EXCLUI da roleta os nomes que já apareceram nas aberturas
  // recentes e proíbe explicitamente reutilizá-los no prompt.
  const usedNames = new Set();
  for (const snippet of recentSnippets || []) {
    for (const candidate of NAMES) {
      if (new RegExp(`\\b${candidate}\\b`).test(snippet)) usedNames.add(candidate);
    }
  }
  const freshNames = NAMES.filter((n) => !usedNames.has(n));
  const namePool = freshNames.length ? freshNames : NAMES;
  const name = pick(namePool, rand);
  const setting = pick(SETTINGS, rand);
  const first = pick(INGREDIENTS, rand);
  let second = pick(INGREDIENTS, rand);
  if (second === first) {
    second = INGREDIENTS[(INGREDIENTS.indexOf(first) + 1) % INGREDIENTS.length];
  }
  const avoid = (recentSnippets || []).filter(Boolean).slice(0, 5);
  const avoidNote = avoid.length
    ? `\n- NÃO repita o enredo nem a abertura destas histórias anteriores: ${JSON.stringify(avoid)}.
- PROIBIDO reutilizar qualquer NOME de personagem que apareça nos trechos acima.`
    : '';
  return `\nVARIAÇÃO OBRIGATÓRIA desta história (cada geração deve ser diferente da anterior):
- Protagonista: ${name}.
- Cenário principal: ${setting}.
- A trama deve incluir ${first} e ${second}.${avoidNote}
- Semente de variação: ${Math.floor(rand() * 1e6)}.`;
}
