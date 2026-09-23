// Lexical review summary only. Never a measured CEFR proficiency level.
const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const MIN_TOTAL_ATTEMPTS = 50;
const MIN_BAND_ATTEMPTS = 10;
const RETENTION = 0.7;

// reviewLog: [{card_id, quality}] · cards: [{id, word_id}] · words: [{id,
// word, level}] · cefrMap: word -> banda. quality ≥ 2 conta como lembrado
// (Difícil é acerto com esforço — mesma régua do diagnóstico do linguista).
export function estimateLevelFromHistory(reviewLog, cards, words, cefrMap) {
  const wordById = {};
  (words || []).forEach((w) => { wordById[w.id] = w; });
  const bandByCardId = {};
  (cards || []).forEach((c) => {
    const w = wordById[c.word_id];
    if (!w) return;
    const band = (w.level && BANDS.includes(w.level) ? w.level : null)
      || cefrMap?.[String(w.word || '').toLowerCase()]
      || null;
    if (band && BANDS.includes(band)) bandByCardId[c.id] = band;
  });

  const stats = { A1: { attempts: 0, hits: 0 }, A2: { attempts: 0, hits: 0 },
    B1: { attempts: 0, hits: 0 }, B2: { attempts: 0, hits: 0 }, C1: { attempts: 0, hits: 0 } };
  let total = 0;
  for (const row of reviewLog || []) {
    const band = bandByCardId[row.card_id];
    if (!band) continue;
    stats[band].attempts += 1;
    if (Number(row.quality) >= 2) stats[band].hits += 1;
    total += 1;
  }

  if (total < MIN_TOTAL_ATTEMPTS) return { level: null, total, stats };

  let level = null;
  for (const band of BANDS) {
    const s = stats[band];
    if (s.attempts >= MIN_BAND_ATTEMPTS && s.hits / s.attempts >= RETENTION) {
      level = band; // continua subindo enquanto a escada segurar
    } else if (s.attempts >= MIN_BAND_ATTEMPTS) {
      break; // banda com dado suficiente e retenção baixa: teto encontrado
    } else {
      break; // sem dado suficiente na banda: não pula buraco
    }
  }
  return { level: null, lexicalBand: level, total, stats };
}
