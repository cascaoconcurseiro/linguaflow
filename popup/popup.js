// popup/popup.js
import { db } from '../utils/db.js';

async function loadStats() {
    try {
        const stats = await db.getStats();
        
        document.getElementById('stat-due').textContent = stats.dueCards || 0;
        document.getElementById('stat-learned').textContent = stats.byStatus?.mature || 0;

        // Calculate Streak
        let streak = 0;
        const reviewDates = [...new Set((stats.sessions || []).map(s => s.date))].sort((a,b) => new Date(b) - new Date(a));
        const todayStr = new Date().toISOString().split('T')[0];
        if (reviewDates.length > 0 && Math.floor((new Date(todayStr)-new Date(reviewDates[0]))/(86400000)) <= 1) {
            streak = 1;
            for (let i = 1; i < reviewDates.length; i++) {
                if (Math.floor((new Date(reviewDates[i-1])-new Date(reviewDates[i]))/86400000) === 1) streak++;
                else break;
            }
        }
        document.getElementById('stat-streak').textContent = streak;

        // Calculate CEFR
        const weights = { A1: 1, A2: 1.5, B1: 2, B2: 3, C1: 4, C2: 5 };
        let vocabXP = 0;
        if (stats.byCEFR) Object.keys(stats.byCEFR).forEach(lv => { vocabXP += (stats.byCEFR[lv] || 0) * (weights[lv] || 1) * 10; });
        const immersionXP = Math.round((stats.totalSecs || 0) / 60);
        const retentionFactor = 0.8 + ((stats.retention || 0) / 100) * 0.4;
        const totalXP = Math.round((vocabXP + immersionXP) * retentionFactor);
        const levels = [
            { id: 'A1', name: 'Iniciante (Beginner)',         min: 0,       max: 5000     },
            { id: 'A2', name: 'Básico (Elementary)',          min: 5001,    max: 15000    },
            { id: 'B1', name: 'Intermediário (Intermediate)', min: 15001,   max: 40000    },
            { id: 'B2', name: 'Intermediário Superior',       min: 40001,   max: 90000    },
            { id: 'C1', name: 'Avançado (Advanced)',          min: 90001,   max: 150000   },
            { id: 'C2', name: 'Fluente (Proficient)',         min: 150001,  max: 10000000 }
        ];
        
        const currentIndex = levels.findIndex(l => totalXP >= l.min && totalXP <= l.max);
        const current = levels[currentIndex] || levels[0];
        const nextLevel = levels[currentIndex + 1] || null;
        const progress = Math.min(100, Math.round(((totalXP - current.min) / Math.max(1, current.max - current.min)) * 100));

        document.getElementById('stat-lvl-name').textContent = current.name;
        document.getElementById('stat-cefr').textContent = current.id;
        document.getElementById('stat-progress').style.width = progress + '%';
        
        if (nextLevel) {
            document.getElementById('stat-xp-text').textContent = `${totalXP.toLocaleString()} / ${current.max.toLocaleString()} XP`;
        } else {
            document.getElementById('stat-xp-text').textContent = 'Nível Máximo Atingido!';
        }

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

document.getElementById('btn-activate-generic').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                if (window.__LF_INITIALIZED__) return 'already-active';
                window.__LF_FORCE_GENERIC__ = true;
                import(chrome.runtime.getURL('content/index.js'));
                return 'activated';
            }
        });
        if (result === 'already-active') {
            alert('O LinguaFlow já está ativo nesta página.');
        }
        window.close();
    } catch (e) {
        console.error('[LinguaFlow Popup] Erro ao ativar modo genérico:', e);
        alert('Não foi possível ativar nesta página (ela pode bloquear extensões).');
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    setInterval(loadStats, 2000);
});
