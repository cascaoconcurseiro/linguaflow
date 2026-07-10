// dashboard/js/core/placement.js — Teste de nivelamento CEFR.
// Método: reconhecimento de vocabulário por faixa (como os vocab size tests
// de Cambridge/testyourvocab), com PSEUDO-PALAVRAS como controle de honestidade:
// quem marca "conheço" em palavra que não existe tem o score descontado.
// Dados: utils/cefr-wordlist.json (word -> A1..B2) e utils/frequency-en.json
// (word -> rank). A wordlist só vai até B2, então C1 é estimado com as
// palavras mais raras da faixa B2 (rank >= 8500). C2 não é estimável aqui.

const PSEUDO_WORDS = ['blenter', 'morvane', 'stribule', 'clendify', 'prunek', 'dwimble'];
const PER_BAND = 6;
const PASS_RATE = 0.6;

// Amostra n itens determinística-aleatória de um array
function sample(arr, n, rand = Math.random) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

export function buildPlacementTest(cefrMap, freqMap, rand = Math.random) {
  const byBand = { A1: [], A2: [], B1: [], B2: [], C1: [] };
  for (const [word, level] of Object.entries(cefrMap)) {
    if (word.length < 3) continue; // "of/to/a" não medem nada
    const rank = freqMap[word] || 99999;
    if (level === 'B2' && rank >= 8500) byBand.C1.push(word);
    else if (byBand[level]) byBand[level].push(word);
  }

  const items = [];
  for (const band of ['A1', 'A2', 'B1', 'B2', 'C1']) {
    sample(byBand[band], PER_BAND, rand).forEach(word => items.push({ word, band }));
  }
  sample(PSEUDO_WORDS, PER_BAND, rand).forEach(word => items.push({ word, band: 'PSEUDO' }));

  return sample(items, items.length, rand); // embaralha tudo
}

// ═══════════════════════════════════════════════════════════════════════════
// FASES 2 e 3 (auditoria): o teste antigo só media "reconheço a palavra".
// Agora: cloze (gramática/leitura em contexto, adaptativo por banda, como o
// Oxford Placement) + listening (escuta → sentido, como o Duolingo English
// Test). O resultado final combina as três habilidades e mostra as lacunas.
// ═══════════════════════════════════════════════════════════════════════════

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

// Cloze: 3 itens por banda; passa a banda com 2+ acertos → sobe (escada adaptativa)
export const CLOZE_BANK = {
  A1: [
    { sentence: 'She ___ a teacher.', options: ['is', 'are', 'am', 'be'], answer: 0 },
    { sentence: 'I have two ___.', options: ['dogs', 'dog', 'doges', "dog's"], answer: 0 },
    { sentence: '___ you like coffee?', options: ['Do', 'Does', 'Are', 'Is'], answer: 0 },
  ],
  A2: [
    { sentence: 'Yesterday I ___ to the beach.', options: ['went', 'go', 'gone', 'going'], answer: 0 },
    { sentence: 'She is ___ than her brother.', options: ['taller', 'tall', 'more tall', 'tallest'], answer: 0 },
    { sentence: 'We ___ TV when he arrived.', options: ['were watching', 'watch', 'are watching', 'watched'], answer: 0 },
  ],
  B1: [
    { sentence: 'If it rains, we ___ at home.', options: ['will stay', 'stayed', 'would stayed', 'staying'], answer: 0 },
    { sentence: "I've lived here ___ 2010.", options: ['since', 'for', 'from', 'during'], answer: 0 },
    { sentence: 'The report ___ by the team yesterday.', options: ['was written', 'wrote', 'is writing', 'has written'], answer: 0 },
  ],
  B2: [
    { sentence: 'I wish I ___ more time to travel.', options: ['had', 'have', 'would have', 'has'], answer: 0 },
    { sentence: 'By next year, she ___ her degree.', options: ['will have finished', 'finishes', 'is finishing', 'has finished'], answer: 0 },
    { sentence: '___ the bad weather, the flight left on time.', options: ['Despite', 'Although', 'However', 'Because'], answer: 0 },
  ],
  C1: [
    { sentence: 'Not until the results came in ___ the scale of the problem.', options: ['did we grasp', 'we grasped', 'we did grasp', 'grasped we'], answer: 0 },
    { sentence: 'The proposal was turned down, ___ came as no surprise.', options: ['which', 'what', 'that', 'it'], answer: 0 },
    { sentence: 'He was on the ___ of resigning when the offer arrived.', options: ['verge', 'border', 'limit', 'margin'], answer: 0 },
  ],
};

// Listening: a frase é FALADA (TTS); o aluno escolhe o sentido em português.
export const LISTENING_BANK = {
  A1: [
    { sentence: 'Where is the bathroom?', options: ['Onde fica o banheiro?', 'Que horas são?', 'Quanto custa isso?', 'Qual é o seu nome?'], answer: 0 },
    { sentence: "I'm hungry.", options: ['Estou com fome.', 'Estou com sono.', 'Estou atrasado.', 'Estou feliz.'], answer: 0 },
  ],
  A2: [
    { sentence: 'Could you speak more slowly, please?', options: ['Você poderia falar mais devagar, por favor?', 'Você pode falar mais alto, por favor?', 'Você pode repetir seu nome?', 'Você poderia escrever isso pra mim?'], answer: 0 },
    { sentence: 'I missed the bus this morning.', options: ['Perdi o ônibus hoje de manhã.', 'Peguei o ônibus hoje de manhã.', 'O ônibus atrasou de manhã.', 'Senti falta do ônibus antigo.'], answer: 0 },
  ],
  B1: [
    { sentence: "I'm looking forward to seeing you next week.", options: ['Mal posso esperar pra te ver semana que vem.', 'Vou te procurar na semana que vem.', 'Estou olhando pra frente na fila.', 'Talvez eu te veja semana que vem.'], answer: 0 },
    { sentence: "You'd better take an umbrella, just in case.", options: ['É melhor você levar um guarda-chuva, por via das dúvidas.', 'Você comprou um guarda-chuva melhor pro caso.', 'Você deveria devolver o guarda-chuva.', 'Leve a capa de chuva dentro da mala.'], answer: 0 },
  ],
  B2: [
    { sentence: "I can't put up with this noise any longer.", options: ['Não aguento mais esse barulho.', 'Não consigo aumentar esse som.', 'Não posso subir com esse barulho.', 'Esse barulho não vai durar muito.'], answer: 0 },
    { sentence: 'It turned out that he had been right all along.', options: ['No fim das contas, ele estava certo o tempo todo.', 'Ele virou à direita o caminho todo.', 'Acabou que ele foi embora cedo.', 'Ele acabou aceitando que errou.'], answer: 0 },
  ],
  C1: [
    { sentence: 'Had I known about the meeting, I would have attended.', options: ['Se eu soubesse da reunião, eu teria ido.', 'Eu sabia da reunião e fui.', 'Quando souber da reunião, eu vou.', 'Eu deveria ter marcado a reunião.'], answer: 0 },
    { sentence: "She's by no means the only one who feels that way.", options: ['Ela não é, de forma alguma, a única que se sente assim.', 'Ela não tem meios de se sentir assim.', 'Com certeza só ela se sente assim.', 'Ela quase nunca se sente desse jeito.'], answer: 0 },
  ],
};

// Embaralha as opções de um item preservando qual é a correta
export function shuffleItem(item, rand = Math.random) {
  const idx = item.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    ...item,
    options: idx.map(i => item.options[i]),
    answer: idx.indexOf(item.answer),
  };
}

export function levelIndex(level) {
  const i = LEVELS.indexOf(level);
  return i === -1 ? 0 : i;
}

// Escada adaptativa do cloze: começa uma banda ABAIXO do vocabulário
// (confirma a base antes de desafiar), sobe enquanto acertar 2+ de 3.
export function clozeStartBand(vocabLevel) {
  return LEVELS[Math.max(0, levelIndex(vocabLevel) - 1)];
}

// results: [{ band, correct: n de 3 }] em ordem crescente → banda final
export function scoreClozeLadder(results) {
  let level = 'A1';
  for (const r of results) {
    if (r.correct >= 2) level = r.band;
    else break;
  }
  return level;
}

// Listening: 6 itens (2 na banda do cloze, 2 abaixo, 2 acima, com clamp)
export function listeningBands(clozeLevel) {
  const i = levelIndex(clozeLevel);
  return [LEVELS[Math.max(0, i - 1)], LEVELS[i], LEVELS[Math.min(LEVELS.length - 1, i + 1)]];
}

export function scoreListening(clozeLevel, correct, total) {
  const i = levelIndex(clozeLevel);
  if (total <= 0) return clozeLevel;
  const ratio = correct / total;
  if (ratio >= 0.83) return LEVELS[Math.min(LEVELS.length - 1, i + 1)];
  if (ratio >= 0.5) return LEVELS[i];
  return LEVELS[Math.max(0, i - 1)];
}

// Combina as 3 habilidades: vocabulário 40%, gramática/leitura 40%, escuta 20%
export function combinePlacement(vocabLevel, clozeLevel, listeningLevel, honesty = 100) {
  const v = levelIndex(vocabLevel), c = levelIndex(clozeLevel), l = levelIndex(listeningLevel);
  const rawIdx = Math.round(0.4 * v + 0.4 * c + 0.2 * l);
  // Marcar pseudo-palavras como conhecidas invalida a base de vocabulário.
  // Nesse caso não é honesto aplicar um nível alto apenas por chutes nas
  // alternativas de cloze/listening: exige refazer o diagnóstico.
  const retestRequired = honesty < 60;
  const finalIdx = retestRequired ? Math.min(rawIdx, v) : rawIdx;
  const gaps = [];
  if (v < finalIdx) gaps.push('vocabulário');
  if (c < finalIdx) gaps.push('gramática/leitura');
  if (l < finalIdx) gaps.push('escuta');
  return {
    level: LEVELS[Math.max(0, Math.min(LEVELS.length - 1, finalIdx))],
    breakdown: { vocab: vocabLevel, cloze: clozeLevel, listening: listeningLevel },
    gaps,
    retestRequired,
  };
}

// answers: [{ band, known: boolean }] → { level, bands, honesty }
export function scorePlacement(answers) {
  const bands = {};
  for (const band of ['A1', 'A2', 'B1', 'B2', 'C1', 'PSEUDO']) {
    const items = answers.filter(a => a.band === band);
    const yes = items.filter(a => a.known).length;
    bands[band] = items.length ? yes / items.length : 0;
  }

  // Controle de honestidade: cada "conheço" em pseudo-palavra desconta forte
  const honesty = 1 - Math.min(1, bands.PSEUDO * 1.5);

  let level = 'A1';
  for (const band of ['A1', 'A2', 'B1', 'B2', 'C1']) {
    const adjusted = bands[band] * honesty;
    if (adjusted >= PASS_RATE) level = band;
    else break; // exige continuidade: não pula buracos
  }

  return { level, bands, honesty: Math.round(honesty * 100) };
}
