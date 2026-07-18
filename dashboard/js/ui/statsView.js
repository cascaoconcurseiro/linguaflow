// statsView.js — Onda 2.1 (Gerente+Eng. SRS): tela de Estatísticas, paridade
// com o "Stats" do Anki. Consome dados REAIS do Supabase (cards, review_log,
// sessions) através de statsEngine.js (agregação pura, testada em
// tests/engine.test.mjs) — nenhum número aqui é decorativo.

import { db as lfDb } from '../../../utils/db.js';
import {
  retentionByDay,
  studyTimeByDay,
  maturityDistribution,
  forecastByDay,
  summarize,
} from '../core/statsEngine.js';
import { bindViewStateAction, renderViewState } from './viewState.js';

function injectStylesOnce() {
  if (document.getElementById('stats-styles')) return;
  const style = document.createElement('style');
  style.id = 'stats-styles';
  style.textContent = `
    .stats-page { max-width: 900px; margin: 0 auto; padding: 20px; }
    .stats-header { margin-bottom: 20px; }
    .stats-header h2 { margin: 0 0 4px 0; color: var(--color-text); }
    .stats-header p { margin: 0; color: var(--color-text-light); font-size: 14px; }
    .stats-summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .stats-summary-card {
      background: var(--color-surface); border: 2px solid var(--color-border);
      border-radius: var(--radius-md, 12px); padding: 16px; text-align: center;
    }
    .stats-summary-card .icon { font-size: 22px; }
    .stats-summary-card .value { font-size: 24px; font-weight: 900; color: var(--color-text); margin: 4px 0; }
    .stats-summary-card .label { font-size: 12px; color: var(--color-text-light); }
    .stats-summary-card-primary { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
    .stats-evidence-note { margin: -10px 0 24px; color: var(--color-text-light); font-size: 13px; line-height: 1.5; }
    .stats-panel {
      background: var(--color-surface); border: 2px solid var(--color-border);
      border-radius: var(--radius-md, 12px); padding: 16px 18px; margin-bottom: 20px;
    }
    .stats-panel h3 { margin: 0 0 12px 0; font-size: 15px; color: var(--color-text); }
    .stats-bars {
      display: flex; align-items: flex-end; gap: 3px; height: 90px;
      overflow-x: auto; padding-bottom: 4px;
    }
    .stats-bars .stats-bar-col {
      flex: 0 0 auto; width: 18px; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-end; gap: 2px; height: 100%;
    }
    .stats-bars .stats-bar { width: 100%; max-width: 14px; border-radius: 3px 3px 0 0; }
    .stats-bars .stats-bar-label { font-size: 8px; color: var(--color-text-light); }
    .stats-empty { color: var(--color-text-light); font-size: 13px; text-align: center; padding: 20px 0; }
    .stats-maturity-bar { display: flex; height: 26px; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); }
    .stats-maturity-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; font-size: 12px; color: var(--color-text-light); }
    .stats-maturity-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
    .stats-activity-details { margin-top: 4px; }
    .stats-activity-details > summary { cursor: pointer; color: var(--color-text); font-weight: 800; padding: 14px 2px; }
    .stats-activity-details > p { margin: 0 0 12px; color: var(--color-text-light); font-size: 13px; }
  `;
  document.head.appendChild(style);
}

function summaryCard(icon, value, label, primary = false) {
  return `<div class="stats-summary-card${primary ? ' stats-summary-card-primary' : ''}">
    <div class="icon">${icon}</div>
    <div class="value">${value}</div>
    <div class="label">${label}</div>
  </div>`;
}

function weekdayLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()];
}

function renderRetentionBars(days) {
  if (!days.some((d) => d.total > 0)) return `<div class="stats-empty">Sem revisões registradas ainda.</div>`;
  return `<div class="stats-bars">${days.map((d) => {
    const h = d.retention === null ? 2 : Math.max(4, Math.round((d.retention / 100) * 80));
    const color = d.retention === null ? 'var(--color-border)'
      : d.retention >= 85 ? 'var(--color-primary)'
      : d.retention >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
    return `<div class="stats-bar-col" title="${d.date}: ${d.retention === null ? 'sem revisões' : d.retention + '% (' + d.hits + '/' + d.total + ')'}">
      <div class="stats-bar" style="height:${h}px; background:${color};"></div>
      <div class="stats-bar-label">${weekdayLabel(d.date)}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderMinutesBars(days) {
  if (!days.some((d) => d.minutes > 0)) return `<div class="stats-empty">Sem sessões de estudo registradas ainda.</div>`;
  const max = Math.max(...days.map((d) => d.minutes), 1);
  return `<div class="stats-bars">${days.map((d) => {
    const h = d.minutes ? Math.max(4, Math.round((d.minutes / max) * 80)) : 2;
    return `<div class="stats-bar-col" title="${d.date}: ${d.minutes} min">
      <div class="stats-bar" style="height:${h}px; background:var(--color-secondary);"></div>
      <div class="stats-bar-label">${weekdayLabel(d.date)}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderForecastBars(days) {
  if (!days.some((d) => d.count > 0)) return `<div class="stats-empty">Nenhuma revisão agendada nos próximos dias — tudo em dia!</div>`;
  const max = Math.max(...days.map((d) => d.count), 1);
  return `<div class="stats-bars">${days.map((d) => {
    const h = d.count ? Math.max(4, Math.round((d.count / max) * 80)) : 2;
    return `<div class="stats-bar-col" title="${d.date}: ${d.count} card(s)">
      <div class="stats-bar" style="height:${h}px; background:${d.count ? 'var(--color-warning)' : 'var(--color-border)'};"></div>
      <div class="stats-bar-label">${weekdayLabel(d.date)}</div>
    </div>`;
  }).join('')}</div>`;
}

const MATURITY_META = [
  ['new', 'Novas', 'var(--color-border)'],
  ['learning', 'Começando', 'var(--color-warning)'],
  ['review', 'Em revisão', 'var(--color-secondary)'],
  ['mature', 'Memória estável', 'var(--color-primary)'],
  ['suspended', 'Pausadas', 'var(--color-danger)'],
];

function renderMaturity(dist) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return `<div class="stats-empty">Nenhuma expressão adicionada à revisão ainda.</div>`;
  const bar = MATURITY_META.map(([key, , color]) => {
    const pct = (dist[key] / total) * 100;
    return pct > 0 ? `<div style="width:${pct}%; background:${color};" title="${key}: ${dist[key]}"></div>` : '';
  }).join('');
  const legend = MATURITY_META.map(([key, label, color]) =>
    `<span><span class="dot" style="background:${color};"></span>${label}: <strong style="color:var(--color-text);">${dist[key]}</strong></span>`
  ).join('');
  return `<div class="stats-maturity-bar">${bar}</div><div class="stats-maturity-legend">${legend}</div>`;
}

export async function renderStats(container, app) {
  injectStylesOnce();
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({ kind: 'loading', title: 'Calculando seu progresso…', message: 'Lendo revisões, retenção e tempo de prática.' });

  let cards = [], reviewLog = [], sessions = [];
  try {
    ({ cards, reviewLog, sessions } = await lfDb.getStatsSnapshot(60));
  } catch (err) {
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({ kind: 'error', title: 'Não foi possível calcular seu progresso', message: 'Seus registros continuam seguros. Verifique a conexão e tente novamente.', actionLabel: 'Tentar novamente', actionId: 'btn-stats-retry' });
    bindViewStateAction(container, 'btn-stats-retry', () => renderStats(container, app));
    return;
  }

  container.setAttribute('aria-busy', 'false');

  const summary = summarize(cards, sessions, reviewLog);
  const retention = retentionByDay(reviewLog, 30);
  const studyTime = studyTimeByDay(sessions, 30);
  const maturity = maturityDistribution(cards);
  const forecast = forecastByDay(cards, 14);

  if (summary.totalCards === 0) {
    container.innerHTML = renderViewState({ kind: 'empty', title: 'Seu progresso começa com a primeira frase', message: 'Adicione uma expressão à revisão e conclua uma sessão para ver sua evolução.', actionLabel: 'Encontrar uma frase', actionId: 'btn-stats-learn' });
    bindViewStateAction(container, 'btn-stats-learn', () => app.navigate('learn'));
    return;
  }

  container.innerHTML = `
    <div class="stats-page">
      <div class="stats-header">
        <h2>📊 Progresso</h2>
        <p>Memória, constância e carga das próximas revisões.</p>
      </div>

      <div class="stats-summary-grid">
        ${summaryCard('🎯', summary.overallRetention === null ? '—' : summary.overallRetention + '%', 'Lembradas nas revisões · pelas suas notas', true)}
        ${summaryCard('📚', summary.totalCards, 'Expressões na revisão')}
        ${summaryCard('🔁', summary.totalReviews, 'Revisões (60d)')}
        ${summaryCard('⏱️', summary.totalMinutes, 'Minutos de atividade (60d)')}
      </div>
      <p class="stats-evidence-note">O percentual de lembrança é uma estimativa baseada nas suas notas em ${summary.totalReviews} revisões. Estado da memória e agenda ajudam a orientar a próxima sessão. Tempo e volume mostram atividade — não comprovam domínio do idioma.</p>

      <div class="stats-panel">
        <h3>Retenção por dia (últimos 30 dias)</h3>
        ${renderRetentionBars(retention)}
      </div>

      <div class="stats-panel">
        <h3>Previsão de revisões (próximos 14 dias)</h3>
        ${renderForecastBars(forecast)}
      </div>

      <div class="stats-panel">
        <h3>Estado da memória</h3>
        ${renderMaturity(maturity)}
      </div>

      <details class="stats-activity-details">
        <summary>Ver métricas de atividade</summary>
        <p>Úteis para observar constância, mas secundárias à retenção e à carga de revisão.</p>
        <div class="stats-panel">
          <h3>Tempo de atividade por dia (últimos 30 dias)</h3>
          ${renderMinutesBars(studyTime)}
        </div>
      </details>
    </div>
  `;
}
