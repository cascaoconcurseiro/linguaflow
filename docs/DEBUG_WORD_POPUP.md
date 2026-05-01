# Debug: Word Popup Não Aparece

**Data**: 29/04/2026  
**Problema**: Popup não abre ao passar mouse sobre palavras na legenda

## Passos para Debugar

### 1. Verificar Console
1. Abrir YouTube com legendas
2. Abrir DevTools (F12)
3. Ir para a aba "Console"
4. Procurar por mensagens `[LinguaFlow]`

**Esperado:**
```
[LinguaFlow] ✅ WordPopup inicializado com sucesso
[LinguaFlow] WordPopup popup element: <div id="lfp">...</div>
[LinguaFlow] Botão de teste criado
```

### 2. Testar Botão de Teste
1. Procurar por um botão vermelho "🧪 Teste Popup" no canto superior direito
2. Clicar nele
3. Verificar se o popup aparece

**Se aparecer:**
- ✅ WordPopup está funcionando
- ❌ Problema está em `_makeClickable()` ou no event listener

**Se não aparecer:**
- ❌ WordPopup não está inicializado corretamente
- ❌ Problema está no `_build()` ou `showForWord()`

### 3. Verificar Event Listeners
1. Passar mouse sobre uma palavra na legenda
2. Verificar console para mensagens:
```
[LinguaFlow] Abrindo popup para: [palavra] rect: {...}
```

**Se aparecer:**
- ✅ Event listener está funcionando
- ❌ Problema está em `showForWord()`

**Se não aparecer:**
- ❌ Event listener não está sendo acionado
- ❌ Problema está em `_makeClickable()`

### 4. Verificar Popup Element
No console, executar:
```javascript
document.getElementById('lfp')
```

**Se retornar um elemento:**
- ✅ Popup foi criado
- Verificar `display` style: `document.getElementById('lfp').style.display`

**Se retornar null:**
- ❌ Popup não foi criado
- Verificar erro em `_build()`

### 5. Verificar Posicionamento
No console, executar:
```javascript
const popup = document.getElementById('lfp');
console.log('Display:', popup.style.display);
console.log('Position:', popup.style.left, popup.style.top);
console.log('Z-index:', popup.style.zIndex);
```

**Esperado:**
- `Display: block` (quando aberto)
- `Position: [número]px [número]px`
- `Z-index: 2147483645`

## Possíveis Problemas

### 1. WordPopup não inicializa
**Sintomas:**
- Console mostra erro em `import('./word-popup.js')`
- Botão de teste não aparece

**Solução:**
- Verificar se `word-popup.js` existe em `content/`
- Verificar se não há erros de sintaxe em `word-popup.js`
- Verificar se `manifest.json` inclui `word-popup.js` nos content scripts

### 2. Event listener não funciona
**Sintomas:**
- Botão de teste funciona
- Mas passar mouse sobre palavras não abre popup
- Console não mostra "Abrindo popup para:"

**Solução:**
- Verificar se `_makeClickable()` está sendo chamado
- Verificar se `this.wordPopup` não é null
- Adicionar mais logs em `_makeClickable()`

### 3. Popup não aparece visualmente
**Sintomas:**
- Console mostra "Abrindo popup para:"
- Mas popup não aparece na tela
- `document.getElementById('lfp').style.display` é `block`

**Solução:**
- Verificar z-index (pode estar atrás de outro elemento)
- Verificar se popup está fora da viewport
- Verificar se há CSS que esconde o popup

### 4. Popup aparece mas está vazio
**Sintomas:**
- Popup aparece
- Mas não mostra conteúdo (palavra, tradução, etc.)

**Solução:**
- Verificar se `_loadData()` está sendo chamado
- Verificar se `chrome.runtime.sendMessage()` funciona
- Verificar se background service worker tem handlers para 'translate' e 'dictionary'

## Logs Adicionados

### Em `init()`:
```javascript
console.log('[LinguaFlow] ✅ WordPopup inicializado com sucesso');
console.log('[LinguaFlow] WordPopup popup element:', this.wordPopup.popup);
console.log('[LinguaFlow] Botão de teste criado');
```

### Em `_makeClickable()`:
```javascript
console.log('[LinguaFlow] Abrindo popup para:', token, 'rect:', rect);
console.log('[LinguaFlow] Click no popup para:', token, 'rect:', rect);
console.warn('[LinguaFlow] WordPopup não inicializado');
```

## Próximos Passos

1. Executar os passos acima
2. Coletar os logs do console
3. Identificar em qual passo o problema ocorre
4. Reportar com os logs

---

**Nota**: O botão de teste "🧪 Teste Popup" só aparece em YouTube. Para outras plataformas, usar o console para testar manualmente.
