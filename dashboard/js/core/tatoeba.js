// tatoeba.js — Onda 3.5 (Prof. didático): frases de exemplo REAIS (escritas
// por falantes, não geradas por IA) como fonte extra de contexto. API
// pública do Tatoeba, sem chave. Falha graciosa: qualquer erro de rede ou
// formato inesperado só esvazia a lista, nunca quebra a tela.

const TATOEBA_API = 'https://tatoeba.org/eng/api_v0/search';

export async function fetchTatoebaSentences(word, { limit = 4 } = {}) {
  const w = (word || '').trim();
  if (!w) return [];
  const url = `${TATOEBA_API}?from=eng&to=por&query=${encodeURIComponent(w)}&orphans=no&unapproved=no`;
  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  const out = [];
  for (const r of results) {
    if (!r || typeof r.text !== 'string') continue;
    const translations = Array.isArray(r.translations) ? r.translations.flat() : [];
    const pt = translations.find(t => t && typeof t.text === 'string' && (t.lang === 'por' || t.lang === 'pt'));
    out.push({ text: r.text, translation: pt?.text || null });
    if (out.length >= limit) break;
  }
  return out;
}
