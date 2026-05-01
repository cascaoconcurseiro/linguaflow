# 🎴 Sistema de Decks Completo - Igual ao Anki

**Data:** 25/04/2026  
**Versão:** 2.3  
**Status:** ✅ Implementando

---

## 🎯 Objetivo

Criar um sistema completo de decks igual ao Anki, onde:
- Usuário pode criar múltiplos decks
- Cada palavra/frase é salva em um deck específico
- Dashboard mostra estatísticas por deck
- Popup permite escolher o deck ao salvar
- Tudo sincronizado em tempo real

---

## 📋 Funcionalidades

### 1. Gerenciamento de Decks

#### Criar Deck
```javascript
await db.createDeck("Inglês Técnico")
// Retorna: { ok: true, id: 2 }
```

#### Listar Decks
```javascript
const decks = await db.getAllDecks()
// Retorna: [
//   { id: 1, name: "Default Deck", created_at: 1234567890 },
//   { id: 2, name: "Inglês Técnico", created_at: 1234567891 }
// ]
```

#### Editar Deck
```javascript
await db.updateDeck(2, "Inglês para Programação")
```

#### Deletar Deck
```javascript
await db.deleteDeck(2)
// Move todas as palavras para o deck padrão (id: 1)
```

#### Estatísticas por Deck
```javascript
const stats = await db.getDeckStats(2)
// Retorna: {
//   total: 150,
//   due: 25,
//   byStatus: { new: 50, learning: 30, review: 40, mature: 30 }
// }
```

---

### 2. Salvar Palavras em Decks

#### No Popup (word-popup.js)
```javascript
// Usuário clica em "Salvar palavra"
// Popup mostra seletor de deck
// Palavra é salva no deck escolhido

await db.saveWord({
    word: "implement",
    translation: "implementar",
    deck_id: 2, // Inglês Técnico
    lang: "en",
    // ... outros campos
})
```

#### Nas Legendas (subtitle-engine.js)
```javascript
// Usuário pressiona "R" para salvar frase
// Sistema usa o deck padrão ou último deck usado

await db.saveWord({
    word: "I need to implement this feature",
    item_type: "phrase",
    deck_id: 1, // Default
    // ... outros campos
})
```

---

### 3. Dashboard com Decks

#### Aba "Decks"
- Lista todos os decks
- Mostra estatísticas de cada deck
- Permite criar/editar/deletar decks
- Permite mover palavras entre decks

#### Aba "Vocabulário"
- Filtro por deck
- Mostra qual deck cada palavra pertence
- Permite mover palavra para outro deck

#### Aba "Revisão"
- Filtra cards por deck
- Mostra progresso por deck

---

## 🏗️ Arquitetura

### Banco de Dados (IndexedDB)

```javascript
// Store: decks
{
    id: 1,
    name: "Default Deck",
    created_at: 1234567890
}

// Store: words
{
    id: 123,
    word: "implement",
    translation: "implementar",
    deck_id: 2, // ← Referência ao deck
    lang: "en",
    // ... outros campos
}

// Store: cards (SRS)
{
    id: 456,
    word_id: 123, // ← Referência à palavra
    interval: 7,
    ease_factor: 2.5,
    due_date: 1234567890,
    status: "review"
}
```

### Índices

```javascript
// words store
createIndex('deck_id', 'deck_id', { unique: false })

// Permite buscar todas as palavras de um deck:
const words = await wordsStore.index('deck_id').getAll(deckId)
```

---

## 🎨 Interface do Dashboard

### Aba "Decks"

```
┌─────────────────────────────────────────────────────────┐
│ 🎴 Meus Decks                          [+ Novo Deck]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📚 Default Deck                                     │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ Total: 150 palavras  |  Devidas: 25  |  Novas: 50  │ │
│ │                                                     │ │
│ │ [Estudar] [Editar] [Estatísticas]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💻 Inglês Técnico                                   │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │ Total: 80 palavras  |  Devidas: 10  |  Novas: 20   │ │
│ │                                                     │ │
│ │ [Estudar] [Editar] [Deletar]                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Aba "Vocabulário" com Filtro de Deck

```
┌─────────────────────────────────────────────────────────┐
│ 📚 Vocabulário                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Buscar: [_________]  Deck: [Todos ▼]  Status: [Todos ▼]│
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Palavra    | Tradução  | Deck           | Status   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ implement  | implementar | Inglês Técnico | review  │ │
│ │ feature    | recurso     | Inglês Técnico | new     │ │
│ │ amazing    | incrível    | Default Deck   | mature  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementação

### 1. Adicionar Métodos no db.js ✅

Já implementados:
- `createDeck(name)`
- `getAllDecks()`
- `getDeck(id)`
- `updateDeck(id, name)`
- `deleteDeck(id)`
- `moveWordToDeck(wordId, deckId)`
- `getDeckStats(deckId)`

### 2. Criar Aba "Decks" no Dashboard

Arquivo: `dashboard/dashboard.html`

```html
<div id="tab-decks" class="tab-content">
    <div class="decks-header">
        <h2>🎴 Meus Decks</h2>
        <button id="btn-create-deck" class="btn-action btn-green">+ Novo Deck</button>
    </div>
    
    <div id="decks-list" class="decks-list">
        <!-- Decks serão renderizados aqui -->
    </div>
</div>
```

### 3. Adicionar Seletor de Deck no Popup

Arquivo: `content/word-popup.js`

```javascript
// Ao salvar palavra, mostra seletor de deck
async function showDeckSelector() {
    const decks = await db.getAllDecks()
    
    const html = `
        <div class="deck-selector">
            <label>Salvar em:</label>
            <select id="deck-select">
                ${decks.map(d => `
                    <option value="${d.id}">${d.name}</option>
                `).join('')}
            </select>
        </div>
    `
    
    // Adiciona ao popup
    popup.querySelector('.save-section').insertAdjacentHTML('beforeend', html)
}
```

### 4. Adicionar Filtro de Deck no Vocabulário

Arquivo: `dashboard/dashboard.js`

```javascript
// Adiciona filtro de deck
const deckFilter = document.createElement('select')
deckFilter.id = 'vocab-deck-filter'
deckFilter.innerHTML = '<option value="all">Todos os decks</option>'

const decks = await db.getAllDecks()
decks.forEach(deck => {
    const option = document.createElement('option')
    option.value = deck.id
    option.textContent = deck.name
    deckFilter.appendChild(option)
})

// Filtra palavras por deck
const filtered = words.filter(word => {
    const deckMatch = deckFilter.value === 'all' || word.deck_id == deckFilter.value
    return deckMatch && /* outros filtros */
})
```

---

## 🔄 Fluxo Completo

### Cenário 1: Usuário Cria Novo Deck

1. Dashboard → Aba "Decks" → Clica em "+ Novo Deck"
2. Modal aparece pedindo nome do deck
3. Usuário digita "Inglês para Viagens"
4. Sistema cria deck no IndexedDB
5. Deck aparece na lista

### Cenário 2: Usuário Salva Palavra em Deck Específico

1. Usuário assiste vídeo no YouTube
2. Clica em palavra "airport" na legenda
3. Popup aparece com definição
4. Usuário clica em "Salvar palavra"
5. Seletor de deck aparece
6. Usuário escolhe "Inglês para Viagens"
7. Palavra é salva com `deck_id: 3`
8. Dashboard atualiza automaticamente

### Cenário 3: Usuário Move Palavra Entre Decks

1. Dashboard → Aba "Vocabulário"
2. Usuário clica em palavra "airport"
3. Modal de detalhes aparece
4. Usuário clica em "Mover para outro deck"
5. Seletor de deck aparece
6. Usuário escolhe "Default Deck"
7. Palavra é movida
8. Estatísticas dos decks atualizam

### Cenário 4: Usuário Deleta Deck

1. Dashboard → Aba "Decks"
2. Usuário clica em "Deletar" no deck "Inglês para Viagens"
3. Confirmação aparece
4. Sistema move todas as palavras para "Default Deck"
5. Deck é deletado
6. Lista atualiza

---

## 📊 Estatísticas por Deck

```javascript
// Exemplo de estatísticas
{
    deckId: 2,
    deckName: "Inglês Técnico",
    total: 150,
    due: 25,
    byStatus: {
        new: 50,
        learning: 30,
        review: 40,
        mature: 30
    },
    retention: 85, // % de acertos
    streak: 7, // dias consecutivos estudando este deck
    avgInterval: 12 // intervalo médio dos cards
}
```

---

## 🎯 Benefícios

1. **Organização:** Separa vocabulário por tema/contexto
2. **Foco:** Estuda apenas o deck relevante
3. **Estatísticas:** Vê progresso por área
4. **Flexibilidade:** Move palavras entre decks facilmente
5. **Compatibilidade:** Sistema igual ao Anki (familiar)

---

## ✅ Checklist de Implementação

- [x] Métodos de deck no db.js
- [ ] Aba "Decks" no dashboard
- [ ] Renderizar lista de decks
- [ ] Criar novo deck
- [ ] Editar deck
- [ ] Deletar deck
- [ ] Estatísticas por deck
- [ ] Filtro de deck no vocabulário
- [ ] Seletor de deck no popup
- [ ] Mover palavra entre decks
- [ ] Sincronização em tempo real
- [ ] Testes completos

---

**Desenvolvido com ❤️ para LinguaFlow v2.3**
