// tests/fixtures/today-plan-preview.js — Prévia offline do Início com o Plano de hoje (#495): banco simulado por cenário (?scenario=), nunca usa conta real.
import { renderHome } from '../../dashboard/js/ui/homeView.js';

const scenario = new URLSearchParams(location.search).get('scenario') || 'backlog';
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 86_400_000;

const dueReviews = (n, learning = 0) => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, word_id: `w${i}`, status: i < learning ? 'learning' : 'review', due_date: iso(-DAY), suspended: false,
}));
const heldWords = Array.from({ length: 3 }, (_, i) => ({ id: `h${i}`, word: `held${i}`, tags: ['lf:espera-fila'] }));
const heldCards = heldWords.map((w, i) => ({ id: `hc${i}`, word_id: w.id, status: 'new', suspended: true, due_date: iso(-DAY) }));

const scenarios = {
  backlog: { cards: dueReviews(80, 6), words: [], courseReviews: 6, today: 0 },
  done: { cards: [], words: [{ id: 'w0', word: 'hello', tags: [] }], courseReviews: 0, today: 900, reviewsToday: 12 },
  flagoff: { cards: dueReviews(10), words: [], courseReviews: 2, today: 0, planSetting: 'off' },
  held: { cards: dueReviews(70), words: heldWords, extraCards: heldCards, courseReviews: 0, today: 0 },
  courseerror: { cards: dueReviews(5), words: [], courseError: true, today: 0 },
};
const s = scenarios[scenario] || scenarios.backlog;

const catalog = [{
  id: 'c1', title: 'Inglês das Ruas', level: 'A1', my: { in_my_courses: true, completed_lessons: [] },
  lessons: [{ id: 'l1', chapter_number: 3, title: 'Cumprimentos <b>reais</b>', unit_count: 10, my_best_answered: 3 }],
}];
const summary = { continue: { course_id: 'c1', lesson_id: 'l1' }, reviews_due_count: s.courseReviews || 0, mistakes_count: 0, today_seconds: s.today || 0 };

const events = [];
const navigations = [];
const settings = { onboarding_v1: JSON.stringify({ version: 1, completed: true, level: 'beginner', dailyGoal: 20 }), lf_today_plan: s.planSetting || null };
const reviewLog = Array.from({ length: s.reviewsToday || 0 }, (_, i) => ({ card_id: `c${i}`, ts: new Date().toISOString(), quality: 3 }));

const cards = [...s.cards, ...(s.extraCards || [])];
const db = {
  async getStats() {
    const due = s.cards.filter((c) => !c.suspended);
    return { totalWords: Math.max(1, s.words.length), dueCards: due.length, dueLearning: due.filter((c) => c.status === 'learning').length, sessions: [], byStatus: {}, userStats: { streak: 0, xp_today: 0 }, reviewLog };
  },
  async getSetting(key) { return settings[key] ?? null; },
  async setSetting(key, value) { settings[key] = value; },
  async getAllWords() { return s.words; },
  async getAllCards() { return cards; },
  async getAllKnownWords() { return []; },
  async getStories() { return []; },
  async setCardSuspended() {},
  async addTagsToWord() {},
  async logUsageEvent(event) { events.push(event); },
  courses: {
    async listCatalog() { if (s.courseError) throw new Error('offline'); return catalog; },
    async getHubSummary() { return summary; },
  },
};
window.__preview = { events, navigations, settings };
const app = { db, renderSignal: new AbortController().signal, navigate: (route, params) => navigations.push({ route, params: params || null }), showToast() {} };
await renderHome(document.getElementById('app-root'), app);
document.documentElement.dataset.ready = 'true';
