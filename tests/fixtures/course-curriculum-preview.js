// Prévia offline da recomendação A2 em curso misto (#528); nenhum dado de conta real.
import { renderCourseHome } from '../../dashboard/js/ui/courses/courseHome.js';
const lesson = { id: 'a2-first', title: 'Presente simples e contínuo', level: 'A2', chapter_number: 1, unit_count: 10 };
const course = { id: 'mixed', title: 'Tempos verbais', level: 'B2', level_min: 'A2', level_max: 'B2', lessons: [lesson], is_core: true };
const navigations = [];
window.__preview = { navigations };
const app = { navigate: (route, params) => navigations.push({ route, params }) };
renderCourseHome(document.getElementById('panel'), { app, catalog: [course], summary: {}, navigate() {},
  path: { current_level: 'A2', placement_level: 'A2', next: { lesson_id: lesson.id, level: 'A2' },
    levels: [{ level: 'A2', total: 87, completed: 0, percent: 0 }] } });
document.documentElement.dataset.ready = 'true';
