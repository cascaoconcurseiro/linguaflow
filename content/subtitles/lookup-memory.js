// content/subtitles/lookup-memory.js — Memória de consultas repetidas (#488)
//
// Palavra consultada várias vezes sem ser salva é sinal de dificuldade real: o card
// avisa e sugere salvar para entrar na revisão. Só guarda contagem por palavra, neste
// dispositivo (chrome.storage.local); nada de frase, URL ou vídeo. Falha de storage
// nunca quebra o card.

export const LOOKUP_KEY = 'lf_lookup_counts';
export const LOOKUP_HINT_THRESHOLD = 3;
export const LOOKUP_MAX_ENTRIES = 300;
// O hover troca a palavra do card várias vezes por segundo: consultas da mesma palavra
// dentro dessa janela contam como uma só.
export const LOOKUP_DEBOUNCE_MS = 30_000;

/** Puro: soma uma consulta e devolve o novo mapa e a contagem da palavra. */
export function bumpLookup(counts, word, now = Date.now()) {
  const key = String(word || '').toLowerCase().trim();
  const next = { ...(counts && typeof counts === 'object' ? counts : {}) };
  if (!key || key.length > 40) return { counts: next, count: 0 };
  const entry = next[key] || { n: 0, t: -Infinity };
  if (now - entry.t >= LOOKUP_DEBOUNCE_MS) next[key] = { n: entry.n + 1, t: now };
  const keys = Object.keys(next);
  if (keys.length > LOOKUP_MAX_ENTRIES) {
    keys.sort((a, b) => next[a].t - next[b].t);
    for (const old of keys.slice(0, keys.length - LOOKUP_MAX_ENTRIES)) delete next[old];
  }
  return { counts: next, count: next[key]?.n || 0 };
}

export function lookupHintText(count) {
  return count >= LOOKUP_HINT_THRESHOLD
    ? `Você já consultou esta palavra ${count} vezes. Salve para ela entrar na revisão.`
    : '';
}

function storage() {
  try {
    return globalThis.chrome?.storage?.local || null;
  } catch {
    return null;
  }
}

/** Registra a consulta e devolve quantas vezes a palavra já foi consultada (0 sem storage). */
export async function recordLookup(word, now = Date.now()) {
  const area = storage();
  if (!area) return 0;
  try {
    const stored = await area.get(LOOKUP_KEY);
    const { counts, count } = bumpLookup(stored?.[LOOKUP_KEY], word, now);
    await area.set({ [LOOKUP_KEY]: counts });
    return count;
  } catch {
    return 0;
  }
}
