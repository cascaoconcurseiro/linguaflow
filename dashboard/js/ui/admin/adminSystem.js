// dashboard/js/ui/admin/adminSystem.js
// Aba "Sistema": aviso global, erros do cliente, uso de IA e equipe administrativa.
import {
  adminErrorMessage, escapeHtml, fmtDateTime, fmtNumber, mountAsync, renderBarChart, renderBarList, setBusy,
} from './adminShared.js';

// ── Aviso global ─────────────────────────────────────────────────────────────
function renderNotice(el, ctx, notice) {
  const editable = ctx.canWrite;
  el.innerHTML = `
    <form id="adm-notice-form" novalidate>
      <label class="adm-field" for="adm-notice-message">Mensagem (até 280 caracteres)
        <textarea id="adm-notice-message" maxlength="280" ${editable ? '' : 'readonly'}>${escapeHtml(notice.message || '')}</textarea></label>
      <div class="adm-toolbar" style="margin-top:10px">
        <label class="adm-field" for="adm-notice-level">Nível
          <select id="adm-notice-level" ${editable ? '' : 'disabled'}>
            ${[['info', 'Informação'], ['warning', 'Atenção'], ['critical', 'Crítico']].map(([value, label]) =>
    `<option value="${value}" ${notice.level === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select></label>
        <label class="adm-check" style="padding-bottom:6px"><input type="checkbox" id="adm-notice-active" ${notice.active ? 'checked' : ''} ${editable ? '' : 'disabled'} />
          <span>Exibir para todos os usuários</span></label>
        ${editable ? '<button type="submit" class="adm-btn" data-variant="primary" id="adm-notice-save">Salvar aviso</button>' : ''}
      </div>
    </form>`;
  if (!editable) return;
  el.querySelector('#adm-notice-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = el.querySelector('#adm-notice-save');
    setBusy(button, true, 'Salvando…');
    try {
      await ctx.db.adminSetSystemNotice({
        message: el.querySelector('#adm-notice-message').value,
        level: el.querySelector('#adm-notice-level').value,
        active: el.querySelector('#adm-notice-active').checked,
      });
      ctx.app.showToast('Aviso do sistema salvo.', 'success');
    } catch (error) {
      ctx.app.showToast(adminErrorMessage(error), 'error');
    } finally {
      setBusy(button, false);
    }
  });
}

// ── Erros ────────────────────────────────────────────────────────────────────
// Compara versões "a.b.c" numericamente; versão desconhecida nunca é marcada como antiga.
function isOlderVersion(version, current) {
  const parse = (value) => String(value || '').split('.').map((part) => parseInt(part, 10));
  const a = parse(version);
  const b = parse(current);
  if (!a.length || !b.length || a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

function renderErrors(el, ctx, data, reload) {
  const groups = data.groups || [];
  const recent = data.recent || [];
  const current = ctx.app.clientBuild;
  const stillHappening = groups.filter((group) => !isOlderVersion(group.app_version, current));
  el.innerHTML = `
    <p class="adm-note" role="status" style="margin-bottom:10px">${stillHappening.length
    ? `${fmtNumber(stillHappening.length)} tipo(s) de erro ocorrem na versão atual (${escapeHtml(current || '—')}) ou em versão desconhecida: investigar.`
    : `Nenhum erro na versão atual${current ? ` (${escapeHtml(current)})` : ''}. Os registros abaixo vêm de versões antigas, já substituídas.`}</p>
    ${groups.length ? `<div class="adm-table-wrap"><table class="adm-table">
      <caption>Erros agrupados (30 dias)</caption>
      <thead><tr><th scope="col">Origem</th><th scope="col">Erro</th><th scope="col">Versão</th><th scope="col" class="adm-r">Ocorrências</th><th scope="col">Última vez</th></tr></thead>
      <tbody>${groups.map((group) => {
    const old = isOlderVersion(group.app_version, current);
    return `<tr><td>${escapeHtml(group.source || '—')}</td><td>${escapeHtml(group.error_name || '—')}</td>
        <td>${escapeHtml(group.app_version || '—')}${old ? '<span class="adm-badge" data-tone="ok">versão antiga</span>' : '<span class="adm-badge" data-tone="danger">atual</span>'}</td>
        <td class="adm-r adm-num">${fmtNumber(group.count)}</td><td>${fmtDateTime(group.last_seen)}</td></tr>`;
  }).join('')}</tbody></table></div>`
    : '<p class="adm-note" role="status">Nenhum erro nos últimos 30 dias.</p>'}
    ${recent.length ? `<h3 style="font-size:15px;margin:18px 0 6px">Mais recentes</h3><div class="adm-table-wrap"><table class="adm-table">
      <caption class="adm-sr">Erros recentes</caption>
      <thead><tr><th scope="col">Quando</th><th scope="col">Usuário</th><th scope="col">Origem</th><th scope="col">Erro</th><th scope="col">Rota</th><th scope="col">Versão</th></tr></thead>
      <tbody>${recent.slice(0, 20).map((row) => `<tr><td style="white-space:nowrap">${fmtDateTime(row.created_at)}</td>
        <td>${escapeHtml(row.email || '—')}</td><td>${escapeHtml(row.source || '—')}</td><td>${escapeHtml(row.error_name || '—')}</td>
        <td>${escapeHtml(row.route || '—')}</td><td>${escapeHtml(row.app_version || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${ctx.canWrite && recent.length ? '<div class="adm-actions" style="margin-top:12px"><button type="button" class="adm-btn" id="adm-clear-errors">Limpar todos os logs de erro</button></div>' : ''}`;
  el.querySelector('#adm-clear-errors')?.addEventListener('click', async (event) => {
    if (!window.confirm('Apagar todos os registros de erro do cliente? A ação fica registrada na auditoria.')) return;
    const button = event.currentTarget;
    setBusy(button, true, 'Limpando…');
    try {
      await ctx.db.adminClearErrors();
      ctx.app.showToast('Logs de erro limpos.', 'success');
      reload();
    } catch (error) {
      setBusy(button, false);
      ctx.app.showToast(adminErrorMessage(error), 'error');
    }
  });
}

// ── Uso de IA ────────────────────────────────────────────────────────────────
function renderUsage(el, usage) {
  el.innerHTML = `
    <p class="adm-note" style="margin-bottom:10px">${fmtNumber(usage.total)} chamada(s) nos últimos ${fmtNumber(usage.days)} dias.</p>
    ${renderBarChart(usage.by_day || [], { label: 'Chamadas de API por dia' })}
    <div class="adm-split" style="margin-top:18px">
      <div><h3 style="font-size:15px;margin-bottom:8px">Por serviço</h3>${renderBarList(usage.by_endpoint || [], { nameKey: 'endpoint', emptyText: 'Sem chamadas no período.' })}</div>
      <div><h3 style="font-size:15px;margin-bottom:8px">Maiores consumidores</h3>${renderBarList(usage.top_users || [], { nameKey: 'email', emptyText: 'Sem chamadas no período.' })}</div>
    </div>`;
}

// ── Equipe ───────────────────────────────────────────────────────────────────
const ROLE_LABEL = { admin: 'Administrador', support: 'Suporte (somente leitura)' };

function renderTeam(el, ctx, admins, reload) {
  el.innerHTML = `
    <div class="adm-table-wrap"><table class="adm-table">
      <caption class="adm-sr">Equipe administrativa</caption>
      <thead><tr><th scope="col">Conta</th><th scope="col">Papel</th><th scope="col">Desde</th>${ctx.canWrite ? '<th scope="col" class="adm-r">Ações</th>' : ''}</tr></thead>
      <tbody>${admins.map((member) => {
    const self = member.user_id === ctx.currentUser?.id;
    return `<tr><td class="adm-user-email">${escapeHtml(member.email || member.user_id)}${self ? '<span class="adm-badge" data-tone="info">Você</span>' : ''}</td>
        <td>${ROLE_LABEL[member.role] || escapeHtml(member.role)}</td><td>${fmtDateTime(member.created_at)}</td>
        ${ctx.canWrite ? `<td class="adm-r">${self ? '' : `<button type="button" class="adm-btn adm-btn-sm" data-role-user="${escapeHtml(member.user_id)}" data-role-to="${member.role === 'admin' ? 'support' : 'admin'}">Tornar ${member.role === 'admin' ? 'suporte' : 'administrador'}</button>
          <button type="button" class="adm-btn adm-btn-sm" data-role-user="${escapeHtml(member.user_id)}" data-role-to="none">Remover acesso</button>`}</td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>
    ${ctx.canWrite ? `<form id="adm-team-form" class="adm-toolbar" style="margin-top:14px" novalidate>
      <label class="adm-field adm-grow" for="adm-team-email">Conceder acesso a um usuário existente (e-mail exato)
        <input type="text" id="adm-team-email" autocomplete="off" /></label>
      <label class="adm-field" for="adm-team-role">Papel
        <select id="adm-team-role"><option value="support">Suporte (somente leitura)</option><option value="admin">Administrador</option></select></label>
      <button type="submit" class="adm-btn" data-variant="primary">Conceder</button>
    </form>` : ''}`;

  async function setRole(userId, role, button) {
    setBusy(button, true);
    try {
      await ctx.db.adminSetAdminRole(userId, role);
      ctx.app.showToast('Papel atualizado.', 'success');
      reload();
    } catch (error) {
      setBusy(button, false);
      ctx.app.showToast(adminErrorMessage(error), 'error');
    }
  }

  el.querySelectorAll('[data-role-user]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.roleTo === 'none' && !window.confirm('Remover o acesso administrativo desta conta?')) return;
      setRole(button.dataset.roleUser, button.dataset.roleTo, button);
    });
  });

  el.querySelector('#adm-team-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = el.querySelector('#adm-team-email').value.trim().toLowerCase();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (!email) return;
    setBusy(button, true, 'Buscando…');
    try {
      const page = await ctx.db.adminUsersPage({ search: email, limit: 10 });
      const match = (page.rows || []).find((row) => (row.email || '').toLowerCase() === email);
      if (!match) {
        ctx.app.showToast('Nenhum usuário com esse e-mail exato.', 'error');
        setBusy(button, false);
        return;
      }
      await setRole(match.id, el.querySelector('#adm-team-role').value, button);
    } catch (error) {
      setBusy(button, false);
      ctx.app.showToast(adminErrorMessage(error), 'error');
    }
  });
}

export function renderSystem(el, ctx) {
  el.innerHTML = `
    <section class="adm-section" aria-labelledby="adm-sys-notice"><header><h2 id="adm-sys-notice">Aviso do sistema</h2>
      <p>Faixa exibida no topo do dashboard para todos os usuários (manutenção, incidentes, novidades).</p></header><div id="adm-sys-notice-box"></div></section>
    <section class="adm-section" aria-labelledby="adm-sys-errors"><header><h2 id="adm-sys-errors">Erros do cliente</h2>
      <p>Agrupados por origem e nome; sem mensagens livres nem dados pessoais.</p></header><div id="adm-sys-errors-box"></div></section>
    <section class="adm-section" aria-labelledby="adm-sys-usage"><header><h2 id="adm-sys-usage">Uso de IA e serviços</h2>
      <p>Últimos 7 dias.</p></header><div id="adm-sys-usage-box"></div></section>
    <section class="adm-section" aria-labelledby="adm-sys-team"><header><h2 id="adm-sys-team">Equipe administrativa</h2>
      <p>Administradores escrevem; suporte apenas lê.</p></header><div id="adm-sys-team-box"></div></section>`;

  const onSessionError = () => ctx.app.navigate('settings');
  const box = (id) => el.querySelector(`#${id}`);

  const loadErrors = () => mountAsync(box('adm-sys-errors-box'), {
    errorTitle: 'Não foi possível carregar os erros', onSessionError,
    load: () => ctx.db.adminListErrors({ limit: 50 }),
    render: (data) => renderErrors(box('adm-sys-errors-box'), ctx, data, loadErrors),
  });
  const loadTeam = () => mountAsync(box('adm-sys-team-box'), {
    errorTitle: 'Não foi possível carregar a equipe', onSessionError,
    load: () => ctx.db.adminListAdmins(),
    render: (admins) => renderTeam(box('adm-sys-team-box'), ctx, admins, loadTeam),
  });

  return Promise.all([
    mountAsync(box('adm-sys-notice-box'), {
      errorTitle: 'Não foi possível carregar o aviso', onSessionError,
      load: () => ctx.db.adminGetSystemNotice(),
      render: (notice) => renderNotice(box('adm-sys-notice-box'), ctx, notice),
    }),
    loadErrors(),
    mountAsync(box('adm-sys-usage-box'), {
      errorTitle: 'Não foi possível carregar o uso de IA', onSessionError,
      load: () => ctx.db.adminApiUsage(7),
      render: (usage) => renderUsage(box('adm-sys-usage-box'), usage),
    }),
    loadTeam(),
  ]);
}
