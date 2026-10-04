// "Reportar problema nesta história" (#435): histórias são geradas por IA e ninguém as revisa antes de
// chegarem ao aluno; este atalho leva o aluno a apontar o problema na hora, pelo canal de relatos que já
// existe (RPC submit_user_report, com limite diário e deduplicação no servidor).
// Não envia o texto da história (só nível e título, que não são dados pessoais).

export const STORY_REPORT_REASONS = [
  { value: 'idioma', kind: 'bug', label: 'Inglês ou tradução errados' },
  { value: 'nivel', kind: 'bug', label: 'O nível não combina com o que escolhi' },
  { value: 'impropria', kind: 'abuso', label: 'Conteúdo impróprio ou ofensivo' },
  { value: 'outro', kind: 'bug', label: 'Outro problema' },
];

const MAX_NOTE = 600;

/** Monta o relato; devolve null se o motivo for inválido. */
export function buildStoryReport({ reason, note = '', level = '', title = '' } = {}) {
  const found = STORY_REPORT_REASONS.find((r) => r.value === reason);
  if (!found) return null;
  const context = ['História', level && String(level).trim(), title && String(title).trim().slice(0, 80)].filter(Boolean).join(' · ');
  const extra = String(note || '').trim().slice(0, MAX_NOTE);
  return { kind: found.kind, message: `[${context}] ${found.label}${extra ? `: ${extra}` : ''}` };
}

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Liga o botão ao painel. `read` devolve { level, title } no momento do clique. */
export function mountStoryReport({ button, panel, db, app, read }) {
  if (!button || !panel) return;
  panel.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', panel.id);

  panel.innerHTML = `
    <form novalidate>
      <fieldset style="border:0;padding:0;margin:0 0 10px;">
        <legend style="font-weight:700;margin-bottom:6px;">O que está errado nesta história?</legend>
        ${STORY_REPORT_REASONS.map((r, i) => `<label style="display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer;"><input type="radio" name="story-report-reason" value="${esc(r.value)}"${i === 0 ? ' checked' : ''}> ${esc(r.label)}</label>`).join('')}
      </fieldset>
      <label for="story-report-note" style="display:block;font-weight:600;margin-bottom:4px;">Detalhe (opcional)</label>
      <textarea id="story-report-note" rows="2" maxlength="${MAX_NOTE}" style="width:100%;padding:8px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text);font:inherit;"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
        <button type="submit" class="btn btn-secondary" style="padding:8px 16px;font-size:14px;">Enviar relato</button>
        <button type="button" data-story-report-cancel style="padding:8px 12px;font-size:14px;background:none;border:0;color:var(--color-text-light);text-decoration:underline;text-underline-offset:3px;cursor:pointer;">Cancelar</button>
        <span role="status" aria-live="polite" data-story-report-status style="font-size:13px;"></span>
      </div>
    </form>`;

  const form = panel.querySelector('form');
  const status = panel.querySelector('[data-story-report-status]');
  const submit = form.querySelector('button[type="submit"]');
  const note = form.querySelector('textarea');

  const toggle = (open) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) form.querySelector('input[type="radio"]:checked')?.focus();
    else button.focus();
  };
  button.addEventListener('click', () => toggle(panel.hidden));
  panel.querySelector('[data-story-report-cancel]').addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); toggle(false); } });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const reason = form.querySelector('input[name="story-report-reason"]:checked')?.value;
    const report = buildStoryReport({ reason, note: note.value, ...(read?.() || {}) });
    if (!report) return;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    status.style.color = 'var(--color-text-light)';
    status.textContent = 'Enviando…';
    try {
      const result = await db.submitUserReport({ ...report, route: 'stories', appVersion: app?.clientBuild || '', userAgent: (navigator.userAgent || '').slice(0, 300) });
      status.style.color = 'var(--color-success-text)';
      status.textContent = result?.duplicate ? 'Você já tinha enviado este relato.' : 'Relato recebido. Obrigado!';
      note.value = '';
      app?.showToast?.('Relato enviado.', 'success');
    } catch (error) {
      console.warn('[StoryReport] send_failed', error?.kind || error?.message);
      status.style.color = 'var(--color-danger)';
      status.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.';
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  });
}
