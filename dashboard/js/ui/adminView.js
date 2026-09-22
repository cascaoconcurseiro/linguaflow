// dashboard/js/ui/adminView.js
import { db as lfDb } from '../../../utils/db.js';
import { bindViewStateAction, escapeHtml, renderViewState } from './viewState.js';

export async function renderAdmin(container, app) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({
    kind: 'loading',
    title: 'Carregando painel administrativo…',
    message: 'Consultando métricas e dados de usuários com autoridade segura.',
  });

  const isAdmin = await lfDb.isAdmin().catch(() => false);
  const currentUser = await lfDb.getCurrentUser().catch(() => null);

  if (!isAdmin) {
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({
      kind: 'error',
      title: 'Acesso Restrito',
      message: 'Esta área é exclusiva para o administrador do sistema.',
      actionLabel: 'Voltar ao Início',
      actionId: 'btn-admin-denied',
    });
    bindViewStateAction(container, 'btn-admin-denied', () => app.navigate('home'));
    return;
  }

  const hasToken = !!lfDb._getAdminSessionToken();
  if (!hasToken) {
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({
      kind: 'empty',
      title: 'PIN Administrativo Necessário',
      message: 'Por motivos de segurança, insira seu PIN mestre em Configurações para iniciar uma sessão administrativa.',
      actionLabel: 'Ir para Configurações',
      actionId: 'btn-admin-go-settings',
    });
    bindViewStateAction(container, 'btn-admin-go-settings', () => app.navigate('settings'));
    return;
  }

  let metrics = null;
  let users = [];

  async function loadData() {
    try {
      const [m, u] = await Promise.all([
        lfDb.adminGetMetrics(),
        lfDb.adminListUsers(),
      ]);
      metrics = m || {};
      users = Array.isArray(u) ? u : [];
    } catch (err) {
      console.error('[Admin] Erro ao carregar dados:', err);
      throw err;
    }
  }

  try {
    await loadData();
  } catch (error) {
    container.setAttribute('aria-busy', 'false');
    const isSessionError = /sessão administrativa expirada|revalide o pin|42501/i.test(error?.message || '');
    container.innerHTML = renderViewState({
      kind: 'error',
      title: isSessionError ? 'Sessão Administrativa Expirada' : 'Não foi possível carregar os dados administrativos',
      message: isSessionError
        ? 'Sua sessão segura de 30 minutos expirou. Por favor, revalide seu PIN nas Configurações.'
        : (error?.message || 'Verifique a conexão com o banco e tente novamente.'),
      actionLabel: isSessionError ? 'Revalidar PIN nas Configurações' : 'Tentar novamente',
      actionId: isSessionError ? 'btn-admin-reauth' : 'btn-admin-retry',
    });
    if (isSessionError) {
      bindViewStateAction(container, 'btn-admin-reauth', () => app.navigate('settings'));
    } else {
      bindViewStateAction(container, 'btn-admin-retry', () => renderAdmin(container, app));
    }
    return;
  }

  container.setAttribute('aria-busy', 'false');
  drawView();

  function drawView() {
    const totalUsers = metrics.total_users ?? users.length;
    const totalWords = metrics.total_words ?? 0;
    const totalCards = metrics.total_cards ?? 0;
    const totalReviews = metrics.total_reviews ?? 0;
    const totalErrors = metrics.total_errors ?? 0;

    container.innerHTML = `
      <div class="admin-view" style="max-width:1100px; margin:0 auto; padding:24px 16px;">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid var(--color-border);">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h1 style="font-size:26px; font-weight:900; color:var(--color-text); margin:0;">Painel do Administrador</h1>
            </div>
            <p style="font-size:13px; color:var(--color-text-light); margin:4px 0 0 0;">
              Sessão de administração autenticada
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button id="btn-admin-refresh" type="button" class="btn btn-outline" style="padding:10px 16px; font-size:13px; font-weight:700;" title="Recarregar dados">
              Atualizar
            </button>
            <button id="btn-admin-back" type="button" class="btn btn-outline" style="padding:10px 16px; font-size:13px; font-weight:700;">
              ← Configurações
            </button>
          </div>
        </div>

        <!-- Metric Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:28px;">
          <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div class="admin-tile-mark" aria-hidden="true">U</div>
            <div style="font-size:28px; font-weight:900; color:var(--color-text);">${totalUsers}</div>
            <div style="font-size:13px; color:var(--color-text-light); font-weight:700;">Usuários Cadastrados</div>
          </div>
          <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div class="admin-tile-mark" aria-hidden="true">C</div>
            <div style="font-size:28px; font-weight:900; color:var(--color-primary);">${totalWords}</div>
            <div style="font-size:13px; color:var(--color-text-light); font-weight:700;">Palavras no Acervo</div>
          </div>
          <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div class="admin-tile-mark" aria-hidden="true">B</div>
            <div style="font-size:28px; font-weight:900; color:var(--color-secondary);">${totalCards}</div>
            <div style="font-size:13px; color:var(--color-text-light); font-weight:700;">Flashcards FSRS</div>
          </div>
          <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div class="admin-tile-mark" aria-hidden="true">M</div>
            <div style="font-size:28px; font-weight:900; color:#ff9600;">${totalReviews}</div>
            <div style="font-size:13px; color:var(--color-text-light); font-weight:700;">Revisões Registradas</div>
          </div>
          <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:20px; text-align:center;">
            <div class="admin-tile-mark" aria-hidden="true">E</div>
            <div style="font-size:28px; font-weight:900; color:${totalErrors > 0 ? 'var(--color-danger)' : 'var(--color-text)'};">${totalErrors}</div>
            <div style="font-size:13px; color:var(--color-text-light); font-weight:700;">Erros (24h)</div>
          </div>
        </div>

        <!-- Quick System Actions (Card com Ações Frequentes) -->
        <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:24px; margin-bottom:28px;">
          <h2 style="font-size:18px; font-weight:800; color:var(--color-text); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
            Ações globais de manutenção
          </h2>
          <p style="font-size:13px; color:var(--color-text-light); margin-bottom:20px;">
            Ações de limpeza e redefinição de acervo. Execute com atenção.
          </p>

          <div style="display:flex; flex-wrap:wrap; gap:16px;">
            <!-- Limpar só o meu deck -->
            <button id="btn-admin-reset-my-deck" type="button" class="btn" style="flex:1; min-width:260px; background:#1cb0f6; color:#fff; border-bottom:4px solid #148cc4; padding:16px 20px; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px;">
              <span>Limpar Só o Meu Deck (Admin)</span>
            </button>

            <!-- Limpar decks de todos -->
            <button id="btn-admin-reset-all-decks" type="button" class="btn" style="flex:1; min-width:260px; background:var(--color-danger); color:#fff; border-bottom:4px solid var(--color-danger-shadow); padding:16px 20px; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px;">
              <span>Alerta</span>
              <span>Limpar Decks de TODO MUNDO</span>
            </button>

            ${totalErrors > 0 ? `
              <button id="btn-admin-clear-errors" type="button" class="btn btn-outline" style="min-width:200px; padding:16px 20px; font-size:14px; font-weight:800;">
                Limpar logs de erro (${totalErrors})
              </button>
            ` : ''}
          </div>
        </div>

        <!-- User Management Table -->
        <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
            <div>
              <h2 style="font-size:18px; font-weight:800; color:var(--color-text); margin:0;">
                Gestão de usuários (${users.length})
              </h2>
              <p style="font-size:12px; color:var(--color-text-light); margin:4px 0 0 0;">
                Gerencie contas, decks e atividades individuais.
              </p>
            </div>
            <div style="position:relative; width:100%; max-width:280px;">
              <input type="text" id="admin-user-search" placeholder="Buscar usuário por e-mail…" style="width:100%; padding:10px 14px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-size:13px; background:var(--color-bg-alt); color:var(--color-text);">
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead>
                <tr style="border-bottom:2px solid var(--color-border); color:var(--color-text-light);">
                  <th style="padding:12px 8px;">Usuário</th>
                  <th style="padding:12px 8px;">Cadastro</th>
                  <th style="padding:12px 8px; text-align:center;">Palavras</th>
                  <th style="padding:12px 8px; text-align:center;">Cards</th>
                  <th style="padding:12px 8px; text-align:center;">Revisões</th>
                  <th style="padding:12px 8px; text-align:center;">XP / Ofensiva</th>
                  <th style="padding:12px 8px; text-align:right;">Ações</th>
                </tr>
              </thead>
              <tbody id="admin-user-list">
                ${renderUserRows(users)}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    setupEventHandlers();
  }

  function renderUserRows(userList) {
    if (!userList.length) {
      return `<tr><td colspan="7" style="padding:32px; text-align:center; color:var(--color-text-light);">Nenhum usuário encontrado.</td></tr>`;
    }

    return userList.map(u => {
      const isSelf = !!(currentUser && u.id === currentUser.id);
      const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-';
      const xp = Number(u.xp_total) || 0;
      const streak = Number(u.streak) || 0;

      return `
        <tr style="border-bottom:1px solid var(--color-border);" data-user-id="${escapeHtml(u.id)}">
          <td style="padding:12px 8px;">
            <div style="font-weight:800; color:var(--color-text); display:flex; align-items:center; gap:6px;">
              <span>${escapeHtml(u.email || 'Sem e-mail')}</span>
              ${isSelf ? '<span style="font-size:10px; background:var(--color-primary); color:#fff; padding:2px 6px; border-radius:4px; font-weight:800;">VOCÊ (ADMIN)</span>' : ''}
            </div>
            <div style="font-size:11px; color:var(--color-text-light);">${escapeHtml(u.username || '')}</div>
          </td>
          <td style="padding:12px 8px; color:var(--color-text-light);">${createdDate}</td>
          <td style="padding:12px 8px; text-align:center; font-weight:700; color:var(--color-text);">${u.total_words ?? 0}</td>
          <td style="padding:12px 8px; text-align:center; font-weight:700; color:var(--color-text);">${u.total_cards ?? 0}</td>
          <td style="padding:12px 8px; text-align:center; font-weight:700; color:var(--color-text);">${u.total_reviews ?? 0}</td>
          <td style="padding:12px 8px; text-align:center;">
            <span style="font-weight:800; color:var(--color-primary);">${xp} XP</span>
            ${streak > 0 ? `<span style="margin-left:4px; font-size:12px;">Sequência ${streak}</span>` : ''}
          </td>
          <td style="padding:12px 8px; text-align:right; white-space:nowrap;">
            <button class="btn btn-outline btn-reset-deck" data-user-id="${escapeHtml(u.id)}" data-user-email="${escapeHtml(u.email || '')}" style="padding:6px 10px; font-size:12px; font-weight:700; margin-right:6px;" title="Limpar deck deste usuário">
              Limpar deck
            </button>
            ${!isSelf ? `
              <button class="btn btn-delete-user" data-user-id="${escapeHtml(u.id)}" data-user-email="${escapeHtml(u.email || '')}" style="padding:6px 10px; font-size:12px; font-weight:800; background:var(--color-danger); color:#fff;" title="Excluir conta definitivamente">
                Excluir
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function setupEventHandlers() {
    // Voltar
    document.getElementById('btn-admin-back')?.addEventListener('click', () => {
      app.navigate('settings');
    });

    // Atualizar
    document.getElementById('btn-admin-refresh')?.addEventListener('click', async () => {
      app.showToast('Atualizando dados…', 'info');
      try {
        await loadData();
        drawView();
        app.showToast('Dados atualizados.', 'success');
      } catch {
        app.showToast('Falha ao atualizar dados.', 'error');
      }
    });

    // Busca de usuários
    const searchInput = document.getElementById('admin-user-search');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = q
        ? users.filter(u => (u.email || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q))
        : users;
      const tbody = document.getElementById('admin-user-list');
      if (tbody) tbody.innerHTML = renderUserRows(filtered);
    });

    // Limpar só o meu deck
    document.getElementById('btn-admin-reset-my-deck')?.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja limpar APENAS o seu próprio deck? Suas palavras, cards e revisões serão apagadas, mas sua conta continuará intacta.')) {
        resetUserDeck(currentUser.id, currentUser.email);
      }
    });

    // Limpar deck de TODOS
    document.getElementById('btn-admin-reset-all-decks')?.addEventListener('click', () => {
      promptResetAllDecks();
    });

    // Limpar logs de erro
    document.getElementById('btn-admin-clear-errors')?.addEventListener('click', async () => {
      if (confirm('Deseja limpar todos os registros de erros do sistema?')) {
        try {
          await lfDb.adminClearErrors();
          app.showToast('Logs de erro limpos.', 'success');
          metrics.total_errors = 0;
          drawView();
        } catch (e) {
          app.showToast('Erro ao limpar logs: ' + e.message, 'error');
        }
      }
    });

    // Delegação de eventos para a tabela de usuários
    container.querySelector('#admin-user-list')?.addEventListener('click', (e) => {
      const resetBtn = e.target.closest('.btn-reset-deck');
      if (resetBtn) {
        const userId = resetBtn.dataset.userId;
        const userEmail = resetBtn.dataset.userEmail;
        if (confirm(`Tem certeza que deseja limpar todas as palavras e cards do usuário "${userEmail}"?`)) {
          resetUserDeck(userId, userEmail);
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-user');
      if (deleteBtn) {
        const userId = deleteBtn.dataset.userId;
        const userEmail = deleteBtn.dataset.userEmail;
        promptDeleteUser(userId, userEmail);
      }
    });
  }

  async function resetUserDeck(userId, userEmail) {
    app.showToast(`Limpando deck de ${userEmail}…`, 'info');
    try {
      const res = await lfDb.adminResetUserDeck(userId);
      app.showToast(`Deck de ${userEmail} limpo com sucesso! (${res?.words_deleted ?? 0} palavras, ${res?.cards_deleted ?? 0} cards)`, 'success');
      await loadData();
      drawView();
    } catch (e) {
      console.error('[Admin] Erro ao limpar deck:', e);
      app.showToast('Falha ao limpar deck: ' + (e.message || 'Erro no servidor'), 'error');
    }
  }

  function promptResetAllDecks() {
    openConfirmModal({
      title: 'ATENÇÃO: limpar decks de todo mundo',
      message: 'Esta ação é DESTRUTIVA e IRREVERSÍVEL. Todas as palavras, flashcards e histórico de estudo de TODOS os alunos cadastrados serão apagados. As contas de usuário continuarão existindo.',
      confirmPhrase: 'LIMPAR TUDO',
      confirmButtonText: 'Sim, Limpar Todos os Decks',
      onConfirm: async () => {
        app.showToast('Executando limpeza em massa dos decks…', 'info');
        try {
          const res = await lfDb.adminResetAllDecks();
          app.showToast(`Todos os decks foram limpos! (${res?.words_deleted ?? 0} palavras, ${res?.cards_deleted ?? 0} cards)`, 'success');
          await loadData();
          drawView();
        } catch (e) {
          console.error('[Admin] Erro ao limpar todos os decks:', e);
          app.showToast('Erro ao limpar todos os decks: ' + (e.message || 'Erro no servidor'), 'error');
        }
      },
    });
  }

  function promptDeleteUser(userId, userEmail) {
    openConfirmModal({
      title: `Excluir conta: ${userEmail}`,
      message: `Tem certeza que deseja excluir permanentemente o usuário "${userEmail}"? Todos os dados (estatísticas, progresso, palavras e cards) serão apagados em definitivo do banco de dados.`,
      confirmPhrase: 'EXCLUIR',
      confirmButtonText: 'Excluir Conta Definitivamente',
      onConfirm: async () => {
        app.showToast(`Excluindo conta de ${userEmail}…`, 'info');
        try {
          await lfDb.adminDeleteUser(userId);
          app.showToast(`Usuário ${userEmail} excluído com sucesso!`, 'success');
          await loadData();
          drawView();
        } catch (e) {
          console.error('[Admin] Erro ao excluir usuário:', e);
          app.showToast('Erro ao excluir usuário: ' + (e.message || 'Erro no servidor'), 'error');
        }
      },
    });
  }

  function openConfirmModal({ title, message, confirmPhrase, confirmButtonText, onConfirm }) {
    const existing = document.getElementById('admin-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'admin-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(2,6,23,0.8); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';

    overlay.innerHTML = `
      <div style="background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-danger); max-width:480px; width:100%; padding:30px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
        <div style="font-size:13px; margin-bottom:12px; color:var(--color-danger);">Ação irreversível</div>
        <h2 style="color:var(--color-danger); font-size:20px; font-weight:900; margin-bottom:12px;">${escapeHtml(title)}</h2>
        <p style="color:var(--color-text-light); font-size:14px; line-height:1.5; margin-bottom:20px;">${escapeHtml(message)}</p>
        
        <p style="font-size:13px; font-weight:800; color:var(--color-text); margin-bottom:8px;">
          Para confirmar, digite <strong style="color:var(--color-danger); letter-spacing:1px;">${escapeHtml(confirmPhrase)}</strong> abaixo:
        </p>
        
        <form id="admin-confirm-form" style="margin:0;">
          <input type="text" id="admin-confirm-input" placeholder="${escapeHtml(confirmPhrase)}" autocomplete="off" style="width:100%; text-align:center; font-size:16px; font-weight:800; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-bg-alt); color:var(--color-text); margin-bottom:18px;" autofocus required>
          <div style="display:flex; gap:12px;">
            <button type="button" id="admin-confirm-cancel" class="btn btn-outline" style="flex:1; padding:12px;">Cancelar</button>
            <button type="submit" id="admin-confirm-submit" class="btn" style="flex:1; padding:12px; background:var(--color-danger); color:#fff; border-bottom:4px solid var(--color-danger-shadow); font-weight:800;" disabled>${escapeHtml(confirmButtonText)}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#admin-confirm-input');
    const submitBtn = overlay.querySelector('#admin-confirm-submit');
    const form = overlay.querySelector('#admin-confirm-form');
    const cancelBtn = overlay.querySelector('#admin-confirm-cancel');

    const closeModal = () => overlay.remove();

    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    input.addEventListener('input', () => {
      submitBtn.disabled = input.value.trim() !== confirmPhrase;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (input.value.trim() === confirmPhrase) {
        closeModal();
        await onConfirm();
      }
    });

    setTimeout(() => input.focus(), 50);
  }
}
