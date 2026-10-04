// dashboard/js/ui/reportProblem.js
// "Ajuda e relatos" nas Configurações (#412): o usuário descreve um bug, sugestão, abuso ou falha de
// segurança. O servidor valida, limita a 5 por dia e deduplica; aqui há estados explícitos de envio.
import { db as lfDb } from '../../../utils/db.js';
import { escapeHtml } from './viewState.js';

const KINDS = [
  ['bug', 'Algo quebrou ou não funciona'],
  ['sugestao', 'Sugestão de melhoria'],
  ['abuso', 'Conteúdo ou comportamento indevido'],
  ['seguranca', 'Possível falha de segurança'],
];
const KIND_LABEL = Object.fromEntries(KINDS);
const STATUS_LABEL = { novo: 'Recebido', em_analise: 'Em análise', resolvido: 'Resolvido', descartado: 'Encerrado' };

function friendlyError(error) {
  const raw = String(error?.message || '');
  const json = raw.slice(raw.indexOf('{'));
  try {
    const parsed = JSON.parse(json);
    if (parsed?.message) return parsed.message;
  } catch { /* corpo não era JSON: usa mensagem genérica abaixo */ }
  return 'Não foi possível enviar agora. Tente novamente em instantes.';
}

export function reportCardHtml() {
  return `
    <p style="color:var(--color-text-light); margin-bottom:12px; line-height:1.5;">
      Encontrou um erro, abuso ou algo que parece inseguro? Conte aqui. Não inclua senhas nem dados pessoais.
    </p>
    <form id="report-form" novalidate>
      <label for="report-kind" style="display:block; font-weight:700; font-size:13px; margin-bottom:4px;">Tipo</label>
      <select id="report-kind" style="width:100%; min-height:44px; padding:8px; margin-bottom:12px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg); color:var(--color-text);">
        ${KINDS.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('')}
      </select>
      <label for="report-message" style="display:block; font-weight:700; font-size:13px; margin-bottom:4px;">O que aconteceu?</label>
      <textarea id="report-message" rows="4" maxlength="2000" aria-describedby="report-count report-status"
        style="width:100%; padding:10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-bg); color:var(--color-text); font:inherit;"></textarea>
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-top:6px; flex-wrap:wrap;">
        <span id="report-count" style="font-size:12px; color:var(--color-text-light);">0 / 2000 (mínimo 10)</span>
        <button id="report-submit" type="submit" class="btn btn-secondary" disabled>Enviar relato</button>
      </div>
      <p id="report-status" role="status" aria-live="polite" style="font-size:13px; margin-top:8px; min-height:18px;"></p>
    </form>
    <h3 style="font-size:15px; margin:16px 0 6px;">Meus relatos</h3>
    <div id="report-list" aria-live="polite"></div>`;
}

export function mountReportCard(root, app) {
  if (!root) return;
  root.innerHTML = reportCardHtml();
  const form = root.querySelector('#report-form');
  const message = root.querySelector('#report-message');
  const kind = root.querySelector('#report-kind');
  const submit = root.querySelector('#report-submit');
  const status = root.querySelector('#report-status');
  const count = root.querySelector('#report-count');
  const list = root.querySelector('#report-list');

  function sync() {
    const length = message.value.trim().length;
    count.textContent = `${message.value.length} / 2000 (mínimo 10)`;
    submit.disabled = length < 10;
  }

  async function loadList() {
    list.innerHTML = '<p style="font-size:13px; color:var(--color-text-light);">Carregando…</p>';
    try {
      const reports = await lfDb.listMyReports();
      if (!reports.length) {
        list.innerHTML = '<p style="font-size:13px; color:var(--color-text-light);">Você ainda não enviou relatos.</p>';
        return;
      }
      list.innerHTML = `<ul style="list-style:none; margin:0; padding:0; display:grid; gap:8px;">${reports.map((report) => `
        <li style="padding:10px 12px; border-left:3px solid var(--color-border); background:var(--color-bg-alt); font-size:13px;">
          <strong>${escapeHtml(KIND_LABEL[report.kind] || report.kind)}</strong>
          · ${escapeHtml(STATUS_LABEL[report.status] || report.status)}
          · ${new Date(report.created_at).toLocaleDateString('pt-BR')}
          <div style="margin-top:4px; color:var(--color-text-light);">${escapeHtml(report.message.slice(0, 160))}${report.message.length > 160 ? '…' : ''}</div>
          ${report.admin_note ? `<div style="margin-top:4px;"><strong>Resposta:</strong> ${escapeHtml(report.admin_note)}</div>` : ''}
        </li>`).join('')}</ul>`;
    } catch {
      list.innerHTML = '<p style="font-size:13px; color:var(--color-danger);" role="alert">Não foi possível carregar seus relatos.</p>';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.style.color = 'var(--color-text-light)';
    status.textContent = 'Enviando…';
    try {
      const result = await lfDb.submitUserReport({
        kind: kind.value,
        message: message.value,
        route: app?.currentRoute || '',
        appVersion: app?.clientBuild || '',
        userAgent: (navigator.userAgent || '').slice(0, 300),
      });
      message.value = '';
      status.style.color = 'var(--color-success-text)';
      status.textContent = result?.duplicate ? 'Você já tinha enviado este relato.' : 'Relato recebido. Obrigado!';
      app?.showToast?.('Relato enviado.', 'success');
      loadList();
    } catch (error) {
      status.style.color = 'var(--color-danger)';
      status.textContent = friendlyError(error);
    } finally {
      sync();
    }
  });

  message.addEventListener('input', sync);
  sync();
  loadList();
}
