// dashboard/js/ui/adminView.js
// Casca do console administrativo (#408): porta de acesso (papel + PIN), abas acessíveis e carga
// preguiçosa de cada aba. A autoridade é do servidor; aqui só se esconde o que o papel não pode usar.
import { db as lfDb } from '../../../utils/db.js';
import { bindViewStateAction, escapeHtml, renderViewState } from './viewState.js';
import { ensureAdminStyles, renderSkeleton } from './admin/adminShared.js';

const TAB_KEY = 'lf_admin_tab';

const TABS = [
  { id: 'overview', label: 'Visão geral', load: () => import('./admin/adminOverview.js').then((m) => m.renderOverview) },
  { id: 'users', label: 'Usuários', load: () => import('./admin/adminUsers.js').then((m) => m.renderUsers) },
  { id: 'reports', label: 'Relatos', load: () => import('./admin/adminReports.js').then((m) => m.renderReports) },
  { id: 'security', label: 'Segurança', load: () => import('./admin/adminSecurity.js').then((m) => m.renderSecurity) },
  { id: 'backups', label: 'Backups', load: () => import('./admin/adminBackups.js').then((m) => m.renderBackups) },
  { id: 'audit', label: 'Auditoria', load: () => import('./admin/adminAudit.js').then((m) => m.renderAudit) },
  { id: 'system', label: 'Sistema', load: () => import('./admin/adminSystem.js').then((m) => m.renderSystem) },
  { id: 'danger', label: 'Zona de perigo', tone: 'danger', writeOnly: true, load: () => import('./admin/adminDanger.js').then((m) => m.renderDanger) },
];

function readSavedTab() {
  try { return sessionStorage.getItem(TAB_KEY); } catch { return null; }
}

function saveTab(id) {
  try { sessionStorage.setItem(TAB_KEY, id); } catch { /* armazenamento indisponível: segue sem persistir */ }
}

function gate(container, { title, message, kind = 'error', actionLabel, actionId, onAction }) {
  container.setAttribute('aria-busy', 'false');
  container.innerHTML = renderViewState({ kind, title, message, actionLabel, actionId });
  if (actionId) bindViewStateAction(container, actionId, onAction);
}

export async function renderAdmin(container, app) {
  ensureAdminStyles();
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({
    kind: 'loading',
    title: 'Carregando painel administrativo…',
    message: 'Verificando seu acesso.',
  });

  const [isAdmin, currentUser] = await Promise.all([
    lfDb.isAdmin().catch(() => false),
    lfDb.getCurrentUser().catch(() => null),
  ]);

  if (!isAdmin) {
    gate(container, {
      title: 'Acesso restrito',
      message: 'Esta área é exclusiva para a equipe administrativa.',
      actionLabel: 'Voltar ao início',
      actionId: 'btn-admin-denied',
      onAction: () => app.navigate('home'),
    });
    return;
  }

  if (!lfDb._getAdminSessionToken()) {
    gate(container, {
      kind: 'empty',
      title: 'PIN administrativo necessário',
      message: 'Por segurança, valide seu PIN mestre em Configurações para iniciar uma sessão administrativa (30 minutos).',
      actionLabel: 'Ir para Configurações',
      actionId: 'btn-admin-go-settings',
      onAction: () => app.navigate('settings', { adminPin: true }),
    });
    return;
  }

  const role = (await lfDb.adminGetRole().catch(() => null)) || 'admin';
  const canWrite = role === 'admin';
  const tabs = TABS.filter((tab) => canWrite || !tab.writeOnly);
  let active = tabs.some((tab) => tab.id === readSavedTab()) ? readSavedTab() : tabs[0].id;
  let renderToken = 0;

  const ctx = {
    app,
    db: lfDb,
    role,
    canWrite,
    currentUser,
    goTab: (id) => selectTab(id, { focus: true }),
  };

  container.setAttribute('aria-busy', 'false');
  container.innerHTML = `
    <div class="adm">
      <div class="adm-head">
        <div>
          <h1>Painel do administrador</h1>
          <p class="adm-muted">${escapeHtml(currentUser?.email || '')} · ${canWrite ? 'Administrador' : 'Suporte (somente leitura)'} · sessão protegida por PIN</p>
        </div>
        <div class="adm-head-actions">
          <button type="button" class="adm-btn" id="btn-admin-refresh">Atualizar</button>
          <button type="button" class="adm-btn" id="btn-admin-back">← Configurações</button>
        </div>
      </div>
      <div class="adm-tabs" role="tablist" aria-label="Seções do painel">
        ${tabs.map((tab) => `<button type="button" role="tab" class="adm-tab" id="adm-tab-${tab.id}" data-tab="${tab.id}"
          ${tab.tone ? `data-tone="${tab.tone}"` : ''} aria-controls="adm-panel" aria-selected="false" tabindex="-1">${escapeHtml(tab.label)}</button>`).join('')}
      </div>
      <div class="adm-panel" id="adm-panel" role="tabpanel" tabindex="-1"></div>
    </div>`;

  const panel = container.querySelector('#adm-panel');
  const tabButtons = [...container.querySelectorAll('[data-tab]')];

  async function draw() {
    const token = ++renderToken;
    const tab = tabs.find((item) => item.id === active);
    panel.setAttribute('aria-labelledby', `adm-tab-${tab.id}`);
    panel.innerHTML = renderSkeleton(8);
    try {
      const render = await tab.load();
      if (token !== renderToken) return;
      panel.innerHTML = '';
      panel.classList.remove('adm-enter');
      void panel.offsetWidth;
      panel.classList.add('adm-enter');
      await render(panel, ctx);
    } catch (error) {
      if (token !== renderToken) return;
      console.error('[Admin] Falha ao carregar aba', tab.id, error);
      panel.innerHTML = renderViewState({
        kind: 'error',
        title: 'Não foi possível abrir esta seção',
        message: error?.message || 'Tente novamente.',
        actionLabel: 'Tentar novamente',
        actionId: 'btn-admin-tab-retry',
      });
      bindViewStateAction(panel, 'btn-admin-tab-retry', draw);
    }
  }

  function selectTab(id, { focus = false } = {}) {
    if (!tabs.some((tab) => tab.id === id)) return;
    active = id;
    saveTab(id);
    tabButtons.forEach((button) => {
      const selected = button.dataset.tab === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (focus) container.querySelector(`#adm-tab-${id}`)?.focus();
    draw();
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const move = keys[event.key];
      const next = move === 'first' ? 0 : move === 'last' ? tabButtons.length - 1
        : (index + move + tabButtons.length) % tabButtons.length;
      selectTab(tabButtons[next].dataset.tab, { focus: true });
    });
  });

  container.querySelector('#btn-admin-back').addEventListener('click', () => app.navigate('settings'));
  container.querySelector('#btn-admin-refresh').addEventListener('click', () => {
    app.showToast('Atualizando dados…', 'info');
    draw();
  });

  selectTab(active);
}
