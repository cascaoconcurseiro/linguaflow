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
  'a quiet library', 'a street food festival', 'a cozy bakery on a Sunday morning',
  'a sunny city park with dogs', 'a local supermarket checkout line',
  'a relaxed terrace cafe with outdoor seating', 'a friendly neighborhood record store',
  // auto-ajuda & crescimento
  'a productivity workshop in a co-working space', 'a morning journaling session at home',
  'a mentorship conversation over coffee', 'a solo hiking trail at sunrise',
  'a mindfulness retreat in the countryside', 'a simple home office on a quiet Tuesday',
  // histórias reais & não-ficção
  'a university research lab', 'a small startup office', 'a historical museum after hours',
  'a documentary film crew on location', 'a conservation camp in a national park',
  'a community radio station', 'a science fair at a local school'];

const INGREDIENTS = ['an unexpected phone call', 'a small misunderstanding',
  'a lost object that matters', 'a stranger who helps',
  'a difficult decision', 'a funny coincidence', 'a promise kept too late',
  'a surprise invitation', 'a plan that goes wrong',
  'good news arriving at a bad time', 'a friendly pet causing a funny moment',
  'ordering something delicious by accident', 'recommending a favorite song or movie',
  'finding an old photo in a coat pocket',
  // auto-ajuda
  'a habit that suddenly clicks after weeks of trying',
  'a short conversation that changes someone\'s perspective',
  'a failed attempt that teaches more than success',
  'discovering a simple routine that makes mornings easier',
  'a mentor sharing one piece of advice that sticks',
  // histórias reais / não-ficção
  'a surprising fact discovered during research',
  'an obstacle that nearly ended the project',
  'a collaboration between two unlikely people',
  'a breakthrough that happened by accident',
  'a moment when the evidence contradicted the theory'];


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
export const LEVEL_SPECS = {
  A1: { words: '280 a 380', maxSentence: 10, maxTokens: 1100,
    structures: 'diálogos cotidianos simples (apresentações, cafeteria, compras, rotina), APENAS presente simples, "there is/are" e imperativo. Vocabulário estrito das 1000 palavras mais comuns do dia a dia (proibido vocabulário B1/B2).' },
  A2: { words: '400 a 550', maxSentence: 14, maxTokens: 1500,
    structures: 'diálogos práticos ricos do dia a dia (viagens, transporte, restaurantes, trabalho, imprevistos reais), presente e passado simples, "going to", comparativos. Vocabulário estrito de nível básico A2 (nada de perfect tenses, conditionals ou vocabulário abstrato B1/B2).' },
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

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function resolveStoryLevel(baseLevel = 'B1', requestedLevel = 'auto', difficultyMode = 'current') {
  const normalizedBase = LEVEL_ORDER.includes(baseLevel) ? baseLevel : 'B1';
  if (LEVEL_ORDER.includes(requestedLevel)) return requestedLevel;
  const index = LEVEL_ORDER.indexOf(normalizedBase);
  if (difficultyMode === 'easier') return LEVEL_ORDER[Math.max(0, index - 1)];
  if (difficultyMode === 'challenge') return LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, index + 1)];
  return normalizedBase;
}

export function storyLengthSpec(cefr, targetMinutes = 5) {
  const minutes = [3, 5, 10].includes(Number(targetMinutes)) ? Number(targetMinutes) : 5;
  const wordsPerMinute = { A1: 65, A2: 80, B1: 95, B2: 110, C1: 120, C2: 125 }[cefr] || 95;
  const target = Math.round((minutes * wordsPerMinute) / 10) * 10;
  const tolerance = Math.max(30, Math.round(target * 0.16 / 10) * 10);
  return { minutes, minWords: Math.max(90, target - tolerance), maxWords: target + tolerance };
}

export function buildLevelNote(cefr, options = {}) {
  const spec = levelSpecFor(cefr);
  const length = storyLengthSpec(cefr, options.targetMinutes);
  const goal = options.learningGoal === 'vocabulary'
    ? 'Priorize reencontros naturais e repetição espaçada dos termos-alvo sem transformar o texto em lista.'
    : options.learningGoal === 'challenge'
      ? 'Inclua algum desafio inferível pelo contexto, sem ultrapassar a gramática da banda solicitada.'
      : 'Priorize leitura confortável, transparente e fluida; evite palavras raras que não sejam necessárias.';
  const formatLine = (STORY_FORMATS[options.format] || STORY_FORMATS.narrative).levelLine;
  return `\nCALIBRAGEM OBRIGATÓRIA para o nível ${cefr}:
- Duração desejada: cerca de ${length.minutes} minutos (${length.minWords} a ${length.maxWords} palavras).
- Formato: ${formatLine}
- Frases de no máximo ${spec.maxSentence} palavras cada.
- Estruturas e vocabulário: ${spec.structures}${options.format && options.format !== 'narrative'
    ? ' (use a banda só como limite de gramática e vocabulário; o formato continua o descrito acima, sem diálogos entre personagens)'
    : ''}
- Objetivo da missão: ${goal}`;
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

// Issue #340: o prompt era de conto para qualquer tema — auto-ajuda virava
// história de personagem e biografia virava ficção. Cada tema do seletor
// declara o gênero textual que o aluno espera receber.
export const STORY_PROMPT_VERSION = 'story-v3';

const STORY_FORMATS = {
  narrative: {
    role: 'Você é um gerador de histórias envolventes em inglês para estudantes.',
    levelLine: 'predominantemente DIÁLOGOS REAIS entre os personagens (falas diretas úteis para a vida real).',
    rules: `- O texto DEVE ser rico em DIÁLOGOS REAIS entre os personagens (cerca de 60% a 70% da história em conversas diretas que uma pessoa pode usar no mundo real em viagens, trabalho, compras e dia a dia).
- Use aspas inglesas ("...") para as falas e intercale as falas com reações, sentimentos e ações dos personagens.`,
  },
  selfhelp: {
    role: 'Você é um autor de textos de auto-ajuda e desenvolvimento pessoal em inglês para estudantes do idioma.',
    levelLine: 'texto de auto-ajuda em prosa, falando diretamente com o leitor ("you").',
    rules: `- Escreva um texto de AUTO-AJUDA de verdade, como um capítulo curto de livro ou artigo de desenvolvimento pessoal — NÃO é um conto.
- Fale diretamente com o leitor na segunda pessoa ("you"): apresente o problema, explique por que ele acontece e dê conselhos práticos e aplicáveis hoje.
- Proibido criar protagonista, enredo ou diálogos entre personagens. Um exemplo curto de situação é permitido, mas é ilustração, não trama.
- Termine com uma síntese ou um pequeno desafio prático para o leitor.`,
    variety: ['um passo a passo prático', 'um erro comum e como evitá-lo', 'um mito popular e o que funciona de verdade',
      'uma pequena rotina diária', 'perguntas de reflexão seguidas de ações concretas'],
  },
  biography: {
    role: 'Você é um biógrafo que escreve biografias curtas em inglês para estudantes do idioma.',
    levelLine: 'biografia narrada em terceira pessoa, em ordem cronológica.',
    rules: `- Escreva a BIOGRAFIA de uma pessoa real, conhecida e amplamente documentada, cuja trajetória inspire (ciência, esporte, arte, direitos civis, empreendedorismo etc.).
- Diga o nome completo da pessoa no início e conte, em terceira pessoa e em ordem cronológica: origem, obstáculos, decisões, conquistas e legado.
- Use apenas fatos amplamente conhecidos e verificáveis. NÃO invente personagens, eventos, datas, diálogos ou citações; se não tiver certeza de um detalhe, omita-o.`,
    varietyHint: 'Escolha uma pessoa DIFERENTE de qualquer pessoa retratada nos textos anteriores.',
  },
  nonfiction: {
    role: 'Você é um redator de textos informativos de não-ficção em inglês para estudantes do idioma.',
    levelLine: 'texto informativo em prosa, sem personagens inventados.',
    rules: `- Escreva um texto INFORMATIVO de não-ficção sobre fatos reais ligados ao tema, como um artigo de revista de divulgação — NÃO é um conto.
- Escolha um assunto concreto (um evento, uma descoberta, uma empresa, um fenômeno natural) e explique o contexto, o que aconteceu, por que importa e o que aprendemos com isso.
- Use apenas fatos reais amplamente documentados. NÃO invente personagens, dados, datas, diálogos ou citações; se não tiver certeza de um detalhe, omita-o.`,
    varietyHint: 'Escolha um assunto DIFERENTE dos abordados nos textos anteriores.',
  },
};

const GENRE_FORMATS = {
  'Motivação & Hábitos': 'selfhelp',
  'Produtividade & Foco': 'selfhelp',
  'Relacionamentos & Comunicação': 'selfhelp',
  'Saúde Mental & Equilíbrio': 'selfhelp',
  'Finanças Pessoais': 'selfhelp',
  'Biografia Inspiradora': 'biography',
  'História (Fatos reais)': 'nonfiction',
  'Ciência & Descobertas': 'nonfiction',
  'Empreendedorismo & Inovação': 'nonfiction',
  'Natureza & Meio Ambiente': 'nonfiction',
};

export function storyFormatFor(genre = '') {
  return GENRE_FORMATS[genre] || 'narrative';
}

function buildNonNarrativeVarietyNote(format, recentSnippets = [], rand = Math.random) {
  const spec = STORY_FORMATS[format];
  const avoid = (recentSnippets || []).filter(Boolean).slice(0, 5);
  const lines = ['\nVARIAÇÃO OBRIGATÓRIA deste texto (cada geração deve ser diferente da anterior):'];
  if (spec.variety) lines.push(`- Estrutura desta vez: ${pick(spec.variety, rand)}.`);
  if (spec.varietyHint) lines.push(`- ${spec.varietyHint}`);
  if (avoid.length) lines.push(`- NÃO repita o assunto nem a abertura destes textos anteriores: ${JSON.stringify(avoid)}.`);
  lines.push(`- Semente de variação: ${Math.floor(rand() * 1e6)}.`);
  return lines.join('\n');
}

// Prompt único da geração (web e extensão), para os dois lados não divergirem.
export function buildStoryPrompt({ genre, cefr, reencounter = [], recentSnippets = [], targetMinutes, learningGoal, rand = Math.random }) {
  const format = storyFormatFor(genre);
  const spec = STORY_FORMATS[format];
  const reencounterNote = reencounter.length
    ? `\nIMPORTANTE: incorpore NATURALMENTE ${Math.min(6, Math.max(4, reencounter.length))} destas palavras/expressões que o aluno está estudando (sem forçar, sem destacar, sem listar): ${reencounter.join(', ')}.`
    : '';
  const varietyNote = format === 'narrative'
    ? buildStoryVarietyNote(recentSnippets, rand)
    : buildNonNarrativeVarietyNote(format, recentSnippets, rand);
  const levelNote = buildLevelNote(cefr, { targetMinutes, learningGoal, format });
  return `${spec.role}
Nível do Estudante: CEFR ${cefr}.
Tema: ${genre}.
${reencounterNote}
${varietyNote}
${levelNote}
DIRETRIZES FUNDAMENTAIS DE FORMATO:
${spec.rules}
- O vocabulário e a gramática devem estar RIGOROSAMENTE alinhados ao nível CEFR ${cefr} especificado. Se o nível for A1 ou A2, garanta linguagem simples, direta e acessível, sem palavras difíceis ou tempos verbais complexos fora da banda.
- Não traduza o texto. Escreva apenas em inglês, diagramado como um livro: separe CADA parágrafo${format === 'narrative' ? ' e CADA turno de fala de personagem' : ''} OBRIGATORIAMENTE com duas quebras de linha (\n\n).${format === 'narrative' ? ' NUNCA junte falas de dois personagens no mesmo parágrafo.' : ''}
- NÃO use formatação markdown, NÃO coloque um título, apenas o texto.`;
}
