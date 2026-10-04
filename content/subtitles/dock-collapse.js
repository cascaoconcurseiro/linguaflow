// content/subtitles/dock-collapse.js — Recolher/expandir o dock de controles (#462)
//
// Recolhido, o dock mostra só o botão LF (liga/desliga) e o botão de expandir,
// para os controles não cobrirem o vídeo. A escolha vale em todos os players
// e sites (chrome.storage.local); falha de storage nunca quebra o player.

export const DOCK_COLLAPSED_KEY = 'lf_dock_collapsed';

export const DOCK_COLLAPSE_BUTTON_HTML =
  '<button type="button" data-action="collapse" class="lf-dock-collapse" aria-expanded="true" ' +
  'title="Recolher controles" aria-label="Recolher controles">' +
  '<span class="lf-dock-chevron" aria-hidden="true">⌄</span></button>';

// Seta do chevron: só transform (rápido e respeita prefers-reduced-motion).
// orientation 'vertical' (dock lateral): expandido aponta para cima, recolhido para baixo.
// orientation 'horizontal' (dock do YouTube): expandido aponta para a esquerda, recolhido para a direita.
export function dockCollapseCss(rootSelector, orientation) {
  const expanded = orientation === 'horizontal' ? 'rotate(90deg)' : 'rotate(180deg)';
  const collapsed = orientation === 'horizontal' ? 'rotate(-90deg)' : 'rotate(0deg)';
  return `
    ${rootSelector} .lf-dock-collapse{appearance:none;border:0;background:transparent;color:#94a3b8;cursor:pointer;
      display:grid;place-items:center;border-radius:50%;padding:0;flex-shrink:0;
      ${orientation === 'horizontal' ? 'width:24px;height:24px;' : 'width:44px;height:24px;border-radius:12px;'}
      transition:background .15s ease,color .15s ease;}
    ${rootSelector} .lf-dock-collapse:hover,${rootSelector} .lf-dock-collapse:focus-visible{background:rgba(56,189,248,.2);color:#7dd3fc;outline:2px solid #7dd3fc;outline-offset:1px;}
    ${rootSelector} .lf-dock-chevron{display:block;font:700 16px/1 system-ui;transform:${expanded};transition:transform .16s ease;}
    ${rootSelector}.lf-collapsed .lf-dock-chevron{transform:${collapsed};}
    ${rootSelector}.lf-collapsed>:not(.lf-dock-toggle):not(.lf-dock-collapse){display:none !important;}
    ${rootSelector}.lf-off .lf-dock-collapse{display:none !important;}
    ${orientation === 'horizontal' ? '' : `@media (max-width:640px),(max-height:540px){${rootSelector} .lf-dock-collapse{width:32px;height:20px;}}`}
    @media (prefers-reduced-motion:reduce){${rootSelector} .lf-dock-chevron{transition:none}}
  `;
}

function storage() {
  try {
    return globalThis.chrome?.storage?.local || null;
  } catch {
    return null;
  }
}

export async function loadDockCollapsed() {
  const area = storage();
  if (!area) return false;
  try {
    const result = await area.get(DOCK_COLLAPSED_KEY);
    return result?.[DOCK_COLLAPSED_KEY] === true;
  } catch {
    return false;
  }
}

export async function saveDockCollapsed(collapsed) {
  const area = storage();
  if (!area) return;
  try {
    await area.set({ [DOCK_COLLAPSED_KEY]: Boolean(collapsed) });
  } catch {
    // Sem storage a escolha só vale nesta página.
  }
}

/** Reflete o estado no dock e no botão (classe, aria-expanded, nome acessível). */
export function applyDockCollapsed(dock, collapsed) {
  if (!dock) return;
  const value = Boolean(collapsed);
  dock.classList.toggle('lf-collapsed', value);
  const button = dock.querySelector?.('button[data-action="collapse"]');
  if (!button) return;
  const label = value ? 'Expandir controles' : 'Recolher controles';
  button.setAttribute('aria-expanded', String(!value));
  button.title = label;
  button.setAttribute('aria-label', label);
}
