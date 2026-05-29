// background/service-worker.js
import { db } from '../utils/db.js';
import { translator } from '../utils/translator.js';

console.debug('LinguaFlow: Service Worker inicializado.');

// ── Alarmes ──────────────────────────────────────────────────────────────────
chrome.alarms.create('srs-reminder', { periodInMinutes: 60 });
chrome.alarms.create('auto-backup', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'srs-reminder') updateBadge();
    if (alarm.name === 'auto-backup') runAutoBackup();
});

// ── Instalação ───────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ nativeLang: 'pt', targetLangs: ['en'] });
    chrome.contextMenus.create({
        id: 'linguaflow-save',
        title: 'Salvar no LinguaFlow',
        contexts: ['selection']
    });
    clearBadLingueeCache();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'linguaflow-save') {
        chrome.tabs.sendMessage(tab.id, {
            action: 'openWordPopup',
            payload: { word: info.selectionText.trim() }
        });
    }
});

// ── Listener de mensagens ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.debug('[LinguaFlow SW] Mensagem recebida:', request.type || request.action);

    // Proxy para chamadas de banco de dados (Sincronização global entre sites)
    if (request.type === 'DB_CALL') {
        const { method, args } = request;
        if (typeof db[method] === 'function') {
            db[method](...(args || []))
                .then(result => {
                    // Notificações automáticas para métodos de escrita
                    const writeMethods = ['saveWord', 'updateCard', 'logReview', 'createDeck', 'saveSentence', 'deleteWord', 'deleteDeck', 'markAsKnown'];
                    if (writeMethods.includes(method)) {
                        notifyDashboards(args[0]?.word || null);
                        updateBadge();
                    }
                    sendResponse({ result });
                })
                .catch(error => {
                    console.error(`[LinguaFlow SW] Erro em db.${method}:`, error);
                    sendResponse({ error: error.message });
                });
            return true;
        }
    }

    // Tradução de texto (Usando utilitário Translator com Cache multinível)
    if (request.action === 'translate') {
        const { text, from, to } = request;
        translator.translate(text, from, to)
            .then(result => sendResponse({ translation: result.translation, source: result.source }))
            .catch(err => sendResponse({ translation: null, error: err.message }));
        return true;
    }

    // Dicionário (Oxford/DictionaryAPI)
    if (request.action === 'dictionary') {
        const { word } = request;
        fetchDictionary(word)
            .then(data => sendResponse({ ok: true, data }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // Geração de Variações AI (Pilar 3: Motor Infinito)
    if (request.action === 'lf_generate_variation') {
        const { word, sentence } = request;
        generateAIVariation(word, sentence)
            .then(data => sendResponse({ ok: true, data }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // Explicação com IA (Grok)
    if (request.action === 'ai_explain_word') {
        const { fullContext } = request;
        const contextStr = fullContext 
            ? `ANTERIOR: "${fullContext.prev}" | ATUAL: "${fullContext.current}" | PRÓXIMA: "${fullContext.next}"`
            : request.context;

        const prompt = `Analise a palavra "${request.word}" vista neste diálogo: "${contextStr}".
        Siga RIGOROSAMENTE a "Estrutura de Resposta Obrigatória" fornecida nas diretrizes do sistema.`;
        
        explainWordWithAI(request.word, contextStr, prompt)
            .then(explanation => sendResponse({ explanation }))
            .catch(err => sendResponse({ explanation: null, error: err.message }));
        return true;
    }

    // Análise gramatical com IA (Grok)
    if (request.action === 'ai_analyze_sentence') {
        const { sentence } = request;
        analyzeGrammarWithAI(sentence)
            .then(analysis => sendResponse({ analysis }))
            .catch(err => sendResponse({ analysis: null, error: err.message }));
        return true;
    }

    // Explicação de frase com IA (Foco em intenção e fluxo)
    if (request.action === 'ai_explain_sentence') {
        const { sentence, fullContext } = request;
        explainSentenceWithAI(sentence, fullContext)
            .then(analysis => sendResponse({ analysis }))
            .catch(err => sendResponse({ analysis: null, error: err.message }));
        return true;
    }

    // Explicação contextual rápida (1-2 linhas)
    if (request.action === 'ai_quick_context') {
        const { word, sentence } = request;
        explainQuickContext(word, sentence)
            .then(explanation => sendResponse({ explanation }))
            .catch(err => sendResponse({ explanation: null, error: err.message }));
        return true;
    }


    if (request.type === 'FETCH_LINGUEE') {
        const word = request.word;
        const cacheKey = `linguee_${word}`;
        chrome.storage.local.get([cacheKey], (stored) => {
            if (stored[cacheKey] && (Date.now() - stored[cacheKey].ts) < 7 * 24 * 60 * 60 * 1000) {
                sendResponse({ success: true, html: stored[cacheKey].html, fromCache: true });
                return;
            }
            fetch(`https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodeURIComponent(word)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                    'Referer': 'https://www.linguee.com.br/'
                }
            })
            .then(r => r.arrayBuffer())
            .then(buffer => {
                let html;
                try {
                    const utf8 = new TextDecoder('utf-8').decode(buffer);
                    if (utf8.includes('\uFFFD')) html = new TextDecoder('iso-8859-1').decode(buffer);
                    else html = utf8;
                } catch { html = new TextDecoder('iso-8859-1').decode(buffer); }
                const hasExamples = html.includes('class="example"') || html.includes('tag_s');
                if (hasExamples) chrome.storage.local.set({ [cacheKey]: { html, ts: Date.now() } });
                sendResponse({ success: true, html });
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        });
        return true;
    }

    if (request.type === 'FETCH_REVERSO') {
        const word = request.word;
        const cacheKey = `reverso_${word}`;
        chrome.storage.local.get([cacheKey], async (stored) => {
            if (stored[cacheKey] && (Date.now() - stored[cacheKey].ts) < 7 * 24 * 60 * 60 * 1000) {
                sendResponse({ success: true, list: stored[cacheKey].list, fromCache: true });
                return;
            }
            try {
                // Mapeamento de idiomas para o corpus do Reverso (ex: en -> eng, pt -> por)
                const langMap = { 'en': 'eng', 'pt': 'por', 'es': 'spa', 'fr': 'fra', 'it': 'ita', 'de': 'ger' };
                const src = langMap[request.srcLang] || 'eng';
                const dst = langMap[request.dstLang] || 'por';
                const corpus = `${src}-${dst}`;

                const res = await fetch('https://context.reverso.net/bst-query-service', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://context.reverso.net',
                        'Referer': 'https://context.reverso.net/translation/'
                    },
                    body: JSON.stringify({
                        source_lang: request.srcLang || 'en',
                        target_lang: request.dstLang || 'pt',
                        source_text: word,
                        corpus: corpus,
                        npage: 1,
                        mode: 0
                    })
                });
                if (!res.ok) throw new Error(`Reverso error: ${res.status}`);
                const data = await res.json();
                const list = (data.list || []).map(item => ({ 
                    en: item.s_text?.replace(/<[^>]+>/g, '') || '', 
                    pt: item.t_text?.replace(/<[^>]+>/g, '') || '' 
                })).filter(x => x.en && x.pt);
                
                chrome.storage.local.set({ [cacheKey]: { list, ts: Date.now() } });
                sendResponse({ success: true, list });
            } catch (err) { 
                console.error('[LinguaFlow] Reverso Error:', err);
                sendResponse({ success: false, error: err.message }); 
            }
        });
        return true;
    }

    if (request.type === 'REFRESH_DASHBOARD') {
        notifyDashboards(null);
        sendResponse({ ok: true });
        return true;
    }

    if (request.type === 'GET_KNOWN_WORDS') {
        db.getAllWords().then(words => {
            const known = {};
            words.forEach(w => known[w.word.toLowerCase()] = w.status);
            sendResponse({ known });
        }).catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.action === 'lf_get_all_known_words') {
        db.getAllWords().then(words => {
            // Retorna o objeto completo da palavra, incluindo word e translation
            sendResponse(words);
        }).catch(err => {
            console.error('[LinguaFlow] Error fetching words:', err);
            sendResponse([]);
        });
        return true;
    }

    return false;
});

// ── Funções Auxiliares ────────────────────────────────────────────────────────

async function translateText(text, from = 'en', to = 'pt') {
    // Redireciona para o utilitário que tem cache e fallback
    const res = await translator.translate(text, from, to);
    return res.translation || text;
}

async function fetchDictionary(word) {
    const emptyResult = {
        word: word,
        phonetic: '',
        audioUrl: '',
        partOfSpeech: '',
        definition: '',
        example: '',
        synonyms: [],
        antonyms: []
    };
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) return emptyResult;
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) return emptyResult;
        
        const entry = data[0];
        let audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';
        if (audioUrl && audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
        
        return {
            word: entry.word || word,
            phonetic: entry.phonetic || '',
            audioUrl,
            partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
            definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
            example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
            synonyms: entry.meanings?.[0]?.synonyms || [],
            antonyms: entry.meanings?.[0]?.antonyms || []
        };
    } catch (err) { 
        console.error('[LinguaFlow] Dictionary Fetch Error:', err);
        return emptyResult; 
    }
}

// ── Funções de IA (Grok) ──────────────────────────────────────────────────────
async function getApiConfig() {
    const defaultKey = '';
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const xAiUrl = 'https://api.x.ai/v1/chat/completions';
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
    const groqModel = 'llama-3.1-8b-instant';
    const xAiModel = 'grok-beta';
    const geminiModel = 'gemini-1.5-flash';

    try {
        const userKey = await db.getSetting('grok_api_key');
        if (userKey && userKey.trim() !== '') {
            const trimmedKey = userKey.trim();
            
            // Detecção de Provedor por prefixo
            if (trimmedKey.startsWith('AIza')) {
                return {
                    provider: 'gemini',
                    apiKey: trimmedKey,
                    apiUrl: `${geminiUrl}?key=${trimmedKey}`,
                    model: geminiModel
                };
            }
            
            const isXAi = trimmedKey.startsWith('xai-');
            return {
                provider: isXAi ? 'xai' : 'groq',
                apiKey: trimmedKey,
                apiUrl: isXAi ? xAiUrl : groqUrl,
                model: isXAi ? xAiModel : groqModel
            };
        }
    } catch (e) {}

    return { provider: 'groq', apiKey: defaultKey, apiUrl: groqUrl, model: groqModel };
}

const BASE_PERSONA = `Atue como um Especialista em Aquisição de Linguagem e Treinador de Fluência (Nativo). 
Seu objetivo é fazer o aluno dominar o uso real do inglês de forma visceral, sem decoreba gramatical.

DIRETRIZES DE OURO:
- Responda SEMPRE em Português Brasileiro (para as explicações).
- Os EXEMPLOS devem ser OBRIGATORIAMENTE em Inglês com a tradução ao lado.
- FOCO NO CONTEXTO: Explique o significado da palavra EXATAMENTE como foi usada na frase fornecida.
- SEGREDO DA FLUÊNCIA (CHUNKS): Nativos não pensam em palavras isoladas, pensam em blocos. Sempre ensine os "Chunks" (colocações) mais comuns com essa palavra.
- PRONÚNCIA DE RUA: Diga como a palavra soa na vida real, em "connected speech" (Ex: "got to" -> "gotta").
- Sem jargões gramaticais chatos. Fale como um mentor de alta performance.
- Use formatação Markdown (Negrito, Itálico) para destacar as partes importantes.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA:
**Nível Sugerido (CEFR):** [A1 a C2]

**O que significa na prática:** Explicação hiper-direta do conceito dentro do contexto da frase.

**Como e onde usar (Vibe):** É formal? É gíria? É usado em reuniões ou no bar? Qual o tom emocional da palavra?

**Pronúncia de Rua:** Como os nativos falam isso rápido (escreva como se lê em português).

**Colocações Comuns (Chunks):** 2 ou 3 blocos de palavras que andam sempre junto com esse termo.

**Exemplos Reais:** 
- [Inglês] (Tradução)
- [Inglês] (Tradução)

**Associação Mental (Neuro-Hack):** Como um especialista em memória, crie um "gancho" absurdo, uma semelhança sonora com o português ou uma cena inesquecível para o cérebro memorizar a palavra na hora. O foco é fixação imediata!`;

async function explainWordWithAI(word, context, customPrompt = null) {
    try {
        if (!word) return 'Nenhuma palavra fornecida.';
        const prompt = customPrompt || `Explique a palavra: "${word}" (vista na frase: "${context || 'sem contexto'}")`;
        
        const config = await getApiConfig();
        if (!config.apiKey && config.provider !== 'gemini') return 'Por favor, configure sua chave de API no Dashboard para usar recursos de IA.';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let response;
        if (config.provider === 'gemini') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: BASE_PERSONA + "\n\n" + prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                })
            });
        } else {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: BASE_PERSONA + "\nFOCO: Na alma da palavra específica e sua personalidade." },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                })
            });
        }

        clearTimeout(timeoutId);
        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`Erro API (${response.status}): ${errBody}`);
        }
        
        const data = await response.json();
        
        if (config.provider === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar explicação com Gemini.';
        }
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar explicação.';
    } catch (err) {
        console.error('[LinguaFlow IA] Erro:', err);
        throw err;
    }
}

async function analyzeGrammarWithAI(sentence) {
    try {
        if (!sentence) return 'Frase vazia.';
        const config = await getApiConfig();
        if (!config.apiKey && config.provider !== 'gemini') throw new Error('Configure sua API Key.');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const grammarPersona = `Atue como um Engenheiro de Padrões de Linguagem (Nativo do Idioma Alvo).
Seu objetivo é extrair o MOLDE ESTRUTURAL de uma frase inteira e ensinar um brasileiro a usá-lo para criar suas próprias frases, focando 100% na prática e fluência.

DIRETRIZES ABSOLUTAS:
- Esqueça regras acadêmicas chatas (não use palavras como sujeito, verbo, objeto, presente contínuo).
- O foco é a ESTRUTURA e a FLUÊNCIA no idioma estrangeiro. 
- Responda as explicações em Português Brasileiro, mas os exemplos DEVEM ser no IDIOMA ESTRANGEIRO.
- Mantenha a resposta super dinâmica e empolgante, estilo "Mentor de Alta Performance".
- Use EXATAMENTE os títulos em negrito abaixo.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA:
**🧬 O Molde (A Estrutura):** Extraia a "fórmula matemática" da frase original. Mostre a estrutura de blocos (Ex: "There + [Pronome] + [Verbo to be]").

**⚙️ Como a Engrenagem Funciona:** Uma explicação hiper-direta (máx 2 linhas) sobre em qual situação na vida real usamos esse molde.

**🛠️ Mão na Massa:** Mostre 3 exemplos de frases totalmente diferentes e úteis para a vida real construídas EXATAMENTE com o mesmo molde da frase original. (Formato: "- [Inglês] -> [Tradução]").

**🗣️ Pronúncia de Rua:** Como os nativos falam a frase ORIGINAL em "connected speech"? Escreva como se lê, mostrando onde as palavras se juntam. (MANTENHA O IDIOMA ORIGINAL, ex: "There he is" -> "Dere-iz").

**⚠️ O Pulo do Gato:** Qual erro clássico de lógica ou tradução os brasileiros cometem ao tentar usar esse molde no idioma alvo?`;

        const userPrompt = `Analise detalhadamente a gramática desta frase: "${sentence}"`;

        let response;
        if (config.provider === 'gemini') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: grammarPersona + "\n\n" + userPrompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
                })
            });
        } else {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: grammarPersona },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
        }

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();

        if (config.provider === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar análise.';
        }
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
    } catch (err) { throw err; }
}

async function explainSentenceWithAI(sentence, fullContext = null) {
    try {
        if (!sentence) return 'Frase vazia.';
        const config = await getApiConfig();
        if (!config.apiKey && config.provider !== 'gemini') throw new Error('Configure sua API Key.');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let contextInfo = "";
        if (fullContext) {
            contextInfo = `
            DIÁLOGO AO REDOR:
            Frase Anterior: "${fullContext.prev}"
            Frase Atual (em foco): "${fullContext.current}"
            Próxima Frase: "${fullContext.next}"
            
            ⚠️ IMPORTANTE: Explique a "Frase Atual" considerando o fluxo do diálogo. 
            Se houver pronomes (it, that, they) ou referências, aponte a quem se referem no diálogo acima.`;
        }

        const systemPrompt = BASE_PERSONA + "\nFOCO: Na intenção real, emoção, referências contextuais e fluxo do diálogo.";
        const userPrompt = contextInfo || `Explique a intenção desta frase: "${sentence}"`;

        let response;
        if (config.provider === 'gemini') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                })
            });
        } else {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                })
            });
        }

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();

        if (config.provider === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar análise.';
        }
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
    } catch (err) { throw err; }
}

async function explainQuickContext(word, sentence) {
    try {
        const config = await getApiConfig();
        if (!config.apiKey && config.provider !== 'gemini') return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s para contexto rápido

        const systemPrompt = 'Você é um professor particular de inglês focado em insights rápidos. Responda em português brasileiro de forma ultra-direta e didática.';
        const userPrompt = `O que "${word}" significa EXATAMENTE nesta situação: "${sentence}"? Me dê um insight rápido de 1 linha.`;

        let response;
        if (config.provider === 'gemini') {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 150 }
                })
            });
        } else {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 150
                })
            });
        }

        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (config.provider === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
        return data.choices?.[0]?.message?.content || null;
    } catch (err) {
        console.warn('[LinguaFlow IA] Quick Context falhou:', err);
        return null; 
    }
}

function notifyDashboards(word) {
    const msg = { type: 'REFRESH_VOCAB', word: word || null };
    // Envia para o Dashboard/Popup (contexto de extensão)
    chrome.runtime.sendMessage(msg).catch(() => {});
    
    // Envia para Content Scripts em todas as abas
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
        });
    });
}

function updateBadge() {
    db.getStats().then(stats => {
        const due = stats.dueCards || 0;
        chrome.action.setBadgeText({ text: due > 0 ? String(due) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Vermelho de alerta (Gamification)
    }).catch(() => {});
}

function clearBadLingueeCache() {
    chrome.storage.local.get(null, items => {
        const keys = Object.keys(items).filter(k => k.startsWith('linguee_') && items[k].html?.includes('\uFFFD'));
        if (keys.length) chrome.storage.local.remove(keys);
    });
}

async function runAutoBackup() {
    try {
        const words = await db.getAllWords();
        if (!words.length) return;
        const backup = { version: 4, exportedAt: new Date().toISOString(), db: { words } };
        chrome.storage.local.set({ 'lf_auto_backup': backup, 'lf_auto_backup_date': Date.now() });
    } catch (e) {}
}

async function generateAIVariation(word, sentence) {
    const config = await getApiConfig();
    const prompt = `Você é um professor de inglês inovador.
A frase que estou estudando contém a palavra "${word}": "${sentence}".
Sua tarefa é gerar APENAS 3 frases INÉDITAS usando o mesmo padrão gramatical e a palavra "${word}".
As frases devem ser coloquiais, modernas e úteis (nada de frases de livro de escola).

Regras de Saída:
Não dê explicações. Responda APENAS com a lista numerada, sendo a frase em inglês e a tradução.
1. [Frase 1 em inglês] - [Tradução 1]
2. [Frase 2 em inglês] - [Tradução 2]
3. [Frase 3 em inglês] - [Tradução 3]`;

    const payload = {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 300
    };

    if (config.provider !== 'gemini') {
        payload.model = config.model;
    } else {
        delete payload.model;
        delete payload.messages;
        payload.contents = [{ parts: [{ text: prompt }] }];
    }

    const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.provider !== 'gemini' && { 'Authorization': `Bearer ${config.apiKey}` })
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('API AI falhou ao gerar variações');
    const data = await res.json();
    return config.provider === 'gemini' ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
}
