// Tamanhos de sessão da Revisão dos Cursos (#398). ~30 s por frase: 10 frases
// cabem em ~5 minutos. Fila grande desanima, então oferecemos uma sessão curta
// ao lado do bloco padrão e uma mensagem que tira a pressão do atraso.

const FULL_BATCH = 20;
const QUICK_BATCH = 10;
const BACKLOG_THRESHOLD = 60;

export function reviewBatchPlan(dueCount) {
  const due = Math.max(0, Math.floor(Number(dueCount) || 0));
  return {
    full: Math.min(due, FULL_BATCH),
    quick: due > QUICK_BATCH ? QUICK_BATCH : 0,
    backlog: due >= BACKLOG_THRESHOLD,
  };
}
