// utils/intake-guard.js — Freio de entrada (#495): com muitas revisões vencidas, a palavra nova espera em vez de virar mais dívida.
// Funções puras, sem rede nem DOM. Usadas pelo salvamento (utils/db/words.js) e pela liberação no Início.
//
// Contrato:
// - `lf_intake_pause_due` = quantas revisões vencidas (learning/review/mature, não suspensas) disparam o freio.
//   Vazio/ausente = padrão; 0 desliga o freio (e libera tudo o que ele segurou — é o caminho de reversão).
// - Card novo nunca conta como dívida: senão a própria fila de espera acenderia o freio.

export const DEFAULT_INTAKE_PAUSE_DUE = 40;
export const INTAKE_WAIT_TAG = 'lf:espera-fila';
// Histerese: o freio solta quando a dívida cai a metade do limiar, para não oscilar a cada revisão.
export const INTAKE_RESUME_RATIO = 0.5;
// Quantas palavras seguradas voltam por dia, para a fila não ressurgir de uma vez.
export const INTAKE_RELEASE_PER_DAY = 5;

export function resolveIntakePauseDue(raw) {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_INTAKE_PAUSE_DUE;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INTAKE_PAUSE_DUE;
  return n <= 0 ? 0 : Math.floor(n);
}

export function countOverdueReviews(cards = [], nowMs = Date.now()) {
  let overdue = 0;
  for (const c of cards || []) {
    if (!c || c.suspended || c.status === 'new' || !c.due_date) continue;
    const due = Date.parse(c.due_date);
    if (Number.isFinite(due) && due <= nowMs) overdue++;
  }
  return overdue;
}

export function shouldHoldNewWord({ overdue = 0, threshold = DEFAULT_INTAKE_PAUSE_DUE } = {}) {
  return threshold > 0 && overdue > threshold;
}

// Freio desligado libera tudo; ligado, só libera quando a dívida caiu abaixo da histerese.
export function canReleaseHeldWords({ overdue = 0, threshold = DEFAULT_INTAKE_PAUSE_DUE } = {}) {
  if (threshold <= 0) return true;
  return overdue <= Math.floor(threshold * INTAKE_RESUME_RATIO);
}

// `state` guarda "AAAA-MM-DD:n" (n = liberadas naquele dia). Devolve quantas ainda podem sair hoje.
export function releaseQuota({ threshold, state, todayKey, perDay = INTAKE_RELEASE_PER_DAY } = {}) {
  if (threshold <= 0) return Number.POSITIVE_INFINITY;
  const [day, n] = String(state || '').split(':');
  const used = day === todayKey ? Math.max(0, Number(n) || 0) : 0;
  return Math.max(0, perDay - used);
}

export function nextReleaseState({ state, todayKey, released }) {
  const [day, n] = String(state || '').split(':');
  const used = day === todayKey ? Math.max(0, Number(n) || 0) : 0;
  return `${todayKey}:${used + released}`;
}
