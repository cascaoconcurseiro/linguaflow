/**
 * LinguaFlow — AI Analysis Engine v2.3
 * Análise linguística completa usando IA (Anthropic Claude)
 */

const ANTHROPIC_API_KEY = 'sk-ant-api03-YOUR_KEY_HERE'; // Usuário deve configurar

/**
 * Explica uma palavra com TODOS os significados principais
 * @param {string} word - Palavra a ser explicada
 * @param {string} sentence - Frase onde a palavra aparece
 * @param {string} translation - Tradução da frase
 * @returns {Promise<string>} - Explicação completa em markdown
 */
export async function explainWordWithAI(word, sentence, translation) {
    const prompt = `
Você é um professor de inglês especializado em ensinar brasileiros.

PALAVRA: "${word}"
FRASE COMPLETA: "${sentence}"
TRADUÇÃO DA FRASE: "${translation}"

⚠️ IMPORTANTE: 
- A palavra "${word}" está em INGLÊS
- Mantenha TODAS as palavras, exemplos e estruturas em INGLÊS
- Explique em PORTUGUÊS

📋 FORMATO DA RESPOSTA:

1. 📖 TODOS OS SIGNIFICADOS PRINCIPAIS
   Liste TODOS os significados mais comuns da palavra "${word}":
   
   Para cada significado, use este formato:
   
   [NÚMERO]. [EMOJI] [CLASSE GRAMATICAL] - [Tradução principal]
      • Exemplo 1 em inglês → Tradução em português
      • Exemplo 2 em inglês → Tradução em português
      • Colocações comuns: "palavra + palavra", "palavra + palavra"
   
   Use emojis:
   🔵 para verbos
   🔴 para adjetivos
   🟢 para substantivos
   🟡 para advérbios
   🟣 para preposições
   ⚪ para outros

2. 💡 CONTEXTO NESTA FRASE ESPECÍFICA
   Analise "${word}" dentro da frase "${sentence}":
   
   - Qual significado está sendo usado NESTA frase?
   - Traduza a frase completa de forma natural
   - Explique por que este significado faz sentido no contexto
   - Se for expressão idiomática, explique o sentido figurado

3. 🎯 VERSÁTIL? (se aplicável)
   Se a palavra tem múltiplos usos muito diferentes, explique:
   
   "${word}" em inglês é versátil:
   - Como [classe 1], significa [significado 1] (ex: exemplo)
   - Como [classe 2], significa [significado 2] (ex: exemplo)
   - Também pode [outro uso especial]

4. ⚠️ ARMADILHAS PARA BRASILEIROS
   - Falsos cognatos
   - Confusões comuns
   - Diferenças de uso entre inglês e português

5. 🔄 PALAVRAS RELACIONADAS
   - Sinônimos em inglês
   - Antônimos em inglês
   - Palavras da mesma família

REGRAS CRÍTICAS:
✅ TODOS os exemplos em INGLÊS
✅ TODAS as colocações em INGLÊS
✅ TODAS as estruturas em INGLÊS
✅ Explicações em PORTUGUÊS
✅ Traduções após o símbolo →
✅ Mostrar TODOS os significados principais, não apenas 1
✅ Analisar o contexto REAL da frase fornecida
`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;

    } catch (error) {
        console.error('[LinguaFlow AI] Erro ao explicar palavra:', error);
        return `Erro ao gerar explicação. Verifique sua chave da API Anthropic.`;
    }
}

/**
 * Analisa gramática de uma frase completa
 * @param {string} sentence - Frase em inglês
 * @param {string} translation - Tradução da frase
 * @returns {Promise<string>} - Análise completa em markdown
 */
export async function analyzeGrammarWithAI(sentence, translation) {
    const prompt = `
Você é um professor de inglês especializado em ensinar brasileiros.

FRASE EM INGLÊS: "${sentence}"
TRADUÇÃO: "${translation}"

⚠️ IMPORTANTE: 
- A frase está em INGLÊS
- Mantenha TODAS as palavras e exemplos em INGLÊS
- Explique em PORTUGUÊS

📋 FORMATO DA RESPOSTA:

1. 🎯 TRADUÇÃO NATURAL
   Traduza a frase de forma natural para o português brasileiro.
   Não traduza palavra por palavra, mas sim o SENTIDO REAL.

2. 🔍 ELEMENTOS LINGUÍSTICOS DETECTADOS
   
   Liste TODOS os elementos especiais encontrados:
   
   * Phrasal Verbs:
     + "phrasal verb" = tradução (explicação do uso)
       Exemplo: "I ran into John" → Encontrei o John por acaso
   
   * Expressões Idiomáticas:
     + "idiom" = tradução (sentido literal vs figurado)
       Literal: [tradução literal]
       Figurado: [sentido real]
   
   * Slang/Gírias:
     + "slang" = tradução (contexto de uso)
   
   * Colocações Naturais:
     + "collocation" (não "palavra + palavra")
       Exemplo: "make a decision" (não "do a decision")
   
   * Falsos Cognatos:
     + "palavra" ≠ [o que brasileiro pensa]
       Na verdade significa: [significado real]

3. 📝 DECOMPOSIÇÃO DA FRASE
   
   Estrutura: [sujeito] + [verbo] + [complemento]
   
   - Sujeito: [palavra] ([tradução])
   - Verbo: [palavra] ([tempo verbal] - [tradução])
   - Objeto/Complemento: [palavra] ([tradução])
   - Modificadores: [palavra] ([função] - [tradução])

4. 🔑 VOCABULÁRIO CHAVE
   
   Para cada palavra importante:
   
   [NÚMERO]. "[palavra}" = [tradução principal]
      Colocações: "palavra + palavra", "palavra + palavra"
      Nuance: [diferença sutil de significado]
      Sinônimos: "synonym1", "synonym2"

5. 🌟 PADRÃO REUTILIZÁVEL
   
   Estrutura: [padrão genérico]
   
   Use este padrão para:
   - [situação 1]
   - [situação 2]
   
   Exemplos:
   1. "Example 1" → Tradução 1
   2. "Example 2" → Tradução 2

REGRAS CRÍTICAS:
✅ TODOS os exemplos em INGLÊS
✅ TODAS as estruturas em INGLÊS
✅ Explicações em PORTUGUÊS
✅ Traduções após o símbolo →
✅ Analisar TODOS os elementos linguísticos
✅ Contexto REAL da frase
`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2048,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;

    } catch (error) {
        console.error('[LinguaFlow AI] Erro ao analisar gramática:', error);
        return `Erro ao gerar análise. Verifique sua chave da API Anthropic.`;
    }
}

/**
 * Gera exemplos contextualizados para uma palavra
 * @param {string} word - Palavra
 * @param {string} pos - Part of speech (noun, verb, etc)
 * @returns {Promise<Array>} - Lista de exemplos
 */
export async function generateExamplesWithAI(word, pos) {
    const prompt = `
Gere 5 exemplos práticos e naturais usando a palavra "${word}" (${pos}).

Formato:
1. "Example sentence in English" → Tradução em português
2. "Example sentence in English" → Tradução em português
...

Regras:
- Exemplos DEVEM estar em INGLÊS
- Traduções em português após →
- Exemplos devem ser naturais e comuns
- Variar contextos (formal, informal, cotidiano)
`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 512,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.content[0].text;
        
        // Parse exemplos
        const examples = [];
        const lines = text.split('\n');
        for (const line of lines) {
            const match = line.match(/"([^"]+)"\s*→\s*(.+)/);
            if (match) {
                examples.push({
                    english: match[1],
                    portuguese: match[2]
                });
            }
        }
        
        return examples;

    } catch (error) {
        console.error('[LinguaFlow AI] Erro ao gerar exemplos:', error);
        return [];
    }
}
