// dashboard/js/ui/admin/adminBackups.js
// Backups restaurá­veis (7 dias) criados antes de resets. Usado pela aba Backups e pelo detalhe do usuário.
import {
  adminErrorMessage, escapeHtml, fmtDateTime, fmtNumber, mountAsync, openModal, scopeLabels, setBusy, tableLabel,
} from './adminShared.js';

function statusOf(backup) {
  if (backup.restored_at) return { label: 'Restaurado', tone: 'ok' };
  if (backup.expired) return { label: 'Expirado', tone: 'danger' };
  return { label: 'Disponível', tone: 'info' };
}

function totalRows(backup) {
  return Object.values(backup.row_counts || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function renderBackupsTable(backups, { canWrite, showUser = true }) {
  if (!backups.length) {
    return `<p class="adm-note">Nenhum backup. Resets feitos com backup ficam disponíveis aqui por 7 dias.</p>`;
  }
  return `<div class="adm-table-wrap"><table class="adm-table">
    <caption class="adm-sr">Backups de dados de usuários</caption>
    <thead><tr>
      ${showUser ? '<th scope="col">Usuário</th>' : ''}
      <th scope="col">Escopos</th><th scope="col" class="adm-r">Linhas</th>
      <th scope="col">Criado</th><th scope="col">Expira</th><th scope="col">Status</th>
      ${canWrite ? '<th scope="col" class="adm-r">Ações</th>' : ''}
    </tr></thead>
    <tbody>${backups.map((backup) => {
      const status = statusOf(backup);
      const usable = !backup.restored_at && !backup.expired;
      return `<tr>
        ${showUser ? `<td class="adm-user-email">${escapeHtml(backup.target_email || backup.target_user_id)}</td>` : ''}
        <td>${escapeHtml(scopeLabels(backup.scopes).join(', '))}</td>
        <td class="adm-r adm-num">${fmtNumber(totalRows(backup))}</td>
        <td>${fmtDateTime(backup.created_at)}</td>
        <td>${fmtDateTime(backup.expires_at)}</td>
        <td><span class="adm-badge" data-tone="${status.tone}" style="margin-left:0">${status.label}</span></td>
        ${canWrite ? `<td class="adm-r" style="white-space:nowrap">
          ${usable ? `<button type="button" class="adm-btn adm-btn-sm" data-variant="primary" data-restore="${escapeHtml(backup.id)}" data-email="${escapeHtml(backup.target_email || '')}">Restaurar</button>` : ''}
          <button type="button" class="adm-btn adm-btn-sm" data-delete-backup="${escapeHtml(backup.id)}">Excluir</button>
        </td>` : ''}
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function describeRestore(result) {
  const restored = Object.entries(result.restored || {}).filter(([, n]) => n > 0)
    .map(([table, n]) => `${tableLabel(table)}: ${fmtNumber(n)}`);
  const skipped = Object.keys(result.skipped_fk || {}).map(tableLabel);
  return `${restored.length ? restored.join(' · ') : 'Nada novo para restaurar (os dados já existiam).'}${
    skipped.length ? ` — não restaurado por dependência ausente: ${skipped.join(', ')}.` : ''}`;
}

/** Liga os botões Restaurar/Excluir de uma tabela gerada por renderBackupsTable. */
export function bindBackupActions(root, ctx, onChanged) {
  root.querySelectorAll('[data-restore]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.restore;
      const email = button.dataset.email;
      const modal = openModal({
        title: 'Restaurar backup',
        bodyHtml: `<p>Os dados salvos${email ? ` de <strong>${escapeHtml(email)}</strong>` : ''} serão reinseridos. Linhas que já existem são mantidas, não sobrescritas. Cada backup só pode ser restaurado uma vez.</p>`,
        footer: [],
      });
      modal.setFooter([
        { label: 'Cancelar', onClick: ({ close }) => close() },
        {
          label: 'Restaurar agora',
          variant: 'primary',
          onClick: async ({ close, button: confirm }) => {
            setBusy(confirm, true, 'Restaurando…');
            try {
              const result = await ctx.db.adminRestoreBackup(id);
              close();
              ctx.app.showToast(`Backup restaurado. ${describeRestore(result)}`, 'success');
              onChanged();
            } catch (error) {
              setBusy(confirm, false);
              ctx.app.showToast(`Falha ao restaurar: ${adminErrorMessage(error)}`, 'error');
            }
          },
        },
      ]);
    });
  });

  root.querySelectorAll('[data-delete-backup]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Excluir este backup definitivamente? Não será mais possível restaurá-lo.')) return;
      setBusy(button, true);
      try {
        await ctx.db.adminDeleteBackup(button.dataset.deleteBackup);
        ctx.app.showToast('Backup excluído.', 'success');
        onChanged();
      } catch (error) {
        setBusy(button, false);
        ctx.app.showToast(`Falha ao excluir: ${adminErrorMessage(error)}`, 'error');
      }
    });
  });
}

export function renderBackups(el, ctx) {
  return mountAsync(el, {
    errorTitle: 'Não foi possível carregar os backups',
    onSessionError: () => ctx.app.navigate('settings'),
    load: () => ctx.db.adminListBackups(),
    render: (backups) => {
      el.innerHTML = `<section class="adm-section" aria-labelledby="adm-bk-h">
        <header><h2 id="adm-bk-h">Backups de dados</h2>
          <p>Criados automaticamente antes de resets por usuário; expiram em 7 dias. O reset global não gera backup.</p></header>
        ${renderBackupsTable(backups, { canWrite: ctx.canWrite })}
      </section>`;
      bindBackupActions(el, ctx, () => renderBackups(el, ctx));
    },
  });
}
