// background/dictionary.js — Dicionário do service worker: busca a definição, a pronúncia e os exemplos de uma palavra em fontes abertas.

import { isValidIpa, cleanIpa } from '../utils/ipa-validator.js';
import { stripHtmlTags } from '../utils/html.js';

export async function fetchDictionary(word) {
  const cleanWord = String(word || '')
    .toLowerCase()
    .replace(/[.,!?;:()""'']+/g, '')
    .trim();
  const emptyResult = {
    word: word,
    phonetic: '',
    audioUrl: '',
    partOfSpeech: '',
    definition: '',
    example: '',
    synonyms: [],
    antonyms: [],
  };
  if (!cleanWord) return emptyResult;

  const isMultiWord = cleanWord.includes(' ');

  const fetchWithTimeout = async (url, ms = 2000) => {
    const hasAbort = typeof AbortController !== 'undefined';
    const hasTimeout = typeof setTimeout !== 'undefined';
    const c = hasAbort ? new AbortController() : null;
    const tid = c && hasTimeout ? setTimeout(() => c.abort(), ms) : null;
    try {
      const options = c ? { signal: c.signal } : {};
      return await fetch(url, options);
    } finally {
      if (tid && typeof clearTimeout !== 'undefined') clearTimeout(tid);
    }
  };

  // Tier 1: Free Dictionary API (api.dictionaryapi.dev) — apenas palavras simples
  if (!isMultiWord) try {
    const res = await fetchWithTimeout(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      2000,
    );
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const entry = data[0];
        let audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || '';
        if (audioUrl && audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
        const rawPhonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || '';
        const phonetic = isValidIpa(rawPhonetic) ? cleanIpa(rawPhonetic) : '';
        const def = entry.meanings?.[0]?.definitions?.[0]?.definition || '';
        if (def || phonetic) {
          return {
            word: entry.word || cleanWord,
            phonetic,
            audioUrl,
            partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
            definition: def,
            example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
            synonyms: entry.meanings?.[0]?.synonyms || [],
            antonyms: entry.meanings?.[0]?.antonyms || [],
          };
        }
      }
    }
  } catch {
    // Timeout ou erro de conexão na api primária
  }

  // Tier 2: Datamuse API (CDN rápido, definições e fonética IPA confiáveis)
  // Para phrasal verbs (multi-word), usa ml= (meaning like) que tem melhor cobertura
  try {
    const datamuse_param = isMultiWord
      ? `ml=${encodeURIComponent(cleanWord)}&max=1&md=d`
      : `sp=${encodeURIComponent(cleanWord)}&md=dpr&ipa=1`;
    const res = await fetchWithTimeout(
      `https://api.datamuse.com/words?${datamuse_param}`,
      2000,
    );
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const match = data.find((item) => item.word?.toLowerCase() === cleanWord) || data[0];
        if (match) {
          const ipaTag = match.tags?.find((t) => t.startsWith('ipa_pron:'));
          const rawIpa = ipaTag ? ipaTag.replace('ipa_pron:', '').trim() : '';
          const rawPhonetic = rawIpa ? `/${rawIpa}/` : '';
          const phonetic = isValidIpa(rawPhonetic) ? cleanIpa(rawPhonetic) : '';

          let partOfSpeech = '';
          let definition = '';
          if (Array.isArray(match.defs) && match.defs.length) {
            const rawDef = match.defs[0] || '';
            const tabIdx = rawDef.indexOf('\t');
            if (tabIdx !== -1) {
              const code = rawDef.slice(0, tabIdx).trim().toLowerCase();
              definition = rawDef.slice(tabIdx + 1).trim();
              const posMap = {
                n: 'noun',
                v: 'verb',
                adj: 'adjective',
                adv: 'adverb',
                prop: 'noun',
              };
              partOfSpeech = posMap[code] || code;
            } else {
              definition = rawDef.trim();
            }
          }

          if (definition || phonetic) {
            return {
              word: match.word || cleanWord,
              phonetic,
              audioUrl: '',
              partOfSpeech,
              definition,
              example: '',
              synonyms: [],
              antonyms: [],
            };
          }
        }
      }
    }
  } catch {
    // Timeout ou erro de conexão no Datamuse
  }

  // Tier 3: Wiktionary REST API (alta disponibilidade da Wikimedia)
  try {
    const res = await fetchWithTimeout(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(cleanWord)}`,
      2000,
    );
    if (res && res.ok) {
      const data = await res.json();
      const en = data.en || data.english;
      if (Array.isArray(en) && en.length) {
        const entry = en[0];
        const partOfSpeech = entry.partOfSpeech?.toLowerCase() || '';
        const rawDef = entry.definitions?.[0]?.definition || '';
        const definition = stripHtmlTags(rawDef).trim();
        if (definition) {
          return {
            word: cleanWord,
            phonetic: '',
            audioUrl: '',
            partOfSpeech,
            definition,
            example: '',
            synonyms: [],
            antonyms: [],
          };
        }
      }
    }
  } catch {
    // Timeout ou erro no Wiktionary
  }

  return emptyResult;
}
