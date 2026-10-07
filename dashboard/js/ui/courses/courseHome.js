// Início dos Cursos: continuar, semana, revisão do dia, tempo e recentes.

import { escapeHTML } from '../../../../utils/html.js';
import { courseReviewPacing, courseReviewsLabel } from '../../core/courseReviewPacing.js';
import { formatDuration, formatDateTime, formatDate, levelPill, lessonProgress, pickContinueTarget, pickFirstCourse, startLesson, renderEmpty, plural, unitCount } from './courseUi.js';

import { renderCurriculum } from './courseCurriculum.js';

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

const LEVEL_NAME = { A1: 'Iniciante', A2: 'Básico', B1: 'Intermediário', B2: 'Intermediário avançado', C1: 'Avançado' };

// Meta diária (#501): sem os campos novos do servidor o texto é o de antes ("N frases vencem hoje").
function reviewPanelHtml(summary) {
  const pacing = courseReviewPacing(summary);
  if (pacing.today > 0) {
    const text = pacing.capped
      ? `<strong>${escapeHTML(courseReviewsLabel(pacing))}</strong>.`
      : `<strong>${pacing.today}</strong> ${pacing.today === 1 ? 'frase dos cursos vence' : 'frases dos cursos vencem'} hoje.`;
    return `<p>${text}</p>
             <button class="course-btn-continue" type="button" data-go="review">Revisar agora</button>`;
  }
  if (pacing.backlog > 0) {
    return `<p class="course-hub-subtitle" role="status">${escapeHTML(courseReviewsLabel(pacing))}.</p>
             <button class="course-link" type="button" data-go="review">Ver a fila</button>`;
  }
  return `<p class="course-hub-subtitle">Nada vence hoje.${summary.next_review_at ? ` Próxima revisão em ${formatDate(summary.next_review_at)}` : ''}</p>`;
}

function pathHtml(path, lessonIndex) {
  if (!path?.levels) return '';
  const next = path.next && lessonIndex.get(path.next.lesson_id);
  return `
    <section class="course-panel course-path" aria-labelledby="path-title">
      <div class="course-section-head">
        <h2 id="path-title" class="course-section-title">Sua trilha${path.current_level ? ` · nível ${escapeHTML(path.current_level)}` : ''}</h2>
        ${path.placement_level ? `<span class="course-card-stats">Ponto de partida pelo seu nível: ${escapeHTML(path.placement_level)}</span>` : ''}
      </div>
      <p class="course-hub-subtitle">Aulas da base por pré-requisitos, do básico ao avançado. Extras e opcionais não bloqueiam o avanço. Concluir o material disponível não certifica o domínio de um nível.</p>
      <ol class="course-path-levels" aria-label="Progresso por nível">
        ${path.levels.map((l) => {
          const state = l.skipped ? 'is-skipped' : l.is_completed ? 'is-done' : l.level === path.current_level ? 'is-current' : '';
          const label = l.skipped ? 'pulado pelo seu nível' : l.total === 0 ? 'em breve' : `${l.completed} de ${l.total} capítulos · ${l.percent}%`;
          return `<li class="course-path-level ${state}">
            <strong>${escapeHTML(l.level)}</strong><span>${LEVEL_NAME[l.level] || ''}</span>
            <div class="course-hero-progress-track" role="progressbar" aria-label="Nível ${escapeHTML(l.level)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${l.skipped ? 100 : l.percent}">
              <div class="course-hero-progress-bar" style="width:${l.skipped ? 100 : l.percent}%"></div></div>
            <small>${l.is_completed ? '✓ concluído · ' : ''}${label}</small>
          </li>`;
        }).join('')}
      </ol>
      ${next ? `<div class="course-path-next">
          <span class="course-card-stats">Próxima aula recomendada</span>
          <strong>${escapeHTML(next.course.title)} · ${next.lesson.chapter_number}. ${escapeHTML(next.lesson.title)}</strong>
          <button class="course-btn-primary-lg" type="button" data-path-next>Fazer agora</button>
        </div>` : path.blocked ? '<p class="course-hub-subtitle" role="status">Há aulas aguardando pré-requisitos. Confira os capítulos anteriores para continuar.</p>' : '<p class="course-hub-subtitle">Você concluiu todas as aulas disponíveis da trilha. Novas aulas aparecem aqui.</p>'}
    </section>`;
}

export function renderCourseHome(panel, { app, catalog, summary, path, navigate }) {
  const lessonIndex = new Map();
  for (const course of catalog) for (const lesson of course.lessons) lessonIndex.set(lesson.id, { course, lesson });

  const hasProgress = Boolean(summary.continue || (summary.recent || []).length);
  const next = path?.next && lessonIndex.get(path.next.lesson_id);
  // Com currículo auditado, retomar também segue a recomendação entre cursos e seus pré-requisitos.
  const cont = path?.levels ? (hasProgress ? next : null) : pickContinueTarget({ lessonIndex, summary });
  const firstCourse = pickFirstCourse(catalog);
  const today = new Date().toISOString().slice(0, 10);
  const week = summary.week || [];
  const recent = (summary.recent || []).map((r) => ({ ...r, ...lessonIndex.get(r.lesson_id) })).filter((r) => r.lesson);

  if (!catalog.length) {
    renderEmpty(panel, 'Nenhum curso publicado ainda', 'Os cursos aparecem aqui assim que tiverem frases prontas.');
    return;
  }

  const continueHtml = cont ? (() => {
    const { percent } = lessonProgress(cont.lesson, cont.course);
    return `
      <div class="course-continue-body">
        ${levelPill(cont.lesson.level || cont.course.level)} <span class="course-card-stats">${plural(cont.course.lessons.length, 'capítulo', 'capítulos')}</span>
        <h3 class="course-hero-title">${escapeHTML(cont.course.title)}</h3>
        <p class="course-hub-subtitle">${cont.lesson.chapter_number}. ${escapeHTML(cont.lesson.title)}</p>
        <div class="course-hero-progress-track" role="progressbar" aria-label="Progresso do capítulo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
          <div class="course-hero-progress-bar" style="width:${percent}%"></div>
        </div>
        <p class="course-card-stats">${Math.round((percent / 100) * cont.lesson.unit_count)} / ${unitCount(cont.course, cont.lesson.unit_count)}</p>
        <button class="course-btn-primary-lg" type="button" data-continue>Continuar</button>
      </div>`;
  })() : hasProgress ? `
      <div class="course-continue-body">
        <h3 class="course-hero-title">Nenhum curso em andamento</h3>
        <p class="course-hub-subtitle">Você concluiu os cursos que começou. ${next ? 'Siga a trilha para o próximo capítulo.' : 'Escolha outro na loja.'}</p>
        <button class="course-btn-primary-lg" type="button" ${next ? 'data-path-next' : 'data-go="store"'}>${next ? 'Ir para a próxima aula' : 'Abrir a loja'}</button>
      </div>` : `
      <div class="course-continue-body">
        <h3 class="course-hero-title">Comece seu primeiro curso</h3>
        <p class="course-hub-subtitle">${next ? `${escapeHTML(next.course.title)} · ${escapeHTML(next.lesson.title)}` : `${escapeHTML(firstCourse.title)}: ${escapeHTML(firstCourse.short_description)}`}</p>
        <button class="course-btn-primary-lg" type="button" ${next ? 'data-path-next' : 'data-start-first'}>Começar</button>
      </div>`;

  panel.innerHTML = `
    ${pathHtml(path, lessonIndex)}
    <section class="course-panel" data-course-curriculum aria-label="Organização pedagógica"></section>
    <div class="course-home-grid">
      <section class="course-panel course-continue" aria-labelledby="continue-title">
        <h2 id="continue-title" class="course-section-title">Continue seu curso</h2>
        ${continueHtml}
      </section>

      <section class="course-panel" aria-labelledby="week-title">
        <h2 id="week-title" class="course-section-title">Esta semana</h2>
        <p class="course-week-count"><strong>${summary.week_days || 0}</strong> / 7 dias com prática</p>
        <ol class="course-week" aria-label="Dias da semana (UTC)">
          ${week.map((d, i) => {
            const studied = d.seconds > 0;
            const isToday = d.date === today;
            return `<li class="course-week-day ${studied ? 'is-done' : ''} ${isToday ? 'is-today' : ''}"
              aria-label="${formatDate(d.date)}: ${studied ? `${formatDuration(d.seconds)} de prática` : 'sem prática'}${isToday ? ' (hoje)' : ''}">
              <span aria-hidden="true">${WEEKDAYS[i]}</span><span class="course-week-dot" aria-hidden="true">${studied ? '✓' : ''}</span></li>`;
          }).join('')}
        </ol>
        <p class="course-hub-subtitle">${week.some((d) => d.date === today && d.seconds > 0) ? 'Você já praticou hoje.' : 'Pratique hoje para marcar o dia.'}</p>
      </section>

      <section class="course-panel" aria-labelledby="review-title">
        <h2 id="review-title" class="course-section-title">Sua revisão do dia</h2>
        ${reviewPanelHtml(summary)}
        ${summary.mistakes_count > 0 ? `<p class="course-hub-subtitle">${summary.mistakes_count} ${summary.mistakes_count === 1 ? 'erro pendente' : 'erros pendentes'} no caderno. <button class="course-link" type="button" data-go="mistakes">Treinar</button></p>` : ''}
      </section>
    </div>

    <section class="course-metrics" aria-label="Tempo de estudo">
      <div class="course-metric"><span>Hoje</span><strong>${formatDuration(summary.today_seconds)}</strong></div>
      <div class="course-metric"><span>Dias nesta semana</span><strong>${summary.week_days || 0}</strong></div>
      <div class="course-metric"><span>Tempo total</span><strong>${formatDuration(summary.total_seconds)}</strong></div>
      <div class="course-metric"><span>Dias de estudo</span><strong>${summary.study_days || 0}</strong></div>
      <button class="course-link" type="button" data-go="analysis">Ver análise →</button>
    </section>

    <section aria-labelledby="recent-title">
      <div class="course-section-head">
        <h2 id="recent-title" class="course-section-title">Estudados recentemente</h2>
        <button class="course-link" type="button" data-go="my-courses">Meus cursos →</button>
      </div>
      ${recent.length ? `<ul class="course-card-row">${recent.map((r) => {
        const { percent } = lessonProgress(r.lesson, r.course);
        return `<li class="course-card">
          <div class="course-card-top">
            <span class="course-card-stats">${escapeHTML(r.course.title)}</span>
            <h3 class="course-card-title">${r.lesson.chapter_number}. ${escapeHTML(r.lesson.title)}</h3>
            <p class="course-card-stats">${formatDateTime(r.last_at)} · ${percent}%</p>
          </div>
          <button class="course-btn-continue" type="button" data-open-lesson="${escapeHTML(r.lesson.id)}">Abrir capítulo</button>
        </li>`;
      }).join('')}</ul>` : '<p class="course-hub-subtitle">As lições que você praticar aparecem aqui.</p>'}
    </section>`;

  renderCurriculum(panel.querySelector('[data-course-curriculum]'), { catalog, app, level: path?.current_level || path?.placement_level || 'A1' });

  panel.querySelector('[data-continue]')?.addEventListener('click', () => startLesson(app, cont.course, cont.lesson));
  panel.querySelectorAll('[data-path-next]').forEach((button) => button.addEventListener('click', () => {
    const found = lessonIndex.get(path.next.lesson_id);
    if (found) startLesson(app, found.course, found.lesson);
  }));
  panel.querySelector('[data-start-first]')?.addEventListener('click', () => navigate('course', { courseId: firstCourse.id }));
  panel.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
  panel.querySelectorAll('[data-open-lesson]').forEach((b) => b.addEventListener('click', () => {
    const found = lessonIndex.get(b.dataset.openLesson);
    if (found) startLesson(app, found.course, found.lesson);
  }));
}
