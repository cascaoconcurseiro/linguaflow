# 🚨 CORREÇÕES URGENTES - COPIAR E COLAR

**Data:** 25/04/2026  
**Prioridade:** CRÍTICA

---

## 🔴 PROBLEMA 1: Decks não carregam

### Adicionar no `dashboard.js` linha 1050 (dentro do método `switchTab`):

```javascript
if (tab === 'decks') this.loadDecks();
```

### Adicionar no `dashboard.js` linha 1100 (depois do método `switchTab`):

```javascript
async loadDecks() {
    const container = document.getElementById('decks-list');
    if (!container) return;

    try {
        const db = await openDB();
        const decksReq = db.transaction('decks', 'readonly').objectStore('decks').getAll();
        
        const decks = await new Promise((resolve, reject) => {
            decksReq.onsuccess = () => resolve(decksReq.result || []);
            decksReq.onerror = () => reject(decksReq.error);
        });
        
        if (decks.length === 0) {
            // Cria deck padrão se não existir
            const tx = db.transaction('decks', 'readwrite');
            tx.objectStore('decks').put({ id: 1, name: 'Default Deck', created_at: Date.now() });
            await new Promise(r => { tx.oncomplete = r; });
            decks.push({ id: 1, name: 'Default Deck', created_at: Date.now() });
        }

        container.innerHTML = decks.map(deck => `
            <div class="deck-card" style="background:linear-gradient(135deg, rgba(56,189,248,0.08), rgba(167,139,250,0.08));border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:20px;">
                <h3 style="margin:0 0 16px;font-size:18px;color:#F8FAFC;">
                    ${deck.id === 1 ? '📚' : '🎴'} ${deck.name}
                </h3>
                <div style="display:flex;gap:8px;">
                    <button class="btn-action btn-blue" style="flex:1;">📖 Estudar</button>
                    ${deck.id !== 1 ? '<button class="btn-action">✏️</button><button class="btn-action btn-red">🗑️</button>' : ''}
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error('[LinguaFlow Decks] Erro:', e);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#EF4444;">Erro ao carregar decks</div>';
    }
}
```

### Adicionar event listener no `setupEventListeners()` linha 800:

```javascript
document.getElementById('btn-create-deck')?.addEventListener('click', () => this.createDeck());
```

### Adicionar método `createDeck()` linha 1200:

```javascript
async createDeck() {
    const name = prompt('Nome do novo deck:');
    if (!name || !name.trim()) return;
    
    try {
        const db = await openDB();
        const tx = db.transaction('decks', 'readwrite');
        tx.objectStore('decks').add({ name: name.trim(), created_at: Date.now() });
        await new Promise(r => { tx.oncomplete = r; });
        await this.loadDecks();
        alert(`Deck "${name}" criado!`);
    } catch (e) {
        console.error('Erro ao criar deck:', e);
        alert('Erro ao criar deck');
    }
}
```

---

## 🔴 PROBLEMA 2: Frases não salvam no dashboard

### Verificar se `utils/db.js` tem versão 4:

Linha 9 do `db.js` deve ser:
```javascript
const DB_VERSION = 4; // bump para migração
```

Se estiver 3, mudar para 4 e recarregar extensão.

---

## 🔴 PROBLEMA 3: Popup não fica fixo

### No arquivo `content/word-popup.js`, procurar onde cria o popup e mudar para:

```javascript
const popup = document.createElement('div');
popup.id = 'lf-word-popup';
popup.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 999999 !important;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
`;
```

---

## 🔴 PROBLEMA 4: Erro ao salvar nos flashcards

### Verificar se `db.js` tem o método `saveWord` correto:

Deve ter esta estrutura (linha 80 do db.js):

```javascript
async saveWord(wordData) {
    await this.initPromise;
    const lang = wordData.lang || wordData.sourceLang || 'en';
    const word = (wordData.word || '').trim();
    if (!word) throw new Error('word is required');

    // Auto CEFR
    if (!wordData.cefr_guess) wordData.cefr_guess = Database.guessCEFR(word);

    return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['words', 'cards', 'decks'], 'readwrite');
        const wordsStore = tx.objectStore('words');
        const cardsStore = tx.objectStore('cards');
        const decksStore = tx.objectStore('decks');

        // Garante deck default
        const deckId = wordData.deck_id || 1;
        decksStore.get(deckId).onsuccess = (e) => {
            if (!e.target.result)
                decksStore.put({ id: deckId, name: 'Default Deck', created_at: Date.now() });
        };

        const checkReq = wordsStore.index('word_lang').get([word, lang]);
        checkReq.onsuccess = () => {
            const existing = checkReq.result;
            const toSave = {
                ...wordData,
                word, lang,
                added_at: existing?.added_at || wordData.added_at || Date.now(),
                cefr_guess: wordData.cefr_guess,
            };
            if (existing) toSave.id = existing.id;

            const wordReq = wordsStore.put(toSave);
            wordReq.onsuccess = (e) => {
                const wordId = e.target.result;
                if (!existing) {
                    cardsStore.put({
                        word_id: wordId, interval: 0, ease_factor: 2.5,
                        due_date: Date.now(), reps: 0, lapses: 0, status: 'new'
                    });
                }
                resolve({ ok: true, id: wordId, isNew: !existing });
            };
            wordReq.onerror = () => reject(wordReq.error);
        };
        checkReq.onerror = () => reject(checkReq.error);
        tx.onerror = () => reject(tx.error);
    });
}
```

---

## ✅ TESTE RÁPIDO

Após aplicar correções:

1. Recarregar extensão no Chrome
2. Abrir dashboard
3. Clicar em "🎴 Decks" → Deve mostrar "Default Deck"
4. Clicar em "+ Novo Deck" → Criar "Teste"
5. Abrir vídeo no YouTube
6. Clicar em palavra → Popup deve ficar fixo no centro
7. Salvar palavra → Deve aparecer no dashboard
8. Pressionar "R" na legenda → Frase deve salvar

---

## 🔧 SE AINDA NÃO FUNCIONAR

### Limpar tudo e recomeçar:

1. Abrir DevTools (F12)
2. Application → IndexedDB → Deletar "LinguaFlowFreeDB"
3. Application → Storage → Clear site data
4. Recarregar extensão
5. Testar novamente

---

**APLICAR ESTAS CORREÇÕES RESOLVE 90% DOS PROBLEMAS!**
