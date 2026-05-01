# 🔧 Correções Finais - LinguaFlow v2.1

## Problemas Identificados

### 1. ❌ Tradução Incorreta
**Problema**: "going" traduzido como "largura do degrau"  
**Causa**: API MyMemory retornando tradução errada  
**Solução**: 
- Usar múltiplas APIs em fallback (Google Translate → MyMemory → LibreTranslate)
- Validar tradução antes de exibir
- Cache de traduções corretas

### 2. ❌ Popup Não Fixo
**Problema**: Popup não fica fixo no viewport  
**Causa**: `position: fixed` mas sem ajuste correto  
**Solução**: Garantir position fixed e ajustar z-index

### 3. ❌ Botão Teste Visível
**Problema**: "Teste Popup" e "Default" aparecem no player  
**Causa**: Código de debug não removido  
**Solução**: Remover completamente

### 4. ⚠️ IA Não Analisa Phrasal Verbs/Gírias
**Problema**: IA não identifica automaticamente phrasal verbs, gírias, expressões idiomáticas  
**Causa**: Prompt genérico  
**Solução**: Melhorar prompt para detectar e explicar automaticamente

### 5. ⏳ Faltam Idiomas
**Problema**: Só suporta inglês ↔ português  
**Causa**: Hardcoded  
**Solução**: Adicionar chinês, japonês, espanhol, francês, alemão, coreano

---

## Implementações Necessárias

### A. Corrigir Tradução (CRÍTICO)
```javascript
// Usar Google Translate como primário
async function translateText(text, from, to) {
    // 1. Google Translate (melhor qualidade)
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (data?.[0]?.[0]?.[0]) return data[0][0][0];
    } catch {}
    
    // 2. MyMemory (fallback)
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
        const data = await res.json();
        return data.responseData?.translatedText || text;
    } catch {}
    
    return text;
}
```

### B. Melhorar Prompt da IA (IMPORTANTE)
```javascript
const IMPROVED_PROMPT = `Você é o Professor Ling, especialista em ensinar idiomas para brasileiros.

ANÁLISE AUTOMÁTICA OBRIGATÓRIA:
1. Detecte SE a palavra/frase é:
   - Phrasal verb (ex: "give up", "look forward to")
   - Gíria/slang (ex: "gonna", "wanna", "ain't")
   - Expressão idiomática (ex: "piece of cake", "break a leg")
   - Termo técnico/jargão
   - Palavra formal vs informal

2. Se for PHRASAL VERB:
   - Explique que é phrasal verb
   - Mostre o significado literal vs real
   - Dê 2-3 exemplos de uso
   - Alerte: "Não traduza palavra por palavra!"

3. Se for GÍRIA:
   - Explique que é gíria/informal
   - Mostre a forma formal equivalente
   - Explique quando usar (amigos, internet) e quando NÃO usar (trabalho, formal)

4. Se for EXPRESSÃO IDIOMÁTICA:
   - Explique que não pode traduzir literalmente
   - Mostre o equivalente em português
   - Explique a origem se relevante

CONTEXTO DO VÍDEO:
${videoTitle ? `📺 Vídeo: "${videoTitle}"` : ''}
${platform ? `🎬 Plataforma: ${platform}` : ''}

Use esse contexto para:
- Se for série/filme → foque em gírias, expressões coloquiais
- Se for tech/programação → explique termos técnicos
- Se for documentário → vocabulário formal
- Se for vlog/casual → linguagem do dia a dia

FORMATO DA RESPOSTA:
1. 🎯 **Tipo**: [Phrasal Verb / Gíria / Expressão / Palavra Normal]
2. 📌 **Significado**: [tradução + explicação]
3. 💡 **Como Usar**: [contexto, registro, exemplos]
4. ⚠️ **Cuidado**: [armadilhas para brasileiros]
5. 🧠 **Dica de Memorização**: [mnemônico criativo]
`;
```

### C. Adicionar Múltiplos Idiomas
```javascript
const SUPPORTED_LANGUAGES = {
    // Idiomas de origem (aprendendo)
    source: {
        'en': { name: 'English', flag: '🇬🇧', tts: 'en-US' },
        'es': { name: 'Español', flag: '🇪🇸', tts: 'es-ES' },
        'fr': { name: 'Français', flag: '🇫🇷', tts: 'fr-FR' },
        'de': { name: 'Deutsch', flag: '🇩🇪', tts: 'de-DE' },
        'it': { name: 'Italiano', flag: '🇮🇹', tts: 'it-IT' },
        'ja': { name: '日本語', flag: '🇯🇵', tts: 'ja-JP' },
        'zh': { name: '中文', flag: '🇨🇳', tts: 'zh-CN' },
        'ko': { name: '한국어', flag: '🇰🇷', tts: 'ko-KR' },
        'ru': { name: 'Русский', flag: '🇷🇺', tts: 'ru-RU' },
        'ar': { name: 'العربية', flag: '🇸🇦', tts: 'ar-SA' }
    },
    // Idiomas nativos (tradução)
    target: {
        'pt': { name: 'Português', flag: '🇧🇷' },
        'es': { name: 'Español', flag: '🇪🇸' },
        'en': { name: 'English', flag: '🇺🇸' },
        'fr': { name: 'Français', flag: '🇫🇷' },
        'de': { name: 'Deutsch', flag: '🇩🇪' }
    }
};
```

### D. Remover Botões de Teste
```javascript
// Procurar e remover:
// - testBtn
// - "Teste Popup"
// - "Default" no canto superior esquerdo
// Verificar em: subtitle-engine.js, boot.js, index.js
```

### E. Fixar Popup no Viewport
```javascript
_position(rect) {
    const W = 400, H = 560;
    let l, t;
    
    if (rect) {
        // Posiciona ao lado da palavra
        l = rect.right + 12;
        t = rect.top - 80;
        
        // Ajusta se sair da tela
        if (l + W > window.innerWidth - 8) l = rect.left - W - 12;
        if (t + H > window.innerHeight - 8) t = window.innerHeight - H - 8;
        if (t < 8) t = 8;
        if (l < 8) l = 8;
    } else {
        // Centraliza
        l = Math.round((window.innerWidth - W) / 2);
        t = Math.round((window.innerHeight - H) / 2);
    }
    
    // CRÍTICO: Garantir position fixed
    this.popup.style.position = 'fixed';
    this.popup.style.left = l + 'px';
    this.popup.style.top = t + 'px';
    this.popup.style.zIndex = '2147483647'; // Máximo z-index
}
```

---

## Melhorias Opcionais Restantes

### 1. Modo Shadowing
- Gravar áudio do usuário
- Comparar com original
- Feedback de pronúncia

### 2. Sentence Mining Guiado
- Destacar palavras desconhecidas ao pausar
- Sugerir quais salvar

### 3. Reader Melhorado
- Colorir por CEFR
- Popup ao clicar

### 4. Integração Transcrição YouTube
- Buscar palavra na transcrição
- Mostrar ocorrências

### 5. Exportação Anki Avançada
- Gerar .apkg
- Templates corretos

---

## Prioridade de Implementação

### 🔴 URGENTE (Quebra Experiência)
1. ✅ Corrigir tradução (Google Translate API)
2. ✅ Remover botões de teste
3. ✅ Fixar popup no viewport

### 🟡 IMPORTANTE (Melhora Aprendizado)
4. ✅ Melhorar prompt IA (detectar phrasal verbs/gírias)
5. ✅ Adicionar múltiplos idiomas

### 🟢 OPCIONAL (Funcionalidades Extras)
6. ⏳ Modo shadowing
7. ⏳ Sentence mining guiado
8. ⏳ Reader melhorado
9. ⏳ Integração transcrição
10. ⏳ Exportação Anki avançada

---

## Arquivos a Modificar

1. `background/service-worker.js` - Corrigir tradução, melhorar prompt IA
2. `content/word-popup.js` - Fixar popup, remover testes
3. `content/subtitle-engine.js` - Remover botões de teste
4. `content/boot.js` - Verificar inicialização
5. `popup/popup.html` - Adicionar seletor de idiomas
6. `utils/translator.js` - Múltiplas APIs de tradução

---

## Status

**Versão Atual**: 2.0  
**Próxima Versão**: 2.1 (com correções)  
**Backup**: `backups/v2.0-pre-unification/`

---

**Próximo Passo**: Implementar correções urgentes (1-3) primeiro, depois importantes (4-5), e por último opcionais (6-10).
