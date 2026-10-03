// dashboard/js/ui/systemNotice.js
// Faixa de aviso global definida em Admin > Sistema (#408). Falha em silêncio: aviso nunca bloqueia o estudo.
import { escapeHtml } from './viewState.js';

const DISMISS_PREFIX = 'lf_notice_dismissed:';
const COLORS = { info: 'var(--color-secondary)', warning: 'var(--color-warning)', critical: 'var(--color-danger)' };

function noticeKey(notice) {
  return `${DISMISS_PREFIX}${notice.level}:${notice.message}`;
}

function wasDismissed(notice) {
  try { return sessionStorage.getItem(noticeKey(notice)) === '1'; } catch { return false; }
}

function remember(notice) {
  try { sessionStorage.setItem(noticeKey(notice), '1'); } catch { /* sem persistência: reaparece no próximo carregamento */ }
}

export async function showSystemNotice(db) {
  const notice = await db.getSystemNotice();
  if (!notice || !notice.message || wasDismissed(notice)) return;
  const root = document.getElementById('app-root');
  if (!root || document.getElementById('lf-system-notice')) return;

  const banner = document.createElement('div');
  banner.id = 'lf-system-notice';
  banner.setAttribute('role', notice.level === 'critical' ? 'alert' : 'status');
  banner.style.cssText = `display:flex;gap:12px;align-items:center;justify-content:center;padding:10px 16px;font-size:14px;font-weight:600;background:var(--color-bg-alt);color:var(--color-text);border-bottom:3px solid ${COLORS[notice.level] || COLORS.info};`;
  banner.innerHTML = `<span>${escapeHtml(notice.message)}</span>
    <button type="button" aria-label="Dispensar aviso" style="font:inherit;background:none;border:1px solid var(--color-border);border-radius:4px;padding:2px 10px;cursor:pointer;color:inherit">Entendi</button>`;
  banner.querySelector('button').addEventListener('click', () => {
    remember(notice);
    banner.remove();
  });
  root.parentNode.insertBefore(banner, root);
}
