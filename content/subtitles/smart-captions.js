// content/subtitles/smart-captions.js — Legenda que se adapta ao que o aluno já sabe (#488)
//
// Conta, por fala, quantas palavras ainda são novas para o aluno. As duas opções
// inteligentes (esconder a tradução de falas que ele já entende e pausar só nas
// falas com palavra nova) usam essa contagem. Ambas vêm desligadas: sem ligar nas
// configurações, a legenda se comporta como sempre.
import { getBaseVerbCandidates, IRREGULAR_VERB_MAP } from '../../utils/expressions-db.js';
import { STOP_WORDS, TOP5K_RANK_MAP } from './word-frequency.js';

const WORD_PATTERN = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]*/g;
const UNDERSTOOD_STATUS = new Set(['mature', 'review']);
// As ~1000 palavras mais comuns do idioma contam como entendidas mesmo sem marcação.
export const COMMON_RANK_LIMIT = 1000;

function understoodForm(word, { knownWords, savedWords, ignoredWords }) {
  if (STOP_WORDS.has(word) || ignoredWords?.has?.(word) || knownWords?.has?.(word)) return true;
  if (UNDERSTOOD_STATUS.has(savedWords?.get?.(word))) return true;
  const rank = TOP5K_RANK_MAP.get(word);
  return Boolean(rank && rank <= COMMON_RANK_LIMIT);
}

function isUnderstood(word, vocab) {
  if (understoodForm(word, vocab)) return true;
  // Flexões (plurais, -ed, -ing, irregulares): vale se a forma base já é entendida.
  const irregular = IRREGULAR_VERB_MAP[word];
  if (irregular && understoodForm(irregular, vocab)) return true;
  for (const base of getBaseVerbCandidates(word)) {
    if (base !== word && base.length > 2 && understoodForm(base, vocab)) return true;
  }
  return false;
}

/**
 * @returns {{ total: number, unknown: number }} palavras contadas na fala e quantas são novas.
 * Ignora palavras de até 2 letras e nomes próprios (inicial maiúscula no meio da frase).
 */
export function cueNewWordStats(text, vocab = {}) {
  const source = String(text || '');
  let total = 0;
  let unknown = 0;
  for (const match of source.matchAll(WORD_PATTERN)) {
    const raw = match[0].replace(/^['’-]+|['’-]+$/g, '').replace(/['’]s$/i, '');
    const lower = raw.toLowerCase();
    if (lower.length <= 2) continue;
    const before = source.slice(0, match.index).trimEnd();
    const sentenceStart = before === '' || /[.!?]["')\]]*$/.test(before);
    if (raw[0] !== lower[0] && !sentenceStart) continue;
    total += 1;
    if (!isUnderstood(lower, vocab)) unknown += 1;
  }
  return { total, unknown };
}

/** Fala em que o aluno já entende todas as palavras: a tradução não acrescenta nada. */
export function isFullyUnderstood(stats) {
  return stats.total > 0 && stats.unknown === 0;
}

/** A pausa automática só vale para falas com ao menos uma palavra nova. */
export function hasNewWords(stats) {
  return stats.unknown > 0;
}

export const SMART_CAPTION_SETTINGS = ['smartHideKnownTranslation', 'smartAutoPause'];
