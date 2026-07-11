// statsEngine.js — Agregações PURAS para a tela de Estatísticas (Onda 2.1).
// Nada de DOM, nada de rede: só transforma review_log/sessions/cards em
// séries prontas pra desenhar. Testável em Node (tests/engine.test.mjs).

import { localDateKey, addLocalDays } from '../../../utils/local-day.js';

// Retenção por dia dos últimos `days` dias (dia local do aluno).
// reviewLog: [{ date | ts, quality }]
export function retentionByDay(reviewLog, days = 30) {
  const activityDate = (r) => (r?.ts ? localDateKey(r.ts) : r?.date);
  const byDate = {};
  (reviewLog || []).forEach((r) => {
    const key = activityDate(r);
    if (!key) return;
    (byDate[key] = byDate[key] || { total: 0, hits: 0 });
    byDate[key].total++;
    if (r.quality >= 2) byDate[key].hits++;
  });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDateKey(addLocalDays(-i));
    const s = byDate[key] || { total: 0, hits: 0 };
    out.push({
      date: key,
      total: s.total,
      hits: s.hits,
      retention: s.total ? Math.round((s.hits / s.total) * 100) : null,
    });
  }
  return out;
}

// Minutos estudados por dia dos últimos `days` dias.
// sessions: [{ date, seconds }]
export function studyTimeByDay(sessions, days = 30) {
  const byDate = {};
  (sessions || []).forEach((s) => { byDate[s.date] = (byDate[s.date] || 0) + (s.seconds || 0); });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDateKey(addLocalDays(-i));
    out.push({ date: key, minutes: Math.round((byDate[key] || 0) / 60) });
  }
  return out;
}

// Distribuição atual dos cards por status (donut da maturidade).
export function maturityDistribution(cards) {
  const dist = { new: 0, learning: 0, review: 0, mature: 0, suspended: 0 };
  (cards || []).forEach((c) => {
    if (c.suspended) { dist.suspended++; return; }
    if (dist[c.status] !== undefined) dist[c.status]++;
  });
  return dist;
}

// Forecast de cards vencendo nos próximos `days` dias (a partir de amanhã).
export function forecastByDay(cards, days = 30) {
  const startTomorrow = addLocalDays(1);
  const tomorrowKey = localDateKey(startTomorrow);
  const out = Array.from({ length: days }, (_, i) => ({
    date: localDateKey(addLocalDays(i + 1)),
    count: 0,
  }));
  const indexByKey = {};
  out.forEach((o, i) => { indexByKey[o.date] = i; });
  (cards || []).forEach((c) => {
    if (c.suspended || !c.due_date) return;
    const key = localDateKey(c.due_date);
    if (key < tomorrowKey) return; // já vencido: não entra no forecast futuro
    const idx = indexByKey[key];
    if (idx !== undefined) out[idx].count++;
  });
  return out;
}

// Resumo agregado (cards totais, tempo total, sequência de estudo, etc.)
export function summarize(cards, sessions, reviewLog) {
  const totalSeconds = (sessions || []).reduce((a, s) => a + (s.seconds || 0), 0);
  const totalReviews = (reviewLog || []).length;
  const hits = (reviewLog || []).filter((r) => r.quality >= 2).length;
  return {
    totalCards: (cards || []).length,
    totalMinutes: Math.round(totalSeconds / 60),
    totalReviews,
    overallRetention: totalReviews ? Math.round((hits / totalReviews) * 100) : null,
  };
}
