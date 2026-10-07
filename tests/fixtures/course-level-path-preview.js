import { renderCourseHome } from '../../dashboard/js/ui/courses/courseHome.js';
import { renderMyCourses } from '../../dashboard/js/ui/courses/courseStore.js';
const navigations = [];
const catalog = [{ id: 'mixed', title: 'Curso misto', level: 'A2', my: { in_my_courses: true, completed_lessons: ['a1'], percent_completed: 50 }, lessons: [
  { id: 'a1', chapter_number: 1, title: 'Eu sou, você é', level: 'A1', curriculum_order: 10, module_title: 'Apresentação', unit_count: 8, my_best_answered: 8 },
  { id: 'new-a1', chapter_number: 2, title: 'Nova prática A1', level: 'A1', curriculum_order: 20, module_title: 'Apresentação', unit_count: 8 },
  { id: 'a2', chapter_number: 3, title: 'Rotina A2', level: 'A2', curriculum_order: 30, module_title: 'Rotinas', unit_count: 8 },
] }];
const path = { current_level: 'A2', next: { level: 'A2', course_id: 'mixed', lesson_id: 'a2' }, levels: [
  { level: 'A1', total: 2, completed: 1, percent: 50, is_completed: true, new_lessons: 1, completion: { total: 1, completed_at: '2026-10-06T12:00:00Z' } },
  { level: 'A2', total: 1, completed: 0, percent: 0 },
  { level: 'B1', total: 1, completed: 0, percent: 0, skipped: true },
] };
const ctx = { catalog, path, summary: {}, state: {}, app: { navigate: (route, params) => navigations.push({ route, params }) }, navigate: (target, extra = {}) => {
  if (extra.level) { ctx.state.pathLevel = extra.level; ctx.state.pathCurrentLevel = path.current_level; }
  renderCourseHome(document.getElementById('panel'), ctx);
} };
if (location.search.includes('empty')) catalog[0].my.in_my_courses = false;
if (location.search.includes('offline')) ctx.path = null;
ctx.refresh = async () => { ctx.path = path; renderCourseHome(document.getElementById('panel'), ctx); };
window.__preview = { navigations };
(location.search.includes('mine') ? renderMyCourses : renderCourseHome)(document.getElementById('panel'), ctx);
document.documentElement.dataset.ready = 'true';
