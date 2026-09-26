// utils/speech-cadence.js — Análise de cadência e fenômenos de fala conectada (Connected Speech).
// Permite auditar legendas e áudios para identificar velocidade de fala (WPM) e
// pontos de junção fonética (linking, assimilações palatais, elisões e reduções),
// auxiliando na superação das principais barreiras de compreensão oral no listening.

const REDUCTIONS = {
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to / have got to',
  kinda: 'kind of',
  sorta: 'sort of',
  coulda: 'could have',
  shoulda: 'should have',
  woulda: 'would have',
  dunno: "don't know",
  lemme: 'let me',
  gimme: 'give me',
  hafta: 'have to',
  outta: 'out of',
};

const PALATAL_ASSIMILATIONS = [
  { pattern: /\bdid\s+you\b/gi, phrase: 'did you', sound: 'did-ja (/dʒ/)' },
  { pattern: /\bdon't\s+you\b/gi, phrase: "don't you", sound: 'don-cha (/tʃ/)' },
  { pattern: /\bmeet\s+you\b/gi, phrase: 'meet you', sound: 'mee-tcha (/tʃ/)' },
  { pattern: /\bwould\s+you\b/gi, phrase: 'would you', sound: 'wood-ja (/dʒ/)' },
  { pattern: /\bcould\s+you\b/gi, phrase: 'could you', sound: 'cood-ja (/dʒ/)' },
  { pattern: /\bwhat\s+you\b/gi, phrase: 'what you', sound: 'wha-tcha (/tʃ/)' },
  { pattern: /\bgot\s+you\b/gi, phrase: 'got you', sound: 'got-cha (/tʃ/)' },
  { pattern: /\bcalled\s+you\b/gi, phrase: 'called you', sound: 'call-dja (/dʒ/)' },
];

const ELISION_PATTERNS = [
  { pattern: /\bnext\s+door\b/gi, phrase: 'next door', explanation: 'O /t/ é elidido entre consoantes (nex-door).' },
  { pattern: /\blast\s+night\b/gi, phrase: 'last night', explanation: 'O /t/ é elidido antes de consoante (las-night).' },
  { pattern: /\bfirst\s+time\b/gi, phrase: 'first time', explanation: 'O /t/ é elidido/suprimido (firs-time).' },
  { pattern: /\bhold\s+tight\b/gi, phrase: 'hold tight', explanation: 'O /d/ sofre elisão antes de consoante plosiva.' },
];

/**
 * Calcula a taxa de palavras por minuto (Words Per Minute — WPM) e classifica a cadência.
 *
 * @param {string} text - Texto falado no segmento
 * @param {number} durationSec - Duração do segmento em segundos
 * @returns {Object} { words, durationSec, wpm, cadence }
 */
export function calculateWpm(text, durationSec) {
  const words = String(text || '').trim().match(/[a-z0-9'-]+/gi) || [];
  if (words.length === 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    return {
      words: 0,
      durationSec: Math.max(0, durationSec || 0),
      wpm: 0,
      cadence: 'normal',
    };
  }

  const wpm = Math.round((words.length / durationSec) * 60);

  let cadence = 'normal';
  if (wpm < 125) {
    cadence = 'slow';
  } else if (wpm <= 175) {
    cadence = 'normal';
  } else if (wpm <= 210) {
    cadence = 'fast';
  } else {
    cadence = 'very_fast';
  }

  return {
    words: words.length,
    durationSec,
    wpm,
    cadence,
  };
}

/**
 * Detecta fenômenos de fala conectada em uma linha de legenda.
 *
 * @param {string} text - Texto da fala ou legenda
 * @returns {Array<Object>} Lista de fenômenos encontrados com explicações didáticas
 */
export function detectConnectedSpeech(text) {
  const findings = [];
  const clean = String(text || '').trim();
  if (!clean) return findings;

  // 1. Reduções coloquiais
  for (const [reduction, full] of Object.entries(REDUCTIONS)) {
    const re = new RegExp(`\\b${reduction}\\b`, 'gi');
    let match = null;
    while ((match = re.exec(clean)) !== null) {
      findings.push({
        type: 'reduction',
        phrase: match[0],
        explanation: `Redução fonética informal de "${full}".`,
        index: match.index,
      });
    }
  }

  // 2. Assimilações palatais (/t,d/ + /j/)
  for (const item of PALATAL_ASSIMILATIONS) {
    let match = null;
    while ((match = item.pattern.exec(clean)) !== null) {
      findings.push({
        type: 'assimilation',
        phrase: match[0],
        explanation: `Assimilação palatal: o encontro com o som de "y" transforma a pronúncia em ${item.sound}.`,
        index: match.index,
      });
    }
  }

  // 3. Elisões
  for (const item of ELISION_PATTERNS) {
    let match = null;
    while ((match = item.pattern.exec(clean)) !== null) {
      findings.push({
        type: 'elision',
        phrase: match[0],
        explanation: item.explanation,
        index: match.index,
      });
    }
  }

  // 4. Linking (consoante final + vogal inicial)
  // Palavras terminadas em consoante seguidas de palavra iniciada por vogal
  const wordsWithPos = [];
  const wordRegex = /\b[a-z']+\b/gi;
  let wordMatch = null;
  while ((wordMatch = wordRegex.exec(clean)) !== null) {
    wordsWithPos.push({ word: wordMatch[0], index: wordMatch.index });
  }

  for (let i = 0; i < wordsWithPos.length - 1; i++) {
    const w1 = wordsWithPos[i].word.toLowerCase();
    const w2 = wordsWithPos[i + 1].word.toLowerCase();

    // Regra de linking: consoante no fim de w1 e vogal no início de w2
    const endsWithConsonant = /[bcdfghjklmnpqrstvwxyz]$/i.test(w1);
    const startsWithVowel = /^[aeiou]/i.test(w2);

    if (endsWithConsonant && startsWithVowel) {
      const phrase = `${wordsWithPos[i].word} ${wordsWithPos[i + 1].word}`;
      findings.push({
        type: 'linking',
        phrase,
        explanation: `Junção fonética (linking): a consoante final liga-se diretamente à vogal seguinte, soando unificada.`,
        index: wordsWithPos[i].index,
      });
    }
  }

  return findings;
}

/**
 * Enriquece um segmento de legenda com métricas de cadência e detecção fonológica.
 *
 * @param {Object} segment - { start, end, text }
 * @returns {Object} Segmento enriquecido
 */
export function annotateCaptionSegment(segment) {
  if (!segment) {
    return {
      start: 0,
      end: 0,
      text: '',
      cadence: { words: 0, wpm: 0, cadence: 'normal' },
      connectedSpeech: [],
      hasChallengingPhonetics: false,
    };
  }

  const durationSec = Math.max(0.1, (segment.end || 0) - (segment.start || 0));
  const cadence = calculateWpm(segment.text, durationSec);
  const connectedSpeech = detectConnectedSpeech(segment.text);

  const hasChallengingPhonetics = cadence.cadence === 'very_fast' || connectedSpeech.length >= 2;

  return {
    ...segment,
    cadence,
    connectedSpeech,
    hasChallengingPhonetics,
  };
}
