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

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Placement v3 (Onda 3.2): banco maior (5 itens/banda, era 3) — reduz o peso
// da sorte na escada adaptativa. C2 não tem dados de vocabulário (a wordlist
// só vai até B2), então só é alcançável subindo a escada de cloze/listening
// até o topo — aproximação real de exames tipo Cambridge, que avaliam C2
// por gramática/leitura/escuta/produção, não por lista de palavras.
export const CLOZE_BANK = {
  A1: [
    { sentence: 'She ___ a teacher.', options: ['is', 'are', 'am', 'be'], answer: 0 },
    { sentence: 'I have two ___.', options: ['dogs', 'dog', 'doges', "dog's"], answer: 0 },
    { sentence: '___ you like coffee?', options: ['Do', 'Does', 'Are', 'Is'], answer: 0 },
    { sentence: 'This is ___ book.', options: ['my', 'me', 'I', 'mine is'], answer: 0 },
    { sentence: 'There ___ two cats in the garden.', options: ['are', 'is', 'be', 'am'], answer: 0 },
  ],
  A2: [
    { sentence: 'Yesterday I ___ to the beach.', options: ['went', 'go', 'gone', 'going'], answer: 0 },
    { sentence: 'She is ___ than her brother.', options: ['taller', 'tall', 'more tall', 'tallest'], answer: 0 },
    { sentence: 'We ___ TV when he arrived.', options: ['were watching', 'watch', 'are watching', 'watched'], answer: 0 },
    { sentence: 'I ___ finished my homework yet.', options: ["haven't", "didn't", "don't", "wasn't"], answer: 0 },
    { sentence: 'You ___ wear a seatbelt in the car.', options: ['must', 'can', 'would', 'may'], answer: 0 },
  ],
  B1: [
    { sentence: 'If it rains, we ___ at home.', options: ['will stay', 'stayed', 'would stayed', 'staying'], answer: 0 },
    { sentence: "I've lived here ___ 2010.", options: ['since', 'for', 'from', 'during'], answer: 0 },
    { sentence: 'The report ___ by the team yesterday.', options: ['was written', 'wrote', 'is writing', 'has written'], answer: 0 },
    { sentence: 'She asked me where ___.', options: ['I lived', 'do I live', 'I live', 'did I live'], answer: 0 },
    { sentence: 'By the time we arrived, the movie ___.', options: ['had already started', 'already started', 'has already started', 'was already starting'], answer: 0 },
  ],
  B2: [
    { sentence: 'I wish I ___ more time to travel.', options: ['had', 'have', 'would have', 'has'], answer: 0 },
    { sentence: 'By next year, she ___ her degree.', options: ['will have finished', 'finishes', 'is finishing', 'has finished'], answer: 0 },
    { sentence: '___ the bad weather, the flight left on time.', options: ['Despite', 'Although', 'However', 'Because'], answer: 0 },
    { sentence: 'If I ___ known, I would have called you.', options: ['had', 'have', 'would have', 'did'], answer: 0 },
    { sentence: 'He suggested ___ the meeting until Friday.', options: ['postponing', 'to postpone', 'postpone', 'postponed'], answer: 0 },
  ],
  C1: [
    { sentence: 'Not until the results came in ___ the scale of the problem.', options: ['did we grasp', 'we grasped', 'we did grasp', 'grasped we'], answer: 0 },
    { sentence: 'The proposal was turned down, ___ came as no surprise.', options: ['which', 'what', 'that', 'it'], answer: 0 },
    { sentence: 'He was on the ___ of resigning when the offer arrived.', options: ['verge', 'border', 'limit', 'margin'], answer: 0 },
    { sentence: 'Rarely ___ such a compelling argument.', options: ['have I heard', 'I have heard', 'I heard', 'did I heard'], answer: 0 },
    { sentence: 'She has a tendency ___ things out of proportion.', options: ['to blow', 'blowing', 'blow', 'blown'], answer: 0 },
  ],
  C2: [
    { sentence: 'Little ___ that the decision would cost him his career.', options: ['did he know', 'he knew', 'he did know', 'knew he'], answer: 0 },
    { sentence: 'The committee\'s findings, ___ they were, failed to sway public opinion.', options: ['damning as', 'as damning', 'damning that', 'so damning'], answer: 0 },
    { sentence: 'It was ___ that he eventually admitted his mistake.', options: ['not until much later', 'until much later', 'not later much', 'until not later'], answer: 0 },
    { sentence: 'Had the board been consulted, the merger ___ differently.', options: ['might have unfolded', 'would unfold', 'unfolded', 'might unfold'], answer: 0 },
    { sentence: 'She is nothing ___ meticulous in her research.', options: ['if not', 'unless', 'except', 'other than'], answer: 0 },
  ],
};

// Listening: a frase é FALADA (TTS); o aluno escolhe o sentido em português.
export const LISTENING_BANK = {
  A1: [
    { sentence: 'Where is the bathroom?', options: ['Onde fica o banheiro?', 'Que horas são?', 'Quanto custa isso?', 'Qual é o seu nome?'], answer: 0 },
    { sentence: "I'm hungry.", options: ['Estou com fome.', 'Estou com sono.', 'Estou atrasado.', 'Estou feliz.'], answer: 0 },
    { sentence: 'What time is it?', options: ['Que horas são?', 'Onde você está?', 'Quem é você?', 'Como você está?'], answer: 0 },
    { sentence: 'I like this song.', options: ['Eu gosto dessa música.', 'Eu conheço essa música.', 'Eu escrevi essa música.', 'Eu odeio essa música.'], answer: 0 },
  ],
  A2: [
    { sentence: 'Could you speak more slowly, please?', options: ['Você poderia falar mais devagar, por favor?', 'Você pode falar mais alto, por favor?', 'Você pode repetir seu nome?', 'Você poderia escrever isso pra mim?'], answer: 0 },
    { sentence: 'I missed the bus this morning.', options: ['Perdi o ônibus hoje de manhã.', 'Peguei o ônibus hoje de manhã.', 'O ônibus atrasou de manhã.', 'Senti falta do ônibus antigo.'], answer: 0 },
    { sentence: 'She works at a hospital nearby.', options: ['Ela trabalha num hospital perto daqui.', 'Ela mora perto de um hospital.', 'Ela vai visitar um hospital.', 'Ela trabalhou num hospital longe daqui.'], answer: 0 },
    { sentence: "Don't forget to bring your umbrella.", options: ['Não esqueça de trazer seu guarda-chuva.', 'Não esqueça de comprar um guarda-chuva.', 'Lembre de deixar o guarda-chuva.', 'Esqueça o guarda-chuva.'], answer: 0 },
  ],
  B1: [
    { sentence: "I'm looking forward to seeing you next week.", options: ['Mal posso esperar pra te ver semana que vem.', 'Vou te procurar na semana que vem.', 'Estou olhando pra frente na fila.', 'Talvez eu te veja semana que vem.'], answer: 0 },
    { sentence: "You'd better take an umbrella, just in case.", options: ['É melhor você levar um guarda-chuva, por via das dúvidas.', 'Você comprou um guarda-chuva melhor pro caso.', 'Você deveria devolver o guarda-chuva.', 'Leve a capa de chuva dentro da mala.'], answer: 0 },
    { sentence: 'He apologized for being late to the meeting.', options: ['Ele se desculpou por chegar atrasado na reunião.', 'Ele reclamou de estar atrasado na reunião.', 'Ele cancelou a reunião por atraso.', 'Ele avisou que chegaria atrasado.'], answer: 0 },
    { sentence: "I'm not sure if I can make it tonight.", options: ['Não tenho certeza se vou conseguir ir hoje à noite.', 'Tenho certeza que vou hoje à noite.', 'Não sei fazer isso hoje à noite.', 'Não vou fazer isso essa noite.'], answer: 0 },
  ],
  B2: [
    { sentence: "I can't put up with this noise any longer.", options: ['Não aguento mais esse barulho.', 'Não consigo aumentar esse som.', 'Não posso subir com esse barulho.', 'Esse barulho não vai durar muito.'], answer: 0 },
    { sentence: 'It turned out that he had been right all along.', options: ['No fim das contas, ele estava certo o tempo todo.', 'Ele virou à direita o caminho todo.', 'Acabou que ele foi embora cedo.', 'Ele acabou aceitando que errou.'], answer: 0 },
    { sentence: 'The company is bound to face some backlash over this.', options: ['A empresa certamente vai enfrentar alguma reação negativa por isso.', 'A empresa está presa a um contrato por causa disso.', 'A empresa vai processar alguém por causa disso.', 'A empresa evitou qualquer problema com isso.'], answer: 0 },
    { sentence: 'She tends to jump to conclusions too quickly.', options: ['Ela costuma tirar conclusões precipitadas rápido demais.', 'Ela costuma pular etapas do trabalho.', 'Ela evita concluir as coisas rápido.', 'Ela sempre conclui tudo com calma.'], answer: 0 },
  ],
  C1: [
    { sentence: 'Had I known about the meeting, I would have attended.', options: ['Se eu soubesse da reunião, eu teria ido.', 'Eu sabia da reunião e fui.', 'Quando souber da reunião, eu vou.', 'Eu deveria ter marcado a reunião.'], answer: 0 },
    { sentence: "She's by no means the only one who feels that way.", options: ['Ela não é, de forma alguma, a única que se sente assim.', 'Ela não tem meios de se sentir assim.', 'Com certeza só ela se sente assim.', 'Ela quase nunca se sente desse jeito.'], answer: 0 },
    { sentence: 'The negotiations broke down amid mounting distrust.', options: ['As negociações fracassaram em meio a uma desconfiança crescente.', 'As negociações começaram apesar da desconfiança.', 'As negociações foram adiadas por falta de confiança.', 'As negociações terminaram bem, superando a desconfiança.'], answer: 0 },
    { sentence: 'He has a knack for putting people at ease.', options: ['Ele tem um talento pra deixar as pessoas à vontade.', 'Ele tem o hábito de deixar as pessoas nervosas.', 'Ele sabe colocar as pessoas em apuros.', 'Ele prefere deixar as pessoas sozinhas.'], answer: 0 },
  ],
  C2: [
    { sentence: 'The findings, while not conclusive, are nonetheless suggestive of a broader trend.', options: ['As descobertas, embora não conclusivas, ainda assim sugerem uma tendência mais ampla.', 'As descobertas são conclusivas e não sugerem tendência nenhuma.', 'As descobertas foram descartadas por não serem conclusivas.', 'As descobertas confirmam uma tendência já conhecida.'], answer: 0 },
    { sentence: 'It would be remiss of me not to mention his contribution.', options: ['Seria uma falha minha não mencionar a contribuição dele.', 'Seria injusto mencionar a contribuição dele.', 'Eu prefiro não mencionar a contribuição dele.', 'Não é necessário mencionar a contribuição dele.'], answer: 0 },
    { sentence: 'The policy, for all its good intentions, backfired spectacularly.', options: ['A política, apesar de bem-intencionada, fracassou de forma espetacular.', 'A política teve boas intenções e deu muito certo.', 'A política foi cancelada antes de começar.', 'A política funcionou apesar de mal-intencionada.'], answer: 0 },
    { sentence: 'Few would dispute that the reform was long overdue.', options: ['Poucos discordariam que a reforma já estava muito atrasada.', 'Poucos discordariam que a reforma foi precipitada.', 'Ninguém concorda que a reforma era necessária.', 'Todos discordam que a reforma atrasou.'], answer: 0 },
  ],
};

// Fase 4 (Onda 3.2): mini-produção escrita corrigida por IA — Cambridge de
// verdade combina vocabulário + gramática/leitura + escuta + PRODUÇÃO, não só
// reconhecimento passivo. O prompt varia por faixa pra não pedir um texto
// impossível de A1 nem um texto banal demais de C1/C2.
export const WRITING_PROMPTS = {
  beginner: 'Write 3-4 short sentences in English about your daily routine (what you do every morning).',
  intermediate: 'Write a short paragraph (5-8 sentences) in English about a trip you would like to take and why.',
  advanced: 'Write a short paragraph (6-10 sentences) in English giving your opinion on whether remote work is better than working in an office, with at least one reason.',
};

export function writingPromptFor(level) {
  const i = levelIndex(level);
  if (i <= 1) return WRITING_PROMPTS.beginner;   // A1/A2
  if (i <= 3) return WRITING_PROMPTS.intermediate; // B1/B2
  return WRITING_PROMPTS.advanced;               // C1/C2
}

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
// (confirma a base antes de desafiar), sobe enquanto acertar 60%+ da banda.
export function clozeStartBand(vocabLevel) {
  return LEVELS[Math.max(0, levelIndex(vocabLevel) - 1)];
}

// Onda 3.2: banco cresceu de 3 pra 5 itens/banda — o corte vira proporcional
// (60%, mesma régua do vocabulário) em vez do "2 fixo" antigo, senão bandas
// maiores ficariam artificialmente mais fáceis de passar.
export function clozePassThreshold(total) {
  return Math.ceil(total * PASS_RATE);
}

// results: [{ band, correct, total }] em ordem crescente → banda final
export function scoreClozeLadder(results) {
  let level = 'A1';
  for (const r of results) {
    if (r.correct >= clozePassThreshold(r.total)) level = r.band;
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

// Combina vocabulário (40%) + gramática/leitura (40%) + escuta (20%), depois
// aplica um nudge opcional de produção escrita (Onda 3.2): a IA corrige o
// texto e devolve -1/0/+1, aplicado DEPOIS do cálculo objetivo — a escrita
// confirma/ajusta em até 1 banda, nunca decide sozinha nem domina o peso.
export function combinePlacement(vocabLevel, clozeLevel, listeningLevel, honesty = 100, writingAdjust = 0) {
  const v = levelIndex(vocabLevel), c = levelIndex(clozeLevel), l = levelIndex(listeningLevel);
  const rawIdx = Math.round(0.4 * v + 0.4 * c + 0.2 * l);
  // Marcar pseudo-palavras como conhecidas invalida a base de vocabulário.
  // Nesse caso não é honesto aplicar um nível alto apenas por chutes nas
  // alternativas de cloze/listening: exige refazer o diagnóstico.
  const retestRequired = honesty < 60;
  const safeAdjust = Math.max(-1, Math.min(1, Math.round(writingAdjust) || 0));
  const nudgedIdx = retestRequired ? rawIdx : rawIdx + safeAdjust;
  const finalIdx = retestRequired ? Math.min(nudgedIdx, v) : nudgedIdx;
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
