// utils/word-senses.js — Traduções de uma palavra agrupadas por classe
// gramatical (verbo, substantivo…), a partir do dicionário que o Google
// devolve junto com a tradução (dt=bd). Mesma fonte do tradutor: sem custo
// novo; se a lista não vier, o card segue só com a tradução principal.

const POS_PT = {
  noun: 'substantivo',
  verb: 'verbo',
  adjective: 'adjetivo',
  adverb: 'advérbio',
  pronoun: 'pronome',
  preposition: 'preposição',
  conjunction: 'conjunção',
  interjection: 'interjeição',
  article: 'artigo',
  abbreviation: 'abreviação',
  prefix: 'prefixo',
  suffix: 'sufixo',
  phrase: 'expressão',
  particle: 'partícula',
  'auxiliary verb': 'verbo auxiliar',
};

export function posLabelPt(pos) {
  return POS_PT[String(pos || '').toLowerCase()] || String(pos || '');
}

// Palavra ou expressão curta; frases inteiras não têm entrada de dicionário.
export function isSensesLookupTerm(term) {
  const text = String(term || '').trim();
  return text.length > 0 && text.length <= 40 && text.split(/\s+/).length <= 3;
}

// data[1] = [[classe, [termos…], [detalhes], formaBase, n], …], na ordem de
// uso do Google (a classe mais comum primeiro).
export function parseGoogleDictionary(data, { maxPos = 3, maxTerms = 5 } = {}) {
  const entries = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
  const senses = [];
  for (const entry of entries) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
    const terms = [...new Set(entry[1].filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()))].slice(0, maxTerms);
    if (!terms.length) continue;
    senses.push({
      pos: entry[0],
      label: posLabelPt(entry[0]),
      base: typeof entry[3] === 'string' ? entry[3] : '',
      terms,
    });
    if (senses.length >= maxPos) break;
  }
  return senses;
}

const MAX_CACHE = 300;
const cache = new Map();

export async function fetchWordSenses(term, from = 'en', to = 'pt', { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const word = String(term || '').trim().toLowerCase();
  if (!isSensesLookupTerm(word)) return [];
  const key = `${from}:${to}:${word}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=bd&q=${encodeURIComponent(word)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return [];
    const raw = await response.text();
    if (!raw || raw.startsWith('<')) return [];
    const senses = parseGoogleDictionary(JSON.parse(raw));
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, senses);
    return senses;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
