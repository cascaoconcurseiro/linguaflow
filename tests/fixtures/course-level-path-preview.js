import { db } from '../../utils/db.js';
import { renderCourses } from '../../dashboard/js/ui/coursesView.js';
import { courseHashFor, parseRouteHash } from '../../dashboard/js/core/routeHash.js';
const navigations = [];
const catalog = [{ id: 'mixed', title: 'Curso misto', level: 'A2', my: { in_my_courses: true, completed_lessons: ['a1', 'lesson-pedagogy-a1-greet'], percent_completed: 50 }, lessons: [
  { id: 'lesson-pedagogy-a1-greet', chapter_number: 0, title: 'Cumprimentos', level: 'A1', curriculum_order: 5, module_order: 1, module_title: 'Primeiros contatos', lesson_stage: 'introduction', unit_count: 8, my_best_answered: 8 },
  { id: 'a1', chapter_number: 1, title: 'Eu sou, você é', level: 'A1', curriculum_order: 10, module_order: 2, module_title: 'Apresentação', lesson_stage: 'practice', prerequisite_titles: [], unit_count: 8, my_best_answered: 8 },
  { id: 'new-a1', chapter_number: 2, title: 'Nova prática A1', level: 'A1', curriculum_order: 20, module_order: 2, module_title: 'Apresentação', unit_count: 8 },
  { id: 'a2', chapter_number: 3, title: 'Rotina A2', level: 'A2', curriculum_order: 30, module_order: 1, module_title: 'Rotinas', lesson_stage: 'application', prerequisite_titles: ['Eu sou, você é'], unit_count: 8 },
] }];
const path = { current_level: 'A2', next: { level: 'A2', course_id: 'mixed', lesson_id: 'a2' }, levels: [
  { level: 'A1', total: 3, completed: 2, percent: 67, is_completed: true, new_lessons: 1, completion: { total: 1, completed_at: '2026-10-06T12:00:00Z' } },
  { level: 'A2', total: 1, completed: 0, percent: 0 },
  { level: 'B1', total: 1, completed: 0, percent: 0, skipped: true },
] };
if (location.search.includes('empty')) catalog[0].my.in_my_courses = false;
let offline = location.search.includes('offline');
db.courses = { listCatalog: async () => catalog, getHubSummary: async () => ({}), getPath: async () => {
  if (offline) { offline = false; throw Error('offline'); } return path;
} };
const app = {
  navigate: (route, params) => navigations.push({ route, params }), onLeaveView() {},
  syncCourseHash: params => history.pushState(null, '', `#${courseHashFor(params)}`),
};
window.__preview = { navigations };
const render = () => renderCourses(document.getElementById('panel'), app, location.hash ? parseRouteHash(location.hash).params : location.search.includes('mine') ? { tab: 'my-courses' } : {});
window.addEventListener('popstate', render);
await render();
document.documentElement.dataset.ready = 'true';
