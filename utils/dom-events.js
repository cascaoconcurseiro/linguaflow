// utils/dom-events.js — Utilitários de eventos DOM e proteção contra conflito de teclado

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Determina se um evento de teclado ocorreu dentro de um controle editável,
 * inclusive quando o input está encapsulado em Shadow DOM (ex.: YouTube Searchbox/Comments).
 *
 * @param {Event} [event] - O evento de teclado (KeyboardEvent)
 * @param {Element} [fallbackTarget] - Elemento alternativo para inspeção caso evento não seja passado
 * @returns {boolean} true se o usuário estiver interagindo com um campo editável
 */
export function isEditableTarget(event, fallbackTarget = null) {
  if (event && typeof event.composedPath === 'function') {
    const path = event.composedPath();
    for (const node of path) {
      if (!node) continue;
      const tag = node.tagName?.toUpperCase();
      if (EDITABLE_TAGS.has(tag)) return true;
      if (node.isContentEditable) return true;
    }
  }

  const target = event?.target || fallbackTarget || (typeof document !== 'undefined' ? document.activeElement : null);
  if (!target) return false;

  const tag = target.tagName?.toUpperCase();
  if (EDITABLE_TAGS.has(tag)) return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable="true"]')) {
    return true;
  }

  // Se for um host de Shadow Root com activeElement interno
  if (target.shadowRoot?.activeElement) {
    const shadowActive = target.shadowRoot.activeElement;
    const shadowTag = shadowActive.tagName?.toUpperCase();
    if (EDITABLE_TAGS.has(shadowTag) || shadowActive.isContentEditable) return true;
  }

  return false;
}
