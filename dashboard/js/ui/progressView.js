// dashboard/js/ui/progressView.js
// Progresso = estatísticas de todo o sistema (vídeo, leitura, revisões FSRS,
// cursos, histórias e escuta) a partir de uma única RPC (rpc_system_stats).

import { db } from '../../../utils/db.js';
import { escapeHTML } from '../../../utils/html.js';
import { renderHeatmap, bindHeatmap } from './activityHeatmap.js';

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses'], [0, 'Tudo']];
const SOURCE_LABEL = {
  pwa: 'Site (estudo, cursos, histórias)',
  extension: 'Extensão',
  video: 'Vídeos',
  review: 'Revisões',
  reader: 'Leitura',
  manual_reading: 'Leitura (registro manual)',
  manual_speaking: 'Fala (registro manual)',
  manual_listening: 'Escuta (registro manual)',
  manual_writing: 'Escrita (registro manual)',
  legacy: 'Registros antigos',
};
const STATUS_LABEL = { new: 'Novas', learning: 'Aprendendo', review: 'Em revisão', mature: 'Maduras' };
const GRADE_LABEL = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'sem nível'];

// Filtros sobrevivem à ida e volta entre telas nesta aba.
const state = { days: 30, metric: 'seconds' };

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function formatDate(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const n = (v) => Number(v || 0).toLocaleString('pt-BR');
const pct = (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

export function compare(cur, prev, { unit = '', lowerIsBetter = false, format = (v) => v } = {}) {
  if (prev == null || cur == null) return '';
  const diff = Number(cur) - Number(prev);
  if (Math.abs(diff) < 0.05) return '<span class="course-delta">igual ao período anterior</span>';
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return `<span class="course-delta ${good ? 'is-up' : 'is-down'}">${diff > 0 ? '▲' : '▼'} ${format(Math.abs(diff))}${unit} vs. período anterior</span>`;
}

function bars(rows, { valueLabel = (v) => n(v), label = 'Distribuição' } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return '<p class="course-hub-subtitle">Sem dados no período.</p>';
  return `<ul class="stats-bars" aria-label="${escapeHTML(label)}">${rows.map((r) => `
    <li><span class="stats-bar-label">${escapeHTML(r.label)}</span>
      <span class="stats-bar-track" aria-hidden="true"><span class="stats-bar-fill" style="width:${Math.round((r.value / max) * 100)}%"></span></span>
      <strong>${valueLabel(r.value)}</strong></li>`).join('')}</ul>`;
}

function columnChart(points, { value, format, label }) {
  if (!points.length) return '<p class="course-hub-subtitle">Sem dados no período.</p>';
  const max = Math.max(1, ...points.map(value));
  const w = 100 / points.length;
  return `
    <svg class="course-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="${escapeHTML(label)}">
      ${points.map((p, i) => {
        const h = (value(p) / max) * 36;
        return `<rect x="${i * w + w * 0.15}" y="${40 - h}" width="${w * 0.7}" height="${h}"><title>${formatDate(p.date)}: ${format(value(p))}</title></rect>`;
      }).join('')}
    </svg>
    <table class="visually-hidden"><caption>${escapeHTML(label)}</caption>
      ${points.map((p) => `<tr><th>${formatDate(p.date)}</th><td>${format(value(p))}</td></tr>`).join('')}</table>`;
}

function isEmpty(s) {
  return !s.time?.total_seconds && !s.streak?.total_days && !s.vocabulary?.total && !s.reviews?.count
    && !s.courses?.phrases_answered && !s.reading?.texts && !s.reading?.stories;
}

export async function renderProgress(container, app) {
  let disposed = false;
  app.onLeaveView?.(() => { disposed = true; });

  container.innerHTML = `
    <main class="stats-page" aria-labelledby="progress-title" aria-busy="true">
      <h1 id="progress-title" class="course-hub-title">Progresso</h1>
      <div class="course-skeleton" role="status"><div class="course-skeleton-line"></div><div class="course-skeleton-line short"></div>
        <span class="visually-hidden">Calculando suas estatísticas…</span></div>
    </main>`;

  let s;
  try {
    s = await db.stats.getSystemStats(state.days);
  } catch (err) {
    if (disposed) return;
    console.warn('[Progress] stats_load_failed', err?.kind || err?.message);
    container.innerHTML = `
      <main class="stats-page" aria-labelledby="progress-title">
        <h1 id="progress-title" class="course-hub-title">Progresso</h1>
        <div class="course-empty-state" role="alert">
          <h2 class="course-empty-title">Não foi possível calcular suas estatísticas</h2>
          <p class="course-empty-subtitle">Seus registros continuam seguros. Verifique a conexão e tente de novo.</p>
          <button class="course-btn-primary-lg" type="button" data-action="retry">Tentar de novo</button>
        </div>
      </main>`;
    container.querySelector('[data-action="retry"]').addEventListener('click', () => renderProgress(container, app));
    return;
  }
  if (disposed) return;

  const t = s.time || {};
  const st = s.streak || {};
  const v = s.vocabulary || {};
  const r = s.reviews || {};
  const c = s.courses || {};
  const rd = s.reading || {};
  const li = s.listening || {};
  const periodLabel = PERIODS.find(([d]) => d === state.days)?.[1] || '';

  const sources = Object.entries(t.by_source || {})
    .map(([key, value]) => ({ label: SOURCE_LABEL[key] || key, value }))
    .sort((a, b) => b.value - a.value);
  const levels = LEVEL_ORDER.filter((l) => v.by_level?.[l]).map((l) => ({ label: l, value: v.by_level[l] }));
  const statuses = Object.keys(STATUS_LABEL).map((k) => ({ label: STATUS_LABEL[k], value: Number(v.by_status?.[k] || 0) })).filter((x) => x.value > 0);
  const grades = [1, 2, 3, 4].map((g) => ({ label: GRADE_LABEL[g], value: Number(r.by_grade?.[g] || 0) }));
  const daily = s.daily || [];

  container.innerHTML = `
    <main class="stats-page" aria-labelledby="progress-title">
      <header class="stats-head">
        <div>
          <h1 id="progress-title" class="course-hub-title">Progresso</h1>
          <p class="course-hub-subtitle">Todo o seu estudo no LinguaFlow · fuso ${escapeHTML(s.period?.timezone || 'UTC')}</p>
        </div>
        <div class="course-filter-row">
          <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Período">
            ${PERIODS.map(([d, l]) => `<button type="button" role="tab" class="course-tab-btn ${state.days === d ? 'active' : ''}" aria-selected="${state.days === d}" data-days="${d}">${l}</button>`).join('')}
          </div>
          <button class="course-player-btn-back" type="button" data-action="refresh">Atualizar</button>
        </div>
      </header>

      ${isEmpty(s) ? `
        <div class="course-empty-state">
          <h2 class="course-empty-title">Suas estatísticas começam com o primeiro estudo</h2>
          <p class="course-empty-subtitle">Pratique um capítulo, revise frases ou assista a um vídeo com a extensão: tudo aparece aqui.</p>
          <button class="course-btn-primary-lg" type="button" data-go="courses">Abrir os cursos</button>
        </div>` : `
      <section class="course-metrics course-metrics--kpi" aria-label="Resumo do período">
        <div class="course-metric"><span>Tempo de estudo · ${periodLabel}</span><strong>${formatDuration(t.total_seconds)}</strong>
          ${compare(t.total_seconds || 0, t.previous_seconds, { format: formatDuration })}
          ${t.daily_average_seconds != null ? `<small>média de ${formatDuration(t.daily_average_seconds)} por dia</small>` : ''}</div>
        <div class="course-metric"><span>Sequência</span><strong>${st.current || 0} ${st.current === 1 ? 'dia' : 'dias'}</strong>
          <small>recorde: ${st.best || 0} · ${st.studied_today ? 'hoje já contou' : 'estude hoje para manter'}</small></div>
        <div class="course-metric"><span>Dias com estudo</span><strong>${t.active_days || 0}</strong><small>${n(st.total_days)} no total</small></div>
        <div class="course-metric"><span>Revisões</span><strong>${n(r.count)}</strong>${compare(r.count, r.previous_count)}</div>
        <div class="course-metric"><span>Acerto nas revisões</span><strong>${pct(r.success_rate)}</strong>
          ${compare(r.success_rate, r.previous_success_rate, { unit: ' p.p.', format: (x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) })}</div>
        <div class="course-metric"><span>Retenção (cartões em revisão)</span><strong>${pct(r.retention_mature)}</strong><small>lembrou sem errar</small></div>
        <div class="course-metric"><span>Palavras e frases salvas</span><strong>${n(v.total)}</strong><small>+${n(v.added_in_period)} no período</small></div>
        <div class="course-metric"><span>Revisões vencidas agora</span><strong>${n(r.due_now)}</strong>
          ${r.due_now > 0 ? '<button class="course-link" type="button" data-go="study">Revisar agora →</button>' : '<small>nada pendente</small>'}</div>
      </section>

      <div class="course-home-grid">
        <section class="course-panel" aria-labelledby="src-title"><h2 id="src-title" class="course-section-title">Tempo por atividade</h2>
          ${bars(sources, { valueLabel: formatDuration, label: 'Tempo por atividade' })}
          <p class="course-card-stats">Escuta verificada no período: <strong>${formatDuration(li.verified_seconds)}</strong> em ${li.days || 0} ${li.days === 1 ? 'dia' : 'dias'}.</p>
        </section>
        <section class="course-panel" aria-labelledby="mem-title"><h2 id="mem-title" class="course-section-title">Memória (cartões)</h2>
          ${bars(statuses, { label: 'Cartões por estado' })}
          <p class="course-card-stats">${n(v.leeches)} ${v.leeches === 1 ? 'cartão difícil' : 'cartões difíceis'} (erra com frequência) · ${n(v.suspended)} ${v.suspended === 1 ? 'suspenso' : 'suspensos'}</p>
        </section>
      </div>

      <section class="course-panel" aria-labelledby="daily-title">
        <div class="course-section-head"><h2 id="daily-title" class="course-section-title">Dia a dia</h2>
          <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Métrica">
            ${[['seconds', 'Tempo'], ['reviews', 'Revisões']].map(([m, l]) => `<button type="button" role="tab" class="course-tab-btn ${state.metric === m ? 'active' : ''}" aria-selected="${state.metric === m}" data-metric="${m}">${l}</button>`).join('')}
          </div></div>
        ${columnChart(daily, state.metric === 'seconds'
          ? { value: (p) => p.seconds, format: formatDuration, label: 'Tempo de estudo por dia' }
          : { value: (p) => p.reviews, format: (x) => `${x} revisões`, label: 'Revisões por dia' })}
      </section>

      <section class="course-panel" aria-labelledby="heat-title"><h2 id="heat-title" class="course-section-title">Atividade no ano</h2>
        ${renderHeatmap(s.heatmap, { today: s.period?.today, formatDate, formatDuration })}
      </section>

      <div class="course-home-grid">
        <section class="course-panel" aria-labelledby="rev-title"><h2 id="rev-title" class="course-section-title">Revisões no período</h2>
          ${bars(grades, { label: 'Respostas por nota' })}
          <p class="course-card-stats">Tempo mediano de resposta: <strong>${r.median_response_ms ? `${(r.median_response_ms / 1000).toFixed(1).replace('.', ',')} s` : '—'}</strong></p>
        </section>
        <section class="course-panel" aria-labelledby="fc-title"><h2 id="fc-title" class="course-section-title">Revisões nos próximos 14 dias</h2>
          ${columnChart(r.forecast || [], { value: (p) => p.count, format: (x) => `${x} revisões`, label: 'Previsão de revisões' })}
        </section>
      </div>

      <div class="course-home-grid">
        <section class="course-panel" aria-labelledby="lvl-title"><h2 id="lvl-title" class="course-section-title">Vocabulário por nível</h2>
          ${bars(levels, { label: 'Palavras por nível CEFR' })}
        </section>
        <section class="course-panel" aria-labelledby="crs-title"><h2 id="crs-title" class="course-section-title">Cursos · ${periodLabel}</h2>
          <dl class="course-dl">
            <div><dt>Tempo de prática</dt><dd>${formatDuration(c.active_seconds)}</dd></div>
            <div><dt>Frases respondidas</dt><dd>${n(c.phrases_answered)}</dd></div>
            <div><dt>Acerto de primeira</dt><dd>${pct(c.accuracy)}</dd></div>
          </dl>
          <p class="course-card-stats">${n(c.chapters_completed)} capítulos concluídos · ${n(c.courses_in_progress)} em andamento · ${n(c.courses_completed)} concluídos</p>
          <button class="course-link" type="button" data-go="courses" data-tab="analysis">Ver análise dos cursos →</button>
        </section>
        <section class="course-panel" aria-labelledby="read-title"><h2 id="read-title" class="course-section-title">Leitura e histórias</h2>
          <dl class="course-dl">
            <div><dt>Textos</dt><dd>${n(rd.texts)}</dd></div>
            <div><dt>Terminados</dt><dd>${n(rd.texts_completed)}</dd></div>
            <div><dt>Histórias</dt><dd>${n(rd.stories)}</dd></div>
          </dl>
          <p class="course-card-stats">${n(rd.texts_in_progress)} em andamento${rd.story_words > 0 ? ` · ${n(rd.story_words)} palavras nas histórias` : ''}</p>
        </section>
      </div>`}

      <footer class="stats-footer">
        <button class="course-link" type="button" data-go="fluency-check">Check de comunicação: como medimos fala, escuta e escrita →</button>
      </footer>
    </main>`;

  container.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
    state.days = Number(b.dataset.days);
    renderProgress(container, app);
  }));
  container.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => {
    state.metric = b.dataset.metric;
    renderProgress(container, app);
  }));
  container.querySelector('[data-action="refresh"]')?.addEventListener('click', () => renderProgress(container, app));
  container.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    app.navigate?.(b.dataset.go, b.dataset.tab ? { tab: b.dataset.tab } : {});
  }));
  bindHeatmap(container);
}
