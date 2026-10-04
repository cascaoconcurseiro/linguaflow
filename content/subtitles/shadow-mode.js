// content/subtitles/shadow-mode.js — Modo shadowing (#456)
// Mostra a fala anterior (apagada), a atual (destaque) e a próxima (meio-tom) no lugar da legenda,
// com uma barra fina de progresso da fala. Só lógica pura e CSS; o motor cuida do DOM e do vídeo.

export const SHADOW_STORAGE_KEY = 'lf_shadow_mode';

/** Preferência por dispositivo (como a velocidade). Desligado por padrão; storage quebrado não derruba o player. */
export function readShadowPref(storage) {
  try {
    return storage?.getItem?.(SHADOW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeShadowPref(storage, on) {
  try {
    storage?.setItem?.(SHADOW_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Sem storage a escolha vale só nesta aba.
  }
}

function textOf(cue) {
  return String(cue?.text ?? '').replace(/\s+/g, ' ').trim();
}

/** Anterior, atual e próxima fala com texto (falas vazias são puladas). Nunca devolve mais de 3 linhas. */
export function shadowContext(cues, index) {
  const empty = { prev: '', current: '', next: '' };
  if (!Array.isArray(cues) || !Number.isInteger(index) || index < 0 || index >= cues.length) return empty;
  const current = textOf(cues[index]);
  if (!current) return empty;
  let prev = '';
  for (let i = index - 1; i >= 0 && !prev; i--) prev = textOf(cues[i]);
  let next = '';
  for (let i = index + 1; i < cues.length && !next; i++) next = textOf(cues[i]);
  return { prev, current, next };
}

/** Progresso 0–1 da fala, preso ao intervalo dela. */
export function shadowProgress(cue, time) {
  const start = Number(cue?.start);
  const end = Number(cue?.end);
  const t = Number(time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(t) || end <= start) return 0;
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}

// Movimento curto e só em transform/opacity; sem movimento com prefers-reduced-motion (o conteúdo e o progresso continuam).
export const SHADOW_CSS = `
  .lf-shadow-prev, .lf-shadow-next, .lf-shadow-progress { display: none; }
  .lf-wrap[data-shadow="on"] .lf-shadow-prev,
  .lf-wrap[data-shadow="on"] .lf-shadow-next {
    display: block;
    max-width: min(86vw, 900px);
    text-align: center;
    font-family: 'Inter', Arial, sans-serif;
    font-weight: 600;
    font-size: calc(var(--lf-font-size, 31px) * 0.6);
    line-height: 1.25;
    color: #FFF;
    text-shadow: 0 2px 10px rgba(0,0,0,0.95), 0 0 5px rgba(0,0,0,0.8);
    pointer-events: none;
  }
  .lf-wrap[data-shadow="on"] .lf-shadow-prev { opacity: 0.32; }
  .lf-wrap[data-shadow="on"] .lf-shadow-next { opacity: 0.62; }
  .lf-wrap[data-shadow="on"] .lf-shadow-prev:empty,
  .lf-wrap[data-shadow="on"] .lf-shadow-next:empty { display: none; }
  .lf-wrap[data-shadow="on"] .lf-shadow-progress {
    display: block;
    width: min(60%, 320px);
    height: 3px;
    border-radius: 2px;
    background: rgba(255,255,255,0.2);
    overflow: hidden;
  }
  .lf-shadow-bar {
    height: 100%;
    background: #38BDF8;
    transform-origin: left center;
    transform: scaleX(var(--lf-shadow-p, 0));
  }
  .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-shadow-prev,
  .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-orig-row,
  .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-shadow-next {
    animation: lf-shadow-in 0.18s ease-out;
  }
  @keyframes lf-shadow-in {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-shadow-prev,
    .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-orig-row,
    .lf-wrap[data-shadow="on"].lf-shadow-roll .lf-shadow-next { animation: none; }
  }
`;
