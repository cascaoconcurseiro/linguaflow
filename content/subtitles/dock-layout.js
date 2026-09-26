// content/subtitles/dock-layout.js — Lógica de layout responsivo para a dock horizontal do player
// Extraído de content/subtitle-engine.js

export function computeDockResponsiveClass(playerWidth) {
  if (playerWidth === null || playerWidth === undefined) return 'lf-size-normal';
  const width = Number(playerWidth);
  if (!Number.isFinite(width) || width <= 0 || width >= 820) return 'lf-size-normal';
  if (width >= 620) return 'lf-size-compact';
  if (width >= 480) return 'lf-size-mini';
  return 'lf-size-tiny';
}

export function applyDockResponsiveClass(dockElement, playerWidth) {
  if (!dockElement) return 'lf-size-normal';
  const cls = computeDockResponsiveClass(playerWidth);
  dockElement.classList.toggle('lf-size-compact', cls === 'lf-size-compact');
  dockElement.classList.toggle('lf-size-mini', cls === 'lf-size-mini');
  dockElement.classList.toggle('lf-size-tiny', cls === 'lf-size-tiny');
  return cls;
}
