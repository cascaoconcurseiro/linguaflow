// utils/html.js — Escape de HTML para qualquer texto de fora (legendas, IA, web) antes de entrar no DOM.
export function escapeHTML(value) {
    if (!value) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
