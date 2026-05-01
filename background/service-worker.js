// background/service-worker.js

const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 3;

console.log('LinguaFlow: Service Worker inicializado.');

// ── Alarmes ──────────────────────────────────────────────────────────────────
chrome.alarms.create('srs-reminder', { periodInMinutes: 1440 });
// Backup automático diário
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
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    
    // Limpa cache do Linguee com encoding errado na instalação/atualização
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

    if (request.type === 'SAVE_WORD') {
        saveWordToExtensionDB(request.data)
            .then(id => {
                sendResponse({ success: true, id });
                notifyDashboards(request.data.word);
                updateBadge();
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.type === 'WORD_SAVED') {
        notifyDashboards();
        updateBadge();
        sendResponse({ success: true });
        return true;
    }

    // Repassa REFRESH_DASHBOARD do content script para o dashboard
    if (request.type === 'REFRESH_DASHBOARD') {
        notifyDashboards(request.word);
        sendResponse({ ok: true });
        return true;
    }

    if (request.type === 'FETCH_LINGUEE') {
        const word = request.word;
        const cacheKey = `linguee_${word}`;

        chrome.storage.local.get([cacheKey, 'linguee_last_req'], async (stored) => {
            // Cache de 7 dias — mas só se o HTML tiver exemplos reais
            if (stored[cacheKey] && (Date.now() - stored[cacheKey].ts) < 7 * 24 * 60 * 60 * 1000) {
                // Verifica se o cache tem exemplos (não é página de erro/bloqueio)
                const cachedHtml = stored[cacheKey].html || '';
                const hasExamples = cachedHtml.includes('class="example"') || 
                                    cachedHtml.includes('class="inexact"') ||
                                    cachedHtml.includes('tag_s') ||
                                    cachedHtml.includes('translation');
                if (hasExamples) {
                    sendResponse({ success: true, html: cachedHtml, fromCache: true });
                    return;
                }
                // Cache inválido (sem exemplos) — busca novamente
                console.log('[LinguaFlow SW] Cache do Linguee sem exemplos, buscando novamente...');
            }

            // Rate limiting: 1.5s entre requisições
            const lastReq = stored.linguee_last_req || 0;
            const wait = Math.max(0, 1500 - (Date.now() - lastReq));
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            chrome.storage.local.set({ linguee_last_req: Date.now() });

            fetch(`https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodeURIComponent(word)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                    'Referer': 'https://www.linguee.com.br/'
                }
            })
            .then(r => r.arrayBuffer())
            .then(buffer => {
                // Detecta o encoding da resposta e decodifica corretamente
                // O Linguee serve em ISO-8859-1, então usamos latin-1
                let html;
                try {
                    // Tenta UTF-8 primeiro
                    const utf8 = new TextDecoder('utf-8').decode(buffer);
                    // Se tem caracteres de substituição (encoding errado), usa latin-1
                    if (utf8.includes('\uFFFD')) {
                        html = new TextDecoder('iso-8859-1').decode(buffer);
                    } else {
                        html = utf8;
                    }
                } catch {
                    html = new TextDecoder('iso-8859-1').decode(buffer);
                }

                // Só cacheia se tiver exemplos reais
                const hasExamples = html.includes('class="example"') || 
                                    html.includes('class="inexact"') ||
                                    html.includes('tag_s') ||
                                    html.includes('translation');
                if (hasExamples) {
                    chrome.storage.local.set({ [cacheKey]: { html, ts: Date.now() } });
                }
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
            // Cache de 7 dias
            if (stored[cacheKey] && (Date.now() - stored[cacheKey].ts) < 7 * 24 * 60 * 60 * 1000) {
                sendResponse({ success: true, list: stored[cacheKey].list, fromCache: true });
                return;
            }

            try {
                const res = await fetch('https://context.reverso.net/bst-query-service', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    body: JSON.stringify({
                        source_lang: request.srcLang || 'en',
                        target_lang: request.dstLang || 'pt',
                        source_text: word,
                        target_text: '',
                        npage: 1,
                        corpus: 'eng-por',
                        expr_freq: 0
                    })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const list = (data.list || []).slice(0, 30)
                    .map(item => ({
                        en: item.s_text?.replace(/<[^>]+>/g, '').trim(),
                        pt: item.t_text?.replace(/<[^>]+>/g, '').trim()
                    }))
                    .filter(x => x.en && x.pt);

                chrome.storage.local.set({ [cacheKey]: { list, ts: Date.now() } });
                sendResponse({ success: true, list });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        });
        return true;
    }

    if (request.type === 'FULL_BACKUP') {
        createFullBackup()
            .then(backup => sendResponse({ success: true, backup }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.type === 'FULL_RESTORE') {
        restoreFullBackup(request.backup)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.type === 'GET_AUTO_BACKUP') {
        chrome.storage.local.get(['lf_auto_backup', 'lf_auto_backup_date'], result => {
            sendResponse({
                success: true,
                backup: result.lf_auto_backup || null,
                date: result.lf_auto_backup_date || null
            });
        });
        return true;
    }

    if (request.type === 'RESTORE_AUTO_BACKUP') {
        chrome.storage.local.get(['lf_auto_backup'], async result => {
            if (!result.lf_auto_backup) {
                sendResponse({ success: false, error: 'Nenhum backup automático encontrado' });
                return;
            }
            try {
                await restoreFullBackup(result.lf_auto_backup);
                sendResponse({ success: true, wordCount: result.lf_auto_backup.wordCount });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        });
        return true;
    }

    if (request.type === 'CLEAR_LINGUEE_CACHE') {
        chrome.storage.local.get(null, items => {
            const keys = Object.keys(items).filter(k => k.startsWith('linguee_') || k.startsWith('reverso_'));
            chrome.storage.local.remove(keys);
            sendResponse({ success: true, removed: keys.length });
        });
        return true;
    }

    // ── Handlers para WordPopup (Pro V5) ──────────────────────────────────────
    
    // Tradução de texto
    if (request.action === 'translate') {
        const { text, from, to } = request;
        translateText(text, from, to)
            .then(translation => sendResponse({ translation }))
            .catch(err => sendResponse({ translation: null, error: err.message }));
        return true;
    }

    // Dicionário (definição de palavra)
    if (request.action === 'dictionary') {
        const { word } = request;
        fetchDictionary(word)
            .then(data => sendResponse({ ok: true, data }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // Explicação com IA (Grok)
    if (request.action === 'ai_explain_word') {
        const { word, context } = request;
        explainWordWithAI(word, context)
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

    // Explicação contextual rápida (1-2 linhas)
    if (request.action === 'ai_quick_context') {
        const { word, sentence } = request;
        explainQuickContext(word, sentence)
            .then(explanation => sendResponse({ explanation }))
            .catch(err => sendResponse({ explanation: null, error: err.message }));
        return true;
    }

    return false;
}); // ← fechamento correto do addListener

// ── Funções de Tradução e Dicionário ──────────────────────────────────────────

async function translateText(text, from = 'en', to = 'pt') {
    // Prioridade 1: Google Translate GTX (gratuito, melhor qualidade)
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (data?.[0]?.[0]?.[0]) {
            const translation = data[0].map(item => item[0]).filter(Boolean).join('');
            if (translation && translation !== text) return translation;
        }
    } catch (err) {
        console.error('[LinguaFlow SW] Google Translate falhou:', err);
    }
    
    // Prioridade 2: MyMemory (fallback)
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
        const data = await res.json();
        const translation = data.responseData?.translatedText;
        if (translation && translation !== text) return translation;
    } catch (err) {
        console.error('[LinguaFlow SW] MyMemory falhou:', err);
    }
    
    // Se tudo falhar, retorna original
    return text;
}

async function fetchDictionary(word) {
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) return {};
        
        const data = await res.json();
        const entry = data[0];
        
        // Extract audio URL from phonetics array (priority: US > UK > any)
        let audioUrl = '';
        if (entry.phonetics && Array.isArray(entry.phonetics)) {
            // Try US English first
            const usAudio = entry.phonetics.find(p => p.audio && p.audio.includes('-us.mp3'));
            if (usAudio?.audio) {
                audioUrl = usAudio.audio;
            } else {
                // Fallback to any audio available
                const anyAudio = entry.phonetics.find(p => p.audio);
                if (anyAudio?.audio) audioUrl = anyAudio.audio;
            }
        }
        
        return {
            word: entry.word,
            phonetic: entry.phonetic || '',
            audioUrl: audioUrl, // ← NEW: Native speaker MP3
            partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
            definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
            example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
            synonyms: entry.meanings?.[0]?.synonyms || [],
            antonyms: entry.meanings?.[0]?.antonyms || []
        };
    } catch (err) {
        console.error('[LinguaFlow SW] Erro no dicionário:', err);
        return {};
    }
}

// ── Funções de IA (Grok) ──────────────────────────────────────────────────────

const GROK_API_KEY = 'YOUR_GROQ_API_KEY';
const GROK_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROK_MODEL   = 'llama-3.1-8b-instant';

async function explainWordWithAI(word, context) {
    try {
        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um Motor de Análise Linguística altamente especializado para aprendizado de idiomas. Sua função é processar palavras/expressões de legendas em QUALQUER IDIOMA e fornecer análise detalhada e contextualizada.

REGRA FUNDAMENTAL: Mantenha TODAS as palavras, exemplos e estruturas no IDIOMA ORIGINAL da legenda. Explique SEMPRE em português brasileiro.

Foco da análise:
- Decomposição e estrutura
- Colocações e chunks naturais
- Diferenciação de sinônimos/antônimos
- Gramática aplicada (apenas quando relevante)
- Nuances culturais e idiomáticas
- Vocabulário chave contextualizado

Tom: Informativo, objetivo, conciso. Sempre em português brasileiro.`
                    },
                    {
                        role: 'user',
                        content: `Analise a palavra/expressão: "${word}"
Contexto da legenda: "${context || 'sem contexto'}"

⚠️ IMPORTANTE: Mantenha "${word}" e TODOS os exemplos no IDIOMA ORIGINAL da legenda. Explique em PORTUGUÊS.

Forneça análise estruturada:

1. 🎯 **Tipo de Expressão**
   - Identifique: palavra comum | phrasal verb | slang | idiom | collocation | expressão cultural
   - Se for phrasal verb/idiom/slang, DESTAQUE isso imediatamente

2. 📌 **Significado Contextual**
   - O que "${word}" (no idioma original) significa NESTE contexto específico (2-3 linhas em português)
   - Se for expressão idiomática: significado literal vs. figurado

3. 📚 **Estrutura e Uso**
   - Classe gramatical e função na frase
   - Padrão de uso no IDIOMA ORIGINAL (ex: verb + preposition, adjective + noun)
   - Colocações naturais no IDIOMA ORIGINAL (palavras que frequentemente aparecem juntas)

4. 🔄 **Sinônimos e Nuances**
   - Liste 2-3 sinônimos no IDIOMA ORIGINAL
   - Explique em PORTUGUÊS a DIFERENÇA de uso e nuance entre eles
   - Por que "${word}" foi escolhido neste contexto?

5. 💡 **Exemplos de Uso**
   - 2 exemplos práticos no IDIOMA ORIGINAL com tradução em português
   - Mostre diferentes contextos de uso
   - Formato: "Example in original language" → Tradução em português

6. ⚠️ **Armadilhas para Brasileiros**
   - Falsos cognatos, diferenças com português
   - Erros comuns de uso
   - Registro (formal/informal/gíria)

7. 🧠 **Dica de Memorização**
   - Técnica criativa em PORTUGUÊS para nunca esquecer
   - Associação visual, mnemônica ou cultural`
                    }
                ],
                temperature: 0.7,
                max_tokens: 700
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erro na API Groq');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar explicação.';
    } catch (err) {
        console.error('[LinguaFlow SW] Erro na IA:', err);
        throw err;
    }
}

async function analyzeGrammarWithAI(sentence) {
    try {
        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um Motor de Análise Linguística especializado em processar segmentos de legendas de vídeo em QUALQUER IDIOMA. Forneça análise detalhada e contextualizada focada em:

REGRA FUNDAMENTAL: Mantenha TODAS as palavras, exemplos e estruturas no IDIOMA ORIGINAL da legenda. Explique SEMPRE em português brasileiro.

- Decomposição de frases (estrutura, ordem, conexões)
- Colocações e chunks (combinações naturais de palavras)
- Diferenciação de sinônimos/antônimos (nuances de uso)
- Gramática aplicada (apenas quando relevante ao contexto)
- Nuances culturais e idiomáticas
- Vocabulário chave contextualizado

Tom: Informativo, objetivo, conciso. Sempre em português brasileiro.`
                    },
                    {
                        role: 'user',
                        content: `Segmento de legenda: "${sentence}"

⚠️ IMPORTANTE: A frase está no IDIOMA ORIGINAL da legenda. Mantenha TODAS as palavras, exemplos e estruturas nesse IDIOMA. Explique em PORTUGUÊS.

Forneça análise linguística completa:

1. 🎯 **Tradução Natural**
   - Como um nativo brasileiro diria em português
   - Mantenha o tom e registro do original

2. 🔍 **Elementos Linguísticos Detectados**
   - Liste TODOS no IDIOMA ORIGINAL: phrasal verbs, slangs, idioms, colocações
   - Para cada um: palavra/expressão no IDIOMA ORIGINAL + tradução em português + explicação de uso
   - Identifique chunks no IDIOMA ORIGINAL (blocos de linguagem usados juntos)
   - Formato: "Phrase in original language" = tradução (explicação)

3. 📝 **Decomposição da Frase**
   - Estrutura: sujeito, verbo, objeto, modificadores (identifique no IDIOMA ORIGINAL)
   - Ordem das palavras no IDIOMA ORIGINAL e como os elementos se conectam
   - Tempo verbal no IDIOMA ORIGINAL e por que foi usado aqui (explique em português)
   - Função de cada parte na construção do significado

4. 🔑 **Vocabulário Chave**
   - 3-4 palavras/expressões mais importantes no IDIOMA ORIGINAL
   - Para cada: palavra no IDIOMA ORIGINAL, tradução, colocações naturais no IDIOMA ORIGINAL, nuances de uso
   - Diferenciação de sinônimos no IDIOMA ORIGINAL (por que essa palavra específica?)
   - Formato: "Word in original language" = tradução (colocações: "collocation 1", "collocation 2")

5. 🌟 **Padrão Reutilizável**
   - Estrutura no IDIOMA ORIGINAL que pode ser reutilizada: [subject] + [verb] + [complement]
   - 2 exemplos práticos no IDIOMA ORIGINAL com tradução
   - Quando usar esse padrão (explique em português)
   - Formato: "Example in original language" → Tradução em português

6. 🌍 **Contexto Cultural**
   - Expressões idiomáticas ou culturais presentes (no IDIOMA ORIGINAL)
   - Gírias ou linguagem informal (no IDIOMA ORIGINAL)
   - Registro (formal/informal/técnico) - explique em português

7. 🇧🇷 **Armadilhas para Brasileiros**
   - Falsos cognatos
   - Diferenças estruturais entre o idioma original e português
   - Erros comuns de tradução literal
   - Nuances que brasileiros costumam perder`
                    }
                ],
                temperature: 0.7,
                max_tokens: 900
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erro na API Groq');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
    } catch (err) {
        console.error('[LinguaFlow SW] Erro na análise gramatical:', err);
        throw err;
    }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function updateBadge() {
    chrome.storage.local.get(['lf_stats'], result => {
        if (result.lf_stats?.dueToday > 0) {
            chrome.action.setBadgeText({ text: String(result.lf_stats.dueToday) });
            chrome.action.setBadgeBackgroundColor({ color: '#38BDF8' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
}
setInterval(updateBadge, 5 * 60 * 1000);
updateBadge();

function notifyDashboards(word) {
    console.log('[LinguaFlow SW] 📢 Notificando dashboards sobre nova palavra:', word);
    
    // 1. Broadcast via runtime.sendMessage (para todas as páginas da extensão)
    chrome.runtime.sendMessage({
        type: 'REFRESH_VOCAB',
        word: word || null
    }).catch(() => {
        console.log('[LinguaFlow SW] Runtime message falhou (esperado se nenhuma página está ouvindo)');
    });

    // 2. Envia para TODAS as abas abertas (incluindo dashboards)
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            // Envia para dashboards
            if (tab.url?.includes('dashboard.html')) {
                chrome.tabs.sendMessage(tab.id, { 
                    type: 'REFRESH_VOCAB',
                    word: word || null
                }).catch(() => {
                    console.log(`[LinguaFlow SW] Não foi possível enviar para tab ${tab.id}`);
                });
            }
            
            // Envia para content scripts (para atualizar cores das palavras)
            if (tab.url?.includes('youtube.com') || 
                tab.url?.includes('netflix.com') || 
                tab.url?.includes('max.com') ||
                tab.url?.includes('disneyplus.com') ||
                tab.url?.includes('primevideo.com')) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'WORD_SAVED',
                    word: word || null
                }).catch(() => {});
            }
        });
    });
    
    // 3. Atualiza chrome.storage.local para trigger storage.onChanged
    chrome.storage.local.get(['lf_last_update'], result => {
        chrome.storage.local.set({
            lf_last_update: Date.now(),
            lf_last_word: word || null
        });
    });
    
    console.log('[LinguaFlow SW] ✅ Notificações enviadas via 3 canais');
}

// ── Limpa cache do Linguee com encoding errado ────────────────────────────────
function clearBadLingueeCache() {
    chrome.storage.local.get(null, items => {
        const keysToRemove = [];
        for (const key of Object.keys(items)) {
            if (key.startsWith('linguee_')) {
                const value = items[key];
                // Remove se: tem caractere de substituição (encoding errado), ou é muito antigo
                const html = value?.html || '';
                const hasBadEncoding = html.includes('\uFFFD') ||
                    // Padrão típico de latin-1 mal decodificado: ã → Ã£, é → Ã©, etc.
                    /[À-ÿ]{2,}/.test(html);
                const isTooOld = value?.ts && (Date.now() - value.ts) > 30 * 24 * 60 * 60 * 1000;
                
                if (hasBadEncoding || isTooOld) {
                    keysToRemove.push(key);
                }
            }
        }
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
            console.log(`[LinguaFlow SW] Removidos ${keysToRemove.length} caches do Linguee com encoding errado`);
        }
    });
}

// Limpa cache com encoding errado na inicialização do service worker
clearBadLingueeCache();

// ── Backup Automático ─────────────────────────────────────────────────────────
async function runAutoBackup() {
    try {
        const db = await openExtensionDB();
        const stores = ['words', 'cards', 'decks', 'known_words'];
        const data = {};

        await Promise.all(stores.map(name => new Promise((resolve) => {
            const req = db.transaction(name, 'readonly').objectStore(name).getAll();
            req.onsuccess = () => { data[name] = req.result; resolve(); };
            req.onerror = () => { data[name] = []; resolve(); };
        })));

        // Só faz backup se tiver palavras
        if (!data.words || data.words.length === 0) return;

        const backup = {
            version: 2,
            exportedAt: new Date().toISOString(),
            autoBackup: true,
            wordCount: data.words.length,
            db: data
        };

        // Salva no chrome.storage.local (até 10MB)
        chrome.storage.local.set({
            'lf_auto_backup': backup,
            'lf_auto_backup_date': Date.now()
        });

        console.log(`[LinguaFlow SW] Backup automático: ${data.words.length} palavras salvas`);
    } catch (e) {
        console.error('[LinguaFlow SW] Erro no backup automático:', e);
    }
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
async function openExtensionDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('words')) {
                const s = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_lang', ['word', 'lang'], { unique: true });
                s.createIndex('deck_id', 'deck_id', { unique: false });
            }
            if (!db.objectStoreNames.contains('cards')) {
                const s = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_id', 'word_id', { unique: true });
                s.createIndex('due_date', 'due_date', { unique: false });
                s.createIndex('status', 'status', { unique: false });
            }
            if (!db.objectStoreNames.contains('decks'))
                db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains('known_words'))
                db.createObjectStore('known_words', { keyPath: ['word', 'lang'] });
            if (!db.objectStoreNames.contains('sessions'))
                db.createObjectStore('sessions', { keyPath: 'date' });
            if (!db.objectStoreNames.contains('settings'))
                db.createObjectStore('settings', { keyPath: 'key' });
        };

        request.onsuccess = e => resolve(e.target.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveWordToExtensionDB(wordData) {
    const db = await openExtensionDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['words', 'cards', 'decks'], 'readwrite');
        const wordsStore = tx.objectStore('words');
        const cardsStore = tx.objectStore('cards');
        const decksStore = tx.objectStore('decks');

        // Garante deck default
        const deckId = wordData.deck_id || 1;
        decksStore.get(deckId).onsuccess = e => {
            if (!e.target.result)
                decksStore.put({ id: deckId, name: 'Default Deck', created_at: Date.now() });
        };

        const checkReq = wordsStore.index('word_lang').get([wordData.word, wordData.lang]);
        checkReq.onsuccess = () => {
            if (checkReq.result) {
                wordData.id = checkReq.result.id;
                wordData.added_at = checkReq.result.added_at;
            } else {
                wordData.added_at = Date.now();
            }

            const wordReq = wordsStore.put(wordData);
            wordReq.onsuccess = e => {
                const wordId = e.target.result;
                if (!checkReq.result) {
                    cardsStore.put({
                        word_id: wordId,
                        interval: 0,
                        ease_factor: 2.5,
                        due_date: Date.now(),
                        reps: 0,
                        lapses: 0,
                        status: 'new'
                    });
                }
                resolve(wordId);
            };
            wordReq.onerror = () => reject(wordReq.error);
        };
        checkReq.onerror = () => reject(checkReq.error);
        tx.onerror = () => reject(tx.error);
    });
}

// ── Backup Completo ───────────────────────────────────────────────────────────
async function createFullBackup() {
    const db = await openExtensionDB();
    const stores = ['words', 'cards', 'decks', 'known_words', 'sessions', 'settings'];
    const data = {};

    await Promise.all(stores.map(name => new Promise((resolve, reject) => {
        const req = db.transaction(name, 'readonly').objectStore(name).getAll();
        req.onsuccess = () => { data[name] = req.result; resolve(); };
        req.onerror = () => reject(req.error);
    })));

    const [syncData, localData] = await Promise.all([
        new Promise(r => chrome.storage.sync.get(null, r)),
        new Promise(r => chrome.storage.local.get(null, r))
    ]);

    // Remove caches do backup
    const localFiltered = Object.fromEntries(
        Object.entries(localData).filter(([k]) => !k.startsWith('linguee_') && !k.startsWith('reverso_'))
    );

    return {
        version: 2,
        exportedAt: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        db: data,
        storage: { sync: syncData, local: localFiltered }
    };
}

async function restoreFullBackup(backup) {
    if (!backup?.version) throw new Error('Backup inválido.');
    const db = await openExtensionDB();
    const stores = ['words', 'cards', 'decks', 'known_words', 'sessions', 'settings'];

    for (const name of stores) {
        const records = backup.db?.[name];
        if (!Array.isArray(records)) continue;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(name, 'readwrite');
            const store = tx.objectStore(name);
            store.clear();
            records.forEach(r => store.put(r));
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    if (backup.storage?.sync)
        await new Promise(r => chrome.storage.sync.set(backup.storage.sync, r));
    if (backup.storage?.local)
        await new Promise(r => chrome.storage.local.set(backup.storage.local, r));
}

async function explainQuickContext(word, sentence) {
    try {
        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROK_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um professor de inglês brasileiro. Responda SEMPRE em português de forma CURTA e DIRETA.`
                    },
                    {
                        role: 'user',
                        content: `Palavra: "${word}"\nFrase: "${sentence}"\n\nEm 1-2 linhas CURTAS, explique o que "${word}" significa NESTA frase. Seja direto e prático. NÃO use emojis.`
                    }
                ],
                temperature: 0.5,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erro na API Groq');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (err) {
        console.error('[LinguaFlow SW] Erro na explicação contextual:', err);
        throw err;
    }
}
