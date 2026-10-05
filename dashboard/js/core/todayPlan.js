// dashboard/js/core/todayPlan.js — Plano único de hoje (#495): junta revisões de cards, revisões do curso e a próxima lição em passos curtos, com um só botão.
// Função pura (sem DOM, sem rede), testada em tests/today-plan.test.mjs.
//
// Os tempos são ESTIMATIVAS por heurística (segundos por item), não medições.
// O texto exibido ao aluno diz "cerca de"; a medição real vem depois, com telemetria.

export const DEFAULT_REVIEW_PACING_CAP = 35; // mesmo teto diário de revisões da sessão de estudo (studyView: backlogDailyPacing)
export const SECONDS_PER_CARD = 15;
export const SECONDS_PER_COURSE_REVIEW = 20;
export const SECONDS_PER_LESSON = 240;
export const LESSON_DONE_TODAY_SECONDS = 180; // quem já praticou ao menos isto hoje no curso não recebe a lição de novo

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function estimateMinutes(seconds) {
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
}

/**
 * @param {object} input
 * @param {number} input.dueCards revisões vencidas (inclui as que estão em aprendizado)
 * @param {number} input.dueLearning vencidas em aprendizado (voltam em minutos; nunca são adiadas)
 * @param {number} input.courseReviewsDue revisões do curso para hoje (a meta diária; sem meta, todas as vencidas)
 * @param {number} [input.courseReviewsBacklog] vencidas do curso que ficam na fila além da meta de hoje
 * @param {'continue'|'start'|'done'|'none'|'error'} input.courseState estado da faixa de curso
 * @param {object} [input.lesson] { courseId, lessonId, title, chapter } da próxima lição
 * @param {number} [input.courseTodaySeconds] segundos praticados hoje no curso
 * @param {number} [input.heldCount] palavras novas seguradas pelo freio de entrada
 */
export function buildTodayPlan(input = {}) {
  const dueCards = count(input.dueCards);
  const dueLearning = Math.min(dueCards, count(input.dueLearning));
  const dueReview = dueCards - dueLearning;
  const cap = count(input.reviewPacingCap) || DEFAULT_REVIEW_PACING_CAP;
  const cardsToday = dueLearning + Math.min(dueReview, cap);
  const courseReviews = count(input.courseReviewsDue);
  const courseState = input.courseState || 'none';
  const courseTodaySeconds = count(input.courseTodaySeconds);

  const steps = [];
  if (cardsToday > 0) {
    steps.push({
      id: 'cards',
      route: 'study',
      params: null,
      count: cardsToday,
      overflow: dueCards - cardsToday, // vencidas que ficam para outro dia (a sessão já limita o ritmo)
      learning: dueLearning,
      seconds: cardsToday * SECONDS_PER_CARD,
    });
  }
  if (courseReviews > 0) {
    steps.push({
      id: 'course-reviews',
      route: 'courses',
      params: { tab: 'review' },
      count: courseReviews,
      overflow: count(input.courseReviewsBacklog), // fila do curso que fica para outro dia (meta diária, #501)
      learning: 0,
      seconds: courseReviews * SECONDS_PER_COURSE_REVIEW,
    });
  }
  const lesson = input.lesson || null;
  if ((courseState === 'continue' || courseState === 'start') && courseTodaySeconds < LESSON_DONE_TODAY_SECONDS) {
    steps.push({
      id: 'lesson',
      route: 'courses',
      params: courseState === 'continue' && lesson?.lessonId
        ? { tab: 'course', courseId: lesson.courseId, openLessonId: lesson.lessonId }
        : lesson?.courseId ? { tab: 'course', courseId: lesson.courseId, openLessonId: null } : { tab: 'my-courses' },
      count: 1,
      overflow: 0,
      learning: 0,
      lessonTitle: lesson?.title || '',
      chapter: lesson?.chapter ?? null,
      seconds: SECONDS_PER_LESSON,
    });
  }

  const totalSeconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  for (const step of steps) step.minutes = estimateMinutes(step.seconds);

  return {
    state: steps.length ? 'pending' : 'done',
    steps,
    primary: steps[0] || null,
    totalMinutes: estimateMinutes(totalSeconds),
    heldCount: count(input.heldCount),
    courseUnavailable: courseState === 'error',
  };
}
