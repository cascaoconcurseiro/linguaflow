// Ranking dos Cursos por tempo ativo de estudo (UTC).

import { db } from '../../../../utils/db.js';
import { escapeHTML } from '../../../../utils/html.js';
import { formatDuration, formatDate, formatDateTime, renderLoading, renderLoadError } from './courseUi.js';

const PERIODS = [['daily', 'Hoje'], ['weekly', 'Semana'], ['monthly', 'Mês'], ['all', 'Geral']];
const PAGE = 20;

export async function renderCourseLeaderboard(panel, ctx) {
  const { state } = ctx;
  const f = state.leaderboard || (state.leaderboard = { period: 'weekly', shown: PAGE });
  renderLoading(panel, 'Carregando o ranking…');
  let data;
  try {
    data = await db.courses.getLeaderboard(f.period);
  } catch (err) {
    console.warn('[CourseLeaderboard] load_failed', err?.kind || err?.message);
    renderLoadError(panel, () => renderCourseLeaderboard(panel, ctx));
    return;
  }
  const top = data?.top || [];
  const shown = top.slice(0, f.shown);

  panel.innerHTML = `
    <div class="course-filter-row">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Período do ranking">
        ${PERIODS.map(([p, l]) => `<button type="button" role="tab" class="course-tab-btn ${f.period === p ? 'active' : ''}" aria-selected="${f.period === p}" data-period="${p}">${l}</button>`).join('')}
      </div>
      <button class="course-player-btn-back" type="button" data-refresh>Atualizar</button>
    </div>
    <p class="course-hub-subtitle">Tempo ativo de estudo nos cursos · ${data?.since ? `desde ${formatDate(data.since)} · ` : ''}UTC · ${data?.total_ranked || 0} ${data?.total_ranked === 1 ? 'aluno classificado' : 'alunos classificados'}${top.length >= 100 ? ' · mostrando os 100 primeiros' : ''}</p>

    <section class="course-panel course-my-rank" aria-label="Minha posição">
      ${data?.me
        ? `<span>Minha posição</span><strong>#${data.me.position}</strong><span>${formatDuration(data.me.seconds)}</span>`
        : '<span>Você ainda não pontuou neste período. Pratique um capítulo para entrar no ranking.</span>'}
    </section>

    ${shown.length ? `<table class="course-table course-rank-table">
      <caption class="visually-hidden">Ranking</caption>
      <thead><tr><th>Posição</th><th>Aluno</th><th>Tempo ativo</th></tr></thead>
      <tbody>${shown.map((r) => `<tr class="${r.is_current_user ? 'is-me' : ''}">
        <td>${r.position <= 3 ? ['🥇', '🥈', '🥉'][r.position - 1] : `#${r.position}`}</td>
        <td>${escapeHTML(r.username)}${r.is_current_user ? ' <small>(você)</small>' : ''}</td>
        <td>${formatDuration(r.seconds)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="course-hub-subtitle">Ninguém praticou neste período ainda.</p>'}
    ${top.length > shown.length ? '<button class="course-player-btn-back" type="button" data-more>Carregar mais</button>' : ''}

    <details class="course-panel"><summary>Regras do ranking</summary>
      <ul class="course-rules">
        <li>Conta só o tempo ativo nas práticas dos cursos: sem ociosidade (mais de 30 s parado) e sem pausa.</li>
        <li>Sessões incompletas também contam o tempo praticado.</li>
        <li>Períodos em UTC: o dia vira à meia-noite UTC e a semana começa na segunda.</li>
        <li>Aparece o nome de usuário do seu perfil.</li>
      </ul>
      <p class="course-card-stats">Atualizado em ${formatDateTime(data?.updated_at)}</p>
    </details>`;

  panel.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { f.period = b.dataset.period; f.shown = PAGE; renderCourseLeaderboard(panel, ctx); }));
  panel.querySelector('[data-refresh]').addEventListener('click', () => renderCourseLeaderboard(panel, ctx));
  panel.querySelector('[data-more]')?.addEventListener('click', () => { f.shown += PAGE; renderCourseLeaderboard(panel, ctx); });
}
