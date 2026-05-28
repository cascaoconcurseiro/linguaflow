/**
 * Cloud Sync (Google Drive AppData)
 * Faz backup e restauração do IndexedDB diretamente no Google Drive escondido.
 */
import { db as lfDb } from './db.js';

export class CloudSync {
    constructor() {
        this.fileName = 'linguaflow_backup.json';
        this.fileId = null;
    }

    async getAuthToken(interactive = true) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });
    }

    async _getFileId(token) {
        if (this.fileId) return this.fileId;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${this.fileName}'`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            this.fileId = data.files[0].id;
            return this.fileId;
        }
        return null;
    }

    async backup() {
        const token = await this.getAuthToken(true);
        const data = await lfDb.exportDatabase();
        const fileContent = JSON.stringify(data);
        const metadata = {
            name: this.fileName,
            parents: ['appDataFolder']
        };

        let fileId = await this._getFileId(token);
        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (fileId) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        const res = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${token}` },
            body: form
        });

        if (!res.ok) throw new Error('Falha ao fazer upload para o Google Drive');
        return true;
    }

    async restore() {
        const token = await this.getAuthToken(true);
        const fileId = await this._getFileId(token);
        if (!fileId) throw new Error('Nenhum backup encontrado no Google Drive.');

        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Falha ao baixar backup do Google Drive');
        const data = await res.json();
        await lfDb.importDatabase(data);
        return true;
    }
}

export const sync = new CloudSync();
