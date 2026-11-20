// background/word-classifier.js — Classificador de categoria de palavras (palavra, phrasal verb, expressão, gíria): regra estática primeiro, IA como reforço.

import { slangsDB } from '../utils/slangs-db.js';
import { phrasalVerbsDB } from '../utils/phrasal-verbs.js';
import { fetchWithRetry, getApiConfig } from './ai-requests.js';

export function classifyWordStatic(word) {
  if (!word || typeof word !== 'string') return 'word';
  const w = word.toLowerCase().trim();
  const parts = w.split(/\s+/);

  if (parts.length > 4) {
    const idiomMarkers = ['kick the', 'bite the', 'break a', 'hit the', 'bite off', 'cost an arm', 'piece of cake', 'under the weather', 'beat around', 'let the cat', 'once in a blue', 'the ball is', 'spill the beans', 'rule of thumb', 'on the fence', 'blessing in disguise'];
    for (const marker of idiomMarkers) {
      if (w.includes(marker)) return 'idiom';
    }
    return 'sentence';
  }

  // 1. Gírias e contrações informais curadas
  if (slangsDB && slangsDB.has(w)) return 'slang';

  // 2. Phrasal verbs: verificação estruturada no banco curado e padrão verbo + partícula
  if (parts.length >= 2) {
    const first = parts[0];
    if (phrasalVerbsDB && phrasalVerbsDB[first]) {
      const isKnownPhrasal = phrasalVerbsDB[first].some((entry) => entry.phrase?.toLowerCase() === w);
      if (isKnownPhrasal) return 'phrasal';
    }
    const phrasalParticles = ['up','out','in','off','on','away','back','down','over','through','into','around','along','apart','aside','forward'];
    const lastWord = parts[parts.length - 1];
    if (phrasalParticles.includes(lastWord)) return 'phrasal';
    // Também verificar a segunda palavra se for 3 palavras
    if (parts.length === 3 && phrasalParticles.includes(parts[1])) return 'phrasal';
  }

  // 3. Expressões idiomáticas
  const idiomMarkers = ['kick the', 'bite the', 'break a', 'hit the', 'bite off', 'cost an arm', 'piece of cake', 'under the weather', 'beat around', 'let the cat', 'once in a blue', 'the ball is', 'spill the beans', 'rule of thumb', 'on the fence', 'blessing in disguise'];
  for (const marker of idiomMarkers) {
    if (w.includes(marker)) return 'idiom';
  }

  // Multi-word expressions que não são phrasal verbs
  if (parts.length >= 2) return 'idiom';

  return 'word';
}

export async function classifyWordAI(word) {
  if (!word) return 'word';
  const config = await getApiConfig();
  if (!config.apiKey) return classifyWordStatic(word);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // Fast timeout

  const prompt = `Classifique a seguinte expressão em inglês em EXATAMENTE UMA destas 4 categorias: 'idiom', 'phrasal', 'slang', 'word'.
Responda APENAS com a categoria, sem pontuação ou texto extra.
Expressão: "${word}"`;

  try {
    let responseText = '';
    
      const res = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    
    clearTimeout(timeoutId);

    const cat = responseText.toLowerCase().replace(/[^a-z_]/g, '');
    const valid = ['idiom', 'phrasal', 'slang', 'word'];
    if (valid.includes(cat)) return cat;
    return classifyWordStatic(word);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[LinguaFlow AI] Error classifyWordAI:', err);
    return classifyWordStatic(word);
  }
}
