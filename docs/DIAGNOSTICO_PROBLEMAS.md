# 🔧 DIAGNÓSTICO DE PROBLEMAS - LinguaFlow

## 🚨 Problemas Reportados:

1. ❌ Salvar palavra no popup → Erro (não aparece no dashboard)
2. ❌ Criar deck → Não aparece no dashboard
3. ❌ Salvar frase → Não aparece no dashboard
4. ❌ Dashboard não mostra nada

---

## 🔍 PASSO A PASSO PARA DIAGNÓSTICO:

### 1. Abrir Página de Teste
1. Abra o Chrome
2. Vá para: `chrome-extension://[SEU_ID]/tests/test-connection.html`
3. Substitua `[SEU_ID]` pelo ID da extensão (veja em chrome://extensions)

### 2. Executar Testes na Ordem:

#### Teste 1: IndexedDB
- Clique em "Testar Banco de Dados"
- **Esperado:** ✅ IndexedDB conectado com sucesso!
- **Se falhar:** IndexedDB está bloqueado ou corrompido

#### Teste 2: Salvar Palavra
- Clique em "Salvar 'hello'"
- **Esperado:** ✅ Palavra salva com sucesso! { ok: true, id: 1, isNew: true }
- **Se falhar:** Problema no método saveWord()

#### Teste 3: Listar Palavras
- Clique em "Listar Palavras"
- **Esperado:** ✅ Total de palavras: 1 (ou mais)
- **Se falhar:** Palavra não foi salva ou não está sendo lida

#### Teste 4: Criar Deck
- Clique em "Criar 'Meu Deck'"
- **Esperado:** ✅ Deck criado com sucesso! { ok: true, id: 2 }
- **Se falhar:** Problema no método createDeck()

#### Teste 5: Listar Decks
- Clique em "Listar Decks"
- **Esperado:** ✅ Total de decks: 2 (Default + Meu Deck)
- **Se falhar:** Deck não foi salvo

#### Teste 6: Salvar Frase
- Clique em "Salvar Frase"
- **Esperado:** ✅ Frase salva com sucesso!
- **Se falhar:** Problema no método saveSentence()

#### Teste 7: Listar Frases
- Clique em "Listar Frases"
- **Esperado:** ✅ Total de frases: 1 (ou mais)
- **Se falhar:** Frase não foi salva

#### Teste 8: Background
- Clique em "Testar Background"
- **Esperado:** ✅ Background respondeu! { success: true, id: X }
- **Se falhar:** Background não está respondendo

---

## 🔍 VERIFICAR CONSOLE DO NAVEGADOR:

### 1. Abrir DevTools:
- Pressione `F12` ou `Ctrl+Shift+I`
- Vá para a aba "Console"

### 2. Procurar por Erros:
Procure por mensagens de erro como:
- ❌ `Uncaught (in promise)`
- ❌ `TypeError`
- ❌ `ReferenceError`
- ❌ `Failed to execute`
- ❌ `IndexedDB`

### 3. Verificar Network:
- Vá para aba "Network"
- Recarregue a página
- Veja se todos os arquivos carregam (200 OK)

---

## 🔍 VERIFICAR BACKGROUND SERVICE WORKER:

### 1. Abrir Background Console:
1. Vá para `chrome://extensions`
2. Encontre "LinguaFlow"
3. Clique em "service worker" (link azul)
4. Abre console do background

### 2. Testar Manualmente:
Cole no console do background:

```javascript
// Teste 1: Abrir DB
indexedDB.open('LinguaFlowFreeDB', 4).onsuccess = (e) => {
    console.log('✅ DB aberto:', e.target.result);
};

// Teste 2: Salvar palavra via background
chrome.runtime.sendMessage({
    type: 'SAVE_WORD',
    data: {
        word: 'test',
        lang: 'en',
        translation: 'teste',
        deck_id: 1
    }
}, (response) => {
    console.log('Response:', response);
});
```

---

## 🔍 VERIFICAR DASHBOARD:

### 1. Abrir Dashboard Console:
1. Abra o dashboard
2. Pressione `F12`
3. Vá para "Console"

### 2. Testar Manualmente:
Cole no console do dashboard:

```javascript
// Teste 1: Importar DB
import('../utils/db.js').then(({ db }) => {
    console.log('DB importado:', db);
    
    // Teste 2: Listar palavras
    db.getAllWords().then(words => {
        console.log('Palavras:', words);
    });
    
    // Teste 3: Listar decks
    db.getAllDecks().then(decks => {
        console.log('Decks:', decks);
    });
});
```

---

## 🔍 VERIFICAR POPUP DE PALAVRA:

### 1. Abrir Vídeo:
1. Abra um vídeo do YouTube
2. Ative legendas
3. Clique em uma palavra

### 2. Verificar Console:
- Pressione `F12`
- Vá para "Console"
- Procure por:
  - `[LinguaFlow] WordPopup inicializado`
  - `[WordPopup] Erro ao salvar:` (se houver erro)

### 3. Testar Salvar:
1. Clique em "Salvar nos Flashcards"
2. Veja no console se aparece erro
3. Veja se aparece "✅ Salvo nos Flashcards"

---

## 🛠️ SOLUÇÕES COMUNS:

### Problema: IndexedDB não abre
**Solução:**
1. Feche TODAS as abas do Chrome
2. Vá para `chrome://settings/content/all`
3. Procure por `chrome-extension://[SEU_ID]`
4. Limpe dados
5. Recarregue extensão

### Problema: Background não responde
**Solução:**
1. Vá para `chrome://extensions`
2. Clique em "Recarregar" na extensão
3. Verifique se "service worker" está ativo (azul)
4. Se estiver inativo (cinza), clique nele para ativar

### Problema: Dashboard vazio
**Solução:**
1. Abra console do dashboard
2. Execute: `location.reload()`
3. Veja se há erros no console
4. Verifique se `dashboard.js` carregou

### Problema: Popup não salva
**Solução:**
1. Verifique console do vídeo
2. Procure por erro em `word-popup.js`
3. Verifique se `db.js` foi importado
4. Teste manualmente no console

---

## 📋 CHECKLIST DE VERIFICAÇÃO:

- [ ] IndexedDB abre sem erros
- [ ] Background service worker está ativo
- [ ] Dashboard carrega sem erros no console
- [ ] Popup de palavra aparece ao clicar
- [ ] Botão "Salvar" não dá erro
- [ ] Palavra aparece no dashboard após salvar
- [ ] Deck criado aparece no dashboard
- [ ] Frase salva aparece no dashboard

---

## 📞 PRÓXIMOS PASSOS:

1. Execute TODOS os testes acima
2. Anote TODOS os erros que aparecerem
3. Tire screenshots dos erros
4. Envie os erros encontrados

**Com os erros específicos, posso corrigir exatamente o que está quebrado!**

---

**Criado em:** 25/04/2026  
**Versão:** LinguaFlow v2.3
