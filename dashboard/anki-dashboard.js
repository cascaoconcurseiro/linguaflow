// anki-dashboard.js - Dashboard completo estilo Anki
const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 4;

let db = null;
let currentStudyCards = [];
let currentCardIndex = 0;
let showingAnswer = false;
let currentListeningCard = null;

// ============================================================================
// DATABASE
// ============================================================================
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            
            if (!database.objectStoreNames.contains('words')) {
                const wordsStore = database.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                wordsStore.createIndex('word_lang', ['word', 'lang'], { unique: true });
                wordsStore.createIndex('deck_id', 'deck_id', { unique: false });
            }
            
            if (!database.objectStoreNames.contains('cards')) {
                const cardsStore = database.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                cardsStore.createIndex('word_id', 'word_id', { unique: true });
                cardsStore.createIndex('due_date', 'due_date', { unique: false });
                cardsStore.createIndex('status', 'status', { unique: false });
            }
            
            if (!database.objectStoreNames.contains('decks')) {
                database.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!database.objectStoreNames.contains('sentences')) {
                database.createObjectStore('sentences', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!database.objectStoreNames.contains('review_log')) {
                const logStore = database.createObjectStore('review_log', { keyPath: 'id', autoIncrement: true });
                logStore.createIndex('date', 'date', { unique: false });
            }
        };
    });
}

// ============================================================================
// DATA FUNCTIONS
// ============================================================================
async function getAllWords() {
    return new Promise((resolve) => {
        const tx = db.transaction('words', 'readonly');
        const request = tx.objectStore('words').getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
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
        const cardsStore = tx.objectStore('cards');
        const wordsStore = tx.objectStore('words');
        
        const request = cardsStore.index('due_date').getAll(IDBKeyRange.upperBound(Date.now()));
        
        request.onsuccess = () => {
            const cards = request.result || [];
            const promises = cards.map(card => {
                return new Promise((res) => {
                    const wordReq = wordsStore.get(card.word_id);
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
    // SuperMemo-2 Algorithm
    const now = Date.now();
    let { interval, ease_factor, reps } = card;
    
    if (quality >= 3) {
        // Correct answer
        if (reps === 0) {
            interval = 1;
        } else if (reps === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * ease_factor);
        }
        reps++;
        card.status = reps >= 8 ? 'mature' : (reps >= 3 ? 'review' : 'learning');
    } else {
        // Incorrect answer
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
        const request = tx.objectStore('review_log').add({
            card_id: cardId,
            quality: quality,
            date: today,
            timestamp: Date.now()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
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

async function deleteWord(wordId) {
    return new Promise((resolve) => {
        const tx = db.transaction(['words', 'cards'], 'readwrite');
        tx.objectStore('words').delete(wordId);
        
        const cardsStore = tx.objectStore('cards');
        const index = cardsStore.index('word_id');
        const request = index.get(wordId);
        
        request.onsuccess = () => {
            if (request.result) {
                cardsStore.delete(request.result.id);
            }
        };
        
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
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
    
    // Calculate streak
    let streak = 0;
    const today = new Date();
    const reviewDates = new Set(reviewLog.map(r => r.date));
    
    for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (reviewDates.has(dateStr)) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    
    return {
        totalWords: words.length,
        dueCards,
        streak,
        byStatus,
        retention,
        reviewLog
    };
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

// ============================================================================
// UI FUNCTIONS
// ============================================================================
function showSection(sectionName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
    
    // Load section data
    switch(sectionName) {
        case 'study':
            loadStudyMode();
            break;
        case 'cards':
            loadCards();
            break;
        case 'phrases':
            loadPhrases();
            break;
        case 'listening':
            loadListening();
            break;
        case 'stats':
            loadStats();
            break;
        case 'decks':
            loadDecks();
            break;
    }
}

async function updateHeader() {
    const stats = await getStats();
    document.getElementById('totalWords').textContent = stats.totalWords;
    document.getElementById('dueCards').textContent = stats.dueCards;
    document.getElementById('streak').textContent = stats.streak;
}

// ============================================================================
// STUDY MODE
// ============================================================================
async function loadStudyMode() {
    const dueCards = await getCardsDue();
    currentStudyCards = dueCards.sort((a, b) => {
        const priority = { learning: 0, new: 1, review: 2, mature: 3 };
        return (priority[a.status] || 3) - (priority[b.status] || 3);
    });
    
    currentCardIndex = 0;
    showingAnswer = false;
    
    if (currentStudyCards.length === 0) {
        document.getElementById('studyContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <div class="empty-state-text">Parabéns! Você revisou todos os cards de hoje!</div>
                <button class="btn btn-primary" style="margin-top: 20px;" onclick="loadCards()">Ver Todos os Cards</button>
            </div>
        `;
        return;
    }
    
    showCurrentCard();
}

function showCurrentCard() {
    if (currentCardIndex >= currentStudyCards.length) {
        loadStudyMode();
        return;
    }
    
    const card = currentStudyCards[currentCardIndex];
    const word = card.wordData;
    
    if (!word) {
        currentCardIndex++;
        showCurrentCard();
        return;
    }
    
    const progress = `${currentCardIndex + 1} / ${currentStudyCards.length}`;
    
    if (!showingAnswer) {
        document.getElementById('studyContent').innerHTML = `
            <div style="margin-bottom: 20px; color: #64748b;">
                <span>Progresso: ${progress}</span>
                <span style="margin-left: 20px;">Status: <strong style="color: #38bdf8;">${card.status}</strong></span>
            </div>
            <div class="flashcard" onclick="revealAnswer()">
                <div class="flashcard-word">${word.word}</div>
                <div class="flashcard-context">${word.context_sentence || ''}</div>
                <div style="margin-top: 30px; color: #64748b; font-size: 14px;">Clique para revelar a resposta</div>
            </div>
        `;
    } else {
        document.getElementById('studyContent').innerHTML = `
            <div style="margin-bottom: 20px; color: #64748b;">
                <span>Progresso: ${progress}</span>
                <span style="margin-left: 20px;">Status: <strong style="color: #38bdf8;">${card.status}</strong></span>
            </div>
            <div class="flashcard">
                <div class="flashcard-word">${word.word}</div>
                <div class="flashcard-translation">${word.translation}</div>
                <div class="flashcard-context">${word.context_sentence || ''}</div>
                ${word.phonetic ? `<div style="margin-top: 15px; color: #94a3b8; font-size: 16px;">${word.phonetic}</div>` : ''}
            </div>
            <div class="study-buttons">
                <button class="study-btn again" onclick="answerCard(1)">
                    <div>Errei</div>
                    <div style="font-size: 12px; margin-top: 5px;">&lt;1 min</div>
                </button>
                <button class="study-btn hard" onclick="answerCard(2)">
                    <div>Difícil</div>
                    <div style="font-size: 12px; margin-top: 5px;">&lt;6 min</div>
                </button>
                <button class="study-btn good" onclick="answerCard(3)">
                    <div>Bom</div>
                    <div style="font-size: 12px; margin-top: 5px;">${getNextInterval(card, 3)}</div>
                </button>
                <button class="study-btn easy" onclick="answerCard(4)">
                    <div>Fácil</div>
                    <div style="font-size: 12px; margin-top: 5px;">${getNextInterval(card, 4)}</div>
                </button>
            </div>
        `;
    }
}

function getNextInterval(card, quality) {
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
    if (interval < 365) return `${Math.round(interval / 30)} meses`;
    return `${Math.round(interval / 365)} anos`;
}

function revealAnswer() {
    showingAnswer = true;
    showCurrentCard();
}

async function answerCard(quality) {
    const card = currentStudyCards[currentCardIndex];
    await updateCard(card, quality);
    await logReview(card.id, quality);
    
    currentCardIndex++;
    showingAnswer = false;
    await updateHeader();
    showCurrentCard();
}

// ============================================================================
// CARDS SECTION
// ============================================================================
async function loadCards() {
    const words = await getAllWords();
    const cards = await getAllCards();
    
    const cardMap = {};
    cards.forEach(c => {
        cardMap[c.word_id] = c;
    });
    
    const searchTerm = document.getElementById('searchCards')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    
    let filtered = words.filter(w => {
        const matchesSearch = w.word.toLowerCase().includes(searchTerm) || 
                            (w.translation || '').toLowerCase().includes(searchTerm);
        const card = cardMap[w.id];
        const matchesStatus = statusFilter === 'all' || card?.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    const grid = document.getElementById('cardsGrid');
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">Nenhum card encontrado. Comece assistindo vídeos e salvando palavras!</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filtered.map(word => {
        const card = cardMap[word.id];
        const status = card?.status || 'new';
        const statusColors = {
            new: '#94a3b8',
            learning: '#fbbf24',
            review: '#38bdf8',
            mature: '#4ade80'
        };
        
        return `
            <div class="card" onclick="showCardDetail(${word.id})">
                <div class="card-word">${word.word}</div>
                <div class="card-translation">${word.translation || ''}</div>
                <div class="card-context">${word.context_sentence || ''}</div>
                <div class="card-meta">
                    <span style="color: ${statusColors[status]};">● ${status}</span>
                    <span>${new Date(word.added_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `;
    }).join('');
}

function showCardDetail(wordId) {
    // TODO: Implementar modal com detalhes do card
    console.log('Show card detail:', wordId);
}

// ============================================================================
// PHRASES SECTION
// ============================================================================
async function loadPhrases() {
    const sentences = await getAllSentences();
    const list = document.getElementById('phrasesList');
    
    if (sentences.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">Nenhuma frase salva ainda. Use o botão "Salvar frase" nas legendas!</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = sentences.map(s => `
        <div class="phrase-item">
            <div class="phrase-original">${s.original || s.phrase_text || ''}</div>
            <div class="phrase-translation">${s.translation || s.phrase_translation || ''}</div>
            <div class="phrase-meta">
                ${s.platform || ''} • ${s.videoTitle || ''} • ${new Date(s.saved_at || s.added_at).toLocaleDateString('pt-BR')}
            </div>
        </div>
    `).join('');
}

function exportPhrases() {
    getAllSentences().then(sentences => {
        const text = sentences.map(s => 
            `${s.original || s.phrase_text}\n${s.translation || s.phrase_translation}\n---\n`
        ).join('\n');
        
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
// LISTENING SECTION
// ============================================================================
async function loadListening() {
    const words = await getAllWords();
    const wordsWithAudio = words.filter(w => w.word && w.word.length > 0);
    
    if (wordsWithAudio.length === 0) {
        document.getElementById('listeningContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎧</div>
                <div class="empty-state-text">Nenhuma palavra disponível para prática de listening</div>
            </div>
        `;
        return;
    }
    
    currentListeningCard = wordsWithAudio[Math.floor(Math.random() * wordsWithAudio.length)];
    
    document.getElementById('listeningContent').innerHTML = `
        <div class="listening-card">
            <h2 style="color: #38bdf8; margin-bottom: 20px;">🎧 Listening Practice</h2>
            <p style="color: #94a3b8; margin-bottom: 30px;">Ouça e escreva o que você ouviu</p>
            
            <button class="audio-btn" onclick="playListeningAudio()">🔊</button>
            
            <input type="text" class="answer-input" id="listeningAnswer" placeholder="Digite o que você ouviu...">
            
            <button class="btn btn-primary" onclick="checkListeningAnswer()">Verificar</button>
            
            <div id="listeningResult" style="margin-top: 20px; font-size: 18px;"></div>
        </div>
    `;
}

function playListeningAudio() {
    if (!currentListeningCard) return;
    
    const utterance = new SpeechSynthesisUtterance(currentListeningCard.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
}

function checkListeningAnswer() {
    const answer = document.getElementById('listeningAnswer').value.trim().toLowerCase();
    const correct = currentListeningCard.word.toLowerCase();
    const result = document.getElementById('listeningResult');
    
    if (answer === correct) {
        result.innerHTML = `
            <div style="color: #4ade80;">
                ✅ Correto! A palavra era: <strong>${currentListeningCard.word}</strong>
                <br>Tradução: ${currentListeningCard.translation}
            </div>
        `;
        setTimeout(() => loadListening(), 3000);
    } else {
        result.innerHTML = `
            <div style="color: #ef4444;">
                ❌ Incorreto. Tente novamente!
            </div>
        `;
    }
}

// ============================================================================
// STATS SECTION
// ============================================================================
async function loadStats() {
    const stats = await getStats();
    
    document.getElementById('statTotal').textContent = stats.totalWords;
    document.getElementById('statNew').textContent = stats.byStatus.new || 0;
    document.getElementById('statLearning').textContent = stats.byStatus.learning || 0;
    document.getElementById('statMature').textContent = stats.byStatus.mature || 0;
    document.getElementById('retentionRate').textContent = stats.retention + '%';
    
    // Simple chart
    drawProgressChart(stats.reviewLog);
}

function drawProgressChart(reviewLog) {
    const canvas = document.getElementById('progressChart');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Group by date
    const byDate = {};
    reviewLog.forEach(r => {
        byDate[r.date] = (byDate[r.date] || 0) + 1;
    });
    
    const dates = Object.keys(byDate).sort().slice(-30);
    const values = dates.map(d => byDate[d]);
    const maxValue = Math.max(...values, 1);
    
    // Draw bars
    const barWidth = canvas.width / dates.length;
    const barSpacing = 5;
    
    values.forEach((value, i) => {
        const barHeight = (value / maxValue) * (canvas.height - 40);
        const x = i * barWidth + barSpacing;
        const y = canvas.height - barHeight - 20;
        
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x, y, barWidth - barSpacing * 2, barHeight);
        
        // Value label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + (barWidth - barSpacing * 2) / 2, y - 5);
    });
}

// ============================================================================
// DECKS SECTION
// ============================================================================
async function loadDecks() {
    const decks = await getAllDecks();
    const words = await getAllWords();
    const cards = await getAllCards();
    
    const list = document.getElementById('decksList');
    
    if (decks.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">Nenhum deck criado ainda</div>
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
            <div class="deck-item">
                <div class="deck-info">
                    <h3>${deck.name}</h3>
                    <div class="deck-stats">
                        <span>${deckWords.length} palavras</span>
                        <span>${dueCount} para revisar</span>
                    </div>
                </div>
                <div class="deck-actions">
                    <button class="btn btn-primary" onclick="studyDeck(${deck.id})">Estudar</button>
                    <button class="btn btn-danger" onclick="deleteDeck(${deck.id})">Excluir</button>
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
        });
    }
}

function studyDeck(deckId) {
    // TODO: Filter study mode by deck
    showSection('study');
}

function deleteDeck(deckId) {
    if (confirm('Tem certeza que deseja excluir este deck?')) {
        // TODO: Implement deck deletion
        loadDecks();
    }
}

// ============================================================================
// SEARCH & FILTERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const searchCards = document.getElementById('searchCards');
    const filterStatus = document.getElementById('filterStatus');
    
    if (searchCards) {
        searchCards.addEventListener('input', () => {
            if (document.getElementById('cards').classList.contains('active')) {
                loadCards();
            }
        });
    }
    
    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            if (document.getElementById('cards').classList.contains('active')) {
                loadCards();
            }
        });
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
async function init() {
    try {
        await initDB();
        await updateHeader();
        await loadStudyMode();
        console.log('✅ Dashboard inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
    }
}

// Start
init();
