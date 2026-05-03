// background/service-worker.js
import { db } from '../utils/db.js';

console.log('LinguaFlow: Service Worker inicializado.');

// ── Alarmes ──────────────────────────────────────────────────────────────────
chrome.alarms.create('srs-reminder', { periodInMinutes: 1440 });
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
    console.log('[LinguaFlow SW] Mensagem recebida:', request.type || request.action);

    // Proxy para chamadas de banco de dados (Sincronização global entre sites)
    if (request.type === 'DB_CALL') {
        const { method, args } = request;
        if (typeof db[method] === 'function') {
            db[method](...(args || []))
                .then(result => {
                    if (['saveWord', 'updateCard', 'logReview', 'createDeck', 'saveSentence', 'getWordById', 'getSentenceById'].includes(method)) {
                        if (!['getWordById', 'getSentenceById'].includes(method)) {
                             notifyDashboards(args[0]?.word || null);
                             updateBadge();
                        }
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

    // Tradução de texto (Google Translate GTX)
    if (request.action === 'translate') {
        const { text, from, to } = request;
        translateText(text, from, to)
            .then(translation => sendResponse({ translation }))
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

    // Explicação com IA (Grok)
    if (request.action === 'ai_explain_word') {
        const prompt = `Analise a palavra "${request.word}" no contexto: "${request.context || ''}".
        Forneça uma resposta rica com:
        1. Nível Sugerido (CEFR)
        2. O que significa na prática
        3. Colocações Comuns (Chunks importantes)
        4. Como e onde usar
        5. Exemplos Reais (2 frases)
        6. Associação Mental`;
        
        explainWordWithAI(request.word, request.context, prompt)
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

    // Explicação de frase com IA (Foco em intenção)
    if (request.action === 'ai_explain_sentence') {
        const { sentence } = request;
        explainSentenceWithAI(sentence)
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

    if (request.type === 'SAVE_WORD') {
        db.saveWord(request.data)
            .then(res => {
                sendResponse({ success: true, id: res.id });
                notifyDashboards(request.data.word);
                updateBadge();
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
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

    return false;
});

// ── Funções Auxiliares ────────────────────────────────────────────────────────

async function translateText(text, from = 'en', to = 'pt') {
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        return data?.[0]?.[0]?.[0] || text;
    } catch (err) {
        console.error('[LinguaFlow SW] Tradução falhou:', err);
        return text;
    }
}

async function fetchDictionary(word) {
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) return {};
        const data = await res.json();
        const entry = data[0];
        let audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';
        return {
            word: entry.word,
            phonetic: entry.phonetic || '',
            audioUrl,
            partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
            definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
            example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
            synonyms: entry.meanings?.[0]?.synonyms || [],
            antonyms: entry.meanings?.[0]?.antonyms || []
        };
    } catch (err) { return {}; }
}

// ── Funções de IA (Grok) ──────────────────────────────────────────────────────
async function getApiConfig() {
    const defaultKey = '';
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const xAiUrl = 'https://api.x.ai/v1/chat/completions';
    const groqModel = 'llama-3.1-8b-instant';
    const xAiModel = 'grok-beta';

    try {
        const userKey = await db.getSetting('grok_api_key');
        if (userKey && userKey.trim() !== '') {
            const isXAi = userKey.startsWith('xai-');
            return {
                apiKey: userKey,
                apiUrl: isXAi ? xAiUrl : groqUrl,
                model: isXAi ? xAiModel : groqModel
            };
        }
    } catch (e) {}

    return { apiKey: defaultKey, apiUrl: groqUrl, model: groqModel };
}

const BASE_PERSONA = `Atue como um Professor de Inglês Nativo e Mentor Linguístico, extremamente didático e nada robótico. 
Seu objetivo é ensinar o uso real do idioma através do método de aquisição natural.

DIRETRIZES DE OURO:
- Responda SEMPRE em Português Brasileiro (explicações).
- Os EXEMPLOS devem ser OBRIGATORIAMENTE em Inglês.
- FOCO TOTAL NO CONTEXTO: Explique o significado da palavra NA FRASE fornecida. 
- Se a palavra for um "multi-uso" (como 'for', 'get', 'take'), explique OBRIGATORIAMENTE o uso atual e forneça uma pequena dica rápida para os outros 2 usos mais comuns. O usuário quer dominar a palavra como um todo.
- LIMPEZA DE UI: NÃO inclua seções de "Gírias" ou "Phrasal Verbs" se o termo não for um deles. "Menos é mais".
- Sem jargões gramaticais (não diga "adjunto adnominal", diga "palavra que dá característica").
- Sem perguntas no final ou conversa fiada. Seja direto e humano.

ESTRUTURA DE RESPOSTA:
Nível Sugerido (CEFR): [A1-C2]

O que significa na prática: Explicação simples do conceito no contexto da frase.

Como e onde usar: Vibe e contexto social.

Exemplos Reais: 
- [Inglês] (Tradução)

Associação Mental: Uma analogia ou hack visual para memorizar.`;

async function explainWordWithAI(word, context, customPrompt = null) {
    try {
        if (!word) return 'Nenhuma palavra fornecida.';
        const prompt = customPrompt || `Explique a palavra: "${word}" (vista na frase: "${context || 'sem contexto'}")`;
        
        const config = await getApiConfig();
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
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
        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar explicação.';
    } catch (err) { throw err; }
}

async function analyzeGrammarWithAI(sentence) {
    try {
        if (!sentence) return 'Frase vazia.';
        const config = await getApiConfig();
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: BASE_PERSONA + "\nFOCO: Na mecânica da estrutura e por que as palavras estão nessa ordem." },
                    { role: 'user', content: `Explique a estrutura desta frase: "${sentence}"` }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });
        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
    } catch (err) { throw err; }
}

async function explainSentenceWithAI(sentence) {
    try {
        if (!sentence) return 'Frase vazia.';
        const config = await getApiConfig();
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: BASE_PERSONA + "\nFOCO: Na intenção real, emoção e como um dublador diria isso." },
                    { role: 'user', content: `Explique a intenção desta frase: "${sentence}"` }
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });
        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
    } catch (err) { throw err; }
}

async function explainQuickContext(word, sentence) {
    try {
        const config = await getApiConfig();
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: 'Você é um professor particular de inglês focado em insights rápidos. Responda em português brasileiro de forma ultra-direta e didática.' },
                    { role: 'user', content: `O que "${word}" significa EXATAMENTE nesta situação: "${sentence}"? Me dê um insight rápido de 1 linha.` }
                ],
                temperature: 0.5,
                max_tokens: 150
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (err) { return null; }
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
        chrome.action.setBadgeBackgroundColor({ color: '#38BDF8' });
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
