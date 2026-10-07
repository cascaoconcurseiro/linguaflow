// dashboard/js/ui/courses/courseUi.js — peças compartilhadas pelas seções de Cursos.

import { escapeHTML } from '../../../../utils/html.js';
import { openCoursePrepareModal } from '../coursePrepareModal.js';

export const TRACKS = [
  ['fundamentos', 'Fundamentos'],
  ['dia-a-dia', 'Dia a dia'],
  ['viagem', 'Viagem'],
  ['gramatica', 'Gramática em uso'],
  ['trabalho', 'Trabalho'],
  ['fluencia', 'Fluência'],
];
export const TRACK_LABEL = Object.fromEntries(TRACKS);
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
export function byPathOrder(a, b) {
  const ta = TRACKS.findIndex(([t]) => t === a.track);
  const tb = TRACKS.findIndex(([t]) => t === b.track);
  return (LEVEL_RANK[a.level_min || a.level] || 9) - (LEVEL_RANK[b.level_min || b.level] || 9)
    || (a.curriculum_order ?? Number.MAX_SAFE_INTEGER) - (b.curriculum_order ?? Number.MAX_SAFE_INTEGER)
    || ta - tb || (a.track_order || 0) - (b.track_order || 0);
}

export function courseLevelLabel(course) {
  return course.level_min && course.level_max && course.level_min !== course.level_max
    ? `${course.level_min}–${course.level_max}` : course.level_min || course.level;
}

export function courseHasLevel(course, level) {
  return !level || (course.lessons || []).some(l => (l.level || course.level) === level);
}

// Primeiro curso a oferecer: o de Meus cursos; sem matrícula, o primeiro da trilha guiada (nunca o order_index do banco).
export function pickFirstCourse(catalog) {
  const mine = catalog.find((c) => c.my?.in_my_courses);
  if (mine) return mine;
  const sorted = [...catalog].sort(byPathOrder);
  return sorted.find((c) => c.is_core !== false) || sorted[0];
}

export const CATEGORY_LABEL = {
  'street-slang': 'Ruas & gírias',
  survival: 'Sobrevivência',
  travel: 'Viagem',
  dining: 'Restaurantes',
  social: 'Social',
  business: 'Trabalho',
  grammar: 'Gramática',
  stories: 'Histórias',
  writing: 'Escrita',
};

export function plural(n, one, many) {
  return `${n} ${Number(n) === 1 ? one : many}`;
}

// Nome da unidade pela forma predominante do curso (catálogo: unit_kind).
const UNIT_NOUN = {
  word: ['palavra', 'palavras'],
  verb_forms: ['verbo', 'verbos'],
  phrasal: ['phrasal verb', 'phrasal verbs'],
  story: ['trecho', 'trechos'],
  paragraph: ['parágrafo', 'parágrafos'],
};
export function unitCount(course, n) {
  const [one, many] = UNIT_NOUN[course?.unit_kind] || ['frase', 'frases'];
  return plural(n, one, many);
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function levelPill(level) {
  const l = String(level || '');
  return `<span class="course-level-pill ${escapeHTML(l.toLowerCase())}">${escapeHTML(l)}</span>`;
}

export function renderLoading(container, label) {
  container.innerHTML = `<div class="course-skeleton" role="status" aria-busy="true">
    <div class="course-skeleton-line"></div><div class="course-skeleton-line short"></div>
    <span class="visually-hidden">${escapeHTML(label)}</span></div>`;
}

export function renderLoadError(container, retry, message = 'Verifique a conexão e tente de novo.') {
  container.innerHTML = `
    <div class="course-empty-state" role="alert">
      <h2 class="course-empty-title">Não foi possível carregar</h2>
      <p class="course-empty-subtitle">${escapeHTML(message)}</p>
      <button class="course-btn-primary-lg" type="button" data-action="retry">Tentar de novo</button>
    </div>`;
  container.querySelector('[data-action="retry"]').addEventListener('click', retry);
}

export function renderEmpty(container, title, text, action = null) {
  container.innerHTML = `
    <div class="course-empty-state">
      <h2 class="course-empty-title">${escapeHTML(title)}</h2>
      <p class="course-empty-subtitle">${escapeHTML(text)}</p>
      ${action ? `<button class="course-btn-primary-lg" type="button" data-action="empty-cta">${escapeHTML(action.label)}</button>` : ''}
    </div>`;
  if (action) container.querySelector('[data-action="empty-cta"]').addEventListener('click', action.onClick);
}

// Progresso de uma lição a partir do catálogo (melhor sessão do aluno).
export function lessonProgress(lesson, course) {
  const done = (course.my?.completed_lessons || []).includes(lesson.id);
  const best = Math.min(lesson.unit_count, Number(lesson.my_best_answered || 0));
  return { done, percent: done ? 100 : Math.round((best / Math.max(1, lesson.unit_count)) * 100) };
}

export function nextLessonOf(course, lessonId) {
  const i = course.lessons.findIndex((l) => l.id === lessonId);
  // A próxima recomendação curricular depende do progresso entre cursos; o Hub consulta a RPC após salvar.
  if (i >= 0 && course.lessons[i].curriculum_order != null) return null;
  return i >= 0 ? course.lessons[i + 1] || null : null;
}

// Próximo capítulo pendente; null quando o curso já foi concluído (nunca recomeça no 1).
export function continueLessonOf(course) {
  const done = new Set(course.my?.completed_lessons || []);
  return course.lessons.find((l) => !done.has(l.id)) || null;
}

// Alvo do card "Continue seu curso": o curso mais recente que ainda tem capítulo pendente.
export function pickContinueTarget({ lessonIndex, summary }) {
  const ids = [summary.continue?.lesson_id, ...(summary.recent || []).map((r) => r.lesson_id)];
  for (const id of ids) {
    const found = id && lessonIndex.get(id);
    const lesson = found && continueLessonOf(found.course);
    if (lesson) return { course: found.course, lesson };
  }
  return null;
}

// Abre o modal de preparo e navega para o player da lição.
export function startLesson(app, course, lesson, returnLevel = null) {
  const next = nextLessonOf(course, lesson.id);
  openCoursePrepareModal({
    course,
    lesson,
    onStart: (difficulty) => app.navigate('course-practice', {
      lessonId: lesson.id, courseId: course.id, difficulty, nextLessonId: next?.id || null,
      ...(returnLevel ? { returnLevel } : {}),
    }),
  });
}

// Prática avulsa (revisões, erros, vocabulário) sobre um conjunto de frases.
export function startNotebookPractice(app, kind, unitIds, title) {
  if (!unitIds.length) return;
  openCoursePrepareModal({
    course: { title, level: '' },
    lesson: { title: kind === 'review' ? 'Revisão' : 'Caderno de erros', chapter_number: null, unit_count: unitIds.length },
    onStart: (difficulty) => app.navigate('course-practice', { kind, unitIds, difficulty }),
  });
}
