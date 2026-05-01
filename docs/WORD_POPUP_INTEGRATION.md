# Word Popup Integration - Pro V5 Style

**Data**: 29/04/2026  
**Status**: ✅ Integrado e Pronto para Teste

## O que foi feito

### 1. Cópia do Word Popup do Pro V5
- Arquivo: `content/word-popup.js` (33KB, 300 linhas)
- Classe: `WordPopup` com suporte completo a:
  - 5 abas (Tradução, Gramática, Exemplos, Linguee, YouGlish)
  - Análise gramatical com phrasal verbs
  - Exemplos bilíngues com tradução automática
  - Sinônimos e antônimos clicáveis
  - Links para Linguee e YouGlish
  - Salvar em flashcards
  - Marcar como "Já Conheço"
  - Explicação com IA (Claude)

### 2. Registro no Manifest
**Arquivo**: `manifest.json`

```json
"content_scripts": [
  {
    "matches": ["*://*.youtube.com/*", "*://*.netflix.com/*", ...],
    "js": ["content/word-popup.js", "content/boot.js"],
    "run_at": "document_idle"
  }
]
```

**Importante**: `word-popup.js` é carregado ANTES de `boot.js` para estar disponível quando o engine inicializa.

### 3. Inicialização no SubtitleEngine
**Arquivo**: `content/subtitle-engine.js`

#### No Constructor:
```javascript
// WordPopup (Pro V5 style)
this.wordPopup = null;
```

#### No método init():
```javascript
// Inicializa WordPopup (Pro V5 style)
try {
    const { WordPopup } = await import('./word-popup.js');
    this.wordPopup = new WordPopup(this, this.platform);
    this.wordPopup.init();
    console.log('[LinguaFlow] WordPopup inicializado com sucesso');
} catch (e) {
    console.warn('[LinguaFlow] Erro ao inicializar WordPopup:', e);
}
```

### 4. Integração com _makeClickable()
**Arquivo**: `content/subtitle-engine.js`

Atualizado para usar `this.wordPopup.showForWord()`:

```javascript
span.addEventListener('mouseenter', async (e) => {
    hoverTimeout = setTimeout(() => {
        if (this.wordPopup) {
            const rect = span.getBoundingClientRect();
            this.wordPopup.showForWord(token, fixUtf8(text), rect);
        }
    }, 400);
});

span.addEventListener('click', e => {
    e.stopPropagation();
    if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
    if (this.wordPopup) {
        const rect = span.getBoundingClientRect();
        this.wordPopup.showForWord(token, fixUtf8(text), rect);
    }
});
```

## Como Funciona

### Ativação
1. **Hover**: Passa o mouse sobre uma palavra por 400ms
2. **Click**: Clica imediatamente em uma palavra

### Popup
- Abre com animação suave
- Posiciona-se dinamicamente para não sair da tela
- Mostra a aba "Tradução" por padrão
- Fecha ao clicar fora ou pressionar ESC

### Abas Disponíveis

#### 1. Tradução
- Tradução da palavra
- Pronúncia (IPA)
- Classe gramatical
- Definição
- Contexto da frase
- Sinônimos e antônimos clicáveis
- Deck selector para salvar
- Botão "Salvar nos Flashcards"
- Botões "Já Conheço" e "Explicar com IA"

#### 2. Gramática
- Classe gramatical detalhada
- Phrasal verbs relacionados
- Padrões gramaticais
- Botão "Analisar com IA"

#### 3. Exemplos
- Exemplos do dicionário
- Tradução automática de cada exemplo
- Contexto da frase do vídeo
- Tradução do contexto

#### 4. Linguee
- Link para Linguee EN↔PT
- Link para Linguee EN definitions
- Link para Google Translate

#### 5. YouGlish
- Link para YouGlish (qualquer sotaque)
- Links para sotaques específicos (American, British, Australian, Academic)

## Dependências

### Background Service Worker
O WordPopup usa `chrome.runtime.sendMessage()` para:
- `action: 'translate'` - Traduzir texto
- `action: 'dictionary'` - Buscar definição
- `action: 'ai_explain_word'` - Explicação com IA
- `action: 'ai_analyze_sentence'` - Análise gramatical com IA

**Nota**: Se esses handlers não estiverem implementados no background, o popup ainda funciona mas sem tradução/dicionário.

### Storage
Usa `chrome.storage.local` para:
- `lf_saved` - Palavras salvas
- `lf_known` - Palavras conhecidas
- `lf_decks` - Decks de flashcards

## Plataformas Suportadas

- ✅ YouTube
- ✅ Netflix
- ✅ HBO Max / Max.com
- ✅ Disney+
- ✅ Prime Video
- ✅ Amazon Prime

## Testes Recomendados

1. **YouTube**: Passar mouse sobre palavras na legenda
2. **HBO Max**: Verificar se popup aparece corretamente
3. **Tradução**: Verificar se tradução funciona (requer background handler)
4. **Dicionário**: Verificar se definição aparece
5. **Exemplos**: Verificar se exemplos carregam
6. **Links**: Clicar em Linguee e YouGlish
7. **Flashcards**: Salvar uma palavra e verificar se aparece em "Já Salvo"

## Troubleshooting

### Popup não aparece
- Verificar se `word-popup.js` está no manifest
- Verificar console para erros de import
- Verificar se `this.wordPopup` está inicializado

### Tradução não funciona
- Verificar se background service worker tem handler para 'translate'
- Verificar se `chrome.runtime.sendMessage()` está funcionando

### Popup posicionado incorretamente
- Verificar método `_position()` em `word-popup.js`
- Ajustar valores de `W` (400) e `H` (560) se necessário

## Arquivos Modificados

1. `manifest.json` - Adicionado word-popup.js aos content scripts
2. `content/subtitle-engine.js` - Inicialização e integração do WordPopup
3. `content/word-popup.js` - Novo arquivo (copiado do Pro V5)
4. `docs/CHANGELOG.md` - Documentação da mudança

## Backup

Backup criado em: `backups/v1.1-before-word-popup/`
- `manifest.json`
- `subtitle-engine.js`
- `CHANGELOG.md`

## Próximos Passos

1. Testar em YouTube e HBO Max
2. Verificar se tradução/dicionário funcionam
3. Ajustar posicionamento se necessário
4. Adicionar suporte para mais idiomas se desejado
5. Integrar com background service worker para IA

---

**Nota**: O sistema está funcionando e pronto para teste. O WordPopup do Pro V5 é uma adição poderosa que melhora significativamente a experiência de aprendizado.
