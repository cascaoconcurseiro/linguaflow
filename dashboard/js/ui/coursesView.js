// dashboard/js/ui/coursesView.js
// Área de Cursos: navegação própria (Início, Meus cursos, Loja, cadernos,
// Análise, Ranking) e a página de cada curso. Dados vindos do banco; sem
// conteúdo de demonstração.

import { db } from '../../../utils/db.js';
import { flushPendingCourseCommit } from './coursePracticeView.js';
import { renderCourseHome } from './courses/courseHome.js';
import { renderCourseStore, renderMyCourses, renderCourseDetail } from './courses/courseStore.js';
import { renderReviewNotebook, renderMistakesNotebook, renderVocabularyNotebook, renderNotesNotebook } from './courses/courseNotebooks.js';
import { renderCourseAnalysis } from './courses/courseAnalysis.js';
import { renderCourseLeaderboard } from './courses/courseLeaderboard.js';
import { renderLoadError } from './courses/courseUi.js';

export const COURSE_SECTIONS = [
  { id: 'home', label: 'Início', group: 'learn' },
  { id: 'my-courses', label: 'Meus cursos', group: 'learn' },
  { id: 'store', label: 'Loja de cursos', group: 'learn' },
  { id: 'analysis', label: 'Análise', group: 'learn' },
  { id: 'review', label: 'Revisão', group: 'notebooks', badge: 'reviews_due_count' },
  { id: 'mistakes', label: 'Erros', group: 'notebooks', badge: 'mistakes_count' },
  { id: 'vocabulary', label: 'Vocabulário', group: 'notebooks' },
  { id: 'notes', label: 'Notas', group: 'notebooks' },
  { id: 'leaderboard', label: 'Ranking', group: 'notebooks' },
];

// Filtros e abas de cada seção sobrevivem à ida e volta do player.
const sessionState = {};

export async function renderCourses(container, app, params = {}) {
  let section = COURSE_SECTIONS.some((s) => s.id === params.tab) || params.tab === 'course' ? params.tab : 'home';
  let courseId = params.courseId || null;
  let disposed = false;
  app.onLeaveView?.(() => { disposed = true; });

  container.innerHTML = `
    <div class="course-area" aria-busy="true">
      <p class="course-hub-subtitle" role="status">Carregando cursos…</p>
    </div>`;

  // Resultado pendente (rede caiu no fim da lição) é reenviado antes de ler o
  // resumo, para o progresso aparecer atualizado.
  try {
    await flushPendingCourseCommit();
  } catch (err) {
    console.warn('[Courses] pending_commit_retry_failed', err?.kind || err?.message);
  }

  let catalog = [];
  let summary = {};
  let path = null;
  async function loadData() {
    const [catalogResult, summaryResult, pathResult] = await Promise.allSettled([
      db.courses.listCatalog(), db.courses.getHubSummary(), db.courses.getPath(),
    ]);
    if (catalogResult.status === 'rejected') throw catalogResult.reason;
    catalog = catalogResult.value;
    if (summaryResult.status === 'fulfilled' && summaryResult.value) summary = summaryResult.value;
    else console.warn('[Courses] hub_summary_failed', summaryResult.reason?.kind || summaryResult.reason?.message);
    if (pathResult.status === 'fulfilled') path = pathResult.value;
    else console.warn('[Courses] path_failed', pathResult.reason?.kind || pathResult.reason?.message);
  }

  try {
    await loadData();
  } catch (err) {
    if (disposed) return;
    console.warn('[Courses] catalog_failed', err?.kind || err?.message);
    renderLoadError(container, () => renderCourses(container, app, params), 'Não foi possível carregar os cursos. Verifique a conexão e tente de novo.');
    return;
  }
  if (disposed) return;

  const ctx = {
    app,
    state: sessionState,
    get catalog() { return catalog; },
    get summary() { return summary; },
    get path() { return path; },
    navigate: (target, extra = {}) => {
      section = target;
      courseId = extra.courseId || null;
      app.syncCourseHash?.({ tab: target, courseId });
      renderShell(extra);
      container.querySelector('#course-area-panel')?.focus({ preventScroll: true });
    },
    refresh: async () => {
      await loadData();
      if (!disposed) renderShell();
    },
  };

  function renderShell(extra = {}) {
    const navId = section === 'course' ? 'store' : section;
    const item = (s) => {
      const count = s.badge ? Number(summary[s.badge] || 0) : 0;
      return `<li><button type="button" class="course-side-link ${navId === s.id ? 'active' : ''}" data-section="${s.id}"
        ${navId === s.id ? 'aria-current="page"' : ''}>${s.label}${count > 0 ? ` <span class="course-tab-badge" aria-label="${count} pendentes">${count}</span>` : ''}</button></li>`;
    };
    container.innerHTML = `
      <div class="course-area">
        <nav class="course-side" aria-label="Seções de Cursos">
          <p class="course-side-group">Aprender</p>
          <ul>${COURSE_SECTIONS.filter((s) => s.group === 'learn').map(item).join('')}</ul>
          <p class="course-side-group">Revisar</p>
          <ul>${COURSE_SECTIONS.filter((s) => s.group === 'notebooks').map(item).join('')}</ul>
        </nav>
        <section class="course-area-main" aria-labelledby="course-area-title">
          <h1 id="course-area-title" class="course-hub-title">${section === 'course' ? 'Curso' : COURSE_SECTIONS.find((s) => s.id === section)?.label}</h1>
          <div id="course-area-panel" tabindex="-1"></div>
        </section>
      </div>`;
    container.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => ctx.navigate(b.dataset.section)));

    const panel = container.querySelector('#course-area-panel');
    const renderers = {
      home: () => renderCourseHome(panel, ctx),
      'my-courses': () => renderMyCourses(panel, ctx),
      store: () => renderCourseStore(panel, ctx),
      course: () => renderCourseDetail(panel, ctx, courseId, extra.openLessonId || null),
      review: () => renderReviewNotebook(panel, ctx),
      mistakes: () => renderMistakesNotebook(panel, ctx),
      vocabulary: () => renderVocabularyNotebook(panel, ctx),
      notes: () => renderNotesNotebook(panel, ctx),
      analysis: () => renderCourseAnalysis(panel, ctx),
      leaderboard: () => renderCourseLeaderboard(panel, ctx),
    };
    (renderers[section] || renderers.home)();
  }

  renderShell({ openLessonId: params.openLessonId || null });
}
