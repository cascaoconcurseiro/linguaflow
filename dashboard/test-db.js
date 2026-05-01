const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 4;
let db = null;

function log(msg, type = 'info') {
    const output = document.getElementById('output');
    const color = type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#38bdf8';
    output.innerHTML += `<div style="color: ${color}; margin: 5px 0;">${msg}</div>`;
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            log('❌ Erro ao abrir DB: ' + request.error, 'error');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            log('✅ DB aberto com sucesso!', 'success');
            log('Stores disponíveis: ' + Array.from(db.objectStoreNames).join(', '));
            resolve(db);
        };
    });
}

async function testDB() {
    document.getElementById('output').innerHTML = '';
    log('🔧 Abrindo IndexedDB: ' + DB_NAME + ' v' + DB_VERSION);
    
    try {
        await openDB();
        log('✅ Banco de dados está funcionando!', 'success');
    } catch (e) {
        log('❌ Erro: ' + e.message, 'error');
    }
}

async function listWords() {
    document.getElementById('output').innerHTML = '';
    
    try {
        if (!db) await openDB();
        
        const tx = db.transaction('words', 'readonly');
        const store = tx.objectStore('words');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const words = request.result || [];
            log(`📚 Total de palavras: ${words.length}`, 'success');
            
            if (words.length > 0) {
                log('\n--- PALAVRAS ---');
                words.forEach((w, i) => {
                    log(`${i + 1}. ${w.word} = ${w.translation} (deck_id: ${w.deck_id})`);
                });
                
                log('\n--- JSON COMPLETO ---');
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(words, null, 2);
                document.getElementById('output').appendChild(pre);
            } else {
                log('⚠️ Nenhuma palavra encontrada!', 'error');
            }
        };
        
        request.onerror = () => {
            log('❌ Erro ao buscar palavras: ' + request.error, 'error');
        };
    } catch (e) {
        log('❌ Erro: ' + e.message, 'error');
    }
}

async function listCards() {
    document.getElementById('output').innerHTML = '';
    
    try {
        if (!db) await openDB();
        
        const tx = db.transaction('cards', 'readonly');
        const store = tx.objectStore('cards');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const cards = request.result || [];
            log(`🎴 Total de cards: ${cards.length}`, 'success');
            
            if (cards.length > 0) {
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(cards, null, 2);
                document.getElementById('output').appendChild(pre);
            } else {
                log('⚠️ Nenhum card encontrado!', 'error');
            }
        };
        
        request.onerror = () => {
            log('❌ Erro ao buscar cards: ' + request.error, 'error');
        };
    } catch (e) {
        log('❌ Erro: ' + e.message, 'error');
    }
}

async function listSentences() {
    document.getElementById('output').innerHTML = '';
    
    try {
        if (!db) await openDB();
        
        const tx = db.transaction('sentences', 'readonly');
        const store = tx.objectStore('sentences');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const sentences = request.result || [];
            log(`💬 Total de frases: ${sentences.length}`, 'success');
            
            if (sentences.length > 0) {
                const pre = document.createElement('pre');
                pre.textContent = JSON.stringify(sentences, null, 2);
                document.getElementById('output').appendChild(pre);
            } else {
                log('⚠️ Nenhuma frase encontrada!', 'error');
            }
        };
        
        request.onerror = () => {
            log('❌ Erro ao buscar frases: ' + request.error, 'error');
        };
    } catch (e) {
        log('❌ Erro: ' + e.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('testBtn').addEventListener('click', testDB);
    document.getElementById('wordsBtn').addEventListener('click', listWords);
    document.getElementById('cardsBtn').addEventListener('click', listCards);
    document.getElementById('sentencesBtn').addEventListener('click', listSentences);
    testDB();
});
