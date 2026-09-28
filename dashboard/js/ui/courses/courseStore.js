// Loja, Meus cursos e página do curso (capítulos).

import { db } from '../../../../utils/db.js';
import { escapeHTML } from '../../../../utils/html.js';
import { CATEGORY_LABEL, TRACKS, TRACK_LABEL, byPathOrder, levelPill, lessonProgress, continueLessonOf, startLesson, renderEmpty, plural, unitCount } from './courseUi.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const SORTS = { recommended: 'Recomendados', popular: 'Mais alunos', newest: 'Mais novos' };

function courseCard(course, { showToggle = true } = {}) {
  const inMine = Boolean(course.my?.in_my_courses);
  const percent = Number(course.my?.percent_completed || 0);
  const units = course.lessons.reduce((n, l) => n + l.unit_count, 0);
  return `
    <article class="course-card" aria-labelledby="t-${escapeHTML(course.id)}">
      <div class="course-card-top">
        <div class="course-card-badges">${levelPill(course.level)}
          <span class="course-card-stats">${escapeHTML(TRACK_LABEL[course.track] || CATEGORY_LABEL[course.category] || '')}</span></div>
        <h3 id="t-${escapeHTML(course.id)}" class="course-card-title">${escapeHTML(course.title)}</h3>
        <p class="course-card-desc">${escapeHTML(course.short_description)}</p>
        <p class="course-card-stats">${plural(course.lessons.length, 'capítulo', 'capítulos')} · ${unitCount(course, units)} · ${plural(course.learners_count, 'aluno', 'alunos')}</p>
        ${course.my ? `<div class="course-hero-progress-track" role="progressbar" aria-label="Progresso no curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="course-hero-progress-bar" style="width:${percent}%"></div></div>` : ''}
      </div>
      <div class="course-card-actions">
        <button class="course-btn-continue" type="button" data-open-course="${escapeHTML(course.id)}">${course.my ? 'Continuar' : 'Ver capítulos'}</button>
        ${showToggle ? `<button class="course-player-btn-back" type="button" data-toggle-mine="${escapeHTML(course.id)}" aria-pressed="${inMine}"
          aria-label="${inMine ? 'Remover de Meus cursos' : 'Adicionar a Meus cursos'}: ${escapeHTML(course.title)}">${inMine ? '✓ Em Meus cursos' : '+ Meus cursos'}</button>` : ''}
      </div>
    </article>`;
}

function bindCards(panel, { app, catalog, navigate, refresh }) {
  panel.querySelectorAll('[data-open-course]').forEach((b) => b.addEventListener('click', () => navigate('course', { courseId: b.dataset.openCourse })));
  panel.querySelectorAll('[data-toggle-mine]').forEach((b) => b.addEventListener('click', async () => {
    const course = catalog.find((c) => c.id === b.dataset.toggleMine);
    const next = !course.my?.in_my_courses;
    b.disabled = true;
    try {
      await db.courses.setInMyCourses(course.id, next);
      app.showToast?.(next ? 'Curso adicionado a Meus cursos.' : 'Curso removido de Meus cursos. O progresso continua salvo.', 'success');
      await refresh();
    } catch (err) {
      b.disabled = false;
      console.warn('[Courses] toggle_my_courses_failed', err?.kind || err?.message);
      app.showToast?.('Não foi possível atualizar agora. Tente de novo.', 'error');
    }
  }));
}

export function renderCourseStore(panel, ctx) {
  const { catalog, state } = ctx;
  const f = state.store || (state.store = { category: 'all', query: '', level: '', sort: 'recommended' });
  const tracks = TRACKS.filter(([t]) => catalog.some((c) => c.track === t));

  function filtered() {
    const q = f.query.trim().toLowerCase();
    const list = catalog.filter((c) => (f.category === 'all' || c.track === f.category)
      && (!f.level || c.level === f.level)
      && (!q || `${c.title} ${c.short_description} ${c.lessons.map((l) => l.title).join(' ')}`.toLowerCase().includes(q)));
    if (f.sort === 'recommended') list.sort(byPathOrder);
    if (f.sort === 'popular') list.sort((a, b) => b.learners_count - a.learners_count);
    else if (f.sort === 'newest') list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list;
  }

  panel.innerHTML = `
    <div class="course-filters">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Trilhas">
        <button type="button" role="tab" class="course-tab-btn ${f.category === 'all' ? 'active' : ''}" aria-selected="${f.category === 'all'}" data-category="all">Todas as trilhas</button>
        ${tracks.map(([t, label]) => `<button type="button" role="tab" class="course-tab-btn ${f.category === t ? 'active' : ''}" aria-selected="${f.category === t}" data-category="${t}">${label}</button>`).join('')}
      </div>
      <div class="course-filter-row">
        <label class="course-search"><span class="visually-hidden">Buscar cursos ou temas</span>
          <input type="search" id="course-search" placeholder="Buscar cursos ou temas" value="${escapeHTML(f.query)}" /></label>
        <label><span class="visually-hidden">Nível</span>
          <select id="course-level"><option value="">Todos os níveis</option>${LEVELS.map((l) => `<option ${f.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label><span class="visually-hidden">Ordenar</span>
          <select id="course-sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
    </div>
    <p class="course-hub-subtitle" id="course-store-count" role="status"></p>
    <div id="course-store-grid" class="course-store-groups"></div>`;

  const grid = panel.querySelector('#course-store-grid');
  const paint = () => {
    const list = filtered();
    panel.querySelector('#course-store-count').textContent = `${list.length} ${list.length === 1 ? 'curso' : 'cursos'}`;
    if (!list.length) grid.innerHTML = '<p class="course-hub-subtitle">Nenhum curso encontrado com esses filtros.</p>';
    else if (f.category === 'all' && f.sort === 'recommended' && !f.query) {
      grid.innerHTML = tracks.map(([t, label]) => {
        const items = list.filter((c) => c.track === t);
        return items.length ? `<section class="course-track-group" aria-labelledby="track-${t}"><h2 id="track-${t}" class="course-section-title">${label}</h2>
          <div class="course-catalog-grid">${items.map((c) => courseCard(c)).join('')}</div></section>` : '';
      }).join('');
    } else grid.innerHTML = `<div class="course-catalog-grid">${list.map((c) => courseCard(c)).join('')}</div>`;
    bindCards(grid, ctx);
  };
  panel.querySelectorAll('[data-category]').forEach((b) => b.addEventListener('click', () => { f.category = b.dataset.category; renderCourseStore(panel, ctx); }));
  panel.querySelector('#course-search').addEventListener('input', (e) => { f.query = e.target.value; paint(); });
  panel.querySelector('#course-level').addEventListener('change', (e) => { f.level = e.target.value; paint(); });
  panel.querySelector('#course-sort').addEventListener('change', (e) => { f.sort = e.target.value; paint(); });
  paint();
}

export function renderMyCourses(panel, ctx) {
  const { catalog, state, navigate } = ctx;
  const f = state.mine || (state.mine = { tab: 'all', query: '' });
  const mine = catalog.filter((c) => c.my?.in_my_courses);
  if (!mine.length) {
    renderEmpty(panel, 'Você ainda não tem cursos', 'Adicione cursos pela loja ou comece qualquer capítulo: ele entra aqui automaticamente.',
      { label: 'Abrir a loja', onClick: () => navigate('store') });
    return;
  }
  const status = (c) => {
    const p = Number(c.my?.percent_completed || 0);
    if (p >= 100) return 'done';
    return p > 0 || c.lessons.some((l) => l.my_best_answered > 0) ? 'progress' : 'new';
  };
  const TABS = { all: 'Todos', progress: 'Em andamento', new: 'Não iniciados', done: 'Concluídos' };
  const list = mine.filter((c) => (f.tab === 'all' || status(c) === f.tab)
    && (!f.query || c.title.toLowerCase().includes(f.query.toLowerCase())));

  panel.innerHTML = `
    <div class="course-filter-row">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Filtrar meus cursos">
        ${Object.entries(TABS).map(([k, v]) => `<button type="button" role="tab" class="course-tab-btn ${f.tab === k ? 'active' : ''}" aria-selected="${f.tab === k}" data-mine-tab="${k}">${v} <span class="course-tab-badge">${mine.filter((c) => k === 'all' || status(c) === k).length}</span></button>`).join('')}
      </div>
      <label class="course-search"><span class="visually-hidden">Buscar em meus cursos</span>
        <input type="search" id="course-mine-search" placeholder="Buscar em meus cursos" value="${escapeHTML(f.query)}" /></label>
    </div>
    <div class="course-catalog-grid">${list.map((c) => courseCard(c)).join('') || '<p class="course-hub-subtitle">Nenhum curso nesta aba.</p>'}</div>`;
  panel.querySelectorAll('[data-mine-tab]').forEach((b) => b.addEventListener('click', () => { f.tab = b.dataset.mineTab; renderMyCourses(panel, ctx); }));
  panel.querySelector('#course-mine-search').addEventListener('change', (e) => { f.query = e.target.value; renderMyCourses(panel, ctx); });
  bindCards(panel, ctx);
}

export function renderCourseDetail(panel, ctx, courseId, openLessonId = null) {
  const { app, catalog, navigate } = ctx;
  const course = catalog.find((c) => c.id === courseId);
  if (!course) {
    renderEmpty(panel, 'Curso não encontrado', 'Ele pode ter sido despublicado.', { label: 'Voltar à loja', onClick: () => navigate('store') });
    return;
  }
  const units = course.lessons.reduce((n, l) => n + l.unit_count, 0);
  const answered = course.lessons.reduce((n, l) => n + Math.min(l.unit_count, Number(l.my_best_answered || 0)), 0);
  const percent = Math.round((answered / Math.max(1, units)) * 100);
  const cont = continueLessonOf(course);
  const inMine = Boolean(course.my?.in_my_courses);

  panel.innerHTML = `
    <button class="course-link" type="button" data-back>← Loja de cursos</button>
    <header class="course-detail-head">
      <div>
        <div class="course-card-badges">${levelPill(course.level)} <span class="course-card-stats">${escapeHTML(TRACK_LABEL[course.track] || CATEGORY_LABEL[course.category] || '')}</span></div>
        <h2 class="course-hub-title">${escapeHTML(course.title)}</h2>
        <p class="course-hub-subtitle">${escapeHTML(course.long_description || course.short_description)}</p>
        <p class="course-card-stats">${plural(course.lessons.length, 'capítulo', 'capítulos')} · ${unitCount(course, units)} · ${plural(course.learners_count, 'aluno', 'alunos')} · tradução em português</p>
        <div class="course-hero-progress-track" role="progressbar" aria-label="Progresso no curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="course-hero-progress-bar" style="width:${percent}%"></div></div>
        <p class="course-card-stats">Progresso: ${answered} / ${unitCount(course, units)} · ${percent}%</p>
      </div>
      <div class="course-detail-actions">
        <button class="course-btn-primary-lg" type="button" data-continue>${answered > 0 ? 'Continuar' : 'Começar'}</button>
        <button class="course-player-btn-back" type="button" data-toggle-mine="${escapeHTML(course.id)}" aria-pressed="${inMine}">${inMine ? '✓ Em Meus cursos' : '+ Meus cursos'}</button>
      </div>
    </header>
    <h3 class="course-section-title">Capítulos</h3>
    <ol class="course-chapter-list">
      ${course.lessons.map((lesson) => {
        const { done, percent: lp } = lessonProgress(lesson, course);
        return `<li class="course-chapter ${done ? 'is-done' : ''}">
          <span class="course-chapter-num" aria-hidden="true">${String(lesson.chapter_number).padStart(2, '0')}</span>
          <div class="course-chapter-info">
            <strong>${escapeHTML(lesson.title)}${lesson.id === cont.id && !done ? ' <span class="course-tab-badge">Próximo</span>' : ''}</strong>
            <span class="course-card-stats">${unitCount(course, lesson.unit_count)}${lesson.description ? ` · ${escapeHTML(lesson.description)}` : ''}</span>
          </div>
          <div class="course-chapter-progress" role="progressbar" aria-label="Progresso do capítulo ${lesson.chapter_number}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lp}">
            <span>${done ? '✓ ' : ''}${lp}%</span><div class="course-hero-progress-track"><div class="course-hero-progress-bar" style="width:${lp}%"></div></div>
          </div>
          <button class="course-btn-continue" type="button" data-lesson="${escapeHTML(lesson.id)}">Praticar capítulo</button>
        </li>`;
      }).join('')}
    </ol>`;

  panel.querySelector('[data-back]').addEventListener('click', () => navigate('store'));
  panel.querySelector('[data-continue]').addEventListener('click', () => startLesson(app, course, cont));
  panel.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
    startLesson(app, course, course.lessons.find((l) => l.id === b.dataset.lesson));
  }));
  bindCards(panel, ctx);
  if (openLessonId) {
    const lesson = course.lessons.find((l) => l.id === openLessonId);
    if (lesson) startLesson(app, course, lesson);
  }
}
