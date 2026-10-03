// dashboard/js/ui/admin/adminOverview.js
// Aba "Visão geral": saúde do sistema em uma tela — crescimento, atividade, erros, IA e pendências.
import {
  escapeHtml, fmtNumber, mountAsync, renderBarChart, renderBarList,
} from './adminShared.js';

function kpi(label, value, { sub = '', tone = '' } = {}) {
  return `<div class="adm-kpi"${tone ? ` data-tone="${tone}"` : ''}>
    <dt>${escapeHtml(label)}</dt>
    <dd>${fmtNumber(value)}${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</dd>
  </div>`;
}

function buildAlerts(data) {
  const alerts = [];
  if (data.errors_24h > 0) {
    alerts.push({ tone: 'danger', text: `${fmtNumber(data.errors_24h)} erro(s) do cliente nas últimas 24 h.`, tab: 'system', cta: 'Ver erros' });
  }
  if (data.backups_expiring_48h > 0) {
    alerts.push({ tone: 'warn', text: `${fmtNumber(data.backups_expiring_48h)} backup(s) expiram em até 48 h.`, tab: 'backups', cta: 'Ver backups' });
  }
  if (data.totals.suspended > 0) {
    alerts.push({ tone: 'info', text: `${fmtNumber(data.totals.suspended)} conta(s) suspensa(s).`, tab: 'users', cta: 'Ver usuários' });
  }
  return alerts;
}

export function renderOverview(el, ctx) {
  return mountAsync(el, {
    errorTitle: 'Não foi possível carregar a visão geral',
    onSessionError: () => ctx.app.navigate('settings'),
    load: () => ctx.db.adminGetOverview(),
    render: (data) => {
      const totals = data.totals || {};
      const growth = data.growth || {};
      const alerts = buildAlerts({ ...data, totals });

      el.innerHTML = `
        ${alerts.length ? `<div class="adm-alerts" role="region" aria-label="Pendências">
          ${alerts.map((alert) => `<div class="adm-alert" data-tone="${alert.tone === 'warn' ? '' : alert.tone}">
            <span>${escapeHtml(alert.text)}</span>
            <button type="button" class="adm-btn adm-btn-sm" data-variant="quiet" data-go-tab="${alert.tab}">${escapeHtml(alert.cta)}</button>
          </div>`).join('')}
        </div>` : ''}

        <section class="adm-section" aria-labelledby="adm-ov-users">
          <header><h2 id="adm-ov-users">Usuários</h2><p>Quem entrou e quem está estudando.</p></header>
          <dl class="adm-kpis">
            ${kpi('Cadastrados', totals.users, { sub: `+${fmtNumber(growth.new_7d)} em 7 dias · +${fmtNumber(growth.new_30d)} em 30` })}
            ${kpi('Ativos hoje/ontem', growth.active_1d)}
            ${kpi('Ativos em 7 dias', growth.active_7d, { sub: `de ${fmtNumber(totals.users)}` })}
            ${kpi('Ativos em 30 dias', growth.active_30d)}
            ${kpi('Suspensos', totals.suspended, { tone: totals.suspended > 0 ? 'danger' : '' })}
          </dl>
        </section>

        <div class="adm-split adm-section">
          <section aria-labelledby="adm-ov-signups">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-ov-signups" style="font-size:17px">Cadastros por dia (14 dias)</h2></header>
            ${renderBarChart(data.signups_14d || [], { label: 'Cadastros por dia' })}
          </section>
          <section aria-labelledby="adm-ov-content">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-ov-content" style="font-size:17px">Acervo</h2></header>
            <dl class="adm-kpis" style="border-top:0">
              ${kpi('Palavras', totals.words)}
              ${kpi('Flashcards', totals.cards)}
              ${kpi('Revisões', totals.reviews)}
              ${kpi('Histórias', totals.stories)}
            </dl>
          </section>
        </div>

        <div class="adm-split adm-section">
          <section aria-labelledby="adm-ov-ai">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-ov-ai" style="font-size:17px">IA e serviços nas últimas 24 h</h2>
              <p class="adm-note">${fmtNumber(data.api_calls_24h)} chamada(s) no total</p></header>
            ${renderBarList(data.api_by_endpoint_24h || [], { nameKey: 'endpoint', emptyText: 'Nenhuma chamada registrada nas últimas 24 h.' })}
          </section>
          <section aria-labelledby="adm-ov-ops">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-ov-ops" style="font-size:17px">Operação</h2></header>
            <dl class="adm-kpis" style="border-top:0">
              ${kpi('Erros (24 h)', data.errors_24h, { tone: data.errors_24h > 0 ? 'danger' : '' })}
              ${kpi('Backups ativos', data.backups_active)}
              ${kpi('Ações admin (24 h)', data.admin_actions_24h)}
              ${kpi('Administradores', totals.admins)}
            </dl>
          </section>
        </div>`;

      el.querySelectorAll('[data-go-tab]').forEach((button) => {
        button.addEventListener('click', () => ctx.goTab(button.dataset.goTab));
      });
    },
  });
}
