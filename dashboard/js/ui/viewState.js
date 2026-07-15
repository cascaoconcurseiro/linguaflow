function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const STATE_META = {
  loading: { icon: '⏳', role: 'status', live: 'polite' },
  empty: { icon: '◇', role: 'status', live: 'polite' },
  error: { icon: '!', role: 'alert', live: 'assertive' },
};

export function renderViewState({
  kind = 'loading',
  title,
  message = '',
  actionLabel = '',
  actionId = '',
  actionClass = 'btn btn-primary',
  compact = false,
} = {}) {
  const meta = STATE_META[kind] || STATE_META.loading;
  const safeKind = STATE_META[kind] ? kind : 'loading';
  const action = actionLabel && actionId
    ? `<button type="button" class="${escapeHtml(actionClass)}" id="${escapeHtml(actionId)}">${escapeHtml(actionLabel)}</button>`
    : '';

  return `<section class="view-state view-state-${safeKind}${compact ? ' view-state-compact' : ''}" role="${meta.role}" aria-live="${meta.live}">
    <span class="view-state-mark" aria-hidden="true">${meta.icon}</span>
    ${title ? `<strong class="view-state-title">${escapeHtml(title)}</strong>` : ''}
    ${message ? `<span class="view-state-message">${escapeHtml(message)}</span>` : ''}
    ${action ? `<div class="view-state-actions">${action}</div>` : ''}
  </section>`;
}

export function bindViewStateAction(container, actionId, handler) {
  container?.querySelector(`#${actionId}`)?.addEventListener('click', handler);
}
