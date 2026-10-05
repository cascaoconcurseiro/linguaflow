// dashboard/js/ui/courses/courseHomeStrip.js — faixa "Curso" do Início (Issue #492).
// Reaproveita a seleção do card "Continue seu curso"; nada de regra nova de progresso.

import { escapeHTML } from '../../../../utils/html.js';
import { lessonProgress, pickContinueTarget } from './courseUi.js';

export function buildCourseStripModel({ catalog = [], summary = {} } = {}) {
  if (!catalog.length) return { kind: 'none' };
  const lessonIndex = new Map();
  for (const course of catalog) for (const lesson of course.lessons || []) lessonIndex.set(lesson.id, { course, lesson });
  const cont = pickContinueTarget({ lessonIndex, summary });
  if (cont) {
    return {
      kind: 'continue',
      courseId: cont.course.id,
      lessonId: cont.lesson.id,
      courseTitle: cont.course.title,
      level: cont.course.level || '',
      chapter: cont.lesson.chapter_number,
      lessonTitle: cont.lesson.title,
      percent: lessonProgress(cont.lesson, cont.course).percent,
      reviewsDue: Number(summary.reviews_due_count || 0),
      mistakes: Number(summary.mistakes_count || 0),
    };
  }
  if (summary.continue || (summary.recent || []).length) return { kind: 'done' };
  const first = catalog.find((c) => c.my?.in_my_courses) || catalog[0];
  return { kind: 'start', courseId: first.id, courseTitle: first.title, level: first.level || '' };
}

function counts(model) {
  const parts = [];
  if (model.reviewsDue > 0) parts.push(`<a href="#courses/review" class="home-course-count" data-course-tab="review">${model.reviewsDue} ${model.reviewsDue === 1 ? 'revisão vencida' : 'revisões vencidas'}</a>`);
  if (model.mistakes > 0) parts.push(`<a href="#courses/mistakes" class="home-course-count" data-course-tab="mistakes">${model.mistakes} ${model.mistakes === 1 ? 'erro aberto' : 'erros abertos'}</a>`);
  return parts.length ? `<p class="home-course-counts">${parts.join('<span aria-hidden="true"> · </span>')}</p>` : '';
}

export function renderCourseStrip(model) {
  if (!model || model.kind === 'none') return '';
  const head = '<span class="home-story-shortcut-kicker">CURSO</span>';
  if (model.kind === 'error') {
    return `<section class="home-course-strip" aria-label="Curso" role="status">${head}
      <strong>Curso indisponível agora</strong>
      <span>Não deu para carregar seu progresso.</span>
      <button type="button" id="btn-home-course-retry" class="home-course-link">Tentar novamente</button></section>`;
  }
  if (model.kind === 'done') {
    return `<section class="home-course-strip" aria-label="Curso">${head}
      <strong>Cursos em dia</strong>
      <span>Você concluiu o que começou.</span>
      <button type="button" id="btn-home-course-continue" class="btn-action" data-course-tab="my-courses">Ver meus cursos</button></section>`;
  }
  if (model.kind === 'start') {
    return `<section class="home-course-strip" aria-label="Curso">${head}
      <strong>Comece seu primeiro curso</strong>
      <span>${escapeHTML(model.courseTitle)}</span>
      <button type="button" id="btn-home-course-continue" class="btn-action" data-course-id="${escapeHTML(model.courseId)}">Começar</button></section>`;
  }
  const percent = Math.max(0, Math.min(100, Math.round(model.percent || 0)));
  return `<section class="home-course-strip" aria-label="Curso">${head}
    <strong>${escapeHTML(model.courseTitle)}${model.level ? ` · ${escapeHTML(model.level)}` : ''}</strong>
    <span>Capítulo ${escapeHTML(model.chapter)}: ${escapeHTML(model.lessonTitle)}</span>
    <div class="home-course-track" role="progressbar" aria-label="Progresso do capítulo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="home-course-bar" style="width:${percent}%"></div></div>
    ${counts(model)}
    <button type="button" id="btn-home-course-continue" class="btn-action" data-course-id="${escapeHTML(model.courseId)}" data-lesson-id="${escapeHTML(model.lessonId)}">Continuar</button></section>`;
}

const LOAD_TIMEOUT_MS = 4000;

// Nunca bloqueia nem derruba o Início: sem repositório de cursos some a faixa; falha vira estado de erro.
export async function loadCourseStripModel(db) {
  const repo = db?.courses;
  if (!repo?.listCatalog) return { kind: 'none' };
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS));
  try {
    const [catalog, summary] = await Promise.race([
      Promise.all([repo.listCatalog(), repo.getHubSummary().catch(() => ({}))]),
      timeout,
    ]);
    return buildCourseStripModel({ catalog: catalog || [], summary: summary || {} });
  } catch {
    return { kind: 'error' };
  }
}
