// dashboard/js/ui/admin/adminUsers.js
// Aba "Usuários": busca no servidor, filtros e paginação; a gestão individual abre no diálogo de detalhe.
import {
  adminErrorMessage, debounce, escapeHtml, fmtDate, fmtNumber, fmtRelative, renderSkeleton,
} from './adminShared.js';
import { openUserDetail } from './adminUserDetail.js';

const PAGE_SIZE = 25;

const FILTERS = [
  ['all', 'Todos'],
  ['new_7d', 'Novos (7 dias)'],
  ['inactive_30d', 'Inativos há 30+ dias'],
  ['suspended', 'Suspensos'],
  ['admins', 'Equipe (admin/suporte)'],
];

function rowHtml(user, ctx) {
  const isSelf = ctx.currentUser?.id === user.id;
  const badges = [
    isSelf ? '<span class="adm-badge" data-tone="info">Você</span>' : '',
    user.role ? `<span class="adm-badge" data-tone="info">${user.role === 'admin' ? 'Admin' : 'Suporte'}</span>` : '',
    user.suspended ? '<span class="adm-badge" data-tone="danger">Suspenso</span>' : '',
  ].join('');
  return `<tr>
    <td><div class="adm-user-email">${escapeHtml(user.email || 'Sem e-mail')}${badges}</div>
      <div class="adm-user-sub">${escapeHtml(user.username || '')}</div></td>
    <td>${fmtDate(user.created_at)}</td>
    <td title="${escapeHtml(user.last_sign_in_at || '')}">${fmtRelative(user.last_sign_in_at)}</td>
    <td class="adm-r adm-num">${fmtNumber(user.total_words)}</td>
    <td class="adm-r adm-num">${fmtNumber(user.total_cards)}</td>
    <td class="adm-r adm-num">${fmtNumber(user.total_reviews)}</td>
    <td class="adm-r adm-num">${fmtNumber(user.xp_total)} XP${user.streak > 0 ? ` · ${fmtNumber(user.streak)} d` : ''}</td>
    <td class="adm-r"><button type="button" class="adm-btn adm-btn-sm" data-manage="${escapeHtml(user.id)}"
      aria-label="Gerenciar ${escapeHtml(user.email || 'usuário')}">Gerenciar</button></td>
  </tr>`;
}

export function renderUsers(el, ctx) {
  const state = { search: '', filter: 'all', offset: 0 };

  el.innerHTML = `
    <section class="adm-section" aria-labelledby="adm-users-h">
      <header><h2 id="adm-users-h">Gestão de usuários</h2>
        <p>Busque por e-mail ou nome de usuário. A gestão individual abre em "Gerenciar".</p></header>
      <div class="adm-toolbar">
        <label class="adm-field adm-grow" for="admin-user-search">Buscar usuário
          <input type="search" id="admin-user-search" placeholder="e-mail ou nome de usuário" autocomplete="off" />
        </label>
        <label class="adm-field" for="admin-user-filter">Filtro
          <select id="admin-user-filter">${FILTERS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
        </label>
        <button type="button" class="adm-btn" id="admin-user-refresh">Atualizar</button>
      </div>
      <p class="adm-note" id="admin-user-count" aria-live="polite" style="margin-bottom:8px"></p>
      <div id="admin-user-results" aria-busy="false"></div>
    </section>`;

  const results = el.querySelector('#admin-user-results');
  const count = el.querySelector('#admin-user-count');
  let requestId = 0;

  async function load() {
    const current = ++requestId;
    results.setAttribute('aria-busy', 'true');
    results.innerHTML = renderSkeleton(6);
    try {
      const page = await ctx.db.adminUsersPage({
        search: state.search, filter: state.filter, limit: PAGE_SIZE, offset: state.offset,
      });
      if (current !== requestId) return;
      draw(page);
    } catch (error) {
      if (current !== requestId) return;
      results.innerHTML = `<div class="adm-inline-error" role="alert">${escapeHtml(adminErrorMessage(error))}
        <button type="button" class="adm-btn adm-btn-sm" id="admin-user-retry" style="margin-left:8px">Tentar novamente</button></div>`;
      results.querySelector('#admin-user-retry')?.addEventListener('click', load);
      count.textContent = '';
    } finally {
      if (current === requestId) results.setAttribute('aria-busy', 'false');
    }
  }

  function draw(page) {
    const rows = page.rows || [];
    const total = page.total || 0;
    const from = total ? state.offset + 1 : 0;
    const to = state.offset + rows.length;
    count.textContent = total ? `Mostrando ${from}–${to} de ${fmtNumber(total)} usuário(s).` : '';

    if (!rows.length) {
      results.innerHTML = `<p class="adm-note" role="status">${state.search || state.filter !== 'all'
        ? 'Nenhum usuário encontrado com esses critérios.' : 'Nenhum usuário cadastrado.'}</p>`;
      return;
    }

    results.innerHTML = `
      <div class="adm-table-wrap"><table class="adm-table adm-enter">
        <caption class="adm-sr">Usuários cadastrados</caption>
        <thead><tr>
          <th scope="col">Usuário</th><th scope="col">Cadastro</th><th scope="col">Último acesso</th>
          <th scope="col" class="adm-r">Palavras</th><th scope="col" class="adm-r">Cards</th>
          <th scope="col" class="adm-r">Revisões</th><th scope="col" class="adm-r">XP / ofensiva</th>
          <th scope="col" class="adm-r">Ações</th>
        </tr></thead>
        <tbody>${rows.map((user) => rowHtml(user, ctx)).join('')}</tbody>
      </table></div>
      <nav class="adm-pager" aria-label="Paginação de usuários">
        <span class="adm-note">Página ${Math.floor(state.offset / PAGE_SIZE) + 1} de ${Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
        <div>
          <button type="button" class="adm-btn adm-btn-sm" id="admin-user-prev" ${state.offset === 0 ? 'disabled' : ''}>Anterior</button>
          <button type="button" class="adm-btn adm-btn-sm" id="admin-user-next" ${to >= total ? 'disabled' : ''}>Próxima</button>
        </div>
      </nav>`;

    results.querySelectorAll('[data-manage]').forEach((button) => {
      button.addEventListener('click', () => openUserDetail(ctx, button.dataset.manage, load));
    });
    results.querySelector('#admin-user-prev')?.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - PAGE_SIZE);
      load();
    });
    results.querySelector('#admin-user-next')?.addEventListener('click', () => {
      state.offset += PAGE_SIZE;
      load();
    });
  }

  const applySearch = debounce((value) => {
    state.search = value.trim();
    state.offset = 0;
    load();
  }, 300);

  el.querySelector('#admin-user-search').addEventListener('input', (event) => applySearch(event.target.value));
  el.querySelector('#admin-user-filter').addEventListener('change', (event) => {
    state.filter = event.target.value;
    state.offset = 0;
    load();
  });
  el.querySelector('#admin-user-refresh').addEventListener('click', load);

  return load();
}
