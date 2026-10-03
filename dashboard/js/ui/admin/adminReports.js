// dashboard/js/ui/admin/adminReports.js
// Aba "Relatos": triagem dos relatos de usuários (novo → em análise → resolvido/descartado) com nota interna.
import {
  adminErrorMessage, escapeHtml, fmtDateTime, fmtNumber, mountAsync, openModal, setBusy, showInlineError,
} from './adminShared.js';

const PAGE_SIZE = 25;
const KIND_LABEL = { bug: 'Bug', sugestao: 'Sugestão', abuso: 'Abuso', seguranca: 'Segurança' };
const STATUS = [
  ['novo', 'Novo', 'danger'],
  ['em_analise', 'Em análise', 'warn'],
  ['resolvido', 'Resolvido', 'ok'],
  ['descartado', 'Descartado', 'info'],
];
const STATUS_META = Object.fromEntries(STATUS.map(([id, label, tone]) => [id, { label, tone }]));

function openTriage(ctx, report, onSaved) {
  const modal = openModal({
    title: `Relato · ${KIND_LABEL[report.kind] || report.kind}`,
    size: 'lg',
    bodyHtml: `
      <p class="adm-note" style="margin-bottom:8px">${escapeHtml(report.email || 'Usuário removido')} · ${fmtDateTime(report.created_at)}
        · tela ${escapeHtml(report.route || '—')} · versão ${escapeHtml(report.app_version || '—')}</p>
      <blockquote style="margin:0 0 12px; padding:10px 12px; border-left:3px solid var(--color-border); background:var(--color-bg-alt); white-space:pre-wrap; word-break:break-word">${escapeHtml(report.message)}</blockquote>
      <p class="adm-note" style="margin-bottom:12px">Navegador: ${escapeHtml(report.user_agent || '—')}</p>
      <label class="adm-field" for="adm-rep-status">Status
        <select id="adm-rep-status">${STATUS.map(([id, label]) => `<option value="${id}" ${report.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="adm-field" for="adm-rep-note" style="margin-top:10px">Resposta/nota (o usuário vê esta nota em "Meus relatos")
        <textarea id="adm-rep-note" maxlength="1000">${escapeHtml(report.admin_note || '')}</textarea></label>`,
    footer: [],
  });

  const draw = () => modal.setFooter([
    { label: 'Fechar', onClick: ({ close }) => close() },
    ...(ctx.canWrite ? [{
      label: 'Salvar triagem',
      variant: 'primary',
      onClick: async ({ close, button }) => {
        setBusy(button, true, 'Salvando…');
        try {
          await ctx.db.adminUpdateReport(report.id, modal.body.querySelector('#adm-rep-status').value,
            modal.body.querySelector('#adm-rep-note').value);
          close();
          ctx.app.showToast('Triagem salva.', 'success');
          onSaved();
        } catch (error) {
          setBusy(button, false);
          showInlineError(modal.body, adminErrorMessage(error));
        }
      },
    }] : []),
  ]);
  draw();
  if (!ctx.canWrite) {
    modal.body.querySelectorAll('select, textarea').forEach((control) => { control.disabled = true; });
  }
}

export function renderReports(el, ctx) {
  const state = { status: '', kind: '', offset: 0 };

  el.innerHTML = `
    <section class="adm-section" aria-labelledby="adm-rep-h">
      <header><h2 id="adm-rep-h">Relatos de usuários</h2>
        <p>Bugs, sugestões, abusos e falhas de segurança enviados pelos usuários (limite de 5 por dia por conta).</p></header>
      <div class="adm-toolbar">
        <label class="adm-field" for="adm-rep-filter-status">Status
          <select id="adm-rep-filter-status"><option value="">Todos</option>
            ${STATUS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        <label class="adm-field" for="adm-rep-filter-kind">Tipo
          <select id="adm-rep-filter-kind"><option value="">Todos</option>
            ${Object.entries(KIND_LABEL).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        <button type="button" class="adm-btn" id="adm-rep-refresh">Atualizar</button>
      </div>
      <p class="adm-note" id="adm-rep-counts" aria-live="polite" style="margin-bottom:8px"></p>
      <div id="adm-rep-list"></div>
    </section>`;

  const list = el.querySelector('#adm-rep-list');
  const counts = el.querySelector('#adm-rep-counts');

  function load() {
    return mountAsync(list, {
      errorTitle: 'Não foi possível carregar os relatos',
      onSessionError: () => ctx.app.navigate('settings'),
      load: () => ctx.db.adminListReports({ status: state.status, kind: state.kind, limit: PAGE_SIZE, offset: state.offset }),
      render: (page) => {
        const c = page.counts || {};
        counts.textContent = `Novos: ${fmtNumber(c.novo)} · Em análise: ${fmtNumber(c.em_analise)} · Resolvidos: ${fmtNumber(c.resolvido)} · Descartados: ${fmtNumber(c.descartado)}`;
        const rows = page.rows || [];
        if (!rows.length) {
          list.innerHTML = '<p class="adm-note" role="status">Nenhum relato com esses filtros.</p>';
          return;
        }
        const total = page.total || 0;
        const to = state.offset + rows.length;
        list.innerHTML = `
          <div class="adm-table-wrap"><table class="adm-table adm-enter">
            <caption class="adm-sr">Relatos de usuários</caption>
            <thead><tr><th scope="col">Quando</th><th scope="col">Tipo</th><th scope="col">Usuário</th><th scope="col">Relato</th><th scope="col">Status</th><th scope="col" class="adm-r">Ações</th></tr></thead>
            <tbody>${rows.map((report) => {
    const meta = STATUS_META[report.status] || { label: report.status, tone: 'info' };
    return `<tr><td style="white-space:nowrap">${fmtDateTime(report.created_at)}</td>
              <td>${escapeHtml(KIND_LABEL[report.kind] || report.kind)}</td>
              <td class="adm-user-email">${escapeHtml(report.email || '—')}</td>
              <td style="max-width:420px; word-break:break-word">${escapeHtml(report.message.slice(0, 220))}${report.message.length > 220 ? '…' : ''}</td>
              <td><span class="adm-badge" data-tone="${meta.tone}" style="margin-left:0">${escapeHtml(meta.label)}</span></td>
              <td class="adm-r"><button type="button" class="adm-btn adm-btn-sm" data-triage="${escapeHtml(report.id)}">${ctx.canWrite ? 'Triar' : 'Abrir'}</button></td></tr>`;
  }).join('')}</tbody></table></div>
          <nav class="adm-pager" aria-label="Paginação dos relatos">
            <span class="adm-note">${state.offset + 1}–${to} de ${fmtNumber(total)}</span>
            <div>
              <button type="button" class="adm-btn adm-btn-sm" id="adm-rep-prev" ${state.offset === 0 ? 'disabled' : ''}>Anterior</button>
              <button type="button" class="adm-btn adm-btn-sm" id="adm-rep-next" ${to >= total ? 'disabled' : ''}>Próxima</button>
            </div>
          </nav>`;
        const byId = new Map(rows.map((report) => [report.id, report]));
        list.querySelectorAll('[data-triage]').forEach((button) => {
          button.addEventListener('click', () => openTriage(ctx, byId.get(button.dataset.triage), load));
        });
        list.querySelector('#adm-rep-prev')?.addEventListener('click', () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); load(); });
        list.querySelector('#adm-rep-next')?.addEventListener('click', () => { state.offset += PAGE_SIZE; load(); });
      },
    });
  }

  el.querySelector('#adm-rep-filter-status').addEventListener('change', (event) => { state.status = event.target.value; state.offset = 0; load(); });
  el.querySelector('#adm-rep-filter-kind').addEventListener('change', (event) => { state.kind = event.target.value; state.offset = 0; load(); });
  el.querySelector('#adm-rep-refresh').addEventListener('click', load);
  return load();
}
