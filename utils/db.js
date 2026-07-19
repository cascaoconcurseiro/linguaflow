// utils/db.js — Banco único do LinguaFlow (Cloud-Only)
// Integração 100% direta com Supabase via REST API (sem IndexedDB local)
import { addLocalDays, localDateKey, localDayBounds } from './local-day.js';

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// snapshot era um JPEG base64 nunca renderizado. Em produção, só 6 palavras
// somavam 5,4 MB nesse campo e cada select=* o baixava outra vez.
const WORD_SELECT = 'id,user_id,word,lang,translation,context_sentence,phonetic,pronunciation_pt,explanation,level,tags,ai_chunks,video_url,video_title,platform,added_at,synonyms,antonyms,definition,category,mnemonic,video_start_ms,video_end_ms';

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
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
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
      return this._proxy('_fetch', [endpoint, options]);
    }

    const token = await this._getToken();
    if (!token) {
       console.warn('[DB] Sessão Supabase não encontrada. Operação cancelada:', endpoint);
       const error = classifyRequestError(new Error('Sessão expirada. Entre novamente para continuar.'), 401);
       if ((options.method || 'GET').toUpperCase() !== 'GET') throw error;
       return null;
    }

    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
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
      if (method !== 'GET') throw e;
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
      const timeoutId = setTimeout(() => {
        console.error(`[LinguaFlow DB] Timeout na chamada ${method}.`);
        reject(classifyRequestError(new Error(`DB proxy timeout: ${method}`)));
      }, 10000); // 10s: o refresh automático de token pode adicionar uma ida à rede

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
    const headers = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
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
    const headers = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao cadastrar');
      
      // Se já retornar sessão (email confirm off):
      if (data.session && data.session.access_token) {
        await this._saveSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: Date.now() + ((data.session.expires_in || 3600) * 1000),
          user: data.user,
        });
        this._invalidateReadCache();
      }
      return { ok: true, user: data.user, session: data.session };
    } catch (e) {
      console.error('SignUp error:', e);
      return { ok: false, error: e.message };
    }
  }

  async logout() {
    if (this.isProxyMode) return this._proxy('logout', []);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('lf_supabase_session');
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('lf_supabase_session');
    }
    this._invalidateReadCache();
    this._srsCache = null;
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
    if (wordData.pronunciation_pt !== undefined) payload.pronunciation_pt = wordData.pronunciation_pt;
    if (wordData.explanation !== undefined) payload.explanation = wordData.explanation;
    if (wordData.platform !== undefined) payload.platform = wordData.platform;
    if (wordData.level !== undefined) payload.level = wordData.level;
    if (wordData.snapshot !== undefined) payload.snapshot = wordData.snapshot;
    
    const res = await this._fetch('words?on_conflict=user_id,word,lang', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });

    if (!res || !res.length) return { ok: false };
    const savedWord = res[0];

    // isNew = a palavra ainda não tinha card ANTES deste save. A versão
    // anterior testava `!card` depois de criar o card — sempre false (§3.4).
    const existingCard = await this.getCardByWordId(savedWord.id);
    if (!existingCard) {
      await this._fetch('rpc/create_card_for_word', {
        method: 'POST',
        body: { p_word_id: savedWord.id }
      });
    }

    // A7 do backlog: TETO DO COFRE. Limite de novos/dia controla a
    // velocidade da dívida; o teto controla o TAMANHO. Cofre cheio: salvar
    // continua funcionando, mas a palavra nova entra SUSPENSA (tag
    // lf:espera) e não gera revisão até o aluno abrir vaga aposentando uma
    // dominada — salvar vira escolha, não reflexo. lf_vault_cap=0 desliga.
    let waitingForSlot = false;
    if (!existingCard) {
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

    return { ok: true, id: savedWord.id, isNew: !existingCard, waitingForSlot };
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
    const allowed = ['translation', 'context_sentence', 'category', 'level', 'phonetic', 'mnemonic', 'video_start_ms', 'video_end_ms'];
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

  _invalidateReadCache() {
    this._cacheGeneration = (this._cacheGeneration || 0) + 1;
    this._wordsCache = null;
    this._cardsCache = null;
    this._sentencesCache = null;
    this._knownWordsCache = null;
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

  // ── HISTÓRIAS (biblioteca permanente — história gerada nunca se perde) ────
  async saveStory(story) {
    if (this.isProxyMode) return this._proxy('saveStory', [story]);
    const res = await this._fetch('stories', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: {
        title: story.title,
        content: story.content,
        level: story.level || null,
        genre: story.genre || null,
      }
    });
    return { ok: !!res?.[0], id: res?.[0]?.id, createdAt: res?.[0]?.created_at };
  }

  async getStories(limit = 50) {
    if (this.isProxyMode) return this._proxy('getStories', [limit]);
    const rows = await this._fetch(`stories?select=*&order=created_at.desc&limit=${limit}`);
    if (!rows) throw new Error('Não foi possível carregar as histórias do Supabase.');
    return rows;
  }

  async deleteStory(id) {
    if (!UUID_PATTERN.test(String(id))) return false;
    if (this.isProxyMode) return this._proxy('deleteStory', [id]);
    await this._fetch(`stories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
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

  // Contadores do dia para os limites diários (novas/dia e revisões/dia)
  async getTodayCounts() {
    if (this.isProxyMode) return this._proxy('getTodayCounts', []);
    const { start, end } = localDayBounds();
    const [logToday, introduced] = await Promise.all([
      // O teto diário é de revisões propriamente ditas. Um passo de card novo
      // ou learning não consome esse orçamento. previous_status é gravado no
      // servidor pela RPC, antes de alterar o card; nunca vem do cliente.
      this._fetch(`review_log?previous_status=in.(review,mature)&ts=gte.${encodeURIComponent(start.toISOString())}&ts=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`cards?introduced_at=gte.${encodeURIComponent(start.toISOString())}&introduced_at=lt.${encodeURIComponent(end.toISOString())}&select=id`),
    ]);
    return {
      reviewsToday: (logToday || []).length,
      newIntroducedToday: (introduced || []).length,
    };
  }

  async buryCard(cardId) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('buryCard', [cardId]);
    return this._fetch('rpc/bury_card', {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async setCardSuspended(cardId, suspended = true) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('setCardSuspended', [cardId, suspended]);
    return this._fetch(`rpc/${suspended ? 'suspend_card' : 'restore_card'}`, {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async restoreCardState(cardId, state) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('restoreCardState', [cardId, state]);
    return this._fetch('rpc/restore_card_state', {
      method: 'POST',
      body: { p_card_id: cardId, p_state: state },
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
    this._invalidateReadCache();
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
      'new_per_day', 'max_reviews_per_day'];
    const catKeys = category ? Database.SRS_OVERRIDABLE_KEYS.map(k => `${k}:${category}`) : [];
    // Onda 9 (auditoria de bugs): `category` chega da coluna words.category,
    // que não é validada como enum no banco (a checagem contra a lista
    // fixa só roda no classificador da extensão) — sem encode, uma vírgula
    // ou parêntese na categoria quebraria o filtro in.(...) do PostgREST.
    // O método irmão (setSRSCategoryOverride) já fazia isso; faltava aqui.
    const keys = [...baseKeys, ...catKeys].map(encodeURIComponent);
    const map = {};
    if (this.isProxyMode) {
      const rows = await this._proxy('_fetch', [`settings?key=in.(${keys.join(',')})`, {}]);
      (rows || []).forEach(r => { map[r.key] = r.value; });
    } else {
      const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
      (rows || []).forEach(r => { map[r.key] = r.value; });
    }
    // Override por categoria vence o valor global, só se estiver de fato gravado
    if (category) {
      Database.SRS_OVERRIDABLE_KEYS.forEach(k => {
        const catVal = map[`${k}:${category}`];
        if (catVal !== undefined && catVal !== null && catVal !== '') map[k] = catVal;
      });
    }

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
      newPerDay: Math.max(0, Number(map.new_per_day ?? 20)),
      maxRevPerDay: Math.max(1, Number(map.max_reviews_per_day ?? 200)),
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
    if (!Database.SRS_OVERRIDABLE_KEYS.includes(key)) throw new Error(`Chave não sobrescrevível por categoria: ${key}`);
    const fullKey = `${key}:${category}`;
    if (value === null || value === '') {
      this._srsCache = null;
      if (this.isProxyMode) return this._proxy('_fetch', [`settings?key=eq.${encodeURIComponent(fullKey)}`, { method: 'DELETE' }]);
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
    return Math.pow(1 + Database.FSRS_FACTOR * elapsedDays / stability, Database.FSRS_DECAY);
  }

  _fsrsInterval(stability, retention) {
    return (stability / Database.FSRS_FACTOR) * (Math.pow(retention, 1 / Database.FSRS_DECAY) - 1);
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
    let stability = card.stability || null;
    let difficulty = card.difficulty || null;

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
        // Difícil é um acerto com esforço: nunca pode prender o aluno no
        // mesmo passo para sempre. Ele repete o primeiro passo uma vez e,
        // depois, avança mais lentamente que "Bom" (1,5× o intervalo). Assim
        // há uma exposição extra sem graduação precoce: com [1, 10], três
        // respostas "Difícil" graduam; com um único passo, duas graduam.
        // (Resolução do merge: versão do Codex — mais conservadora que a de
        // Fable; "Difícil" três vezes NÃO deve graduar tão rápido quanto "Bom".)
        nextStatus = 'learning';
        if (prevStatus === 'new') {
          nextStepIndex = 0;
          nextInterval = (activeSteps[0] * 1.5) / 1440;
        } else {
          nextStepIndex += 1;
          if (nextStepIndex >= activeSteps.length) {
            nextStatus = 'review';
            nextStepIndex = 0;
            nextInterval = Math.max(settings.gradInt || 1,
              this._fsrsInterval(stability, retention) * settings.intMod * 0.8);
          } else {
            nextInterval = (activeSteps[nextStepIndex] * 1.5) / 1440;
          }
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
        nextInterval = Math.max(settings.easyInt || 4,
          this._fsrsInterval(stability, retention) * settings.intMod);
      } else {
        // Bom: avança um step; gradua no fim dos steps.
        // graduating_interval (config) é o piso da graduação.
        nextStepIndex = prevStatus === 'new' ? 1 : nextStepIndex + 1;
        if (nextStepIndex >= activeSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          nextInterval = Math.max(settings.gradInt || 1,
            this._fsrsInterval(stability, retention) * settings.intMod);
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
      difficulty = this._fsrsNextDifficulty(difficulty, quality);
      stability = this._fsrsNextStability(difficulty, stability, r, quality);

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
      const d = new Date();
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
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality, category, plannedState, operationId]);

    const settings = await this.getSRSSettings(category);
    const res = await this._fetch(`cards?id=eq.${cardId}&limit=1`);
    if (!res || !res.length) throw new Error('Card não encontrado');
    const prevCard = { ...res[0] }; // snapshot para o undo (paridade Anki)

    // A interface calculou esta prévia antes do clique. Reusar o estado evita
    // divergência entre o rótulo apresentado e o intervalo persistido. Caso a
    // prévia não exista (atalho/cliente antigo), calcula deterministicamente.
    let card = plannedState && plannedState.id === cardId
      ? { ...plannedState }
      : this._calculateNextState(res[0], quality, settings);

    // Marca a introdução do card (1ª revisão de um card novo) — é o que faz
    // o limite "novas cartas/dia" ser real, não decorativo.
    if (prevCard.status === 'new' && !prevCard.introduced_at) {
      card.introduced_at = new Date().toISOString();
    }

    if (card.lapses >= settings.leechThresh) {
      card.is_leech = true;
      if (settings.leechAction === 'suspend') card.suspended = true;
    }

    // A revisão é uma única operação transacional no Postgres. Antes desta
    // RPC o PATCH do card e o INSERT em review_log podiam divergir em falha
    // de rede, deixando o agendamento sem histórico/XP/undo.
    const clientReviewId = operationId || createOperationId();
    const saved = await this._fetch('rpc/record_card_review', {
      method: 'POST',
      body: {
        p_card_id: cardId,
        p_quality: quality,
        p_state: card,
        p_client_review_id: clientReviewId,
      },
    });
    const savedCard = saved?.card || card;

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
      prevCard,
      card: savedCard,
      reviewLogId: saved?.review_log_id || null,
      xpAwarded: idempotent ? 0 : Number(saved?.xp_awarded || 0),
    };
  }

  // Desfaz a última revisão: restaura o card ao estado anterior e apaga o
  // registro mais recente de review_log daquele card (Ctrl+Z do Anki).
  async undoReview(prevCard, reviewLogId) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('undoReview', [prevCard, reviewLogId]);
    if (!prevCard || !prevCard.id || !reviewLogId) return { ok: false };

    // XP/streak e agendamento precisam voltar juntos. O cliente não pode mais
    // apagar o log diretamente, pois isso deixava XP creditado para trás.
    const res = await this._fetch('rpc/revert_card_review', {
      method: 'POST',
      body: { p_review_log_id: reviewLogId, p_previous_card: prevCard },
    });
    return { ok: true, xpReverted: Number(res?.xp_reverted || 0) };
  }

  async getReviewLog(days = 30) {
    if (this.isProxyMode) return this._proxy('getReviewLog', [days]);
    const start = localDayBounds(addLocalDays(-(Math.max(1, days) - 1))).start;
    return (await this._fetch(`review_log?ts=gte.${encodeURIComponent(start.toISOString())}`)) || [];
  }

  async saveSentence(data) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('saveSentence', [data]);
    const res = await this._fetch('sentences', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: data
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

  async logSession(seconds, platform) {
    if (this.isProxyMode) return this._proxy('logSession', [seconds, platform]);
    const date = localDateKey();
    const source = this._sessionSource(platform);
    await this._fetch('rpc/log_study_time', {
      method: 'POST',
      body: { p_seconds: Math.max(1, Math.min(300, Math.round(seconds))), p_date: date, p_source: source },
    });

    // Tempo assistido continua sendo métrica de atividade. Ele não concede XP:
    // duração enviada pelo cliente não é evidência competitiva verificável.
    return true;
  }

  _sessionSource(platform) {
    const value = String(platform || '').toLowerCase();
    if (value === 'reader') return 'reader';
    if (value === 'review' || value === 'study') return 'review';
    if (value === 'pwa' || value === 'web') return 'pwa';
    if (this.isChromeContext && /youtube|netflix|disney|prime|video/.test(value)) return 'video';
    return this.isChromeContext ? 'extension' : 'pwa';
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const minDate = localDateKey(addLocalDays(-(Math.max(1, days) - 1)));
    return (await this._fetch(`sessions?date=gte.${minDate}`)) || [];
  }

  async getReaderTexts() {
    if (this.isProxyMode) return this._proxy('getReaderTexts', []);
    return this._fetch('reader_texts?select=id,title,content,source,created_at,updated_at&order=updated_at.desc');
  }

  async saveReaderText(text) {
    if (this.isProxyMode) return this._proxy('saveReaderText', [text]);
    const row = {
      id: String(text.id),
      title: String(text.title || 'Texto').slice(0, 300),
      content: String(text.content || ''),
      source: text.source || 'pasted',
      created_at: new Date(text.addedAt || Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const saved = await this._fetch('reader_texts?on_conflict=user_id,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: row,
    });
    return saved?.[0] || row;
  }

  async migrateReaderText(text) {
    if (this.isProxyMode) return this._proxy('migrateReaderText', [text]);
    const migratedAt = new Date(text.addedAt || Date.now()).toISOString();
    const row = {
      id: String(text.id),
      title: String(text.title || 'Texto').slice(0, 300),
      content: String(text.content || ''),
      source: text.source || 'migration',
      created_at: migratedAt,
      updated_at: migratedAt,
    };
    const saved = await this._fetch('reader_texts?on_conflict=user_id,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: row,
    });
    return saved?.[0] || null;
  }

  async deleteReaderText(id) {
    if (this.isProxyMode) return this._proxy('deleteReaderText', [id]);
    await this._fetch(`reader_texts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  }

  // ── GAMIFICAÇÃO E ESTATÍSTICAS DO USUÁRIO ────────────────────────────────
  async getUserStats() {
    if (this.isProxyMode) return this._proxy('getUserStats', []);
    const res = await this._fetch('user_stats?select=*&limit=1');
    return res && res.length > 0 ? res[0] : null;
  }

  // Telemetria mínima: nunca envia texto do card, pergunta, token, e-mail ou
  // stack trace. É só o suficiente para detectar uma tela/fluxo quebrado.
  async reportClientError(source, errorName, route = '') {
    if (this.isProxyMode) return this._proxy('reportClientError', [source, errorName, route]);
    const safe = value => String(value || 'Error').replace(/[^a-zA-Z0-9_.:/ -]/g, '').slice(0, 120);
    try {
      await this._fetch('client_errors', {
        method: 'POST',
        body: {
          source: safe(source).slice(0, 80),
          error_name: safe(errorName),
          route: safe(route).slice(0, 80) || null,
          app_version: 'dashboard-2026-07-10',
        },
      });
    } catch { /* telemetria nunca interrompe o produto */ }
  }

  async getLeaderboard(leagueIndex = 0, limit = 20) {
    if (this.isProxyMode) return this._proxy('getLeaderboard', [leagueIndex, limit]);
    const res = await this._fetch('rpc/get_leaderboard', {
      method: 'POST',
      body: { p_league_index: leagueIndex, p_limit: limit },
    });
    return res || [];
  }

  async ensureUserStats() {
    if (this.isProxyMode) return this._proxy('ensureUserStats', []);
    
    // Apenas garante que o perfil exista via backend (XP agora é automático por Triggers)
    await this._fetch('rpc/ensure_user_stats', {
      method: 'POST'
    });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      await this._fetch('rpc/set_user_timezone', { method: 'POST', body: { p_timezone: timezone } });
    }
    
    return { ok: true };
  }

  // Rollover semanal das ligas (lazy, idempotente — o pg_cron é o titular)
  async maybeLeagueRollover() {
    if (this.isProxyMode) return this._proxy('maybeLeagueRollover', []);
    try {
      return await this._fetch('rpc/maybe_league_rollover', { method: 'POST', body: {} });
    } catch { return { ran: false }; }
  }

  // ── WEB PUSH (opt-in explícito nas Configurações) ─────────────────────────
  async getPushPublicKey() {
    if (this.isProxyMode) return this._proxy('getPushPublicKey', []);
    const res = await this._fetch('rpc/get_push_public_key', { method: 'POST', body: {} });
    return typeof res === 'string' ? res : null;
  }

  async savePushSubscription(sub) {
    if (this.isProxyMode) return this._proxy('savePushSubscription', [sub]);
    const keys = sub?.keys || {};
    if (!sub?.endpoint || !keys.p256dh || !keys.auth) return { ok: false };
    const res = await this._fetch('push_subscriptions?on_conflict=user_id,endpoint', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return { ok: !!res };
  }

  async deletePushSubscription(endpoint) {
    if (this.isProxyMode) return this._proxy('deletePushSubscription', [endpoint]);
    if (!endpoint) return { ok: false };
    await this._fetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
    return { ok: true };
  }

  // Onda 3.4: opt-in de reengajamento por e-mail (resumo semanal + ofensiva
  // em risco) — mesmo padrão de RPC restrita ao próprio usuário do push.
  async setEmailOptIn(enabled) {
    if (this.isProxyMode) return this._proxy('setEmailOptIn', [enabled]);
    const res = await this._fetch('rpc/set_email_opt_in', {
      method: 'POST',
      body: { p_enabled: !!enabled },
    });
    return res || { ok: false };
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
}

export const db = new Database();
