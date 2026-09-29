// content/subtitles/video-vocabulary.js — Vocabulário de um vídeo agrupado por
// lema, palavras-chave para o aluno e resumo de compreensão sem exagero.
import { getBaseVerbCandidates, IRREGULAR_VERB_MAP } from '../../utils/expressions-db.js';

const WORD_PATTERN = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'-]*/g;
// Terminam em -s mas não são plural de uma palavra comum.
const NOT_INFLECTED = new Set(['news', 'lens', 'series', 'species', 'always', 'perhaps']);

export function lemmaOf(word, lexicon) {
  const lower = String(word || '').toLowerCase();
  if (IRREGULAR_VERB_MAP[lower]) return IRREGULAR_VERB_MAP[lower];
  if (NOT_INFLECTED.has(lower)) return lower;
  for (const candidate of getBaseVerbCandidates(lower)) {
    if (candidate !== lower && candidate.length > 1 && lexicon.has(candidate)) return candidate;
  }
  return lower;
}

// Agrupa as palavras das falas por lema. Nomes próprios (só aparecem com
// inicial maiúscula e ao menos uma vez no meio da frase) ficam de fora.
// `ignored` (#368): palavras que o aluno escolheu ignorar somem, pela forma ou lema.
export function extractVideoVocabulary(cues, { stopWords = new Set(), rankMap = new Map(), ignored = new Set() } = {}) {
  const occurrences = [];
  const surface = new Set();
  (cues || []).forEach((cue, cueIndex) => {
    const text = String(cue?.text || '');
    for (const match of text.matchAll(WORD_PATTERN)) {
      const raw = match[0].replace(/^'+|'+$/g, '');
      const lower = raw.toLowerCase();
      if (lower.length <= 2 || stopWords.has(lower) || ignored.has(lower)) continue;
      const before = text.slice(0, match.index).trimEnd();
      const sentenceStart = before === '' || /[.!?]["')\]]*$/.test(before);
      const capitalized = raw[0] !== lower[0];
      occurrences.push({ lower, cueIndex, capitalized, sentenceStart });
      surface.add(lower);
    }
  });

  const lexicon = new Set([...surface, ...rankMap.keys(), ...ignored]);
  const byLemma = new Map();
  for (const occ of occurrences) {
    const lemma = lemmaOf(occ.lower, lexicon);
    if (stopWords.has(lemma) || ignored.has(lemma)) continue;
    let entry = byLemma.get(lemma);
    if (!entry) {
      entry = { lemma, count: 0, forms: new Set(), cueIndexes: new Set(), lowerSeen: false, midCapSeen: false };
      byLemma.set(lemma, entry);
    }
    entry.count += 1;
    entry.forms.add(occ.lower);
    entry.cueIndexes.add(occ.cueIndex);
    if (!occ.capitalized) entry.lowerSeen = true;
    else if (!occ.sentenceStart) entry.midCapSeen = true;
  }

  const vocabulary = new Map();
  for (const entry of byLemma.values()) {
    if (!entry.lowerSeen && entry.midCapSeen) continue;
    vocabulary.set(entry.lemma, {
      lemma: entry.lemma,
      count: entry.count,
      forms: [...entry.forms],
      cueIndexes: [...entry.cueIndexes],
      rank: rankMap.get(entry.lemma) || null,
    });
  }
  return vocabulary;
}

// Outras falas do vídeo com a palavra do card (#366), pelo mesmo lema da aba
// Palavras (filming/filmed/films → film). Expressões de várias palavras são
// buscadas como bloco. `excludeStart` tira a fala que abriu o card. `base` é a
// forma de dicionário quando conhecida (Google: filming → film); sem ela, o
// lema só é reduzido se a forma base também aparecer no vídeo.
export function findWordInVideo(cues, term, { excludeStart = null, limit = 3, base = '' } = {}) {
  const needle = String(term || '').trim().toLowerCase();
  if (!Array.isArray(cues) || !needle) return { total: 0, items: [] };
  const others = cues.filter((cue) => cue?.text && !(excludeStart != null && Math.abs(cue.start - excludeStart) < 0.01));
  const matches = [];
  if (/\s/.test(needle)) {
    const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    for (const cue of others) if (pattern.test(cue.text)) matches.push({ cue, form: needle });
  } else {
    const known = String(base || '').trim().toLowerCase();
    const lexicon = new Set([needle, ...(known ? [known] : [])]);
    for (const cue of cues) for (const m of String(cue?.text || '').matchAll(WORD_PATTERN)) lexicon.add(m[0].toLowerCase());
    const target = known || lemmaOf(needle, lexicon);
    for (const cue of others) {
      for (const m of cue.text.matchAll(WORD_PATTERN)) {
        const lower = m[0].replace(/^'+|'+$/g, '').toLowerCase();
        if (lower === needle || lower === target || lemmaOf(lower, lexicon) === target) {
          matches.push({ cue, form: lower });
          break;
        }
      }
    }
  }
  return {
    total: matches.length,
    items: matches.slice(0, limit).map(({ cue, form }) => ({
      start: cue.start,
      end: cue.end,
      text: cue.text,
      translatedText: cue.translatedText || '',
      form,
    })),
  };
}

export function wordStatus(entry, knownWords, savedWords) {
  const keys = [entry.lemma, ...entry.forms];
  if (keys.some((k) => knownWords?.has?.(k))) return 'known';
  for (const k of keys) {
    const status = savedWords?.get?.(k);
    if (status) return status;
  }
  return null;
}

// Palavras que o aluno ainda não marcou, das mais repetidas no vídeo para as
// menos; no empate, as mais comuns no idioma primeiro. As ~120 mais frequentes
// do idioma (out, over, back…) são gramática, não palavra-chave do vídeo.
export const KEYWORD_MIN_RANK = 120;

export function learnerKeywords(vocabulary, knownWords, savedWords, limit = 12) {
  return [...vocabulary.values()]
    .filter((entry) => !(entry.rank && entry.rank <= KEYWORD_MIN_RANK))
    .filter((entry) => !wordStatus(entry, knownWords, savedWords))
    .sort((a, b) => b.count - a.count || (a.rank || 1e9) - (b.rank || 1e9) || a.lemma.localeCompare(b.lemma))
    .slice(0, limit);
}

const UNDERSTOOD = new Set(['known', 'mature', 'review']);

// Percentual das ocorrências do vídeo cobertas por palavras que o aluno já
// marcou como conhecidas/dominadas. Sem nenhuma marcação, não há dado.
export function comprehensionSummary(vocabulary, knownWords, savedWords) {
  let totalTokens = 0;
  let coveredTokens = 0;
  let marked = 0;
  const counts = { known: 0, mature: 0, review: 0, learning: 0, saved: 0, unmarked: 0 };
  for (const entry of vocabulary.values()) {
    const status = wordStatus(entry, knownWords, savedWords);
    totalTokens += entry.count;
    if (status) marked += 1;
    if (UNDERSTOOD.has(status)) coveredTokens += entry.count;
    if (status === 'known') counts.known += 1;
    else if (status === 'mature') counts.mature += 1;
    else if (status === 'review') counts.review += 1;
    else if (status === 'learning') counts.learning += 1;
    else if (status) counts.saved += 1;
    else counts.unmarked += 1;
  }
  return {
    hasData: marked > 0,
    percent: totalTokens > 0 ? Math.round((coveredTokens / totalTokens) * 100) : 0,
    totalWords: vocabulary.size,
    counts,
  };
}
