// tests/fixtures/course-review-preview.js — Prévia offline da aba Revisão dos cursos (#501): banco simulado por cenário (?scenario=), nunca usa conta real.
import { db } from '../../utils/db.js';
import { renderReviewNotebook } from '../../dashboard/js/ui/courses/courseNotebooks.js';

const scenario = new URLSearchParams(location.search).get('scenario') || 'cap';
const DAY = 86_400_000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

// Frases vencidas, da mais antiga para a mais recente (a mesma ordem de listReviews).
const dueRows = (n) => Array.from({ length: n }, (_, i) => ({
  unit_id: `u${i + 1}`, due_date: iso(-(n - i) * 3_600_000 - DAY), interval_days: 1, repetition_number: 1,
  course_units: { text: `Sentence ${i + 1} <b>x</b>`, translation_pt: `Frase ${i + 1}`, lesson_id: 'l1', course_lessons: { title: 'Aula', course_catalog: { title: 'Curso' } } },
}));

const hub = (total, today, done, overdue = 0) => ({
  reviews_due_count: total, reviews_due_total: total, reviews_daily_cap: 20,
  reviews_done_today: done, reviews_due_today: today, reviews_overdue_7d: overdue,
});

const scenarios = {
  cap: { rows: dueRows(30), summary: hub(30, 20, 0) },
  partial: { rows: dueRows(30), summary: hub(30, 8, 12) },
  goaldone: { rows: dueRows(30), summary: hub(30, 0, 20) },
  overdue: { rows: dueRows(30), summary: hub(30, 20, 0, 4) },
  legacy: { rows: dueRows(12), summary: { reviews_due_count: 12 } },
  nosummary: { rows: dueRows(12), summary: null },
  empty: { rows: [], summary: hub(0, 0, 0) },
  error: { error: true },
};
const s = scenarios[scenario] || scenarios.cap;

const navigations = [];
db.courses = {
  async listReviews() { if (s.error) throw new Error('offline'); return s.rows; },
  async getHubSummary() { if (!s.summary) throw new Error('offline'); return s.summary; },
};
window.__preview = { navigations, db };
// startNotebookPractice abre um modal de dificuldade; a prévia só registra o pedido de navegação.
const app = { navigate: (route, params) => navigations.push({ route, params: params || null }) };
await renderReviewNotebook(document.getElementById('panel'), { app });
document.documentElement.dataset.ready = 'true';
