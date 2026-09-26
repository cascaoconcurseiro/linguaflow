// utils/db.js — Banco único do LinguaFlow (Cloud-Only)
// Integração 100% direta com Supabase via REST API (sem IndexedDB local)
import { addLocalDays, localDateKey, localDayBounds } from './local-day.js';
import { ReaderStoriesRepository } from './db/reader-stories-repo.js';
import { GamificationRepository } from './db/gamification-repo.js';

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sjE7swuyYQz-80x9lttf4Q_awnZ_YlY';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLUENCY_DRAFT_KEY = 'lf_fluency_check_draft_v1';
// snapshot era um JPEG base64 nunca renderizado. Em produção, só 6 palavras
// somavam 5,4 MB nesse campo e cada select=* o baixava outra vez.
const WORD_SELECT = 'id,user_id,word,lang,translation,context_sentence,phonetic,explanation,level,tags,ai_chunks,video_url,video_title,platform,added_at,synonyms,antonyms,definition,category,mnemonic,video_start_ms,video_end_ms';

export function createOperationId() {
  return globalThis.crypto?.randomUUID?.()
    || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function classifyRequestError(error, status = null, body = null) {
  const parsedStatus = Number(status || error?.status || 0) || null;
  let parsedBody = body;
  if (typeof body === 'string') {
    try { parsedBody = JSON.parse(body); } catch { parsedBody = null; }
  }
  error.status = parsedStatus;
  error.code = parsedBody?.code || error.code || null;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (parsedStatus === 401) error.kind = 'auth';
  else if (offline) error.kind = 'offline';
  else if (
    [408, 425, 429].includes(parsedStatus)
    || (parsedStatus && parsedStatus >= 500)
    || /timeout|failed to fetch|network|load failed/i.test(error.message)
    || error?.name === 'TypeError'
  ) error.kind = 'retry';
  else error.kind = 'fatal';
  error.retryable = error.kind === 'offline' || error.kind === 'retry';
  return error;
}

class Database {
  constructor() {
    // Sentinela usada pelo shell PWA para impedir uma mistura perigosa entre
    // app novo e db.js antigo retido por um service worker anterior.
    this.reviewWriteMode = 'rpc-atomic-v1';
    this.isBackgroundWorker = typeof window === 'undefined';
    this.isChromeContext = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    this.isProxyMode = this.isChromeContext && !this.isBackgroundWorker;
    this.initPromise = Promise.resolve();
    this._cacheGeneration = 0;
    this._ensureUserStatsPromise = null;
    this._timezoneSynced = null;
    this._storiesCache = null;
    this._storiesRefreshing = null;
    this._readerStoriesRepo = new ReaderStoriesRepository(this);
    this._gamificationRepo = new GamificationRepository(this);
    this._canonicalLexiconMemory = new Map();
  }

  // Lê o objeto de sessão completo ({ access_token, refresh_token, expires_at, user })
  async _readSession() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get('lf_supabase_session', (res) => {
          const sessionStr = res.lf_supabase_session;
          if (!sessionStr) return resolve(null);
          try {
            resolve(JSON.parse(sessionStr)?.session || null);
          } catch { resolve(null); }
        });
      });
    } else {
      try {
        const sessionStr = localStorage.getItem('lf_supabase_session');
        if (!sessionStr) return null;
        return JSON.parse(sessionStr)?.session || null;
      } catch { return null; }
    }
  }

  // Grava a sessão nos dois storages (extensão e web compartilham a mesma chave)
  async _saveSession(session) {
    const sessionStr = JSON.stringify({ session });
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ lf_supabase_session: sessionStr }, () => resolve());
      });
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('lf_supabase_session', sessionStr);
    }
  }

  // Renova o access_token se estiver a menos de 5 min de expirar.
  // Mutex (_refreshPromise): o Supabase rotaciona o refresh_token — dois
  // refreshes simultâneos com o mesmo token invalidariam a sessão inteira.
  async _refreshTokenIfNeeded() {
    if (this._refreshPromise) return this._refreshPromise;

    const session = await this._readSession();
    if (!session) return null;

    // Sessão legada (salva antes do refresh existir): usa como está;
    // se o token já venceu, o tratamento de 401 em _fetch desloga.
    if (!session.refresh_token || !session.expires_at) return session;

    const FIVE_MIN = 5 * 60 * 1000;
    if (session.expires_at - Date.now() > FIVE_MIN) return session;

    // Re-checa o mutex: outra chamada pode ter iniciado o refresh enquanto
    // esta aguardava o _readSession (o trecho abaixo é síncrono, então é seguro)
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Refresh token inválido/expirado: sessão morta de verdade — logout explícito
          console.warn('[DB] Refresh de sessão rejeitado. Deslogando.', data.error_description || res.status);
          await this.logout();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lf_auth_expired'));
          }
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' }).catch(() => {});
          }
          return null;
        }

        const newSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
          user: data.user || session.user,
        };
        await this._saveSession(newSession);
        return newSession;
      } catch (e) {
        // Erro de rede (offline etc.): NÃO desloga — mantém a sessão atual
        console.warn('[DB] Falha de rede no refresh, mantendo sessão atual:', e.message);
        return session;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  async _getToken() {
    const session = await this._refreshTokenIfNeeded();
    return session?.access_token || null;
  }

  async _fetch(endpoint, options = {}) {
    if (this.isProxyMode) {
      throw new Error('Acesso REST interno não é permitido fora do service worker.');
    }

    const token = await this._getToken();
    if (!token) {
       console.warn('[DB] Sessão Supabase não encontrada. Operação cancelada:', endpoint);
       const error = classifyRequestError(new Error('Sessão expirada. Entre novamente para continuar.'), 401);
       if (options.throwOnReadError || (options.method || 'GET').toUpperCase() !== 'GET') throw error;
       return null;
    }

    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    };

    if (options.body && typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        if (res.status === 204) return [];
        const err = await res.text();
        if (res.status === 401) {
          this.logout();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('lf_auth_expired'));
          }
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' }).catch(() => {});
          }
        }
        throw classifyRequestError(new Error(`[Supabase Error] ${res.status}: ${err}`), res.status, err);
      }
      if (res.status === 204) return [];
      // POST/PATCH sem 'Prefer: return=representation' respondem 200/201 com
      // corpo VAZIO — res.json() estourava "Unexpected end of JSON input"
      // (a escrita tinha funcionado; só o parse quebrava).
      const text = await res.text();
      if (!text) return [];
      return JSON.parse(text);
    } catch (e) {
      if (!e.kind) classifyRequestError(e);
      console.error('[DB] Fetch Error:', e);
      // Escritas NÃO podem falhar em silêncio: o chamador precisa saber
      // (word-popup mostra erro, handleGrade loga, backfill pula a palavra).
      // Leituras seguem retornando null (views tratam como vazio).
      const method = (options.method || 'GET').toUpperCase();
      if (options.throwOnReadError || method !== 'GET') throw e;
      // Leitura falhou: retorna null (views tratam como vazio) MAS avisa a UI
      // — "nenhuma palavra" quando na verdade a rede caiu era mentira na tela.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lf_read_error', { detail: { endpoint } }));
      }
      return null;
    }
  }

  async _proxy(method, args) {
    if (!this.isProxyMode) return null;
    return new Promise((resolve, reject) => {
      const proxyTimeoutMs = method === 'assessFluencySubmission' ? 65000 : 10000;
      const timeoutId = setTimeout(() => {
        console.error(`[LinguaFlow DB] Timeout na chamada ${method}.`);
        reject(classifyRequestError(new Error(`DB proxy timeout: ${method}`)));
      }, proxyTimeoutMs);

      chrome.runtime.sendMessage(
        {
          type: 'DB_CALL',
          method,
          args: JSON.parse(JSON.stringify(args || [])),
        },
        (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            console.error('[LinguaFlow DB] Erro no proxy:', chrome.runtime.lastError.message);
            reject(classifyRequestError(new Error(chrome.runtime.lastError.message)));
          } else if (response && response.error) {
            console.error('[LinguaFlow DB] Erro retornado do worker:', response.error);
            const error = new Error(response.error);
            error.name = response.errorName || 'Error';
            error.status = response.errorStatus || null;
            error.code = response.errorCode || null;
            error.kind = response.errorKind || null;
            error.retryable = Boolean(response.errorRetryable);
            reject(error.kind ? error : classifyRequestError(error, error.status));
          } else {
            resolve(response ? response.result : null);
          }
        }
      );
    });
  }

  // ── AUTENTICAÇÃO ──────────────────────────────────────────────────────────
  async login(email, password) {
    if (this.isProxyMode) return this._proxy('login', [email, password]);
    const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const headers = { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao fazer login');
      
      await this._saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
        user: data.user,
      });
      // O singleton sobrevive à troca de conta no PWA e no service worker.
      // Nunca permita que o novo usuário herde listas SWR do usuário anterior.
      this._invalidateReadCache();

      return { ok: true, user: data.user };
    } catch (e) {
      console.error('Login error:', e);
      return { ok: false, error: e.message };
    }
  }

  async signUp(email, password) {
    if (this.isProxyMode) return this._proxy('signUp', [email, password]);
    const url = `${SUPABASE_URL}/auth/v1/signup`;
    const headers = { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao cadastrar');
      
      // REST retorna tokens na raiz; session é o envelope usado pelo SDK.
      const session = data.access_token ? data : data.session;
      if (session?.access_token) {
        await this._saveSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: Date.now() + ((session.expires_in || 3600) * 1000),
          user: data.user,
        });
        this._invalidateReadCache();
      }
      return { ok: true, user: data.user, session };
    } catch (e) {
      console.error('SignUp error:', e);
      return { ok: false, error: e.message };
    }
  }

  async logout() {
    if (this.isProxyMode) return this._proxy('logout', []);
    this._authGeneration = (this._authGeneration || 0) + 1;
    await this.clearFluencyCheckDraft();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('lf_supabase_session');
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('lf_supabase_session');
    }
    this._invalidateReadCache();
    this._srsCache = null;
    this._ensureUserStatsPromise = null;
    this._timezoneSynced = null;
    this._gamificationRepo?.resetSessionState?.();
    return { ok: true };
  }

  async checkSession() {
    if (this.isProxyMode) return this._proxy('checkSession', []);
    const token = await this._getToken();
    return !!token;
  }

  async getCurrentUserId() {
    const session = await this._readSession();
    return session?.user?.id || null;
  }

  async getCurrentUser() {
    if (this.isProxyMode) return this._proxy('getCurrentUser', []);
    const session = await this._readSession();
    return session?.user || null;
  }

  // ── ADMIN AUTHORITY ────────────────────────────────────────────────────────
  async isAdmin() {
    if (this.isProxyMode) return this._proxy('isAdmin', []);
    try {
      const res = await this._fetch('admin_users?select=user_id&limit=1');
      return Array.isArray(res) && res.length > 0;
    } catch {
      return false;
    }
  }

  _getAdminSessionToken() {
    if (this._adminSessionToken) return this._adminSessionToken;
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem('lf_admin_token') || null;
      }
    } catch {}
    return null;
  }

  async adminVerifyPin(pinHash) {
    if (this.isProxyMode) return this._proxy('adminVerifyPin', [pinHash]);
    try {
      const res = await this._fetch('rpc/admin_verify_pin', {
        method: 'POST',
        body: { p_pin_hash: pinHash },
      });
      if (res && res.ok && res.session_token) {
        this._adminSessionToken = res.session_token;
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('lf_admin_token', res.session_token);
          }
        } catch {}
        return { ok: true, session_token: res.session_token };
      }
      return {
        ok: false,
        locked: Boolean(res?.locked),
        message: res?.message || 'Senha incorreta.',
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Erro ao validar senha.' };
    }
  }

  async adminGetMetrics() {
    if (this.isProxyMode) return this._proxy('adminGetMetrics', []);
    return await this._fetch('rpc/admin_get_system_metrics', {
      method: 'POST',
      body: { p_session_token: this._getAdminSessionToken() },
    });
  }

  async adminListUsers() {
    if (this.isProxyMode) return this._proxy('adminListUsers', []);
    return await this._fetch('rpc/admin_list_users', {
      method: 'POST',
      body: { p_session_token: this._getAdminSessionToken() },
    }) || [];
  }

  async adminResetUserDeck(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminResetUserDeck', [targetUserId]);
    this._invalidateReadCache();
    return await this._fetch('rpc/admin_reset_user_deck', {
      method: 'POST',
      body: {
        p_session_token: this._getAdminSessionToken(),
        p_target_user_id: targetUserId,
      },
    });
  }

  async adminResetAllDecks() {
    if (this.isProxyMode) return this._proxy('adminResetAllDecks', []);
    this._invalidateReadCache();
    return await this._fetch('rpc/admin_reset_all_decks', {
      method: 'POST',
      body: { p_session_token: this._getAdminSessionToken() },
    });
  }

  async adminDeleteUser(targetUserId) {
    if (this.isProxyMode) return this._proxy('adminDeleteUser', [targetUserId]);
    this._invalidateReadCache();
    return await this._fetch('rpc/admin_delete_user', {
      method: 'POST',
      body: {
        p_session_token: this._getAdminSessionToken(),
        p_target_user_id: targetUserId,
      },
    });
  }

  async adminClearErrors() {
    if (this.isProxyMode) return this._proxy('adminClearErrors', []);
    return await this._fetch('rpc/admin_clear_client_errors', {
      method: 'POST',
      body: { p_session_token: this._getAdminSessionToken() },
    });
  }

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  _normalizeSettingValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }

  async getSetting(key) {
    if (this.isProxyMode) return this._proxy('getSetting', [key]);
    const res = await this._fetch(`settings?key=eq.${encodeURIComponent(key)}`);
    if (res && res.length > 0) {
      return this._normalizeSettingValue(res[0].value);
    }
    return null;
  }

  async getSettings(keys) {
    const unique = [...new Set((keys || []).filter(Boolean))];
    if (unique.length === 0) return {};
    if (this.isProxyMode) return this._proxy('getSettings', [unique]);
    const encoded = unique.map(k => encodeURIComponent(k));
    const rows = await this._fetch(`settings?select=key,value&key=in.(${encoded.join(',')})`) || [];
    const map = {};
    rows.forEach(row => { map[row.key] = this._normalizeSettingValue(row.value); });
    return map;
  }

  async setSetting(key, value) {
    this._srsCache = null; // qualquer setting nova invalida o cache do SRS
    if (this.isProxyMode) return this._proxy('setSetting', [key, value]);
    const res = await this._fetch('settings?on_conflict=user_id,key', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: { key, value }
    });
    return !!res;
  }

  // ── PALAVRAS E CARDS ──────────────────────────────────────────────────────
  async saveWord(wordData) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('saveWord', [wordData]);
    const lang = wordData.lang || 'en';
    const word = (wordData.word || '').trim();
    if (!word) throw new Error('Word é obrigatório');

    const payload = {
      word,
      lang,
      translation: wordData.translation,
      context_sentence: wordData.context_sentence,
      added_at: new Date(wordData.added_at || Date.now()).toISOString(),
      phonetic: wordData.phonetic || null,
      tags: Array.isArray(wordData.tags)
        ? wordData.tags
        : (wordData.tags ? wordData.tags.split(',').map(t => t.trim()) : null)
    };

    // Aceita tanto 'chunks' (word-popup) quanto 'ai_chunks' (backfill/re-save)
    if (wordData.ai_chunks !== undefined) payload.ai_chunks = wordData.ai_chunks;
    else if (wordData.chunks !== undefined) payload.ai_chunks = wordData.chunks;
    if (wordData.category !== undefined) payload.category = wordData.category;
    if (wordData.video_url !== undefined) payload.video_url = wordData.video_url;
    if (wordData.video_start_ms !== undefined) payload.video_start_ms = wordData.video_start_ms;
    if (wordData.video_end_ms !== undefined) payload.video_end_ms = wordData.video_end_ms;
    if (wordData.video_title !== undefined) payload.video_title = wordData.video_title;
    if (wordData.synonyms !== undefined) payload.synonyms = wordData.synonyms;
    if (wordData.antonyms !== undefined) payload.antonyms = wordData.antonyms;
    if (wordData.definition !== undefined) payload.definition = wordData.definition;
    if (wordData.explanation !== undefined) payload.explanation = wordData.explanation;
    if (wordData.platform !== undefined) payload.platform = wordData.platform;
    if (wordData.level !== undefined) payload.level = wordData.level;
    if (wordData.snapshot !== undefined) payload.snapshot = wordData.snapshot;
    
    let savedWord = null;
    let isNewCard = false;

    // Via atômica prioritária: save_word_with_card cria palavra e card juntos na mesma transação
    try {
      const atomicResult = await this._fetch('rpc/save_word_with_card', {
        method: 'POST',
        body: { p_word: payload }
      });
      if (atomicResult?.ok && atomicResult.word) {
        savedWord = atomicResult.word;
        isNewCard = Boolean(atomicResult.is_new_card);
      }
    } catch (e) {
      // Fallback para rollout resiliente caso RPC falhe
      if (e?.status !== 404 && e?.code !== 'PGRST202') throw e;
    }

    if (!savedWord) {
      const res = await this._fetch('words?on_conflict=user_id,word,lang', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: payload
      });

      if (!res || !res.length) return { ok: false };
      savedWord = res[0];

      const existingCard = await this.getCardByWordId(savedWord.id);
      if (!existingCard) {
        await this._fetch('rpc/create_card_for_word', {
          method: 'POST',
          body: { p_word_id: savedWord.id }
        });
        isNewCard = true;
      } else {
        isNewCard = false;
      }
    }

    // A7 do backlog: TETO DO COFRE. Limite de novos/dia controla a
    // velocidade da dívida; o teto controla o TAMANHO. Cofre cheio: salvar
    // continua funcionando, mas a palavra nova entra SUSPENSA (tag
    // lf:espera) e não gera revisão até o aluno abrir vaga aposentando uma
    // dominada — salvar vira escolha, não reflexo. lf_vault_cap=0 desliga.
    let waitingForSlot = false;
    if (isNewCard) {
      try {
        const capRaw = await this.getSetting('lf_vault_cap');
        const cap = capRaw === null || capRaw === undefined || capRaw === ''
          ? 300 : Math.max(0, Number(capRaw) || 0);
        if (cap > 0) {
          const cards = await this.getAllCards();
          const active = (cards || []).filter(c => !c.suspended).length;
          if (active > cap) { // o card recém-criado já conta no total
            const created = await this.getCardByWordId(savedWord.id);
            if (created && !created.suspended) {
              await this.setCardSuspended(created.id, true);
              const tags = Array.isArray(savedWord.tags) ? savedWord.tags : [];
              if (!tags.includes('lf:espera')) {
                await this.addTagsToWord(savedWord.id, [...tags, 'lf:espera']).catch(() => {});
              }
              waitingForSlot = true;
            }
          }
        }
      } catch { /* o teto nunca pode bloquear o save */ }
    }

    return { ok: true, id: savedWord.id, isNew: isNewCard, waitingForSlot };
  }

  async getWord(word, lang = 'en') {
    if (this.isProxyMode) return this._proxy('getWord', [word, lang]);
    const res = await this._fetch(`words?select=${WORD_SELECT}&word=eq.${encodeURIComponent(word)}&lang=eq.${encodeURIComponent(lang)}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async getWordById(id) {
    if (this.isProxyMode) return this._proxy('getWordById', [id]);
    const res = await this._fetch(`words?select=${WORD_SELECT}&id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteWord(id) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('deleteWord', [id]);
    try {
      await this._fetch('rpc/delete_word_safely', {
        method: 'POST',
        body: { p_word_id: id },
      });
      return true;
    } catch (error) {
      // Janela de rollout: o cliente novo pode chegar antes da migration.
      // Só a ausência explícita da RPC permite o fallback legado; erros de
      // ownership, histórico ou permissão nunca viram DELETE direto.
      if (error?.status !== 404 && error?.code !== 'PGRST202') throw error;
      await this._fetch(`words?id=eq.${id}`, { method: 'DELETE' });
      return true;
    }
  }

  // Editor do Cofre (Onda 2.3): corrige tradução/frase/categoria/nível SEM
  // apagar o card — PATCH por id (não é upsert por word/lang) pra nunca
  // arriscar duplicar a palavra nem perder o histórico FSRS do card.
  async updateWord(id, patch) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('updateWord', [id, patch]);
    // video_start/end_ms: ajuste fino do trecho no Estudo (17/07) — o aluno
    // corrige a janela do loop e a correção persiste no card para sempre.
    const allowed = ['word', 'translation', 'context_sentence', 'category', 'level', 'phonetic', 'mnemonic', 'tags', 'video_start_ms', 'video_end_ms'];
    const body = {};
    allowed.forEach(k => { if (patch && patch[k] !== undefined) body[k] = patch[k]; });
    if (Object.keys(body).length === 0) return { ok: true };
    await this._fetch(`words?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body,
    });
    return { ok: true };
  }

  async getAllWords(limit = 0) {
    // Stale-while-revalidate (Onda 4): cache "fresco" (<30s) serve na hora
    // sem rede nenhuma, igual antes. A diferença é o que acontece quando o
    // cache VENCEU: antes disso bloqueava a tela esperando a rede de novo —
    // era o gargalo real ao trocar de aba depois de 30s parado. Agora serve
    // o dado antigo IMEDIATAMENTE e revalida em segundo plano (deduplicado
    // por _wordsRefreshing, pra não disparar N requests em paralelo se a
    // view chamar getAllWords() várias vezes enquanto ainda está stale).
    if (limit === 0 && this._wordsCache) {
      if (Date.now() - this._wordsCache.ts >= 30000 && !this._wordsRefreshing) {
        this._wordsRefreshing = this._fetchWords(0).finally(() => { this._wordsRefreshing = null; });
        this._wordsRefreshing.catch(() => {});
      }
      return this._wordsCache.data;
    }
    return this._fetchWords(limit);
  }

  async _fetchWords(limit) {
    // Auditoria 2026-07-12: uma escrita (updateWord/deleteWord/logReview…)
    // chama _invalidateReadCache() enquanto um refresh SWR desta MESMA
    // lista já estava em voo. Sem o check de geração abaixo, esse fetch
    // antigo resolvia DEPOIS da invalidação e reescrevia o cache com dado
    // pré-escrita, marcado como "fresco" por mais 30s — a edição "sumia"
    // até o cache vencer nauralmente. _cacheGeneration captura o snapshot
    // no início do fetch; só grava se nada invalidou nesse meio-tempo.
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllWords', [limit]);
    else {
      let query = `words?select=${WORD_SELECT}&order=added_at.desc`;
      if (limit > 0) query += `&limit=${limit}`;
      data = await this._fetch(query);
    }
    if (limit === 0 && gen === this._cacheGeneration) this._wordsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  _invalidateReadCache(target = 'all') {
    this._cacheGeneration = (this._cacheGeneration || 0) + 1;
    if (target === 'all' || target === 'cards') this._cardsCache = null;
    if (target === 'all' || target === 'words') this._wordsCache = null;
    if (target === 'all' || target === 'sentences') this._sentencesCache = null;
    if (target === 'all' || target === 'known_words') this._knownWordsCache = null;
    if (target === 'all' || target === 'stories') {
      this._storiesCache = null;
      this._readerStoriesRepo?.invalidateCache?.();
    }
  }

  // Onda 4: aceita paginação real (limit/offset viram LIMIT/OFFSET no
  // Postgres) — sem eles, mantém o comportamento antigo (lista completa via
  // cache SWR de getAllWords/getAllCards), usado por getWordsByLetter.
  // Também corrige um bug latente: a versão anterior ignorava o `category`
  // por completo (retornava tudo, sem filtrar) — nunca foi notado porque
  // não tinha nenhum chamador na UI ainda.
  async getWordsByCategory(category, { limit, offset } = {}) {
    if (this.isProxyMode) return this._proxy('getWordsByCategory', [category, { limit, offset }]);

    if (typeof limit === 'number') {
      let query = `words?select=${WORD_SELECT}&order=word.asc&limit=${limit}&offset=${offset || 0}`;
      if (category && category !== 'all') query += `&category=eq.${encodeURIComponent(category)}`;
      const words = await this._fetch(query) || [];
      if (words.length === 0) return [];
      const ids = words.map(w => w.id);
      const cards = await this._fetch(`cards?word_id=in.(${ids.join(',')})&select=word_id,status,reps`) || [];
      const cardMap = {};
      cards.forEach(c => cardMap[c.word_id] = c);
      return words.map(w => ({
        ...w,
        reps: cardMap[w.id]?.reps || 0,
        status: cardMap[w.id]?.status || 'new'
      }));
    }

    const words = await this.getAllWords();
    const cards = await this.getAllCards();
    const cardMap = {};
    cards.forEach(c => cardMap[c.word_id] = c);
    const filtered = category && category !== 'all' ? words.filter(w => w.category === category) : words;

    return filtered.map(w => ({
      ...w,
      reps: cardMap[w.id]?.reps || 0,
      status: cardMap[w.id]?.status || 'new'
    })).sort((a, b) => (a.word || '').localeCompare(b.word || ''));
  }

  async getWordsByLetter(letter, category) {
    if (this.isProxyMode) return this._proxy('getWordsByLetter', [letter, category]);
    const allWords = await this.getWordsByCategory(category || 'all');
    if (!letter) return allWords;
    return allWords.filter(w => (w.word || '').toUpperCase().startsWith(letter.toUpperCase()));
  }

  async getAllCards() {
    // Mesma estratégia SWR de getAllWords (Onda 4) — ver comentário lá.
    if (this._cardsCache) {
      if (Date.now() - this._cardsCache.ts >= 30000 && !this._cardsRefreshing) {
        this._cardsRefreshing = this._fetchCards().finally(() => { this._cardsRefreshing = null; });
        this._cardsRefreshing.catch(() => {});
      }
      return this._cardsCache.data;
    }
    return this._fetchCards();
  }

  async _fetchCards() {
    const gen = this._cacheGeneration; // ver comentário em _fetchWords
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllCards', []);
    else data = await this._fetch('cards?select=*');
    if (gen !== this._cacheGeneration) return data || [];
    this._cardsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  // ── HISTÓRIAS (delegadas ao ReaderStoriesRepository) ─────────────────────
  async saveStory(story) {
    return this._readerStoriesRepo.saveStory(story);
  }

  async getStories(limit = 50) {
    return this._readerStoriesRepo.getStories(limit);
  }

  async _fetchStories(limit = 50) {
    return this._readerStoriesRepo._fetchStories(limit);
  }

  async deleteStory(id) {
    return this._readerStoriesRepo.deleteStory(id);
  }

  // minutesAhead: "learn ahead" do Anki — inclui cards de aprendizado que
  // vencem nos próximos N minutos (permite fechar a sessão de verdade).
  async getCardsDue(limit = 50, includeWordData = true, minutesAhead = 0) {
    if (this.isProxyMode) return this._proxy('getCardsDue', [limit, includeWordData, minutesAhead]);
    const horizon = new Date(Date.now() + minutesAhead * 60000).toISOString();
    const select = includeWordData ? `select=*,words(${WORD_SELECT})&` : '';
    // suspended filtrado NO BANCO (antes vinha tudo e filtrava no cliente)
    const query = `cards?${select}due_date=lte.${encodeURIComponent(horizon)}&suspended=is.false&order=due_date.asc&limit=${limit}`;

    const cards = await this._fetch(query);
    if (!cards) return [];

    if (includeWordData) {
      cards.forEach(c => {
        c.wordData = c.words;
        delete c.words;
      });
    }
    return cards;
  }

  async getCardsDueCount(minutesAhead = 0) {
    if (this.isProxyMode) return this._proxy('getCardsDueCount', [minutesAhead]);
    const horizon = new Date(Date.now() + minutesAhead * 60000).toISOString();
    const query = `cards?select=id&due_date=lte.${encodeURIComponent(horizon)}&suspended=is.false`;
    const res = await this._fetch(query);
    return Array.isArray(res) ? res.length : 0;
  }

  // Busca cada estado com seu próprio limite. Uma grande quantidade de cards
  // novos nunca pode consumir a janela SQL destinada a reviews já vencidos.
  async getStudyCards({ newLimit = 0, reviewLimit = 0, topic = null } = {}) {
    if (this.isProxyMode) return this._proxy('getStudyCards', [{ newLimit, reviewLimit, topic }]);

    const horizon = encodeURIComponent(new Date().toISOString());
    const safeNewLimit = Math.min(1000, Math.max(0, Math.floor(Number(newLimit) || 0)));
    const safeReviewLimit = Math.min(1000, Math.max(0, Math.floor(Number(reviewLimit) || 0)));
    const topicFilter = typeof topic === 'string' && topic.trim() ? topic.trim() : null;
    const select = topicFilter ? `select=*,words!inner(${WORD_SELECT})&` : `select=*,words(${WORD_SELECT})&`;
    const category = topicFilter ? `&words.category=eq.${encodeURIComponent(topicFilter)}` : '';
    const query = (status, limit) => `cards?${select}status=${status}&due_date=lte.${horizon}&suspended=is.false${category}&order=due_date.asc&limit=${limit}`;

    const [learning, reviews, newCards] = await Promise.all([
      this._fetch(query('eq.learning', 1000)),
      safeReviewLimit ? this._fetch(query('in.(review,mature)', safeReviewLimit)) : Promise.resolve([]),
      safeNewLimit ? this._fetch(query('eq.new', safeNewLimit)) : Promise.resolve([]),
    ]);
    if (!learning || !reviews || !newCards) return null;

    const cards = [...learning, ...reviews, ...newCards];
    cards.forEach(card => {
      card.wordData = card.words;
      delete card.words;
    });
    return cards;
  }

  // Contadores do dia para os limites diários (novas/dia e revisões/dia)
  async getTodayCounts() {
    if (this.isProxyMode) return this._proxy('getTodayCounts', []);
    const { start, end } = localDayBounds();
    const [logToday, introduced, undosToday] = await Promise.all([
      // O teto diário é de revisões propriamente ditas. Um passo de card novo
      // ou learning não consome esse orçamento. previous_status é gravado no
      // servidor pela RPC, antes de alterar o card; nunca vem do cliente.
      this._fetch(`review_log?previous_status=in.(review,mature)&ts=gte.${encodeURIComponent(start.toISOString())}&ts=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`cards?introduced_at=gte.${encodeURIComponent(start.toISOString())}&introduced_at=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`card_review_undos?created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lt.${encodeURIComponent(end.toISOString())}&select=review_log_id`).catch(() => []),
    ]);
    const undoneSet = new Set((undosToday || []).map((u) => u.review_log_id).filter(Boolean));
    const activeReviews = (logToday || []).filter((l) => !undoneSet.has(l.id));
    return {
      reviewsToday: activeReviews.length,
      newIntroducedToday: (introduced || []).length,
    };
  }

  async buryCard(cardId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('buryCard', [cardId]);
    return this._fetch('rpc/bury_card', {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async setCardSuspended(cardId, suspended = true) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('setCardSuspended', [cardId, suspended]);
    return this._fetch(`rpc/${suspended ? 'suspend_card' : 'restore_card'}`, {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async restoreCardState(cardId, state) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('restoreCardState', [cardId, state]);
    return this._fetch('rpc/restore_card_state', {
      method: 'POST',
      body: { p_card_id: cardId, p_state: state },
    });
  }

  // Resetar card (Forget / Reset do Anki): volta o card ao estado 'new' sem apagar histórico
  async resetCardToNew(cardId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('resetCardToNew', [cardId]);
    return this._fetch('rpc/reset_card_to_new', {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  // ── ESTATÍSTICAS E LOGS ───────────────────────────────────────────────────

  async getHistory(limit = 100) {
    if (this.isProxyMode) return this._proxy('getHistory', [limit]);
    return (await this._fetch(`words?select=${WORD_SELECT}&order=added_at.desc&limit=${limit}`)) || [];
  }

  async getStats() {
    if (this.isProxyMode) return this._proxy('getStats', []);
    const [words, sentences, cards, log, sessions, userStats] = await Promise.all([
      this.getAllWords(),
      this.getAllSentences(),
      this.getAllCards(),
      this.getReviewLog(30),
      this.getSessions(30),
      this.getUserStats().catch(() => null),
    ]);

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const now = new Date().toISOString();
    // "Para revisar" separa learning (volta em minutos — NÃO é dívida do dia)
    // de review/new. Era a sensação de "sempre cobrando": o contador somava
    // cards de learning steps que venciam minutos depois da sessão.
    const dueAll = cards.filter(c => !c.suspended && c.due_date <= now);
    const dueLearning = dueAll.filter(c => c.status === 'learning').length;
    const dueCount = dueAll.length;

    const byStatus = { new: 0, learning: 0, review: 0, mature: 0 };
    cards.forEach(c => {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
    });

    const today = localDateKey();
    const todaySecs = sessions
      .filter((session) => session.date === today)
      .reduce((sum, session) => sum + Number(session.seconds || 0), 0);
    const totalSecs = sessions.reduce((acc, s) => acc + (s.seconds || 0), 0);

    const byCEFR = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    const cardMap = {};
    cards.forEach((c) => cardMap[c.word_id] = c);

    words.forEach((w) => {
      const card = cardMap[w.id];
      if (!card || card.status === 'new') return;

      if (w.level && byCEFR[w.level] !== undefined) {
        byCEFR[w.level]++;
      } else {
        if (w.word.length <= 3) byCEFR.A1++;
        else if (w.word.length <= 5) byCEFR.A2++;
        else if (w.word.length <= 7) byCEFR.B1++;
        else if (w.word.length <= 9) byCEFR.B2++;
        else if (w.word.length <= 11) byCEFR.C1++;
        else byCEFR.C2++;
      }
    });

    const goodRevs = log.filter((r) => r.quality >= 3).length;
    const retention = log.length > 0 ? Math.round((goodRevs / log.length) * 100) : 0;

    return {
      totalWords,
      totalSentences,
      dueCards: dueCount,
      dueLearning,
      // Fonte única da ofensiva: user_stats (trigger do Postgres). O cálculo
      // local é só fallback offline — eram DUAS verdades divergentes.
      streak: userStats?.streak ?? this._calculateStreak(log, sessions),
      retention,
      byStatus,
      todaySecs,
      totalSecs,
      byCEFR,
      sessions,
      reviewLog: log,
      userStats,
    };
  }

  async getStatsSnapshot(days = 60) {
    if (this.isProxyMode) return this._proxy('getStatsSnapshot', [days]);
    // Estatísticas são uma tela de conferência, não um feed otimista: sempre
    // descarte SWR e leia o banco sob o JWT da sessão atual.
    this._invalidateReadCache('cards');
    const [cards, reviewLog, sessions] = await Promise.all([
      this.getAllCards(),
      this.getReviewLog(days),
      this.getSessions(days),
    ]);
    return { cards, reviewLog, sessions };
  }

  _calculateStreak(logs, sessions) {
    const dates = new Set();
    if (logs) logs.forEach((l) => dates.add(l.ts ? localDateKey(l.ts) : l.date));
    if (sessions)
      sessions.forEach((s) => {
        if (s.seconds >= 60) dates.add(s.date);
      });

    let streak = 0;
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      const ds = localDateKey(d);
      if (dates.has(ds)) {
        streak++;
      } else if (i > 0) {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // Onda 9: perfis de SRS por categoria (phrasal/idiom/slang/word) —
  // reaproveita o MESMO settings k/v, só com chave sufixada ":categoria"
  // (ex.: "lf_srs_retention:idiom"), sem tabela nem coluna nova. Só as 3
  // configs que fazem diferença pedagógica real por categoria são
  // sobrepostas (retenção, learning steps, intervalo de graduação) — leech
  // e limites diários continuam globais de propósito (são sobre volume da
  // sessão, não sobre a categoria do conteúdo). Sem `category`, o
  // comportamento é IDÊNTICO ao de antes (nenhuma chamada existente muda).
  static SRS_OVERRIDABLE_KEYS = ['lf_srs_retention', 'learning_steps', 'graduating_interval'];

  async getSRSSettings(category) {
    if (this.isProxyMode) return this._proxy('getSRSSettings', [category]);
    // GARGALO CORRIGIDO: eram 11 chamadas REST sequenciais A CADA avaliação
    // de card (a "demora ao clicar em Difícil"). Agora: 1 request em lote +
    // cache de 60s (por categoria), invalidado quando qualquer setting é gravada.
    const cacheKey = category || '__global__';
    if (this._srsCache && this._srsCache.key === cacheKey && Date.now() - this._srsCache.ts < 60000) {
      return this._srsCache.value;
    }

    const baseKeys = ['graduating_interval', 'easy_interval', 'initial_ease', 'max_interval',
      'leech_threshold', 'easy_bonus', 'interval_modifier', 'lapse_modifier',
      'leech_action', 'lf_srs_retention', 'learning_steps', 'relearning_steps',
      'new_per_day', 'max_reviews_per_day', 'srs_new_order', 'srs_review_order'];
    const catKeys = category ? Database.SRS_OVERRIDABLE_KEYS.map(k => `${k}:${category}`) : [];
    // Onda 9 (auditoria de bugs): `category` chega da coluna words.category,
    // que não é validada como enum no banco (a checagem contra a lista
    // fixa só roda no classificador da extensão) — sem encode, uma vírgula
    // ou parêntese na categoria quebraria o filtro in.(...) do PostgREST.
    // O método irmão (setSRSCategoryOverride) já fazia isso; faltava aqui.
    const keys = [...baseKeys, ...catKeys].map(encodeURIComponent);
    const map = {};
    const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
    (rows || []).forEach(r => { map[r.key] = r.value; });
    // Override por categoria vence o valor global, só se estiver de fato gravado
    if (category) {
      Database.SRS_OVERRIDABLE_KEYS.forEach(k => {
        const catVal = map[`${k}:${category}`];
        if (catVal !== undefined && catVal !== null && catVal !== '') map[k] = catVal;
      });
    }

    const parsedNewPerDay = Number(map.new_per_day ?? 20);
    const parsedMaxRevPerDay = Number(map.max_reviews_per_day ?? 200);
    const value = {
      gradInt: Number(map.graduating_interval) || 1,
      easyInt: Number(map.easy_interval) || 4,
      initEase: (Number(map.initial_ease) || 250) / 100,
      maxInt: Number(map.max_interval) || 36500,
      leechThresh: Number(map.leech_threshold) || 8,
      easyBonus: (Number(map.easy_bonus) || 130) / 100,
      intMod: (Number(map.interval_modifier) || 100) / 100,
      lapseMod: (Number(map.lapse_modifier) || 0) / 100,
      leechAction: map.leech_action || 'tag',
      // Retenção desejada do FSRS (0.7-0.97): mais alto = revisões mais frequentes
      retention: Math.min(0.97, Math.max(0.7, Number(map.lf_srs_retention) || 0.9)),
      learningSteps: String(map.learning_steps || '1 10')
        .replace(/m/gi, '')
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => n > 0),
      relearningSteps: String(map.relearning_steps || '10')
        .replace(/m/gi, '')
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => n > 0),
      // Limites diários (paridade Anki): controlam a fila de estudo
      newPerDay: Number.isFinite(parsedNewPerDay)
        ? Math.min(20, Math.max(0, parsedNewPerDay))
        : 20,
      maxRevPerDay: Number.isFinite(parsedMaxRevPerDay)
        ? Math.min(1000, Math.max(1, parsedMaxRevPerDay))
        : 200,
      newOrder: map.srs_new_order || 'sequential',
      reviewOrder: map.srs_review_order || 'due',
    };
    if (value.learningSteps.length === 0) value.learningSteps = [1, 10];
    if (value.relearningSteps.length === 0) value.relearningSteps = [10];
    this._srsCache = { key: cacheKey, value, ts: Date.now() };
    return value;
  }

  // Onda 9: overrides de SRS por categoria salvos/lidos pela Config (chaves
  // sufixadas ":categoria" no mesmo k/v de settings). category=null limpa.
  async getSRSCategoryOverrides(category) {
    if (this.isProxyMode) return this._proxy('getSRSCategoryOverrides', [category]);
    const keys = Database.SRS_OVERRIDABLE_KEYS.map(k => encodeURIComponent(`${k}:${category}`));
    const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
    const out = {};
    (rows || []).forEach(r => {
      const base = r.key.split(':')[0];
      out[base] = r.value;
    });
    return out;
  }

  async setSRSCategoryOverride(category, key, value) {
    if (this.isProxyMode) return this._proxy('setSRSCategoryOverride', [category, key, value]);
    if (!Database.SRS_OVERRIDABLE_KEYS.includes(key)) throw new Error(`Chave não sobrescrevível por categoria: ${key}`);
    const fullKey = `${key}:${category}`;
    if (value === null || value === '') {
      this._srsCache = null;
      await this._fetch(`settings?key=eq.${encodeURIComponent(fullKey)}`, { method: 'DELETE' });
      return true;
    }
    return this.setSetting(fullKey, value);
  }

  // ── FSRS-4.5 (algoritmo do Anki moderno) ─────────────────────────────────
  // Parâmetros default publicados do FSRS-4.5. quality: 1=Errei 2=Difícil 3=Bom 4=Fácil
  // Cards novos/em aprendizado seguem learning steps (como no Anki); FSRS
  // governa o agendamento de review/mature e é semeado na graduação.
  static FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
    1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  static FSRS_DECAY = -0.5;
  static FSRS_FACTOR = Math.pow(0.9, 1 / -0.5) - 1; // 19/81

  _fsrsInitDifficulty(q) {
    const w = Database.FSRS_W;
    return Math.min(10, Math.max(1, w[4] - (q - 3) * w[5]));
  }

  _fsrsInitStability(q) {
    return Math.max(0.1, Database.FSRS_W[q - 1]);
  }

  _fsrsRetrievability(elapsedDays, stability) {
    const s = Math.max(0.1, Number(stability) || 0.1);
    return Math.pow(1 + Database.FSRS_FACTOR * elapsedDays / s, Database.FSRS_DECAY);
  }

  _fsrsInterval(stability, retention) {
    const s = Math.max(0.1, Number(stability) || 0.1);
    const ret = Math.min(0.99, Math.max(0.7, Number(retention) || 0.9));
    return (s / Database.FSRS_FACTOR) * (Math.pow(ret, 1 / Database.FSRS_DECAY) - 1);
  }

  _fsrsNextDifficulty(d, q) {
    const w = Database.FSRS_W;
    const dPrime = d - w[6] * (q - 3);
    const meanReverted = w[7] * this._fsrsInitDifficulty(4) + (1 - w[7]) * dPrime;
    return Math.min(10, Math.max(1, meanReverted));
  }

  _fsrsNextStability(d, s, r, q) {
    const w = Database.FSRS_W;
    if (q === 1) {
      // Esqueceu: estabilidade pós-lapso
      return Math.max(0.1, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
    }
    const hardPenalty = q === 2 ? w[15] : 1;
    const easyBonus = q === 4 ? w[16] : 1;
    return Math.max(0.1, s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
      (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus));
  }

  _calculateNextState(card, quality, settings, now = Date.now()) {
    const prevStatus = card.status || 'new';
    const learningSteps = settings.learningSteps;
    const relearningSteps = settings.relearningSteps?.length ? settings.relearningSteps : [10];
    const retention = settings.retention;
    const maxInt = settings.maxInt;

    let nextStatus;
    let nextInterval;
    let nextStepIndex = card.step_index || 0;
    let nextLapses = card.lapses || 0;
    let preLapseInterval = Number(card.pre_lapse_interval || 0);
    const nextReps = (card.reps || 0) + 1;

    // Estado FSRS: semeia a partir do histórico se o card veio do SM-2 antigo
    let stability = (Number.isFinite(Number(card.stability)) && Number(card.stability) > 0) ? Number(card.stability) : null;
    let difficulty = (Number.isFinite(Number(card.difficulty)) && Number(card.difficulty) > 0) ? Number(card.difficulty) : null;

    const elapsedDays = card.last_review
      ? Math.max(0, (now - new Date(card.last_review).getTime()) / 86400000)
      : 0;
    const isRelearning = prevStatus === 'learning' && preLapseInterval > 0;

    if (prevStatus === 'new' || prevStatus === 'learning') {
      const activeSteps = isRelearning ? relearningSteps : learningSteps;
      // Learning steps (minutos), como no Anki com FSRS habilitado
      if (difficulty === null) difficulty = this._fsrsInitDifficulty(quality);
      if (stability === null) stability = this._fsrsInitStability(quality);

      if (quality === 1) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = activeSteps[0] / 1440;
      } else if (quality === 2) {
        // Semântica do Anki: Difícil repete o passo atual e nunca gradua o card.
        // No primeiro passo com dois ou mais steps, usa a média entre o passo
        // atual e o próximo; com um único step, usa 1,5× o intervalo.
        nextStatus = 'learning';
        nextStepIndex = prevStatus === 'new' ? 0 : Math.min(nextStepIndex, activeSteps.length - 1);
        if (activeSteps.length === 1) {
          nextInterval = (activeSteps[0] * 1.5) / 1440;
        } else if (nextStepIndex === 0) {
          nextInterval = ((activeSteps[0] + activeSteps[1]) / 2) / 1440;
        } else {
          nextInterval = activeSteps[nextStepIndex] / 1440;
        }
      } else if (quality === 4) {
        // Fácil: gradua direto com bônus do FSRS.
        // easy_interval (config) é o piso; interval_modifier escala tudo.
        if (!isRelearning) {
          stability = this._fsrsInitStability(4);
          difficulty = this._fsrsInitDifficulty(4);
        }
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = Math.min(maxInt, Math.max(settings.easyInt || 4,
          this._fsrsInterval(stability, retention) * settings.intMod));
      } else {
        // Bom: avança um step; gradua no fim dos steps.
        // graduating_interval (config) é o piso da graduação.
        nextStepIndex = prevStatus === 'new' ? 1 : nextStepIndex + 1;
        if (nextStepIndex >= activeSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          nextInterval = Math.min(maxInt, Math.max(settings.gradInt || 1,
            this._fsrsInterval(stability, retention) * settings.intMod));
        } else {
          nextStatus = 'learning';
          nextInterval = activeSteps[nextStepIndex] / 1440;
        }
      }
    } else {
      // review/mature: FSRS puro
      if (stability === null) stability = Math.max(card.interval || 1, 0.1); // legado SM-2
      if (difficulty === null) difficulty = this._fsrsInitDifficulty(3);

      const r = this._fsrsRetrievability(Math.max(elapsedDays, 0.01), stability);
      const previousDifficulty = difficulty;
      difficulty = this._fsrsNextDifficulty(previousDifficulty, quality);
      stability = this._fsrsNextStability(previousDifficulty, stability, r, quality);

      if (quality === 1) {
        preLapseInterval = Math.max(0, Number(card.interval || 0));
        nextLapses++;
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = relearningSteps[0] / 1440;
      } else {
        // interval_modifier (config) escala o intervalo do FSRS (100% = neutro)
        nextInterval = Math.max(1, this._fsrsInterval(stability, retention) * settings.intMod);
        nextInterval = Math.min(nextInterval, maxInt);
        nextStatus = nextInterval >= 21 ? 'mature' : 'review';
      }
    }

    // Sem fuzz aleatório no cliente: ele fazia a prévia e a gravação chamarem
    // cálculos diferentes, exibindo um intervalo e salvando outro. A data de
    // vencimento já é normalizada ao dia, portanto o ganho operacional do fuzz
    // não compensava a quebra de confiança na interface.

    let nextDueDate;
    if (nextInterval >= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + Math.round(nextInterval));
      d.setHours(0, 0, 0, 0);
      nextDueDate = d.toISOString();
    } else {
      nextDueDate = new Date(now + Math.round(nextInterval * 24 * 60 * 60 * 1000)).toISOString();
    }

    return {
      ...card,
      interval: nextInterval,
      status: nextStatus,
      step_index: nextStepIndex,
      ease_factor: card.ease_factor || 2.5, // mantido por compat; FSRS não usa
      stability,
      difficulty,
      pre_lapse_interval: preLapseInterval,
      reps: nextReps,
      lapses: nextLapses,
      due_date: nextDueDate,
      last_review: new Date(now).toISOString(),
    };
  }

  async predictNextState(card, quality, category) {
    if (this.isProxyMode) return this._proxy('predictNextState', [card, quality, category]);
    const settings = await this.getSRSSettings(category);
    const clone = JSON.parse(JSON.stringify(card));
    return this._calculateNextState(clone, quality, settings);
  }

  async predictNextInterval(card, quality, category) {
    const nextState = await this.predictNextState(card, quality, category);
    return nextState.interval;
  }

  async logReview(cardId, quality, category, plannedState = null, operationId = null) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality, category, plannedState, operationId]);

    // A prévia continua sendo calculada no cliente para mostrar os intervalos
    // antes do clique. A gravação, porém, envia somente intenção: o servidor
    // relê o card sob lock e calcula toda a transição SRS autoritativamente.
    const clientReviewId = operationId || createOperationId();
    const saved = await this._fetch('rpc/record_card_review', {
      method: 'POST',
      body: {
        p_card_id: cardId,
        p_quality: quality,
        p_state: null,
        p_client_review_id: clientReviewId,
      },
    });
    if (!saved?.card) throw new Error('Servidor não devolveu o card revisado');
    const savedCard = saved.card;

    // prevCard permite reverter o agendamento (undo); card é o estado NOVO —
    // a fila de sessão usa pra reagendar cards em aprendizado (learning steps)
    const idempotent = Boolean(saved?.idempotent);
    return {
      ok: true,
      outcome: saved?.outcome || (idempotent ? 'duplicate' : 'accepted'),
      accepted: saved?.accepted !== false,
      eligible: saved?.eligible !== false,
      eligibilityReason: saved?.eligibility_reason || null,
      rewardReason: saved?.reward_reason || null,
      operationId: clientReviewId,
      persisted: true,
      idempotent,
      nextDue: new Date(savedCard.due_date).getTime(),
      prevCard: saved?.card_before || null,
      card: savedCard,
      reviewLogId: saved?.review_log_id || null,
      xpAwarded: idempotent ? 0 : Number(saved?.xp_awarded || 0),
    };
  }

  // Desfaz a última revisão: restaura o card ao estado anterior e apaga o
  // registro mais recente de review_log daquele card (Ctrl+Z do Anki).
  async undoReview(prevCard, reviewLogId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('undoReview', [prevCard, reviewLogId]);
    if (!prevCard || !prevCard.id || !reviewLogId) return { ok: false };

    // XP/streak e agendamento precisam voltar juntos. O cliente não pode mais
    // apagar o log diretamente, pois isso deixava XP creditado para trás.
    const res = await this._fetch('rpc/revert_card_review', {
      method: 'POST',
      body: { p_review_log_id: reviewLogId, p_previous_card: prevCard },
    });
    return {
      ok: true,
      xpReverted: Number(res?.xp_reverted || 0),
      card: res?.card || null,
    };
  }

  async getReviewLog(days = 30) {
    if (this.isProxyMode) return this._proxy('getReviewLog', [days]);
    const start = localDayBounds(addLocalDays(-(Math.max(1, days) - 1))).start;
    return (await this._fetch(`review_log?ts=gte.${encodeURIComponent(start.toISOString())}`)) || [];
  }

  async saveSentence(data) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('saveSentence', [data]);
    const original = String(data?.original || '').trim();
    if (!original) throw new Error('Frase original é obrigatória');
    const payload = {
      original,
      translation: data?.translation || null,
      analysis: data?.analysis || null,
      platform: data?.platform || null,
      video_url: data?.video_url || null,
      video_title: data?.video_title || null,
    };
    const res = await this._fetch('sentences', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: payload
    });
    return { ok: !!res, id: res?.[0]?.id };
  }

  async getAllSentences() {
    // Onda 7 (perf): mesma estratégia SWR de getAllWords/getAllCards — antes
    // esta lista era buscada inteira, sem cache, em TODA carga do Início (via
    // getStats()), crescendo a cada frase salva. Achado da auditoria de
    // performance do painel.
    if (this._sentencesCache) {
      if (Date.now() - this._sentencesCache.ts >= 30000 && !this._sentencesRefreshing) {
        this._sentencesRefreshing = this._fetchSentences().finally(() => { this._sentencesRefreshing = null; });
        this._sentencesRefreshing.catch(() => {});
      }
      return this._sentencesCache.data;
    }
    return this._fetchSentences();
  }

  async _fetchSentences() {
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllSentences', []);
    else data = await this._fetch('sentences?select=*');
    if (gen === this._cacheGeneration) this._sentencesCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  async getSentenceById(id) {
    if (this.isProxyMode) return this._proxy('getSentenceById', [id]);
    const res = await this._fetch(`sentences?id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteSentence(id) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('deleteSentence', [id]);
    await this._fetch(`sentences?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  async markAsKnown(word, lang) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('markAsKnown', [word, lang]);
    const res = await this._fetch('known_words?on_conflict=user_id,word,lang', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: { word: word.toLowerCase(), lang }
    });
    return !!res;
  }

  async isKnown(word, lang) {
    if (this.isProxyMode) return this._proxy('isKnown', [word, lang]);
    const res = await this._fetch(`known_words?word=eq.${encodeURIComponent(word.toLowerCase())}&lang=eq.${encodeURIComponent(lang)}&limit=1`);
    return res && res.length > 0;
  }

  async getAllKnownWords() {
    // Onda 7 (perf): mesma estratégia SWR de getAllWords/getAllCards — chamada
    // em toda carga do Início/Leitor/Histórias sem cache nenhum antes disso.
    if (this._knownWordsCache) {
      if (Date.now() - this._knownWordsCache.ts >= 30000 && !this._knownWordsRefreshing) {
        this._knownWordsRefreshing = this._fetchKnownWords().finally(() => { this._knownWordsRefreshing = null; });
        this._knownWordsRefreshing.catch(() => {});
      }
      return this._knownWordsCache.data;
    }
    return this._fetchKnownWords();
  }

  async _fetchKnownWords() {
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllKnownWords', []);
    else data = await this._fetch('known_words?select=*');
    if (gen === this._cacheGeneration) this._knownWordsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  async enqueueListeningInterval(interval) {
    if (this.isProxyMode) return this._proxy('enqueueListeningInterval', [interval]);
    const userId = await this.getCurrentUserId();
    if (!userId || interval.accountId !== userId) throw new Error('Sessão do contador mudou. Confirme o idioma novamente.');
    if (!UUID_PATTERN.test(interval.id) || !Number.isInteger(interval.seconds) || interval.seconds < 1 || interval.seconds > 60
      || !['user_confirmed', 'audio_track', 'caption_asr'].includes(interval.evidence || 'user_confirmed')
      || !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(interval.language || '')) throw new Error('Intervalo de listening inválido.');
    const save = async () => {
      const key = `lf_listening_queue_v1:${userId}`;
      const queue = await this._draftStorage('get', key) || [];
      if (!queue.some(item => item.id === interval.id)) {
        if (queue.length >= 2000) throw new Error('Fila de listening cheia. Reconecte para sincronizar.');
        queue.push(interval);
        await this._draftStorage('set', key, queue);
      }
    };
    const write = (this._listeningWrite || Promise.resolve()).then(save);
    this._listeningWrite = write.catch(() => {});
    await write;
    void this.drainListeningQueue().catch(() => {});
    return { pending: true };
  }

  async drainListeningQueue() {
    if (this._listeningDrain) return this._listeningDrain;
    this._listeningDrain = (async () => {
      const userId = await this.getCurrentUserId();
      if (!userId) return { pending: true };
      const key = `lf_listening_queue_v1:${userId}`;
      const queue = await this._draftStorage('get', key) || [];
      for (const item of queue) {
        if (await this.getCurrentUserId() !== userId) return { pending: true };
        try {
          if (Date.now() - Date.parse(item.startedAt) < 7 * 86400000) await this._fetch('rpc/record_listening_interval', { method:'POST', signal:AbortSignal.timeout(12000), body:{
            p_event_id:item.id, p_account_id:userId, p_seconds:item.seconds,
            p_started_at:item.startedAt, p_ended_at:item.endedAt,
            p_language:item.language, p_date:item.date, p_evidence:item.evidence || 'user_confirmed',
          }});
        } catch (error) {
          console.warn('[Listening] sync_pending', { code:error.code || error.kind || 'network' });
          return { pending: true };
        }
        const remove = async () => {
          const current = await this._draftStorage('get', key) || [];
          await this._draftStorage('set', key, current.filter(row => row.id !== item.id));
        };
        const write = (this._listeningWrite || Promise.resolve()).then(remove);
        this._listeningWrite = write.catch(() => {});
        await write;
      }
      return { pending: (await this._draftStorage('get', key) || []).length > 0 };
    })().finally(() => { this._listeningDrain = null; });
    return this._listeningDrain;
  }

  async logSession(seconds, platform, language = 'en') {
    if (this.isProxyMode) return this._proxy('logSession', [seconds, platform, language]);
    const date = localDateKey();
    const source = this._sessionSource(platform);
    const lang = String(language || 'en').toLowerCase().trim();
    await this._fetch('rpc/log_study_time', {
      method: 'POST',
      body: {
        p_seconds: Math.max(1, Math.min(300, Math.round(seconds))),
        p_date: date,
        p_source: source,
        p_language: lang,
      },
    });

    // Tempo assistido continua sendo métrica de atividade. Ele não concede XP:
    // duração enviada pelo cliente não é evidência competitiva verificável.
    return true;
  }

  formatStudyTime(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s > 0 ? '< 1m' : '0m';
    const totalMinutes = Math.floor(s / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  async getStudyStats(language = 'en') {
    if (this.isProxyMode) return this._proxy('getStudyStats', [language]);
    const lang = String(language || 'en').toLowerCase().trim();
    const today = localDateKey();
    const sessions = await this.getSessions(null);

    let unclassifiedSeconds = 0;
    let listeningToday = 0;
    let listeningTotal = 0;
    let cardsToday = 0;
    let cardsTotal = 0;
    let readingToday = 0;
    let readingTotal = 0;
    let writingToday = 0;
    let writingTotal = 0;
    let speakingToday = 0;
    let speakingTotal = 0;

    for (const s of sessions) {
      const sLang = String(s.language || 'und').toLowerCase().trim();
      if (sLang === 'und') unclassifiedSeconds += Math.max(0, Number(s.seconds) || 0);
      if (sLang !== lang) continue;
      const sec = Math.max(0, Number(s.seconds) || 0);
      const isToday = s.date === today;
      const src = String(s.source || '').toLowerCase();

      if (src === 'video' || src === 'manual_listening') {
        listeningTotal += sec;
        if (isToday) listeningToday += sec;
      } else if (src === 'review' || src === 'study') {
        cardsTotal += sec;
        if (isToday) cardsToday += sec;
      } else if (src === 'reader' || src === 'manual_reading') {
        readingTotal += sec;
        if (isToday) readingToday += sec;
      } else if (src === 'manual_writing') {
        writingTotal += sec;
        if (isToday) writingToday += sec;
      } else if (src === 'manual_speaking') {
        speakingTotal += sec;
        if (isToday) speakingToday += sec;
      }
    }

    const totalSecondsToday = listeningToday + cardsToday + readingToday + speakingToday + writingToday;
    const totalSecondsAllTime = listeningTotal + cardsTotal + readingTotal + speakingTotal + writingTotal;
    const totalHoursFloat = (totalSecondsAllTime / 3600).toFixed(1);

    return {
      language: lang,
      unclassified: { totalSeconds:unclassifiedSeconds, totalFormatted:this.formatStudyTime(unclassifiedSeconds) },
      listening: {
        todaySeconds: listeningToday,
        totalSeconds: listeningTotal,
        todayFormatted: this.formatStudyTime(listeningToday),
        totalFormatted: this.formatStudyTime(listeningTotal),
        totalHours: Math.round(listeningTotal / 3600),
      },
      cards: {
        todaySeconds: cardsToday,
        totalSeconds: cardsTotal,
        todayFormatted: this.formatStudyTime(cardsToday),
        totalFormatted: this.formatStudyTime(cardsTotal),
      },
      reading: {
        todaySeconds: readingToday,
        totalSeconds: readingTotal,
        todayFormatted: this.formatStudyTime(readingToday),
        totalFormatted: this.formatStudyTime(readingTotal),
      },
      writing: {
        todaySeconds: writingToday, totalSeconds: writingTotal,
        todayFormatted: this.formatStudyTime(writingToday), totalFormatted: this.formatStudyTime(writingTotal),
      },
      speaking: {
        todaySeconds: speakingToday,
        totalSeconds: speakingTotal,
        todayFormatted: this.formatStudyTime(speakingToday),
        totalFormatted: this.formatStudyTime(speakingTotal),
      },
      summary: {
        totalSecondsToday,
        totalSecondsAllTime,
        todayFormatted: this.formatStudyTime(totalSecondsToday),
        totalFormatted: this.formatStudyTime(totalSecondsAllTime),
        totalHours: totalHoursFloat,
      },
    };
  }

  async logManualStudy({ skill, minutes, date, language, notes }) {
    if (this.isProxyMode) return this._proxy('logManualStudy', [{ skill, minutes, date, language, notes }]);
    const validSkills = ['reading', 'speaking', 'listening', 'writing'];
    const safeSkill = String(skill || '').toLowerCase().trim();
    if (!validSkills.includes(safeSkill)) {
      throw new Error(`Habilidade de estudo inválida: ${skill}`);
    }
    const safeMinutes = Number(minutes);
    if (!Number.isInteger(safeMinutes) || safeMinutes < 1 || safeMinutes > 720) throw new Error('Informe de 1 a 720 minutos inteiros.');
    const safeDate = date || localDateKey();
    const safeLang = String(language || 'en').toLowerCase().trim();

    return await this._fetch('rpc/log_manual_study', {
      method: 'POST',
      body: {
        p_skill: safeSkill,
        p_minutes: safeMinutes,
        p_date: safeDate,
        p_language: safeLang,
        p_notes: notes ? String(notes).slice(0, 500) : null,
      },
    });
  }

  _sessionSource(platform) {
    const value = String(platform || '').toLowerCase();
    if (value === 'reader') return 'reader';
    if (value === 'review' || value === 'study') return 'review';
    if (value === 'pwa' || value === 'web') return 'pwa';
    if (this.isChromeContext && /youtube|netflix|disney|prime|video|^max$|hbo/.test(value)) return 'video';
    return this.isChromeContext ? 'extension' : 'pwa';
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const filter = days === null ? '' : `date=gte.${localDateKey(addLocalDays(-(Math.max(1, days) - 1))) }&`;
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this._fetch(`sessions?${filter}order=date.asc,id.asc&limit=1000&offset=${offset}`, { throwOnReadError: true });
      if (!Array.isArray(page)) throw new Error('Não foi possível carregar o tempo de estudo.');
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  // ── WEB READER (delegadas ao ReaderStoriesRepository) ─────────────────────
  async getReaderTexts() {
    return this._readerStoriesRepo.getReaderTexts();
  }

  async saveReaderText(text) {
    return this._readerStoriesRepo.saveReaderText(text);
  }

  async migrateReaderText(text) {
    return this._readerStoriesRepo.migrateReaderText(text);
  }

  async deleteReaderText(id) {
    return this._readerStoriesRepo.deleteReaderText(id);
  }

  // ── GAMIFICAÇÃO E ESTATÍSTICAS (delegadas ao GamificationRepository) ────────
  async getUserStats() {
    return this._gamificationRepo.getUserStats();
  }

  // Telemetria mínima: nunca envia texto do card, pergunta, token, e-mail ou
  // stack trace. É só o suficiente para detectar uma tela/fluxo quebrado.
  async reportClientError(source, errorName, route = '', appVersion = '') {
    return this._gamificationRepo.reportClientError(source, errorName, route, appVersion);
  }

  async getLeaderboard(leagueIndex = 0, limit = 20) {
    return this._gamificationRepo.getLeaderboard(leagueIndex, limit);
  }

  async ensureUserStats() {
    return this._gamificationRepo.ensureUserStats();
  }

  // Rollover semanal das ligas (lazy, idempotente — o pg_cron é o titular)
  async maybeLeagueRollover() {
    return this._gamificationRepo.maybeLeagueRollover();
  }

  // ── WEB PUSH (opt-in explícito nas Configurações) ─────────────────────────
  async getPushPublicKey() {
    return this._gamificationRepo.getPushPublicKey();
  }

  async savePushSubscription(sub) {
    return this._gamificationRepo.savePushSubscription(sub);
  }

  async deletePushSubscription(endpoint) {
    return this._gamificationRepo.deletePushSubscription(endpoint);
  }

  // Onda 3.4: opt-in de reengajamento por e-mail (resumo semanal + ofensiva
  // em risco) — mesmo padrão de RPC restrita ao próprio usuário do push.
  async setEmailOptIn(enabled) {
    return this._gamificationRepo.setEmailOptIn(enabled);
  }

  // ── CACHE DE TRADUÇÃO (tabela própria — NUNCA mais dentro de settings) ────
  async getTranslationCache(cacheKey) {
    if (this.isProxyMode) return this._proxy('getTranslationCache', [cacheKey]);
    const res = await this._fetch(`translation_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=value&limit=1`);
    return res && res.length > 0 ? res[0].value : null;
  }

  async setTranslationCache(cacheKey, value) {
    if (this.isProxyMode) return this._proxy('setTranslationCache', [cacheKey, value]);
    const res = await this._fetch('translation_cache?on_conflict=user_id,cache_key', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: { cache_key: cacheKey, value },
    });
    return !!res;
  }

  async getCardByWordId(wordId) {
    if (this.isProxyMode) return this._proxy('getCardByWordId', [wordId]);
    const res = await this._fetch(`cards?word_id=eq.${wordId}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async getCardStats(cardId) {
    if (this.isProxyMode) return this._proxy('getCardStats', [cardId]);
    return (await this._fetch(`review_log?card_id=eq.${cardId}&order=ts.desc&limit=30`)) || [];
  }

  async getAdaptiveProfiles(cardIds = []) {
    if (this.isProxyMode) return this._proxy('getAdaptiveProfiles', [cardIds]);
    const ids = [...new Set(cardIds)].filter(id => UUID_PATTERN.test(id)).slice(0, 250);
    if (!ids.length) return {};
    const rows = await this._fetch(`card_adaptive_profiles?card_id=in.(${ids.join(',')})&select=card_id,recovery_stage,dominant_issue,unaided_success_streak,signal_count`);
    return Object.fromEntries((rows || []).map(row => [row.card_id, row]));
  }

  async recordAdaptiveSignal(cardId, signal, clientEventId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('recordAdaptiveSignal', [cardId, signal, clientEventId]);
    if (!UUID_PATTERN.test(cardId) || !UUID_PATTERN.test(clientEventId)) throw new Error('Identificador adaptativo inválido.');
    return await this._fetch('rpc/record_card_learning_signal', {
      method: 'POST', body: { p_card_id: cardId, p_client_event_id: clientEventId, p_signal: signal },
    });
  }

  async recordLearningTaskAttempt(attempt, clientAttemptId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('recordLearningTaskAttempt', [attempt, clientAttemptId]);
    if (!UUID_PATTERN.test(clientAttemptId)) throw new Error('Identificador da tentativa inválido.');
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
      throw new Error('Dados da tentativa inválidos.');
    }
    return await this._fetch('rpc/record_learning_task_attempt', {
      method: 'POST',
      body: {
        p_client_attempt_id: clientAttemptId,
        p_attempt: attempt,
      },
    });
  }

  async getLatestLearningTaskAttempt() {
    if (this.isProxyMode) return this._proxy('getLatestLearningTaskAttempt', []);
    const select = [
      'id',
      'client_attempt_id',
      'task_key',
      'task_type',
      'skill',
      'target_level',
      'evaluation_authority',
      'authoritative',
      'overall_score',
      'occurred_at',
    ].join(',');
    const rows = await this._fetch(
      `learning_task_attempts?select=${select}&order=occurred_at.desc,id.desc&limit=1`,
    );
    return rows?.[0] || null;
  }

  async issueFluencyTask(skill, targetLevel, clientIssueId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('issueFluencyTask', [skill, targetLevel, clientIssueId]);
    if (!UUID_PATTERN.test(clientIssueId)) throw new Error('Identificador de emissão inválido.');
    return await this._fetch('rpc/issue_fluency_task', {
      method: 'POST',
      body: {
        p_client_issue_id: clientIssueId,
        p_skill: skill,
        p_target_level: targetLevel,
      },
    });
  }

  async getFluencyListeningText(issueId) {
    if (this.isProxyMode) return this._proxy('getFluencyListeningText', [issueId]);
    if (!UUID_PATTERN.test(issueId)) throw new Error('Tarefa inválida.');
    return this._fetch('rpc/get_fluency_listening_text', { method:'POST', body:{p_issue_id:issueId} });
  }

  async submitFluencyTask(
    issueId,
    response,
    assistanceUsed = {},
    responseTimeMs = null,
    clientSubmissionId = createOperationId(),
  ) {
    if (this.isProxyMode) {
      return this._proxy('submitFluencyTask', [
        issueId, response, assistanceUsed, responseTimeMs, clientSubmissionId,
      ]);
    }
    if (!UUID_PATTERN.test(issueId) || !UUID_PATTERN.test(clientSubmissionId)) {
      throw new Error('Identificador de submissão inválido.');
    }
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Resposta de fluência inválida.');
    }
    return await this._fetch('rpc/submit_fluency_task', {
      method: 'POST',
      body: {
        p_issue_id: issueId,
        p_client_submission_id: clientSubmissionId,
        p_response: response,
        p_assistance_used: assistanceUsed || {},
        p_response_time_ms: responseTimeMs,
      },
    });
  }

  async assessFluencySubmission(submissionId) {
    if (this.isProxyMode) {
      return this._proxy('assessFluencySubmission', [submissionId]);
    }
    if (!UUID_PATTERN.test(submissionId)) throw new Error('Identificador de avaliação inválido.');
    const token = await this._getToken();
    if (!token) throw classifyRequestError(new Error('Sessão expirada. Entre novamente para continuar.'), 401);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/fluency-assessment`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submission_id: submissionId }),
        signal: controller.signal,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw classifyRequestError(
          new Error(body?.error || `Falha ao avaliar fluência (${response.status}).`),
          response.status,
          body,
        );
      }
      return body;
    } catch (error) {
      if (!error.kind) classifyRequestError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getFluencyProfiles() {
    if (this.isProxyMode) return this._proxy('getFluencyProfiles', []);
    const select = [
      'skill',
      'observed_level',
      'evidence_status',
      'authoritative_attempt_count',
      'last_assessed_at',
      'updated_at',
    ].join(',');
    return (await this._fetch(`fluency_skill_profiles?select=${select}&order=skill.asc`)) || [];
  }

  async _draftStorage(operation, key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve, reject) => {
        const execute = (isRetry = false) => {
          if (operation === 'set') {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime?.lastError) {
                const message = chrome.runtime.lastError.message || '';
                if (!isRetry && /quota|kQuotaBytes|exceeded/i.test(message)) {
                  this._evictDisposableStorage()
                    .then(() => execute(true))
                    .catch(() => reject(new Error(message)));
                  return;
                }
                reject(new Error(message));
              } else {
                resolve(null);
              }
            });
            return;
          }

          const callback = result => {
            if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(operation === 'get' ? result?.[key] || null : null);
          };
          chrome.storage.local[operation](key, callback);
        };

        execute(false);
      });
    }
    if (operation === 'remove') globalThis.localStorage?.removeItem(key);
    if (operation === 'set') {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
      } catch (err) {
        if (/quota|exceeded/i.test(err?.name || err?.message || '')) {
          try {
            const keysToRemove = [];
            for (let i = 0; i < (globalThis.localStorage?.length || 0); i++) {
              const k = globalThis.localStorage.key(i);
              if (k && (k.startsWith('lf_tr:') || /^[a-z]{2,5}:[a-z]{2,5}:/.test(k))) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach(k => globalThis.localStorage.removeItem(k));
            globalThis.localStorage?.setItem(key, JSON.stringify(value));
            return;
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }
    if (operation === 'get') {
      try { return JSON.parse(globalThis.localStorage?.getItem(key) || 'null'); } catch { return null; }
    }
    return null;
  }

  async _evictDisposableStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime?.lastError || !items) return resolve();
        const disposable = Object.keys(items).filter(k =>
          k.startsWith('linguee_') ||
          k.startsWith('reverso_') ||
          k.startsWith('lf_tr:') ||
          /^[a-z]{2,5}:[a-z]{2,5}:/.test(k) ||
          k === 'lastYoutubeSubtitleUrls'
        );
        if (disposable.length === 0) return resolve();
        chrome.storage.local.remove(disposable, () => resolve());
      });
    });
  }

  async getFluencyCheckDraft() {
    await this._draftStorage('remove', FLUENCY_DRAFT_KEY); // Unowned legacy answers cannot be migrated safely.
    const userId = await this.getCurrentUserId();
    if (!userId) return null;
    const value = await this._draftStorage('get', `${FLUENCY_DRAFT_KEY}:${userId}`);
    if (await this.getCurrentUserId() !== userId) return null;
    return value?.ownerId === userId ? value : null;
  }

  async saveFluencyCheckDraft(draft, expectedUserId = null) {
    const generation = this._authGeneration || 0;
    const userId = await this.getCurrentUserId();
    if (!userId || (expectedUserId && userId !== expectedUserId)) throw new Error('A conta mudou. Reabra o check.');
    const value = { ...draft, ownerId: userId, savedAt: new Date().toISOString() };
    const key = `${FLUENCY_DRAFT_KEY}:${userId}`;
    if (generation !== (this._authGeneration || 0)) throw new Error('Sessão encerrada.');
    await this._draftStorage('set', key, value);
    if (generation !== (this._authGeneration || 0) || await this.getCurrentUserId() !== userId) {
      await this._draftStorage('remove', key);
      throw new Error('A conta mudou. Reabra o check.');
    }
    return value;
  }

  async clearFluencyCheckDraft() {
    const userId = await this.getCurrentUserId();
    await this._draftStorage('remove', FLUENCY_DRAFT_KEY);
    if (userId) await this._draftStorage('remove', `${FLUENCY_DRAFT_KEY}:${userId}`);
  }

  async getFluencyCheckStatus() {
    const [latestAttempt, profiles, draft] = await Promise.all([
      this.getLatestLearningTaskAttempt(),
      this.getFluencyProfiles(),
      this.getFluencyCheckDraft(),
    ]);
    const lastAt = latestAttempt?.occurred_at ? new Date(latestAttempt.occurred_at) : null;
    const due = !lastAt || !Number.isFinite(lastAt.getTime())
      || Date.now() - lastAt.getTime() >= 7 * 24 * 60 * 60 * 1000;
    return {
      fluencyDue: due,
      fluencyResumeAvailable: !!draft && draft.completed !== true,
      latestAttempt,
      profiles,
      draft,
    };
  }

  async submitFluencyCheck(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Nenhuma resposta de fluência para enviar.');
    }
    const results = [];
    for (const record of records) {
      const submission = await this.submitFluencyTask(
        record.issueId,
        record.response,
        record.assistanceUsed,
        record.responseTimeMs,
        record.clientSubmissionId,
      );
      const assessment = await this.assessFluencySubmission(submission.id);
      results.push({ submission, assessment });
    }
    await this.clearFluencyCheckDraft();
    return results;
  }

  async suspendCard(wordId, suspend = true) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('suspendCard', [wordId, suspend]);
    // BUG antigo: suspender empurrava due_date +365d (corrompia o agendamento).
    // Agora a fila filtra suspended no banco; due_date fica intacto. Ao
    // reativar, cards corrompidos pelo sistema antigo voltam pra "agora".
    const card = await this.getCardByWordId(wordId);
    if (!card) return false;
    return !!(await this.setCardSuspended(card.id, suspend));
  }

  async addTagsToWord(wordId, tags) {
    if (this.isProxyMode) return this._proxy('addTagsToWord', [wordId, tags]);
    const tagsArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : null);
    const res = await this._fetch(`words?id=eq.${wordId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: { tags: tagsArray }
    });
    return !!res;
  }

  async getAllTags() {
    if (this.isProxyMode) return this._proxy('getAllTags', []);
    const words = await this.getAllWords();
    const tagSet = new Set();
    words.forEach((w) => {
      if (w.tags && Array.isArray(w.tags)) {
        w.tags.forEach(t => tagSet.add(t));
      } else if (typeof w.tags === 'string') {
        w.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
      }
    });
    return [...tagSet].sort();
  }

  // ── MÉTODOS DE AUDITORIA E HARDENING ─────────────────────────────────────

  // Resumo analítico ultrarrápido calculado no Postgres (<1 KB)
  async getDashboardSummary() {
    if (this.isProxyMode) return this._proxy('getDashboardSummary', []);
    return await this._fetch('rpc/get_dashboard_summary', { method: 'POST', body: {} });
  }

  // Sessões de vídeo / Histórico de imersão
  async saveWatchSession(sessionData) {
    if (this.isProxyMode) return this._proxy('saveWatchSession', [sessionData]);
    const payload = {
      platform: sessionData.platform || 'youtube',
      video_url: String(sessionData.video_url || ''),
      video_title: sessionData.video_title ? String(sessionData.video_title).slice(0, 300) : null,
      duration_seconds: Math.max(0, Math.round(Number(sessionData.duration_seconds || 0))),
      watched_at: sessionData.watched_at || new Date().toISOString(),
    };
    if (!payload.video_url) return { ok: false };
    const res = await this._fetch('media_watch_sessions', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: payload,
    });
    return { ok: !!res?.[0], id: res?.[0]?.id };
  }

  async getWatchSessions(limit = 50) {
    if (this.isProxyMode) return this._proxy('getWatchSessions', [limit]);
    return (await this._fetch(`media_watch_sessions?select=*&order=watched_at.desc&limit=${limit}`)) || [];
  }

  // Progresso de leitura do Web Reader
  async updateReaderProgress(textId, { lastReadPosition = 0, readingPercentage = 0, isCompleted = false } = {}) {
    return this._readerStoriesRepo.updateReaderProgress(textId, { lastReadPosition, readingPercentage, isCompleted });
  }

  // Arquivamento nativo de histórias
  async updateStoryArchive(storyId, archived = true) {
    return this._readerStoriesRepo.updateStoryArchive(storyId, archived);
  }

  // Conquistas normalizadas no banco
  async saveAchievement(achievementId) {
    return this._gamificationRepo.saveAchievement(achievementId);
  }

  async getUserAchievements() {
    return this._gamificationRepo.getUserAchievements();
  }

  // ── CACHE LÉXICO CANÔNICO (FinOps & Latência) ─────────────────────────────
  async getCanonicalLexicon(word, lang = 'en') {
    if (this.isProxyMode) return this._proxy('getCanonicalLexicon', [word, lang]);
    const normWord = String(word || '').trim().toLowerCase();
    const normLang = String(lang || 'en').trim().toLowerCase();
    if (!normWord) return null;

    const cacheKey = `${normLang}:${normWord}`;
    if (this._canonicalLexiconMemory?.has(cacheKey)) {
      return this._canonicalLexiconMemory.get(cacheKey);
    }

    try {
      const res = await this._fetch(`canonical_lexicon?word=eq.${encodeURIComponent(normWord)}&lang=eq.${encodeURIComponent(normLang)}&select=*`);
      if (Array.isArray(res) && res.length > 0) {
        const entry = res[0];
        if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
        if (this._canonicalLexiconMemory.size > 500) {
          const firstKey = this._canonicalLexiconMemory.keys().next().value;
          this._canonicalLexiconMemory.delete(firstKey);
        }
        this._canonicalLexiconMemory.set(cacheKey, entry);
        return entry;
      }
      return null;
    } catch (e) {
      console.warn('[DB] getCanonicalLexicon error:', e);
      return null;
    }
  }

  async saveCanonicalLexicon(entry) {
    if (this.isProxyMode) return this._proxy('saveCanonicalLexicon', [entry]);
    if (!entry || !entry.word) return null;
    const normWord = String(entry.word).trim().toLowerCase();
    const normLang = String(entry.lang || 'en').trim().toLowerCase();
    if (!normWord) return null;

    const cacheKey = `${normLang}:${normWord}`;
    try {
      const saved = await this._fetch('rpc/get_or_cache_canonical_lexicon', {
        method: 'POST',
        body: {
          p_word: normWord,
          p_lang: normLang,
          p_entry: {
            word_phon: entry.word_phon || null,
            word_pt: entry.word_pt || null,
            context: entry.context || null,
            source: entry.source || 'deepseek-chat',
          },
        },
      });

      if (saved) {
        if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
        this._canonicalLexiconMemory.set(cacheKey, saved);
        return saved;
      }
      return null;
    } catch (e) {
      console.warn('[DB] saveCanonicalLexicon error:', e);
      return null;
    }
  }
}

export const db = new Database();
