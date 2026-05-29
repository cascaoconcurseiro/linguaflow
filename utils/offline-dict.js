// utils/offline-dict.js

export const offlineDict = {
    dbName: 'LinguaFlow_OfflineDict',
    storeName: 'dictionary',
    db: null,

    async init() {
        if (this.db) return;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (e) => reject(e.target.error);
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'term' });
                }
            };
        });
    },

    async addDictionary(jsonArray) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            // Assume jsonArray is [{term: "apple", def: "A fruit", phonetic: "æpəl"}, ...]
            jsonArray.forEach(item => {
                store.put({
                    term: item.term.toLowerCase(),
                    def: item.def,
                    phonetic: item.phonetic || ''
                });
            });

            tx.oncomplete = () => resolve({ count: jsonArray.length });
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async lookup(word) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(word.toLowerCase());

            request.onsuccess = (e) => resolve(e.target.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    }
};
