// utils/gdrive.js
// Backup via Google Drive
// REQUER configuração do Google Cloud Console — veja instruções abaixo

const BACKUP_FILENAME = 'linguaflow-backup.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ─── Verifica se o Client ID foi configurado ─────────────────────────────────
function getClientId() {
    // Lê o client_id do manifest (definido em manifest.json > oauth2 > client_id)
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;
    if (!clientId || clientId.includes('SEU_CLIENT_ID')) {
        throw new Error(
            'Google Drive não configurado.\n\n' +
            'Para ativar:\n' +
            '1. Acesse console.cloud.google.com\n' +
            '2. Crie um projeto e ative a "Google Drive API"\n' +
            '3. Em "Credenciais", crie um OAuth 2.0 para extensão Chrome\n' +
            '4. Copie o Client ID gerado\n' +
            '5. Substitua "SEU_CLIENT_ID_AQUI" no manifest.json\n' +
            '6. Recarregue a extensão'
        );
    }
    return clientId;
}

async function getToken(interactive = true) {
    // Verifica configuração antes de tentar autenticar
    getClientId(); // lança erro se não configurado

    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || 'Falha na autenticação Google'));
            } else {
                resolve(token);
            }
        });
    });
}

async function findBackupFile(token) {
    const res = await fetch(
        `${DRIVE_API}/files?spaces=appDataFolder&q=name%3D'${BACKUP_FILENAME}'&fields=files(id,modifiedTime,size)`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive API erro: ${res.status}`);
    const data = await res.json();
    return data.files?.[0] || null;
}

export async function exportToDrive(backupData) {
    const token = await getToken(true);
    const json = JSON.stringify(backupData, null, 2);

    const existing = await findBackupFile(token);

    if (existing) {
        // Atualiza arquivo existente (PATCH com uploadType=media)
        const res = await fetch(
            `${UPLOAD_API}/files/${existing.id}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: json
            }
        );
        if (!res.ok) throw new Error(`Drive update falhou: ${res.status}`);
        return { success: true, updated: true };
    }

    // Cria novo arquivo com metadata via multipart
    const boundary = 'lf_boundary_' + Date.now();
    const meta = JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] });
    const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        meta,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        json,
        `--${boundary}--`
    ].join('\r\n');

    const res = await fetch(
        `${UPLOAD_API}/files?uploadType=multipart`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        }
    );
    if (!res.ok) throw new Error(`Drive upload falhou: ${res.status}`);
    return { success: true, updated: false };
}

export async function importFromDrive() {
    const token = await getToken(true);
    const file = await findBackupFile(token);
    if (!file) throw new Error('Nenhum backup encontrado no Google Drive.');

    const res = await fetch(
        `${DRIVE_API}/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive download falhou: ${res.status}`);

    const raw = await res.text();
    const data = JSON.parse(raw);
    return { data, modifiedTime: file.modifiedTime };
}

export async function getBackupInfo() {
    try {
        getClientId();
        const token = await getToken(false);
        const file = await findBackupFile(token);
        if (!file) return null;
        return { exists: true, modifiedTime: file.modifiedTime };
    } catch {
        return null;
    }
}
