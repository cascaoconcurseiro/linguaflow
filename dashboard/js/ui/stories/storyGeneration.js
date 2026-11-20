// dashboard/js/ui/stories/storyGeneration.js — Geração de histórias: roteia para a extensão ou para a Edge Function e escolhe as palavras do aluno para o reencontro.
import { db } from '../../../../utils/db.js';
import { generateStoryWeb } from '../../core/ai.js';
import { isWeakCard } from '../../../../utils/weak-card.js';
import { isExtensionContext as isExtension } from '../../core/env.js';

// Roteadores extensão/web: na extensão o service worker faz o trabalho;
// no site (Vercel) chamamos a Edge Function (história) e o translator
// client-side (Google GTX/MyMemory têm CORS liberado — verificado).
export function generateStory(genre, onChunk, userWords = [], options = {}) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'ai_generate_story', genre, options }, resolve);
    });
  }
  return generateStoryWeb(genre, onChunk, userWords, options).catch((e) => ({ error: e.message }));
}

// Palavras pro REENCONTRO na história (Marco 3): fracas primeiro (isWeakCard:
// 2+ lapsos/leech), depois as em aprendizado mais recentes — até 8.
export async function getReencounterWords() {
  try {
    const [cards, words] = await Promise.all([db.getAllCards(), db.getAllWords()]);
    const wordById = {};
    words.forEach(w => { wordById[w.id] = w; });
    const nameOf = (c) => wordById[c.word_id]?.word;
    const weak = cards
      .filter(c => !c.suspended && isWeakCard(c))
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
      .map(nameOf).filter(Boolean);
    const inProgress = cards
      .filter(c => !c.suspended && (c.status === 'learning' || c.status === 'review'))
      .sort((a, b) => new Date(b.last_review || 0) - new Date(a.last_review || 0))
      .map(nameOf).filter(Boolean);
    return [...new Set([...weak, ...inProgress])].slice(0, 8);
  } catch { return []; }
}
