// content/subtitles/active-cue.js — Escolha da fala ativa e do fim efetivo.
// Fonte única para a legenda na tela, a pausa automática e a barra lateral.
// Cues devem estar em segundos e ordenadas por `start`.

export const MIN_CUE_SECONDS = 3.5;
export const MAX_CUE_SECONDS = 12;
const END_TOLERANCE = 0.05;
// Acima disso, o avanço entre dois frames é um salto (seek), não reprodução.
const MAX_NATURAL_STEP = 1.5;

// Limita cues cujo `end` se estende por música/silêncio, sem cortar falas
// longas reais: o teto cresce com a quantidade de texto.
export function effectiveCueEnd(cue) {
  const text = cue?.text || '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimate = 2 + Math.max(wordCount * 0.5, text.length * 0.08);
  const maxDuration = Math.min(MAX_CUE_SECONDS, Math.max(MIN_CUE_SECONDS, estimate));
  return Math.min(cue.end, cue.start + maxDuration);
}

export function findActiveCueIndex(cues, time) {
  if (!Array.isArray(cues) || cues.length === 0 || !Number.isFinite(time)) return -1;

  let low = 0;
  let high = cues.length - 1;
  let lastStarted = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (cues[mid].start <= time) {
      lastStarted = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Entre as sobrepostas, vence a de texto mais longo; no empate, a mais recente.
  let best = -1;
  for (let i = lastStarted; i >= 0 && cues[i].start >= time - MAX_CUE_SECONDS; i--) {
    if (time > effectiveCueEnd(cues[i])) continue;
    if (best < 0 || (cues[i].text || '').length > (cues[best].text || '').length) best = i;
  }
  return best;
}

// Legenda lida do DOM (Netflix): o fim só é conhecido quando o texto muda
// ou some. Tempos em segundos; a lista fica ordenada e sem a mesma fala
// repetida quando o usuário volta o vídeo.
const DOM_CUE_PROVISIONAL_SECONDS = 8;
const SAME_CUE_TOLERANCE = 0.75;

export function closeDomCue(cues, time) {
  const open = cues.find((cue) => cue._domOpen);
  if (!open) return;
  open.end = Math.max(open.start, Math.min(open.end, time));
  open._domOpen = false;
}

export function recordDomCue(cues, text, time) {
  closeDomCue(cues, time);
  const existing = cues.find((cue) => cue.text === text && Math.abs(cue.start - time) < SAME_CUE_TOLERANCE);
  if (existing) return existing;
  const cue = { start: time, end: time + DOM_CUE_PROVISIONAL_SECONDS, text, _domOpen: true };
  let insertAt = cues.length;
  while (insertAt > 0 && cues[insertAt - 1].start > time) insertAt--;
  cues.splice(insertAt, 0, cue);
  return cue;
}

// Verdadeiro quando a reprodução atravessou naturalmente o fim da fala entre
// dois frames — cobre frames que pulam a janela de tolerância (velocidade 2x).
export function crossedCueEnd(cue, previousTime, time) {
  if (!cue || !Number.isFinite(previousTime) || !Number.isFinite(time)) return false;
  const threshold = effectiveCueEnd(cue) - END_TOLERANCE;
  return previousTime < threshold && time >= threshold && time - previousTime < MAX_NATURAL_STEP;
}
