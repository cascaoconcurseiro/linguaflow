// dashboard/js/ui/study/cardModals.js — Janelas da revisão: edição rápida do cartão (tecla E) e informações completas do cartão (tecla I).
import { db as lfDb } from '../../../../utils/db.js';
import { escapeHtml } from '../viewState.js';
import { formatInterval } from './studyText.js';

// Edição rápida de card durante o estudo (Tecla E - Anki Quick Edit)
export function openQuickEditModal(app, card) {
  if (!card) return;
  const existing = document.getElementById('anki-quick-edit-dialog');
  if (existing) existing.remove();

  const wordData = card.wordData || {};
  const currentWord = wordData.word || card.word || '';
  const currentContext = card._ctx || wordData.context_sentence || card.context || '';
  const currentTrans = wordData.translation || card.translation || '';

  const dialog = document.createElement('div');
  dialog.id = 'anki-quick-edit-dialog';
  dialog.className = 'anki-modal-overlay';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'quick-edit-title');

  dialog.innerHTML = `
    <div class="anki-modal-box">
      <div class="anki-modal-header">
        <h3 id="quick-edit-title">Editar card (atalho E)</h3>
        <button type="button" class="anki-modal-close" id="quick-edit-close" aria-label="Fechar">✕</button>
      </div>
      <form id="quick-edit-form" class="anki-modal-form">
        <div class="anki-form-group">
          <label for="quick-edit-term">Termo / Palavra:</label>
          <input type="text" id="quick-edit-term" value="${escapeHtml(currentWord)}" required autocomplete="off" />
        </div>
        <div class="anki-form-group">
          <label for="quick-edit-ctx">Frase de Contexto:</label>
          <textarea id="quick-edit-ctx" rows="3" required>${escapeHtml(currentContext)}</textarea>
        </div>
        <div class="anki-form-group">
          <label for="quick-edit-tr">Tradução:</label>
          <input type="text" id="quick-edit-tr" value="${escapeHtml(currentTrans)}" required autocomplete="off" />
        </div>
        <div class="anki-modal-actions">
          <button type="button" class="btn btn-secondary" id="quick-edit-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" id="quick-edit-submit">Salvar Alterações</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(dialog);
  const termInput = dialog.querySelector('#quick-edit-term');
  termInput?.focus();

  const closeDialog = () => {
    document.removeEventListener('keydown', keyHandler);
    dialog.remove();
  };
  const keyHandler = (e) => {
    if (e.key === 'Escape') closeDialog();
  };
  document.addEventListener('keydown', keyHandler);
  dialog.querySelector('#quick-edit-close')?.addEventListener('click', closeDialog);
  dialog.querySelector('#quick-edit-cancel')?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

  dialog.querySelector('#quick-edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newWord = dialog.querySelector('#quick-edit-term').value.trim();
    const newContext = dialog.querySelector('#quick-edit-ctx').value.trim();
    const newTrans = dialog.querySelector('#quick-edit-tr').value.trim();
    if (!newWord || !newContext || !newTrans) return;

    const submitBtn = dialog.querySelector('#quick-edit-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando…'; }

    try {
      const targetWordId = card.word_id || card.wordData?.id || card.id;
      await lfDb.updateWord(targetWordId, {
        word: newWord,
        context_sentence: newContext,
        translation: newTrans,
      });

      card.word = newWord;
      card._ctx = newContext;
      if (card.wordData) {
        card.wordData.word = newWord;
        card.wordData.context_sentence = newContext;
        card.wordData.translation = newTrans;
      }
      (card._chunks || []).forEach(c => {
        if (c.is_context) { c.eng = newContext; c.pt = newTrans; }
        if (c.is_word) { c.eng = newWord; c.pt = newTrans; }
      });

      const sentenceEl = document.getElementById('pump-sentence');
      if (sentenceEl && !card._reverse) {
        sentenceEl.textContent = newContext;
      }
      const transEl = document.getElementById('pump-translation');
      if (transEl) transEl.textContent = newTrans;
      app.showToast('Card atualizado com sucesso.', 'info');
      closeDialog();
    } catch (err) {
      console.error('[QuickEdit] Erro ao salvar:', err);
      app.showToast('Erro ao salvar alterações.', 'error');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar Alterações'; }
    }
  });
}

// Informações completas do Card (Tecla I - Anki Card Info com métricas FSRS)
export async function openCardInfoModal(app, card) {
  if (!card) return;
  const existing = document.getElementById('anki-card-info-dialog');
  if (existing) existing.remove();

  const wordData = card.wordData || {};
  const word = wordData.word || card.word || '';
  const stability = card.stability ? `${Number(card.stability).toFixed(1)} dias` : '—';
  const difficulty = card.difficulty ? `${Number(card.difficulty).toFixed(1)} / 10` : '—';

  let retrievabilityStr = '—';
  if (card.stability && card.last_review) {
    const elapsedDays = Math.max(0, (Date.now() - new Date(card.last_review).getTime()) / 86400000);
    const r = lfDb._fsrsRetrievability(elapsedDays, card.stability);
    if (r && !isNaN(r)) retrievabilityStr = `${Math.round(r * 100)}%`;
  }

  const nextDue = card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const lastRev = card.last_review ? new Date(card.last_review).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Nunca';

  const statusMap = {
    'new': 'Novo',
    'learning': 'Em Aprendizado',
    'review': 'Consolidando',
    'mature': 'Memória Estável',
  };
  const statusLabel = statusMap[card.status] || card.status;

  const dialog = document.createElement('div');
  dialog.id = 'anki-card-info-dialog';
  dialog.className = 'anki-modal-overlay';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'card-info-title');

  dialog.innerHTML = `
    <div class="anki-modal-box card-info-modal-box">
      <div class="anki-modal-header">
        <h3 id="card-info-title">Informações de intervalo (atalho I)</h3>
        <button type="button" class="anki-modal-close" id="card-info-close" aria-label="Fechar">✕</button>
      </div>
      <div class="card-info-content">
        <div class="card-info-header-row">
          <strong class="card-info-word">${escapeHtml(word)}</strong>
          <span class="badge ${card.status === 'mature' ? 'badge-mature' : card.status === 'new' ? 'badge-new' : 'badge-review'}">${statusLabel}</span>
        </div>
        
        <div class="card-info-grid">
          <div class="card-info-cell">
            <span class="cell-label">Estabilidade (S)</span>
            <span class="cell-value">${stability}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Dificuldade (D)</span>
            <span class="cell-value">${difficulty}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Retenção Estimada (R)</span>
            <span class="cell-value">${retrievabilityStr}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Intervalo Atual</span>
            <span class="cell-value">${formatInterval(card.interval)}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Repetições</span>
            <span class="cell-value">${card.reps || 0}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Lapsos / Erros</span>
            <span class="cell-value">${card.lapses || 0}</span>
          </div>
          <div class="card-info-cell">
            <span class="cell-label">Hesitação / Tempo</span>
            <span class="cell-value" id="card-info-avg-time">Carregando…</span>
          </div>
          <div class="card-info-cell full-width">
            <span class="cell-label">Próximo Vencimento</span>
            <span class="cell-value">${nextDue}</span>
          </div>
          <div class="card-info-cell full-width">
            <span class="cell-label">Última Revisão</span>
            <span class="cell-value">${lastRev}</span>
          </div>
        </div>

        <div class="card-info-history">
          <h4>Histórico de Revisões</h4>
          <div id="card-info-history-list" class="card-info-history-list">Carregando histórico…</div>
        </div>

        <div class="anki-modal-actions">
          <button type="button" class="btn btn-primary" id="card-info-done">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  const closeDialog = () => {
    document.removeEventListener('keydown', keyHandler);
    dialog.remove();
  };
  const keyHandler = (e) => {
    if (e.key === 'Escape') closeDialog();
  };
  document.addEventListener('keydown', keyHandler);
  dialog.querySelector('#card-info-close')?.addEventListener('click', closeDialog);
  dialog.querySelector('#card-info-done')?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

  lfDb.getCardStats(card.id).then((history) => {
    const avgTimeEl = dialog.querySelector('#card-info-avg-time');
    if (avgTimeEl) {
      const times = (history || [])
        .map(h => Number(h.response_time_ms || h.responseMs || 0))
        .filter(t => t > 100);
      if (times.length > 0) {
        const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        avgTimeEl.textContent = avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`;
      } else {
        avgTimeEl.textContent = '—';
      }
    }

    const listEl = dialog.querySelector('#card-info-history-list');
    if (!listEl) return;
    if (!history || history.length === 0) {
      listEl.innerHTML = '<p class="empty-history">Nenhuma revisão gravada ainda.</p>';
      return;
    }
    const gradeLabels = { 1: 'Errei (1)', 2: 'Difícil (2)', 3: 'Bom (3)', 4: 'Fácil (4)' };
    const gradeColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6', 4: '#10b981' };
    listEl.innerHTML = `
      <table class="card-history-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Avaliação</th>
            <th>Tempo</th>
            <th>Intervalo</th>
          </tr>
        </thead>
        <tbody>
          ${history.slice(0, 8).map(h => {
            const d = new Date(h.ts || h.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            const gradeName = gradeLabels[h.quality] || h.quality;
            const color = gradeColors[h.quality] || 'var(--color-text)';
            const ivl = h.interval ? formatInterval(h.interval) : '—';
            const tMs = Number(h.response_time_ms || h.responseMs || 0);
            const timeStr = tMs > 100 ? (tMs < 1000 ? `${tMs}ms` : `${(tMs / 1000).toFixed(1)}s`) : '—';
            return `<tr>
              <td>${d}</td>
              <td style="color:${color};font-weight:700;">${gradeName}</td>
              <td style="color:var(--color-text-light);font-size:12px;">${timeStr}</td>
              <td>${ivl}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }).catch(() => {
    const avgTimeEl = dialog.querySelector('#card-info-avg-time');
    if (avgTimeEl) avgTimeEl.textContent = '—';
    const listEl = dialog.querySelector('#card-info-history-list');
    if (listEl) listEl.innerHTML = '<p class="empty-history">Histórico indisponível.</p>';
  });
}
