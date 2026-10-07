// Página de um nível: progresso da base, conquista preservada e aulas organizadas por módulo.
import { escapeHTML } from '../../../../utils/html.js';
import { renderCurriculum } from './courseCurriculum.js';
import { levelStatus, levelCompletionText } from './courseLevelProgress.js';
import { startLesson, renderEmpty, renderLoadError } from './courseUi.js';

const NAMES = { A1: 'Iniciante', A2: 'Básico', B1: 'Intermediário', B2: 'Intermediário avançado', C1: 'Avançado' };

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
  panel.innerHTML = `<div class="course-level-detail">
    <button class="course-link" type="button" data-back-path>← Voltar à trilha</button>
    <header class="course-detail-head">
      <div><h2 class="course-hub-title">${escapeHTML(NAMES[level])}</h2>
        <p class="course-hub-subtitle">${escapeHTML(levelStatus(progress))} · ${progress.completed} de ${progress.total} aulas da base atual</p>
        <div class="course-hero-progress-track" role="progressbar" aria-label="Progresso do material atual do nível ${level}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><div class="course-hero-progress-bar" style="width:${progress.percent}%"></div></div>
        ${completionText ? `<p class="course-card-stats">${escapeHTML(completionText)}</p>` : ''}
        ${progress.new_lessons > 0 ? `<p class="course-card-stats">${progress.new_lessons} ${progress.new_lessons === 1 ? 'aula acrescentada' : 'aulas acrescentadas'} desde sua conclusão. Sua conquista permanece registrada.</p>` : ''}
        ${progress.skipped && !progress.is_completed ? '<p class="course-hub-subtitle">Este nível foi dispensado pelo seu ponto de partida. Você pode estudar suas aulas, mas ele não conta como concluído.</p>' : ''}
      </div>
      <div class="course-detail-actions">
        ${recommended ? `<p class="course-card-stats">Próxima aula: ${escapeHTML(recommended.lesson.title)}</p><button class="course-btn-primary-lg" type="button" data-continue-level>Continuar nível ${level}</button>` : ''}
        ${progress.is_completed && path.next?.level && path.next.level !== level ? `<button class="course-btn-primary-lg" type="button" data-next-level>Continuar no nível ${escapeHTML(path.next.level)}</button>` : ''}
      </div>
    </header>
    <p class="course-hub-subtitle">Siga os módulos na ordem. As revisões continuam ao avançar; extras e opcionais não bloqueiam a conclusão da base.</p>
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
