// dashboard/js/ui/coursesView.js
// Hub de Cursos: catálogo (só cursos com frases publicadas), Caderno de Erros,
// Revisões vencidas e Vocabulário salvo. Tudo vem do banco; sem dados de
// demonstração.

import { db } from '../../../utils/db.js';
import { escapeHTML } from '../../../utils/html.js';
import { openCoursePrepareModal } from './coursePrepareModal.js';
import { renderMistakesNotebook, renderReviewsNotebook, renderVocabularyNotebook } from './courseNotebooksView.js';
import { flushPendingCourseCommit } from './coursePracticeView.js';

const TABS = [
  { id: 'catalog', label: 'Cursos' },
  { id: 'mistakes', label: 'Caderno de erros', badge: 'mistakes_count' },
  { id: 'reviews', label: 'Revisões', badge: 'reviews_due_count' },
  { id: 'vocabulary', label: 'Vocabulário salvo' },
];

export async function renderCourses(container, app, params = {}) {
  let activeTab = TABS.some((t) => t.id === params.tab) ? params.tab : 'catalog';
  let catalog = null;
  let catalogError = null;
  let summary = { mistakes_count: 0, reviews_due_count: 0, active_course: null, enrollments: [] };
  let disposed = false;
  app.onLeaveView?.(() => { disposed = true; });

  container.innerHTML = `
    <div class="course-hub-container" aria-busy="true">
      <header class="course-hub-header">
        <h1 class="course-hub-title">Cursos</h1>
        <p class="course-hub-subtitle" role="status">Carregando cursos…</p>
      </header>
    </div>`;

  // Resultado que ficou pendente (rede caiu no fim da lição) é reenviado antes
  // de ler o resumo, para o progresso aparecer atualizado.
  try {
    await flushPendingCourseCommit();
  } catch (err) {
    console.warn('[Courses] pending_commit_retry_failed', err?.kind || err?.message);
  }

  const [catalogResult, summaryResult] = await Promise.allSettled([
    db.courses.listCatalog(),
    db.courses.getHubSummary(),
  ]);
  if (disposed) return;
  if (catalogResult.status === 'fulfilled') catalog = catalogResult.value;
  else catalogError = catalogResult.reason;
  if (summaryResult.status === 'fulfilled' && summaryResult.value) summary = { ...summary, ...summaryResult.value };
  else if (summaryResult.status === 'rejected') console.warn('[Courses] hub_summary_failed', summaryResult.reason?.kind || summaryResult.reason?.message);

  const progressFor = (courseId) => (summary.enrollments || []).find((e) => e.course_id === courseId) || null;

  function render() {
    container.innerHTML = `
      <div class="course-hub-container">
        <header class="course-hub-header">
          <div class="course-hub-header-top">
            <div>
              <h1 class="course-hub-title">Cursos</h1>
              <p class="course-hub-subtitle">Ouça frases do inglês do dia a dia e escreva o que ouviu, palavra por palavra.</p>
            </div>
          </div>
          <nav class="course-subnav" aria-label="Seções dos cursos" role="tablist">
            ${TABS.map((tab) => {
              const count = tab.badge ? Number(summary[tab.badge] || 0) : 0;
              return `<button class="course-tab-btn ${activeTab === tab.id ? 'active' : ''}" type="button" role="tab"
                aria-selected="${activeTab === tab.id}" aria-controls="course-hub-panel" data-tab="${tab.id}">
                ${tab.label}${count > 0 ? ` <span class="course-tab-badge" aria-label="${count} pendentes">${count}</span>` : ''}
              </button>`;
            }).join('')}
          </nav>
        </header>
        <div id="course-hub-panel" role="tabpanel"></div>
      </div>`;

    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
        container.querySelector(`[data-tab="${activeTab}"]`)?.focus();
      });
    });

    const panel = container.querySelector('#course-hub-panel');
    if (activeTab === 'catalog') renderCatalog(panel);
    else if (activeTab === 'mistakes') renderMistakesNotebook(panel, app, startLesson);
    else if (activeTab === 'reviews') renderReviewsNotebook(panel, app, startLesson);
    else renderVocabularyNotebook(panel, app);
  }

  function findLesson(lessonId) {
    for (const course of catalog || []) {
      const lesson = course.lessons.find((l) => l.id === lessonId);
      if (lesson) return { course, lesson };
    }
    return null;
  }

  function startLesson(lessonId) {
    const found = findLesson(lessonId);
    if (!found) {
      app.showToast?.('Esta lição não está mais disponível.', 'error');
      return;
    }
    openCoursePrepareModal({
      course: found.course,
      lesson: found.lesson,
      onStart: (difficulty) => app.navigate('course-practice', { lessonId, difficulty }),
    });
  }

  function renderCatalog(panel) {
    if (catalogError) {
      panel.innerHTML = `
        <div class="course-empty-state" role="alert">
          <h2 class="course-empty-title">Não foi possível carregar os cursos</h2>
          <p class="course-empty-subtitle">Verifique a conexão e tente de novo.</p>
          <button class="course-btn-primary-lg" type="button" data-action="retry">Tentar de novo</button>
        </div>`;
      panel.querySelector('[data-action="retry"]').addEventListener('click', () => renderCourses(container, app, { tab: 'catalog' }));
      return;
    }
    if (!catalog || catalog.length === 0) {
      panel.innerHTML = `
        <div class="course-empty-state">
          <h2 class="course-empty-title">Nenhum curso publicado ainda</h2>
          <p class="course-empty-subtitle">Os cursos aparecem aqui assim que tiverem frases prontas para praticar.</p>
        </div>`;
      return;
    }

    panel.innerHTML = `
      <section class="course-catalog-grid" aria-label="Cursos disponíveis">
        ${catalog.map((course) => {
          const progress = progressFor(course.id);
          const done = new Set(progress?.completed_lessons || []);
          const nextLesson = course.lessons.find((l) => !done.has(l.id)) || course.lessons[0];
          const percent = Number(progress?.percent_completed || 0);
          const totalUnits = course.lessons.reduce((acc, l) => acc + l.unit_count, 0);
          return `
            <article class="course-card" aria-labelledby="title-${escapeHTML(course.id)}">
              <div class="course-card-top">
                <div class="course-card-badges">
                  <span class="course-level-pill ${escapeHTML(course.level.toLowerCase())}">Nível ${escapeHTML(course.level)}</span>
                  <span class="course-card-stats">${course.lessons.length} ${course.lessons.length === 1 ? 'lição' : 'lições'} · ${totalUnits} frases</span>
                </div>
                <h2 id="title-${escapeHTML(course.id)}" class="course-card-title">${escapeHTML(course.title)}</h2>
                <p class="course-card-desc">${escapeHTML(course.short_description)}</p>
                ${progress ? `
                  <div class="course-hero-progress-track" role="progressbar" aria-label="Progresso no curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
                    <div class="course-hero-progress-bar" style="width:${percent}%;"></div>
                  </div>
                  <p class="course-card-stats" style="margin:4px 0 0;">${percent.toFixed(0)}% concluído</p>` : ''}
              </div>
              <ol class="course-notebook-list" style="margin:0;padding:0;list-style:none;" aria-label="Lições de ${escapeHTML(course.title)}">
                ${course.lessons.map((lesson) => `
                  <li class="course-notebook-item">
                    <div class="course-notebook-item-info">
                      <strong>${lesson.chapter_number}. ${escapeHTML(lesson.title)}</strong>
                      <span class="course-card-stats">${lesson.unit_count} frases${done.has(lesson.id) ? ' · concluída' : ''}</span>
                    </div>
                    <button class="course-btn-continue" type="button" data-start-lesson="${escapeHTML(lesson.id)}">
                      ${done.has(lesson.id) ? 'Praticar de novo' : (lesson.id === nextLesson.id ? 'Começar' : 'Praticar')}
                    </button>
                  </li>`).join('')}
              </ol>
            </article>`;
        }).join('')}
      </section>`;

    panel.querySelectorAll('[data-start-lesson]').forEach((btn) => {
      btn.addEventListener('click', () => startLesson(btn.dataset.startLesson));
    });
  }

  render();
}
