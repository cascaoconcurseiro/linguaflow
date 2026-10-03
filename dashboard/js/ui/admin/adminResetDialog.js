// dashboard/js/ui/admin/adminResetDialog.js
// Reset granular de dados de um usuário: escolher escopos -> dry-run (contagens) -> confirmar digitando o e-mail.
import {
  RESET_SCOPES, adminErrorMessage, clearInlineError, escapeHtml, fmtNumber, openModal, setBusy,
  showInlineError, tableLabel,
} from './adminShared.js';

function renderCounts(result) {
  const rows = Object.entries(result.counts || {}).filter(([, n]) => n > 0);
  if (!rows.length) return '<p class="adm-note">Nenhum dado nestes escopos. Nada será apagado.</p>';
  return `<div class="adm-table-wrap"><table class="adm-table">
    <caption>Linhas que serão apagadas — total ${fmtNumber(result.total)}</caption>
    <thead><tr><th scope="col">Dado</th><th scope="col" class="adm-r">Linhas</th></tr></thead>
    <tbody>${rows.map(([table, n]) => `<tr><td>${escapeHtml(tableLabel(table))}</td><td class="adm-r adm-num">${fmtNumber(n)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export function openResetDialog(ctx, user, onDone) {
  const scopeHtml = RESET_SCOPES.map((scope) => `
    <label class="adm-check">
      <input type="checkbox" name="scope" value="${scope.id}" />
      <span>${escapeHtml(scope.label)}<small>${escapeHtml(scope.hint)}</small></span>
    </label>`).join('');

  const modal = openModal({
    title: `Resetar dados de ${user.email}`,
    size: 'lg',
    tone: 'danger',
    bodyHtml: `
      <p class="adm-note" style="margin-bottom:10px">A conta, o login e o perfil continuam existindo. Escolha o que apagar e confira o impacto antes de confirmar.</p>
      <fieldset><legend>O que apagar</legend>${scopeHtml}</fieldset>
      <label class="adm-check"><input type="checkbox" id="adm-reset-backup" checked />
        <span>Criar backup restaurável por 7 dias<small>Recomendado. Aparece na aba Backups e no detalhe do usuário.</small></span></label>
      <div id="adm-reset-preview" aria-live="polite"></div>
      <div id="adm-reset-confirm" hidden>
        <label class="adm-field" for="adm-reset-email" style="margin-top:12px">Para confirmar, digite o e-mail <strong style="color:var(--color-danger)">${escapeHtml(user.email)}</strong>
          <input type="text" id="adm-reset-email" autocomplete="off" spellcheck="false" />
        </label>
      </div>`,
    footer: [],
  });

  const preview = modal.body.querySelector('#adm-reset-preview');
  const confirmBox = modal.body.querySelector('#adm-reset-confirm');
  const emailInput = modal.body.querySelector('#adm-reset-email');
  const backupInput = modal.body.querySelector('#adm-reset-backup');
  const scopeInputs = [...modal.body.querySelectorAll('input[name="scope"]')];
  let previewed = false;
  let busy = false;

  const selected = () => scopeInputs.filter((input) => input.checked).map((input) => input.value);

  function render() {
    const hasScopes = selected().length > 0;
    modal.setFooter([
      { label: 'Cancelar', onClick: ({ close }) => close() },
      previewed
        ? {
          id: 'adm-reset-run',
          label: 'Apagar dados',
          variant: 'danger',
          disabled: busy || emailInput.value.trim().toLowerCase() !== user.email.toLowerCase(),
          onClick: run,
        }
        : { id: 'adm-reset-preview-btn', label: 'Calcular impacto', variant: 'primary', disabled: busy || !hasScopes, onClick: calculate },
    ]);
  }

  function invalidate() {
    previewed = false;
    confirmBox.hidden = true;
    preview.innerHTML = '';
    clearInlineError(modal.body);
    render();
  }

  async function calculate({ button }) {
    setBusy(button, true, 'Calculando…');
    clearInlineError(modal.body);
    try {
      const result = await ctx.db.adminResetUserData(user.id, selected(), { dryRun: true });
      preview.innerHTML = renderCounts(result);
      previewed = true;
      confirmBox.hidden = false;
      render();
      emailInput.focus();
    } catch (error) {
      setBusy(button, false);
      showInlineError(modal.body, adminErrorMessage(error));
    }
  }

  async function run({ close, button }) {
    busy = true;
    setBusy(button, true, 'Apagando…');
    try {
      const result = await ctx.db.adminResetUserData(user.id, selected(), { dryRun: false, backup: backupInput.checked });
      close();
      ctx.app.showToast(
        `Dados de ${user.email} apagados (${fmtNumber(result.total)} linhas).${result.backup_id ? ' Backup criado por 7 dias.' : ' Sem backup.'}`,
        'success',
      );
      onDone?.();
    } catch (error) {
      busy = false;
      showInlineError(modal.body, adminErrorMessage(error));
      render();
    }
  }

  scopeInputs.forEach((input) => input.addEventListener('change', invalidate));
  backupInput.addEventListener('change', render);
  emailInput.addEventListener('input', render);
  render();
  return modal;
}
