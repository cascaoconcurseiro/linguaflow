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
