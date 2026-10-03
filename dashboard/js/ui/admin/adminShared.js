// dashboard/js/ui/admin/adminShared.js
// Utilitários compartilhados do console administrativo (#408): formatação, diálogos acessíveis,
// estados assíncronos e metadados de escopos/ações. Sem acesso a dados: quem busca é cada aba.
import { escapeHtml, renderViewState } from '../viewState.js';

export { escapeHtml };

const STYLE_ID = 'lf-admin-styles';

export function ensureAdminStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = 'css/admin.css?v=1.0.0';
  document.head.appendChild(link);
}

// ── Formatação ───────────────────────────────────────────────────────────────
const numberFormat = new Intl.NumberFormat('pt-BR');

export const fmtNumber = (value) => numberFormat.format(Number(value) || 0);

export function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtRelative(value) {
  if (!value) return 'nunca';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '—';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

export function fmtDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

// ── Metadados ────────────────────────────────────────────────────────────────
export const RESET_SCOPES = [
  { id: 'cards', label: 'Palavras e flashcards', hint: 'Palavras salvas, cards FSRS, histórico de revisões, palavras conhecidas/ignoradas e frases.' },
  { id: 'courses', label: 'Progresso em cursos', hint: 'Matrículas, sessões de prática, erros, notas e vocabulário dos cursos.' },
  { id: 'fluency', label: 'Avaliação de fluência', hint: 'Tarefas, tentativas e perfil de fluência.' },
  { id: 'progress', label: 'XP, ofensiva e atividade', hint: 'XP, liga, ofensiva, conquistas, tempo de estudo e eventos de aprendizagem. Inclui o histórico de revisões. Perfil (nome, avatar, e-mail, fuso) é preservado.' },
  { id: 'content', label: 'Textos e histórias', hint: 'Histórias geradas, textos do leitor e cache de tradução.' },
  { id: 'telemetry', label: 'Telemetria', hint: 'Registros de uso de API e erros do cliente.' },
  { id: 'settings', label: 'Configurações e dispositivos', hint: 'Preferências salvas e inscrições de notificação push.' },
];

const TABLE_LABELS = {
  card_review_undos: 'Desfazer revisão',
  review_log: 'Revisões',
  card_learning_signals: 'Sinais de aprendizagem',
  card_adaptive_profiles: 'Perfis adaptativos',
  cards: 'Flashcards',
  words: 'Palavras',
  known_words: 'Palavras conhecidas',
  ignored_words: 'Palavras ignoradas',
  sentences: 'Frases',
  course_session_results: 'Resultados de sessões',
  course_practice_sessions: 'Sessões de prática',
  course_user_mistakes: 'Erros em cursos',
  course_user_notes: 'Notas de curso',
  course_user_reviews: 'Revisões de curso',
  course_user_vocabulary: 'Vocabulário de curso',
  user_course_enrollment: 'Matrículas',
  fluency_task_submissions: 'Respostas de fluência',
  fluency_task_issues: 'Tarefas de fluência',
  learning_task_attempts: 'Tentativas de tarefa',
  fluency_skill_profiles: 'Perfil de fluência',
  xp_ledger: 'Lançamentos de XP',
  learning_events: 'Eventos de aprendizagem',
  user_achievements: 'Conquistas',
  study_time_heartbeats: 'Batimentos de estudo',
  listening_intervals: 'Intervalos de escuta',
  media_watch_sessions: 'Sessões de vídeo',
  sessions: 'Sessões de estudo',
  user_stats: 'Estatísticas (perfil)',
  stories: 'Histórias',
  reader_texts: 'Textos do leitor',
  translation_cache: 'Cache de tradução',
  api_usage_log: 'Chamadas de API',
  client_errors: 'Erros do cliente',
  settings: 'Preferências',
  push_subscriptions: 'Dispositivos push',
};

export const tableLabel = (table) => TABLE_LABELS[table] || table;

export const ACTION_LABELS = {
  reset_user_data: 'Reset de dados do usuário',
  reset_all_users_data: 'Reset global',
  restore_backup: 'Backup restaurado',
  delete_backup: 'Backup excluído',
  suspend_user: 'Usuário suspenso',
  unsuspend_user: 'Usuário reativado',
  revoke_sessions: 'Sessões encerradas',
  delete_user: 'Conta excluída',
  export_user: 'Dados exportados',
  clear_client_errors: 'Logs de erro limpos',
  set_admin_role: 'Papel administrativo alterado',
  set_system_notice: 'Aviso do sistema alterado',
};

export const actionLabel = (action) => ACTION_LABELS[action] || action;

export function scopeLabels(scopes = []) {
  const map = new Map(RESET_SCOPES.map((scope) => [scope.id, scope.label]));
  return scopes.map((id) => map.get(id) || id);
}

// ── Erros ────────────────────────────────────────────────────────────────────
export function adminErrorMessage(error) {
  return (error && error.message) ? String(error.message) : 'Erro no servidor. Tente novamente.';
}

export function isSessionError(error) {
  return /sessão administrativa expirada|revalide o pin|pin revalidado|42501/i.test(error?.message || '');
}

// ── Estados assíncronos ──────────────────────────────────────────────────────
export function renderSkeleton(rows = 6) {
  const blocks = Array.from({ length: rows }, (_, index) => `<span${index === 0 ? ' class="adm-skel-tall"' : ''}></span>`).join('');
  return `<div class="adm-skel" role="status" aria-live="polite"><span class="adm-sr">Carregando…</span>${blocks}</div>`;
}

/**
 * Carrega dados e renderiza com estados explícitos (carregando, erro com retry, sucesso).
 * `render(data)` recebe os dados e é responsável por ligar seus próprios eventos.
 */
export async function mountAsync(el, { load, render, errorTitle = 'Não foi possível carregar', onSessionError }) {
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = renderSkeleton();
  try {
    const data = await load();
    el.innerHTML = '';
    render(data);
    el.setAttribute('aria-busy', 'false');
  } catch (error) {
    el.setAttribute('aria-busy', 'false');
    const expired = isSessionError(error);
    el.innerHTML = renderViewState({
      kind: 'error',
      title: expired ? 'Sessão administrativa expirada' : errorTitle,
      message: expired
        ? 'Revalide o PIN nas Configurações para continuar.'
        : adminErrorMessage(error),
      actionLabel: expired ? 'Ir para Configurações' : 'Tentar novamente',
      actionId: 'adm-async-action',
    });
    el.querySelector('#adm-async-action')?.addEventListener('click', () => {
      if (expired && onSessionError) onSessionError();
      else mountAsync(el, { load, render, errorTitle, onSessionError });
    });
  }
}

export function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    if (busyLabel) button.textContent = busyLabel;
    button.disabled = true;
    button.dataset.busy = 'true';
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = false;
    delete button.dataset.busy;
  }
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Gráficos simples e acessíveis ────────────────────────────────────────────
export function renderBarChart(points, { label }) {
  const max = Math.max(1, ...points.map((point) => Number(point.count) || 0));
  const width = 280;
  const height = 64;
  const gap = 3;
  const barWidth = (width - gap * (points.length - 1)) / Math.max(points.length, 1);
  const bars = points.map((point, index) => {
    const value = Number(point.count) || 0;
    const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * (height - 14));
    const x = index * (barWidth + gap);
    return `<rect x="${x.toFixed(1)}" y="${(height - 12 - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}"><title>${escapeHtml(fmtDate(point.day))}: ${value}</title></rect>`;
  }).join('');
  const first = points[0]?.day ? fmtDate(points[0].day) : '';
  const last = points[points.length - 1]?.day ? fmtDate(points[points.length - 1].day) : '';
  const summary = `${label}: ${points.map((point) => `${fmtDate(point.day)} ${Number(point.count) || 0}`).join(', ')}`;
  return `<svg class="adm-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(summary)}">
    ${bars}
    <text x="0" y="${height - 1}">${escapeHtml(first)}</text>
    <text x="${width}" y="${height - 1}" text-anchor="end">${escapeHtml(last)}</text>
  </svg>`;
}

export function renderBarList(items, { nameKey, emptyText }) {
  if (!items.length) return `<p class="adm-note">${escapeHtml(emptyText)}</p>`;
  const max = Math.max(1, ...items.map((item) => Number(item.count) || 0));
  return `<ul class="adm-bars">${items.map((item) => {
    const value = Number(item.count) || 0;
    return `<li><span>${escapeHtml(item[nameKey] || '—')}</span>
      <span class="adm-bar" aria-hidden="true"><span style="width:${((value / max) * 100).toFixed(1)}%"></span></span>
      <span class="adm-num">${fmtNumber(value)}</span></li>`;
  }).join('')}</ul>`;
}

// ── Diálogo acessível ────────────────────────────────────────────────────────
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Abre um diálogo modal (role=dialog, foco preso, Esc fecha, foco devolvido ao fechar).
 * `footer` é uma lista de { id, label, variant, onClick, disabled }.
 */
export function openModal({ title, bodyHtml = '', footer = [], size = 'md', tone = 'info', dismissible = true }) {
  document.getElementById('adm-overlay')?.remove();
  const previouslyFocused = document.activeElement;
  const titleId = 'adm-modal-title';

  const overlay = document.createElement('div');
  overlay.id = 'adm-overlay';
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}" data-size="${size}" data-tone="${tone}" tabindex="-1">
      <header><h2 id="${titleId}">${escapeHtml(title)}</h2></header>
      <div class="adm-modal-body">${bodyHtml}</div>
      <footer></footer>
    </div>`;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector('.adm-modal');
  const body = overlay.querySelector('.adm-modal-body');
  const footerEl = overlay.querySelector('footer');

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll(FOCUSABLE)];
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setFooter(actions) {
    footerEl.innerHTML = '';
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'adm-btn';
      button.dataset.variant = action.variant || 'ghost';
      button.id = action.id || '';
      button.textContent = action.label;
      button.disabled = Boolean(action.disabled);
      button.addEventListener('click', () => action.onClick?.({ close, button }));
      footerEl.appendChild(button);
    }
  }

  setFooter(footer);
  document.addEventListener('keydown', onKeydown, true);
  if (dismissible) overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(); });

  const initial = body.querySelector('input, select, textarea') || footerEl.querySelector('button:not([disabled])') || modal;
  initial.focus();

  return { el: modal, body, footerEl, close, setFooter };
}

export function showInlineError(container, message) {
  let box = container.querySelector('.adm-inline-error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'adm-inline-error';
    box.setAttribute('role', 'alert');
    container.appendChild(box);
  }
  box.textContent = message;
}

export function clearInlineError(container) {
  container.querySelector('.adm-inline-error')?.remove();
}

/**
 * Confirmação por digitação (frase ou e-mail do alvo). O botão só habilita com texto idêntico;
 * falhas do servidor aparecem no próprio diálogo sem fechá-lo.
 */
export function confirmTyped({ title, message, phrase, confirmLabel, onConfirm, extraHtml = '' }) {
  const bodyHtml = `
    <p class="adm-note" style="margin-bottom:12px">${escapeHtml(message)}</p>
    ${extraHtml}
    <label class="adm-field" for="adm-confirm-input">Para confirmar, digite <strong style="color:var(--color-danger)">${escapeHtml(phrase)}</strong>
      <input type="text" id="adm-confirm-input" autocomplete="off" spellcheck="false" />
    </label>`;
  const modal = openModal({ title, bodyHtml, tone: 'danger', footer: [] });
  const input = modal.body.querySelector('#adm-confirm-input');
  let busy = false;

  const render = () => modal.setFooter([
    { id: 'adm-confirm-cancel', label: 'Cancelar', onClick: ({ close }) => close() },
    {
      id: 'adm-confirm-submit',
      label: confirmLabel,
      variant: 'danger',
      disabled: busy || input.value.trim() !== phrase,
      onClick: async ({ close, button }) => {
        busy = true;
        setBusy(button, true, 'Executando…');
        clearInlineError(modal.body);
        try {
          await onConfirm();
          close();
        } catch (error) {
          busy = false;
          showInlineError(modal.body, adminErrorMessage(error));
          render();
        }
      },
    },
  ]);

  input.addEventListener('input', render);
  render();
  return modal;
}
