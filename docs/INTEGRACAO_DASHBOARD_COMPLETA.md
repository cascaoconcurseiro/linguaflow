# 🔗 Integração Dashboard Completa - Sistema de Decks

**Data:** 25/04/2026  
**Objetivo:** Dashboard igual ao Anki com sistema completo de decks

---

## 🎯 Problemas Identificados

### 1. Palavras não aparecem no dashboard
- ✅ Popup salva via `db.saveWord()`
- ✅ Legendas salvam via botão "Salvar frase"
- ❌ Dashboard não atualiza automaticamente
- ❌ Falta sincronização em tempo real

### 2. Sistema de Decks incompleto
- ❌ Seletor de deck no player não funciona
- ❌ Dashboard não tem gerenciamento de decks
- ❌ Não é possível criar/editar/deletar decks
- ❌ Não é possível mover palavras entre decks

### 3. Falta funcionalidades do Anki
- ❌ Não tem aba "Decks" no dashboard
- ❌ Não mostra estatísticas por deck
- ❌ Não tem filtro por deck no vocabulário
- ❌ Não tem opção de estudar deck específico

---

## ✅ Solução Completa

### Fase 1: Sistema de Decks no Dashboard

#### 1.1 Nova Aba "Decks"
```html
<button class="nav-btn" data-tab="decks">
    📚 Decks
</button>

<div id="tab-decks" class="tab-content">
    <!-- Lista de decks com estatísticas -->
    <!-- Botão criar novo deck -->
    <!-- Opções: renomear, deletar, exportar -->
</div>
```

#### 1.2 Gerenciamento de Decks
- Criar novo deck
- Renomear deck
- Deletar deck (move palavras para Default)
- Exportar deck para Anki
- Estatísticas por deck

#### 1.3 Filtro por Deck no Vocabulário
```html
<select id="vocab-deck-filter">
    <option value="all">Todos os decks</option>
    <option value="1">Default Deck</option>
    <option value="2">Phrasal Verbs</option>
    <!-- ... -->
</select>
```

### Fase 2: Sincronização em Tempo Real

#### 2.1 Eventos de Atualização
```javascript
// Quando palavra é salva no popup/legenda
window.dispatchEvent(new CustomEvent('LF_WORD_SAVED', { 
    detail: { word: 'example', deck_id: 1 } 
}));

// Dashboard escuta e atualiza
window.addEventListener('LF_WORD_SAVED', () => {
    dashboard.loadVocab();
    dashboard.loadStats();
    dashboard.loadDecks();
});
```

#### 2.2 Mensagens entre Tabs
```javascript
// Background notifica todas as tabs do dashboard
chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
        if (tab.url?.includes('dashboard.html')) {
            chrome.tabs.sendMessage(tab.id, { 
                type: 'REFRESH_VOCAB',
                word: 'example'
            });
        }
    });
});
```

### Fase 3: Seletor de Deck Funcional

#### 3.1 Remover Seletor do Player
- Seletor no player não faz sentido (confuso)
- Usuário escolhe deck no popup ao salvar palavra

#### 3.2 Seletor no Popup
```javascript
// word-popup.js já tem seletor de deck
<select id="fdeck">
    <option value="1">Default Deck</option>
    <option value="2">Phrasal Verbs</option>
</select>
```

---

## 📋 Implementação

### Arquivos a Modificar

1. **dashboard/dashboard.html**
   - Adicionar aba "Decks"
   - Adicionar filtro de deck no vocabulário

2. **dashboard/dashboard.js**
   - Adicionar `loadDecks()`
   - Adicionar `renderDecks()`
   - Adicionar `createDeck()`, `renameDeck()`, `deleteDeck()`
   - Adicionar filtro por deck em `renderVocab()`
   - Melhorar listeners de sincronização

3. **content/subtitle-engine.js**
   - Remover `_injectDeckSelector()` do player
   - Manter apenas no popup

4. **utils/db.js**
   - Adicionar `getAllDecks()`
   - Adicionar `createDeck()`, `updateDeck()`, `deleteDeck()`
   - Adicionar `moveWordToDeck()`

5. **background/service-worker.js**
   - Melhorar `notifyDashboards()` para notificar todas as tabs

---

## 🎨 Design da Aba Decks

```
┌─────────────────────────────────────────────┐
│  📚 Meus Decks                    [+ Novo]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 📚 Default Deck                      │  │
│  │ 245 palavras · 12 para revisar      │  │
│  │ [Estudar] [Editar] [Exportar]       │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ ⚡ Phrasal Verbs                     │  │
│  │ 87 palavras · 5 para revisar        │  │
│  │ [Estudar] [Editar] [Exportar]       │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ 🎬 Frases de Filmes                 │  │
│  │ 156 frases · 8 para revisar         │  │
│  │ [Estudar] [Editar] [Exportar]       │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔄 Fluxo Completo

### Salvar Palavra
1. Usuário clica em palavra na legenda
2. Popup abre com seletor de deck
3. Usuário escolhe deck e clica "Salvar"
4. `db.saveWord()` salva no IndexedDB
5. Evento `LF_WORD_SAVED` é disparado
6. Background notifica todas as tabs do dashboard
7. Dashboard atualiza automaticamente

### Estudar Deck
1. Usuário abre dashboard
2. Vai na aba "Decks"
3. Clica em "Estudar" no deck desejado
4. Sistema carrega apenas cards daquele deck
5. Revisão funciona igual ao Anki

### Gerenciar Decks
1. Criar: Botão "+ Novo" → Modal com nome
2. Renomear: Botão "Editar" → Modal com novo nome
3. Deletar: Botão "Deletar" → Confirma e move palavras para Default
4. Exportar: Botão "Exportar" → Gera CSV para Anki

---

## ✅ Checklist de Implementação

### Fase 1: Sistema de Decks (30 min)
- [ ] Adicionar aba "Decks" no dashboard.html
- [ ] Implementar `loadDecks()` e `renderDecks()`
- [ ] Implementar `createDeck()`, `renameDeck()`, `deleteDeck()`
- [ ] Adicionar métodos no db.js

### Fase 2: Sincronização (15 min)
- [ ] Melhorar `notifyDashboards()` no service-worker
- [ ] Adicionar listeners no dashboard.js
- [ ] Testar sincronização entre tabs

### Fase 3: Filtros e Estudar (15 min)
- [ ] Adicionar filtro de deck no vocabulário
- [ ] Implementar "Estudar Deck" específico
- [ ] Remover seletor de deck do player

### Fase 4: Testes (10 min)
- [ ] Salvar palavra no popup → Aparece no dashboard
- [ ] Salvar frase na legenda → Aparece no dashboard
- [ ] Criar deck → Aparece na lista
- [ ] Mover palavra entre decks → Atualiza
- [ ] Estudar deck específico → Só mostra cards daquele deck

---

**Total:** ~70 minutos de implementação

