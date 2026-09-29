// utils/expression-detector.js
// Detecção única de expressões na fala (legenda, roteiro, aba Palavras e
// popup): phrasal verbs idiomáticos e gírias, com posições no texto.
//
// Verbo + preposição transparente ("look at", "add to", "act as", "need to")
// não é destacado: sublinhar quase toda fala tirava o sentido do destaque.
// Só conta como phrasal quem tem partícula adverbial (up, out, off…) ou está
// na lista de verbos preposicionais idiomáticos ("look after", "come across").
import { expressionsDB, matchExpressionCandidate, MAX_EXPRESSION_WORDS } from './expressions-db.js';
import { findSlangs } from './slangs-db.js';

export const PARTICLES = new Set([
  'up', 'out', 'off', 'down', 'away', 'back', 'over', 'around', 'round', 'through', 'along',
  'apart', 'aside', 'ahead', 'forward', 'forth', 'together', 'on', 'in', 'by', 'behind',
]);

export const IDIOMATIC_PREPOSITIONAL = new Set([
  'look after', 'look into', 'come across', 'run into', 'bump into', 'take after', 'stand for',
  'go for', 'deal with', 'count on', 'account for', 'get rid of', 'get at', 'come into',
  'fall for', 'pick on', 'run across', 'see to', 'call for', 'bring about', 'come about',
  'go about', 'set about', 'be up to', 'come up with', 'get along with', 'look forward to',
  'go without', 'do without',
]);

// Verbo + "on"/"in" que é preposição comum, não partícula ("depend on").
const PREPOSITIONAL_ON_IN = new Set([
  'depend', 'rely', 'focus', 'work', 'insist', 'comment', 'concentrate', 'agree', 'decide',
  'spend', 'live', 'reflect', 'base', 'dwell', 'embark', 'elaborate', 'believe', 'result',
  'participate', 'invest', 'succeed', 'specialize', 'engage', 'involve', 'interest', 'arrive',
  'land', 'sit', 'stand', 'lie', 'stay', 'wait', 'be',
]);

export function expressionKind(canonical) {
  const phrase = String(canonical || '').toLowerCase().trim();
  if (IDIOMATIC_PREPOSITIONAL.has(phrase)) return 'phrasal';
  const [verb, ...rest] = phrase.split(/\s+/);
  if (!rest.length || verb === 'be') return 'prepositional';
  const hasParticle = rest.some((word, i) => {
    if (!PARTICLES.has(word)) return false;
    // "depend on", "live in": preposição comum quando é a única palavra depois do verbo.
    if ((word === 'on' || word === 'in' || word === 'by') && i === 0 && rest.length === 1 && PREPOSITIONAL_ON_IN.has(verb)) {
      return false;
    }
    return true;
  });
  return hasParticle ? 'phrasal' : 'prepositional';
}

const WORD_PATTERN = /[A-Za-zÀ-ɏ']+/g;
const SENTENCE_BREAK = /[.!?;:]/;

function wordTokens(text) {
  const tokens = [];
  let previousEnd = 0;
  for (const match of String(text || '').matchAll(WORD_PATTERN)) {
    const clean = match[0].toLowerCase().replace(/^'+|'+$/g, '');
    if (!clean) continue;
    const gap = text.slice(previousEnd, match.index);
    tokens.push({ word: clean, start: match.index, end: match.index + match[0].length, breakBefore: SENTENCE_BREAK.test(gap) });
    previousEnd = match.index + match[0].length;
  }
  return tokens;
}

// Phrasal verbs idiomáticos: o maior bloco conhecido a partir de cada palavra,
// sem atravessar fim de frase.
export function findPhrasalVerbs(text, maxWords = MAX_EXPRESSION_WORDS) {
  const tokens = wordTokens(text);
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    let best = null;
    const words = [tokens[i].word];
    for (let j = i + 1; j < tokens.length && words.length < maxWords; j++) {
      if (tokens[j].breakBefore) break;
      words.push(tokens[j].word);
      const match = matchExpressionCandidate(words);
      const candidate = words.join(' ');
      const canonical = match?.canonical || (expressionsDB.has(candidate) ? candidate : null);
      if (canonical && expressionKind(canonical) === 'phrasal') best = { canonical, endToken: j };
    }
    if (best) {
      found.push({
        type: 'phrasal',
        canonical: best.canonical,
        index: tokens[i].start,
        length: tokens[best.endToken].end - tokens[i].start,
      });
      i = best.endToken;
    }
  }
  return found;
}

// Todas as expressões da fala, sem sobreposição (phrasal vence gíria no mesmo
// trecho: "freak out" é verbo antes de ser gíria).
export function detectExpressions(text, { maxWords = MAX_EXPRESSION_WORDS } = {}) {
  const source = String(text || '');
  const candidates = [
    ...findPhrasalVerbs(source, maxWords),
    ...findSlangs(source).map((s) => ({ type: 'slang', canonical: s.term, index: s.index, length: s.length })),
  ].sort((a, b) => a.index - b.index || b.length - a.length || (a.type === 'phrasal' ? -1 : 1));

  const result = [];
  let coveredUntil = -1;
  for (const item of candidates) {
    if (item.index < coveredUntil) continue;
    result.push({ ...item, text: source.slice(item.index, item.index + item.length) });
    coveredUntil = item.index + item.length;
  }
  return result;
}
