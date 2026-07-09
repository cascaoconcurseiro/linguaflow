// utils/translator.js
import { db } from './db.js';
import { offlineDict } from './offline-dict.js';

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
                const idbKey = `trans_${key}`;
                const idbResult = await db.getSetting(idbKey).catch(() => null);
                if (idbResult) {
                    this._updateMemoryCache(key, idbResult);
                    return { translation: idbResult, source: 'idb_cache', cached: true };
                }

                // Tenta Dicionário Offline primeiro (Se for palavra única ou curta)
                if (text.split(' ').length <= 3) {
                    try {
                        const dictEntry = await offlineDict.lookup(text);
                        if (dictEntry && dictEntry.def) {
                            this._updateMemoryCache(key, dictEntry.def);
                            db.setSetting(idbKey, dictEntry.def).catch(() => {});
                            return { translation: dictEntry.def, source: 'offline_dict', cached: true };
                        }
                    } catch (e) {
                        // ignore dict error
                    }
                }

                const google = await this._fetchGoogleTranslate(text, fromLang, toLang);
                if (google) {
                    this._updateMemoryCache(key, google);
                    db.setSetting(idbKey, google).catch(() => {});
                    return { translation: google, source: 'google_api', cached: false };
                }

                const mymemory = await this._fetchMyMemory(text, fromLang, toLang);
                if (mymemory) {
                    this._updateMemoryCache(key, mymemory);
                    db.setSetting(idbKey, mymemory).catch(() => {});
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

    async _fetchGoogleTranslate(text, fromLang, toLang) {
        try {
            const sl = fromLang === 'auto' ? 'auto' : fromLang;
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${toLang}&dt=t&q=${encodeURIComponent(text.trim())}`;

            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(tid);

            if (!response.ok) return null;

            // Usa text() + JSON.parse para garantir UTF-8 correto
            // response.json() pode interpretar mal caracteres especiais em alguns browsers
            const raw = await response.text();
            const data = JSON.parse(raw);

            if (data && data[0] && Array.isArray(data[0])) {
                const translation = data[0]
                    .filter(part => part && part[0])
                    .map(part => part[0])
                    .join('')
                    .trim();
                return translation || null;
            }
        } catch (err) {
            console.warn('[LinguaFlow Translator] Google GTX falhou:', err.message);
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

    async translateBatch(texts, fromLang = 'auto', toLang = 'pt', concurrency = 50) {
        if (!texts || texts.length === 0) return [];
        const results = new Array(texts.length);
        const tasks = [];

        for (let i = 0; i < texts.length; i++) {
            const index = i;
            const task = this.translate(texts[i], fromLang, toLang)
                .then(r => ({ index, translation: r.translation, cached: r.cached, source: r.source }))
                .catch(() => ({ index, translation: texts[i], cached: false, source: 'error' }));
            tasks.push(task);

            if (tasks.length >= concurrency) {
                const done = await Promise.race(tasks.map((t, idx) => t.then(() => idx)));
                results[(await tasks[done]).index] = await tasks[done];
                tasks.splice(done, 1);
            }
        }

        (await Promise.all(tasks)).forEach(r => { results[r.index] = r; });
        return results;
    }

    clearMemoryCache() { this.memoryCache.clear(); }

    getCacheStats() {
        return { memorySize: this.memoryCache.size, maxSize: this.maxCacheSize, pendingRequests: this.pendingRequests.size };
    }
}

export const translator = new Translator();
