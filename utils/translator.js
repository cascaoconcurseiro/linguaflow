// utils/translator.js
import { db } from './db.js';
import { offlineDict } from './offline-dict.js';

export function shouldProxyTranslationThroughExtension(
    locationLike = globalThis.location,
    runtime = globalThis.chrome?.runtime,
) {
    return Boolean(
        runtime?.id
        && typeof runtime.sendMessage === 'function'
        && /^https?:$/.test(locationLike?.protocol || ''),
    );
}

class Translator {
    constructor() {
        this.memoryCache = new Map();
        this.maxCacheSize = 2000;
        this.pendingRequests = new Map();
    }

    _getCacheKey(text, fromLang, toLang) {
        return `${fromLang}:${toLang}:${text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    }

    _updateMemoryCache(key, translation) {
        if (this.memoryCache.size >= this.maxCacheSize) {
            this.memoryCache.delete(this.memoryCache.keys().next().value);
        }
        this.memoryCache.set(key, translation);
    }

    async translate(text, fromLang = 'auto', toLang = 'pt') {
        if (!text || text.trim() === '') return { translation: '', source: 'empty' };

        const key = this._getCacheKey(text, fromLang, toLang);

        if (this.memoryCache.has(key)) {
            return { translation: this.memoryCache.get(key), source: 'memory_cache', cached: true };
        }

        if (this.pendingRequests.has(key)) return await this.pendingRequests.get(key);

        const promise = (async () => {
            try {
                // Cache persistente na tabela translation_cache (a chave mantém
                // o prefixo trans_ por compat com as 3.155 entradas migradas).
                // NUNCA mais em settings: cada tradução gravada lá invalidava o
                // cache do motor SRS e deixava o app inteiro lento.
                const cacheKey = `trans_${key}`;
                const cached = await db.getTranslationCache(cacheKey).catch(() => null);
                if (cached) {
                    this._updateMemoryCache(key, cached);
                    return { translation: cached, source: 'idb_cache', cached: true };
                }

                // Tenta Dicionário Offline primeiro (Se for palavra única ou curta)
                if (text.split(' ').length <= 3) {
                    try {
                        const dictEntry = await offlineDict.lookup(text);
                        if (dictEntry && dictEntry.def) {
                            this._updateMemoryCache(key, dictEntry.def);
                            db.setTranslationCache(cacheKey, dictEntry.def).catch(() => {});
                            return { translation: dictEntry.def, source: 'offline_dict', cached: true };
                        }
                    } catch (e) {
                        // ignore dict error
                    }
                }

                if (shouldProxyTranslationThroughExtension()) {
                    const proxied = await this._fetchExtensionTranslate(text, fromLang, toLang);
                    if (!proxied?.translation) {
                        return { translation: '', source: 'extension_proxy_error', cached: false };
                    }
                    this._updateMemoryCache(key, proxied.translation);
                    db.setTranslationCache(cacheKey, proxied.translation).catch(() => {});
                    return {
                        translation: proxied.translation,
                        source: proxied.source || 'extension_proxy',
                        cached: Boolean(proxied.cached),
                    };
                }

                const google = await this._fetchGoogleTranslate(text, fromLang, toLang);
                if (google) {
                    this._updateMemoryCache(key, google);
                    db.setTranslationCache(cacheKey, google).catch(() => {});
                    return { translation: google, source: 'google_api', cached: false };
                }

                const mymemory = await this._fetchMyMemory(text, fromLang, toLang);
                if (mymemory) {
                    this._updateMemoryCache(key, mymemory);
                    db.setTranslationCache(cacheKey, mymemory).catch(() => {});
                    return { translation: mymemory, source: 'mymemory_api', cached: false };
                }

                return { translation: '', source: 'error', cached: false };
            } finally {
                this.pendingRequests.delete(key);
            }
        })();

        this.pendingRequests.set(key, promise);
        return await promise;
    }

    async _fetchExtensionTranslate(text, fromLang, toLang) {
        if (!shouldProxyTranslationThroughExtension()) return null;
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'translate',
                text,
                from: fromLang,
                to: toLang,
            });
            if (!response?.translation) return null;
            return response;
        } catch (error) {
            console.warn('[LinguaFlow Translator] Proxy da extensão falhou:', error?.message || error);
            return null;
        }
    }

    async _fetchGoogleTranslate(text, fromLang, toLang) {
        const sl = fromLang === 'auto' ? 'auto' : fromLang;
        const q = encodeURIComponent(text.trim());
        const endpoints = [
            `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${sl}&tl=${toLang}&dt=t&q=${q}`,
            `https://translate.google.com/translate_a/single?client=dict-chrome-ex&sl=${sl}&tl=${toLang}&dt=t&q=${q}`,
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${toLang}&dt=t&q=${q}`,
        ];

        for (const url of endpoints) {
            try {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(tid);

                if (!response.ok) {
                    if (response.status === 429) {
                        console.warn('[LinguaFlow Translator] Rate limit 429 em endpoint Google, tentando alternativa...');
                    }
                    continue;
                }

                // Usa text() + JSON.parse para garantir UTF-8 correto
                // response.json() pode interpretar mal caracteres especiais em alguns browsers
                const raw = await response.text();
                if (!raw || raw.startsWith('<')) continue;
                const data = JSON.parse(raw);

                if (data && data[0] && Array.isArray(data[0])) {
                    const translation = data[0]
                        .filter(part => part && part[0])
                        .map(part => part[0])
                        .join('')
                        .trim();
                    if (translation) return translation;
                }
            } catch (err) {
                console.warn('[LinguaFlow Translator] Endpoint Google falhou:', err.message);
            }
        }
        return null;
    }

    async _fetchMyMemory(text, fromLang, toLang) {
        try {
            const langPair = fromLang === 'auto' ? `en|${toLang}` : `${fromLang}|${toLang}`;
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${langPair}`;

            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(tid);

            if (!response.ok) return null;
            const raw = await response.text();
            const data = JSON.parse(raw);

            if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
                return data.responseData.translatedText.trim();
            }
        } catch (err) {
            console.warn('[LinguaFlow Translator] MyMemory falhou:', err.message);
        }
        return null;
    }

    async translateBatch(texts, fromLang = 'auto', toLang = 'pt', concurrency = 8, onResult = null) {
        if (!texts || texts.length === 0) return [];
        const results = new Array(texts.length);
        const workerCount = Math.min(texts.length, Math.max(1, Math.min(16, Number(concurrency) || 8)));
        let nextIndex = 0;

        const worker = async () => {
            while (nextIndex < texts.length) {
                const index = nextIndex++;
                try {
                    const result = await this.translate(texts[index], fromLang, toLang);
                    results[index] = { index, translation: result.translation, cached: result.cached, source: result.source };
                } catch {
                    results[index] = { index, translation: '', cached: false, source: 'error' };
                }
                if (typeof onResult === 'function') {
                    try { onResult(results[index], index); } catch {}
                }
                if (results[index] && !results[index].cached) {
                    await new Promise((resolve) => setTimeout(resolve, 35));
                }
            }
        };

        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        return results;
    }

    clearMemoryCache() { this.memoryCache.clear(); }

    getCacheStats() {
        return { memorySize: this.memoryCache.size, maxSize: this.maxCacheSize, pendingRequests: this.pendingRequests.size };
    }
}

export const translator = new Translator();
