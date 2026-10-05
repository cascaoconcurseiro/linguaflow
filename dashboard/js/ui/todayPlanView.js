// dashboard/js/ui/todayPlanView.js — Bloco "Plano de hoje" do Início (#495): passos numerados, tempo estimado e um botão principal.
import { escapeHTML } from '../../../utils/html.js';
import { INTAKE_RELEASE_PER_DAY } from '../../../utils/intake-guard.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function stepCopy(step) {
  if (step.id === 'cards') {
    const parts = [plural(step.count, 'card', 'cards')];
    if (step.learning > 0) parts.push(`${step.learning} voltando em minutos`);
    if (step.overflow > 0) parts.push(`mais ${step.overflow} ficam para outro dia`);
    return { title: 'Revisar cards', detail: parts.join(' · ') };
  }
  if (step.id === 'course-reviews') {
    return { title: 'Revisar frases do curso', detail: plural(step.count, 'revisão vencida', 'revisões vencidas') };
  }
  const detail = step.lessonTitle
    ? `${step.chapter ? `Capítulo ${step.chapter}: ` : ''}${step.lessonTitle}`
    : 'Escolha seu primeiro curso';
  return { title: 'Próxima lição do curso', detail };
}

function renderStep(step, index, isPrimary) {
  const { title, detail } = stepCopy(step);
  const params = step.params ? escapeHTML(JSON.stringify(step.params)) : '';
  return `<li class="today-step${isPrimary ? ' is-primary' : ''}">
    <span class="today-step-num" aria-hidden="true">${index + 1}</span>
    <div class="today-step-body">
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(detail)}</span>
    </div>
    <span class="today-step-time">${step.minutes} min</span>
    <button type="button" class="${isPrimary ? 'btn-action' : 'btn today-step-secondary'}" data-plan-step="${escapeHTML(step.id)}" data-plan-route="${escapeHTML(step.route)}"${params ? ` data-plan-params="${params}"` : ''} aria-label="${escapeHTML(`${isPrimary ? 'Começar' : 'Ir para'}: ${title}`)}">${isPrimary ? 'Começar' : 'Ir'}<span aria-hidden="true"> →</span></button>
  </li>`;
}

export function renderTodayPlan(plan, { reviewsToday = 0 } = {}) {
  const notes = [];
  if (plan.courseUnavailable) {
    notes.push(`<p class="today-note" role="status">O curso não carregou agora; o plano mostra só seus cards. <button type="button" id="btn-home-course-retry" class="home-course-link">Tentar novamente</button></p>`);
  }
  if (plan.heldCount > 0) {
    notes.push(`<p class="today-note" role="status">${plural(plan.heldCount, 'palavra nova espera', 'palavras novas esperam')} a fila de revisões baixar. Elas voltam sozinhas, até ${INTAKE_RELEASE_PER_DAY} por dia, e nada se perde.</p>`);
  }
  const head = '<p class="product-kicker">PLANO DE HOJE</p>';
  if (plan.state === 'done') {
    const detail = reviewsToday > 0
      ? `Você fez ${plural(reviewsToday, 'revisão', 'revisões')} hoje e não há mais nada vencido.`
      : 'Não há nada vencido agora. O que vier depois é opcional.';
    return `<section id="home-primary-plan" class="home-primary-plan today-plan" data-plan-kind="today-done" aria-labelledby="home-primary-title">
      ${head}
      <h1 id="home-primary-title">Acabou por hoje</h1>
      <p class="home-primary-reason">${escapeHTML(detail)}</p>
      ${notes.join('')}
      <button type="button" id="btn-primary-stories" class="home-story-shortcut is-compact today-optional">
        <span class="home-story-shortcut-kicker">OPCIONAL</span>
        <strong>Criar uma história</strong>
        <span>Escolha nível, duração e objetivo</span>
      </button>
    </section>`;
  }
  const steps = plan.steps.map((step, i) => renderStep(step, i, i === 0)).join('');
  return `<section id="home-primary-plan" class="home-primary-plan today-plan" data-plan-kind="today-pending" aria-labelledby="home-primary-title">
    ${head}
    <h1 id="home-primary-title">Cerca de ${plan.totalMinutes} min hoje</h1>
    <p class="home-primary-reason">Uma fila só: primeiro o que está vencido, depois a próxima lição. O tempo é uma estimativa.</p>
    <ol class="today-steps" aria-label="Passos do plano de hoje">${steps}</ol>
    ${notes.join('')}
    <button type="button" id="btn-primary-stories" class="home-story-shortcut is-compact today-optional">
      <span class="home-story-shortcut-kicker">OPCIONAL</span>
      <strong>Criar uma história</strong>
      <span>Escolha nível, duração e objetivo</span>
    </button>
  </section>`;
}

export const TODAY_PLAN_CSS = `
        .today-plan { display:block; }
        .today-plan h1 { margin:4px 0 6px; }
        .today-steps { list-style:none; margin:18px 0 8px; padding:0; border-top:1px solid var(--color-border); }
        .today-step { display:grid; grid-template-columns:32px 1fr auto auto; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid var(--color-border); }
        .today-step-num { font:400 26px/1 var(--font-reading); color:var(--color-text-light); font-variant-numeric:tabular-nums; }
        .today-step.is-primary .today-step-num { color:var(--color-primary); }
        .today-step-body strong { display:block; color:var(--color-text); font-size:16px; }
        .today-step-body span { display:block; color:var(--color-text-light); font-size:13px; line-height:1.45; margin-top:2px; }
        .today-step-time { color:var(--color-text-light); font-size:13px; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .today-step-secondary { background:transparent; color:var(--color-primary); border:1px solid var(--color-border); }
        .today-step button:focus-visible { outline:3px solid var(--color-focus); outline-offset:2px; }
        .today-note { margin:12px 0 0; color:var(--color-text-light); font-size:13px; line-height:1.5; }
        .today-optional { margin-top:18px; }
        @media (max-width: 640px) {
            .today-step { grid-template-columns:28px 1fr auto; }
            .today-step-time { display:none; }
            .today-step button { grid-column:2 / -1; justify-self:start; }
        }
`;
