// utils/db.js — Banco único do LinguaFlow (Cloud-Only)
// Integração 100% direta com Supabase via REST API (sem IndexedDB local)
import { ReaderStoriesRepository } from './db/reader-stories-repo.js';
import { GamificationRepository } from './db/gamification-repo.js';
import { CoursesRepository } from './db/courses-repo.js';
import { StatsRepository } from './db/stats-repo.js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, classifyRequestError, createOperationId } from './db/shared.js';
import { FSRS_DECAY, FSRS_FACTOR, FSRS_W, SRS_OVERRIDABLE_KEYS } from './db/srs-constants.js';
import { AdminMethods } from './db/admin.js';
import { WordsMethods } from './db/words.js';
import { CardsMethods } from './db/cards.js';
import { SrsMethods } from './db/srs.js';
import { StudyMethods } from './db/study.js';
import { AccountMethods } from './db/account.js';
import { LearningMethods } from './db/learning.js';
import { installMethods } from './install-methods.js';

export { createOperationId };

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
    this.courses = new CoursesRepository(this);
    this.stats = new StatsRepository(this);
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
  // force: o servidor já recusou o token (401) apesar de expires_at dizer que
  // ainda vale — relógio local atrasado ou JWT encurtado no projeto.
  async _refreshTokenIfNeeded({ force = false } = {}) {
    if (this._refreshPromise) return this._refreshPromise;

    const session = await this._readSession();
    if (!session) return null;

    // Sessão legada (salva antes do refresh existir): usa como está;
    // se o token já venceu, o tratamento de 401 em _fetch desloga.
    if (!session.refresh_token || (!session.expires_at && !force)) return session;

    const FIVE_MIN = 5 * 60 * 1000;
    if (!force && session.expires_at - Date.now() > FIVE_MIN) return session;

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
    options.signal?.throwIfAborted();
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
        if (res.status === 401 && !options._authRetried) {
          // O PostgREST recusa o JWT antes de executar qualquer coisa, então
          // repetir uma escrita aqui não duplica efeito.
          const refreshed = await this._refreshTokenIfNeeded({ force: true });
          if (refreshed?.access_token && refreshed.access_token !== token) {
            const retryHeaders = { ...(options.headers || {}) };
            if (headers['Content-Type']) retryHeaders['Content-Type'] = headers['Content-Type'];
            return this._fetch(endpoint, { ...options, headers: retryHeaders, _authRetried: true });
          }
        }
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
      if (!options.silent) console.error('[DB] Fetch Error:', e);
      // Escritas NÃO podem falhar em silêncio: o chamador precisa saber
      // (word-popup mostra erro, handleGrade loga, backfill pula a palavra).
      // Leituras seguem retornando null (views tratam como vazio).
      const method = (options.method || 'GET').toUpperCase();
      if (options.throwOnReadError || method !== 'GET') throw e;
      // Leitura falhou: retorna null (views tratam como vazio) MAS avisa a UI
      // — "nenhuma palavra" quando na verdade a rede caiu era mentira na tela.
      if (!options.silent && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lf_read_error', { detail: { endpoint } }));
      }
      return null;
    }
  }

  async _proxy(method, args) {
    if (!this.isProxyMode) return null;
    if (!globalThis.chrome?.runtime?.id || !globalThis.chrome?.runtime?.sendMessage) {
      throw new Error('Contexto da extensão indisponível. Recarregue a página para continuar.');
    }
    return new Promise((resolve, reject) => {
      const proxyTimeoutMs = method === 'assessFluencySubmission' ? 65000 : 10000;
      const timeoutId = setTimeout(() => {
        if (!globalThis.chrome?.runtime?.id) {
          reject(new Error('Contexto da extensão indisponível. Recarregue a página para continuar.'));
          return;
        }
        console.error(`[LinguaFlow DB] Timeout na chamada ${method}.`);
        reject(classifyRequestError(new Error(`DB proxy timeout: ${method}`)));
      }, proxyTimeoutMs);

      try {
        chrome.runtime.sendMessage(
          {
            type: 'DB_CALL',
            method,
            args: JSON.parse(JSON.stringify(args || [])),
          },
          (response) => {
            clearTimeout(timeoutId);
            if (!globalThis.chrome?.runtime?.id) {
              reject(new Error('Contexto da extensão indisponível. Recarregue a página para continuar.'));
            } else if (chrome.runtime.lastError) {
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
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
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

  // Onda 9: perfis de SRS por categoria (phrasal/idiom/slang/word) —
  // reaproveita o MESMO settings k/v, só com chave sufixada ":categoria"
  // (ex.: "lf_srs_retention:idiom"), sem tabela nem coluna nova. Só as 3
  // configs que fazem diferença pedagógica real por categoria são
  // sobrepostas (retenção, learning steps, intervalo de graduação) — leech
  // e limites diários continuam globais de propósito (são sobre volume da
  // sessão, não sobre a categoria do conteúdo). Sem `category`, o
  // comportamento é IDÊNTICO ao de antes (nenhuma chamada existente muda).
  static SRS_OVERRIDABLE_KEYS = SRS_OVERRIDABLE_KEYS;

  // ── FSRS-4.5 (algoritmo do Anki moderno) ─────────────────────────────────
  // Parâmetros default publicados do FSRS-4.5. quality: 1=Errei 2=Difícil 3=Bom 4=Fácil
  // Cards novos/em aprendizado seguem learning steps (como no Anki); FSRS
  // governa o agendamento de review/mature e é semeado na graduação.
  static FSRS_W = FSRS_W;
  static FSRS_DECAY = FSRS_DECAY;
  static FSRS_FACTOR = FSRS_FACTOR;
}

installMethods(Database, [AdminMethods, WordsMethods, CardsMethods, SrsMethods, StudyMethods, AccountMethods, LearningMethods]);

export const db = new Database();
