// popup-deck-integration.js
// Integração do popup com sistema de decks

// Adicionar ao word-popup.js para permitir escolher deck ao salvar palavra

class PopupDeckIntegration {
    constructor(popup) {
        this.popup = popup;
        this.decks = [];
        this.selectedDeckId = 1; // Default
    }

    async init() {
        await this.loadDecks();
        this.injectDeckSelector();
    }

    async loadDecks() {
        try {
            const BASE = chrome.runtime.getURL('utils/');
            const { db } = await import(BASE + 'db.js');
            this.decks = await db.getAllDecks();
            
            if (this.decks.length === 0) {
                // Cria deck default se não existir
                await db.createDeck('Default Deck');
                this.decks = await db.getAllDecks();
            }
        } catch (e) {
            console.error('[PopupDeckIntegration] Erro ao carregar decks:', e);
            this.decks = [{ id: 1, name: 'Default Deck' }];
        }
    }

    injectDeckSelector() {
        // Encontra o container de deck no popup
        const deckContainer = this.popup._q('#fdeck');
        if (!deckContainer) return;

        // Limpa e popula com decks
        deckContainer.innerHTML = this.decks.map(deck => 
            `<option value="${deck.id}">${this.escapeHTML(deck.name)}</option>`
        ).join('');

        // Restaura seleção anterior
        const savedDeckId = localStorage.getItem('lf_last_deck_id');
        if (savedDeckId && this.decks.find(d => d.id === parseInt(savedDeckId))) {
            deckContainer.value = savedDeckId;
            this.selectedDeckId = parseInt(savedDeckId);
        }

        // Listener para mudança de deck
        deckContainer.addEventListener('change', (e) => {
            this.selectedDeckId = parseInt(e.target.value);
            localStorage.setItem('lf_last_deck_id', this.selectedDeckId);
        });
    }

    async createNewDeck() {
        const name = prompt('Nome do novo deck:');
        if (!name || !name.trim()) return;

        try {
            const BASE = chrome.runtime.getURL('utils/');
            const { db } = await import(BASE + 'db.js');
            const result = await db.createDeck(name.trim());
            
            await this.loadDecks();
            this.injectDeckSelector();
            
            // Seleciona o novo deck
            const deckContainer = this.popup._q('#fdeck');
            if (deckContainer) {
                deckContainer.value = result.id;
                this.selectedDeckId = result.id;
                localStorage.setItem('lf_last_deck_id', result.id);
            }

            this.showNotification(`✅ Deck "${name}" criado!`);
        } catch (e) {
            console.error('[PopupDeckIntegration] Erro ao criar deck:', e);
            alert('Erro ao criar deck');
        }
    }

    getDeckId() {
        return this.selectedDeckId;
    }

    showNotification(message) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10B981, #059669);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(16,185,129,0.4);
            z-index: 999999;
            animation: slideInRight 0.3s ease-out;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Modificação no método _save() do WordPopup para usar deck selecionado
// Adicionar ao word-popup.js:

/*
async _save() {
    const q=s=>this._q(s);
    const btn=q('#fsave');
    if(btn.textContent.includes('✅')) return;
    btn.textContent='Salvando…';
    const d=this.cache[this.word]||{};
    const BASE=chrome.runtime.getURL('utils/');
    const {db}=await import(BASE+'db.js');
    
    // NOVO: Pega deck_id do seletor
    const deckId = this.deckIntegration ? this.deckIntegration.getDeckId() : 1;
    
    try {
        await db.saveWord({
            word:this.word, 
            lang:this.engine?.cfg?.sourceLang||'en',
            translation:d.translation||'', 
            phonetic:d.phonetic||'',
            definition:d.definition||'', 
            context_sentence:this.context||'',
            video_url:location.href, 
            video_title:document.title,
            platform:this.platform||'youtube', 
            deck_id: deckId, // NOVO: Usa deck selecionado
            synonyms:(d.synonyms||[]).join(','), 
            antonyms:(d.antonyms||[]).join(','),
        });
        this.engine?.markWordSaved(this.word);
        btn.textContent='✅ Salvo nos Flashcards';
        btn.style.background='linear-gradient(135deg,#15803d,#16a34a)';
        
        // NOVO: Notifica dashboard para atualizar
        chrome.runtime.sendMessage({type:'REFRESH_VOCAB'});
    } catch(e) {
        console.error('[WordPopup] Erro ao salvar:',e);
        btn.textContent='❌ Erro ao salvar';
        setTimeout(()=>btn.textContent='+ Salvar nos Flashcards',2000);
    }
}
*/

// Exporta
window.PopupDeckIntegration = PopupDeckIntegration;
