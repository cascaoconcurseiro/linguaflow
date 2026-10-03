// dashboard/js/ui/admin/adminAudit.js
// Aba "Auditoria": trilha append-only de toda ação administrativa de escrita.
import {
  ACTION_LABELS, actionLabel, adminErrorMessage, escapeHtml, fmtDateTime, fmtNumber, mountAsync, scopeLabels,
} from './adminShared.js';

const PAGE_SIZE = 50;

function detailsOf(entry) {
  const parts = [];
  const params = entry.params || {};
  const result = entry.result || {};
  if (Array.isArray(params.scopes)) parts.push(`Escopos: ${scopeLabels(params.scopes).join(', ')}`);
  if (params.backup === true) parts.push('com backup');
  if (params.backup === false) parts.push('sem backup');
  if (params.reason) parts.push(`Motivo: ${params.reason}`);
  if (params.from !== undefined || params.to !== undefined) parts.push(`Papel: ${params.from || 'nenhum'} → ${params.to}`);
  if (result.total !== undefined) parts.push(`${fmtNumber(result.total)} linha(s)`);
  if (result.errors_cleared !== undefined) parts.push(`${fmtNumber(result.errors_cleared)} erro(s)`);
  if (result.sessions !== undefined) parts.push(`${fmtNumber(result.sessions)} sessão(ões)`);
  if (params.message) parts.push(`“${params.message}”`);
  return parts.join(' · ') || '—';
}

export function renderAudit(el, ctx) {
  const state = { action: '', offset: 0 };

  el.innerHTML = `
    <section class="adm-section" aria-labelledby="adm-audit-h">
      <header><h2 id="adm-audit-h">Trilha de auditoria</h2>
        <p>Registro imutável: ninguém, nem administradores, consegue editar ou apagar estas linhas.</p></header>
      <div class="adm-toolbar">
        <label class="adm-field" for="adm-audit-filter">Ação
          <select id="adm-audit-filter"><option value="">Todas</option>
            ${Object.entries(ACTION_LABELS).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}
          </select></label>
        <button type="button" class="adm-btn" id="adm-audit-refresh">Atualizar</button>
      </div>
      <div id="adm-audit-list"></div>
    </section>`;

  const list = el.querySelector('#adm-audit-list');

  function load() {
    return mountAsync(list, {
      errorTitle: 'Não foi possível carregar a auditoria',
      onSessionError: () => ctx.app.navigate('settings'),
      load: () => ctx.db.adminListAudit({ limit: PAGE_SIZE, offset: state.offset, action: state.action || null }),
      render: (page) => {
        const rows = page.rows || [];
        if (!rows.length) {
          list.innerHTML = '<p class="adm-note" role="status">Nenhuma ação registrada ainda.</p>';
          return;
        }
        const total = page.total || 0;
        const to = state.offset + rows.length;
        list.innerHTML = `
          <div class="adm-table-wrap"><table class="adm-table adm-enter">
            <caption>${fmtNumber(total)} registro(s)</caption>
            <thead><tr><th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">Alvo</th><th scope="col">Detalhes</th></tr></thead>
            <tbody>${rows.map((entry) => `<tr>
              <td style="white-space:nowrap">${fmtDateTime(entry.created_at)}</td>
              <td>${escapeHtml(entry.actor_email || 'sistema')}</td>
              <td><strong>${escapeHtml(actionLabel(entry.action))}</strong></td>
              <td>${escapeHtml(entry.target_email || (entry.target_user_id ? entry.target_user_id : '—'))}</td>
              <td class="adm-note">${escapeHtml(detailsOf(entry))}</td>
            </tr>`).join('')}</tbody>
          </table></div>
          <nav class="adm-pager" aria-label="Paginação da auditoria">
            <span class="adm-note">${state.offset + 1}–${to} de ${fmtNumber(total)}</span>
            <div>
              <button type="button" class="adm-btn adm-btn-sm" id="adm-audit-prev" ${state.offset === 0 ? 'disabled' : ''}>Anterior</button>
              <button type="button" class="adm-btn adm-btn-sm" id="adm-audit-next" ${to >= total ? 'disabled' : ''}>Próxima</button>
            </div>
          </nav>`;
        list.querySelector('#adm-audit-prev')?.addEventListener('click', () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); load(); });
        list.querySelector('#adm-audit-next')?.addEventListener('click', () => { state.offset += PAGE_SIZE; load(); });
      },
    });
  }

  el.querySelector('#adm-audit-filter').addEventListener('change', (event) => {
    state.action = event.target.value;
    state.offset = 0;
    load();
  });
  el.querySelector('#adm-audit-refresh').addEventListener('click', load);
  return load().catch((error) => { list.textContent = adminErrorMessage(error); });
}
