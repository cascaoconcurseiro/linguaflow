// dashboard/js/core/coursePracticeSession.js
// Estado de uma sessão de prática, sem DOM. Regras de combo: só acerto sem
// envio errado e sem dica soma combo; dica, resposta revelada, envio errado ou
// pular quebram o combo; repetir o áudio não. O servidor recalcula precisão,
// erros e revisões a partir de buildResults(); score/combo têm teto no servidor.
//
// Palavra com frase de exemplo (#442): depois de acertar a palavra a unidade
// entra na etapa 'example' (digitar a frase). A frase é prática: erros, dicas
// e pular nela quebram o combo, mas não mudam o que buildResults() envia.

import { tokenizeSentence, evaluateSentenceAttempt } from './inputEngine.js';

export const MAX_COMBO_MULTIPLIER = 4;

// Recarregar ou fechar a aba no meio da lição não passa pela saída da tela
// (onLeaveView), então o que já foi respondido se perdia. No pagehide grava-se
// o parcial no envio pendente; ele é reenviado ao abrir os cursos (a RPC é
// idempotente por client_session_id). Com event.persisted a página pode voltar
// do cache de voltar/avançar e continua viva: não grava (#468).
export function shouldPersistOnPageHide({ session, committedOnExit = false } = {}, event) {
  if (event?.persisted || committedOnExit) return false;
  return Boolean(session && !session.finished && session.resolvedCount > 0);
}

export function comboMultiplier(streak) {
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + Math.max(0, streak) * 0.25);
}

export function createPracticeSession(units) {
  if (!Array.isArray(units) || units.length === 0) throw new Error('Lição sem frases');

  const perUnit = units.map((unit) => ({
    unitId: unit.id,
    tokens: tokenizeSentence(unit.text),
    exampleTokens: unit.kind === 'word' && unit.example_en ? tokenizeSentence(unit.example_en) : null,
    stage: 'word',
    exampleAttempts: 0,
    attempts: 0,
    hintCount: 0,
    hintedSlots: new Set(),
    revealed: false,
    skipped: false,
    firstWrongText: null,
    done: false,
  }));

  let index = 0;       // frase em foco (pode voltar para consultar)
  let frontier = 0;    // primeira frase ainda não resolvida
  let streak = 0;
  let highestCombo = 0;
  let score = 0;

  const state = () => perUnit[index];
  const inExample = () => state()?.stage === 'example';

  return {
    get index() { return index; },
    get total() { return units.length; },
    get unit() { return units[index] || null; },
    get tokens() { return (inExample() ? state().exampleTokens : state()?.tokens) || []; },
    get stage() { return state()?.stage || 'word'; },
    get currentText() { return inExample() ? units[index].example_en : units[index]?.text; },
    get currentTranslation() { return inExample() ? units[index].example_pt || '' : units[index]?.translation_pt; },
    get streak() { return streak; },
    get highestCombo() { return highestCombo; },
    get score() { return score; },
    get finished() { return frontier >= units.length; },
    get resolvedCount() { return perUnit.filter((s) => s.done).length; },
    get isReviewingPrevious() { return index < frontier; },
    get currentDone() { return Boolean(state()?.done); },
    get currentRevealed() { return Boolean(state()?.revealed); },
    hintedSlots() { return new Set(state()?.hintedSlots || []); },

    // Dica de uma palavra: devolve a palavra certa daquele campo.
    hintWord(slot) {
      const s = state();
      if (!s || s.done) return null;
      if (inExample()) {
        streak = 0;
        return s.exampleTokens[slot]?.targetWord || null;
      }
      const token = s.tokens[slot];
      if (!token) return null;
      if (!s.hintedSlots.has(slot)) {
        s.hintedSlots.add(slot);
        s.hintCount += 1;
      }
      streak = 0;
      return token.targetWord;
    },

    reveal() {
      const s = state();
      if (!s || s.done) return false;
      if (inExample()) { streak = 0; return true; }
      if (s.revealed) return false;
      s.revealed = true;
      streak = 0;
      return true;
    },

    submit(words) {
      const s = state();
      if (!s || s.done) throw new Error('Nenhuma frase ativa');
      if (inExample()) {
        s.exampleAttempts += 1;
        const evaluation = evaluateSentenceAttempt(s.exampleTokens, words);
        if (!evaluation.isCorrect) { streak = 0; return { ...evaluation, gained: 0 }; }
        s.done = true;
        frontier = Math.max(frontier, index + 1);
        const gained = s.exampleAttempts === 1 ? 50 : 10;
        score += gained;
        return { ...evaluation, gained, clean: s.exampleAttempts === 1 };
      }
      s.attempts += 1;
      const evaluation = evaluateSentenceAttempt(s.tokens, words);

      if (!evaluation.isCorrect) {
        if (s.firstWrongText === null) {
          s.firstWrongText = words.map((w) => String(w || '').trim()).join(' ').trim() || '(em branco)';
        }
        streak = 0;
        return { ...evaluation, gained: 0 };
      }

      const clean = s.attempts === 1 && s.hintCount === 0 && !s.revealed;
      let gained = 25;
      if (clean) {
        streak += 1;
        highestCombo = Math.max(highestCombo, streak);
        gained = Math.round(100 * comboMultiplier(streak));
      }
      score += gained;
      if (s.exampleTokens) {
        s.stage = 'example';
        return { ...evaluation, gained, clean, nextStage: 'example' };
      }
      s.done = true;
      frontier = Math.max(frontier, index + 1);
      return { ...evaluation, gained, clean };
    },

    // Pular: a frase conta como não acertada (vai para revisão) e quebra o combo.
    skip(words = []) {
      const s = state();
      if (!s || s.done) return false;
      if (inExample()) {
        // A palavra já foi acertada: pular só a frase não a manda para revisão.
        s.done = true;
        frontier = Math.max(frontier, index + 1);
        streak = 0;
        return true;
      }
      s.skipped = true;
      s.revealed = true;
      s.attempts = Math.max(s.attempts, 1) + 1;
      const typed = words.map((w) => String(w || '').trim()).join(' ').trim();
      if (s.firstWrongText === null && typed) s.firstWrongText = typed;
      s.done = true;
      frontier = Math.max(frontier, index + 1);
      streak = 0;
      return true;
    },

    next() {
      if (!state()?.done) throw new Error('Frase atual ainda não foi resolvida');
      index = Math.min(index + 1, frontier);
      return !this.finished || index < frontier;
    },

    previous() {
      if (index === 0) return false;
      index -= 1;
      return true;
    },

    // Volta para a primeira frase não resolvida (depois de consultar anteriores).
    resume() {
      index = Math.min(frontier, units.length - 1);
    },

    buildResults({ onlyAnswered = false } = {}) {
      return perUnit
        .filter((s) => !onlyAnswered || s.done)
        .map((s) => ({
          unit_id: s.unitId,
          attempts: Math.max(1, s.attempts),
          hint_count: s.hintCount,
          revealed: s.revealed,
          wrong_text: s.firstWrongText,
        }));
    },

    summary() {
      const answered = perUnit.filter((s) => s.done);
      const firstTry = answered.filter((s) => s.attempts === 1).length;
      return {
        answered: answered.length,
        accuracy: answered.length ? Math.round((firstTry / answered.length) * 100) : 0,
        mistakes: answered.reduce((acc, s) => acc + Math.max(0, s.attempts - 1), 0),
        hints: answered.filter((s) => s.hintCount > 0 || s.revealed).length,
      };
    },
  };
}
