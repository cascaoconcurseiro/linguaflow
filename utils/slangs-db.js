// utils/slangs-db.js — Base de gírias e formas coloquiais, com regras que dependem do contexto da frase.
import { REDUCTIONS } from './speech-cadence.js';
// Gírias, contrações informais e expressões coloquiais em inglês.
//
// Dois níveis (Issue #345):
// - SLANG_ALWAYS: é gíria em qualquer frase ("dude", "no cap", "my bad").
// - SLANG_CONTEXT_RULES: palavra comum que só é gíria em certas construções
//   ("tea" em "here's the tea", não em "I drink tea"). Cada regra tem a forma
//   canônica, as formas flexionadas e o padrão que precisa casar na frase.

// Reduções escritas (gonna, wanna, 'cause…) vivem em speech-cadence.js e são
// classificadas como fala reduzida pelo detector, não como gíria.
export const SLANG_ALWAYS = new Set([
  'sup',

  // Gírias modernas e coloquiais
  'dude', 'bro', 'bruh', 'homie', 'bestie', 'fam', 'folks', 'vibe', 'vibes', 'vibing',
  'legit', 'sketchy', 'lowkey', 'highkey', 'fomo', 'tldr', 'fyi', 'omg', 'lol', 'lmao',
  'slay', 'slayed', 'slaying', 'ghosting', 'stan', 'stanning', 'stanned', 'stans',
  'bussin', 'cringe', 'cringey', 'no cap', 'capping', 'simp', 'simping', 'simped', 'simps',
  'periodt', 'sus', 'clout', 'yeet', 'boujee', 'deadass', 'dead ass', 'fr',

  // Expressões informais do dia a dia
  'rip off', 'rip-off', 'ripped off', 'ripping off', 'chill out', 'chilled out',
  'hang out', 'hanging out', 'hung out', 'hangs out',
  'bummer', 'throw shade', 'throwing shade', 'threw shade', 'thrown shade',
  'dead tired', 'hyped', 'zoned out', 'zoning out', 'heads up', 'my bad', 'no worries', 'no biggie',
  'big deal', 'for real', 'peace out', 'shady',
  'screw up', 'screwed up', 'screwing up', 'screws up',
  'mess up', 'messed up', 'messing up', 'messes up',
  'piece of cake', 'spill the tea', 'spilling the tea', 'spilled the tea', 'spilt the tea', 'spills the tea',
  'catch feelings', 'caught feelings', 'catching feelings',
  'on point', 'on fleek', 'glow up', 'glowing up', 'glowed up',
  'freak out', 'freaked out', 'freaking out',
]);

const COPULA = "(?:that's|that is|that was|it's|it is|it was|this is|this was|so|pretty|really|totally|straight|pure)";

export const SLANG_CONTEXT_RULES = [
  { term: 'tea', forms: ['tea'], pattern: /\b(?:here's|here is|what's|what is|what's the|so what's)\s+the\s+tea\b/ },
  { term: 'fire', forms: ['fire'], pattern: new RegExp(`\\b(?:${COPULA.slice(3, -1)}|was|is)\\s+fire\\b`) },
  { term: 'lit', forms: ['lit'], pattern: new RegExp(`\\b(?:${COPULA.slice(3, -1)}|gonna be|getting)\\s+lit\\b(?!\\s+(?:by|up|with|the|a)\\b)`) },
  { term: 'sick', forms: ['sick'], pattern: /\b(?:that's|that is|that was|looks|sounds|looking|how)\s+sick\b(?!\s+of\b)/ },
  { term: 'dope', forms: ['dope'], pattern: new RegExp(`\\b${COPULA}\\s+dope\\b`) },
  { term: 'extra', forms: ['extra'], pattern: /\b(?:so|too|being|super|really)\s+extra\b(?!\s+[a-z]+)/ },
  { term: 'basic', forms: ['basic'], pattern: /\b(?:so|super|too|such a)\s+basic\b/ },
  { term: 'mood', forms: ['mood'], pattern: /\b(?:big|total|such a|that's a|that's such a|what a)\s+mood\b/ },
  { term: 'bet', forms: ['bet'], pattern: /(?:^|[.!?]\s*)bet(?=[.!,]|$)/ },
  { term: 'beat', forms: ['beat'], pattern: /\b(?:i'm|i am|i was|so|totally|dead)\s+beat\b(?!\s+(?:the|it|him|her|them|you|me|us)\b)/ },
  { term: 'sweet', forms: ['sweet'], pattern: /(?:^|[.!?]\s*)(?:oh\s+)?sweet(?=[.!,]|$)/ },
  { term: 'loaded', forms: ['loaded'], pattern: /\b(?:he's|she's|they're|you're|we're|i'm)\s+loaded\b(?!\s+(?:with|into|onto)\b)/ },
  { term: 'crash', forms: ['crash', 'crashed', 'crashing'], pattern: /\bcrash(?:ed|ing)?\s+(?:at|on)\s+(?:my|your|his|her|their|our)\b/ },
  { term: 'suck', forms: ['suck', 'sucks', 'sucked'], pattern: /\b(?:that|it|this|life|which|you|he|she|they)\s+(?:really\s+|kinda\s+|totally\s+|just\s+)?suck(?:s|ed)?\b|\bsuck(?:s|ed)?\s+at\b/ },
  { term: 'bail', forms: ['bail', 'bailed', 'bailing'], pattern: /\bbail(?:ed|ing)?\s+on\b/ },
  { term: 'have a blast', forms: ['have a blast', 'had a blast', 'having a blast', 'has a blast'], pattern: /\b(?:have|had|having|has)\s+a\s+blast\b/ },
  { term: 'nuts', forms: ['nuts'], pattern: /\b(?:go|goes|went|going|drive|drives|drove|driving)\s+(?:[a-z]+\s+)?nuts\b|\b(?:that's|this is|you're|are you|it's)\s+nuts\b/ },
  { term: 'props', forms: ['props'], pattern: /\bprops\s+to\b/ },
  { term: 'rad', forms: ['rad'], pattern: new RegExp(`\\b${COPULA}\\s+rad\\b`) },
  { term: 'wicked', forms: ['wicked'], pattern: /\bwicked\s+(?:good|cool|smart|fast|awesome|hard)\b/ },
  { term: 'savage', forms: ['savage'], pattern: /\b(?:that's|that was|so|absolutely|pure|straight)\s+savage\b/ },
  { term: 'shook', forms: ['shook'], pattern: /\b(?:i'm|i am|i was|was|so|still)\s+shook\b/ },
  { term: 'woke', forms: ['woke'], pattern: /\b(?:so|too|very|being|stay|staying)\s+woke\b/ },
  { term: 'chill', forms: ['chill', 'chilling', 'chilled'], pattern: /\b(?:just|so|pretty|be|stay|very|super|we're|i'm|it's|he's|she's|really)\s+chill(?:ing|ed)?\b|\bchill(?:ing|ed)?\s+(?:with|at)\b/ },
  { term: 'goat', forms: ['goat'], pattern: /\b(?:is|was|literally|he's|she's|you're|the real)\s+(?:the\s+)?goat\b/ },
  { term: 'salty', forms: ['salty'], pattern: /\bsalty\s+(?:about|because|that)\b|\b(?:getting|being|still)\s+salty\b/ },
  { term: 'cap', forms: ['cap', 'capped'], pattern: /\b(?:that's|that is|stop|quit|sounds like)\s+cap\b/ },
  { term: 'flex', forms: ['flex', 'flexing', 'flexed'], pattern: /\b(?:weird|big|major|such a)\s+flex\b|\bflex(?:ing|ed)?\s+(?:on|about)\b|\bflexing\b/ },
  { term: 'ghost', forms: ['ghost', 'ghosted', 'ghosts'], pattern: /\bghost(?:ed|s)?\s+(?:me|him|her|them|you|us|people|someone)\b|\bgot\s+ghosted\b/ },
  { term: 'flaky', forms: ['flaky', 'flake'], pattern: /\b(?:so|super|really|kinda|a total|such a)\s+(?:flaky|flake)\b/ },
];

const RULE_BY_FORM = new Map();
for (const rule of SLANG_CONTEXT_RULES) {
  for (const form of rule.forms) RULE_BY_FORM.set(form, rule);
}

// Compatibilidade: todos os termos reconhecíveis (lookup sem contexto).
export const slangsDB = new Set([...SLANG_ALWAYS, ...RULE_BY_FORM.keys(), ...Object.keys(REDUCTIONS)]);

export function isContextDependentSlang(term) {
  return RULE_BY_FORM.has(String(term || '').toLowerCase().trim());
}

// Com frase, uma gíria ambígua só vale se a construção de gíria aparece nela.
// Sem frase, mantém o comportamento de lookup (benefício da dúvida).
export function slangMatchesContext(term, sentence) {
  const key = String(term || '').toLowerCase().trim();
  if (SLANG_ALWAYS.has(key)) return true;
  const rule = RULE_BY_FORM.get(key);
  if (!rule) return false;
  if (!sentence) return true;
  return new RegExp(rule.pattern.source, 'i').test(normalizeSentence(sentence));
}

function normalizeSentence(text) {
  return String(text || '').toLowerCase().replace(/[‘’]/g, "'").trim();
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const ALWAYS_PATTERN = new RegExp(
  `(?<![\\p{L}'-])(?:${[...SLANG_ALWAYS].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?![\\p{L}'-])`,
  'giu',
);

// Gírias presentes na frase: [{ term, index, length }] com posições no texto
// original (mesmo comprimento do normalizado).
export function findSlangs(text) {
  const source = normalizeSentence(text);
  const found = [];
  for (const match of source.matchAll(ALWAYS_PATTERN)) {
    found.push({ term: canonicalAlways(match[0]), index: match.index, length: match[0].length });
  }
  for (const rule of SLANG_CONTEXT_RULES) {
    const global = new RegExp(rule.pattern.source, 'g');
    for (const match of source.matchAll(global)) {
      const formPattern = new RegExp(`\\b(?:${rule.forms.map(escapeRegExp).join('|')})\\b`);
      const inner = formPattern.exec(match[0]);
      if (!inner) continue;
      found.push({ term: rule.term, index: match.index + inner.index, length: inner[0].length });
    }
  }
  return found.sort((a, b) => a.index - b.index || b.length - a.length);
}

const ALWAYS_CANONICAL = new Map([
  ['spilling the tea', 'spill the tea'], ['spilled the tea', 'spill the tea'], ['spilt the tea', 'spill the tea'], ['spills the tea', 'spill the tea'],
  ['throwing shade', 'throw shade'], ['threw shade', 'throw shade'], ['thrown shade', 'throw shade'],
  ['hanging out', 'hang out'], ['hung out', 'hang out'], ['hangs out', 'hang out'],
  ['ripped off', 'rip off'], ['ripping off', 'rip off'], ['rip-off', 'rip off'], ['chilled out', 'chill out'],
  ['screwed up', 'screw up'], ['screwing up', 'screw up'], ['screws up', 'screw up'],
  ['messed up', 'mess up'], ['messing up', 'mess up'], ['messes up', 'mess up'],
  ['caught feelings', 'catch feelings'], ['catching feelings', 'catch feelings'],
  ['glowing up', 'glow up'], ['glowed up', 'glow up'], ['freaked out', 'freak out'], ['freaking out', 'freak out'],
  ['zoning out', 'zoned out'], ['slayed', 'slay'], ['slaying', 'slay'], ['stanning', 'stan'], ['stanned', 'stan'], ['stans', 'stan'],
  ['simping', 'simp'], ['simped', 'simp'], ['simps', 'simp'], ['vibes', 'vibe'], ['vibing', 'vibe'], ['cringey', 'cringe'],
]);

function canonicalAlways(matched) {
  const key = matched.toLowerCase().replace(/\s+/g, ' ');
  return ALWAYS_CANONICAL.get(key) || key;
}
