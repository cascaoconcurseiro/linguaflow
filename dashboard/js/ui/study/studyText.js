// dashboard/js/ui/study/studyText.js — Funções puras de texto da revisão: comparar respostas digitadas (normalização e distância de edição) e formatar intervalos.

export function normalizeAnswer(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
}

// Distancia de edicao para o "quase" do ditado (A2): typo de 1-2 letras
// mede TECLADO, nao audicao — nao pode virar lapso no FSRS.
export function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

export function formatInterval(ivl) {
  if (ivl == null || isNaN(ivl)) return '—';
  if (ivl < 1) return `${Math.max(1, Math.round(ivl * 1440))} min`;
  if (ivl < 30) return `${Math.round(ivl)} ${Math.round(ivl) === 1 ? 'dia' : 'dias'}`;
  if (ivl < 365) return `${(ivl / 30.4).toFixed(1).replace('.0', '')} mes.`;
  return `${(ivl / 365).toFixed(1).replace('.0', '')} ano${ivl >= 730 ? 's' : ''}`;
}
