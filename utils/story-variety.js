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
  A1: { words: '280 a 380', maxSentence: 10, maxTokens: 1100,
    structures: 'diálogos cotidianos simples (apresentações, cafeteria, compras, rotina), APENAS presente simples, "there is/are" e imperativo. Vocabulário das 1000 palavras mais comuns.' },
  A2: { words: '400 a 550', maxSentence: 14, maxTokens: 1500,
    structures: 'diálogos práticos ricos do dia a dia (viagens, transporte, restaurantes, trabalho, imprevistos reais), presente e passado simples, "going to", comparativos. Nada de perfect tenses.' },
  B1: { words: '600 a 800', maxSentence: 18, maxTokens: 2200,
    structures: 'conversas realistas completas com troca de opiniões, sentimentos, situações imprevistas, present perfect, 1º condicional e passado contínuo.' },
  B2: { words: '800 a 1100', maxSentence: 22, maxTokens: 2800,
    structures: 'diálogos naturais aprofundados, discussões, phrasal verbs cotidianos, voz passiva, 2º/3º condicional e discurso indireto.' },
  C1: { words: '1100 a 1500', maxSentence: 26, maxTokens: 3600,
    structures: 'diálogos sofisticados, debates, negociações, inversões, cleft sentences, nominalização e vocabulário idiomático.' },
  C2: { words: '1500 a 2000', maxSentence: 40, maxTokens: 4500,
    structures: 'diálogos com naturalidade nativa completa, humor sutil, ironia, registro flexível e nuance cultural.' },
};

export function levelSpecFor(cefr) {
  return LEVEL_SPECS[cefr] || LEVEL_SPECS.B1;
}

export function buildLevelNote(cefr) {
  const spec = levelSpecFor(cefr);
  return `\nCALIBRAGEM OBRIGATÓRIA para o nível ${cefr}:
- Comprimento: ${spec.words} palavras (desenvolva a história nessa extensão substancial).
- Formato: predominantemente DIÁLOGOS REAIS entre os personagens (falas diretas úteis para a vida real).
- Frases de no máximo ${spec.maxSentence} palavras cada.
- Estruturas e vocabulário: ${spec.structures}`;
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
