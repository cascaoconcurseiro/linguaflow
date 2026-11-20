// dashboard/js/ui/stories/storyTranslation.js — Tradução de palavras e frases nas histórias: cofre local, extensão, tradutor, MyMemory e IA como último recurso.
import { aiChat } from '../../core/ai.js';
import { translator } from '../../../../utils/translator.js';
import { lemma } from '../../../../utils/lemma.js';
import { isExtensionContext as isExtension } from '../../core/env.js';

// Traduções já conhecidas (cofre do aluno + o que foi traduzido nesta sessão). O mapa é mutado, nunca reatribuído.
export const vaultTranslations = new Map();

export async function translateText(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;

  const cleanLower = clean.toLowerCase().replace(/[^a-zA-Z0-9'-]/g, '');
  const tokenLemma = lemma(cleanLower) || cleanLower;

  // 1. Cache do cofre ou memória imediato (0ms)
  if (vaultTranslations.has(cleanLower)) return vaultTranslations.get(cleanLower);
  if (vaultTranslations.has(tokenLemma)) return vaultTranslations.get(tokenLemma);
  const memoryKey = `en:pt:${cleanLower}`;
  if (translator.memoryCache?.has(memoryKey)) return translator.memoryCache.get(memoryKey);

  // 2. Extensão: se estiver dentro de página da extensão (chrome-extension:)
  if (isExtension) {
    const extTrans = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'translate', text: clean, from: 'en', to: 'pt' }, (res) => {
          if (chrome.runtime.lastError || !res?.translation) {
            resolve(null);
          } else {
            resolve(res.translation);
          }
        });
      } catch {
        resolve(null);
      }
    });
    if (extTrans) {
      vaultTranslations.set(cleanLower, extTrans);
      return extTrans;
    }
  }

  // 3. Tradutor universal (Cache multinível, Dicionário offline, Google, MyMemory)
  try {
    const res = await translator.translate(clean, 'en', 'pt');
    if (res?.translation) {
      vaultTranslations.set(cleanLower, res.translation);
      return res.translation;
    }
  } catch (e) {
    console.warn('[Stories] translator.translate falhou:', e);
  }

  // 4. Fallback direto MyMemory (CORS liberado no ambiente web)
  try {
    const fallback = await translator._fetchMyMemory(clean, 'en', 'pt');
    if (fallback) {
      vaultTranslations.set(cleanLower, fallback);
      return fallback;
    }
  } catch {}

  // 5. Fallback via IA para frases ou quando APIs externas forem bloqueadas
  if (clean.includes(' ') || clean.length > 20) {
    try {
      const aiFallback = await translateSentenceWithAI(clean);
      if (aiFallback) {
        vaultTranslations.set(cleanLower, aiFallback);
        return aiFallback;
      }
    } catch {}
  }

  return null;
}

export async function translateSentenceWithAI(sentence) {
  if (!sentence || typeof sentence !== 'string') return '';
  const clean = sentence.trim();
  if (!clean) return '';
  try {
    const system = 'Você é um tradutor especialista de inglês para português brasileiro natural. Traduza a frase a seguir de forma direta e concisa, sem aspas, sem explicações e sem introduções.';
    const res = await aiChat(
      [{ role: 'system', content: system }, { role: 'user', content: clean }],
      { temperature: 0.1, max_tokens: 300 }
    );
    return res ? res.trim().replace(/^["“']|["”']$/g, '') : '';
  } catch (err) {
    console.warn('[Stories] translateSentenceWithAI falhou:', err);
    return '';
  }
}
