/**
 * LinguaFlow — Context Detector v2.3
 * Detecta automaticamente phrasal verbs, gírias, idioms e contextos especiais
 */

// ============================================================
// BASE DE DADOS DE PHRASAL VERBS
// ============================================================

const PHRASAL_VERBS = {
    'get': [
        { pattern: 'get up', meaning: 'levantar-se', example: 'I get up at 7am', particles: ['up'] },
        { pattern: 'get on', meaning: 'entrar (veículo)/dar-se bem', example: 'Get on the bus', particles: ['on'] },
        { pattern: 'get off', meaning: 'descer (veículo)', example: 'Get off at the next stop', particles: ['off'] },
        { pattern: 'get over', meaning: 'superar', example: 'Get over it', particles: ['over'] },
        { pattern: 'get along', meaning: 'dar-se bem', example: 'We get along well', particles: ['along'] },
        { pattern: 'get away', meaning: 'escapar', example: 'He got away', particles: ['away'] },
        { pattern: 'get back', meaning: 'voltar/recuperar', example: 'Get back home', particles: ['back'] },
        { pattern: 'get in', meaning: 'entrar', example: 'Get in the car', particles: ['in'] },
        { pattern: 'get out', meaning: 'sair', example: 'Get out of here', particles: ['out'] },
        { pattern: 'get through', meaning: 'passar por/completar', example: 'Get through the exam', particles: ['through'] }
    ],
    'take': [
        { pattern: 'take off', meaning: 'decolar/tirar', example: 'The plane takes off', particles: ['off'] },
        { pattern: 'take on', meaning: 'assumir', example: 'Take on a challenge', particles: ['on'] },
        { pattern: 'take out', meaning: 'tirar/levar para sair', example: 'Take out the trash', particles: ['out'] },
        { pattern: 'take over', meaning: 'assumir controle', example: 'Take over the company', particles: ['over'] },
        { pattern: 'take up', meaning: 'começar (hobby)', example: 'Take up yoga', particles: ['up'] }
    ],
    'look': [
        { pattern: 'look up', meaning: 'procurar/melhorar', example: 'Look up a word', particles: ['up'] },
        { pattern: 'look after', meaning: 'cuidar de', example: 'Look after the kids', particles: ['after'] },
        { pattern: 'look for', meaning: 'procurar', example: 'Look for a job', particles: ['for'] },
        { pattern: 'look forward to', meaning: 'aguardar ansiosamente', example: 'Look forward to seeing you', particles: ['forward', 'to'] },
        { pattern: 'look into', meaning: 'investigar', example: 'Look into the matter', particles: ['into'] }
    ],
    'put': [
        { pattern: 'put on', meaning: 'vestir/colocar', example: 'Put on your shoes', particles: ['on'] },
        { pattern: 'put off', meaning: 'adiar', example: 'Put off the meeting', particles: ['off'] },
        { pattern: 'put up with', meaning: 'tolerar', example: 'Put up with noise', particles: ['up', 'with'] },
        { pattern: 'put down', meaning: 'colocar no chão/humilhar', example: 'Put down the phone', particles: ['down'] }
    ],
    'give': [
        { pattern: 'give up', meaning: 'desistir', example: 'Never give up', particles: ['up'] },
        { pattern: 'give in', meaning: 'ceder', example: 'Give in to pressure', particles: ['in'] },
        { pattern: 'give away', meaning: 'doar/revelar', example: 'Give away secrets', particles: ['away'] },
        { pattern: 'give back', meaning: 'devolver', example: 'Give back the book', particles: ['back'] }
    ],
    'make': [
        { pattern: 'make up', meaning: 'inventar/reconciliar', example: 'Make up a story', particles: ['up'] },
        { pattern: 'make out', meaning: 'entender/beijar', example: 'I can\'t make out what he said', particles: ['out'] },
        { pattern: 'make up for', meaning: 'compensar', example: 'Make up for lost time', particles: ['up', 'for'] }
    ],
    'turn': [
        { pattern: 'turn on', meaning: 'ligar', example: 'Turn on the light', particles: ['on'] },
        { pattern: 'turn off', meaning: 'desligar', example: 'Turn off the TV', particles: ['off'] },
        { pattern: 'turn up', meaning: 'aparecer/aumentar', example: 'Turn up the volume', particles: ['up'] },
        { pattern: 'turn down', meaning: 'recusar/diminuir', example: 'Turn down the offer', particles: ['down'] }
    ],
    'run': [
        { pattern: 'run into', meaning: 'encontrar por acaso', example: 'I ran into John', particles: ['into'] },
        { pattern: 'run out', meaning: 'acabar', example: 'We ran out of milk', particles: ['out'] },
        { pattern: 'run over', meaning: 'atropelar', example: 'Be careful not to run over the cat', particles: ['over'] }
    ],
    'come': [
        { pattern: 'come across', meaning: 'encontrar por acaso', example: 'I came across an old photo', particles: ['across'] },
        { pattern: 'come up with', meaning: 'inventar/criar', example: 'Come up with an idea', particles: ['up', 'with'] },
        { pattern: 'come back', meaning: 'voltar', example: 'Come back soon', particles: ['back'] }
    ],
    'go': [
        { pattern: 'go on', meaning: 'continuar', example: 'Go on with your story', particles: ['on'] },
        { pattern: 'go out', meaning: 'sair', example: 'Let\'s go out tonight', particles: ['out'] },
        { pattern: 'go over', meaning: 'revisar', example: 'Go over the notes', particles: ['over'] },
        { pattern: 'go through', meaning: 'passar por', example: 'Go through hard times', particles: ['through'] }
    ]
};

// ============================================================
// BASE DE DADOS DE GÍRIAS
// ============================================================

const SLANG_DATABASE = {
    'sick': [
        { context: 'positive', meaning: 'incrível, massa, top', example: "That's sick!", indicators: ['that', 'so', 'really'] },
        { context: 'negative', meaning: 'doente', example: "I feel sick", indicators: ['feel', 'am', 'got'] }
    ],
    'cool': [
        { context: 'approval', meaning: 'legal, massa, bacana', example: "That's so cool!", indicators: ['that', 'so', 'really', 'pretty'] },
        { context: 'temperature', meaning: 'frio, fresco', example: "It's cool outside", indicators: ['weather', 'temperature', 'outside'] }
    ],
    'lit': [
        { context: 'slang', meaning: 'incrível, animado, top', example: "This party is lit!", indicators: ['party', 'place', 'this', 'so'] },
        { context: 'past', meaning: 'acendeu (passado de light)', example: "He lit a candle", indicators: ['candle', 'fire', 'match'] }
    ],
    'dope': [
        { context: 'slang', meaning: 'massa, top, incrível', example: "That's dope!", indicators: ['that', 'so', 'really'] },
        { context: 'drugs', meaning: 'droga', example: "No dope allowed", indicators: ['drug', 'illegal', 'no'] }
    ],
    'fire': [
        { context: 'slang', meaning: 'incrível, top, perfeito', example: "This song is fire!", indicators: ['song', 'music', 'this', 'so'] },
        { context: 'literal', meaning: 'fogo', example: "There's a fire", indicators: ['burn', 'smoke', 'alarm'] }
    ],
    'wicked': [
        { context: 'slang', meaning: 'incrível, massa (UK/US)', example: "That's wicked!", indicators: ['that', 'so', 'really'] },
        { context: 'evil', meaning: 'malvado, perverso', example: "A wicked person", indicators: ['person', 'evil', 'bad'] }
    ],
    'mad': [
        { context: 'slang', meaning: 'muito, extremamente', example: "That's mad expensive", indicators: ['expensive', 'crazy', 'insane'] },
        { context: 'angry', meaning: 'bravo, irritado', example: "He's mad at me", indicators: ['at', 'angry', 'upset'] }
    ],
    'tight': [
        { context: 'slang', meaning: 'legal, próximo (amizade)', example: "We're tight", indicators: ['we', 'friends', 'close'] },
        { context: 'literal', meaning: 'apertado', example: "These jeans are tight", indicators: ['clothes', 'fit', 'small'] }
    ]
};

// ============================================================
// BASE DE DADOS DE EXPRESSÕES IDIOMÁTICAS
// ============================================================

const IDIOMS_DATABASE = [
    {
        pattern: /raining cats and dogs/i,
        meaning: 'chovendo muito, chuva torrencial',
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
        explanation: 'Expressão usada para desejar boa sorte (especialmente no teatro)'
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
    },
    {
        pattern: /under the weather/i,
        meaning: 'indisposto, meio doente',
        literal: 'sob o clima',
        explanation: 'Sentir-se mal ou doente'
    },
    {
        pattern: /spill the beans/i,
        meaning: 'contar o segredo',
        literal: 'derramar os feijões',
        explanation: 'Revelar informação secreta'
    },
    {
        pattern: /bite the bullet/i,
        meaning: 'enfrentar algo difícil',
        literal: 'morder a bala',
        explanation: 'Fazer algo desagradável mas necessário'
    }
];

// ============================================================
// FUNÇÕES DE DETECÇÃO
// ============================================================

/**
 * Detecta padrões linguísticos especiais
 * @param {string} clickedWord - Palavra clicada
 * @param {string} fullSentence - Frase completa
 * @returns {object} - Detecção com tipo e informações
 */
export function detectLinguisticPattern(clickedWord, fullSentence) {
    const word = clickedWord.toLowerCase().trim();
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
        
        // Pega palavras ao redor (contexto de 5 palavras)
        const words = sentence.split(/\s+/);
        const wordIndex = words.findIndex(w => w.includes(word));
        
        if (wordIndex !== -1) {
            const context = words.slice(wordIndex, wordIndex + 4).join(' ');
            
            for (const pv of phrasalVerbs) {
                // Verifica se todas as partículas estão presentes
                const allParticlesPresent = pv.particles.every(particle => 
                    context.includes(particle)
                );
                
                if (allParticlesPresent) {
                    return {
                        type: 'phrasal_verb',
                        tag: '⚡ PHRASAL VERB',
                        fullExpression: pv.pattern,
                        meaning: pv.meaning,
                        example: pv.example,
                        explanation: `"${pv.pattern}" é um phrasal verb. Não traduza palavra por palavra!`,
                        isolatedMeaning: `"${word}" sozinho tem outro significado`,
                        confidence: 0.9
                    };
                }
            }
        }
    }
    
    // 3. DETECTA GÍRIAS
    if (SLANG_DATABASE[word]) {
        const slangOptions = SLANG_DATABASE[word];
        
        // Determina contexto baseado em palavras indicadoras
        let bestMatch = slangOptions[0];
        let maxScore = 0;
        
        for (const slang of slangOptions) {
            let score = 0;
            for (const indicator of slang.indicators) {
                if (sentence.includes(indicator)) {
                    score++;
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestMatch = slang;
            }
        }
        
        return {
            type: 'slang',
            tag: '🔥 SLANG',
            word: word,
            meaning: bestMatch.meaning,
            example: bestMatch.example,
            explanation: `"${word}" aqui é gíria/linguagem informal`,
            literalMeaning: slangOptions.find(s => s.context !== bestMatch.context)?.meaning,
            confidence: 0.85
        };
    }
    
    // 4. PALAVRA NORMAL (sem padrão especial detectado)
    return {
        type: 'normal',
        tag: null,
        word: word,
        confidence: 0.5
    };
}

/**
 * Extrai contexto ao redor da palavra clicada
 * @param {string} word - Palavra clicada
 * @param {string} sentence - Frase completa
 * @param {number} windowSize - Tamanho da janela de contexto
 * @returns {string} - Contexto extraído
 */
export function extractContext(word, sentence, windowSize = 5) {
    const words = sentence.split(/\s+/);
    const wordIndex = words.findIndex(w => w.toLowerCase().includes(word.toLowerCase()));
    
    if (wordIndex === -1) return sentence;
    
    const start = Math.max(0, wordIndex - windowSize);
    const end = Math.min(words.length, wordIndex + windowSize + 1);
    
    return words.slice(start, end).join(' ');
}

/**
 * Verifica se palavra faz parte de phrasal verb
 * @param {string} word - Palavra
 * @param {string} sentence - Frase
 * @returns {boolean}
 */
export function isPartOfPhrasalVerb(word, sentence) {
    const detection = detectLinguisticPattern(word, sentence);
    return detection.type === 'phrasal_verb';
}

/**
 * Verifica se palavra é gíria no contexto
 * @param {string} word - Palavra
 * @param {string} sentence - Frase
 * @returns {boolean}
 */
export function isSlang(word, sentence) {
    const detection = detectLinguisticPattern(word, sentence);
    return detection.type === 'slang';
}

/**
 * Verifica se palavra faz parte de expressão idiomática
 * @param {string} word - Palavra
 * @param {string} sentence - Frase
 * @returns {boolean}
 */
export function isPartOfIdiom(word, sentence) {
    const detection = detectLinguisticPattern(word, sentence);
    return detection.type === 'idiom';
}
