// content/subtitles/hbo-segment-offset.js — Calibra o deslocamento de cada arquivo VTT da Max.
//
// A Max entrega a legenda em arquivos por trecho (1.vtt, 2.vtt…) e o player aplica
// um deslocamento próprio a cada um (medido: 0 s, ~45 s, ~91 s no mesmo filme).
// O X-TIMESTAMP-MAP vem zerado, então o deslocamento só se descobre comparando a
// legenda nativa, que o player já mostra no tempo certo, com as falas do arquivo.
// Só a Max usa este módulo; o YouTube segue o caminho próprio.

export const MAX_SEGMENT_OFFSET_SECONDS = 300;
const MIN_AGREEING_SAMPLES = 2;
const AGREEMENT_WINDOW_SECONDS = 1;
const NEGLIGIBLE_OFFSET_SECONDS = 0.5;

/** Texto comparável: sem [tags], notas musicais, pontuação, caixa ou espaços extras. */
export function normalizeCaptionText(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[♪♫♬♩]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identifica o arquivo VTT sem a query de telemetria (CMCD muda a cada pedido). */
export function segmentKey(url) {
  const raw = String(url || '');
  const cut = raw.indexOf('?');
  return cut === -1 ? raw : raw.slice(0, cut);
}

/**
 * Estima o deslocamento (s) de um arquivo VTT.
 * samples: [{ time, text }] — fala nativa vista na tela e o currentTime em que apareceu.
 * cues: falas do arquivo, com start nos tempos originais.
 * Devolve null sem prova suficiente (amostras escassas, ambíguas ou discordantes).
 */
export function estimateSegmentOffset(samples, cues) {
  const byText = new Map();
  for (const cue of cues || []) {
    const key = normalizeCaptionText(cue.text);
    if (!key) continue;
    byText.set(key, byText.has(key) ? null : cue);
  }

  const offsets = [];
  for (const sample of samples || []) {
    const cue = byText.get(normalizeCaptionText(sample.text));
    if (!cue || !Number.isFinite(sample.time)) continue;
    const offset = sample.time - (Number.isFinite(cue._rawStart) ? cue._rawStart : cue.start);
    if (Math.abs(offset) <= MAX_SEGMENT_OFFSET_SECONDS) offsets.push(offset);
  }
  if (offsets.length < MIN_AGREEING_SAMPLES) return null;

  offsets.sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)];
  const agreeing = offsets.filter((o) => Math.abs(o - median) <= AGREEMENT_WINDOW_SECONDS);
  if (agreeing.length < MIN_AGREEING_SAMPLES) return null;

  const mean = agreeing.reduce((sum, o) => sum + o, 0) / agreeing.length;
  return Math.abs(mean) < NEGLIGIBLE_OFFSET_SECONDS ? 0 : mean;
}

/** Aplica o deslocamento partindo dos tempos originais (idempotente). */
export function shiftCues(cues, offset) {
  for (const cue of cues) {
    if (!Number.isFinite(cue._rawStart)) {
      cue._rawStart = cue.start;
      cue._rawEnd = cue.end;
    }
    cue.start = cue._rawStart + offset;
    cue.end = cue._rawEnd + offset;
  }
  return cues;
}
