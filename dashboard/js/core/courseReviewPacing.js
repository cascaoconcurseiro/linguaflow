// dashboard/js/core/courseReviewPacing.js — meta diária das revisões do curso (#501).
// Funções puras (sem DOM, sem rede). A meta, as revisões já feitas hoje e o atraso vêm do servidor
// (`rpc_get_course_hub_summary`); aqui só se transforma esse resumo em número e texto para a tela.
// Sem os campos novos (frontend publicado antes da migration) o comportamento é o de antes: tudo que venceu conta.

export const EXTRA_REVIEW_BATCH = 10; // "Revisar mais" depois da meta: opcional, nunca bloqueia

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));
const plural = (n, one, many) => (n === 1 ? one : many);

export function courseReviewPacing(summary) {
  const s = summary || {};
  const total = count(s.reviews_due_total ?? s.reviews_due_count);
  const capped = s.reviews_due_today != null && Number.isFinite(Number(s.reviews_due_today));
  const today = capped ? Math.min(total, count(s.reviews_due_today)) : total;
  return {
    total,
    today,
    backlog: total - today,
    doneToday: count(s.reviews_done_today),
    cap: capped ? count(s.reviews_daily_cap) : null,
    overdue7d: count(s.reviews_overdue_7d),
    capped,
  };
}

export function courseReviewsLabel(pacing) {
  if (!pacing || !pacing.total) return '';
  if (!pacing.capped) return `${pacing.total} ${plural(pacing.total, 'revisão vencida', 'revisões vencidas')}`;
  if (pacing.today > 0) {
    const base = `${pacing.today} ${plural(pacing.today, 'revisão para hoje', 'revisões para hoje')}`;
    return pacing.backlog > 0 ? `${base} · +${pacing.backlog} na fila` : base;
  }
  return `Meta de hoje feita · ${pacing.total} na fila`;
}

/**
 * @param {string[]} dueUnitIds frases vencidas, da mais antiga para a mais recente
 * @param {ReturnType<typeof courseReviewPacing>} pacing
 */
export function planReviewSession(dueUnitIds, pacing) {
  const due = Array.isArray(dueUnitIds) ? dueUnitIds : [];
  if (!due.length) return { state: 'empty', todayIds: [], extraIds: [] };
  if (!pacing?.capped) return { state: 'pending', todayIds: due, extraIds: [] };
  const todayIds = due.slice(0, pacing.today);
  if (todayIds.length) return { state: 'pending', todayIds, extraIds: [] };
  return { state: 'goal-done', todayIds: [], extraIds: due.slice(0, EXTRA_REVIEW_BATCH) };
}
