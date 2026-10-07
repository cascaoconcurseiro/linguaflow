// Hash das rotas: "#rota" e, em Cursos, "#courses/<seção>" ou "#courses/course/<id>".
// Recarregar e voltar/avançar restauram a seção; valores desconhecidos são descartados.

const COURSE_TABS = new Set(['my-courses', 'store', 'analysis', 'review', 'mistakes', 'vocabulary', 'notes', 'leaderboard']);
const COURSE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const COURSE_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);

export function courseHashFor(params = {}) {
  if (params.tab === 'course' && COURSE_ID.test(params.courseId || '')) return `courses/course/${params.courseId}`;
  if (params.tab === 'level' && COURSE_LEVELS.has(params.level)) return `courses/level/${params.level}`;
  return COURSE_TABS.has(params.tab) ? `courses/${params.tab}` : 'courses';
}

export function parseRouteHash(hash) {
  const [route = '', sub, id] = String(hash || '').replace(/^#/, '').split('/');
  if (route !== 'courses') return { route, params: {} };
  if (sub === 'course') return COURSE_ID.test(id || '') ? { route, params: { tab: 'course', courseId: id } } : { route, params: {} };
  if (sub === 'level') return COURSE_LEVELS.has(id) ? { route, params: { tab: 'level', level: id } } : { route, params: {} };
  return { route, params: COURSE_TABS.has(sub) ? { tab: sub } : {} };
}
