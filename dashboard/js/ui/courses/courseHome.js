// Início dos Cursos: continuar, trilha por nível e o resumo de hoje (semana + revisão). Aulas ficam na página do nível; tempo/histórico em Análise e Meus cursos.

import { escapeHTML } from '../../../../utils/html.js';
import { courseReviewPacing, courseReviewsLabel } from '../../core/courseReviewPacing.js';
import { formatDuration, formatDate, levelPill, lessonProgress, pickContinueTarget, pickFirstCourse, startLesson, renderEmpty, plural, unitCount } from './courseUi.js';

import { levelStatus } from './courseLevelProgress.js';

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

// A próxima aula aparece uma só vez, no cartão "Continue seu curso" (#540).
function pathHtml(path) {
  if (!path?.levels) return '';
  return `
    <section class="course-panel course-path" aria-labelledby="path-title">
      <div class="course-section-head">
        <h2 id="path-title" class="course-section-title">Sua trilha${path.current_level ? ` · nível ${escapeHTML(path.current_level)}` : ''}</h2>
        ${path.placement_level ? `<span class="course-card-stats">Ponto de partida pelo seu nível: ${escapeHTML(path.placement_level)}</span>` : ''}
      </div>
      <p class="course-hub-subtitle">Aulas da base por pré-requisitos, do básico ao avançado. Extras e opcionais não bloqueiam o avanço. Concluir o material disponível não certifica o domínio de um nível.</p>
      <ol class="course-path-levels" aria-label="Progresso por nível">
        ${path.levels.map((l) => {
          const state = l.is_completed ? 'is-done' : l.skipped ? 'is-skipped' : l.level === path.current_level ? 'is-current' : '';
          const label = l.skipped && !l.is_completed ? 'disponível para explorar' : l.total === 0 ? 'conteúdo ainda indisponível' : `${l.completed} de ${l.total} aulas do material atual · ${l.percent}%`;
          return `<li class="course-path-level ${state}">
            <button type="button" class="course-path-level-button" data-path-level="${escapeHTML(l.level)}" aria-label="Ver aulas do nível ${escapeHTML(l.level)}"><strong>${escapeHTML(l.level)}</strong><span>${LEVEL_NAME[l.level] || ''}</span></button>
            <div class="course-hero-progress-track" role="progressbar" aria-label="Nível ${escapeHTML(l.level)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${l.skipped ? 100 : l.percent}">
              <div class="course-hero-progress-bar" style="width:${l.skipped ? 100 : l.percent}%"></div></div>
            <small>${escapeHTML(levelStatus(l))}${l.level === path.current_level ? ' · nível atual' : ''} · ${label}</small>
          </li>`;
        }).join('')}
      </ol>
      ${path.next ? '' : path.blocked ?'<p class="course-hub-subtitle" role="status">Há aulas aguardando pré-requisitos. Confira os capítulos anteriores para continuar.</p>' : '<p class="course-hub-subtitle">Você concluiu todas as aulas disponíveis da trilha. Novas aulas aparecem aqui.</p>'}
    </section>`;
}

export function renderCourseHome(panel, { app, catalog, summary, path, navigate, refresh }) {
  const lessonIndex = new Map();
  for (const course of catalog) for (const lesson of course.lessons) lessonIndex.set(lesson.id, { course, lesson });

  const hasProgress = Boolean(summary.continue || (summary.recent || []).length || path?.levels?.some(l => l.completed > 0 || l.started_at || l.completion));
  const next = path?.next && lessonIndex.get(path.next.lesson_id);
  // Com currículo auditado, retomar também segue a recomendação entre cursos e seus pré-requisitos.
  const cont = path?.levels ? (hasProgress ? next : null) : pickContinueTarget({ lessonIndex, summary });
  const firstCourse = pickFirstCourse(catalog);
  const today = new Date().toISOString().slice(0, 10);
  const week = summary.week || [];

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

  const practicedToday = week.some((d) => d.date === today && d.seconds > 0);
  panel.innerHTML = `
    <section class="course-panel course-continue" aria-labelledby="continue-title">
      <h2 id="continue-title" class="course-section-title">Continue seu curso</h2>
      ${continueHtml}
    </section>
    ${pathHtml(path)}
    <section class="course-panel course-today" aria-labelledby="today-title">
      <h2 id="today-title" class="course-section-title">Hoje</h2>
      <div class="course-today-grid">
        <div>
          <p class="course-week-count"><strong>${summary.week_days || 0}</strong> / 7 dias com prática nesta semana</p>
          <ol class="course-week" aria-label="Dias da semana (UTC)">
            ${week.map((d, i) => {
              const studied = d.seconds > 0;
              const isToday = d.date === today;
              return `<li class="course-week-day ${studied ? 'is-done' : ''} ${isToday ? 'is-today' : ''}"
                aria-label="${formatDate(d.date)}: ${studied ? `${formatDuration(d.seconds)} de prática` : 'sem prática'}${isToday ? ' (hoje)' : ''}">
                <span aria-hidden="true">${WEEKDAYS[i]}</span><span class="course-week-dot" aria-hidden="true">${studied ? '✓' : ''}</span></li>`;
            }).join('')}
          </ol>
          <p class="course-hub-subtitle">${practicedToday ? `Você já praticou hoje: ${formatDuration(summary.today_seconds)}.` : 'Pratique hoje para marcar o dia.'}</p>
        </div>
        <div>
          ${reviewPanelHtml(summary)}
          ${summary.mistakes_count > 0 ? `<p class="course-hub-subtitle">${summary.mistakes_count} ${summary.mistakes_count === 1 ? 'erro pendente' : 'erros pendentes'} no caderno. <button class="course-link" type="button" data-go="mistakes">Treinar</button></p>` : ''}
        </div>
      </div>
    </section>
    <nav class="course-home-links" aria-label="Mais sobre seus cursos">
      <button class="course-link" type="button" data-go="my-courses">Meus cursos e evolução →</button>
      <button class="course-link" type="button" data-go="analysis">Tempo e análise →</button>
    </nav>`;

  panel.querySelectorAll('[data-path-level]').forEach(button => button.addEventListener('click', () => navigate('level', { level: button.dataset.pathLevel })));
  if (!path?.levels) {
    const warning = document.createElement('p');
    warning.className = 'course-hub-subtitle';
    warning.setAttribute('role', 'status');
    warning.textContent = 'A trilha não carregou. Você pode explorar a loja ou tentar novamente.';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'course-link'; retry.textContent = 'Recarregar trilha';
    retry.addEventListener('click', async () => { retry.disabled = true; try { await refresh?.(); } finally { retry.disabled = false; } });
    panel.prepend(warning, retry);
  }

  panel.querySelector('[data-continue]')?.addEventListener('click', () => startLesson(app, cont.course, cont.lesson));
  panel.querySelectorAll('[data-path-next]').forEach((button) => button.addEventListener('click', () => {
    const found = lessonIndex.get(path.next.lesson_id);
    if (found) startLesson(app, found.course, found.lesson);
  }));
  panel.querySelector('[data-start-first]')?.addEventListener('click', () => navigate('course', { courseId: firstCourse.id }));
  panel.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
}
