// utils/lemma.js — lematizador leve de regras para inglês.
// Objetivo: agrupar run/runs/running/ran como UMA família de palavra na
// contagem estilo LingQ. Zero dependências (sem bundler no projeto);
// cobre os sufixos regulares + irregulares mais frequentes. Se um dia
// precisarmos de precisão maior, trocar por 'compromise' — a interface
// (lemma(word) -> string) foi pensada pra isso.

const IRREGULAR = {
  // verbos irregulares mais comuns (passado/particípio -> base)
  was: 'be', were: 'be', been: 'be', am: 'be', is: 'be', are: 'be',
  had: 'have', has: 'have', having: 'have',
  did: 'do', does: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', goes: 'go', going: 'go',
  said: 'say', says: 'say',
  made: 'make', got: 'get', gotten: 'get', took: 'take', taken: 'take',
  came: 'come', saw: 'see', seen: 'see', knew: 'know', known: 'know',
  thought: 'think', found: 'find', gave: 'give', given: 'give',
  told: 'tell', felt: 'feel', left: 'leave', kept: 'keep', met: 'meet',
  ran: 'run', paid: 'pay', sat: 'sit', stood: 'stand', lost: 'lose',
  brought: 'bring', bought: 'buy', caught: 'catch', taught: 'teach',
  spoke: 'speak', spoken: 'speak', wrote: 'write', written: 'write',
  ate: 'eat', eaten: 'eat', drank: 'drink', drunk: 'drink',
  drove: 'drive', driven: 'drive', broke: 'break', broken: 'break',
  chose: 'choose', chosen: 'choose', fell: 'fall', fallen: 'fall',
  flew: 'fly', flown: 'fly', grew: 'grow', grown: 'grow',
  heard: 'hear', held: 'hold', read: 'read', sang: 'sing', sung: 'sing',
  slept: 'sleep', spent: 'spend', swam: 'swim', threw: 'throw', thrown: 'throw',
  understood: 'understand', woke: 'wake', woken: 'wake', wore: 'wear', worn: 'wear', won: 'win',
  // plurais irregulares
  men: 'man', women: 'woman', children: 'child', people: 'person',
  feet: 'foot', teeth: 'tooth', mice: 'mouse', lives: 'life',
  // comparativos frequentes
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

// palavras curtas/exceções que os cortes de sufixo estragariam
const NO_STRIP = new Set(['this', 'his', 'has', 'was', 'is', 'us', 'yes', 'gas', 'bus',
  'ring', 'king', 'thing', 'song', 'sing', 'bring', 'spring', 'during', 'morning', 'evening',
  'red', 'bed', 'need', 'feed', 'speed', 'indeed', 'ted',
  'her', 'per', 'under', 'over', 'after', 'never', 'ever', 'other', 'water', 'together']);

function stripSuffix(w) {
  if (NO_STRIP.has(w) || w.length <= 3) return w;

  // -ies -> y (studies -> study)
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  // -ied -> y (studied -> study)
  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y';
  // -sses/-shes/-ches/-xes -> corta -es (watches -> watch)
  if (/(sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2);
  // -ing: dupla consoante (running -> run), -e restaurado (making -> make) heurística
  if (w.endsWith('ing') && w.length > 5) {
    const base = w.slice(0, -3);
    if (/([bcdfghjklmnpqrstvwz])\1$/.test(base)) return base.slice(0, -1); // running -> run
    if (/[bcdfghjklmnpqrstvz]$/.test(base) && /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/.test(base)) return base + 'e'; // making -> make
    return base;
  }
  // -ed: mesmo tratamento (stopped -> stop, loved -> love)
  if (w.endsWith('ed') && w.length > 4) {
    const base = w.slice(0, -2);
    if (/([bcdfghjklmnpqrstvwz])\1$/.test(base)) return base.slice(0, -1);
    if (base.endsWith('i')) return base.slice(0, -1) + 'y'; // tried já coberto por -ied
    if (/[bcdfghjklmnpqrstvz]$/.test(base) && /[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/.test(base)) return base + 'e'; // loved -> love
    return base;
  }
  // plural simples -s (mas não -ss: class)
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    return w.slice(0, -1);
  }
  return w;
}

export function lemma(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!w) return '';
  if (IRREGULAR[w]) return IRREGULAR[w];
  return stripSuffix(w);
}

// Conta famílias de palavras únicas em uma lista de palavras
export function countFamilies(words) {
  const set = new Set();
  for (const w of words) {
    const l = lemma(w);
    if (l) set.add(l);
  }
  return set.size;
}
