// background/cache-cleaner.js

/**
 * Garbage Collector para limpar dicionários velhos e liberar espaço (QuotaExceeded).
 * @returns {Promise<void>}
 */
export function evictDisposableCache() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return resolve();
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime?.lastError || !items) return resolve();
      const keysToRemove = Object.keys(items).filter((k) =>
        k.startsWith('linguee_') ||
        k.startsWith('reverso_') ||
        k.startsWith('lf_tr:') ||
        /^[a-z]{2,5}:[a-z]{2,5}:/.test(k) ||
        k === 'lastYoutubeSubtitleUrls'
      );
      if (keysToRemove.length === 0) return resolve();
      chrome.storage.local.remove(keysToRemove, () => resolve());
    });
  });
}

/**
 * Limpa entradas de cache obsoletas (> 3 dias) ou que excedem limites máximos.
 * @param {number} maxLinguee
 * @param {number} maxReverso
 * @param {number} maxTranslations
 */
export function sweepStaleCache(maxLinguee = 30, maxReverso = 30, maxTranslations = 1000) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.get(null, (items) => {
    if (chrome.runtime?.lastError || !items) return;
    const now = Date.now();
    const lingueeEntries = [];
    const reversoEntries = [];
    const translationKeys = [];
    const keysToRemove = [];

    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith('linguee_')) {
        if (value?.ts && now - value.ts > 3 * 86400000) {
          keysToRemove.push(key);
        } else {
          lingueeEntries.push({ key, ts: value?.ts || 0 });
        }
      } else if (key.startsWith('reverso_')) {
        if (value?.ts && now - value.ts > 3 * 86400000) {
          keysToRemove.push(key);
        } else {
          reversoEntries.push({ key, ts: value?.ts || 0 });
        }
      } else if (key.startsWith('lf_tr:') || /^[a-z]{2,5}:[a-z]{2,5}:/.test(key)) {
        translationKeys.push(key);
      }
    }

    if (lingueeEntries.length > maxLinguee) {
      lingueeEntries.sort((a, b) => b.ts - a.ts);
      for (const item of lingueeEntries.slice(maxLinguee)) {
        keysToRemove.push(item.key);
      }
    }

    if (reversoEntries.length > maxReverso) {
      reversoEntries.sort((a, b) => b.ts - a.ts);
      for (const item of reversoEntries.slice(maxReverso)) {
        keysToRemove.push(item.key);
      }
    }

    if (translationKeys.length > maxTranslations) {
      const excess = translationKeys.slice(0, translationKeys.length - maxTranslations);
      keysToRemove.push(...excess);
    }

    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        if (!chrome.runtime?.lastError) {
          console.debug(`[LinguaFlow] GC: Limpos ${keysToRemove.length} itens obsoletos do cache.`);
        }
      });
    }
  });
}

/**
 * Remove do cache local fragmentos corrompidos do Linguee (que contêm \uFFFD).
 */
export function clearBadLingueeCache() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.get(null, (items) => {
    if (chrome.runtime?.lastError || !items) return;
    const keys = Object.keys(items).filter(
      (k) => k.startsWith('linguee_') && items[k].html?.includes('\uFFFD'),
    );
    if (keys.length) chrome.storage.local.remove(keys);
  });
}
