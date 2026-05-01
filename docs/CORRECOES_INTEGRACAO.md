# 🔧 Correções: Integração Popup → Dashboard

**Data:** 25/04/2026  
**Problema:** Palavras e frases salvas não aparecem no dashboard

---

## 🐛 Problemas Identificados

### 1. Seletor de Deck Vazado no Player
**Localização:** `content/subtitle-engine.js` → `_injectDeckSelector()`  
**Problema:** Botão "Deck: Default" aparece no canto superior esquerdo do player sem função  
**Solução:** Remover completamente (funcionalidade duplicada - já existe no popup)

### 2. Salvamento de Palavras
**Problema:** Palavras salvas pelo popup não aparecem no dashboard  
**Causa:** Falta de notificação entre content script e dashboard

### 3. Salvamento de Frases
**Problema:** Botão "Salvar frase" nas legendas não conecta com dashboard  
**Causa:** Método `_saveSentence()` não notifica o dashboard

---

## ✅ Correções Implementadas

### 1. Remover Seletor de Deck do Player

**Arquivo:** `content/subtitle-engine.js`

**Remover linha:**
```javascript
setTimeout(() => this._injectDeckSelector(), 1500);
```

**Remover método completo:**
```javascript
_injectDeckSelector() {
    // ... todo o método
}
```

**Justificativa:** Funcionalidade duplicada e sem utilidade no player.

---

### 2. Corrigir Salvamento no Popup

**Arquivo:** `content/word-popup.js`

**Método `_save()` atualizado:**
```javascript
async _save() {
    const q=s=>this._q(s);
    const btn=q('#fsave');
    if(btn.textContent.includes('✅')) return;
    btn.textContent='Salvando…';
    const d=this.cache[this.word]||{};
    const BASE=chrome.runtime.getURL('utils/');
    const {db}=await import(BASE+'db.js');
    try {
        const result = await db.saveWord({
            word:this.word, 
            lang:this.engine?.cfg?.sourceLang||'en',
            translation:d.translation||'', 
            phonetic:d.phonetic||'',
            definition:d.definition||'', 
            context_sentence:this.context||'',
            video_url:location.href, 
            video_title:document.title,
            platform:this.platform||'youtube', 
            deck_id:1,
            synonyms:(d.synonyms||[]).join(','), 
            antonyms:(d.antonyms||[]).join(','),
        });
        
        // NOVO: Notifica dashboard
        chrome.runtime.sendMessage({
            type: 'REFRESH_DASHBOARD',
            word: this.word
        }).catch(() => {});
        
        // NOVO: Notifica engine para atualizar cores
        this.engine?.markWordSaved(this.word);
        
        btn.textContent='✅ Salvo nos Flashcards';
        btn.style.background='linear-gradient(135deg,#15803d,#16a34a)';
    } catch(e) {
        console.error('[WordPopup] Erro ao salvar:',e);
        btn.textContent='❌ Erro ao salvar';
        setTimeout(()=>btn.textContent='+ Salvar nos Flashcards',2000);
    }
}
```

---

### 3. Corrigir Salvamento de Frases

**Arquivo:** `content/subtitle-engine.js`

**Método `_saveSentence()` atualizado:**
```javascript
async _saveSentence() {
    const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
    const cue = this._currentCue || this.cues[this.currentCueIndex];
    
    if (!cue || !cue.text) return;

    if (saveBtn) {
        saveBtn.textContent = 'Salvando...';
        saveBtn.disabled = true;
    }

    try {
        // Garante que tem tradução
        if (!cue.translatedText) {
            const { translator } = await import('../utils/translator.js');
            const result = await translator.translate(cue.text, 'auto', this.targetLang);
            cue.translatedText = result.translation;
        }

        // Salva no banco
        const { db } = await import('../utils/db.js');
        await db.saveWord({
            word: '[Frase]',
            lang: 'en',
            translation: cue.translatedText || '',
            context_sentence: cue.text,
            phrase_text: cue.text,
            phrase_translation: cue.translatedText || '',
            video_url: window.location.href,
            video_title: document.title,
            platform: this.platform,
            timestamp: cue.start / 1000,
            deck_id: 1,
            item_type: 'phrase',
            tags: ['phrase'],
            added_at: Date.now()
        });

        // NOVO: Notifica dashboard
        chrome.runtime.sendMessage({
            type: 'REFRESH_DASHBOARD',
            word: cue.text.substring(0, 30) + '...'
        }).catch(() => {});

        // Feedback visual
        if (saveBtn) {
            saveBtn.textContent = '✅ Salva!';
            saveBtn.classList.add('ok');
            setTimeout(() => {
                saveBtn.textContent = '+ Salvar frase';
                saveBtn.classList.remove('ok');
                saveBtn.disabled = false;
            }, 2000);
        }

        console.log('[LinguaFlow] 📌 Frase salva:', cue.text);
    } catch (e) {
        console.error('[LinguaFlow] Erro ao salvar frase:', e);
        if (saveBtn) {
            saveBtn.textContent = '❌ Erro';
            saveBtn.disabled = false;
            setTimeout(() => {
                saveBtn.textContent = '+ Salvar frase';
            }, 2000);
        }
    }
}
```

---

### 4. Adicionar Método no Engine

**Arquivo:** `content/subtitle-engine.js`

**Adicionar método:**
```javascript
markWordSaved(word) {
    const w = word.toLowerCase();
    this.savedWords.set(w, 'new');
    // Força re-render da legenda atual para atualizar cores
    if (this._currentCue) {
        this.renderDual(this._currentCue.text, this._currentCue.translatedText);
    }
}
```

---

### 5. Dashboard Escuta Atualizações

**Arquivo:** `dashboard/dashboard.js`

**Já implementado:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[LinguaFlow Dashboard] Mensagem recebida:', request.type);
    
    if (request.type === 'REFRESH_VOCAB' || request.type === 'REFRESH_DASHBOARD') {
        console.log('[LinguaFlow Dashboard] 🔄 Atualizando vocabulário e stats...');
        
        // Sempre recarrega vocab e stats
        dashboard.loadVocab();
        dashboard.loadStats();
        
        // Mostra notificação visual
        if (request.word) {
            const notif = document.createElement('div');
            notif.style.cssText = `
                position: fixed; bottom: 24px; right: 24px;
                background: linear-gradient(135deg, #10B981, #059669);
                color: white; padding: 12px 20px; border-radius: 10px;
                font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 8px 24px rgba(16,185,129,0.4); z-index: 9999;
                animation: slideInRight 0.3s ease-out;
            `;
            notif.textContent = `✅ "${request.word}" salva no deck!`;
            document.body.appendChild(notif);
            setTimeout(() => notif.remove(), 3000);
        }
        
        sendResponse({ ok: true });
    }
    
    return true;
});
```

---

## 🔄 Fluxo Completo

### Salvamento de Palavra (Popup)

```
1. Usuário clica em palavra na legenda
2. Popup abre com WordPopup.showForWord()
3. Usuário clica em "Salvar nos Flashcards"
4. WordPopup._save() executa:
   ├─ db.saveWord() → Salva no IndexedDB
   ├─ chrome.runtime.sendMessage('REFRESH_DASHBOARD') → Notifica dashboard
   └─ engine.markWordSaved() → Atualiza cores na legenda
5. Dashboard recebe mensagem e atualiza:
   ├─ dashboard.loadVocab() → Recarrega tabela
   ├─ dashboard.loadStats() → Atualiza estatísticas
   └─ Mostra notificação "✅ palavra salva no deck!"
```

### Salvamento de Frase (Legenda)

```
1. Usuário clica em "Salvar frase" na legenda
2. SubtitleEngine._saveSentence() executa:
   ├─ Traduz frase se necessário
   ├─ db.saveWord() com item_type='phrase' → Salva no IndexedDB
   ├─ chrome.runtime.sendMessage('REFRESH_DASHBOARD') → Notifica dashboard
   └─ Mostra feedback "✅ Salva!"
3. Dashboard recebe mensagem e atualiza:
   ├─ dashboard.loadVocab() → Recarrega tabela (inclui frases)
   ├─ dashboard.loadStats() → Atualiza estatísticas
   └─ Mostra notificação "✅ frase salva no deck!"
```

---

## 🧪 Como Testar

### Teste 1: Salvar Palavra pelo Popup
1. Abra um vídeo no YouTube com legendas
2. Clique em uma palavra na legenda
3. No popup, clique em "Salvar nos Flashcards"
4. **Resultado esperado:**
   - Botão muda para "✅ Salvo nos Flashcards"
   - Palavra fica azul claro na legenda (status 'new')
   - Dashboard (se aberto) mostra notificação verde
   - Palavra aparece na aba "Vocabulário" do dashboard

### Teste 2: Salvar Frase pela Legenda
1. Abra um vídeo no YouTube com legendas
2. Quando aparecer uma legenda, clique em "Salvar frase"
3. **Resultado esperado:**
   - Botão muda para "✅ Salva!"
   - Dashboard (se aberto) mostra notificação verde
   - Frase aparece na aba "Vocabulário" com tag "phrase"

### Teste 3: Dashboard Atualiza Automaticamente
1. Abra o dashboard em uma aba
2. Em outra aba, abra um vídeo e salve uma palavra
3. **Resultado esperado:**
   - Dashboard mostra notificação "✅ palavra salva no deck!"
   - Tabela de vocabulário atualiza automaticamente
   - Estatísticas atualizam (Total Words aumenta)

### Teste 4: Seletor de Deck Removido
1. Abra qualquer vídeo
2. Olhe para o canto superior esquerdo do player
3. **Resultado esperado:**
   - NÃO deve haver botão "Deck: Default"
   - Player deve estar limpo

---

## 📊 Checklist de Integração

- [ ] Remover `_injectDeckSelector()` do subtitle-engine.js
- [ ] Adicionar `markWordSaved()` no subtitle-engine.js
- [ ] Atualizar `_save()` no word-popup.js com notificações
- [ ] Atualizar `_saveSentence()` no subtitle-engine.js com notificações
- [ ] Verificar que dashboard.js já escuta mensagens (✅ já implementado)
- [ ] Testar salvamento de palavra
- [ ] Testar salvamento de frase
- [ ] Testar atualização automática do dashboard
- [ ] Verificar que seletor de deck foi removido

---

## 🔍 Debug

### Se palavras não aparecem no dashboard:

1. **Abra o console do dashboard:**
   ```
   F12 → Console
   ```

2. **Verifique se mensagens chegam:**
   ```
   [LinguaFlow Dashboard] Mensagem recebida: REFRESH_DASHBOARD
   [LinguaFlow Dashboard] 🔄 Atualizando vocabulário e stats...
   ```

3. **Verifique IndexedDB:**
   ```
   F12 → Application → IndexedDB → LinguaFlowFreeDB → words
   ```
   - Deve ter registros com as palavras salvas

4. **Verifique console do content script:**
   ```
   F12 na aba do vídeo → Console
   ```
   - Deve mostrar: `[LinguaFlow] 📌 Palavra salva: ...`

### Se frases não aparecem:

1. **Verifique item_type:**
   ```
   IndexedDB → words → Procure por item_type: 'phrase'
   ```

2. **Verifique filtro do dashboard:**
   ```
   Aba Vocabulário → Filtro "Qualidade" → Selecione "Frases"
   ```

---

## 🎯 Resultado Final

Após as correções:

✅ Palavras salvas pelo popup aparecem no dashboard  
✅ Frases salvas pela legenda aparecem no dashboard  
✅ Dashboard atualiza automaticamente quando algo é salvo  
✅ Notificações visuais confirmam salvamento  
✅ Cores das palavras atualizam na legenda  
✅ Seletor de deck removido do player  
✅ Integração completa entre todos os componentes  

---

**Desenvolvido com ❤️ para LinguaFlow v2.2**
