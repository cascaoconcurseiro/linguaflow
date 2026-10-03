// content/subtitles/start-tip.js — Dica de primeira vez ancorada no botão LF (Issue #421)

export const START_TIP_KEY = 'lf_start_tip_seen';
const TIP_WIDTH = 260;
const GAP = 10;

/** Posição da dica em coordenadas de viewport; "above" para barra inferior, "left" para dock lateral. */
export function tipPosition(anchorRect, { viewportWidth, placement = 'above', height = 96 } = {}) {
  if (placement === 'left') {
    return {
      left: Math.max(GAP, Math.round(anchorRect.left - TIP_WIDTH - GAP)),
      top: Math.max(GAP, Math.round(anchorRect.top + anchorRect.height / 2 - height / 2)),
    };
  }
  const centered = anchorRect.left + anchorRect.width / 2 - TIP_WIDTH / 2;
  return {
    left: Math.round(Math.min(Math.max(GAP, centered), Math.max(GAP, viewportWidth - TIP_WIDTH - GAP))),
    top: Math.max(GAP, Math.round(anchorRect.top - height - GAP)),
  };
}

export async function wasStartTipSeen() {
  try {
    const result = await globalThis.chrome?.storage?.local?.get?.(START_TIP_KEY);
    return result?.[START_TIP_KEY] === true;
  } catch {
    return false;
  }
}

export function markStartTipSeen() {
  try {
    return Promise.resolve(globalThis.chrome?.storage?.local?.set?.({ [START_TIP_KEY]: true })).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/** Mostra a dica. Devolve { close } ou null se o anchor não existe. */
export function showStartTip(anchor, { placement = 'above', onClose } = {}) {
  if (!anchor?.isConnected) return null;
  const tip = document.createElement('div');
  tip.id = 'lf-start-tip';
  tip.setAttribute('role', 'note');
  tip.setAttribute('aria-label', 'Dica do LinguaFlow');
  tip.innerHTML = `
    <style>
      #lf-start-tip{position:fixed;z-index:2147483645;width:${TIP_WIDTH}px;box-sizing:border-box;padding:12px 14px;
        border-radius:10px;background:#0f172a;color:#f8fafc;border:1px solid rgba(125,211,252,.45);
        font:500 13px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45);
        opacity:0;transform:translateY(4px);transition:opacity .18s ease,transform .18s ease;}
      #lf-start-tip.is-in{opacity:1;transform:none;}
      #lf-start-tip strong{color:#7dd3fc;}
      #lf-start-tip button{margin-top:8px;appearance:none;border:0;border-radius:6px;padding:5px 12px;cursor:pointer;
        font:600 12px system-ui;background:#0284c7;color:#fff;}
      #lf-start-tip button:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px;}
      @media (prefers-reduced-motion:reduce){#lf-start-tip{transition:none;transform:none;}}
    </style>
    <div>Ligue o <strong>LinguaFlow</strong> para ver legendas com tradução e palavras clicáveis. Atalho: <strong>C</strong>.</div>
    <button type="button">Entendi</button>`;
  document.body.appendChild(tip);

  const place = () => {
    const rect = anchor.getBoundingClientRect();
    const { left, top } = tipPosition(rect, {
      viewportWidth: window.innerWidth,
      placement,
      height: tip.offsetHeight || 96,
    });
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  place();
  requestAnimationFrame(() => tip.classList.add('is-in'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('resize', place);
    tip.remove();
    onClose?.();
  };
  window.addEventListener('resize', place);
  tip.querySelector('button').addEventListener('click', close);
  return { close };
}
