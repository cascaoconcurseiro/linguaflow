// background/service-worker.js
import { db } from '../utils/db.js';
import { translator } from '../utils/translator.js';

// Garbage Collector para limpar dicionários velhos e liberar espaço (QuotaExceeded)
function _sweepStaleCache() {
  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const keysToRemove = [];
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith('linguee_') || key.startsWith('reverso_')) {
        // Remove se for mais velho que 7 dias (7 * 24 * 60 * 60 * 1000 = 604800000ms)
        if (value.ts && now - value.ts > 604800000) {
          keysToRemove.push(key);
        }
      }
    }
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.debug(`[LinguaFlow] GC: Limpos ${keysToRemove.length} itens obsoletos do cache.`);
      });
    }
  });
}
// Roda o limpador sempre que o Service Worker inicializa
_sweepStaleCache();

console.debug('LinguaFlow: Service Worker inicializado.');

// ── Alarmes ──────────────────────────────────────────────────────────────────
chrome.alarms.create('srs-reminder', { periodInMinutes: 60 });
chrome.alarms.create('auto-backup', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'srs-reminder') updateBadge();
  if (alarm.name === 'auto-backup') runAutoBackup();
});

// ── Instalação ───────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ nativeLang: 'pt', targetLangs: ['en'] });
  chrome.contextMenus.create({
    id: 'linguaflow-save',
    title: 'Salvar no LinguaFlow',
    contexts: ['selection'],
  });
  clearBadLingueeCache();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'linguaflow-save') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'openWordPopup',
      payload: { word: info.selectionText.trim() },
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
      (async () => {
        try {
          // Auto-classify word category on saveWord using AI (with static fallback)
          if (method === 'saveWord' && args && args[0] && !args[0].category) {
            try {
              args[0].category = await classifyWordAI(args[0].word || '');
            } catch (e) {
              console.warn('[LinguaFlow SW] Classificação de IA falhou, usando estática.', e);
              args[0].category = classifyWordStatic(args[0].word || '');
            }
          }

          const result = await Promise.resolve(db[method](...(args || [])));

          const writeMethods = [
            'saveWord',
            'updateWord',
            'updateCard',
            'logReview',
            'createDeck',
            'saveSentence',
            'deleteWord',
            'deleteDeck',
            'markAsKnown',
          ];
          if (writeMethods.includes(method)) {
            notifyDashboards(args[0]?.word || null);
            updateBadge();
            
            // Auto-trigger backfill se for saveWord
            if (method === 'saveWord') {
              setTimeout(backfillMissingSentences, 2000);
            }
          }
          sendResponse({ result });
        } catch (error) {
          console.error(`[LinguaFlow SW] Erro em db.${method}:`, error);
          sendResponse({ error: error?.message || String(error) });
        }
      })();
      return true;
    }
  }

  // Tradução de texto (Usando utilitário Translator com Cache multinível)
  if (request.action === 'translate') {
    const { text, from, to } = request;
    translator
      .translate(text, from, to)
      .then((result) => sendResponse({ translation: result.translation, source: result.source }))
      .catch((err) => sendResponse({ translation: null, error: err.message }));
    return true;
  }

  // Dicionário (Oxford/DictionaryAPI)
  if (request.action === 'dictionary') {
    const { word } = request;
    fetchDictionary(word)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Geração de Variações AI (Pilar 3: Motor Infinito)
  if (request.action === 'lf_generate_variation') {
    const { word, sentence } = request;
    generateAIVariation(word, sentence)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
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
      .then((explanation) => sendResponse({ explanation }))
      .catch((err) => sendResponse({ explanation: null, error: err.message }));
    return true;
  }

  // Transliteração fonética PT-BR com IA
  if (request.action === 'ai_phonetic_pt') {
    getPTPhoneticWithAI(request.word)
      .then((pronunciation) => sendResponse({ pronunciation }))
      .catch((err) => sendResponse({ pronunciation: null, error: err.message }));
    return true;
  }

  // Explicação super curta para a história (LingQ style)
  if (request.action === 'ai_explain_story_word') {
    const contextStr = request.context || 'sem contexto';
    const prompt = `Traduza de forma DIRETA a palavra/expressão "${request.word}" usada no contexto: "${contextStr}".
Regras:
1. Responda em Português Brasileiro.
2. Formato OBRIGATÓRIO de duas linhas:
Tradução: [Apenas a tradução direta para este contexto]
Sentido: [Uma única frase super curta explicando o sentido neste contexto]
3. NENHUM texto adicional.`;

    explainWordWithAI(request.word, contextStr, prompt)
      .then((explanation) => sendResponse({ explanation }))
      .catch((err) => sendResponse({ explanation: null, error: err.message }));
    return true;
  }

  // Gerador de Chunks com IA (Inglês, Tradução, Fonética Brasileira)
  if (request.action === 'ai_generate_chunks') {
    const { word } = request;
    generateChunksWithAI(word)
      .then((chunks) => sendResponse({ chunks }))
      .catch((err) => sendResponse({ chunks: null, error: err.message }));
    return true;
  }

  // Explicação de frase com IA (Foco em intenção e fluxo)
  if (request.action === 'ai_explain_sentence') {
    const { sentence, fullContext } = request;
    explainSentenceWithAI(sentence, fullContext)
      .then((analysis) => sendResponse({ analysis }))
      .catch((err) => sendResponse({ analysis: null, error: err.message }));
    return true;
  }

  // Explicação contextual rápida (1-2 linhas)
  if (request.action === 'ai_quick_context') {
    const { word, sentence } = request;
    explainQuickContext(word, sentence)
      .then((explanation) => sendResponse({ explanation }))
      .catch((err) => sendResponse({ explanation: null, error: err.message }));
    return true;
  }

  // Geração de frase de exemplo com IA
  if (request.action === 'ai_generate_sentence') {
    generateSentenceWithAI(request.word)
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ sentence: null, translation: null, error: err.message }));
    return true;
  }

  // Geração de Histórias
  if (request.action === 'ai_generate_story') {
    generateStoryWithAI(request.genre)
      .then((data) => sendResponse(data)) // { story, level }
      .catch((err) => sendResponse({ story: null, level: null, error: err.message }));
    return true;
  }

  // Chat genérico com a IA (tutor de gramática do dashboard).
  // Passa pelo getApiConfig: respeita BYOK e o proxy seguro (Edge Function).
  if (request.action === 'ai_chat') {
    aiChatPassthrough(request.messages, request.options || {})
      .then((content) => sendResponse({ content }))
      .catch((err) => sendResponse({ content: null, error: err.message }));
    return true;
  }

  if (request.type === 'FETCH_TTS') {
    fetch(request.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        sendResponse({ success: true, dataUrl: `data:audio/mp3;base64,${b64}` });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'FETCH_LINGUEE') {
    const word = request.word;
    const cacheKey = `linguee_${word}`;
    chrome.storage.local.get([cacheKey], (stored) => {
      if (stored[cacheKey] && Date.now() - stored[cacheKey].ts < 7 * 24 * 60 * 60 * 1000) {
        sendResponse({ success: true, html: stored[cacheKey].html, fromCache: true });
        return;
      }
      fetch(
        `https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodeURIComponent(word)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            Referer: 'https://www.linguee.com.br/',
          },
        },
      )
        .then((r) => r.arrayBuffer())
        .then((buffer) => {
          let html;
          try {
            const utf8 = new TextDecoder('utf-8').decode(buffer);
            if (utf8.includes('\uFFFD')) html = new TextDecoder('iso-8859-1').decode(buffer);
            else html = utf8;
          } catch {
            html = new TextDecoder('iso-8859-1').decode(buffer);
          }
          const hasExamples = html.includes('class="example"') || html.includes('tag_s');
          if (hasExamples) chrome.storage.local.set({ [cacheKey]: { html, ts: Date.now() } });
          sendResponse({ success: true, html });
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (request.type === 'FETCH_REVERSO') {
    const word = request.word;
    const cacheKey = `reverso_${word}`;
    chrome.storage.local.get([cacheKey], async (stored) => {
      if (stored[cacheKey] && Date.now() - stored[cacheKey].ts < 7 * 24 * 60 * 60 * 1000) {
        sendResponse({ success: true, list: stored[cacheKey].list, fromCache: true });
        return;
      }
      try {
        // Mapeamento de idiomas para o corpus do Reverso (ex: en -> eng, pt -> por)
        const langMap = { en: 'eng', pt: 'por', es: 'spa', fr: 'fra', it: 'ita', de: 'ger' };
        const src = langMap[request.srcLang] || 'eng';
        const dst = langMap[request.dstLang] || 'por';
        const corpus = `${src}-${dst}`;

        const res = await fetch('https://context.reverso.net/bst-query-service', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Origin: 'https://context.reverso.net',
            Referer: 'https://context.reverso.net/translation/',
          },
          body: JSON.stringify({
            source_lang: request.srcLang || 'en',
            target_lang: request.dstLang || 'pt',
            source_text: word,
            corpus: corpus,
            npage: 1,
            mode: 0,
          }),
        });
        if (!res.ok) throw new Error(`Reverso error: ${res.status}`);
        const data = await res.json();
        const list = (data.list || [])
          .map((item) => ({
            en: item.s_text?.replace(/<[^>]+>/g, '') || '',
            pt: item.t_text?.replace(/<[^>]+>/g, '') || '',
          }))
          .filter((x) => x.en && x.pt);

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
    db.getAllWords()
      .then((words) => {
        const known = {};
        words.forEach((w) => (known[w.word.toLowerCase()] = w.status));
        sendResponse({ known });
      })
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'lf_get_all_known_words') {
    db.getAllWords()
      .then((words) => {
        // Retorna o objeto completo da palavra, incluindo word e translation
        sendResponse(words);
      })
      .catch((err) => {
        console.error('[LinguaFlow] Error fetching words:', err);
        sendResponse([]);
      });
    return true;
  }

  return false;
});

// ── Classificador de Categoria de Palavras ────────────────────────────────
/**
 * Classifica automaticamente uma palavra/expressão em uma categoria (versão estática).
 * Categorias: 'phrasal_verb' | 'idiom' | 'slang' | 'word'
 */
function classifyWordStatic(word) {
  if (!word || typeof word !== 'string') return 'word';
  const w = word.toLowerCase().trim();
  const parts = w.split(/\s+/);

  if (parts.length > 4) {
    const idiomMarkers = ['kick the', 'bite the', 'break a', 'hit the', 'bite off', 'cost an arm', 'piece of cake', 'under the weather', 'beat around', 'let the cat', 'once in a blue', 'the ball is', 'spill the beans', 'rule of thumb', 'on the fence', 'blessing in disguise'];
    for (const marker of idiomMarkers) {
      if (w.includes(marker)) return 'idiom';
    }
    return 'sentence';
  }

  // Phrasal verbs: 2+ palavras onde a última é uma partícula comum
  const phrasalParticles = ['up','out','in','off','on','away','back','down','over','through','into','around','along','apart','aside','forward','out','away'];
  if (parts.length >= 2) {
    const lastWord = parts[parts.length - 1];
    if (phrasalParticles.includes(lastWord)) return 'phrasal_verb';
    // Também verificar a segunda palavra se for 3 palavras
    if (parts.length === 3 && phrasalParticles.includes(parts[1])) return 'phrasal_verb';
  }

  // Idioms: expressões com palavras de conexão que formam figurações
  const idiomMarkers = ['kick the', 'bite the', 'break a', 'hit the', 'bite off', 'cost an arm', 'piece of cake', 'under the weather', 'beat around', 'let the cat', 'once in a blue', 'the ball is', 'spill the beans', 'rule of thumb', 'on the fence', 'blessing in disguise'];
  for (const marker of idiomMarkers) {
    if (w.includes(marker)) return 'idiom';
  }

  // Gírias: palavras/expressões informais comuns
  const slangWords = ['gonna','wanna','gotta','kinda','sorta','ain\'t','y\'all','dunno','lemme','gimme','nope','yep','dude','bro','lit','vibe','legit','sketchy','lowkey','highkey','fomo','tldr','fyi','omg','lol','bruh','bestie','slay','ghosting','flex','goat','salty','extra','basic','stan','ship','tea','woke','receipts','mood','thirsty','triggered','bussin'];
  if (slangWords.includes(w)) return 'slang';

  // Multi-word expressions que não são phrasal verbs
  if (parts.length >= 2) return 'idiom';

  return 'word';
}

/**
 * Classificador IA (Pilar: Inteligência Automática)
 */
async function classifyWordAI(word) {
  if (!word) return 'word';
  const config = await getApiConfig();
  if (!config.apiKey) return classifyWordStatic(word);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // Fast timeout

  const prompt = `Classifique a seguinte expressão em inglês em EXATAMENTE UMA destas 4 categorias: 'idiom', 'phrasal_verb', 'slang', 'word'.
Responda APENAS com a categoria, sem pontuação ou texto extra.
Expressão: "${word}"`;

  try {
    let responseText = '';
    
      const res = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    
    clearTimeout(timeoutId);

    const cat = responseText.toLowerCase().replace(/[^a-z_]/g, '');
    const valid = ['idiom', 'phrasal_verb', 'slang', 'word'];
    if (valid.includes(cat)) return cat;
    return classifyWordStatic(word);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[LinguaFlow AI] Error classifyWordAI:', err);
    return classifyWordStatic(word);
  }
}

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
    antonyms: [],
  };
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) return emptyResult;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return emptyResult;

    const entry = data[0];
    let audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || '';
    if (audioUrl && audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;

    return {
      word: entry.word || word,
      phonetic: entry.phonetic || '',
      audioUrl,
      partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
      definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
      example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
      synonyms: entry.meanings?.[0]?.synonyms || [],
      antonyms: entry.meanings?.[0]?.antonyms || [],
    };
  } catch (err) {
    console.error('[LinguaFlow] Dictionary Fetch Error:', err);
    return emptyResult;
  }
}

// ── Funções de IA (Grok) ──────────────────────────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 3) {
  let retries = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Only retry on rate limit (429) or server errors (5xx)
      if ([429, 500, 502, 503, 504].includes(response.status) && retries < maxRetries) {
        retries++;
        const backoffMs = Math.pow(2, retries - 1) * 1000;
        console.warn(
          `[LinguaFlow] AI API error ${response.status}. Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError' || retries >= maxRetries) throw error;
      retries++;
      const backoffMs = Math.pow(2, retries - 1) * 1000;
      console.warn(
        `[LinguaFlow] AI API network error. Retrying in ${backoffMs}ms... (Attempt ${retries}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

async function getApiConfig() {
  let userKey = '';
  try {
    const stored = await chrome.storage.local.get(['aiApiKey']);
    userKey = stored?.aiApiKey || '';
  } catch (e) {}

  // BYOK: usuário com chave própria fala direto com o DeepSeek (não gasta a cota compartilhada)
  if (userKey.trim()) {
    return {
      provider: 'deepseek',
      mode: 'byok',
      apiKey: userKey.trim(),
      apiUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat'
    };
  }

  // Sem chave própria: proxy seguro (Edge Function) autenticado com o token de sessão.
  // A chave DeepSeek compartilhada vive só no servidor (Supabase Secrets).
  const sessionToken = await db._getToken();
  return {
    provider: 'deepseek',
    mode: 'proxy',
    apiKey: sessionToken || '',
    apiUrl: 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/deepseek-chat',
    model: 'deepseek-chat'
  };
}

async function getBasePersona() {
  const cefr = await db.getSetting('lf_cefr_level');
  let cefrInstruction = '';
  if (cefr) {
    cefrInstruction = `\n[NÍVEL DO ALUNO: ${cefr}]\nO aluno possui nível CEFR ${cefr}. Adapte o vocabulário e a didática para este nível.\n`;
  }
  return `Você é o tutor amigável e descontraído do LinguaFlow, inspirado no Duolingo. Sua linguagem é super didática, amigável, encorajadora e NADA robótica.
Seu objetivo é fazer o aluno entender o sentido do termo na frase e como usá-lo na vida real, de forma leve e rápida.
${cefrInstruction}
DIRETRIZES DE OURO:
- Responda de forma direta e curta. Nada de textões ou jargões gramaticais chatos.
- Converse com o usuário de forma calorosa. Seja encorajador.
- Use formatação Markdown (Negrito, Itálico) para destacar as partes importantes, mas não exagere.
- Se for phrasal verb, chunk ou gíria, diga para aprender o bloco inteiro em vez de traduzir palavra por palavra.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA (Use exatamente esses títulos em negrito, sem adicionar outros. Apenas os títulos e as respostas abaixo de cada um):

**A ideia aqui:** Em 1 ou 2 frases curtas, explique o que a palavra/expressão significa NESTE contexto específico. Como se explicasse para um amigo.

**O truque:** Compare rapidamente com o sentido isolado ou literal (se houver diferença), ou dê uma dica de uso (ex: "é super informal", "use no trabalho").

**Pronúncia da vida real:** Escreva como um brasileiro leria rápido, usando letras do português (ex: "water" -> "uó-râr", "I got it" -> "ai-gá-ret"). Nada de símbolos fonéticos IPA complexos. Destaque a sílaba tônica.

**Exemplos rápidos:**
- [Inglês] (Tradução)
- [Inglês] (Tradução)`;
}

async function getPTPhoneticWithAI(word) {
  if (!word) return '';
  const cleanWord = word.toLowerCase().trim();
  const cacheKey = `pt_phonetic_${cleanWord}`;

  try {
    const cached = await db.getSetting(cacheKey).catch(() => null);
    if (cached) return cached;

    const config = await getApiConfig();
    if (!config.apiKey) {
      console.warn('[LinguaFlow] Sem sessão nem API key. Não é possível gerar transliteração PT-BR.');
      return '';
    }

    const prompt = `Retorne APENAS a transliteração fonética de como um BRASILEIRO leria a palavra em inglês "${word}" para soar o mais nativo possível (exemplo: apple -> á-pou, though -> dôu, write -> ruáit). Regras:
- Retorne APENAS a transliteração.
- NÃO inclua aspas, pontuação, hífens sobrando ou textos explicativos.
- Use acentos do português (á, é, í, ó, ú, â, ê, ô) para indicar a sílaba tônica.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let responseText = '';
    
      const res = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || '';
    

    const transliteration = responseText.replace(/['"]/g, '').trim().toLowerCase();
    if (transliteration) {
      db.setSetting(cacheKey, transliteration).catch(() => {});
    }
    return transliteration;
  } catch (err) {
    console.error('[LinguaFlow] AI Phonetic Error:', err);
    return '';
  }
}

async function explainWordWithAI(word, context, customPrompt = null) {
  try {
    if (!word) return 'Nenhuma palavra fornecida.';
    const prompt =
      customPrompt ||
      `Termo selecionado: "${word}"
Frase/contexto: "${context || 'sem contexto'}"

Gere a explicação amigável seguindo a estrutura obrigatória (A ideia aqui, O truque, Pronúncia da vida real, Exemplos rápidos).`;

    const config = await getApiConfig();
    if (!config.apiKey)
      return 'Faça login no LinguaFlow para usar a IA (ou configure uma chave de API própria nas Configurações).';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                (await getBasePersona()) +
                '\nFOCO: sentido contextual primeiro; dicionário isolado só como comparação.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Erro API (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar explicação.';
  } catch (err) {
    console.error('[LinguaFlow IA] Erro:', err);
    throw err;
  }
}

async function aiChatPassthrough(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('Mensagens vazias.');
  const config = await getApiConfig();
  if (!config.apiKey) throw new Error('Faça login no LinguaFlow (ou configure sua API Key própria).');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const response = await fetchWithRetry(config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.6,
      max_tokens: Math.min(Number(options.max_tokens) || 800, 1200),
    }),
  });

  clearTimeout(timeoutId);
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Erro API (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('IA não retornou conteúdo.');
  return content;
}

async function generateChunksWithAI(word) {
  try {
    if (!word) return [];
    const config = await getApiConfig();
    if (!config.apiKey) throw new Error('Faça login no LinguaFlow (ou configure sua API Key própria).');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const chunksPersona = `Você é um professor de inglês para brasileiros focando no aprendizado por 'chunks' (blocos léxicos).
Seu objetivo é criar 3 frases curtas e muito úteis do dia a dia contendo a palavra ou expressão fornecida.

Para cada frase (chunk), você deve fornecer:
1. "eng": A frase em inglês.
2. "pt": A tradução natural para português brasileiro.
3. "phon": A pronúncia da frase inteira usando EXCLUSIVAMENTE 'Fonética Brasileira' (Inglês escrito como se fala em português).
REGRAS CRÍTICAS PARA "phon":
- NUNCA traduza nenhuma palavra para o português no meio da pronúncia (ex: NUNCA use "deve" para "should", use "xud").
- NUNCA use símbolos do Alfabeto Fonético Internacional (AFI/IPA) como ə, ʌ, ɔ, ʃ, θ. Use apenas letras comuns do alfabeto português.
- Exemplo: "I think you should call her" -> "Ai fink iú xud cól râr".
- Dê bastante ênfase (acentuação) na sílaba tônica.

Responda ÚNICA E EXCLUSIVAMENTE com um objeto JSON válido contendo uma chave "chunks" que guarda o array com os 3 objetos. Nada de texto antes ou depois.
Exemplo de formato esperado:
{
  "chunks": [
    { "eng": "I want to go", "pt": "Eu quero ir", "phon": "Ai uánt tchu gou" }
  ]
}`;

    const userPrompt = `Gere os 3 chunks para a palavra/expressão: "${word}"`;

    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: chunksPersona },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Erro API (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    let content = '';
    
      content = data.choices?.[0]?.message?.content || '';
    

    // Limpa possíveis formatações markdown de código
    content = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      // Se for um objeto com uma propriedade de array
      const firstKey = Object.keys(parsed)[0];
      if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
      return [];
    } catch (e) {
      console.error('Falha ao parsear JSON dos chunks:', content);
      return [];
    }
  } catch (err) {
    console.error('[LinguaFlow IA] Erro ao gerar chunks:', err);
    throw err;
  }
}

async function analyzeGrammarWithAI(sentence) {
  try {
    if (!sentence) return 'Frase vazia.';
    const config = await getApiConfig();
    if (!config.apiKey) throw new Error('Faça login no LinguaFlow (ou configure sua API Key própria).');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const grammarPersona = `Atue como um professor de inglês paciente, claro e direto.
Seu objetivo é ajudar o aluno a entender o USO REAL da expressão ou palavra na frase, sem parecer resposta robótica.

DIRETRIZES ABSOLUTAS:
- Responda em Português Brasileiro.
- Seja curto, didático e humano.
- Não use aula genérica de gramática.
- Foque no sentido da frase, no bloco de palavras e em como usar depois.
- Se houver phrasal verb, chunk, idiom, gíria ou colocação, explique o bloco inteiro.
- Use EXATAMENTE os títulos em negrito abaixo.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA:
**Nesta frase:** Explique em 1 frase o sentido real.

**Bloco importante:** Mostre qual parte deve ser memorizada junta.

**Não confunda com:** Mostre a armadilha de tradução, se existir.

**Use assim:** Dê 2 exemplos curtos em inglês com tradução.`;

    const userPrompt = `Analise detalhadamente a gramática desta frase: "${sentence}"`;

    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: grammarPersona },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);
    const data = await response.json();

    
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
  } catch (err) {
    throw err;
  }
}

async function explainSentenceWithAI(sentence, fullContext = null) {
  try {
    if (!sentence) return 'Frase vazia.';
    const config = await getApiConfig();
    if (!config.apiKey) throw new Error('Faça login no LinguaFlow (ou configure sua API Key própria).');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let contextInfo = '';
    if (fullContext) {
      contextInfo = `
            DIÁLOGO AO REDOR:
            Frase Anterior: "${fullContext.prev}"
            Frase Atual (em foco): "${fullContext.current}"
            Próxima Frase: "${fullContext.next}"

            ⚠️ IMPORTANTE: Explique a "Frase Atual" considerando o fluxo do diálogo.
            Se houver pronomes (it, that, they) ou referências, aponte a quem se referem no diálogo acima.`;
    }

    const systemPrompt =
      (await getBasePersona()) +
      '\nFOCO: Na intenção real, emoção, referências contextuais e fluxo do diálogo.';
    const userPrompt = contextInfo || `Explique a intenção desta frase: "${sentence}"`;

    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);
    const data = await response.json();

    
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
  } catch (err) {
    throw err;
  }
}

async function explainQuickContext(word, sentence) {
  try {
    const config = await getApiConfig();
    if (!config.apiKey) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // contexto rápido

    const systemPrompt =
      'Você é um professor particular de inglês focado em contexto. Responda em português brasileiro, curto e natural.';
    const userPrompt = `Termo selecionado: "${word}"
Frase/contexto: "${sentence}"

Responda em 1 frase curta. Diga o sentido nesta frase. Se o termo isolado costuma significar outra coisa, acrescente uma comparação breve. Se for phrasal verb/chunk/gíria/idiom, explique o bloco inteiro, sem lista.`;

    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.35,
          max_tokens: 500,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('Erro na IA (Contexto Rápido):', err);
    return null;
  }
}

// ============================================================================
// GERADOR DE FRASE DE EXEMPLO COM IA
// ============================================================================
async function generateSentenceWithAI(word) {
  try {
    if (!word) return null;
    const systemPrompt = `Você é um professor de inglês nativo criando material didático.
Crie UMA única frase curta e natural em inglês usando a palavra/expressão: "${word}".
A frase deve ser de nível iniciante/intermediário e fácil de entender o contexto.
Logo na linha de baixo, forneça a tradução exata em português brasileiro.
Retorne EXATAMENTE neste formato (e nada mais):
Frase: [frase em inglês]
Tradução: [tradução em português]`;

    const config = await getApiConfig();
    if (!config.apiKey) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    if (true) {
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: systemPrompt }],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });
    }

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    let text = '';
    
      text = data.choices?.[0]?.message?.content || '';
    

    text = text.trim();
    if (!text) return null;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let sentence = '';
    let translation = '';
    
    for (const line of lines) {
      if (line.toLowerCase().startsWith('frase:')) {
        sentence = line.replace(/^(frase:|\*\*frase:\*\*|frase:)\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('tradução:')) {
        translation = line.replace(/^(tradução:|\*\*tradução:\*\*|tradução:)\s*/i, '').trim();
      }
    }
    
    if (sentence) {
      return { sentence, translation };
    }
    return null;

  } catch (err) {
    console.error('Erro na IA:', err);
    return { sentence: 'Error generating sentence.', translation: 'Erro ao gerar frase.' };
  }
}

// Palavras do aluno pro REENCONTRO na história (Onda 1.4 — paridade com a web):
// fracas primeiro (3+ lapsos/leech), depois em aprendizado recente. Máx 8.
async function getReencounterWordsSW() {
  try {
    const [cards, words] = await Promise.all([db.getAllCards(), db.getAllWords()]);
    const wordById = {};
    words.forEach(w => { wordById[w.id] = w; });
    const nameOf = (c) => wordById[c.word_id]?.word;
    const weak = cards
      .filter(c => !c.suspended && ((c.lapses || 0) >= 3 || c.is_leech))
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
      .map(nameOf).filter(Boolean);
    const inProgress = cards
      .filter(c => !c.suspended && (c.status === 'learning' || c.status === 'review'))
      .sort((a, b) => new Date(b.last_review || 0) - new Date(a.last_review || 0))
      .map(nameOf).filter(Boolean);
    return [...new Set([...weak, ...inProgress])].slice(0, 8);
  } catch { return []; }
}

async function generateStoryWithAI(genre) {
  try {
    const cefr = await db.getSetting('lf_cefr_level') || 'B1';
    const config = await getApiConfig();
    if (!config.apiKey) {
      throw new Error('Faça login no LinguaFlow para gerar histórias (ou configure sua chave de API própria).');
    }

    const reencounter = await getReencounterWordsSW();
    const reencounterNote = reencounter.length
      ? `\nIMPORTANTE: incorpore NATURALMENTE ${Math.min(6, Math.max(4, reencounter.length))} destas palavras/expressões que o aluno está estudando (sem forçar, sem destacar, sem listar): ${reencounter.join(', ')}.`
      : '';

    const prompt = `Você é um gerador de histórias curtas para estudantes de inglês.
Nível do Estudante: CEFR ${cefr}.
Tema/Gênero da História: ${genre}.
${reencounterNote}
Por favor, escreva uma história curta (cerca de 200 a 300 palavras) em inglês, adequada para o nível ${cefr}.
A história deve conter vocabulário útil e natural, com frases bem construídas.
Não traduza a história. Apenas escreva a história em inglês, usando quebras de linha normais para parágrafos.
NÃO use formatação markdown, NÃO coloque um título, apenas o texto da história.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    let response;
    
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 1000,
        }),
      });
    

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    
    let text = '';
    
      text = data.choices?.[0]?.message?.content || '';
    
    
    return { story: text.trim(), level: cefr, requestedWords: reencounter };
  } catch (err) {
    console.error('Erro ao gerar história:', err);
    throw err;
  }
}

function notifyDashboards(word) {
  const msg = { type: 'REFRESH_VOCAB', word: word || null };
  // Envia para o Dashboard/Popup (contexto de extensão)
  chrome.runtime.sendMessage(msg).catch(() => {});

  // Envia para Content Scripts em todas as abas
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
}

function updateBadge() {
  db.getStats()
    .then((stats) => {
      const due = stats.dueCards || 0;
      chrome.action.setBadgeText({ text: due > 0 ? String(due) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Vermelho de alerta (Gamification)
      maybeNotifyDue(due);
    })
    .catch(() => {});
}

// Lembrete de revisão (Duolingo-style): no máximo 1 notificação a cada 20h,
// e só quando há cards devidos de verdade.
async function maybeNotifyDue(due) {
  if (!due || due < 1 || !chrome.notifications) return;
  try {
    const { lf_last_notify } = await chrome.storage.local.get('lf_last_notify');
    if (lf_last_notify && Date.now() - lf_last_notify < 20 * 60 * 60 * 1000) return;
    await chrome.storage.local.set({ lf_last_notify: Date.now() });
    chrome.notifications.create('lf-due-reminder', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'LinguaFlow 🔥',
      message: `Você tem ${due} ${due === 1 ? 'card esperando' : 'cards esperando'}. 5 minutinhos salvam sua ofensiva!`,
      priority: 1,
    });
  } catch (e) {
    console.debug('[LinguaFlow] Notificação indisponível:', e?.message);
  }
}

chrome.notifications?.onClicked?.addListener((id) => {
  if (id === 'lf-due-reminder') {
    chrome.tabs.create({ url: 'https://linguaflow-web-tau.vercel.app/' });
    chrome.notifications.clear(id);
  }
});

function clearBadLingueeCache() {
  chrome.storage.local.get(null, (items) => {
    const keys = Object.keys(items).filter(
      (k) => k.startsWith('linguee_') && items[k].html?.includes('\uFFFD'),
    );
    if (keys.length) chrome.storage.local.remove(keys);
  });
}

async function runAutoBackup() {
  try {
    const words = await db.getAllWords();
    if (!words.length) return;
    const backup = { version: 4, exportedAt: new Date().toISOString(), db: { words } };
    chrome.storage.local.set({ lf_auto_backup: backup, lf_auto_backup_date: Date.now() });
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
    max_tokens: 300,
  };

  payload.model = config.model;

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('API AI falhou ao gerar variações');
  const data = await res.json();
  return data.choices[0].message.content;
}


// ── Backfill de Frases com IA (Background Queue) ─────────────────────────────────
let isBackfilling = false;

async function backfillMissingSentences() {
  if (isBackfilling) return;
  isBackfilling = true;
  try {
    const config = await getApiConfig();
    if (!config.apiKey) { isBackfilling = false; return; }

    const words = await db.getAllWords();
    const missing = words.filter(w => w.category !== 'sentence' && (!w.context_sentence || w.context_sentence === w.word || w.context_sentence.trim() === '' || !w.ai_chunks));
    
    if (missing.length === 0) {
      isBackfilling = false;
      return;
    }
    console.debug(`[LinguaFlow] Iniciando geração automática de frases para ${missing.length} palavras no cofre...`);

    for (const w of missing) {
      try {
        await new Promise(r => setTimeout(r, 6000)); // Espera 6s para respeitar limites da API (Rate Limit)
        const chunks = await generateChunksWithAI(w.word);
        if (chunks && chunks.length > 0) {
          // Mantém a frase do vídeo se existir e tiver mais que 2 palavras, senão sobrescreve
          const hasGoodVideoContext = w.context_sentence && w.context_sentence !== w.word && w.context_sentence.split(' ').length > 2;
          if (!hasGoodVideoContext) {
            w.context_sentence = chunks[0].eng || chunks[0].ingles || chunks[0].english;
          }
          w.ai_chunks = JSON.stringify(chunks);
          await db.saveWord(w);
          console.debug(`[LinguaFlow] Auto-generated chunks for: ${w.word}`);
          notifyDashboards(w.word);
        }
      } catch (e) {
        console.warn(`[LinguaFlow] Failed to auto-generate for ${w.word}:`, e);
      }
    }
    console.debug('[LinguaFlow] Geração automática de frases concluída!');
  } catch (e) {
    console.error('[LinguaFlow] Backfill error:', e);
  } finally {
    isBackfilling = false;
  }
}

setTimeout(backfillMissingSentences, 10000);
