// Dashboard Anki - LinguaFlow
const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 4;

let db = null;
let studyCards = [];
let currentIndex = 0;
let showAnswer = false;

// ============================================================================
// DATABASE
// ============================================================================
async function initDB() {
    return new Promise((resolve, reject) => {
        console.log('🔧 Dashboard: Abrindo IndexedDB:', DB_NAME, 'v', DB_VERSION);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
            console.error('❌ Dashboard: Erro ao abrir DB:', request.error);
            reject(request.error);
        };
        request.onsuccess = () => {
            db = request.result;
            console.log('✅ Dashboard: DB aberto com sucesso');
            console.log('Stores disponíveis:', Array.from(db.objectStoreNames));
            resolve(db);
        };
    });
}

async function getAllWords() {
    return new Promise((resolve) => {
        const tx = db.transaction('words', 'readonly');
        const request = tx.objectStore('words').getAll();
        request.onsuccess = () => {
            const words = request.result || [];
            console.log('📚 Dashboard: getAllWords retornou', words.length, 'palavras');
            console.log('Primeiras 3 palavras:', words.slice(0, 3));
            resolve(words);
        };
        request.onerror = () => {
            console.error('❌ Dashboard: Erro ao buscar palavras');
            resolve([]);
        };
    });
}

async function getAllCards() {
    return new Promise((resolve) => {
        const tx = db.transaction('cards', 'readonly');
        const request = tx.objectStore('cards').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function getCardsDue() {
    return new Promise((resolve) => {
        const tx = db.transaction(['cards', 'words'], 'readonly');
        const request = tx.objectStore('cards').index('due_date').getAll(IDBKeyRange.upperBound(Date.now()));
        
        request.onsuccess = () => {
            const cards = request.result || [];
            const promises = cards.map(card => {
                return new Promise((res) => {
                    const wordReq = tx.objectStore('words').get(card.word_id);
                    wordReq.onsuccess = () => {
                        card.wordData = wordReq.result;
                        res(card);
                    };
                    wordReq.onerror = () => res(card);
                });
            });
            Promise.all(promises).then(resolve);
        };
        request.onerror = () => resolve([]);
    });
}

async function updateCard(card, quality) {
    const now = Date.now();
    let { interval, ease_factor, reps } = card;
    
    if (quality >= 3) {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 6;
        else interval = Math.round(interval * ease_factor);
        reps++;
        card.status = reps >= 8 ? 'mature' : (reps >= 3 ? 'review' : 'learning');
    } else {
        reps = 0;
        interval = 1;
        card.status = 'learning';
    }
    
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;
    
    card.interval = interval;
    card.ease_factor = ease_factor;
    card.reps = reps;
    card.due_date = now + (interval * 24 * 60 * 60 * 1000);
    card.last_review = now;
    
    return new Promise((resolve) => {
        const tx = db.transaction('cards', 'readwrite');
        const request = tx.objectStore('cards').put(card);
        request.onsuccess = () => resolve(card);
        request.onerror = () => resolve(null);
    });
}

async function logReview(cardId, quality) {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve) => {
        const tx = db.transaction('review_log', 'readwrite');
        tx.objectStore('review_log').add({
            card_id: cardId,
            quality: quality,
            date: today,
            timestamp: Date.now()
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function getAllSentences() {
    return new Promise((resolve) => {
        const tx = db.transaction('sentences', 'readonly');
        const request = tx.objectStore('sentences').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function getReviewLog(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return new Promise((resolve) => {
        const tx = db.transaction('review_log', 'readonly');
        const request = tx.objectStore('review_log').index('date').getAll(IDBKeyRange.lowerBound(since));
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function getStats() {
    const [words, cards, reviewLog] = await Promise.all([
        getAllWords(),
        getAllCards(),
        getReviewLog(30)
    ]);
    
    const byStatus = { new: 0, learning: 0, review: 0, mature: 0 };
    cards.forEach(c => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });
    
    const dueCards = cards.filter(c => c.due_date <= Date.now()).length;
    const goodReviews = reviewLog.filter(r => r.quality >= 3).length;
    const retention = reviewLog.length > 0 ? Math.round((goodReviews / reviewLog.length) * 100) : 0;
    
    let streak = 0;
    const today = new Date();
    const reviewDates = new Set(reviewLog.map(r => r.date));
    
    for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        if (reviewDates.has(dateStr)) streak++;
        else if (i > 0) break;
    }
    
    return { totalWords: words.length, dueCards, streak, byStatus, retention };
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.nav-tab').classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.getElementById(tabName + '-section').classList.add('active');
    
    switch(tabName) {
        case 'study': loadStudy(); break;
        case 'cards': loadCards(); break;
        case 'phrases': loadPhrases(); break;
        case 'decks': loadDecks(); break;
        case 'listening': loadListening(); break;
        case 'stats': loadStats(); break;
    }
}

async function updateHeader() {
    const stats = await getStats();
    document.getElementById('headerTotal').textContent = stats.totalWords;
    document.getElementById('headerDue').textContent = stats.dueCards;
    document.getElementById('headerStreak').textContent = stats.streak;
}

// ============================================================================
// STUDY MODE
// ============================================================================
async function loadStudy() {
    const dueCards = await getCardsDue();
    studyCards = dueCards.sort((a, b) => {
        const priority = { learning: 0, new: 1, review: 2, mature: 3 };
        return (priority[a.status] || 3) - (priority[b.status] || 3);
    });
    
    currentIndex = 0;
    showAnswer = false;
    
    if (studyCards.length === 0) {
        document.getElementById('studyContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎉</div>
                <div class="empty-text">Parabéns! Você revisou todos os cards!</div>
            </div>
        `;
        document.getElementById('studyProgress').textContent = '';
        return;
    }
    
    showCard();
}

function showCard() {
    if (currentIndex >= studyCards.length) {
        loadStudy();
        return;
    }
    
    const card = studyCards[currentIndex];
    const word = card.wordData;
    
    if (!word) {
        currentIndex++;
        showCard();
        return;
    }
    
    document.getElementById('studyProgress').textContent = `Card ${currentIndex + 1} de ${studyCards.length}`;
    
    if (!showAnswer) {
        document.getElementById('studyContent').innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard" onclick="revealAnswer()">
                    <div class="flashcard-word">${word.word}</div>
                    <div class="flashcard-context">${word.context_sentence || ''}</div>
                    <div class="flashcard-hint">Clique para revelar a resposta</div>
                </div>
            </div>
        `;
    } else {
        document.getElementById('studyContent').innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard">
                    <div class="flashcard-word">${word.word}</div>
                    <div class="flashcard-translation">${word.translation}</div>
                    <div class="flashcard-context">${word.context_sentence || ''}</div>
                </div>
            </div>
            <div class="study-actions">
                <button class="study-btn again" onclick="answerCard(1)">
                    <span class="study-btn-label">Errei</span>
                    <span class="study-btn-time">&lt;1 min</span>
                </button>
                <button class="study-btn hard" onclick="answerCard(2)">
                    <span class="study-btn-label">Difícil</span>
                    <span class="study-btn-time">&lt;6 min</span>
                </button>
                <button class="study-btn good" onclick="answerCard(3)">
                    <span class="study-btn-label">Bom</span>
                    <span class="study-btn-time">${getInterval(card, 3)}</span>
                </button>
                <button class="study-btn easy" onclick="answerCard(4)">
                    <span class="study-btn-label">Fácil</span>
                    <span class="study-btn-time">${getInterval(card, 4)}</span>
                </button>
            </div>
        `;
    }
}

function getInterval(card, quality) {
    let interval = card.interval || 0;
    let reps = card.reps || 0;
    
    if (quality >= 3) {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 6;
        else interval = Math.round(interval * (card.ease_factor || 2.5));
    } else {
        interval = 1;
    }
    
    if (interval < 1) return '<1 dia';
    if (interval === 1) return '1 dia';
    if (interval < 30) return `${interval} dias`;
    return `${Math.round(interval / 30)} meses`;
}

function revealAnswer() {
    showAnswer = true;
    showCard();
}

async function answerCard(quality) {
    const card = studyCards[currentIndex];
    await updateCard(card, quality);
    await logReview(card.id, quality);
    
    currentIndex++;
    showAnswer = false;
    await updateHeader();
    showCard();
}

// ============================================================================
// CARDS
// ============================================================================
async function loadCards() {
    const words = await getAllWords();
    const cards = await getAllCards();
    
    const cardMap = {};
    cards.forEach(c => cardMap[c.word_id] = c);
    
    const search = document.getElementById('searchCards')?.value.toLowerCase() || '';
    const status = document.getElementById('filterStatus')?.value || 'all';
    
    let filtered = words.filter(w => {
        const matchSearch = w.word.toLowerCase().includes(search) || (w.translation || '').toLowerCase().includes(search);
        const card = cardMap[w.id];
        const matchStatus = status === 'all' || card?.status === status;
        return matchSearch && matchStatus;
    });
    
    const grid = document.getElementById('cardsGrid');
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon">📚</div>
                <div class="empty-text">Nenhum card encontrado</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filtered.map(word => {
        const card = cardMap[word.id];
        const status = card?.status || 'new';
        
        return `
            <div class="word-card">
                <div class="word-card-word">${word.word}</div>
                <div class="word-card-translation">${word.translation || ''}</div>
                <div class="word-card-context">${word.context_sentence || ''}</div>
                <div class="word-card-meta">
                    <span class="status-badge status-${status}">${status}</span>
                    <span>${new Date(word.added_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// PHRASES
// ============================================================================
async function loadPhrases() {
    const sentences = await getAllSentences();
    const list = document.getElementById('phrasesList');
    
    if (sentences.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <div class="empty-text">Nenhuma frase salva</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = sentences.map(s => `
        <div class="phrase-item">
            <div class="phrase-original">${s.original || s.phrase_text || ''}</div>
            <div class="phrase-translation">${s.translation || s.phrase_translation || ''}</div>
            <div class="phrase-meta">${s.platform || ''} • ${new Date(s.saved_at || s.added_at).toLocaleDateString('pt-BR')}</div>
        </div>
    `).join('');
}

function exportPhrases() {
    getAllSentences().then(sentences => {
        const text = sentences.map(s => `${s.original || s.phrase_text}\n${s.translation || s.phrase_translation}\n---\n`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linguaflow-frases-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// ============================================================================
// LISTENING
// ============================================================================
let currentListeningWord = null;

async function loadListening() {
    const words = await getAllWords();
    if (words.length === 0) {
        document.getElementById('listeningContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎧</div>
                <div class="empty-text">Nenhuma palavra disponível</div>
            </div>
        `;
        return;
    }
    
    currentListeningWord = words[Math.floor(Math.random() * words.length)];
    
    document.getElementById('listeningContent').innerHTML = `
        <div class="flashcard-container">
            <div class="flashcard">
                <div class="flashcard-word" style="font-size: 32px; color: #94a3b8; margin-bottom: 30px;">🎧 Listening Practice</div>
                <button class="study-btn good" onclick="playAudio()" style="width: 120px; height: 120px; border-radius: 50%; font-size: 48px; margin: 30px auto;">
                    🔊
                </button>
                <input type="text" id="listeningAnswer" placeholder="Digite o que você ouviu..." 
                    style="width: 100%; max-width: 500px; padding: 20px; font-size: 20px; text-align: center; background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(56, 189, 248, 0.3); border-radius: 15px; color: #e2e8f0; margin: 30px 0;">
                <button class="btn btn-primary" onclick="checkAnswer()">Verificar</button>
                <div id="listeningResult" style="margin-top: 30px; font-size: 20px;"></div>
            </div>
        </div>
    `;
}

function playAudio() {
    if (!currentListeningWord) return;
    const utterance = new SpeechSynthesisUtterance(currentListeningWord.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
}

function checkAnswer() {
    const answer = document.getElementById('listeningAnswer').value.trim().toLowerCase();
    const correct = currentListeningWord.word.toLowerCase();
    const result = document.getElementById('listeningResult');
    
    if (answer === correct) {
        result.innerHTML = `<div style="color: #4ade80;">✅ Correto! <strong>${currentListeningWord.word}</strong> = ${currentListeningWord.translation}</div>`;
        setTimeout(() => loadListening(), 3000);
    } else {
        result.innerHTML = `<div style="color: #ef4444;">❌ Incorreto. Tente novamente!</div>`;
    }
}

// ============================================================================
// STATS
// ============================================================================
async function loadStats() {
    const stats = await getStats();
    
    document.getElementById('statTotal').textContent = stats.totalWords;
    document.getElementById('statNew').textContent = stats.byStatus.new || 0;
    document.getElementById('statLearning').textContent = stats.byStatus.learning || 0;
    document.getElementById('statMature').textContent = stats.byStatus.mature || 0;
    document.getElementById('retentionRate').textContent = stats.retention + '%';
}

// ============================================================================
// FILTERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchCards')?.addEventListener('input', () => {
        if (document.getElementById('cards-section').classList.contains('active')) loadCards();
    });
    
    document.getElementById('filterStatus')?.addEventListener('change', () => {
        if (document.getElementById('cards-section').classList.contains('active')) loadCards();
    });
});

// ============================================================================
// DECKS
// ============================================================================
async function getAllDecks() {
    return new Promise((resolve) => {
        const tx = db.transaction('decks', 'readonly');
        const request = tx.objectStore('decks').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function createNewDeck(name) {
    return new Promise((resolve) => {
        const tx = db.transaction('decks', 'readwrite');
        const request = tx.objectStore('decks').add({
            name: name,
            created_at: Date.now()
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function loadDecks() {
    const decks = await getAllDecks();
    const words = await getAllWords();
    const cards = await getAllCards();
    
    const list = document.getElementById('decksList');
    
    if (decks.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <div class="empty-text">Nenhum deck criado ainda</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = decks.map(deck => {
        const deckWords = words.filter(w => w.deck_id === deck.id);
        const deckCardIds = new Set(deckWords.map(w => w.id));
        const deckCards = cards.filter(c => deckCardIds.has(c.word_id));
        const dueCount = deckCards.filter(c => c.due_date <= Date.now()).length;
        
        return `
            <div class="phrase-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="phrase-original">📚 ${deck.name}</div>
                        <div class="phrase-meta">${deckWords.length} palavras • ${dueCount} para revisar</div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" onclick="studyDeck(${deck.id})">Estudar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function createDeck() {
    const name = prompt('Nome do novo deck:');
    if (name && name.trim()) {
        createNewDeck(name.trim()).then(() => {
            loadDecks();
            updateHeader();
        });
    }
}

function studyDeck(deckId) {
    console.log('Estudar deck:', deckId);
    switchTab('study');
}

// ============================================================================
// REAL-TIME SYNC (ENHANCED)
// ============================================================================

let lastUpdateTime = 0;
let updateDebounceTimer = null;
let isUpdating = false; // ← NEW: Prevent concurrent updates

// Função centralizada de atualização
function refreshDashboard(source = 'unknown') {
    const now = Date.now();
    
    // Prevent concurrent updates
    if (isUpdating) {
        console.log(`🚫 Dashboard: Atualização em andamento, ignorando (fonte: ${source})`);
        return;
    }
    
    // Debounce: evita múltiplas atualizações em < 1000ms
    if (now - lastUpdateTime < 1000) {
        clearTimeout(updateDebounceTimer);
        updateDebounceTimer = setTimeout(() => refreshDashboard(source), 1000);
        return;
    }
    
    lastUpdateTime = now;
    isUpdating = true;
    console.log(`🔄 Dashboard: Atualizando (fonte: ${source})`);
    
    // Mostra indicador visual de atualização
    showUpdateIndicator();
    
    // Update in sequence to avoid race conditions
    updateHeader().then(() => {
        // Recarrega a seção ativa
        const activeSection = document.querySelector('.content-section.active');
        if (activeSection) {
            const sectionId = activeSection.id.replace('-section', '');
            switch(sectionId) {
                case 'study': return loadStudy();
                case 'cards': return loadCards();
                case 'phrases': return loadPhrases();
                case 'decks': return loadDecks();
                case 'stats': return loadStats();
                default: return Promise.resolve();
            }
        }
        return Promise.resolve();
    }).finally(() => {
        isUpdating = false;
    });
}

// Indicador visual de atualização
function showUpdateIndicator() {
    let indicator = document.getElementById('update-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'update-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(56, 189, 248, 0.95);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        indicator.textContent = '✓ Atualizado';
        document.body.appendChild(indicator);
    }
    
    indicator.style.display = 'block';
    indicator.style.animation = 'slideIn 0.3s ease-out';
    
    setTimeout(() => {
        indicator.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => indicator.style.display = 'none', 300);
    }, 2000);
}

// 1. Listener de mensagens do runtime (primary)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Dashboard: Mensagem recebida:', request.type);
    
    if (request.type === 'REFRESH_VOCAB' || request.type === 'REFRESH_DASHBOARD' || request.type === 'WORD_SAVED') {
        refreshDashboard('runtime.onMessage');
        sendResponse({ ok: true });
    }
    return true;
});

// 2. Polling rápido (primary mechanism) - 3 segundos
let pollCount = 0;
setInterval(() => {
    pollCount++;
    // Atualiza header a cada 3s
    updateHeader();
    
    // Recarrega seção a cada 15s (5 polls)
    if (pollCount % 5 === 0) {
        console.log('⏰ Dashboard: Polling de atualização');
        refreshDashboard('polling');
    }
}, 3000);

// 4. Botão de refresh manual
function addManualRefreshButton() {
    const header = document.querySelector('.header');
    if (!header || document.getElementById('manual-refresh-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'manual-refresh-btn';
    btn.innerHTML = '🔄';
    btn.title = 'Atualizar Dashboard';
    btn.style.cssText = `
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.3);
        color: #38BDF8;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        margin-left: 10px;
    `;
    btn.onmouseenter = () => {
        btn.style.background = 'rgba(56, 189, 248, 0.2)';
        btn.style.transform = 'rotate(180deg)';
    };
    btn.onmouseleave = () => {
        btn.style.background = 'rgba(56, 189, 248, 0.1)';
        btn.style.transform = 'rotate(0deg)';
    };
    btn.onclick = () => {
        btn.style.animation = 'spin 0.5s ease-out';
        refreshDashboard('manual');
        setTimeout(() => btn.style.animation = '', 500);
    };
    
    header.appendChild(btn);
}

// Adiciona CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ============================================================================
// INIT
// ============================================================================
async function init() {
    try {
        await initDB();
        await updateHeader();
        await loadStudy();
        addManualRefreshButton();
        console.log('✅ Dashboard inicializado e escutando atualizações');
        console.log('🔊 Listeners ativos: runtime.onMessage, storage.onChanged, polling (2s)');
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

init();
