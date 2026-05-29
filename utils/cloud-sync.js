// utils/cloud-sync.js
import { db } from './db.js';

export const cloudSync = {
    async getAuthToken() {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve(token);
            });
        });
    },

    async removeToken(token) {
        return new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken({ token }, resolve);
        });
    },

    async _fetch(url, options = {}, token) {
        const headers = new Headers(options.headers || {});
        headers.append('Authorization', `Bearer ${token}`);
        
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            await this.removeToken(token);
            throw new Error('Token expirado. Tente novamente.');
        }
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google Drive API Erro: ${response.status} - ${err}`);
        }
        return response;
    },

    async _findBackupFileId(token) {
        const response = await this._fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name="linguaflow_backup.json"&fields=files(id,name,modifiedTime)', {}, token);
        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0].id : null;
    },

    async syncUp() {
        try {
            const token = await this.getAuthToken();
            const words = await db.getAllWords();
            const decks = await db.getAllDecks();
            const payload = JSON.stringify({ words, decks, version: 1, exportedAt: new Date().toISOString() });
            const blob = new Blob([payload], { type: 'application/json' });

            const fileId = await this._findBackupFileId(token);
            
            const metadata = { name: 'linguaflow_backup.json', parents: ['appDataFolder'] };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (fileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
            }

            await this._fetch(url, { method, body: form }, token);
            return { success: true, message: 'Backup enviado com sucesso para a nuvem.' };
        } catch (e) {
            console.error('[CloudSync] Upload failed:', e);
            throw e;
        }
    },

    async syncDown() {
        try {
            const token = await this.getAuthToken();
            const fileId = await this._findBackupFileId(token);
            if (!fileId) throw new Error('Nenhum backup encontrado na nuvem.');

            const response = await this._fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {}, token);
            const data = await response.json();

            if (data && data.words) {
                // Muito cuidado: restaurar vai sobrescrever o IndexedDB!
                await db.restoreFromJson(JSON.stringify(data));
                return { success: true, message: 'Restaurado da nuvem com sucesso.' };
            }
            throw new Error('Formato de backup inválido na nuvem.');
        } catch (e) {
            console.error('[CloudSync] Download failed:', e);
            throw e;
        }
    }
};
