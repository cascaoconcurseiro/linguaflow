// background/word-save-queue.js — regras puras da fila local-first de palavras
// (lf_pending_word_saves_v1). O service worker guarda e sincroniza; aqui fica
// só a decisão do que repetir e o que mostrar ao usuário.

// 401 (sessão), 408 (timeout) e 429 (limite) resolvem sozinhos com o tempo ou
// com um novo login. Outros 4xx são recusa do servidor: repetir não adianta.
const TRANSIENT_CLIENT_STATUSES = new Set([401, 408, 429]);

export function isPermanentSaveError(error) {
  const status = Number(error?.status);
  if (!Number.isInteger(status) || status < 400 || status >= 500) return false;
  return !TRANSIENT_CLIENT_STATUSES.has(status);
}

export function retryableEntries(queue, processedVersions) {
  return Object.entries(queue || {}).filter(([id, item]) => (
    !item?.failed && !processedVersions.has(`${id}:${item?.queuedAt}`)
  ));
}

export function summarizeWordSaveQueue(queue) {
  const items = Object.values(queue || {});
  return {
    pending: items.filter((item) => !item?.failed).length,
    failed: items.filter((item) => item?.failed).map((item) => ({
      id: item.id,
      word: String(item.payload?.word || ''),
      lastError: String(item.lastError || '').slice(0, 160),
    })),
  };
}
