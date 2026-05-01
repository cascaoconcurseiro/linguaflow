// dashboard-decks-complete.js
// Sistema completo de Decks integrado com popup e SRS

class DeckManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.currentDeck = null;
        this.editingDeckId = null;
        this.movingWordId = null;
    }

    async init() {
        this.setupEventListeners();
        await this.loadDecks();
    }

    setupEventListeners() {
        // Botão criar deck
        const btnCreate = document.getElementById('btn-create-deck');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => this.showCreateDeckModal());
        }

        // Modal criar/editar deck
        document.getElementById('deck-modal-close')?.addEventListener('click', () => this.hideModal('deck-modal'));
        document.getElementById('deck-modal-cancel')?.addEventListener('click', () => this.hideModal('deck-modal'));
        document.getElementById('deck-modal-save')?.addEventListener('click', () => this.saveDeck());

        // Modal mover palavra
        document.getElementById('move-word-modal-close')?.addEventListener('click', () => this.hideModal('move-word-modal'));
        document.getElementById('move-word-cancel')?.addEventListener('click', () => this.hideModal('move-word-modal'));
        document.getElementById('move-word-confirm')?.addEventListener('click', () => this.confirmMoveWord());

        // Fechar modal ao clicar fora
        document.getElementById('deck-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'deck-modal') this.hideModal('deck-modal');
        });
        document.getElementById('move-word-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'move-word-modal') this.hideModal('move-word-modal');
        });
    }

    async loadDecks() {
        try {
            const db = await this.dashboard.openDB();
            const decks = await new Promise((resolve, reject) => {
                const req = db.transaction('decks', 'readonly').objectStore('decks').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            // Se não houver decks, cria o default
            if (decks.length === 0) {
                await this.createDefaultDeck();
                return this.loadDecks();
            }

            await this.renderDecks(decks);
        } catch (e) {
            console.error('[DeckManager] Erro ao carregar decks:', e);
            this.showError('Erro ao carregar decks');
        }
    }

    async createDefaultDeck() {
        const db = await this.dashboard.openDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction('decks', 'readwrite').objectStore('decks').add({
                id: 1,
                name: 'Default Deck',
                description: 'Deck padrão para todas as palavras',
                color: 'blue',
                created_at: Date.now()
            });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async renderDecks(decks) {
        const container = document.getElementById('decks-list');
        if (!container) return;

        container.innerHTML = '';

        if (decks.length === 0) {
            container.innerHTML = `
                <div class="deck-empty">
                    <div class="deck-empty-icon">📚</div>
                    <h2 style="color:#94A3B8;margin-bottom:8px;">Nenhum deck criado</h2>
                    <p style="color:#64748B;">Clique em "Criar Novo Deck" para começar</p>
                </div>
            `;
            return;
        }

        // Carrega stats de cada deck
        for (const deck of decks) {
            const stats = await this.getDeckStats(deck.id);
            const card = this.createDeckCard(deck, stats);
            container.appendChild(card);
        }
    }

    async getDeckStats(deckId) {
        try {
            const db = await this.dashboard.openDB();
            const [words, cards] = await Promise.all([
                new Promise(r => {
                    const req = db.transaction('words', 'readonly').objectStore('words').getAll();
                    req.onsuccess = () => r((req.result || []).filter(w => w.deck_id === deckId));
                    req.onerror = () => r([]);
                }),
                new Promise(r => {
                    const req = db.transaction('cards', 'readonly').objectStore('cards').getAll();
                    req.onsuccess = () => r(req.result || []);
                    req.onerror = () => r([]);
                })
            ]);

            const wordIds = new Set(words.map(w => w.id));
            const deckCards = cards.filter(c => wordIds.has(c.word_id));
            const now = Date.now();

            const stats = {
                total: words.length,
                new: 0,
                learning: 0,
                review: 0,
                mature: 0,
                due: 0
            };

            deckCards.forEach(card => {
                stats[card.status] = (stats[card.status] || 0) + 1;
                if (card.due_date <= now) stats.due++;
            });

            // Calcula progresso (% de cards mature)
            stats.progress = stats.total > 0 ? Math.round((stats.mature / stats.total) * 100) : 0;

            return stats;
        } catch (e) {
            console.error('[DeckManager] Erro ao carregar stats:', e);
            return { total: 0, new: 0, learning: 0, review: 0, mature: 0, due: 0, progress: 0 };
        }
    }

    createDeckCard(deck, stats) {
        const card = document.createElement('div');
        card.className = `deck-card color-${deck.color || 'blue'}`;
        card.dataset.deckId = deck.id;

        const canDelete = deck.id !== 1; // Não pode deletar deck default

        card.innerHTML = `
            <div class="deck-header">
                <h3>${this.escapeHTML(deck.name)}</h3>
                <div class="deck-actions">
                    <button onclick="deckManager.editDeck(${deck.id})" title="Editar">✏️</button>
                    ${canDelete ? `<button onclick="deckManager.deleteDeck(${deck.id})" title="Deletar">🗑️</button>` : ''}
                </div>
            </div>
            <div class="deck-description">${this.escapeHTML(deck.description || 'Sem descrição')}</div>
            <div class="deck-stats">
                <div class="deck-stat">
                    <span class="deck-stat-value">${stats.total}</span>
                    <span class="deck-stat-label">📚 Total</span>
                </div>
                <div class="deck-stat">
                    <span class="deck-stat-value" style="color:#F59E0B;">${stats.due}</span>
                    <span class="deck-stat-label">⏰ Para Revisar</span>
                </div>
                <div class="deck-stat">
                    <span class="deck-stat-value" style="color:#38BDF8;">${stats.new}</span>
                    <span class="deck-stat-label">✨ Novas</span>
                </div>
                <div class="deck-stat">
                    <span class="deck-stat-value" style="color:#10B981;">${stats.mature}</span>
                    <span class="deck-stat-label">✅ Dominadas</span>
                </div>
            </div>
            <div class="deck-progress-bar">
                <div class="deck-progress-fill" style="width:${stats.progress}%"></div>
            </div>
            <div class="deck-footer">
                <span>Progresso: ${stats.progress}%</span>
                <span>Criado: ${new Date(deck.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <button class="deck-study-btn" onclick="deckManager.studyDeck(${deck.id})" ${stats.due === 0 ? 'disabled' : ''}>
                ${stats.due > 0 ? `🎯 Estudar Agora (${stats.due})` : '✅ Tudo Revisado'}
            </button>
        `;

        return card;
    }

    showCreateDeckModal() {
        this.editingDeckId = null;
        document.getElementById('deck-modal-title').textContent = 'Criar Novo Deck';
        document.getElementById('deck-name-input').value = '';
        document.getElementById('deck-desc-input').value = '';
        document.getElementById('deck-color-input').value = 'blue';
        this.showModal('deck-modal');
    }

    async editDeck(deckId) {
        try {
            const db = await this.dashboard.openDB();
            const deck = await new Promise((resolve, reject) => {
                const req = db.transaction('decks', 'readonly').objectStore('decks').get(deckId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (!deck) {
                alert('Deck não encontrado');
                return;
            }

            this.editingDeckId = deckId;
            document.getElementById('deck-modal-title').textContent = 'Editar Deck';
            document.getElementById('deck-name-input').value = deck.name;
            document.getElementById('deck-desc-input').value = deck.description || '';
            document.getElementById('deck-color-input').value = deck.color || 'blue';
            this.showModal('deck-modal');
        } catch (e) {
            console.error('[DeckManager] Erro ao editar deck:', e);
            alert('Erro ao carregar deck');
        }
    }

    async saveDeck() {
        const name = document.getElementById('deck-name-input').value.trim();
        const description = document.getElementById('deck-desc-input').value.trim();
        const color = document.getElementById('deck-color-input').value;

        if (!name) {
            alert('Digite um nome para o deck');
            return;
        }

        try {
            const db = await this.dashboard.openDB();
            const tx = db.transaction('decks', 'readwrite');
            const store = tx.objectStore('decks');

            if (this.editingDeckId) {
                // Editar deck existente
                const deck = await new Promise((resolve, reject) => {
                    const req = store.get(this.editingDeckId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                deck.name = name;
                deck.description = description;
                deck.color = color;
                store.put(deck);
            } else {
                // Criar novo deck
                store.add({
                    name,
                    description,
                    color,
                    created_at: Date.now()
                });
            }

            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            this.hideModal('deck-modal');
            await this.loadDecks();
            this.showSuccess(this.editingDeckId ? 'Deck atualizado!' : 'Deck criado!');
        } catch (e) {
            console.error('[DeckManager] Erro ao salvar deck:', e);
            alert('Erro ao salvar deck');
        }
    }

    async deleteDeck(deckId) {
        if (deckId === 1) {
            alert('Não é possível deletar o deck padrão');
            return;
        }

        const stats = await this.getDeckStats(deckId);
        const confirmMsg = stats.total > 0
            ? `Tem certeza? Este deck tem ${stats.total} palavras.\nElas serão movidas para o deck padrão.`
            : 'Tem certeza que deseja deletar este deck?';

        if (!confirm(confirmMsg)) return;

        try {
            const db = await this.dashboard.openDB();
            const tx = db.transaction(['decks', 'words'], 'readwrite');

            // Move palavras para deck padrão
            const wordsReq = tx.objectStore('words').getAll();
            wordsReq.onsuccess = () => {
                const words = wordsReq.result || [];
                words.forEach(word => {
                    if (word.deck_id === deckId) {
                        word.deck_id = 1;
                        tx.objectStore('words').put(word);
                    }
                });

                // Deleta deck
                tx.objectStore('decks').delete(deckId);
            };

            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            await this.loadDecks();
            this.showSuccess('Deck deletado!');
        } catch (e) {
            console.error('[DeckManager] Erro ao deletar deck:', e);
            alert('Erro ao deletar deck');
        }
    }

    async studyDeck(deckId) {
        // Filtra cards do deck e inicia sessão de revisão
        try {
            const db = await this.dashboard.openDB();
            const [words, cards] = await Promise.all([
                new Promise(r => {
                    const req = db.transaction('words', 'readonly').objectStore('words').getAll();
                    req.onsuccess = () => r((req.result || []).filter(w => w.deck_id === deckId));
                    req.onerror = () => r([]);
                }),
                new Promise(r => {
                    const req = db.transaction('cards', 'readonly').objectStore('cards').getAll();
                    req.onsuccess = () => r(req.result || []);
                    req.onerror = () => r([]);
                })
            ]);

            const wordIds = new Set(words.map(w => w.id));
            const deckCards = cards.filter(c => wordIds.has(c.word_id) && c.due_date <= Date.now());

            if (deckCards.length === 0) {
                alert('Nenhum card para revisar neste deck!');
                return;
            }

            // Carrega palavras associadas
            const cardsWithWords = await Promise.all(
                deckCards.map(async card => {
                    const word = words.find(w => w.id === card.word_id);
                    return { ...card, wordData: word };
                })
            );

            // Atualiza dashboard para mostrar apenas cards deste deck
            this.dashboard.cards = cardsWithWords;
            this.dashboard.currentCardIndex = 0;
            this.dashboard.switchTab('review');
            this.dashboard.renderCard();

            this.showSuccess(`Iniciando revisão: ${deckCards.length} cards`);
        } catch (e) {
            console.error('[DeckManager] Erro ao iniciar estudo:', e);
            alert('Erro ao iniciar estudo');
        }
    }

    // Método para mover palavra entre decks (chamado do popup ou vocab)
    async showMoveWordModal(wordId) {
        this.movingWordId = wordId;

        // Carrega lista de decks
        const db = await this.dashboard.openDB();
        const decks = await new Promise((resolve, reject) => {
            const req = db.transaction('decks', 'readonly').objectStore('decks').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        const select = document.getElementById('move-word-deck-select');
        select.innerHTML = decks.map(d => `<option value="${d.id}">${this.escapeHTML(d.name)}</option>`).join('');

        this.showModal('move-word-modal');
    }

    async confirmMoveWord() {
        const deckId = parseInt(document.getElementById('move-word-deck-select').value);

        try {
            const db = await this.dashboard.openDB();
            const tx = db.transaction('words', 'readwrite');
            const store = tx.objectStore('words');

            const word = await new Promise((resolve, reject) => {
                const req = store.get(this.movingWordId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (!word) {
                alert('Palavra não encontrada');
                return;
            }

            word.deck_id = deckId;
            store.put(word);

            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            this.hideModal('move-word-modal');
            await this.loadDecks();
            this.showSuccess('Palavra movida!');
        } catch (e) {
            console.error('[DeckManager] Erro ao mover palavra:', e);
            alert('Erro ao mover palavra');
        }
    }

    // Utilitários
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    showSuccess(message) {
        // Cria notificação temporária
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(135deg, #10B981, #059669);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(16,185,129,0.4);
            z-index: 9999;
            animation: slideInRight 0.3s ease-out;
        `;
        notif.textContent = `✅ ${message}`;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    showError(message) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(239,68,68,0.4);
            z-index: 9999;
        `;
        notif.textContent = `❌ ${message}`;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Exporta para uso global
window.DeckManager = DeckManager;
