// dashboard/js/ui/admin/adminUserDetail.js
// Diálogo de gestão de um usuário: fatos, volumes por tabela, backups, trilha e ações (conforme o papel).
import {
  actionLabel, adminErrorMessage, confirmTyped, downloadJson, escapeHtml, fmtDate, fmtDateTime,
  fmtDuration, fmtNumber, fmtRelative, openModal, setBusy, showInlineError, tableLabel,
} from './adminShared.js';
import { bindBackupActions, renderBackupsTable } from './adminBackups.js';
import { openResetDialog } from './adminResetDialog.js';

function fact(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function renderCounts(counts) {
  const rows = Object.entries(counts || {}).filter(([, n]) => n > 0);
  if (!rows.length) return '<p class="adm-note">Este usuário ainda não tem dados de estudo.</p>';
  return `<div class="adm-table-wrap"><table class="adm-table">
    <caption class="adm-sr">Volume de dados por tabela</caption>
    <thead><tr><th scope="col">Dado</th><th scope="col" class="adm-r">Linhas</th></tr></thead>
    <tbody>${rows.map(([table, n]) => `<tr><td>${escapeHtml(tableLabel(table))}</td><td class="adm-r adm-num">${fmtNumber(n)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export async function openUserDetail(ctx, userId, onChanged) {
  const modal = openModal({
    title: 'Usuário',
    size: 'lg',
    bodyHtml: '<div class="adm-skel" role="status"><span class="adm-sr">Carregando…</span><span class="adm-skel-tall"></span><span></span><span></span></div>',
    footer: [{ label: 'Fechar', onClick: ({ close }) => close() }],
  });

  let detail;
  let backups;
  try {
    [detail, backups] = await Promise.all([
      ctx.db.adminGetUserDetail(userId),
      ctx.db.adminListBackups(userId),
    ]);
  } catch (error) {
    modal.body.innerHTML = '';
    showInlineError(modal.body, adminErrorMessage(error));
    return;
  }

  const isSelf = ctx.currentUser?.id === detail.id;
  const isStaff = Boolean(detail.role);
  const refresh = () => {
    modal.close();
    onChanged?.();
    openUserDetail(ctx, userId, onChanged);
  };

  modal.el.querySelector('h2').textContent = detail.email || 'Usuário';

  const badges = [
    isSelf ? '<span class="adm-badge" data-tone="info">Você</span>' : '',
    detail.role ? `<span class="adm-badge" data-tone="info">${detail.role === 'admin' ? 'Admin' : 'Suporte'}</span>` : '',
    detail.suspended ? '<span class="adm-badge" data-tone="danger">Suspenso</span>' : '',
  ].join('');

  const profile = detail.profile || {};
  const canManage = ctx.canWrite;
  const canSuspend = canManage && !isSelf && !isStaff;

  modal.body.innerHTML = `
    <p style="margin-bottom:12px">${badges}</p>
    <dl class="adm-facts">
      ${fact('Cadastro', fmtDate(detail.created_at))}
      ${fact('Último acesso', `${fmtDateTime(detail.last_sign_in_at)} (${fmtRelative(detail.last_sign_in_at)})`)}
      ${fact('E-mail confirmado', detail.email_confirmed ? 'Sim' : 'Não')}
      ${fact('Nome de usuário', escapeHtml(profile.username || '—'))}
      ${fact('XP total / semana', `${fmtNumber(profile.xp_total)} / ${fmtNumber(profile.xp_week)}`)}
      ${fact('Ofensiva', `${fmtNumber(profile.streak)} dia(s)`)}
      ${fact('Último estudo', fmtDate(profile.last_study_date))}
      ${fact('Tempo de estudo', fmtDuration(detail.study_seconds))}
      ${fact('Chamadas de IA (30 d)', fmtNumber(detail.api_calls_30d))}
      ${fact('Erros (7 d)', fmtNumber(detail.errors_7d))}
      ${fact('Fuso', escapeHtml(profile.timezone || '—'))}
      ${fact('E-mails de reengajamento', profile.email_opt_in ? 'Aceita' : 'Não aceita')}
    </dl>

    <h3 style="font-size:15px;margin:18px 0 6px">Dados armazenados</h3>
    ${renderCounts(detail.counts)}

    <h3 style="font-size:15px;margin:18px 0 6px">Backups deste usuário</h3>
    <div id="adm-ud-backups">${renderBackupsTable(backups, { canWrite: canManage, showUser: false })}</div>

    <h3 style="font-size:15px;margin:18px 0 6px">Ações administrativas recentes</h3>
    ${(detail.recent_audit || []).length
    ? `<ul class="adm-note" style="padding-left:18px;margin:0">${detail.recent_audit.map((entry) =>
      `<li>${escapeHtml(actionLabel(entry.action))} — ${escapeHtml(entry.actor_email || 'sistema')}, ${fmtDateTime(entry.created_at)}</li>`).join('')}</ul>`
    : '<p class="adm-note">Nenhuma ação registrada para este usuário.</p>'}

    ${canManage ? `<h3 style="font-size:15px;margin:18px 0 8px">Ações</h3>
      <div class="adm-actions">
        <button type="button" class="adm-btn" id="adm-ud-reset" data-variant="danger">Resetar dados…</button>
        <button type="button" class="adm-btn" id="adm-ud-export">Exportar dados (JSON)</button>
        ${canSuspend ? `<button type="button" class="adm-btn" id="adm-ud-suspend">${detail.suspended ? 'Reativar conta' : 'Suspender conta…'}</button>` : ''}
        ${!isSelf ? '<button type="button" class="adm-btn" id="adm-ud-revoke">Encerrar sessões</button>' : ''}
        ${canSuspend ? '<button type="button" class="adm-btn" id="adm-ud-delete" data-variant="danger">Excluir conta…</button>' : ''}
      </div>
      <p class="adm-note" style="margin-top:8px">Prefira suspender a excluir: a suspensão é reversível. A exclusão apaga a conta e todos os dados e não pode ser desfeita. A suspensão bloqueia novos logins e renovações; uma sessão já aberta pode durar até cerca de 1 hora.</p>`
    : '<p class="adm-note" style="margin-top:14px">Perfil de suporte: somente leitura.</p>'}`;

  bindBackupActions(modal.body.querySelector('#adm-ud-backups'), ctx, refresh);

  const on = (id, handler) => modal.body.querySelector(`#${id}`)?.addEventListener('click', handler);

  on('adm-ud-reset', () => openResetDialog(ctx, detail, refresh));

  on('adm-ud-export', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Exportando…');
    try {
      const data = await ctx.db.adminExportUserData(detail.id);
      downloadJson(`linguaflow-${detail.id}.json`, data);
      ctx.app.showToast('Exportação concluída e registrada na auditoria.', 'success');
    } catch (error) {
      ctx.app.showToast(`Falha ao exportar: ${adminErrorMessage(error)}`, 'error');
    } finally {
      setBusy(button, false);
    }
  });

  on('adm-ud-suspend', async (event) => {
    const button = event.currentTarget;
    if (detail.suspended) {
      setBusy(button, true);
      try {
        await ctx.db.adminSetUserSuspended(detail.id, false);
        ctx.app.showToast('Conta reativada.', 'success');
        refresh();
      } catch (error) {
        setBusy(button, false);
        ctx.app.showToast(adminErrorMessage(error), 'error');
      }
      return;
    }
    const reason = window.prompt('Motivo da suspensão (fica registrado na auditoria):', '');
    if (reason === null) return;
    setBusy(button, true);
    try {
      await ctx.db.adminSetUserSuspended(detail.id, true, reason.trim() || null);
      ctx.app.showToast('Conta suspensa.', 'success');
      refresh();
    } catch (error) {
      setBusy(button, false);
      ctx.app.showToast(adminErrorMessage(error), 'error');
    }
  });

  on('adm-ud-revoke', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true);
    try {
      const result = await ctx.db.adminRevokeUserSessions(detail.id);
      ctx.app.showToast(`${fmtNumber(result.sessions_revoked)} sessão(ões) encerrada(s).`, 'success');
    } catch (error) {
      ctx.app.showToast(adminErrorMessage(error), 'error');
    } finally {
      setBusy(button, false);
    }
  });

  on('adm-ud-delete', () => {
    confirmTyped({
      title: `Excluir conta: ${detail.email}`,
      message: 'A conta e todos os dados serão apagados em definitivo. Esta ação não pode ser desfeita e não gera backup.',
      phrase: detail.email,
      confirmLabel: 'Excluir definitivamente',
      onConfirm: async () => {
        await ctx.db.adminDeleteUser(detail.id);
        ctx.app.showToast(`Conta de ${detail.email} excluída.`, 'success');
        modal.close();
        onChanged?.();
      },
    });
  });
}
