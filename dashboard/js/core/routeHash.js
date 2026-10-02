// Hash das rotas: "#rota" e, em Cursos, "#courses/<seção>" ou "#courses/course/<id>".
// Recarregar e voltar/avançar restauram a seção; valores desconhecidos são descartados.

const COURSE_TABS = new Set(['my-courses', 'store', 'analysis', 'review', 'mistakes', 'vocabulary', 'notes', 'leaderboard']);
const COURSE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function courseHashFor(params = {}) {
  if (params.tab === 'course' && COURSE_ID.test(params.courseId || '')) return `courses/course/${params.courseId}`;
  return COURSE_TABS.has(params.tab) ? `courses/${params.tab}` : 'courses';
}

export function parseRouteHash(hash) {
  const [route = '', sub, id] = String(hash || '').replace(/^#/, '').split('/');
  if (route !== 'courses') return { route, params: {} };
  if (sub === 'course') return COURSE_ID.test(id || '') ? { route, params: { tab: 'course', courseId: id } } : { route, params: {} };
  return { route, params: COURSE_TABS.has(sub) ? { tab: sub } : {} };
}
