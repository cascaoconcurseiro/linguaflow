// Análise de aprendizado dos Cursos.

import { db } from '../../../../utils/db.js';
import { escapeHTML } from '../../../../utils/html.js';
import { formatDuration, formatDateTime, formatDate, renderLoading, renderLoadError } from './courseUi.js';
import { renderHeatmap, bindHeatmap } from '../activityHeatmap.js';

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [0, 'Tudo']];
const MODE_LABEL = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
const KIND_LABEL = { lesson: 'Capítulo', review: 'Revisão', mistakes: 'Erros' };

function renderChart(daily, metric) {
  if (!daily.length) return '<p class="course-hub-subtitle">Sem prática no período.</p>';
  const value = (d) => Number(metric === 'active' ? d.active_seconds : metric === 'accuracy' ? d.accuracy : d.hint_usage) || 0;
  const max = Math.max(1, ...daily.map(value));
  const fmt = (v) => (metric === 'active' ? formatDuration(v) : `${v}%`);
  const w = 100 / daily.length;
  return `
    <svg class="course-chart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Gráfico diário">
      ${daily.map((d, i) => {
        const h = (value(d) / max) * 36;
        return `<rect x="${i * w + w * 0.15}" y="${40 - h}" width="${w * 0.7}" height="${h}"><title>${formatDate(d.date)}: ${fmt(value(d))}</title></rect>`;
      }).join('')}
    </svg>
    <table class="visually-hidden"><caption>Dados do gráfico</caption>
      ${daily.map((d) => `<tr><th>${formatDate(d.date)}</th><td>${fmt(value(d))}</td></tr>`).join('')}</table>`;
}

export async function renderCourseAnalysis(panel, ctx) {
  const { catalog, state } = ctx;
  const f = state.analysis || (state.analysis = { days: 30, course: '', mode: '', metric: 'active', tab: 'history' });
  renderLoading(panel, 'Carregando a análise…');
  let data;
  try {
    data = await db.courses.getAnalysis({ days: f.days, courseId: f.course || null, difficulty: f.mode || null });
  } catch (err) {
    console.warn('[CourseAnalysis] load_failed', err?.kind || err?.message);
    renderLoadError(panel, () => renderCourseAnalysis(panel, ctx));
    return;
  }
  const lessonIndex = new Map();
  const courseIndex = new Map(catalog.map((c) => [c.id, c]));
  for (const c of catalog) for (const l of c.lessons) lessonIndex.set(l.id, { course: c, lesson: l });
  const k = data.kpis || {};
  const p = data.previous;
  const b = data.bests || {};
  const bestLine = (best, fmt) => {
    if (!best) return '<p class="course-hub-subtitle">Ainda sem registro.</p>';
    const ref = lessonIndex.get(best.lesson_id);
    return `<strong>${fmt(best.value)}</strong><span class="course-card-stats">${ref ? `${escapeHTML(ref.course.title)} · ${escapeHTML(ref.lesson.title)} · ` : ''}${formatDate(best.at)}</span>`;
  };
  const sessionTitle = (h) => {
    const ref = lessonIndex.get(h.lesson_id);
    return ref ? `${escapeHTML(ref.course.title)} · ${ref.lesson.chapter_number}. ${escapeHTML(ref.lesson.title)}` : KIND_LABEL[h.kind] || h.kind;
  };

  panel.innerHTML = `
    <div class="course-filter-row">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Período">
        ${PERIODS.map(([d, label]) => `<button type="button" role="tab" class="course-tab-btn ${f.days === d ? 'active' : ''}" aria-selected="${f.days === d}" data-days="${d}">${label}</button>`).join('')}
      </div>
      <label><span class="visually-hidden">Curso</span><select id="an-course"><option value="">Todos os cursos</option>
        ${catalog.map((c) => `<option value="${escapeHTML(c.id)}" ${f.course === c.id ? 'selected' : ''}>${escapeHTML(c.title)}</option>`).join('')}</select></label>
      <label><span class="visually-hidden">Modo</span><select id="an-mode"><option value="">Todos os modos</option>
        ${Object.entries(MODE_LABEL).map(([m, l]) => `<option value="${m}" ${f.mode === m ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="course-player-btn-back" type="button" data-refresh>Atualizar</button>
    </div>

    <section class="course-metrics course-metrics--kpi" aria-label="Indicadores">
      <div class="course-metric"><span>Tempo ativo</span><strong>${formatDuration(k.active_seconds)}</strong>
        ${p ? delta(Math.floor((k.active_seconds || 0) / 60), Math.floor((p.active_seconds || 0) / 60), { unit: ' min' }) : ''}<small>Inclui sessões incompletas</small></div>
      <div class="course-metric"><span>Sessões concluídas</span><strong>${k.completed_sessions || 0}</strong>${p ? delta(k.completed_sessions, p.completed_sessions) : ''}</div>
      <div class="course-metric"><span>Acerto de primeira</span><strong>${k.accuracy != null ? `${k.accuracy}%` : '—'}</strong>
        ${p ? delta(k.accuracy, p.accuracy, { unit: ' p.p.' }) : ''}<small>${k.completed_questions || 0} frases concluídas</small></div>
      <div class="course-metric"><span>Uso de dicas</span><strong>${k.hint_usage != null ? `${k.hint_usage}%` : '—'}</strong>
        ${p ? delta(k.hint_usage, p.hint_usage, { unit: ' p.p.', invert: true }) : ''}</div>
    </section>

    <div class="course-home-grid">
      <section class="course-panel"><h2 class="course-section-title">Conteúdo (todo o período)</h2>
        <dl class="course-dl">
          <div><dt>Palavras encontradas</dt><dd>${data.content?.words_encountered || 0}</dd></div>
          <div><dt>Cursos estudados</dt><dd>${data.content?.courses_studied || 0}</dd></div>
          <div><dt>Capítulos concluídos</dt><dd>${data.content?.chapters_completed || 0}</dd></div>
        </dl>
        <p class="course-card-stats">Palavras contadas pela forma escrita; encontrar não é o mesmo que dominar.</p>
      </section>
      <section class="course-panel"><h2 class="course-section-title">Recordes</h2>
        <div class="course-best"><span>Maior combo</span>${bestLine(b.streak, (v) => `${v} frases`)}</div>
        <div class="course-best"><span>Maior pontuação</span>${bestLine(b.score, (v) => `${v} pts`)}</div>
        <div class="course-best"><span>Melhor acerto</span>${bestLine(b.accuracy, (v) => `${v}%`)}</div>
      </section>
    </div>

    <section class="course-panel"><h2 class="course-section-title">Atividade no ano</h2>${renderHeatmap(data.heatmap, { formatDate, formatDuration })}</section>

    <section class="course-panel">
      <div class="course-section-head"><h2 class="course-section-title">Desempenho diário</h2>
        <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Métrica">
          ${[['active', 'Tempo ativo'], ['accuracy', 'Acerto'], ['hints', 'Dicas']].map(([m, l]) => `<button type="button" role="tab" class="course-tab-btn ${f.metric === m ? 'active' : ''}" aria-selected="${f.metric === m}" data-metric="${m}">${l}</button>`).join('')}
        </div></div>
      ${renderChart(data.daily || [], f.metric)}
    </section>

    <section class="course-panel">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Tabelas">
        ${[['history', 'Histórico'], ['courses', 'Por curso'], ['daily', 'Dados diários']].map(([t, l]) => `<button type="button" role="tab" class="course-tab-btn ${f.tab === t ? 'active' : ''}" aria-selected="${f.tab === t}" data-table="${t}">${l}</button>`).join('')}
      </div>
      <div class="course-table-wrap">
      ${f.tab === 'history' ? `<table class="course-table"><caption class="visually-hidden">Histórico de sessões (UTC)</caption>
        <thead><tr><th>Sessão</th><th>Início</th><th>Tempo ativo</th><th>Respondidas</th><th>Acerto</th><th>Situação</th></tr></thead>
        <tbody>${(data.history || []).map((h) => `<tr><td>${sessionTitle(h)}<br><small>${KIND_LABEL[h.kind]} · ${MODE_LABEL[h.difficulty]}</small></td>
          <td>${formatDateTime(h.started_at)}</td><td>${formatDuration(h.active_seconds)}</td><td>${h.answered} / ${h.total}</td>
          <td>${h.status === 'completed' ? `${h.accuracy}%` : '—'}</td><td>${h.status === 'completed' ? 'Concluída' : 'Incompleta'}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma sessão no período.</td></tr>'}</tbody></table>` : ''}
      ${f.tab === 'courses' ? `<table class="course-table"><caption class="visually-hidden">Desempenho por curso</caption>
        <thead><tr><th>Curso</th><th>Sessões</th><th>Tempo ativo</th><th>Acerto médio</th><th>Capítulos concluídos</th></tr></thead>
        <tbody>${(data.courses || []).map((c) => `<tr><td>${escapeHTML(courseIndex.get(c.course_id)?.title || c.course_id)}</td><td>${c.sessions}</td>
          <td>${formatDuration(c.active_seconds)}</td><td>${c.accuracy != null ? `${c.accuracy}%` : '—'}</td><td>${c.chapters_completed}</td></tr>`).join('') || '<tr><td colspan="5">Sem dados no período.</td></tr>'}</tbody></table>` : ''}
      ${f.tab === 'daily' ? `<table class="course-table"><caption class="visually-hidden">Dados diários (UTC)</caption>
        <thead><tr><th>Dia</th><th>Tempo ativo</th><th>Acerto</th><th>Dicas</th></tr></thead>
        <tbody>${(data.daily || []).slice().reverse().map((d) => `<tr><td>${formatDate(d.date)}</td><td>${formatDuration(d.active_seconds)}</td>
          <td>${d.accuracy != null ? `${d.accuracy}%` : '—'}</td><td>${d.hint_usage != null ? `${d.hint_usage}%` : '—'}</td></tr>`).join('') || '<tr><td colspan="4">Sem dados no período.</td></tr>'}</tbody></table>` : ''}
      </div>
    </section>`;

  const rerender = () => renderCourseAnalysis(panel, ctx);
  panel.querySelectorAll('[data-days]').forEach((btn) => btn.addEventListener('click', () => { f.days = Number(btn.dataset.days); rerender(); }));
  panel.querySelector('#an-course').addEventListener('change', (e) => { f.course = e.target.value; rerender(); });
  panel.querySelector('#an-mode').addEventListener('change', (e) => { f.mode = e.target.value; rerender(); });
  panel.querySelector('[data-refresh]').addEventListener('click', rerender);
  panel.querySelectorAll('[data-metric]').forEach((btn) => btn.addEventListener('click', () => { f.metric = btn.dataset.metric; rerender(); }));
  panel.querySelectorAll('[data-table]').forEach((btn) => btn.addEventListener('click', () => { f.tab = btn.dataset.table; rerender(); }));
  bindHeatmap(panel);
}
