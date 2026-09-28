// dashboard/js/core/coursePrefs.js
// Preferências do player de cursos, guardadas neste navegador.

const KEY = 'lf_course_prefs';

export const PREF_LIMITS = {
  readings: { min: 1, max: 8, step: 1 },
  speed: { min: 0.5, max: 2, step: 0.25 },
};

export const DEFAULT_PREFS = Object.freeze({
  audio: true,         // tocar o áudio da frase
  sfx: true,           // sons de digitação e feedback
  reduceMotion: false, // tira animações não essenciais
  readings: 2,         // quantas vezes a frase é lida ao aparecer
  speed: 1,            // velocidade da voz
});

function clampStep(value, { min, max, step }, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const snapped = Math.round((n - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(2))));
}

export function normalizePrefs(raw = {}) {
  return {
    audio: typeof raw.audio === 'boolean' ? raw.audio : DEFAULT_PREFS.audio,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : DEFAULT_PREFS.sfx,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : DEFAULT_PREFS.reduceMotion,
    readings: clampStep(raw.readings, PREF_LIMITS.readings, DEFAULT_PREFS.readings),
    speed: clampStep(raw.speed, PREF_LIMITS.speed, DEFAULT_PREFS.speed),
  };
}

export function loadPrefs(storage = globalThis.localStorage) {
  try {
    return normalizePrefs(JSON.parse(storage?.getItem(KEY) || '{}'));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  const clean = normalizePrefs(prefs);
  try { storage?.setItem(KEY, JSON.stringify(clean)); } catch { /* storage bloqueado: vale só nesta aba */ }
  return clean;
}

export function stepPref(prefs, name, direction) {
  const limits = PREF_LIMITS[name];
  return normalizePrefs({ ...prefs, [name]: prefs[name] + direction * limits.step });
}
