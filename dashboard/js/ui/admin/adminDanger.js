// dashboard/js/ui/admin/adminDanger.js
// Aba "Zona de perigo": reset global por escopo. Sem backup; exige PIN recente e frase validada no servidor.
import {
  RESET_SCOPES, adminErrorMessage, confirmTyped, escapeHtml, fmtNumber, isSessionError, setBusy, tableLabel,
} from './adminShared.js';

const PHRASE = 'RESETAR TODOS';

function renderPreview(result) {
  const rows = Object.entries(result.counts || {}).filter(([, n]) => n > 0);
  if (!rows.length) return '<p class="adm-note" role="status">Nenhum dado nestes escopos. Nada será apagado.</p>';
  return `<div class="adm-table-wrap"><table class="adm-table">
    <caption>Impacto: ${fmtNumber(result.total)} linha(s) de ${fmtNumber(result.users)} usuário(s)</caption>
    <thead><tr><th scope="col">Dado</th><th scope="col" class="adm-r">Linhas</th></tr></thead>
    <tbody>${rows.map(([table, n]) => `<tr><td>${escapeHtml(tableLabel(table))}</td><td class="adm-r adm-num">${fmtNumber(n)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export function renderDanger(el, ctx) {
  el.innerHTML = `
    <section class="adm-section adm-danger" aria-labelledby="adm-danger-h">
      <header style="border:0"><h2 id="adm-danger-h">Reset global de dados dos usuários</h2></header>
      <p class="adm-note" style="margin-bottom:12px">
        Apaga os dados escolhidos de <strong>todas</strong> as contas. As contas, o catálogo de cursos e o léxico canônico são preservados.
        <strong>Não há backup nem desfazer.</strong> Para zerar o banco inteiro, use um projeto/branch novo e reaplique as migrations — não há botão para isso de propósito.
        Exige PIN validado nos últimos 5 minutos.
      </p>
      <fieldset><legend>Escopos</legend>
        ${RESET_SCOPES.map((scope) => `<label class="adm-check"><input type="checkbox" name="scope" value="${scope.id}" />
          <span>${escapeHtml(scope.label)}<small>${escapeHtml(scope.hint)}</small></span></label>`).join('')}
      </fieldset>
      <div id="adm-danger-preview" aria-live="polite"></div>
      <div class="adm-actions" style="margin-top:12px">
        <button type="button" class="adm-btn" id="adm-danger-calc" disabled>Calcular impacto</button>
        <button type="button" class="adm-btn" data-variant="danger" id="adm-danger-run" disabled>Resetar dados de todos…</button>
      </div>
      <div id="adm-danger-error"></div>
    </section>`;

  const inputs = [...el.querySelectorAll('input[name="scope"]')];
  const calc = el.querySelector('#adm-danger-calc');
  const run = el.querySelector('#adm-danger-run');
  const preview = el.querySelector('#adm-danger-preview');
  const errorBox = el.querySelector('#adm-danger-error');
  const selected = () => inputs.filter((input) => input.checked).map((input) => input.value);
  let previewed = false;

  function sync() {
    calc.disabled = selected().length === 0;
    run.disabled = !previewed;
  }

  function showError(error) {
    errorBox.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'adm-inline-error';
    box.setAttribute('role', 'alert');
    box.textContent = isSessionError(error)
      ? `${adminErrorMessage(error)} Revalide o PIN nas Configurações e tente de novo.`
      : adminErrorMessage(error);
    errorBox.appendChild(box);
  }

  inputs.forEach((input) => input.addEventListener('change', () => {
    previewed = false;
    preview.innerHTML = '';
    errorBox.innerHTML = '';
    sync();
  }));

  calc.addEventListener('click', async () => {
    setBusy(calc, true, 'Calculando…');
    errorBox.innerHTML = '';
    try {
      preview.innerHTML = renderPreview(await ctx.db.adminResetAllUsersData(selected(), { dryRun: true }));
      previewed = true;
    } catch (error) {
      showError(error);
    } finally {
      setBusy(calc, false);
      sync();
    }
  });

  run.addEventListener('click', () => {
    const scopes = selected();
    confirmTyped({
      title: 'Resetar dados de TODOS os usuários',
      message: 'Esta ação é irreversível e não gera backup. A auditoria registrará quem executou e o volume apagado.',
      phrase: PHRASE,
      confirmLabel: 'Apagar dados de todos',
      onConfirm: async () => {
        const result = await ctx.db.adminResetAllUsersData(scopes, { dryRun: false, confirmPhrase: PHRASE });
        ctx.app.showToast(`Reset global concluído (${fmtNumber(result.total)} linhas).`, 'success');
        previewed = false;
        preview.innerHTML = '';
        sync();
      },
    });
  });

  sync();
}
