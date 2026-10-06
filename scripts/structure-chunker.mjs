// Propõe os grupos sintáticos (Sujeito, Verbo, Predicado, Objeto, Adjunto, Expressão)
// de frases de curso a partir da classe gramatical de cada palavra (LEXICON).
// É um rascunho por regras: toda saída passa por revisão antes de virar migration.
// Uso: node scripts/structure-chunker.mjs <lote|v1> [--sample N]

import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LEXICON as BASE_LEXICON } from '../supabase/content/lexicon.mjs';

const DISCOURSE = new Set(['please', 'well', 'hey', 'hi', 'hello', 'sorry', 'yes', 'no', 'oh', 'okay', 'ok', 'thanks', 'sure', 'wow', 'actually', 'excuse', 'thank', 'welcome', 'bye', 'goodbye', 'maybe', 'anyway']);
const COORD = new Set(['and', 'but', 'so', 'or']);
const SUBORD = new Set(['because', 'when', 'if', 'while', 'although', 'since', 'before', 'after', 'until', 'unless', 'as']);
const COPULA = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "i'm", "he's", "she's", "it's", "that's", "there's", "you're", "we're", "they're", 'seem', 'seems', 'look', 'looks', 'feel', 'feels', 'become', 'became', 'sound', 'sounds', 'taste', 'tastes', 'smell', 'smells']);
const FREQ = new Set(['always', 'never', 'usually', 'often', 'sometimes', 'already', 'just', 'still', 'also', 'really', 'not', "n't", 'ever', 'only']);
const NP_POS = new Set(['noun', 'proper noun', 'pronoun', 'determiner', 'adjective', 'numeral']);

const clean = (t) => t.replace(/^[^A-Za-z']+|[^A-Za-z'-]+$/g, '').toLowerCase();

function posOf(token, lexicon) {
  const w = clean(token);
  const e = lexicon[w];
  return { w, pos: e ? e[0] : '' };
}

const isVerb = ({ pos, w }) => pos === 'verb' || pos === 'auxiliary verb' || /n't$/.test(w) && pos !== 'noun';
const isNp = ({ pos }) => NP_POS.has(pos);
const isPrep = ({ pos }) => pos === 'preposition';

// Quebra o texto em frases mantendo a pontuação junto da palavra.
function sentences(text) {
  return text.match(/[^.!?]+[.!?]*["”']?\s*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
}

function chunkSentence(sentence, lexicon) {
  const toks = sentence.split(/\s+/).map((raw) => ({ raw, ...posOf(raw, lexicon) }));
  const groups = [];
  const push = (from, to, role) => {
    if (to <= from) return;
    groups.push([toks.slice(from, to).map((t) => t.raw).join(' '), role]);
  };
  let i = 0;
  const question = /\?["”']?$/.test(sentence);

  // Expressão inicial (please, well, sorry…) e conjunção coordenada no início.
  while (i < toks.length - 1 && (DISCOURSE.has(toks[i].w) || (COORD.has(toks[i].w) && i === 0))) {
    let j = i + 1;
    if (toks[i].w === 'thank' && toks[j]?.w === 'you') j++;
    if (toks[i].w === 'excuse' && toks[j]?.w === 'me') j++;
    push(i, j, 'discourse_marker');
    i = j;
  }
  // Trecho antes da primeira vírgula sem verbo: adjunto ("Yesterday, …", "In the morning, …").
  const comma = toks.findIndex((t, k) => k >= i && /,$/.test(t.raw));
  if (comma > i && !toks.slice(i, comma + 1).some(isVerb)) {
    push(i, comma + 1, 'adverbial');
    i = comma + 1;
  }
  const rest = toks.slice(i);
  if (!rest.length) return groups;

  // Oração subordinada inteira como adjunto; o resto é analisado normalmente.
  const sub = rest.findIndex((t, k) => k > 0 && SUBORD.has(t.w) && !/,$/.test(rest[k - 1].raw) === true || (k > 0 && SUBORD.has(t.w)));
  const mainEnd = sub > 0 ? i + sub : toks.length;
  const subClause = sub > 0;

  let k = i;
  const end = mainEnd;
  // Verbo auxiliar de pergunta antes do sujeito (Can you…? Is there…? Do you…?).
  if (question && isVerb(toks[k]) && k + 1 < end) {
    let e = k + 1;
    if (toks[e]?.w === 'there') e++;
    push(k, e, 'predicate_verb');
    k = e;
  }
  // Sujeito: até o primeiro verbo.
  const firstVerb = toks.findIndex((t, idx) => idx >= k && idx < end && isVerb(t));
  if (firstVerb > k) {
    let sEnd = firstVerb;
    while (sEnd > k && FREQ.has(toks[sEnd - 1].w)) sEnd--;
    push(k, sEnd, 'subject');
    k = sEnd;
  }
  // Grupo verbal: auxiliares, verbos, "not", advérbios de frequência e "to" infinitivo.
  let vEnd = k;
  while (vEnd < end && (isVerb(toks[vEnd]) || FREQ.has(toks[vEnd].w) || (toks[vEnd].w === 'to' && isVerb(toks[vEnd + 1] || {})))) vEnd++;
  // Partícula do phrasal (get up, turn off).
  if (vEnd > k && vEnd < end && (toks[vEnd].pos === 'adverb' || isPrep(toks[vEnd])) && !isNp(toks[vEnd + 1] || {}) === false && ['up', 'down', 'off', 'on', 'out', 'in', 'away', 'back'].includes(toks[vEnd].w) && isNp(toks[vEnd + 1] || {})) vEnd++;
  else if (vEnd > k && vEnd === end - 1 && ['up', 'down', 'off', 'on', 'out', 'away', 'back'].includes(toks[vEnd].w)) vEnd++;
  push(k, vEnd, 'predicate_verb');
  const lastVerb = toks.slice(k, vEnd).reverse().find(isVerb);
  const copula = lastVerb && COPULA.has(lastVerb.w);
  k = vEnd;

  // Complementos.
  let first = true;
  while (k < end) {
    const t = toks[k];
    if (isPrep(t) || (t.pos === 'adverb' && !isNp(t))) {
      let e = k + 1;
      if (isPrep(t)) while (e < end && isNp(toks[e])) e++;
      else while (e < end && toks[e].pos === 'adverb') e++;
      if (t.w === 'to' && isVerb(toks[k + 1] || {})) { // infinitivo como objeto: to buy milk
        e = end;
        push(k, e, 'direct_object');
      } else push(k, e, 'adverbial');
      k = e;
    } else if (isNp(t) || isVerb(t)) {
      let e = k + 1;
      while (e < end && (isNp(toks[e]) || (COORD.has(toks[e].w) && isNp(toks[e + 1] || {})))) e++;
      push(k, e, copula && first ? 'predicate_adj' : 'direct_object');
      k = e;
    } else {
      push(k, k + 1, 'adverbial');
      k++;
    }
    first = false;
  }
  if (subClause) push(mainEnd, toks.length, 'adverbial');
  return groups;
}

export function proposeGroups(text, lexicon = BASE_LEXICON) {
  const all = [];
  for (const s of sentences(text)) all.push(...chunkSentence(s, lexicon));
  return all;
}

export function groupsToOffsets(text, groups) {
  let cursor = 0;
  return groups.map(([surface, role]) => {
    const start = text.indexOf(surface, cursor);
    if (start < 0) throw new Error(`grupo "${surface}" fora de "${text}"`);
    cursor = start + surface.length;
    return { start, end: cursor, role, surface };
  });
}

const BATCH_DIR = new URL('../supabase/content/batches/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

export async function loadAllUnits() {
  const lexicon = { ...BASE_LEXICON };
  const files = readdirSync(BATCH_DIR).filter((f) => f.endsWith('.mjs')).sort();
  const mods = [{ name: 'v1', mod: await import('../supabase/content/courses.mjs') }];
  for (const f of files) mods.push({ name: f.replace('.mjs', ''), mod: await import(pathToFileURL(`${BATCH_DIR}${f}`).href) });
  for (const { mod } of mods) Object.assign(lexicon, mod.LEXICON || {});
  const units = [];
  for (const { name, mod } of mods) {
    for (const course of mod.COURSES || []) {
      for (const lesson of course.lessons) {
        lesson.units.forEach((raw, i) => {
          const u = Array.isArray(raw) ? { kind: 'sentence', text: raw[0], groups: raw[3] } : { kind: raw.kind || 'sentence', text: raw.text, groups: raw.groups };
          const id = `${lesson.id.replace('lesson-', 'unit-')}-${String(i + 1).padStart(2, '0')}`;
          units.push({ id, batch: name, course: course.id, kind: u.kind, text: u.text, hasGroups: Boolean(u.groups?.length) });
        });
      }
    }
  }
  return { units, lexicon };
}

if (process.argv[1]?.endsWith('structure-chunker.mjs')) {
  const [filter = '', , n = '25'] = process.argv.slice(2);
  const { units, lexicon } = await loadAllUnits();
  const todo = units.filter((u) => !u.hasGroups && ['sentence', 'phrasal', 'story', 'paragraph'].includes(u.kind) && (!filter || u.batch === filter || u.course === filter));
  console.log(`${todo.length} unidades sem estrutura`);
  for (const u of todo.slice(0, Number(n))) {
    console.log(u.text, '\n   ', proposeGroups(u.text, lexicon).map(([s, r]) => `[${r[0].toUpperCase()}${r === 'predicate_adj' ? 'P' : ''} ${s}]`).join(' '));
  }
}
