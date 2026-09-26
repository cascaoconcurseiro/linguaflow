// content/subtitles/vtt-parser.js — Parser de legendas WebVTT
// Extraído de content/subtitle-engine.js (HBO Max / Max / VTT streams)

/**
 * Faz o parsing de string WebVTT retornando lista de cues com start, end e text.
 * @param {string} vttStr
 * @param {((text: string) => string)|null} [cleanSubtitleTextFn]
 * @returns {Array<{ start: number, end: number, text: string }>}
 */
export function parseVTT(vttStr, cleanSubtitleTextFn = null) {
  if (!vttStr || typeof vttStr !== 'string') return [];
  const normalized = vttStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cues = [];
  const blocks = normalized.split(/\n\s*\n/);
  blocks.forEach((b) => {
    const lines = b.trim().split('\n');
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) return;
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const parseTime = (t) => {
      if (!t) return 0;
      const timePart = t.split(/\s+/)[0].replace(',', '.');
      const p = timePart.split(':');
      let sec = parseFloat(p.pop() || 0);
      if (p.length) sec += parseInt(p.pop() || 0, 10) * 60;
      if (p.length) sec += parseInt(p.pop() || 0, 10) * 3600;
      return isNaN(sec) ? 0 : sec;
    };
    const rawText = lines
      .slice(lines.indexOf(timeLine) + 1)
      .map((l) => l.replace(/<[^>]+>/g, '').trim())
      .join(' ')
      .trim();
    const text = typeof cleanSubtitleTextFn === 'function' ? cleanSubtitleTextFn(rawText) : rawText;
    if (text) {
      const start = parseTime(startStr);
      const parsedEnd = parseTime(endStr);
      const words = text.split(/\s+/).filter(Boolean).length;
      const maxDur = Math.min(8.0, Math.max(3.5, 2.0 + Math.max(words * 0.45, text.length * 0.08)));
      const end = Math.min(parsedEnd, start + maxDur);
      cues.push({ start, end, text });
    }
  });
  return cues;
}
