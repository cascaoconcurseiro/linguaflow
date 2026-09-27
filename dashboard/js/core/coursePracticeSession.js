// dashboard/js/core/coursePracticeSession.js
// Estado de uma sessão de prática de curso, sem DOM: tentativas por frase,
// uso de dica, combo e pontuação. O servidor recalcula precisão, erros e
// revisões a partir de buildResults(); score/combo são só exibição + teto.

import { tokenizeSentence, evaluateSentenceAttempt } from './inputEngine.js';

export const MAX_COMBO_MULTIPLIER = 4;

export function comboMultiplier(streak) {
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + Math.max(0, streak) * 0.25);
}

export function createPracticeSession(units) {
  if (!Array.isArray(units) || units.length === 0) throw new Error('Lição sem frases');

  const perUnit = units.map((unit) => ({
    unitId: unit.id,
    tokens: tokenizeSentence(unit.text),
    attempts: 0,
    usedHint: false,
    firstWrongText: null,
    done: false,
  }));

  let index = 0;
  let streak = 0;
  let highestCombo = 0;
  let score = 0;

  return {
    get index() { return index; },
    get total() { return units.length; },
    get unit() { return units[index] || null; },
    get tokens() { return perUnit[index]?.tokens || []; },
    get streak() { return streak; },
    get highestCombo() { return highestCombo; },
    get score() { return score; },
    get finished() { return index >= units.length; },
    get currentUsedHint() { return Boolean(perUnit[index]?.usedHint); },

    // Revelar a resposta conta como dica: quebra o combo e a frase deixa de
    // ser "acerto limpo" para a revisão espaçada.
    useHint() {
      const state = perUnit[index];
      if (!state || state.usedHint) return false;
      state.usedHint = true;
      streak = 0;
      return true;
    },

    submit(words) {
      const state = perUnit[index];
      if (!state || state.done) throw new Error('Nenhuma frase ativa');
      state.attempts += 1;
      const evaluation = evaluateSentenceAttempt(state.tokens, words);

      if (!evaluation.isCorrect) {
        if (state.firstWrongText === null) {
          state.firstWrongText = words.map((w) => String(w || '').trim()).join(' ').trim() || '(em branco)';
        }
        streak = 0;
        return { ...evaluation, gained: 0 };
      }

      state.done = true;
      const clean = state.attempts === 1 && !state.usedHint;
      let gained = 0;
      if (clean) {
        streak += 1;
        highestCombo = Math.max(highestCombo, streak);
        gained = Math.round(100 * comboMultiplier(streak));
      } else {
        gained = 25;
      }
      score += gained;
      return { ...evaluation, gained, clean };
    },

    next() {
      if (!perUnit[index]?.done) throw new Error('Frase atual ainda não foi resolvida');
      index += 1;
      return !this.finished;
    },

    buildResults() {
      return perUnit.map((state) => ({
        unit_id: state.unitId,
        attempts: Math.max(1, state.attempts),
        used_hint: state.usedHint,
        wrong_text: state.firstWrongText,
      }));
    },

    summary() {
      const firstTry = perUnit.filter((s) => s.attempts === 1).length;
      return {
        accuracy: Math.round((firstTry / units.length) * 100),
        mistakes: perUnit.reduce((acc, s) => acc + Math.max(0, s.attempts - 1), 0),
        hints: perUnit.filter((s) => s.usedHint).length,
      };
    },
  };
}
