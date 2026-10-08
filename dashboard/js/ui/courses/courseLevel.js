// Página de um nível: cartão de progresso, avisos de conquista e módulos em cartões (#546).
import { escapeHTML } from '../../../../utils/html.js';
import { renderCurriculum, lessonRole } from './courseCurriculum.js';
import { levelStatus, levelCompletionText } from './courseLevelProgress.js';
import { startLesson, renderEmpty, renderLoadError, levelPill, lessonProgress } from './courseUi.js';

const NAMES = { A1: 'Iniciante', A2: 'Básico', B1: 'Intermediário', B2: 'Intermediário avançado', C1: 'Avançado' };

// Módulos da base concluídos / total, para a métrica do cabeçalho.
export function moduleCounts(items) {
  const modules = new Map();
  for (const { course, lesson } of items.filter(({ lesson: l }) => lessonRole(l) === 'base')) {
    const key = lesson.module_title || course.title;
    const entry = modules.get(key) || { total: 0, done: 0 };
    entry.total += 1;
    if (lessonProgress(lesson, course).done) entry.done += 1;
    modules.set(key, entry);
  }
  const all = [...modules.values()];
  return { total: all.length, done: all.filter(m => m.total > 0 && m.done === m.total).length };
}

export function renderCourseLevel(panel, ctx, level, openLessonId = null) {
  const { catalog, app, path, navigate, refresh } = ctx;
  if (!NAMES[level]) {
    renderEmpty(panel, 'Nível não encontrado', 'Volte à trilha para escolher um nível.', { label: 'Voltar à trilha', onClick: () => navigate('home') });
    return;
  }
  const progress = path?.levels?.find(item => item.level === level);
  if (!progress) {
    renderLoadError(panel, refresh, 'Não foi possível carregar o progresso deste nível. Tente novamente.');
    return;
  }
  const items = catalog.flatMap(course => course.lessons.filter(lesson => (lesson.level || course.level) === level).map(lesson => ({ course, lesson })));
  const recommended = path.next?.level === level && items.find(item => item.lesson.id === path.next.lesson_id);
  const completionText = levelCompletionText(progress);
  const modules = moduleCounts(items);
  const extras = items.filter(({ lesson }) => lessonRole(lesson) !== 'base').length;
  const notices = [
    completionText,
    progress.new_lessons > 0 ? `${progress.new_lessons} ${progress.new_lessons === 1 ? 'aula acrescentada' : 'aulas acrescentadas'} desde sua conclusão. Sua conquista permanece registrada.` : '',
    progress.skipped && !progress.is_completed ? 'Este nível foi dispensado pelo seu ponto de partida. Você pode estudar suas aulas, mas ele não conta como concluído.' : '',
  ].filter(Boolean);
  panel.innerHTML = `<div class="course-level-detail">
    <button class="course-link" type="button" data-back-path>← Voltar à trilha</button>
    <section class="course-panel course-level-hero" aria-labelledby="level-hero-title">
      <div class="course-level-hero-main">
        <div class="course-card-badges">${levelPill(level)}<span class="course-card-stats">${escapeHTML(levelStatus(progress))}</span></div>
        <h2 id="level-hero-title" class="course-hero-title">${escapeHTML(NAMES[level])}</h2>
        <div class="course-level-progress">
          <div class="course-hero-progress-track" role="progressbar" aria-label="Progresso do material atual do nível ${level}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><div class="course-hero-progress-bar" style="width:${progress.percent}%"></div></div>
          <strong>${progress.percent}%</strong>
        </div>
        <p class="course-hub-subtitle">${progress.completed} de ${progress.total} ${progress.total === 1 ? 'aula' : 'aulas'} da base atual</p>
      </div>
      <div class="course-detail-actions">
        ${recommended ? `<p class="course-card-stats">Próxima aula: ${escapeHTML(recommended.lesson.title)}</p><button class="course-btn-primary-lg" type="button" data-continue-level>Continuar nível ${level}</button>` : ''}
        ${progress.is_completed && path.next?.level && path.next.level !== level ? `<button class="course-btn-primary-lg" type="button" data-next-level>Continuar no nível ${escapeHTML(path.next.level)}</button>` : ''}
      </div>
    </section>
    <div class="course-metrics course-level-metrics" role="group" aria-label="Resumo do nível ${level}">
      <div class="course-metric"><span>Aulas da base</span><strong>${progress.completed}/${progress.total}</strong></div>
      <div class="course-metric"><span>Módulos concluídos</span><strong>${modules.done}/${modules.total}</strong></div>
      <div class="course-metric"><span>Extras e opcionais</span><strong>${extras}</strong><small>não bloqueiam o avanço</small></div>
    </div>
    ${notices.length ? `<ul class="course-level-notices" aria-label="Avisos do nível">${notices.map(text => `<li>${escapeHTML(text)}</li>`).join('')}</ul>` : ''}
    <section data-course-curriculum aria-label="Aulas do nível ${level}"></section>
  </div>`;
  renderCurriculum(panel.querySelector('[data-course-curriculum]'), { catalog, app, path, level, fixedLevel: true });
  panel.querySelector('[data-back-path]').addEventListener('click', () => navigate('home'));
  panel.querySelector('[data-continue-level]')?.addEventListener('click', () => startLesson(app, recommended.course, recommended.lesson, level));
  panel.querySelector('[data-next-level]')?.addEventListener('click', () => navigate('level', { level: path.next.level }));
  if (openLessonId) {
    const item = items.find(item => item.lesson.id === openLessonId);
    if (item) startLesson(app, item.course, item.lesson, level);
  }
}
