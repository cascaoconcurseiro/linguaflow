const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 3;

function setStatus(message, color = '') {
    const status = document.getElementById('db-status');
    status.textContent = message;
    status.style.color = color;
}

async function testDB() {
    setStatus('Testando...');

    try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            if (!db.objectStoreNames.contains('words')) {
                const store = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                store.createIndex('word_lang', ['word', 'lang'], { unique: true });
            }

            if (!db.objectStoreNames.contains('cards')) {
                const store = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                store.createIndex('word_id', 'word_id', { unique: true });
                store.createIndex('due_date', 'due_date', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['words'], 'readwrite');
            tx.objectStore('words').put({
                word: 'test',
                lang: 'en',
                translation: 'teste',
                added_at: Date.now()
            });

            tx.oncomplete = () => {
                const readTx = db.transaction(['words'], 'readonly');
                const countReq = readTx.objectStore('words').count();
                countReq.onsuccess = () => {
                    setStatus(`IndexedDB funcionando. Banco: ${DB_NAME}. Versao: ${DB_VERSION}. Total de palavras: ${countReq.result}`, 'green');
                    db.close();
                };
            };
        };

        request.onerror = (e) => {
            setStatus(`Erro ao abrir banco de dados: ${e.target.error}`, 'red');
        };
    } catch (e) {
        setStatus(`Erro: ${e.message}`, 'red');
    }
}

document.getElementById('btn-open-dashboard')?.addEventListener('click', () => {
    window.open('dashboard.html', '_blank', 'noopener');
});

document.getElementById('btn-test-db')?.addEventListener('click', testDB);
