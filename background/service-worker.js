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

  // Sync imediato com Supabase ao salvar palavra
  if (request.type === 'SYNC_TO_SUPABASE') {
    syncWordToSupabase(request)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Proxy para chamadas de banco de dados (Sincronização global entre sites)
  if (request.type === 'DB_CALL') {
    const { method, args } = request;
    if (typeof db[method] === 'function') {
      db[method](...(args || []))
        .then((result) => {
          // Notificações automáticas para métodos de escrita
          const writeMethods = [
            'saveWord',
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
          }
          sendResponse({ result });
        })
        .catch((error) => {
          console.error(`[LinguaFlow SW] Erro em db.${method}:`, error);
          sendResponse({ error: error.message });
        });
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
  const defaultKey = '';
  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const xAiUrl = 'https://api.x.ai/v1/chat/completions';
  const geminiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  const groqModel = 'llama-3.3-70b-versatile';
  const xAiModel = 'grok-beta';
  const geminiModel = 'gemini-1.5-flash';
  const openRouterModel = 'openrouter/free';

  let nativeKey = '';
  try {
    const envRes = await fetch(chrome.runtime.getURL('background/env.json'));
    if (envRes.ok) {
      const env = await envRes.json();
      nativeKey = env.NATIVE_API_KEY || '';
    }
  } catch (e) {
    // env.json missing, ignore
  }

  try {
    const stored = await chrome.storage.local.get(['aiApiKey']);
    const userKey = stored?.aiApiKey || nativeKey;
    if (userKey && userKey.trim() !== '') {
      const trimmedKey = userKey.trim();

      // Detecção de Provedor por prefixo
      if (trimmedKey.startsWith('AIza')) {
        return {
          provider: 'gemini',
          apiKey: trimmedKey,
          apiUrl: `${geminiUrl}?key=${trimmedKey}`,
          model: geminiModel,
        };
      }
      if (trimmedKey.startsWith('sk-or-')) {
        return {
          provider: 'openrouter',
          apiKey: trimmedKey,
          apiUrl: openRouterUrl,
          model: openRouterModel,
        };
      }

      const isXAi = trimmedKey.startsWith('xai-');
      return {
        provider: isXAi ? 'xai' : 'groq',
        apiKey: trimmedKey,
        apiUrl: isXAi ? xAiUrl : groqUrl,
        model: isXAi ? xAiModel : groqModel,
      };
    }
  } catch (e) {}

  return { provider: 'groq', apiKey: defaultKey, apiUrl: groqUrl, model: groqModel };
}

const BASE_PERSONA = `Atue como um professor particular de inglês para brasileiros, com foco em uso real, contexto e clareza.
Seu objetivo é fazer o aluno entender o que a palavra, phrasal verb, gíria, chunk ou colocação quer dizer NA FRASE, e também como isso difere do sentido isolado de dicionário.

DIRETRIZES DE OURO:
- Responda SEMPRE em Português Brasileiro (para as explicações).
- Os EXEMPLOS devem ser OBRIGATORIAMENTE em Inglês com a tradução ao lado.
- FOCO MÁXIMO NO CONTEXTO: se houver frase, explique primeiro o sentido exato naquela frase. Não dê apenas tradução isolada.
- CONTRASTE: sempre mostre "sentido isolado" versus "sentido nesta frase" quando houver diferença ou ambiguidade.
- EXPRESSÕES: se for phrasal verb, idiom, gíria, chunk ou colocação, trate o BLOCO inteiro como unidade de significado. Explique por que traduzir palavra por palavra engana.
- PROFESSOR DIDÁTICO: use termos gramaticais quando ajudarem, mas sempre explique em linguagem simples.
- PRONÚNCIA REAL: quando útil, diga como soa em connected speech.
- Use formatação Markdown (Negrito, Itálico) para destacar as partes importantes.

ESTRUTURA DE RESPOSTA OBRIGATÓRIA:
**Nível Sugerido (CEFR):** [A1 a C2]

**Sentido nesta frase:** Explique o significado exato no contexto fornecido. Se o contexto mudar o sentido, diga claramente.

**Sentido isolado:** Mostre o significado comum de dicionário e compare com o uso da frase.

**Por que não traduzir ao pé da letra:** Se for expressão, phrasal verb, gíria, chunk ou colocação, explique o bloco inteiro.

**Como e onde usar:** É formal, informal, gíria, técnico ou neutro? Qual é o tom emocional?

**Pronúncia natural:** Como os nativos falam isso rápido quando fizer sentido.

**Chunks úteis:** 2 ou 3 blocos reais com esse termo ou estrutura.

**Exemplos Reais:**
- [Inglês] (Tradução)
- [Inglês] (Tradução)

**Resumo de professor:** Uma frase final dizendo o que o aluno deve lembrar.`;

async function getPTPhoneticWithAI(word) {
  if (!word) return '';
  const cleanWord = word.toLowerCase().trim();
  const cacheKey = `pt_phonetic_${cleanWord}`;

  try {
    const cached = await db.getSetting(cacheKey).catch(() => null);
    if (cached) return cached;

    const config = await getApiConfig();
    if (!config.apiKey && config.provider !== 'gemini') {
      console.warn('[LinguaFlow] API Key vazia. Não é possível gerar transliteração PT-BR.');
      return '';
    }

    const prompt = `Retorne APENAS a transliteração fonética de como um BRASILEIRO leria a palavra em inglês "${word}" para soar o mais nativo possível (exemplo: apple -> á-pou, though -> dôu, write -> ruáit). Regras:
- Retorne APENAS a transliteração.
- NÃO inclua aspas, pontuação, hífens sobrando ou textos explicativos.
- Use acentos do português (á, é, í, ó, ú, â, ê, ô) para indicar a sílaba tônica.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let responseText = '';
    if (config.provider === 'gemini') {
      const res = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 20 },
        }),
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const res = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(config.provider === 'openrouter'
            ? {
                'HTTP-Referer': 'https://github.com/cascaoconcurseiro/linguaflow',
                'X-Title': 'LinguaFlow',
              }
            : {}),
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
    }

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

Você é um professor de inglês especializado em pronúncia, connected speech e percepção auditiva para brasileiros.
Sua missão não é apenas ensinar a pronúncia correta, mas ensinar o aluno a reconhecer como os americanos realmente falam em conversas naturais.

Explique o termo pelo sentido que ele tem nessa frase. Se o termo isolado puder significar outra coisa, compare os dois sentidos. Se for phrasal verb, gíria, chunk, idiom ou colocação, explique o bloco inteiro.

Para a palavra, siga EXATAMENTE esta estrutura de pronúncia no final da sua explicação:

## 1. Pronúncia oficial
Mostre a pronúncia em IPA.
Exemplo: Would → /wʊd/

## 2. Como um brasileiro costuma aprender
Explique como normalmente é ensinada.
Exemplo: "uud"

## 3. Como realmente soa para um brasileiro
Escreva uma adaptação fonética usando apenas letras do português, mesmo que não seja foneticamente perfeita.
Exemplo:
Would → uãd
Should → xãd`;

    const config = await getApiConfig();
    if (!config.apiKey && config.provider !== 'gemini')
      return 'Por favor, configure sua chave de API no Dashboard para usar recursos de IA.';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    if (config.provider === 'gemini') {
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: BASE_PERSONA + '\n\n' + prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        }),
      });
    } else {
      response = await fetchWithRetry(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(config.provider === 'openrouter'
            ? {
                'HTTP-Referer': 'https://github.com/cascaoconcurseiro/linguaflow',
                'X-Title': 'LinguaFlow',
              }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                BASE_PERSONA +
                '\nFOCO: sentido contextual primeiro; dicionário isolado só como comparação.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
    }

    clearTimeout(timeoutId);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Erro API (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    if (config.provider === 'gemini') {
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Não foi possível gerar explicação com Gemini.'
      );
    }
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar explicação.';
  } catch (err) {
    console.error('[LinguaFlow IA] Erro:', err);
    throw err;
  }
}

async function generateChunksWithAI(word) {
  try {
    if (!word) return [];
    const config = await getApiConfig();
    if (!config.apiKey && config.provider !== 'gemini') throw new Error('Configure sua API Key.');

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
    if (config.provider === 'gemini') {
      response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: chunksPersona + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      });
    } else {
      response = await fetch(config.apiUrl, {
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
    }

    clearTimeout(timeoutId);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Erro API (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    let content = '';
    if (config.provider === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }

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
    if (!config.apiKey && config.provider !== 'gemini') throw new Error('Configure sua API Key.');

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
    if (config.provider === 'gemini') {
      response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: grammarPersona + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      });
    } else {
      response = await fetch(config.apiUrl, {
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
    }

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);
    const data = await response.json();

    if (config.provider === 'gemini') {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar análise.';
    }
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
  } catch (err) {
    throw err;
  }
}

async function explainSentenceWithAI(sentence, fullContext = null) {
  try {
    if (!sentence) return 'Frase vazia.';
    const config = await getApiConfig();
    if (!config.apiKey && config.provider !== 'gemini') throw new Error('Configure sua API Key.');

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
      BASE_PERSONA +
      '\nFOCO: Na intenção real, emoção, referências contextuais e fluxo do diálogo.';
    const userPrompt = contextInfo || `Explique a intenção desta frase: "${sentence}"`;

    let response;
    if (config.provider === 'gemini') {
      response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        }),
      });
    } else {
      response = await fetch(config.apiUrl, {
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
    }

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);
    const data = await response.json();

    if (config.provider === 'gemini') {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar análise.';
    }
    return data.choices?.[0]?.message?.content || 'Não foi possível gerar análise.';
  } catch (err) {
    throw err;
  }
}

async function explainQuickContext(word, sentence) {
  try {
    const config = await getApiConfig();
    if (!config.apiKey && config.provider !== 'gemini') return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // contexto rápido

    const systemPrompt =
      'Você é um professor particular de inglês focado em contexto. Responda em português brasileiro, curto e natural.';
    const userPrompt = `Termo selecionado: "${word}"
Frase/contexto: "${sentence}"

Responda em 1 frase curta. Diga o sentido nesta frase. Se o termo isolado costuma significar outra coisa, acrescente uma comparação breve. Se for phrasal verb/chunk/gíria/idiom, explique o bloco inteiro, sem lista.`;

    let response;
    if (config.provider === 'gemini') {
      response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 90 },
        }),
      });
    } else {
      response = await fetch(config.apiUrl, {
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
    })
    .catch(() => {});
}

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
      ...(config.provider !== 'gemini' && { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('API AI falhou ao gerar variações');
  const data = await res.json();
  return config.provider === 'gemini'
    ? data.candidates[0].content.parts[0].text
    : data.choices[0].message.content;
}

// ── Sync direto com Supabase (word salva → nuvem instantâneo) ─────────────────
const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';

async function syncWordToSupabase({ word, translation, context, deckId }) {
  const session = await chrome.storage.local.get('lf_supabase_session');
  const sessionData = session.lf_supabase_session ? JSON.parse(session.lf_supabase_session) : null;
  const token = sessionData?.session?.access_token;
  if (!token) return { synced: false, reason: 'not_logged_in' };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
    Prefer: 'resolution=merge-duplicates',
  };

  const payload = {
    word: word, lang: 'en', translation: translation,
    context_sentence: context, added_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/words?on_conflict=word,lang`, {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    return { synced: res.ok };
  } catch (e) {
    return { synced: false, error: e.message };
  }
}
