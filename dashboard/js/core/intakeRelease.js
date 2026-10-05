// dashboard/js/core/intakeRelease.js — Devolve à fila as palavras que o freio de entrada segurou, quando a dívida baixa (#495).
// Sem esta volta o freio seria perda silenciosa. Com lf_intake_pause_due=0 devolve tudo (reversão).
import { localDateKey } from '../../../utils/local-day.js';
import {
  INTAKE_WAIT_TAG,
  canReleaseHeldWords,
  countOverdueReviews,
  nextReleaseState,
  releaseQuota,
  resolveIntakePauseDue,
  wordFrequencyRank,
} from '../../../utils/intake-guard.js';

export const INTAKE_STATE_KEY = 'lf_intake_release_state';

// Lê o estado e, se for a hora, libera as mais úteis primeiro (mais frequentes); empate: a ordem em que o aluno as salvou.
// Nunca lança: o Início não pode quebrar por causa disto.
export async function releaseHeldWords(db, { todayKey = localDateKey(), nowMs = Date.now() } = {}) {
  const result = { held: 0, released: 0, overdue: 0, blocked: null };
  try {
    const [rawThreshold, cards, words] = await Promise.all([
      db.getSetting('lf_intake_pause_due'),
      db.getAllCards(),
      db.getAllWords(),
    ]);
    const threshold = resolveIntakePauseDue(rawThreshold);
    const heldWords = new Map();
    for (const w of words || []) {
      if (Array.isArray(w?.tags) && w.tags.includes(INTAKE_WAIT_TAG)) heldWords.set(w.id, w);
    }
    const heldCards = (cards || [])
      .filter((c) => c?.suspended && heldWords.has(c.word_id))
      .sort((a, b) => (wordFrequencyRank(heldWords.get(a.word_id)?.tags) - wordFrequencyRank(heldWords.get(b.word_id)?.tags))
        || (Date.parse(a.due_date || 0) - Date.parse(b.due_date || 0)));
    result.held = heldCards.length;
    if (!heldCards.length) return result;

    result.overdue = countOverdueReviews(cards, nowMs);
    if (!canReleaseHeldWords({ overdue: result.overdue, threshold })) {
      result.blocked = 'backlog';
      return result;
    }
    const state = await db.getSetting(INTAKE_STATE_KEY);
    const quota = releaseQuota({ threshold, state, todayKey });
    if (quota <= 0) {
      result.blocked = 'daily_limit';
      return result;
    }
    for (const card of heldCards.slice(0, quota === Number.POSITIVE_INFINITY ? undefined : quota)) {
      await db.setCardSuspended(card.id, false);
      const word = heldWords.get(card.word_id);
      await db.addTagsToWord(word.id, word.tags.filter((t) => t !== INTAKE_WAIT_TAG)).catch(() => {});
      result.released++;
    }
    result.held -= result.released;
    if (result.released > 0) db.logUsageEvent?.('intake_released')?.catch?.(() => {});
    if (threshold > 0 && result.released > 0) {
      await db.setSetting(INTAKE_STATE_KEY, nextReleaseState({ state, todayKey, released: result.released })).catch(() => {});
    }
  } catch (error) {
    console.warn('[IntakeRelease] falhou sem afetar o Início:', error?.message || error);
    result.blocked = 'error';
  }
  return result;
}
