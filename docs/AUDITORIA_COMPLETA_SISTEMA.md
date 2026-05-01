# 🔍 AUDITORIA COMPLETA DO SISTEMA - Problemas Críticos

**Data:** 25/04/2026  
**Status:** 🔴 CRÍTICO - Múltiplos problemas de integração

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. 🔴 CRÍTICO: Salvar Frase não vai para Dashboard
**Problema:** Usuário salva frase mas não aparece no dashboard  
**Causa:** Falta integração entre subtitle-engine.js e db.js  
**Impacto:** Perda de dados do usuário

### 2. 🔴 CRÍTICO: Decks não aparecem no Dashboard
**Problema:** Aba "Decks" existe no HTML mas não carrega  
**Causa:** Método `loadDecks()` não implementado no dashboard.js  
**Impacto:** Funcionalidade completamente quebrada

### 3. 🔴 CRÍTICO: Erro ao salvar nos Flashcards
**Problema:** Erro ao tentar salvar palavra para revisão  
**Causa:** Integração quebrada entre word-popup.js e db.js  
**Impacto:** Sistema SRS não funciona

### 4. 🟡 MÉDIO: Popup não fixo no player
**Problema:** Popup rola junto com a página  
**Causa:** CSS com `position: absolute` ao invés de `fixed`  
**Impacto:** UX ruim, popup sai da tela

### 5. 🟡 MÉDIO: Popup não fica acima da legenda
**Problema:** Popup aparece atrás ou longe da legenda  
**Causa:** z-index baixo e posicionamento incorreto  
**Impacto:** Dificulta leitura

---

## 📋 CHECKLIST DE INTEGRAÇÃO

### ✅ Arquivos que DEVEM estar conectados:

```
content/subtitle-engine.js
    ↓ salva frase
utils/db.js
    ↓ armazena
dashboard/dashboard.js
    ↓ exibe
```

**Status:** ❌ QUEBRADO

```
content/word-popup.js
    ↓ salva palavra
utils/db.js
    ↓ cria card SRS
dashboard/dashboard.js
    ↓ exibe para revisão
```

**Status:** ❌ QUEBRADO

```
dashboard/dashboard.html
    ↓ tem aba Decks
dashboard/dashboard.js
    ↓ carrega decks
utils/db.js
    ↓ retorna decks
```

**Status:** ❌ QUEBRADO

---

## 🔧 CORREÇÕES NECESSÁRIAS

### CORREÇÃO 1: Integrar Salvamento de Frases

**Arquivo:** `content/subtitle-engine.js`

**Problema:** Não está usando db.js para salvar frases

**Solução:**
```javascript
// Adicionar no início do arquivo
import { db } from '../utils/db.js';

// Na função de salvar frase (tecla R)
async saveSentence(text, translation) {
    try {
        await db.saveWord({
            word: text,
            translation: translation,
            item_type: 'phrase',
            phrase_text: text,
            phrase_translation: translation,
            context_sentence: text,
            lang: 'en',
            deck_id: 1,
            platform: this.platform,
            video_url: window.location.href,
            video_title: document.title,
            timestamp: this.video?.currentTime || 0,
            added_at: Date.now()
        });
        
        // Notifica dashboard
        chrome.runtime.sendMessage({ 
            type: 'REFRESH_DASHBOARD',
            word: text 
        });
        
        console.log('[LinguaFlow] Frase salva:', text);
    } catch (e) {
        console.error('[LinguaFlow] Erro ao salvar frase:', e);
    }
}
```

---

### CORREÇÃO 2: Implementar loadDecks() no Dashboard

**Arquivo:** `dashboard/dashboard.js`

**Adicionar no método `switchTab()`:**
```javascript
if (tab === 'decks') this.loadDecks();
```

**Adicionar método `loadDecks()`:**
```javascript
async loadDecks() {
    const container = document.getElementById('decks-list');
    if (!container) return;

    try {
        // Importa db
        const { db } = await import('../utils/db.js');
        
        const decks = await db.getAllDecks();
        
        if (decks.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px 40px;color:#94A3B8;grid-column:1/-1;">
                    <div style="font-size:64px;">🎴</div>
                    <h2>Nenhum deck criado ainda</h2>
                    <p>Clique em "+ Novo Deck" para começar</p>
                </div>
            `;
            return;
        }

        const decksWithStats = await Promise.all(
            decks.map(async (deck) => {
                const stats = await db.getDeckStats(deck.id);
                return { ...deck, stats };
            })
        );

        container.innerHTML = decksWithStats.map(deck => this.renderDeckCard(deck)).join('');
        
        // Event listeners
        decksWithStats.forEach(deck => {
            document.getElementById(`btn-study-${deck.id}`)?.addEventListener('click', () => this.studyDeck(deck.id));
            document.getElementById(`btn-edit-${deck.id}`)?.addEventListener('click', () => this.editDeck(deck.id, deck.name));
            document.getElementById(`btn-delete-${deck.id}`)?.addEventListener('click', () => this.deleteDeck(deck.id, deck.name));
        });

    } catch (e) {
        console.error('[LinguaFlow Decks] Erro:', e);
        container.innerHTML = `
            <div style="text-align:center;padding:40px;color:#EF4444;grid-column:1/-1;">
                Erro ao carregar decks: ${e.message}
            </div>
        `;
    }
}

renderDeckCard(deck) {
    const stats = deck.stats || { total: 0, due: 0, byStatus: {} };
    const isDefault = deck.id === 1;
    
    return `
        <div class="deck-card" style="background:linear-gradient(135deg, rgba(56,189,248,0.08), rgba(167,139,250,0.08));border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:20px;">
            <h3 style="margin:0 0 16px;font-size:18px;color:#F8FAFC;">
                ${isDefault ? '📚' : '🎴'} ${deck.name}
            </h3>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#10B981;">${stats.total}</div>
                    <div style="font-size:11px;color:#94A3B8;">Total</div>
                </div>
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#F59E0B;">${stats.due}</div>
                    <div style="font-size:11px;color:#94A3B8;">Devidas</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button id="btn-study-${deck.id}" class="btn-action btn-blue" style="flex:1;">📖 Estudar</button>
                ${!isDefault ? `
                    <button id="btn-edit-${deck.id}" class="btn-action">✏️</button>
                    <button id="btn-delete-${deck.id}" class="btn-action btn-red">🗑️</button>
                ` : ''}
            </div>
        </div>
    `;
}

async createDeck() {
    const { db } = await import('../utils/db.js');
    const name = prompt('Nome do novo deck:');
    if (!name || !name.trim()) return;
    await db.createDeck(name.trim());
    await this.loadDecks();
    alert(`Deck "${name}" criado!`);
}

async editDeck(deckId, currentName) {
    const { db } = await import('../utils/db.js');
    const newName = prompt('Novo nome:', currentName);
    if (!newName || !newName.trim()) return;
    await db.updateDeck(deckId, newName.trim());
    await this.loadDecks();
}

async deleteDeck(deckId, deckName) {
    const { db } = await import('../utils/db.js');
    if (!confirm(`Deletar "${deckName}"?\n\nPalavras serão movidas para o deck padrão.`)) return;
    await db.deleteDeck(deckId);
    await this.loadDecks();
}

async studyDeck(deckId) {
    this.currentDeckFilter = deckId;
    this.switchTab('review');
    this.loadReview();
}
```

**Adicionar event listener no `setupEventListeners()`:**
```javascript
document.getElementById('btn-create-deck')?.addEventListener('click', () => this.createDeck());
```

---

### CORREÇÃO 3: Corrigir Salvamento de Palavras

**Arquivo:** `content/word-popup.js`

**Problema:** Não está salvando corretamente no db.js

**Solução:**
```javascript
// Adicionar no início
import { db } from '../utils/db.js';

// Na função de salvar palavra
async saveWord(wordData) {
    try {
        await db.saveWord({
            word: wordData.word,
            translation: wordData.translation,
            phonetic: wordData.phonetic || '',
            ipa: wordData.ipa || '',
            definition: wordData.definition || '',
            part_of_speech: wordData.pos || '',
            context_sentence: wordData.sentence || '',
            lang: 'en',
            deck_id: wordData.deckId || 1,
            platform: this.platform,
            video_url: window.location.href,
            video_title: document.title,
            timestamp: this.currentTime || 0,
            audio_url: wordData.audioUrl || '',
            added_at: Date.now()
        });
        
        // Notifica dashboard
        chrome.runtime.sendMessage({ 
            type: 'REFRESH_DASHBOARD',
            word: wordData.word 
        });
        
        console.log('[LinguaFlow] Palavra salva:', wordData.word);
        return { success: true };
    } catch (e) {
        console.error('[LinguaFlow] Erro ao salvar palavra:', e);
        return { success: false, error: e.message };
    }
}
```

---

### CORREÇÃO 4: Fixar Popup no Player

**Arquivo:** `content/word-popup.js` (CSS)

**Problema:** `position: absolute` faz popup rolar com a página

**Solução:**
```javascript
// No método que cria o popup, usar position: fixed
const popupHTML = `
<div id="lf-word-popup" style="
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 999999 !important;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 2px solid rgba(56, 189, 248, 0.3);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
">
    <!-- conteúdo do popup -->
</div>
`;
```

---

### CORREÇÃO 5: Posicionar Popup Acima da Legenda

**Arquivo:** `content/word-popup.js`

**Solução:**
```javascript
// Calcular posição baseada na legenda
function positionPopupAboveSubtitle() {
    const popup = document.getElementById('lf-word-popup');
    const subtitle = document.querySelector('.lf-subtitle-container');
    
    if (!popup || !subtitle) return;
    
    const subtitleRect = subtitle.getBoundingClientRect();
    
    // Posiciona acima da legenda
    popup.style.position = 'fixed';
    popup.style.bottom = `${window.innerHeight - subtitleRect.top + 20}px`;
    popup.style.left = '50%';
    popup.style.transform = 'translateX(-50%)';
    popup.style.zIndex = '999999';
}
```

---

## 📊 PLANO DE CORREÇÃO

### Fase 1: Correções Críticas (URGENTE)
1. ✅ Corrigir salvamento de frases
2. ✅ Implementar loadDecks() no dashboard
3. ✅ Corrigir salvamento de palavras
4. ✅ Fixar popup no player
5. ✅ Posicionar popup acima da legenda

### Fase 2: Testes de Integração
1. Testar salvar frase → ver no dashboard
2. Testar criar deck → ver na lista
3. Testar salvar palavra → ver nos flashcards
4. Testar popup → verificar posição fixa
5. Testar scroll → popup não deve mover

### Fase 3: Validação Completa
1. Verificar todas as integrações
2. Testar fluxo completo do usuário
3. Verificar sincronização em tempo real
4. Validar persistência de dados

---

## 🎯 ARQUIVOS QUE PRECISAM SER MODIFICADOS

1. ✅ `content/subtitle-engine.js` - Adicionar salvamento de frases
2. ✅ `content/word-popup.js` - Corrigir salvamento e posicionamento
3. ✅ `dashboard/dashboard.js` - Implementar loadDecks()
4. ✅ `utils/db.js` - Já está correto (não precisa modificar)

---

## ✅ RESULTADO ESPERADO

Após correções:
- ✅ Salvar frase → Aparece no dashboard imediatamente
- ✅ Criar deck → Aparece na lista de decks
- ✅ Salvar palavra → Aparece nos flashcards
- ✅ Popup fixo → Não rola com a página
- ✅ Popup acima da legenda → Sempre visível

---

**PRÓXIMO PASSO: Aplicar todas as correções nos arquivos**
