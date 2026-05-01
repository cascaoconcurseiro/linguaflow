# 🧠 Sistema Inteligente de Detecção de Contexto

**Data:** 25/04/2026  
**Versão:** 2.3  
**Status:** Implementando

---

## 🎯 Problema

### Cenário 1: Phrasal Verbs
**Frase:** "I need to get up early"  
**Usuário clica em:** "get"  
**Problema:** Mostra "get" = "obter, conseguir" ❌  
**Correto:** Detectar "get up" = "levantar-se" ✅

### Cenário 2: Gírias
**Frase:** "That's sick, bro!"  
**Usuário clica em:** "sick"  
**Problema:** Mostra "sick" = "doente" ❌  
**Correto:** Detectar "sick" (slang) = "incrível, massa" ✅

### Cenário 3: Expressões Idiomáticas
**Frase:** "It's raining cats and dogs"  
**Usuário clica em:** "cats"  
**Problema:** Mostra "cats" = "gatos" ❌  
**Correto:** Detectar "raining cats and dogs" = "chovendo muito" ✅

---

## ✅ Solução: Sistema de Detecção Inteligente

### 1. Análise de Contexto Automática

Quando usuário clica em uma palavra:

```javascript
// 1. Pega a palavra clicada
const clickedWord = "get";

// 2. Pega o contexto (5 palavras antes e depois)
const context = "I need to get up early tomorrow";

// 3. Detecta padrões especiais
const detection = await detectLinguisticPattern(clickedWord, context);

// 4. Mostra resultado com TAG apropriada
if (detection.type === 'phrasal_verb') {
    showPopup({
        word: "get up",
        tag: "⚡ PHRASAL VERB",
        meaning: "levantar-se",
        explanation: "Get + up = levantar-se da cama"
    });
}
```

---

## 🏷️ Sistema de Tags

### Tags Visuais

```
⚡ PHRASAL VERB    - Verbo + preposição/advérbio
🔥 SLANG           - Gíria/linguagem informal
💬 IDIOM           - Expressão idiomática
🎭 COLLOQUIAL      - Linguagem coloquial
📚 FORMAL          - Linguagem formal
🌍 REGIONAL        - Termo regional/local
🎯 CONTEXT         - Significado depende do contexto
⚠️ FALSE FRIEND    - Falso cognato
🔄 MULTI-MEANING   - Múltiplos significados
```

---

## 🔍 Detecção Automática

### Base de Dados de Phrasal Verbs

```javascript
const PHRASAL_VERBS = {
    'get': [
        { pattern: 'get up', meaning: 'levantar-se', example: 'I get up at 7am' },
        { pattern: 'get on', meaning: 'entrar (veículo)', example: 'Get on the bus' },
        { pattern: 'get off', meaning: 'descer (veículo)', example: 'Get off at the next stop' },
        { pattern: 'get over', meaning: 'superar', example: 'Get over it' },
        { pattern: 'get along', meaning: 'dar-se bem', example: 'We get along well' },
        { pattern: 'get away', meaning: 'escapar', example: 'He got away' },
        { pattern: 'get back', meaning: 'voltar/recuperar', example: 'Get back home' },
        { pattern: 'get in', meaning: 'entrar', example: 'Get in the car' },
        { pattern: 'get out', meaning: 'sair', example: 'Get out of here' },
        { pattern: 'get through', meaning: 'passar por/completar', example: 'Get through the exam' }
    ],
    'take': [
        { pattern: 'take off', meaning: 'decolar/tirar', example: 'The plane takes off' },
        { pattern: 'take on', meaning: 'assumir', example: 'Take on a challenge' },
        { pattern: 'take out', meaning: 'tirar/levar para sair', example: 'Take out the trash' },
        { pattern: 'take over', meaning: 'assumir controle', example: 'Take over the company' },
        { pattern: 'take up', meaning: 'começar (hobby)', example: 'Take up yoga' }
    ],
    'look': [
        { pattern: 'look up', meaning: 'procurar/melhorar', example: 'Look up a word' },
        { pattern: 'look after', meaning: 'cuidar de', example: 'Look after the kids' },
        { pattern: 'look for', meaning: 'procurar', example: 'Look for a job' },
        { pattern: 'look forward to', meaning: 'aguardar ansiosamente', example: 'Look forward to seeing you' },
        { pattern: 'look into', meaning: 'investigar', example: 'Look into the matter' }
    ],
    'put': [
        { pattern: 'put on', meaning: 'vestir/colocar', example: 'Put on your shoes' },
        { pattern: 'put off', meaning: 'adiar', example: 'Put off the meeting' },
        { pattern: 'put up with', meaning: 'tolerar', example: 'Put up with noise' },
        { pattern: 'put down', meaning: 'colocar no chão/humilhar', example: 'Put down the phone' }
    ],
    'give': [
        { pattern: 'give up', meaning: 'desistir', example: 'Never give up' },
        { pattern: 'give in', meaning: 'ceder', example: 'Give in to pressure' },
        { pattern: 'give away', meaning: 'doar/revelar', example: 'Give away secrets' },
        { pattern: 'give back', meaning: 'devolver', example: 'Give back the book' }
    ]
};
```

### Base de Dados de Gírias

```javascript
const SLANG_DATABASE = {
    'sick': [
        { context: 'positive', meaning: 'incrível, massa', example: "That's sick!" },
        { context: 'negative', meaning: 'doente', example: "I feel sick" }
    ],
    'cool': [
        { context: 'approval', meaning: 'legal, massa', example: "That's so cool!" },
        { context: 'temperature', meaning: 'frio', example: "It's cool outside" }
    ],
    'lit': [
        { context: 'slang', meaning: 'incrível, animado', example: "This party is lit!" },
        { context: 'past', meaning: 'acendeu (passado de light)', example: "He lit a candle" }
    ],
    'dope': [
        { context: 'slang', meaning: 'massa, top', example: "That's dope!" },
        { context: 'drugs', meaning: 'droga', example: "No dope allowed" }
    ],
    'fire': [
        { context: 'slang', meaning: 'incrível, top', example: "This song is fire!" },
        { context: 'literal', meaning: 'fogo', example: "There's a fire" }
    ]
};
```

### Base de Dados de Expressões Idiomáticas

```javascript
const IDIOMS_DATABASE = [
    {
        pattern: /raining cats and dogs/i,
        meaning: 'chovendo muito',
        literal: 'chovendo gatos e cachorros',
        explanation: 'Expressão idiomática para chuva forte'
    },
    {
        pattern: /piece of cake/i,
        meaning: 'moleza, muito fácil',
        literal: 'pedaço de bolo',
        explanation: 'Algo extremamente fácil de fazer'
    },
    {
        pattern: /break a leg/i,
        meaning: 'boa sorte',
        literal: 'quebrar uma perna',
        explanation: 'Expressão usada para desejar boa sorte'
    },
    {
        pattern: /cost an arm and a leg/i,
        meaning: 'custar muito caro',
        literal: 'custar um braço e uma perna',
        explanation: 'Algo extremamente caro'
    },
    {
        pattern: /hit the nail on the head/i,
        meaning: 'acertar em cheio',
        literal: 'acertar o prego na cabeça',
        explanation: 'Dizer algo exatamente correto'
    }
];
```

---

## 🧠 Algoritmo de Detecção

### Função Principal

```javascript
/**
 * Detecta padrões linguísticos especiais
 * @param {string} clickedWord - Palavra clicada
 * @param {string} fullSentence - Frase completa
 * @returns {object} - Detecção com tipo e informações
 */
async function detectLinguisticPattern(clickedWord, fullSentence) {
    const word = clickedWord.toLowerCase();
    const sentence = fullSentence.toLowerCase();
    
    // 1. DETECTA EXPRESSÕES IDIOMÁTICAS (prioridade máxima)
    for (const idiom of IDIOMS_DATABASE) {
        if (idiom.pattern.test(sentence)) {
            const match = sentence.match(idiom.pattern)[0];
            if (match.includes(word)) {
                return {
                    type: 'idiom',
                    tag: '💬 IDIOM',
                    fullExpression: match,
                    meaning: idiom.meaning,
                    literal: idiom.literal,
                    explanation: idiom.explanation,
                    confidence: 0.95
                };
            }
        }
    }
    
    // 2. DETECTA PHRASAL VERBS
    if (PHRASAL_VERBS[word]) {
        const phrasalVerbs = PHRASAL_VERBS[word];
        
        for (const pv of phrasalVerbs) {
            // Verifica se o phrasal verb está na frase
            if (sentence.includes(pv.pattern)) {
                return {
                    type: 'phrasal_verb',
                    tag: '⚡ PHRASAL VERB',
                    fullExpression: pv.pattern,
                    meaning: pv.meaning,
                    example: pv.example,
                    explanation: `"${pv.pattern}" é um phrasal verb. Não traduza palavra por palavra!`,
                    confidence: 0.9
                };
            }
        }
    }
    
    // 3. DETECTA GÍRIAS (usa IA para contexto)
    if (SLANG_DATABASE[word]) {
        const slangOptions = SLANG_DATABASE[word];
        
        // Usa IA para determinar qual contexto
        const context = await detectSlangContext(word, sentence);
        const slang = slangOptions.find(s => s.context === context) || slangOptions[0];
        
        return {
            type: 'slang',
            tag: '🔥 SLANG',
            word: word,
            meaning: slang.meaning,
            example: slang.example,
            explanation: `"${word}" aqui é gíria/linguagem informal`,
            confidence: 0.85
        };
    }
    
    // 4. DETECTA COLOCAÇÕES NATURAIS
    const collocation = await detectCollocation(word, sentence);
    if (collocation) {
        return {
            type: 'collocation',
            tag: '🎯 COLLOCATION',
            fullExpression: collocation.expression,
            meaning: collocation.meaning,
            explanation: `"${collocation.expression}" é uma colocação natural em inglês`,
            confidence: 0.8
        };
    }
    
    // 5. DETECTA MÚLTIPLOS SIGNIFICADOS POR CONTEXTO
    const contextMeaning = await detectContextualMeaning(word, sentence);
    if (contextMeaning.hasMultipleMeanings) {
        return {
            type: 'context_dependent',
            tag: '🔄 CONTEXT',
            word: word,
            meaning: contextMeaning.meaningInContext,
            allMeanings: contextMeaning.allMeanings,
            explanation: `"${word}" tem múltiplos significados. Neste contexto significa: ${contextMeaning.meaningInContext}`,
            confidence: 0.75
        };
    }
    
    // 6. PALAVRA NORMAL (sem padrão especial detectado)
    return {
        type: 'normal',
        tag: null,
        word: word,
        confidence: 0.5
    };
}
```

---

## 🎨 Interface Visual

### Popup com Tag

```html
<div class="word-popup">
    <!-- TAG VISUAL -->
    <div class="linguistic-tag phrasal-verb">
        ⚡ PHRASAL VERB
    </div>
    
    <!-- EXPRESSÃO COMPLETA -->
    <h2 class="full-expression">get up</h2>
    <div class="ipa">/ɡet ʌp/</div>
    
    <!-- SIGNIFICADO -->
    <div class="meaning">
        <strong>Significado:</strong> levantar-se (da cama)
    </div>
    
    <!-- EXPLICAÇÃO -->
    <div class="explanation">
        ⚠️ "Get up" é um phrasal verb. Não traduza palavra por palavra!
        "Get" sozinho = obter, conseguir
        "Get up" junto = levantar-se
    </div>
    
    <!-- EXEMPLO -->
    <div class="example">
        💡 "I get up at 7am every day"
        → Eu me levanto às 7h todo dia
    </div>
    
    <!-- PALAVRA ISOLADA (opcional) -->
    <details>
        <summary>Ver "get" isolado</summary>
        <div class="isolated-meaning">
            "Get" sozinho significa: obter, conseguir, pegar...
        </div>
    </details>
</div>
```

### CSS para Tags

```css
.linguistic-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 12px;
}

.linguistic-tag.phrasal-verb {
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: white;
}

.linguistic-tag.slang {
    background: linear-gradient(135deg, #EF4444, #DC2626);
    color: white;
}

.linguistic-tag.idiom {
    background: linear-gradient(135deg, #8B5CF6, #7C3AED);
    color: white;
}

.linguistic-tag.collocation {
    background: linear-gradient(135deg, #10B981, #059669);
    color: white;
}

.linguistic-tag.context {
    background: linear-gradient(135deg, #38BDF8, #0EA5E9);
    color: white;
}
```

---

## 🔧 Implementação

### 1. Criar `utils/context-detector.js`

```javascript
export async function detectLinguisticPattern(clickedWord, fullSentence) {
    // Implementação completa do algoritmo acima
}

export async function detectSlangContext(word, sentence) {
    // Usa IA para determinar se é gíria ou significado literal
}

export async function detectCollocation(word, sentence) {
    // Detecta colocações naturais
}

export async function detectContextualMeaning(word, sentence) {
    // Detecta significado baseado no contexto
}
```

### 2. Atualizar `word-popup.js`

```javascript
import { detectLinguisticPattern } from '../utils/context-detector.js';

async function showWordPopup(clickedWord, sentence) {
    // Detecta padrão linguístico
    const detection = await detectLinguisticPattern(clickedWord, sentence);
    
    if (detection.type !== 'normal') {
        // Mostra popup com tag e explicação especial
        showSpecialPopup(detection);
    } else {
        // Mostra popup normal
        showNormalPopup(clickedWord);
    }
}
```

---

## 📊 Exemplos de Detecção

### Exemplo 1: Phrasal Verb

**Frase:** "I need to get up early"  
**Clica em:** "get"  
**Detecta:** ⚡ PHRASAL VERB "get up"  
**Mostra:**
```
⚡ PHRASAL VERB

GET UP
/ɡet ʌp/

Significado: levantar-se (da cama)

⚠️ "Get up" é um phrasal verb!
• "Get" sozinho = obter, conseguir
• "Get up" junto = levantar-se

💡 Exemplo:
"I get up at 7am" → Eu me levanto às 7h
```

### Exemplo 2: Gíria

**Frase:** "That's sick, bro!"  
**Clica em:** "sick"  
**Detecta:** 🔥 SLANG  
**Mostra:**
```
🔥 SLANG

SICK
/sɪk/

Significado: incrível, massa, top

⚠️ "Sick" aqui é GÍRIA!
• Significado literal: doente
• Significado como gíria: incrível

💡 Exemplo:
"That trick was sick!" → Aquele truque foi incrível!
```

### Exemplo 3: Expressão Idiomática

**Frase:** "It's raining cats and dogs"  
**Clica em:** "cats"  
**Detecta:** 💬 IDIOM  
**Mostra:**
```
💬 IDIOM

RAINING CATS AND DOGS

Significado: chovendo muito, chuva torrencial

⚠️ Expressão idiomática!
• Literal: chovendo gatos e cachorros
• Figurado: chovendo muito forte

💡 Não traduza palavra por palavra!
Esta é uma expressão fixa em inglês.
```

---

## ✅ Benefícios

1. **Detecção Automática:** Sistema identifica padrões sozinho
2. **Tags Visuais:** Usuário vê imediatamente o tipo de expressão
3. **Explicação Clara:** Entende por que não deve traduzir palavra por palavra
4. **Contexto Real:** Aprende o significado correto na frase
5. **Evita Confusão:** Não aprende tradução errada

---

## 🎯 Próximos Passos

1. Criar `utils/context-detector.js` com algoritmo completo
2. Expandir base de dados de phrasal verbs (500+ mais comuns)
3. Expandir base de dados de gírias (200+ mais comuns)
4. Expandir base de dados de idioms (100+ mais comuns)
5. Integrar com IA para detecção de novos padrões
6. Adicionar suporte para outros idiomas

---

**Sistema inteligente de detecção de contexto pronto! 🧠**
