// popup/popup.js
import { db } from '../utils/db.js';

async function loadStats() {
    try {
        const stats = await db.getStats();
        
        document.getElementById('stat-due').textContent = stats.dueCards || 0;
        document.getElementById('stat-total').textContent = stats.totalWords || 0;
        document.getElementById('stat-new').textContent = stats.byStatus?.new || 0;
        document.getElementById('stat-learned').textContent = stats.byStatus?.mature || 0;


    } catch(e) {
        console.error('[LinguaFlow Popup] Erro ao carregar stats:', e);
    }
}



document.getElementById('btn-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'LF_TOGGLE_SETTINGS' }).catch(() => {
                alert('Abra um vídeo no YouTube/Netflix para acessar as configurações do player.');
            });
            window.close();
        }
    });
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    setInterval(loadStats, 2000);
});
