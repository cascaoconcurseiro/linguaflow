// utils/db.js — Banco único do LinguaFlow (Cloud-Only)
// Integração 100% direta com Supabase via REST API (sem IndexedDB local)
import { addLocalDays, localDateKey, localDayBounds } from './local-day.js';

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';

class Database {
  constructor() {
    this.isBackgroundWorker = typeof window === 'undefined';
    this.isChromeContext = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    this.isProxyMode = this.isChromeContext && !this.isBackgroundWorker;
    this.initPromise = Promise.resolve();
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
        throw new Error(`[Supabase Error] ${res.status}: ${err}`);
      }
      if (res.status === 204) return [];
      // POST/PATCH sem 'Prefer: return=representation' respondem 200/201 com
      // corpo VAZIO — res.json() estourava "Unexpected end of JSON input"
      // (a escrita tinha funcionado; só o parse quebrava).
      const text = await res.text();
      if (!text) return [];
      return JSON.parse(text);
    } catch (e) {
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
        reject(new Error(`DB proxy timeout: ${method}`));
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
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            console.error('[LinguaFlow DB] Erro retornado do worker:', response.error);
            reject(new Error(response.error));
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
    return { ok: true };
  }

  async checkSession() {
    if (this.isProxyMode) return this._proxy('checkSession', []);
    const token = await this._getToken();
    return !!token;
  }

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  async getSetting(key) {
    if (this.isProxyMode) return this._proxy('getSetting', [key]);
    const res = await this._fetch(`settings?key=eq.${encodeURIComponent(key)}`);
    if (res && res.length > 0) {
      const val = res[0].value;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }
    return null;
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
    if (wordData.video_title !== undefined) payload.video_title = wordData.video_title;
    if (wordData.synonyms !== undefined) payload.synonyms = wordData.synonyms;
    if (wordData.antonyms !== undefined) payload.antonyms = wordData.antonyms;
    if (wordData.definition !== undefined) payload.definition = wordData.definition;
    if (wordData.pronunciation_pt !== undefined) payload.pronunciation_pt = wordData.pronunciation_pt;
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

    let card = await this.getCardByWordId(savedWord.id);
    if (!card) {
      await this._fetch('cards', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: {
          word_id: savedWord.id,
          interval: 0,
          ease_factor: 2.5,
          due_date: new Date().toISOString(),
          reps: 0,
          status: 'new'
        }
      });
    }

    return { ok: true, id: savedWord.id, isNew: !card };
  }

  async getWord(word, lang = 'en') {
    if (this.isProxyMode) return this._proxy('getWord', [word, lang]);
    const res = await this._fetch(`words?word=eq.${encodeURIComponent(word)}&lang=eq.${encodeURIComponent(lang)}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async getWordById(id) {
    if (this.isProxyMode) return this._proxy('getWordById', [id]);
    const res = await this._fetch(`words?id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteWord(id) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('deleteWord', [id]);
    await this._fetch(`words?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  // Editor do Cofre (Onda 2.3): corrige tradução/frase/categoria/nível SEM
  // apagar o card — PATCH por id (não é upsert por word/lang) pra nunca
  // arriscar duplicar a palavra nem perder o histórico FSRS do card.
  async updateWord(id, patch) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('updateWord', [id, patch]);
    const allowed = ['translation', 'context_sentence', 'category', 'level', 'phonetic', 'mnemonic'];
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
    // Cache curto (30s): as views re-buscam a mesma lista ao navegar entre
    // abas — era parte da sensação de site lento. Invalidado em toda escrita.
    if (limit === 0 && this._wordsCache && Date.now() - this._wordsCache.ts < 30000) {
      return this._wordsCache.data;
    }
    if (this.isProxyMode) {
      const data = await this._proxy('getAllWords', [limit]);
      if (limit === 0) this._wordsCache = { data: data || [], ts: Date.now() };
      return data || [];
    }
    let query = `words?select=*&order=added_at.desc`;
    if (limit > 0) query += `&limit=${limit}`;
    const res = await this._fetch(query);
    if (limit === 0) this._wordsCache = { data: res || [], ts: Date.now() };
    return res || [];
  }

  _invalidateReadCache() {
    this._wordsCache = null;
    this._cardsCache = null;
  }

  async getWordsByCategory(category) {
    if (this.isProxyMode) return this._proxy('getWordsByCategory', [category]);
    const words = await this.getAllWords();
    const cards = await this.getAllCards();
    const cardMap = {};
    cards.forEach(c => cardMap[c.word_id] = c);

    return words.map(w => ({
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
    if (this._cardsCache && Date.now() - this._cardsCache.ts < 30000) {
      return this._cardsCache.data;
    }
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllCards', []);
    else data = await this._fetch('cards?select=*');
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
    return { ok: !!res, id: res?.[0]?.id };
  }

  async getStories(limit = 50) {
    if (this.isProxyMode) return this._proxy('getStories', [limit]);
    return (await this._fetch(`stories?select=*&order=created_at.desc&limit=${limit}`)) || [];
  }

  async deleteStory(id) {
    if (this.isProxyMode) return this._proxy('deleteStory', [id]);
    await this._fetch(`stories?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  // minutesAhead: "learn ahead" do Anki — inclui cards de aprendizado que
  // vencem nos próximos N minutos (permite fechar a sessão de verdade).
  async getCardsDue(limit = 50, includeWordData = true, minutesAhead = 0) {
    if (this.isProxyMode) return this._proxy('getCardsDue', [limit, includeWordData, minutesAhead]);
    const horizon = new Date(Date.now() + minutesAhead * 60000).toISOString();
    const select = includeWordData ? 'select=*,words(*)&' : '';
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
      this._fetch(`review_log?ts=gte.${encodeURIComponent(start.toISOString())}&ts=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`cards?introduced_at=gte.${encodeURIComponent(start.toISOString())}&introduced_at=lt.${encodeURIComponent(end.toISOString())}&select=id`),
    ]);
    return {
      reviewsToday: (logToday || []).length,
      newIntroducedToday: (introduced || []).length,
    };
  }

  async updateCard(card) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('updateCard', [card]);
    const { wordData, ...cleanCard } = card;
    const res = await this._fetch(`cards?id=eq.${card.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: cleanCard
    });
    return { ok: !!res };
  }

  // ── ESTATÍSTICAS E LOGS ───────────────────────────────────────────────────

  async getHistory(limit = 100) {
    if (this.isProxyMode) return this._proxy('getHistory', [limit]);
    return (await this._fetch(`words?select=*&order=added_at.desc&limit=${limit}`)) || [];
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
    const todaySession = sessions.find((s) => s.date === today);
    const todaySecs = todaySession ? todaySession.seconds : 0;
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
    };
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

  async getSRSSettings() {
    // GARGALO CORRIGIDO: eram 11 chamadas REST sequenciais A CADA avaliação
    // de card (a "demora ao clicar em Difícil"). Agora: 1 request em lote +
    // cache de 60s, invalidado quando qualquer setting é gravada.
    if (this._srsCache && Date.now() - this._srsCache.ts < 60000) {
      return this._srsCache.value;
    }

    const keys = ['graduating_interval', 'easy_interval', 'initial_ease', 'max_interval',
      'leech_threshold', 'easy_bonus', 'interval_modifier', 'lapse_modifier',
      'leech_action', 'lf_srs_retention', 'learning_steps',
      'new_per_day', 'max_reviews_per_day'];
    const map = {};
    if (this.isProxyMode) {
      const rows = await this._proxy('_fetch', [`settings?key=in.(${keys.join(',')})`, {}]);
      (rows || []).forEach(r => { map[r.key] = r.value; });
    } else {
      const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
      (rows || []).forEach(r => { map[r.key] = r.value; });
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
      // Limites diários (paridade Anki): controlam a fila de estudo
      newPerDay: Math.max(0, Number(map.new_per_day ?? 20)),
      maxRevPerDay: Math.max(1, Number(map.max_reviews_per_day ?? 200)),
    };
    if (value.learningSteps.length === 0) value.learningSteps = [1, 10];
    this._srsCache = { value, ts: Date.now() };
    return value;
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

  _calculateNextState(card, quality, settings) {
    const now = Date.now();
    const prevStatus = card.status || 'new';
    const learningSteps = settings.learningSteps;
    const retention = settings.retention;
    const maxInt = settings.maxInt;

    let nextStatus;
    let nextInterval;
    let nextStepIndex = card.step_index || 0;
    let nextLapses = card.lapses || 0;
    const nextReps = (card.reps || 0) + 1;

    // Estado FSRS: semeia a partir do histórico se o card veio do SM-2 antigo
    let stability = card.stability || null;
    let difficulty = card.difficulty || null;

    const elapsedDays = card.last_review
      ? Math.max(0, (now - new Date(card.last_review).getTime()) / 86400000)
      : 0;

    if (prevStatus === 'new' || prevStatus === 'learning') {
      // Learning steps (minutos), como no Anki com FSRS habilitado
      if (difficulty === null) difficulty = this._fsrsInitDifficulty(quality);
      if (stability === null) stability = this._fsrsInitStability(quality);

      if (quality === 1) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
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
          nextInterval = (learningSteps[0] * 1.5) / 1440;
        } else {
          nextStepIndex += 1;
          if (nextStepIndex >= learningSteps.length) {
            nextStatus = 'review';
            nextStepIndex = 0;
            nextInterval = Math.max(settings.gradInt || 1,
              this._fsrsInterval(stability, retention) * settings.intMod * 0.8);
          } else {
            nextInterval = (learningSteps[nextStepIndex] * 1.5) / 1440;
          }
        }
      } else if (quality === 4) {
        // Fácil: gradua direto com bônus do FSRS.
        // easy_interval (config) é o piso; interval_modifier escala tudo.
        stability = this._fsrsInitStability(4);
        difficulty = this._fsrsInitDifficulty(4);
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = Math.max(settings.easyInt || 4,
          this._fsrsInterval(stability, retention) * settings.intMod);
      } else {
        // Bom: avança um step; gradua no fim dos steps.
        // graduating_interval (config) é o piso da graduação.
        nextStepIndex = prevStatus === 'new' ? 1 : nextStepIndex + 1;
        if (nextStepIndex >= learningSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          nextInterval = Math.max(settings.gradInt || 1,
            this._fsrsInterval(stability, retention) * settings.intMod);
        } else {
          nextStatus = 'learning';
          nextInterval = learningSteps[nextStepIndex] / 1440;
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
        nextLapses++;
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
      } else {
        // interval_modifier (config) escala o intervalo do FSRS (100% = neutro)
        nextInterval = Math.max(1, this._fsrsInterval(stability, retention) * settings.intMod);
        nextInterval = Math.min(nextInterval, maxInt);
        nextStatus = nextInterval >= 21 ? 'mature' : 'review';
      }
    }

    // Fuzz de ±5% pra não empilhar revisões no mesmo dia (só intervalos >= 1d)
    if (nextInterval >= 1) {
      const fuzz = 0.95 + Math.random() * 0.1;
      nextInterval = Math.min(nextInterval * fuzz, maxInt);
    }

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
      pre_lapse_interval: card.pre_lapse_interval || 0,
      reps: nextReps,
      lapses: nextLapses,
      due_date: nextDueDate,
      last_review: new Date(now).toISOString(),
    };
  }

  async predictNextInterval(card, quality) {
    if (this.isProxyMode) return this._proxy('predictNextInterval', [card, quality]);
    const settings = await this.getSRSSettings();
    const clone = JSON.parse(JSON.stringify(card));
    const nextState = this._calculateNextState(clone, quality, settings);
    return nextState.interval;
  }

  async logReview(cardId, quality) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality]);

    const settings = await this.getSRSSettings();
    const res = await this._fetch(`cards?id=eq.${cardId}&limit=1`);
    if (!res || !res.length) throw new Error('Card não encontrado');
    const prevCard = { ...res[0] }; // snapshot para o undo (paridade Anki)

    let card = this._calculateNextState(res[0], quality, settings);

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
    const clientReviewId = globalThis.crypto?.randomUUID?.()
      || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
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
    return {
      ok: true,
      nextDue: new Date(savedCard.due_date).getTime(),
      prevCard,
      card: savedCard,
      reviewLogId: saved?.review_log_id || null,
      xpAwarded: Number(saved?.xp_awarded || 0),
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
    if (this.isProxyMode) return this._proxy('saveSentence', [data]);
    const res = await this._fetch('sentences', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: data
    });
    return { ok: !!res, id: res?.[0]?.id };
  }

  async getAllSentences() {
    if (this.isProxyMode) return this._proxy('getAllSentences', []);
    return (await this._fetch('sentences?select=*')) || [];
  }

  async getSentenceById(id) {
    if (this.isProxyMode) return this._proxy('getSentenceById', [id]);
    const res = await this._fetch(`sentences?id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteSentence(id) {
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
    if (this.isProxyMode) return this._proxy('getAllKnownWords', []);
    return (await this._fetch('known_words?select=*')) || [];
  }

  async logSession(seconds, platform) {
    if (this.isProxyMode) return this._proxy('logSession', [seconds, platform]);
    const date = localDateKey();
    const sessions = await this._fetch(`sessions?date=eq.${date}&limit=1`);

    let before = 0;
    let after = seconds;
    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      before = session.seconds || 0;
      after = before + seconds;
      await this._fetch(`sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        body: { seconds: after }
      });
    } else {
      await this._fetch('sessions', {
        method: 'POST',
        body: { date, seconds }
      });
    }

    // XP por IMERSÃO (item #9 da auditoria): a cada bloco de 5 min de vídeo
    // assistido, credita XP via Learning Engine. O cap diário (30 XP) e o
    // anti-farm ficam no banco (record_learning_event). Assistir vídeo agora
    // dá XP E mantém a ofensiva — antes era 0.
    const BLOCK = 300; // 5 min
    const blocksCrossed = Math.floor(after / BLOCK) - Math.floor(before / BLOCK);
    if (blocksCrossed > 0) {
      // Nunca deixa a falha de XP quebrar o registro de imersão
      this.recordEvent('video_session', blocksCrossed).catch(() => {});
    }
    return true;
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const minDate = localDateKey(addLocalDays(-(Math.max(1, days) - 1)));
    return (await this._fetch(`sessions?date=gte.${minDate}`)) || [];
  }

  async exportDatabase() {
    return JSON.stringify({}); 
  }

  async importDatabase(jsonData) {
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
    const res = await this._fetch(`user_stats?league_index=eq.${leagueIndex}&order=xp_week.desc&limit=${limit}`);
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

  // ── LEARNING ENGINE (portão único de eventos de aprendizado) ─────────────
  // Tipos: game_match, story_read, story_quiz, quests_complete, video_session.
  // O XP/streak é calculado NO BANCO (record_learning_event), com caps diários
  // anti-farm. Retorna { xp_awarded, xp_today, streak, capped }.
  async recordEvent(type, amount = 1) {
    if (this.isProxyMode) return this._proxy('recordEvent', [type, amount]);
    const res = await this._fetch('rpc/record_learning_event', {
      method: 'POST',
      body: { p_type: type, p_amount: amount },
    });
    return res || { xp_awarded: 0 };
  }

  // Missão semanal (Onda 1.5): reivindica +100 XP quando bate a meta de XP da
  // semana. Anti-farm no banco (1x/semana pelo fuso do usuário).
  async claimWeeklyQuest(threshold = 500) {
    if (this.isProxyMode) return this._proxy('claimWeeklyQuest', [threshold]);
    const res = await this._fetch('rpc/claim_weekly_quest', {
      method: 'POST',
      body: { p_threshold: threshold },
    });
    return res || { ok: false };
  }

  // Rollover semanal das ligas (lazy, idempotente — o pg_cron é o titular)
  async maybeLeagueRollover() {
    if (this.isProxyMode) return this._proxy('maybeLeagueRollover', []);
    try {
      return await this._fetch('rpc/maybe_league_rollover', { method: 'POST', body: {} });
    } catch { return { ran: false }; }
  }

  // ── DIAGNÓSTICO DO LINGUISTA (Marco 1 do motor pedagógico) ────────────────
  // Agrega o review_log dos últimos 30 dias POR palavra/categoria/nível.
  // É o insumo REAL da análise do "professor" — nada de achismo da IA:
  // ela recebe números e nomes verdadeiros do aluno.
  async getDiagnosisData(days = 30) {
    if (this.isProxyMode) return this._proxy('getDiagnosisData', [days]);
    const [log, cards, words] = await Promise.all([
      this.getReviewLog(days),
      this.getAllCards(),
      this.getAllWords(),
    ]);

    const wordByCardId = {};
    const wordById = {};
    words.forEach(w => { wordById[w.id] = w; });
    cards.forEach(c => { wordByCardId[c.id] = wordById[c.word_id] || null; });

    const bucket = () => ({ total: 0, hits: 0 });
    const byCategory = {};
    const byLevel = {};
    const byWord = {};

    (log || []).forEach(r => {
      const w = wordByCardId[r.card_id];
      const hit = r.quality >= 2 ? 1 : 0;
      const cat = (w && w.category) || 'word';
      const lvl = (w && w.level) || '—';
      (byCategory[cat] = byCategory[cat] || bucket()).total++;
      byCategory[cat].hits += hit;
      (byLevel[lvl] = byLevel[lvl] || bucket()).total++;
      byLevel[lvl].hits += hit;
      if (w) {
        const key = w.word;
        (byWord[key] = byWord[key] || { ...bucket(), hard: 0 });
        byWord[key].total++;
        byWord[key].hits += hit;
        if (r.quality <= 2) byWord[key].hard++; // Errei ou Difícil
      }
    });

    const pct = (b) => b.total ? Math.round((b.hits / b.total) * 100) : null;
    const strugglingWords = Object.entries(byWord)
      .filter(([, s]) => s.total >= 2 && (s.hard / s.total) >= 0.5)
      .sort((a, b) => b[1].hard - a[1].hard)
      .slice(0, 6)
      .map(([word, s]) => ({ word, reviews: s.total, hardOrWrong: s.hard }));
    const solidWords = Object.entries(byWord)
      .filter(([, s]) => s.total >= 2 && s.hits === s.total && s.hard === 0)
      .slice(0, 5)
      .map(([word]) => word);

    return {
      totalReviews: (log || []).length,
      retentionByCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, { retention: pct(v), reviews: v.total }])),
      retentionByLevel: Object.fromEntries(Object.entries(byLevel).map(([k, v]) => [k, { retention: pct(v), reviews: v.total }])),
      strugglingWords,
      solidWords,
      leeches: cards.filter(c => c.is_leech || (c.lapses || 0) >= 4).length,
      matureCount: cards.filter(c => c.status === 'mature').length,
      totalWords: words.length,
    };
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

  async suspendCard(wordId, suspend = true) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('suspendCard', [wordId, suspend]);
    // BUG antigo: suspender empurrava due_date +365d (corrompia o agendamento).
    // Agora a fila filtra suspended no banco; due_date fica intacto. Ao
    // reativar, cards corrompidos pelo sistema antigo voltam pra "agora".
    let body = { suspended: suspend };
    if (!suspend) {
      const card = await this.getCardByWordId(wordId);
      if (card && new Date(card.due_date).getTime() - Date.now() > 180 * 86400000) {
        body.due_date = new Date().toISOString();
      }
    }
    const res = await this._fetch(`cards?word_id=eq.${wordId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body
    });
    return !!res;
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
