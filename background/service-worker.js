// background/service-worker.js — Service worker MV3: central de mensagens (tradução, dicionário, IA, fila de salvar palavras), alarmes, selo de cards e notificação de revisão.
import { db } from '../utils/db.js';
import { translator } from '../utils/translator.js';
import { fetchWordSenses } from '../utils/word-senses.js';
import { OFFICIAL_SITE_URL, isLinguaFlowUrl } from '../utils/site-boundary.js';
import {
  evictDisposableCache,
  sweepStaleCache,
  clearBadLingueeCache as clearBadLingueeCacheModule,
} from './cache-cleaner.js';
import {
  generateSentenceWithAI as generateSentenceWithAIModule,
  generateStoryWithAI as generateStoryWithAIModule,
  generateAIVariation as generateAIVariationModule,
  backfillMissingSentences as backfillMissingSentencesModule,
} from './ai-generator.js';
import { isPermanentSaveError, retryableEntries, summarizeWordSaveQueue } from './word-save-queue.js';
import { createDueNotifier, ensureAlarms } from './reminders.js';
import { isAllowedTtsUrl } from './tts-url.js';
import { AI_STREAM_PORT, } from '../utils/ai-stream.js';
import { stripHtmlTags } from '../utils/html.js';
import { fetchDictionary } from './dictionary.js';
import { classifyWordStatic, classifyWordAI } from './word-classifier.js';
import {
  fetchWithRetry,
  getApiConfig,
  explainWordWithAI,
  aiChatPassthrough,
  generateChunksWithAI,
  explainSentenceWithAI,
  explainQuickContext,
} from './ai-requests.js';

// Estado "LF ligado" que dura até fechar o navegador (#418): o content script lê/grava
// chrome.storage.session, que por padrão só o service worker enxerga.
try {
  chrome.storage.session?.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })?.catch?.(() => {});
} catch {
  // Sem acesso, o player cai no padrão do modo escolhido (desligado).
}

// Métodos que páginas da extensão podem chamar através do service worker.
// A fronteira explícita impede acesso a helpers internos como db._fetch.
const DB_PROXY_METHODS = new Set([
  'addTagsToWord', 'assessFluencySubmission', 'buryCard', 'checkSession',
  'deletePushSubscription', 'deleteReaderText', 'deleteSentence', 'deleteStory',
  'deleteWord', 'ensureUserStats', 'getAdaptiveProfiles', 'getAllCards',
  'getAllKnownWords', 'getAllSentences', 'getAllTags', 'getAllWords',
  'getCardByWordId', 'getCardsDue', 'getCardsDueCount', 'getStudyCards', 'getCardStats', 'getFluencyProfiles',
  'getHistory', 'getLatestLearningTaskAttempt', 'getLeaderboard', 'getPushPublicKey',
  'getReaderTexts', 'getReviewLog', 'getSentenceById', 'getSessions', 'getSetting',
  'getSettings', 'getSRSCategoryOverrides', 'getSRSSettings', 'getStats',
  'getStatsSnapshot', 'getStories', 'getStudyStats', 'getTodayCounts', 'getTranslationCache',
  'getUserStats', 'getWord', 'getWordById', 'getWordsSavedToday', 'getWordsByCategory', 'getWordsByLetter',
  'getFluencyListeningText',
  'getAllIgnoredWords', 'ignoreWord', 'isKnown', 'issueFluencyTask', 'login', 'logout', 'logManualStudy', 'logReview', 'logSession',
  'markAsKnown', 'unignoreWord', 'maybeLeagueRollover', 'migrateReaderText', 'predictNextState',
  'recordAdaptiveSignal', 'recordLearningTaskAttempt', 'reportClientError',
  'restoreCardState', 'savePushSubscription', 'saveReaderText', 'saveSentence',
  'saveStory', 'saveWord', 'setCardSuspended', 'setEmailOptIn', 'setSetting',
  'setSRSCategoryOverride', 'setTranslationCache', 'signUp', 'submitFluencyTask',
  'suspendCard', 'undoReview', 'updateReaderProgress', 'updateWord', 'resetCardToNew',
  'getCanonicalLexicon', 'saveCanonicalLexicon',
  'getCurrentUser', 'isAdmin', 'adminVerifyPin', 'adminGetRole', 'adminGetOverview', 'adminUsersPage',
  'adminGetUserDetail', 'adminExportUserData', 'adminResetUserData', 'adminResetAllUsersData',
  'adminListBackups', 'adminRestoreBackup', 'adminDeleteBackup', 'adminSetUserSuspended',
  'adminRevokeUserSessions', 'adminDeleteUser', 'adminListErrors', 'adminClearErrors', 'adminApiUsage',
  'adminListAudit', 'adminListAdmins', 'adminSetAdminRole', 'adminGetSystemNotice', 'adminSetSystemNotice',
  'getSystemNotice', 'submitUserReport', 'listMyReports', 'adminSecurityOverview', 'adminListReports',
  'adminUpdateReport', 'adminSessionHygiene', 'adminPruneStaleSessions', 'adminAlertSummary',
  'logUsageEvent', 'adminGetUsageFunnel',
]);

// Garbage Collector e limpador de cache (delegado a background/cache-cleaner.js)
function _evictDisposableCache() {
  return evictDisposableCache();
}

function _sweepStaleCache(maxLinguee = 30, maxReverso = 30, maxTranslations = 1000) {
  return sweepStaleCache(maxLinguee, maxReverso, maxTranslations);
}

function clearBadLingueeCache() {
  return clearBadLingueeCacheModule();
}

// Roda o limpador sempre que o Service Worker inicializa
_sweepStaleCache();

console.debug('LinguaFlow: Service Worker inicializado.');

// Streaming de IA para content scripts (uma porta por pedido). Desconectar a
// porta — o usuário trocou de palavra ou fechou o popup — aborta a chamada.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== AI_STREAM_PORT) return;
  if (port.sender?.id !== chrome.runtime.id) {
    port.disconnect();
    return;
  }
  const controller = new AbortController();
  let open = true;
  port.onDisconnect.addListener(() => {
    open = false;
    controller.abort();
  });
  const post = (msg) => {
    if (!open) return;
    try { port.postMessage(msg); } catch { open = false; }
  };
  port.onMessage.addListener((request) => {
    if (request?.action === 'ai_quick_context') {
      explainQuickContext(request.word, request.sentence, {
        signal: controller.signal,
        onPartial: (partial) => post({ type: 'partial', ...partial }),
      })
        .then((result) => post({
          type: 'done',
          translation: result?.translation || null,
          explanation: result?.explanation || null,
        }))
        .catch((err) => post({ type: 'error', error: err.message }));
    } else if (request?.action === 'ai_explain_sentence') {
      explainSentenceWithAI(request.sentence, request.fullContext || null, {
        signal: controller.signal,
        onPartial: (text) => post({ type: 'partial', text }),
      })
        .then((analysis) => post({ type: 'done', analysis }))
        .catch((err) => post({ type: 'error', error: err.message }));
    } else if (request?.action === 'ai_chat') {
      aiChatPassthrough(request.messages, request.options || {}, {
        signal: controller.signal,
        onPartial: (text) => post({ type: 'partial', text }),
      })
        .then((content) => post({ type: 'done', content }))
        .catch((err) => post({ type: 'error', error: err.message }));
    } else {
      post({ type: 'error', error: 'Pedido de IA desconhecido.' });
    }
  });
});

// ── Alarmes ──────────────────────────────────────────────────────────────────
// Só cria o que não existe: recriar a cada despertar reiniciava o alarme de 60 min (#465).
ensureAlarms(chrome.alarms, [
  { name: 'srs-reminder', periodInMinutes: 60 },
  { name: 'word-save-sync', periodInMinutes: 1 },
  { name: 'listening-sync', periodInMinutes: 1 },
]);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'listening-sync') db.drainListeningQueue().catch(() => {});
  if (alarm.name === 'srs-reminder') {
    updateBadge(); // updateBadge dispara a notificacao real
    _sweepStaleCache();
  }
  if (alarm.name === 'word-save-sync') syncPendingWordSaves();
});

chrome.runtime.onStartup?.addListener(() => syncPendingWordSaves());

// ── Instalação ───────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Instalação e atualização nunca abrem guia nem sobrescrevem preferências.
  // Só preenche defaults que ainda não existem.
  chrome.storage.sync.get(['nativeLang', 'targetLangs'], (current) => {
    const defaults = {};
    if (!current.nativeLang) defaults.nativeLang = 'pt';
    if (!Array.isArray(current.targetLangs) || current.targetLangs.length === 0) {
      defaults.targetLangs = ['en'];
    }
    if (Object.keys(defaults).length > 0) chrome.storage.sync.set(defaults);
  });
  chrome.contextMenus.create({
    id: 'linguaflow-save',
    title: 'Salvar no LinguaFlow',
    contexts: ['selection'],
  });
  clearBadLingueeCache();
});

async function openOrFocusLinguaFlow() {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => isLinguaFlowUrl(tab.url));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) {
      await chrome.windows?.update?.(existing.windowId, { focused: true });
    }
    return { reused: true, tabId: existing.id };
  }

  const created = await chrome.tabs.create({ url: OFFICIAL_SITE_URL });
  return { reused: false, tabId: created?.id };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'linguaflow-save') {
    // O dashboard é o produto, não uma página hospedeira da extensão.
    if (isLinguaFlowUrl(tab?.url)) return;
    chrome.tabs.sendMessage(tab.id, {
      action: 'openWordPopup',
      payload: { word: info.selectionText.trim() },
    });
  }
});

// ── Listener de mensagens ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.debug('[LinguaFlow SW] Mensagem recebida:', request.type || request.action);

  if (request.type === 'OPEN_EXTENSION_LOGIN') {
    (async () => {
      const url = chrome.runtime.getURL('popup/popup.html?login=1');
      const tabs = await chrome.tabs.query({});
      const existing = tabs.find(tab => tab.url === url);
      if (existing?.id) {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url });
      }
      return { ok: true };
    })().then(sendResponse).catch(() => sendResponse({ ok: false, error: 'Não foi possível abrir o login. Tente novamente.' }));
    return true;
  }

  if (request.type === 'OPEN_DASHBOARD') {
    (async () => {
      try {
        // Se a mensagem partiu do próprio dashboard, nunca abra uma cópia.
        if (isLinguaFlowUrl(sender?.tab?.url)) {
          sendResponse({ ok: true, reused: true, tabId: sender.tab.id });
          return;
        }

        const result = await openOrFocusLinguaFlow();
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  // Local-first: o popup confirma assim que a intenção fica persistida no
  // storage da extensão. A rede, criação do card e enriquecimentos acontecem
  // depois, com retry pelo alarme — fechar o popup não perde o salvamento.
  if (request.type === 'QUEUE_WORD_SAVE') {
    enqueueWordSave(request.payload)
      .then((queued) => {
        sendResponse({ ok: true, queued: true, queueId: queued.id });
        syncPendingWordSaves();
      })
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  // A1 (W1): resultado da primeira recuperacao entra numa fila local e so
  // vira review quando o card existir no banco (mesmo local-first do save).
  if (request.type === 'QUEUE_FIRST_RECALL') {
    enqueueFirstRecall(request.payload)
      .then(() => { sendResponse({ ok: true }); drainFirstRecalls(); })
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  // Popup: estado da fila de palavras (pendentes e recusadas pelo servidor).
  if (['GET_WORD_SAVE_QUEUE', 'RETRY_FAILED_WORD_SAVES', 'DISCARD_FAILED_WORD_SAVES'].includes(request.type)) {
    if (sender?.id !== chrome.runtime.id || !sender?.url?.startsWith(chrome.runtime.getURL(''))) {
      sendResponse({ ok: false, error: 'Remetente não autorizado.' });
      return false;
    }
    (async () => {
      const queue = await readLocal(PENDING_WORD_SAVES_KEY) || {};
      if (request.type === 'RETRY_FAILED_WORD_SAVES' || request.type === 'DISCARD_FAILED_WORD_SAVES') {
        for (const [id, item] of Object.entries(queue)) {
          if (!item?.failed) continue;
          if (request.type === 'DISCARD_FAILED_WORD_SAVES') delete queue[id];
          else queue[id] = { ...item, failed: false, attempts: 0, queuedAt: Number(item.queuedAt || 0) + 1 };
        }
        await writeLocal({ [PENDING_WORD_SAVES_KEY]: queue });
        if (request.type === 'RETRY_FAILED_WORD_SAVES') syncPendingWordSaves();
      }
      return { ok: true, ...summarizeWordSaveQueue(queue) };
    })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  // Proxy para chamadas de banco de dados (Sincronização global entre sites)
  if (request.type === 'DB_CALL') {
    if (sender?.id !== chrome.runtime.id) {
      sendResponse({ error: 'Remetente não autorizado.', errorCode: 'DB_SENDER_BLOCKED', errorRetryable: false });
      return false;
    }
    const { method, args } = request;
    // P0.2b: card state is never accepted as an arbitrary client PATCH.
    // Keep an explicit tombstone so an outdated caller gets a clear error
    // instead of reaching the generic database proxy.
    if (method === 'updateCard') {
      sendResponse({
        error: 'updateCard foi removido; use as operações seguras de revisão do LinguaFlow.',
        errorCode: 'LEGACY_CARD_WRITE_BLOCKED',
        errorRetryable: false,
      });
      return false;
    }
    if (!DB_PROXY_METHODS.has(method)) {
      sendResponse({
        error: 'Método de banco não permitido pelo proxy da extensão.',
        errorCode: 'DB_METHOD_BLOCKED',
        errorRetryable: false,
      });
      return false;
    }
    if (method === 'isAdmin' || method.startsWith('admin')) {
      const isInternalPage = sender?.url?.startsWith(chrome.runtime.getURL(''));
      if (!isInternalPage) {
        sendResponse({
          error: 'Operações administrativas são restritas ao painel interno da extensão.',
          errorCode: 'ADMIN_SCOPE_VIOLATION',
          errorRetryable: false,
        });
        return false;
      }
    }
    if (typeof db[method] === 'function') {
      (async () => {
        try {
          // Classificação nunca pode bloquear o save. Grava a heurística local
          // imediatamente; a IA pode refinar depois da confirmação do banco.
          let refineCategory = null;
          if (method === 'saveWord' && args && args[0] && !args[0].category) {
            args[0].category = classifyWordStatic(args[0].word || '');
            refineCategory = args[0].word || null;
          }

          const result = await Promise.resolve(db[method](...(args || [])));

          if (method === 'saveWord' && refineCategory && result?.id) {
            refineSavedWord(result.id, refineCategory, args[0].category, args[0].translation).catch(() => {});
          }

          const writeMethods = [
            'saveWord',
            'updateWord',
            'buryCard',
            'setCardSuspended',
            'restoreCardState',
            'logReview',
            'saveSentence',
            'deleteWord',
            'markAsKnown',
            'ignoreWord',
            'unignoreWord',
            'resetCardToNew',
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
          sendResponse({
            error: error?.message || String(error),
            errorName: error?.name || 'Error',
            errorStatus: error?.status || null,
            errorCode: error?.code || null,
            errorKind: error?.kind || null,
            errorRetryable: Boolean(error?.retryable),
          });
        }
      })();
      return true;
    }
  }

  // Tradução de texto (Usando utilitário Translator com Cache multinível)
  if (request.action === 'translate') {
    if (sender?.id !== chrome.runtime.id) {
      sendResponse({ translation: null, error: 'Remetente não autorizado.' });
      return false;
    }
    const { text, from, to } = request;
    if (typeof text !== 'string' || text.length === 0 || text.length > 5000) {
      sendResponse({ translation: null, error: 'Texto de tradução inválido.' });
      return false;
    }
    translator
      .translate(text, from, to)
      .then((result) => sendResponse({ translation: result.translation, source: result.source, cached: result.cached }))
      .catch((err) => sendResponse({ translation: null, error: err.message }));
    return true;
  }

  // Traduções por classe gramatical do card da palavra (#366)
  if (request.action === 'wordSenses') {
    if (sender?.id !== chrome.runtime.id) {
      sendResponse({ senses: [] });
      return false;
    }
    fetchWordSenses(request.word, request.from || 'en', request.to || 'pt')
      .then((senses) => sendResponse({ senses }))
      .catch(() => sendResponse({ senses: [] }));
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

  // Explicação com IA (DeepSeek)
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

  // Gerador de Chunks com IA (Inglês, tradução e IPA)
  if (request.action === 'ai_generate_chunks') {
    const { word, context } = request;
    generateChunksWithAI(word, context)
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
      .then((result) => sendResponse({
        explanation: result?.explanation || null,
        translation: result?.translation || null,
      }))
      .catch((err) => sendResponse({ explanation: null, translation: null, error: err.message }));
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
    generateStoryWithAI(request.genre, request.options || {})
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

  // Voz neural (Microsoft Edge TTS) pela Edge Function autenticada. Só devolve
  // áudio quando o servidor confirma o motor neural; caso contrário o chamador
  // segue para o Google, sem cachear fallback como neural.
  if (request.type === 'FETCH_NEURAL_TTS') {
    (async () => {
      const token = await db._getToken().catch(() => null);
      if (!token) return { success: false, error: 'not_authenticated' };
      const r = await fetch('https://qnutoswrufznztoznlql.supabase.co/functions/v1/tts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(request.text || '').slice(0, 500), lang: request.lang || 'en-US' }),
      });
      if (!r.ok) return { success: false, error: `HTTP ${r.status}` };
      const engine = r.headers.get('x-tts-engine') || 'unknown';
      if (engine !== 'edge-tts') return { success: false, error: `engine_${engine}` };
      const bytes = new Uint8Array(await r.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return { success: true, dataUrl: `data:audio/mpeg;base64,${btoa(binary)}` };
    })()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'FETCH_TTS') {
    // Só o áudio do Google Tradutor; qualquer outra URL seria um fetch arbitrário (#470).
    if (!isAllowedTtsUrl(request.url)) {
      sendResponse({ success: false, error: 'url_not_allowed' });
      return false;
    }
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
            en: stripHtmlTags(item.s_text),
            pt: stripHtmlTags(item.t_text),
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
// Onda 9 (auditoria de bugs): era 'phrasal_verb' aqui, mas 'phrasal' em todo
// o resto do app (CATEGORY_OPTIONS/catMap/aba do Cofre em libraryView.js,
// TOPIC_LABELS em studyView.js) — palavras classificadas pela extensão
// como phrasal verb nunca apareciam na aba "Phrasal Verbs" nem eram
// alcançadas por "Revisar por tópico". Unificado em 'phrasal'.
/**
 * Classifica automaticamente uma palavra/expressão em uma categoria (versão estática).
 * Categorias: 'phrasal' | 'idiom' | 'slang' | 'word'
 */
/**
 * Classificador IA (Pilar: Inteligência Automática)
 */
// ── Fila local-first de palavras ────────────────────────────────────────────
const PENDING_WORD_SAVES_KEY = 'lf_pending_word_saves_v1';
let wordSaveSyncPromise = null;

function readLocal(key) {
  return new Promise((resolve) => chrome.storage.local.get(key, (value) => resolve(value?.[key])));
}

function writeLocal(value) {
  return new Promise((resolve, reject) => {
    const doWrite = (isRetry = false) => {
      chrome.storage.local.set(value, () => {
        if (chrome.runtime.lastError) {
          const message = chrome.runtime.lastError.message || '';
          if (!isRetry && /quota|kQuotaBytes|exceeded/i.test(message)) {
            _evictDisposableCache()
              .then(() => doWrite(true))
              .catch(() => reject(new Error(message)));
            return;
          }
          reject(new Error(message));
        } else {
          resolve();
        }
      });
    };
    doWrite(false);
  });
}

async function enqueueWordSave(payload) {
  if (!payload?.word) throw new Error('Palavra ausente');
  const lang = payload.lang || 'en';
  const id = `${lang}:${String(payload.word).trim().toLocaleLowerCase()}`;
  const queue = await readLocal(PENDING_WORD_SAVES_KEY) || {};
  queue[id] = {
    id,
    // A sincronização compara versões por este marcador. Date.now() sozinho
    // pode repetir no mesmo milissegundo e fazer a versão antiga apagar a nova.
    queuedAt: Math.max(Date.now(), Number(queue[id]?.queuedAt || 0) + 1),
    attempts: 0,
    payload: {
      ...(queue[id]?.payload || {}),
      ...payload,
      category: payload.category || queue[id]?.payload?.category || classifyWordStatic(payload.word),
      // Base64 de screenshot tornava a fila pesada e bloqueava o clique.
      // O clipe do vídeo é a mídia canônica; snapshot não entra no caminho P0.
      snapshot: null,
    },
  };
  await writeLocal({ [PENDING_WORD_SAVES_KEY]: queue });
  return queue[id];
}

async function refineSavedWord(id, word, currentCategory, currentTranslation) {
  const tasks = [];
  const isSpecialized = ['slang', 'phrasal', 'idiom'].includes(currentCategory);
  tasks.push(classifyWordAI(word).then((category) => {
    if (!category) return;
    // Impede rebaixamento silencioso: nunca converte uma gíria, phrasal ou expressão em palavra genérica
    if (isSpecialized && category === 'word') return;
    if (category !== currentCategory) return db.updateWord(id, { category });
  }));
  if (!currentTranslation) {
    tasks.push(translator.translate(word, 'en', 'pt').then((result) => {
      if (result?.translation) return db.updateWord(id, { translation: result.translation });
    }));
  }
  await Promise.allSettled(tasks);
}

const PENDING_FIRST_RECALL_KEY = 'lf_pending_first_recall_v1';

async function enqueueFirstRecall(payload) {
  const word = String(payload?.word || '').trim();
  const quality = Number(payload?.quality);
  if (!word || ![1, 3].includes(quality)) throw new Error('recall invalido');
  const lang = payload.lang || 'en';
  const id = `${lang}:${word.toLocaleLowerCase()}`;
  const queue = await readLocal(PENDING_FIRST_RECALL_KEY) || {};
  // Uma unica primeira recuperacao por palavra — cliques repetidos nao empilham
  if (!queue[id]) queue[id] = { id, word, lang, quality, queuedAt: Date.now(), attempts: 0 };
  await writeLocal({ [PENDING_FIRST_RECALL_KEY]: queue });
  return queue[id];
}

// Drena a fila: quando a palavra ja sincronizou e o card ainda e VIRGEM
// (status new, zero reps), a recuperacao vira a primeira review real —
// acerto introduz com Bom, erro introduz com Errei (nao e lapso: cards novos
// nao incrementam lapses). Card ja estudado => entrada obsoleta, descarta.
let drainFirstRecallsPromise = null;
async function drainFirstRecalls() {
  if (drainFirstRecallsPromise) return drainFirstRecallsPromise;
  drainFirstRecallsPromise = (async () => {
    const queue = await readLocal(PENDING_FIRST_RECALL_KEY) || {};
    const updateQueueItem = async (id, updater) => {
      const latest = await readLocal(PENDING_FIRST_RECALL_KEY) || {};
      if (latest[id]) {
        updater(latest);
        await writeLocal({ [PENDING_FIRST_RECALL_KEY]: latest });
      }
    };

    for (const [id, entry] of Object.entries(queue)) {
      try {
        const wordRow = await db.getWord(entry.word, entry.lang);
        if (!wordRow) {
          await updateQueueItem(id, (q) => {
            q[id].attempts = (q[id].attempts || 0) + 1;
            if (q[id].attempts > 10) delete q[id];
          });
          continue;
        }
        const card = await db.getCardByWordId(wordRow.id);
        if (!card) {
          await updateQueueItem(id, (q) => {
            q[id].attempts = (q[id].attempts || 0) + 1;
            if (q[id].attempts > 10) delete q[id];
          });
          continue;
        }
        if (card.status === 'new' && !(card.reps > 0)) {
          await db.logReview(card.id, entry.quality, wordRow.category || null);
          notifyDashboards(entry.word);
          updateBadge();
        }
        await updateQueueItem(id, (q) => { delete q[id]; });
      } catch (error) {
        await updateQueueItem(id, (q) => {
          q[id].attempts = (q[id].attempts || 0) + 1;
          if (q[id].attempts > 10) delete q[id];
        });
        console.warn('[FirstRecall] adiado:', entry.word, error?.message);
      }
    }
  })().finally(() => { drainFirstRecallsPromise = null; });
  return drainFirstRecallsPromise;
}

async function syncPendingWordSaves() {
  if (wordSaveSyncPromise) return wordSaveSyncPromise;
  wordSaveSyncPromise = (async () => {
    const processedVersions = new Set();
    while (true) {
      const queue = await readLocal(PENDING_WORD_SAVES_KEY) || {};
      const pending = retryableEntries(queue, processedVersions);
      if (pending.length === 0) break;

      for (const [id, item] of pending) {
        processedVersions.add(`${id}:${item.queuedAt}`);
        try {
          const result = await db.saveWord(item.payload);
          if (!result?.ok) throw new Error('save_not_confirmed');

          const latest = await readLocal(PENDING_WORD_SAVES_KEY) || {};
          // Não apaga uma versão mais nova enfileirada enquanto esta sincronizava.
          if (latest[id]?.queuedAt === item.queuedAt) {
            delete latest[id];
            await writeLocal({ [PENDING_WORD_SAVES_KEY]: latest });
          }
          notifyDashboards(item.payload.word, { held: result.waitingReason === 'backlog' });
          updateBadge();
          refineSavedWord(result.id, item.payload.word, item.payload.category, item.payload.translation).catch(() => {});
          setTimeout(backfillMissingSentences, 2000);
        } catch (error) {
          const latest = await readLocal(PENDING_WORD_SAVES_KEY) || {};
          if (latest[id]?.queuedAt === item.queuedAt) {
            latest[id].attempts = (latest[id].attempts || 0) + 1;
            latest[id].lastError = String(error?.message || error).slice(0, 160);
            // Recusa do servidor não melhora repetindo: para e mostra no popup.
            if (isPermanentSaveError(error)) latest[id].failed = true;
            await writeLocal({ [PENDING_WORD_SAVES_KEY]: latest });
          }
        }
      }
    }
  })().finally(() => { wordSaveSyncPromise = null; })
    .then(() => drainFirstRecalls().catch(() => {}));
  return wordSaveSyncPromise;
}

// ── Funções Auxiliares ────────────────────────────────────────────────────────

// ============================================================================
// GERADOR DE FRASE DE EXEMPLO COM IA (delegado a background/ai-generator.js)
// ============================================================================
async function generateSentenceWithAI(word) {
  return generateSentenceWithAIModule(word, { getApiConfig, fetchWithRetry });
}

async function generateStoryWithAI(genre, options = {}) {
  return generateStoryWithAIModule(genre, options, { db, getApiConfig, fetchWithRetry });
}

function notifyDashboards(word, { held = false } = {}) {
  // held (#495): o freio de entrada segurou a palavra; a aba do vídeo avisa o aluno.
  const msg = { type: 'REFRESH_VOCAB', word: word || null, held };
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
// e só quando há cards devidos de verdade. A trava contra chamadas simultâneas
// vive em reminders.js (#465).
const maybeNotifyDue = createDueNotifier(chrome, {
  iconUrl: chrome.runtime.getURL('icon128.png'),
  onError: (e) => console.debug('[LinguaFlow] Notificação indisponível:', e?.message),
});

chrome.notifications?.onClicked?.addListener((id) => {
  if (id === 'lf-due-reminder') {
    openOrFocusLinguaFlow()
      .catch((error) => console.warn('[LinguaFlow] Falha ao abrir painel:', error))
      .finally(() => chrome.notifications.clear(id));
  }
});

async function generateAIVariation(word, sentence) {
  return generateAIVariationModule(word, sentence, { getApiConfig });
}


// ── Backfill de Frases com IA (Background Queue delegado a background/ai-generator.js) ─
async function backfillMissingSentences() {
  return backfillMissingSentencesModule({ db, getApiConfig, generateChunksWithAI, notifyDashboards });
}

setTimeout(backfillMissingSentences, 10000);
