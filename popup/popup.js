// popup/popup.js
const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 3;

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('words')) {
                const s = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_lang', ['word', 'lang'], { unique: true });
                s.createIndex('deck_id', 'deck_id', { unique: false });
            }
            if (!db.objectStoreNames.contains('cards')) {
                const s = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_id', 'word_id', { unique: true });
                s.createIndex('due_date', 'due_date', { unique: false });
                s.createIndex('status', 'status', { unique: false });
            }
            if (!db.objectStoreNames.contains('decks'))
                db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains('known_words'))
                db.createObjectStore('known_words', { keyPath: ['word', 'lang'] });
            if (!db.objectStoreNames.contains('sessions'))
                db.createObjectStore('sessions', { keyPath: 'date' });
            if (!db.objectStoreNames.contains('settings'))
                db.createObjectStore('settings', { keyPath: 'key' });
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function loadStats() {
    try {
        const db = await openDB();

        const stats = await new Promise((resolve) => {
            const tx = db.transaction(['words', 'known_words', 'cards', 'settings'], 'readonly');
            let total = 0, learned = 0, newCards = 0, dueToday = 0;
            const now = Date.now();

            tx.objectStore('words').count().onsuccess = e => { total = e.target.result; };
            tx.objectStore('known_words').count().onsuccess = e => { learned = e.target.result; };
            tx.objectStore('cards').getAll().onsuccess = e => {
                const cards = e.target.result || [];
                newCards = cards.filter(c => c.status === 'new').length;
                dueToday = cards.filter(c => c.due_date <= now).length;
            };
            tx.oncomplete = () => resolve({ total, learned, newCards, dueToday });
            tx.onerror = () => resolve({ total: 0, learned: 0, newCards: 0, dueToday: 0 });
        });

        document.getElementById('stat-due').textContent = stats.dueToday;
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-new').textContent = stats.newCards;
        document.getElementById('stat-learned').textContent = stats.learned;

        // Palavra do Dia
        if (stats.total > 0) {
            const wod = await loadWordOfDay(db);
            if (wod) {
                document.getElementById('word-of-day').style.display = '';
                document.getElementById('wod-word').textContent = wod.word;
                document.getElementById('wod-translation').textContent = wod.translation || '';
                document.getElementById('wod-context').textContent = wod.context_sentence ? `"${wod.context_sentence}"` : '';
                document.getElementById('btn-review-wod').onclick = () => {
                    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
                };
            }
        }

        // Salva no chrome.storage para o badge
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ lf_stats: stats });
        }
    } catch(e) {
        console.error('[LinguaFlow Popup] Erro ao carregar stats:', e);
        ['stat-due', 'stat-total', 'stat-new', 'stat-learned'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
    }
}

async function loadWordOfDay(db) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `word_of_day_${today}`;
        
        // Busca palavra do dia salva
        const savedId = await new Promise(r => {
            const req = db.transaction('settings', 'readonly').objectStore('settings').get(key);
            req.onsuccess = () => r(req.result?.value);
            req.onerror = () => r(null);
        });

        // Busca todas as palavras
        const words = await new Promise(r => {
            const req = db.transaction('words', 'readonly').objectStore('words').getAll();
            req.onsuccess = () => r(req.result || []);
            req.onerror = () => r([]);
        });

        if (!words.length) return null;

        // Se já tem palavra do dia salva, retorna ela
        if (savedId) {
            const word = words.find(w => w.id === savedId);
            if (word) return word;
        }

        // Senão, pega palavra mais antiga e salva
        const sorted = words.sort((a, b) => (a.added_at || 0) - (b.added_at || 0));
        const pick = sorted[0];
        
        // Salva escolha do dia
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({ key, value: pick.id });
        
        return pick;
    } catch(e) {
        console.error('[LinguaFlow Popup] Erro ao carregar palavra do dia:', e);
        return null;
    }
}

document.getElementById('btn-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'))
            });
            window.close();
        }
    });
});

// Carrega stats inicialmente
loadStats();

// Atualiza stats a cada 2 segundos enquanto o popup está aberto
setInterval(loadStats, 2000);
