// utils/expression-detector.js
// Detecção única de expressões na fala (legenda, roteiro, aba Palavras e
// popup), com posições no texto. Tipos:
// - phrasal: phrasal verb idiomático, inclusive separado ("turn the lights off");
// - slang: gíria (as ambíguas só na construção de gíria);
// - reduction: redução já escrita ("gonna", "'cause", "y'know");
// - contraction: "'d" com o sentido resolvido pela palavra seguinte (had/would);
// - sounds_like: forma cheia que a legenda automática escreve mas a fala reduz
//   ("going to" + verbo soa como "gonna");
// - marker: marcador de conversa ("you know", "I mean", "like" de citação).
//
// Verbo + preposição transparente ("look at", "add to", "act as", "need to")
// não é destacado: sublinhar quase toda fala tirava o sentido do destaque.
import { expressionsDB, matchExpressionCandidate, MAX_EXPRESSION_WORDS } from './expressions-db.js';
import { findSlangs } from './slangs-db.js';
import { findReductions, findSoundsLike } from './speech-cadence.js';

export const PARTICLES = new Set([
  'up', 'out', 'off', 'down', 'away', 'back', 'over', 'around', 'round', 'through', 'along',
  'apart', 'aside', 'ahead', 'forward', 'forth', 'together', 'on', 'in', 'by', 'behind',
]);

// Partículas que podem vir depois do objeto ("pick the kids up"). "on"/"in"
// ficam de fora: "put the book on the table" não é "put on".
const SEPARABLE_PARTICLES = new Set(['up', 'out', 'off', 'down', 'away', 'back', 'over']);
const DETERMINERS = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'some', 'all']);
const MAX_OBJECT_WORDS = 3;

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

function phrasalCanonical(words) {
  const match = matchExpressionCandidate(words);
  const candidate = words.join(' ');
  const canonical = match?.canonical || (expressionsDB.has(candidate) ? candidate : null);
  return canonical && expressionKind(canonical) === 'phrasal' ? canonical : null;
}

// Verbo + objeto com determinante (até 3 palavras) + partícula: "turn the lights off".
function separatedPhrasal(tokens, i) {
  if (!tokens[i + 1] || !DETERMINERS.has(tokens[i + 1].word) || tokens[i + 1].breakBefore) return null;
  for (let k = i + 2; k <= i + 1 + MAX_OBJECT_WORDS && k < tokens.length; k++) {
    if (tokens[k].breakBefore) return null;
    if (!SEPARABLE_PARTICLES.has(tokens[k].word)) continue;
    const canonical = phrasalCanonical([tokens[i].word, tokens[k].word]);
    return canonical ? { canonical, endToken: k } : null;
  }
  return null;
}

// Phrasal verbs idiomáticos: o maior bloco conhecido a partir de cada palavra,
// sem atravessar fim de frase.
export function findPhrasalVerbs(text, maxWords = MAX_EXPRESSION_WORDS) {
  const tokens = wordTokens(text);
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    // Depois de determinante a palavra é substantivo: "the book on the table".
    if (i > 0 && !tokens[i].breakBefore && DETERMINERS.has(tokens[i - 1].word)) continue;
    let best = null;
    const words = [tokens[i].word];
    for (let j = i + 1; j < tokens.length && words.length < maxWords; j++) {
      if (tokens[j].breakBefore) break;
      words.push(tokens[j].word);
      const canonical = phrasalCanonical(words);
      if (canonical) best = { canonical, endToken: j };
    }
    if (!best) best = separatedPhrasal(tokens, i);
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

const IRREGULAR_PARTICIPLES = new Set([
  'been', 'gone', 'done', 'seen', 'had', 'got', 'gotten', 'known', 'taken', 'given', 'made', 'said',
  'told', 'thought', 'found', 'left', 'felt', 'heard', 'kept', 'brought', 'bought', 'written',
  'eaten', 'forgotten', 'begun', 'broken', 'chosen', 'driven', 'fallen', 'spoken', 'stolen',
  'woken', 'worn', 'won', 'lost', 'met', 'paid', 'sent', 'spent', 'built', 'caught', 'taught',
  'run', 'come', 'become', 'drunk', 'sung', 'swum', 'understood', 'stood', 'slept', 'read',
]);
const WOULD_NEXT = new Set(['rather', 'like', 'love', 'prefer', 'be', 'have', 'go', 'do', 'say', 'need', 'want', 'think', 'know', 'get', 'make', 'take', 'come', 'see']);
const D_ADVERBS = new Set(['never', 'already', 'just', 'ever', 'always', 'really', 'probably', 'not', 'definitely', 'still', 'also', 'only']);

// Verbos na forma base que terminam em -ed ("I'd need" = would).
const ED_BASE = new Set(['need', 'feed', 'bleed', 'proceed', 'succeed', 'exceed', 'speed', 'seed', 'heed', 'breed', 'shed', 'wed', 'embed']);
const isParticiple = (word) => IRREGULAR_PARTICIPLES.has(word) || (word.endsWith('ed') && !ED_BASE.has(word));

// "I'd": particípio depois → had; verbo base / better / rather → would.
export function findContractions(text) {
  const source = String(text || '').replace(/[‘’]/g, "'");
  const found = [];
  const pattern = /\b(i|you|he|she|we|they|it|that|there|who)'d\b(?:\s+([a-z]+))?(?:\s+([a-z]+))?/gi;
  for (const match of source.matchAll(pattern)) {
    let next = (match[2] || '').toLowerCase();
    if (D_ADVERBS.has(next)) next = (match[3] || '').toLowerCase();
    if (!next) continue;
    let sense = null;
    if (next === 'better') sense = 'had';
    else if (WOULD_NEXT.has(next)) sense = 'would';
    else if (isParticiple(next)) sense = 'had';
    else sense = 'would';
    const token = `${match[1]}'d`;
    found.push({
      type: 'contraction',
      canonical: `'d = ${sense}`,
      meaning: `${token} = ${match[1]} ${sense}`,
      index: match.index,
      length: token.length,
    });
  }
  return found;
}

const MARKER_RULES = [
  { canonical: 'you know', meaning: 'tipo, sabe? (preenche a fala)', pattern: /(?:^|[,.!?]\s*)(you know)(?=\s*[,.!?]|$)/gi },
  { canonical: 'I mean', meaning: 'quer dizer (reformula)', pattern: /(?:^|[,.!?]\s*)(i mean)(?=[\s,])/gi },
  { canonical: 'I guess', meaning: 'acho que (suaviza)', pattern: /(?:^|[,.!?]\s*)(i guess)\b/gi },
  { canonical: 'like', meaning: '"tipo" (preenchimento)', pattern: /,\s*(like)\s*,/gi },
  { canonical: 'be like', meaning: 'introduz fala ou reação ("ele ficou tipo…")', pattern: /\b(?:was|were|is|am|i'm|he's|she's|they're|we're|i was|she was|he was)\s+(like)(?=\s*[,:"“]|\s+(?:oh|wow|what|no|yeah|dude|okay|seriously)\b)/gi },
];

export function findDiscourseMarkers(text) {
  const source = String(text || '').replace(/[‘’]/g, "'");
  const found = [];
  for (const rule of MARKER_RULES) {
    for (const match of source.matchAll(new RegExp(rule.pattern.source, 'gi'))) {
      const offset = match[0].toLowerCase().lastIndexOf(match[1].toLowerCase());
      found.push({ type: 'marker', canonical: rule.canonical, meaning: rule.meaning, index: match.index + offset, length: match[1].length });
    }
  }
  return found;
}

const TYPE_PRIORITY = { phrasal: 0, slang: 1, reduction: 2, contraction: 3, sounds_like: 4, marker: 5 };

// Todas as expressões da fala, sem sobreposição: no mesmo trecho vence o bloco
// maior e, no empate, o tipo mais específico (phrasal > gíria > redução…).
export function detectExpressions(text, { maxWords = MAX_EXPRESSION_WORDS } = {}) {
  const source = String(text || '');
  const candidates = [
    ...findPhrasalVerbs(source, maxWords),
    ...findSlangs(source).map((s) => ({ type: 'slang', canonical: s.term, index: s.index, length: s.length })),
    ...findReductions(source).map((r) => ({ type: 'reduction', canonical: r.term, meaning: r.full, index: r.index, length: r.length })),
    ...findContractions(source),
    ...findSoundsLike(source).map((s) => ({ type: 'sounds_like', canonical: s.sound, hint: s.sound, meaning: `soa como "${s.sound}"`, index: s.index, length: s.length })),
    ...findDiscourseMarkers(source),
  ].sort((a, b) => a.index - b.index || b.length - a.length || TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);

  const result = [];
  let coveredUntil = -1;
  for (const item of candidates) {
    if (item.index < coveredUntil) continue;
    result.push({ ...item, text: source.slice(item.index, item.index + item.length) });
    coveredUntil = item.index + item.length;
  }
  return result;
}
