// utils/linguee.js - Integração com Linguee para exemplos reais

class LingueeAPI {
    constructor() {
        this.cache = new Map();
        this.baseUrl = 'https://www.linguee.com.br/ingles-portugues/search';
    }

    /**
     * Busca exemplos reais do Linguee
     * @param {string} word - Palavra a buscar
     * @param {string} sourceLang - Idioma de origem (padrão: 'en')
     * @param {string} targetLang - Idioma de destino (padrão: 'pt')
     * @returns {Promise<Array>} Array de exemplos { en, pt, source }
     */
    async fetchExamples(word, sourceLang = 'en', targetLang = 'pt') {
        const cacheKey = `${word}_${sourceLang}_${targetLang}`;
        
        // Verifica cache
        if (this.cache.has(cacheKey)) {
            console.log('[Linguee] Exemplos do cache:', word);
            return this.cache.get(cacheKey);
        }

        try {
            console.log('[Linguee] Buscando exemplos para:', word);
            
            // Usa o background script para fazer a requisição (evita CORS)
            const response = await chrome.runtime.sendMessage({
                type: 'FETCH_LINGUEE',
                word: word,
                sourceLang: sourceLang,
                targetLang: targetLang
            });

            if (!response || !response.success) {
                console.warn('[Linguee] Falha ao buscar exemplos:', response?.error);
                return this._getFallbackExamples(word);
            }

            const examples = this._parseHTML(response.html, word);
            
            // Limita a 5 exemplos
            const limitedExamples = examples.slice(0, 5);
            
            // Salva no cache
            if (this.cache.size >= 50) {
                // Remove o mais antigo
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(cacheKey, limitedExamples);
            
            console.log('[Linguee] Exemplos encontrados:', limitedExamples.length);
            return limitedExamples;
        } catch (error) {
            console.error('[Linguee] Erro ao buscar exemplos:', error);
            return this._getFallbackExamples(word);
        }
    }

    /**
     * Extrai exemplos do HTML do Linguee
     * @param {string} html - HTML da página do Linguee
     * @param {string} word - Palavra buscada
     * @returns {Array} Array de exemplos
     */
    _parseHTML(html, word) {
        const examples = [];
        
        try {
            // Cria um parser DOM temporário
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Busca por exemplos (estrutura do Linguee)
            const exampleDivs = doc.querySelectorAll('.example');
            
            exampleDivs.forEach(div => {
                const sourceEl = div.querySelector('.tag_s');
                const targetEl = div.querySelector('.tag_t');
                
                if (sourceEl && targetEl) {
                    const source = sourceEl.textContent.trim();
                    const target = targetEl.textContent.trim();
                    
                    if (source && target && source.length < 200) {
                        examples.push({
                            en: source,
                            pt: target,
                            source: 'Linguee'
                        });
                    }
                }
            });
            
            // Se não encontrou exemplos, tenta estrutura alternativa
            if (examples.length === 0) {
                const lemmas = doc.querySelectorAll('.lemma');
                lemmas.forEach(lemma => {
                    const sourceText = lemma.querySelector('.source')?.textContent.trim();
                    const targetText = lemma.querySelector('.target')?.textContent.trim();
                    
                    if (sourceText && targetText && sourceText.length < 200) {
                        examples.push({
                            en: sourceText,
                            pt: targetText,
                            source: 'Linguee'
                        });
                    }
                });
            }
        } catch (error) {
            console.error('[Linguee] Erro ao parsear HTML:', error);
        }
        
        return examples;
    }

    /**
     * Retorna exemplos de fallback quando Linguee falha
     * @param {string} word - Palavra
     * @returns {Array} Exemplos genéricos
     */
    _getFallbackExamples(word) {
        console.log('[Linguee] Usando exemplos de fallback para:', word);
        
        // Exemplos genéricos baseados em padrões comuns
        return [
            {
                en: `I ${word} every day.`,
                pt: `Eu ${word} todos os dias.`,
                source: 'Gerado'
            },
            {
                en: `The ${word} is important.`,
                pt: `O/A ${word} é importante.`,
                source: 'Gerado'
            },
            {
                en: `Can you ${word} this?`,
                pt: `Você pode ${word} isso?`,
                source: 'Gerado'
            },
            {
                en: `She likes to ${word}.`,
                pt: `Ela gosta de ${word}.`,
                source: 'Gerado'
            },
            {
                en: `This ${word} works well.`,
                pt: `Este/Esta ${word} funciona bem.`,
                source: 'Gerado'
            }
        ];
    }

    /**
     * Limpa o cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[Linguee] Cache limpo');
    }
}

export const linguee = new LingueeAPI();
