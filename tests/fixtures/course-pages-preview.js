// Páginas do curso (loja, meus cursos, detalhe, cadernos, análise, ranking) com serviços simulados.
// Query: empty (tudo vazio), fail (primeira leitura de cada caderno/ranking/análise falha).
import { db } from '../../utils/db.js';
import { renderCourses } from '../../dashboard/js/ui/coursesView.js';
import { courseHashFor, parseRouteHash } from '../../dashboard/js/core/routeHash.js';

const query = new URLSearchParams(location.search);
const empty = query.has('empty');
const failOnce = new Set(query.has('fail') ? ['mistakes', 'vocab', 'notes', 'leaderboard', 'analysis'] : []);
const state = { navigations: [], toasts: [], calls: [], removed: [], deleted: [], savedNotes: [], periods: [] };
window.__pages = state;

const lessons = (prefix, level, count, done = 0) => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}-${i + 1}`, chapter_number: i + 1, title: `${prefix} aula ${i + 1}`, level, unit_count: 8,
  curriculum_order: i + 1, module_title: 'Módulo único', lesson_role: 'base', my_best_answered: i < done ? 8 : 0,
}));
const catalog = [
  { id: 'c-greet', title: 'Cumprimentos A1', short_description: 'Primeiras conversas', long_description: 'Cumprimentar e se apresentar.', level: 'A1', track: 'fundamentos', category: 'foundations', learners_count: 50, created_at: '2026-01-01', my: { in_my_courses: true, percent_completed: 50, completed_lessons: ['greet-1'] }, lessons: lessons('greet', 'A1', 2, 1) },
  { id: 'c-food', title: 'Comida A2', short_description: 'Pedir comida', long_description: '', level: 'A2', track: 'dia-a-dia', category: 'vocabulary', learners_count: 90, created_at: '2026-02-01', my: { in_my_courses: false, percent_completed: 0, completed_lessons: [] }, lessons: lessons('food', 'A2', 2) },
  { id: 'c-done', title: 'Verbos B1 concluído', short_description: 'Verbos', long_description: '', level: 'B1', track: 'gramatica', category: 'grammar', learners_count: 10, created_at: '2026-03-01', my: { in_my_courses: true, percent_completed: 100, completed_lessons: ['done-1'] }, lessons: lessons('done', 'B1', 1, 1) },
];
const path = { current_level: 'A1', next: { level: 'A1', course_id: 'c-greet', lesson_id: 'greet-2' }, levels: [
  { level: 'A1', total: 2, completed: 1, percent: 50 }, { level: 'A2', total: 2, completed: 0, percent: 0 }, { level: 'B1', total: 1, completed: 1, percent: 100, is_completed: true },
] };
const unit = (id, text, pt) => ({ text, translation_pt: pt, ipa: '', explanation_note: '', kind: 'sentence', lesson_id: 'greet-1', course_lessons: { title: 'greet aula 1', course_catalog: { title: 'Cumprimentos A1' } } });
const gate = key => { if (failOnce.delete(key)) throw Object.assign(new Error('offline'), { kind: 'network' }); };

db.courses = {
  async listCatalog() { return empty ? [] : catalog; },
  async getHubSummary() { return empty ? {} : { reviews_due_count: 3, mistakes_count: 2, today_seconds: 600, week_days: 2, week: [] }; },
  async getPath() { return empty ? { levels: [], next: null } : path; },
  async setInMyCourses(id, value) { state.calls.push(['setInMyCourses', id, value]); const c = catalog.find(x => x.id === id); c.my = { ...c.my, in_my_courses: value }; },
  async listReviews() { return []; },
  async listMistakes() {
    gate('mistakes');
    return empty ? [] : [
      { unit_id: 'm1', wrong_text_submitted: 'I is here', mistake_count: 2, is_resolved: false, last_practiced_at: '2026-10-06T12:00:00Z', course_units: unit('m1', 'I am here.', 'Estou aqui.') },
      { unit_id: 'm2', wrong_text_submitted: 'You is late', mistake_count: 1, is_resolved: true, last_practiced_at: '2026-10-05T12:00:00Z', course_units: unit('m2', 'You are late.', 'Você está atrasado.') },
    ];
  },
  async listVocabulary() {
    gate('vocab');
    return empty ? [] : [{ unit_id: 'v1', created_at: '2026-10-06T12:00:00Z', course_units: { ...unit('v1', 'Good morning.', 'Bom dia.'), kind: 'sentence' } }];
  },
  async removeVocabulary(id) { state.removed.push(id); },
  async listNotes() {
    gate('notes');
    return empty ? [] : [{ unit_id: 'n1', note_content: 'Lembrar do plural', updated_at: '2026-10-06T12:00:00Z', course_units: unit('n1', 'Two keys.', 'Duas chaves.') }];
  },
  async saveNote(id, text) { state.savedNotes.push([id, text]); },
  async deleteNote(id) { state.deleted.push(id); },
  async getLeaderboard(period) {
    gate('leaderboard'); state.periods.push(period);
    if (empty) return { top: [], total_ranked: 0 };
    return { top: Array.from({ length: 25 }, (_, i) => ({ position: i + 1, username: `aluno${i + 1}`, seconds: 3600 - i * 60, is_current_user: i === 1 })), me: { position: 2, seconds: 3540 }, total_ranked: 25, since: '2026-10-05', updated_at: '2026-10-07T00:00:00Z' };
  },
  async getAnalysis() {
    gate('analysis');
    return empty
      ? { kpis: {}, daily: [], history: [], courses: [], heatmap: [], bests: {}, content: {} }
      : { kpis: { active_seconds: 3600, sessions: 4, accuracy: 80, words: 40 }, previous: null, bests: {}, content: { words_encountered: 12, courses_studied: 1, chapters_completed: 1 }, heatmap: [], daily: [{ date: '2026-10-06', active_seconds: 600, sessions: 1, accuracy: 90 }], history: [], courses: [] };
  },
};
const app = {
  onLeaveView() {},
  navigate: (route, params) => state.navigations.push({ route, params }),
  showToast: (message, type) => state.toasts.push({ message, type }),
  syncCourseHash: params => history.pushState(null, '', `#${courseHashFor(params)}`),
};
const render = () => renderCourses(document.getElementById('panel'), app, location.hash ? parseRouteHash(location.hash).params : {});
window.addEventListener('popstate', render);
await render();
document.documentElement.dataset.ready = 'true';
