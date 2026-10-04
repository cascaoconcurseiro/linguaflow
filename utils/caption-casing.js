// utils/caption-casing.js — Normalização inteligente de caixa e maiúsculas/minúsculas em legendas.
// Corrige textos em ALL CAPS (gritados, letras de música, EIA-608) e quebras de linha concatenadas,
// preservando o pronome 'I', siglas consagradas (USA, NASA, TV) e nomes próprios.

const KNOWN_ACRONYMS = new Set([
  'USA', 'US', 'UK', 'NASA', 'FBI', 'CIA', 'TV', 'OK', 'AI', 'ID', 'DNA', 'DJ',
  'CEO', 'CFO', 'CTO', 'VIP', 'EU', 'UN', 'ASAP', 'DIY', 'HR', 'PM', 'AM', 'FAQ',
  'NBA', 'NFL', 'MLB', 'NHL', 'UFC', 'BBC', 'CNN', 'HBO', 'DVD', 'CD', 'PC',
  'PS', 'IQ', 'VR', 'AR', 'ATM', 'GPS', 'SOS', 'LED', 'LCD', 'HD', '4K', 'RIP'
]);

// Palavras funcionais e léxicas comuns do inglês que NUNCA são substantivos próprios no meio da frase
const COMMON_LOWERCASE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'is', 'are',
  'was', 'were', 'be', 'been', 'it', 'this', 'that', 'you', 'we', 'they', 'he', 'she', 'do',
  'does', 'did', 'not', 'so', 'as', 'if', 'my', 'your', 'our', 'their', 'his', 'her', 'its', 'by',
  'from', 'up', 'about', 'into', 'than', 'then', 'when', 'what', 'which', 'who', 'how', 'all',
  'each', 'more', 'also', 'just', 'can', 'will', 'would', 'could', 'should', 'may', 'might',
  'have', 'has', 'had', 'get', 'got', 'go', 'come', 'know', 'think', 'see', 'look', 'want', 'use',
  'find', 'give', 'tell', 'work', 'call', 'try', 'ask', 'need', 'feel', 'become', 'leave', 'put',
  'mean', 'keep', 'let', 'begin', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe', 'hold',
  'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue',
  'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak',
  'read', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear',
  'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill',
  'start', 'turn', 'make', 'take', 'say', 'said', 'like', 'even', 'back', 'there', 'here', 'now',
  'too', 'very', 'never', 'always', 'often', 'really', 'every', 'such', 'much', 'many', 'some',
  'any', 'no', 'own', 'other', 'another', 'first', 'last', 'long', 'great', 'little', 'old',
  'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important', 'few'
]);

const SENTENCE_END = /[.!?…。！？][”’"')\]]*$/u;

/**
 * Verifica se um trecho de texto está em ALL CAPS (gritado ou estilo EIA-608).
 * @param {string} text
 * @returns {boolean}
 */
export function isAllCapsSentence(text) {
  if (!text || typeof text !== 'string') return false;
  const words = text.match(/[a-zA-Z\u00C0-\u024F']+/g);
  if (!words || words.length === 0) return false;

  // Ignora palavras de 1 letra (como 'I' ou 'A') para o cálculo de ALL CAPS
  const significant = words.filter((w) => w.length > 1);
  if (significant.length === 0) {
    // Frase com uma única palavra curta: "NO!", "WAIT!"
    return words[0] === words[0].toUpperCase() && words[0].toLowerCase() !== words[0].toUpperCase();
  }

  // Se todas as palavras significativas são maiúsculas e contêm letras
  const allUpper = significant.every((w) => w === w.toUpperCase() && w.toLowerCase() !== w.toUpperCase());
  return allUpper;
}

/**
 * Converte uma palavra isolada para o formato correto em Sentence Case.
 * @param {string} word
 * @param {boolean} isFirst
 * @returns {string}
 */
function formatWordInSentence(word, isFirst) {
  const upper = word.toUpperCase();
  const lower = word.toLowerCase();

  // Siglas conhecidas são sempre preservadas em maiúsculas
  if (KNOWN_ACRONYMS.has(upper)) {
    return upper;
  }

  // Pronome 'I' e contrações com 'I' (I'm, I've, I'll, I'd)
  if (upper === 'I') {
    return 'I';
  }
  if (lower.startsWith("i'")) {
    return 'I' + lower.slice(1);
  }

  if (isFirst) {
    // Primeira palavra da sentença: Inicial maiúscula, restante minúsculo
    return word.charAt(0).toUpperCase() + lower.slice(1);
  }

  // Palavras subsequentes em sentença convertida
  return lower;
}

function isShoutedWord(w) {
  return w.length > 1 && w === w.toUpperCase() && w.toLowerCase() !== w.toUpperCase() && !KNOWN_ACRONYMS.has(w);
}

// Não conta como gritada, mas não interrompe a sequência (I, A, É, TV, FBI).
function isLoneUpperLetter(w) {
  const upper = w === w.toUpperCase() && w.toLowerCase() !== w.toUpperCase();
  return upper && (w.length === 1 || KNOWN_ACRONYMS.has(w));
}

/**
 * Oração mista: o trecho gritado ("SMELLS LIKE IT'S coming from Gunter") fica
 * maior que o resto na tela. Só mexe em sequências de 2+ palavras em CAIXA ALTA
 * ou numa palavra longa (5+ letras) que abre a oração ("GUNTER, something...");
 * uma palavra isolada no meio da frase pode ser sigla e é mantida.
 */
function normalizeShoutedRuns(sentence) {
  const tokens = [...sentence.matchAll(/[a-zA-ZÀ-ɏ']+/g)];
  if (tokens.length < 2) return sentence;

  const convert = new Array(tokens.length).fill(false);
  let i = 0;
  while (i < tokens.length) {
    if (!isShoutedWord(tokens[i][0])) { i += 1; continue; }
    let end = i;
    let shouted = 1;
    let j = i + 1;
    while (j < tokens.length && (isShoutedWord(tokens[j][0]) || isLoneUpperLetter(tokens[j][0]))) {
      if (isShoutedWord(tokens[j][0])) { shouted += 1; end = j; }
      j += 1;
    }
    const opensSentence = i === 0 && tokens[0][0].length >= 5;
    if (shouted >= 2 || opensSentence) {
      for (let k = i; k <= end; k += 1) convert[k] = true;
    }
    i = end + 1;
  }
  if (!convert.some(Boolean)) return sentence;

  let out = '';
  let cursor = 0;
  tokens.forEach((t, idx) => {
    out += sentence.slice(cursor, t.index);
    out += convert[idx] ? formatWordInSentence(t[0], idx === 0) : t[0];
    cursor = t.index + t[0].length;
  });
  return out + sentence.slice(cursor);
}

/**
 * Normaliza o casing de uma sentença individual que foi identificada como ALL CAPS.
 * @param {string} sentence
 * @returns {string}
 */
function normalizeSentence(sentence) {
  if (!isAllCapsSentence(sentence)) {
    return normalizeShoutedRuns(sentence);
  }

  let isFirstWord = true;
  return sentence.replace(/[a-zA-Z\u00C0-\u024F']+/g, (match) => {
    const formatted = formatWordInSentence(match, isFirstWord);
    isFirstWord = false;
    return formatted;
  });
}

/**
 * Normaliza o texto de uma legenda completa:
 * - Detecta sentenças em ALL CAPS e as converte para Sentence Case.
 * - Preserva pronome 'I' e siglas reais (USA, NASA, TV).
 * - Não toca em sentenças normais que já possuem capitalização correta.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeSubtitleCasing(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Divide o texto mantendo delimitadores de fim de sentença (. ! ?)
  const segments = trimmed.split(/(?<=[.!?…。！？])\s+/);
  const normalized = segments.map((seg) => normalizeSentence(seg));

  return normalized.join(' ');
}

/**
 * Ajusta a caixa de um fragmento que está sendo concatenado ao anterior sem pontuação de término.
 * Se o fragmento anterior não terminou em ponto final, e o fragmento atual começa com uma
 * palavra comum capitalizada (ex: "Start", "Because", "You"), descapitaliza a primeira letra.
 *
 * @param {string} previousText
 * @param {string} nextText
 * @returns {string}
 */
export function adjustFragmentCasing(previousText, nextText) {
  if (!nextText || typeof nextText !== 'string') return '';
  if (!previousText || typeof previousText !== 'string') return nextText;

  // Se o fragmento anterior terminou com pontuação terminal, mantém a capitalização original
  if (SENTENCE_END.test(previousText.trim())) {
    return nextText;
  }

  // Encontra a primeira palavra do próximo fragmento
  const match = nextText.match(/^(\s*['"(\[—-]*)?([a-zA-Z\u00C0-\u024F']+)/);
  if (!match) return nextText;

  const prefix = match[1] || '';
  const firstWord = match[2];
  const upper = firstWord.toUpperCase();
  const lower = firstWord.toLowerCase();

  // Preserva 'I', contrações de 'I' e siglas
  if (upper === 'I' || lower.startsWith("i'") || KNOWN_ACRONYMS.has(upper)) {
    return nextText;
  }

  // Início de citação ("Enjoy life...) começa uma nova oração.
  if (/["“]/.test(prefix)) return nextText;

  // #364: só palavras comuns em Title Case de início de linha viram minúsculas;
  // nomes próprios (September, Sarah) mantêm a maiúscula.
  if (COMMON_LOWERCASE_WORDS.has(lower) && /^[A-Z][a-z']*$/.test(firstWord)) {
    const loweredWord = lower;
    const restOfText = nextText.slice(match[0].length);
    return `${prefix}${loweredWord}${restOfText}`;
  }

  return nextText;
}
