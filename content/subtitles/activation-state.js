// content/subtitles/activation-state.js — Estado inicial do botão LF nos players (Issue #418)
//
// Regra: o LinguaFlow começa desligado. O que o usuário escolhe ligar vale
// enquanto o navegador estiver aberto (chrome.storage.session) e some ao
// fechá-lo. A configuração "startMode" muda esse comportamento.

export const START_MODES = Object.freeze({
  SESSION: 'session', // padrão: desligado, mas lembra a escolha até fechar o navegador
  OFF: 'off', // sempre desligado a cada vídeo novo
  ON: 'on', // sempre ligado
  REMEMBER: 'remember', // lembra a última escolha mesmo depois de fechar o navegador
});

export const DEFAULT_START_MODE = START_MODES.SESSION;

export const SESSION_KEY = 'lf_activation_session';
export const REMEMBER_KEY = 'lf_activation_remembered';

// Plataformas com botão LF visível (dock). Onde não há botão, desligar deixaria
// o usuário sem como religar (só existe o atalho C).
const PLATFORMS_WITH_SWITCH = new Set(['youtube', 'max', 'netflix', 'disney', 'prime']);

export function platformHasSwitch(platform) {
  return PLATFORMS_WITH_SWITCH.has(platform);
}

export function normalizeStartMode(value) {
  return Object.values(START_MODES).includes(value) ? value : DEFAULT_START_MODE;
}

/** Decide se o LF começa ligado, dado o modo e o que foi guardado antes. */
export function resolveInitialActivation({ platform, startMode, sessionValue, rememberedValue } = {}) {
  if (!platformHasSwitch(platform)) return true;
  switch (normalizeStartMode(startMode)) {
    case START_MODES.ON:
      return true;
    case START_MODES.OFF:
      return false;
    case START_MODES.REMEMBER:
      return rememberedValue === true;
    default:
      return sessionValue === true;
  }
}

function area(name) {
  try {
    return globalThis.chrome?.storage?.[name] || null;
  } catch {
    return null;
  }
}

async function readKey(storageArea, key) {
  if (!storageArea) return undefined;
  try {
    const result = await storageArea.get(key);
    return result?.[key];
  } catch {
    return undefined;
  }
}

export async function loadStoredActivation() {
  const [sessionValue, rememberedValue] = await Promise.all([
    readKey(area('session'), SESSION_KEY),
    readKey(area('local'), REMEMBER_KEY),
  ]);
  return { sessionValue, rememberedValue };
}

/** Guarda a escolha do usuário. Falhas de storage nunca quebram o player. */
export async function saveActivation(active) {
  const value = Boolean(active);
  const tasks = [];
  const session = area('session');
  const local = area('local');
  if (session) tasks.push(session.set({ [SESSION_KEY]: value }));
  if (local) tasks.push(local.set({ [REMEMBER_KEY]: value }));
  await Promise.allSettled(tasks);
}
