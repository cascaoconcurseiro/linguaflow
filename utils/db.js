// utils/db.js — Banco único do LinguaFlow (Cloud-Only)
// Integração 100% direta com Supabase via REST API (sem IndexedDB local)

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';

class Database {
  constructor() {
    this.isExtensionUI = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.sendMessage;
    this.isBackgroundWorker = typeof window === 'undefined';
    this.isProxyMode = this.isExtensionUI && !this.isBackgroundWorker;
    this.initPromise = Promise.resolve();
  }

  async _getToken() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get('lf_supabase_session', (res) => {
          const sessionStr = res.lf_supabase_session;
          if (!sessionStr) return resolve(null);
          try {
            const s = JSON.parse(sessionStr);
            resolve(s?.session?.access_token || null);
          } catch { resolve(null); }
        });
      });
    } else {
      try {
        const sessionStr = localStorage.getItem('lf_supabase_session');
        if (!sessionStr) return null;
        const s = JSON.parse(sessionStr);
        return s?.session?.access_token || null;
      } catch { return null; }
    }
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
        throw new Error(`[Supabase Error] ${res.status}: ${err}`);
      }
      if (res.status === 204) return [];
      return await res.json();
    } catch (e) {
      console.error('[DB] Fetch Error:', e);
      return null;
    }
  }

  async _proxy(method, args) {
    if (!this.isProxyMode) return null;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(`[LinguaFlow DB] Timeout na chamada ${method}.`);
        reject(new Error(`DB proxy timeout: ${method}`));
      }, 5000);

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
      
      const sessionStr = JSON.stringify({ session: { access_token: data.access_token, user: data.user } });
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ lf_supabase_session: sessionStr });
      }
      localStorage.setItem('lf_supabase_session', sessionStr);
      
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
        const sessionStr = JSON.stringify({ session: { access_token: data.session.access_token, user: data.user } });
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ lf_supabase_session: sessionStr });
        }
        localStorage.setItem('lf_supabase_session', sessionStr);
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
    localStorage.removeItem('lf_supabase_session');
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
    return res && res.length > 0 ? res[0].value : null;
  }

  async setSetting(key, value) {
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
      deck_id: wordData.deck_id || null,
      phonetic: wordData.phonetic || null,
      tags: wordData.tags ? wordData.tags.split(',').map(t => t.trim()) : null
    };
    
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
    if (this.isProxyMode) return this._proxy('deleteWord', [id]);
    await this._fetch(`words?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  async getAllWords(deckId = null, limit = 0) {
    if (this.isProxyMode) return this._proxy('getAllWords', [deckId, limit]);
    let query = `words?select=*&order=added_at.desc`;
    if (deckId) query += `&deck_id=eq.${deckId}`;
    if (limit > 0) query += `&limit=${limit}`;
    const res = await this._fetch(query);
    return res || [];
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
    if (this.isProxyMode) return this._proxy('getAllCards', []);
    return (await this._fetch('cards?select=*')) || [];
  }

  async getCardsDue(limit = 50, includeWordData = true) {
    if (this.isProxyMode) return this._proxy('getCardsDue', [limit, includeWordData]);
    const now = new Date().toISOString();
    let query = `cards?due_date=lte.${encodeURIComponent(now)}&order=due_date.asc&limit=${limit}`;
    
    if (includeWordData) {
      query = `cards?select=*,words(*)&due_date=lte.${encodeURIComponent(now)}&order=due_date.asc&limit=${limit}`;
    }

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

  async updateCard(card) {
    if (this.isProxyMode) return this._proxy('updateCard', [card]);
    const { wordData, ...cleanCard } = card;
    const res = await this._fetch(`cards?id=eq.${card.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: cleanCard
    });
    return { ok: !!res };
  }

  // ── DECKS ────────────────────────────────────────────────────────────────
  async getAllDecks() {
    if (this.isProxyMode) return this._proxy('getAllDecks', []);
    let decks = await this._fetch('decks?select=*&order=created_at.asc');
    if (!decks || decks.length === 0) {
      const res = await this._fetch('decks', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: { name: 'Padrão' }
      });
      decks = res || [];
    }
    return decks;
  }

  async createDeck(name) {
    if (this.isProxyMode) return this._proxy('createDeck', [name]);
    const res = await this._fetch('decks', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: { name }
    });
    return { ok: !!res, id: res?.[0]?.id };
  }

  async getOrCreateDeck(name, url = '') {
    if (this.isProxyMode) return this._proxy('getOrCreateDeck', [name, url]);
    const decks = await this.getAllDecks();
    const existing = decks.find((d) => d.name === name);
    if (existing) return existing.id;

    const res = await this._fetch('decks', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: { name, icon: url.includes('youtube') ? '🎬' : '📺' }
    });
    return res?.[0]?.id;
  }

  async getDeckStats() {
    if (this.isProxyMode) return this._proxy('getDeckStats', []);
    const [decks, allCards, words] = await Promise.all([
      this.getAllDecks(),
      this.getAllCards(),
      this.getAllWords()
    ]);

    const now = new Date().toISOString();

    return decks.map((d) => {
      const deckWords = words.filter((w) => w.deck_id === d.id);
      const deckCards = allCards.filter((c) => deckWords.some((w) => w.id === c.word_id));

      return {
        ...d,
        newCount: deckCards.filter((c) => c.status === 'new').length,
        dueCount: deckCards.filter((c) => c.due_date <= now && c.status !== 'new').length,
        totalCount: deckCards.length,
      };
    });
  }

  async deleteDeck(id) {
    if (this.isProxyMode) return this._proxy('deleteDeck', [id]);
    await this._fetch(`decks?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  // ── ESTATÍSTICAS E LOGS ───────────────────────────────────────────────────
  async getHistory(limit = 100) {
    if (this.isProxyMode) return this._proxy('getHistory', [limit]);
    return (await this._fetch(`words?select=*&order=added_at.desc&limit=${limit}`)) || [];
  }

  async getStats() {
    if (this.isProxyMode) return this._proxy('getStats', []);
    const [words, sentences, cards, log, sessions] = await Promise.all([
      this.getAllWords(),
      this.getAllSentences(),
      this.getAllCards(),
      this.getReviewLog(30),
      this.getSessions(30),
    ]);

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const now = new Date().toISOString();
    const dueCount = cards.filter(c => c.due_date <= now).length;

    const byStatus = { new: 0, learning: 0, review: 0, mature: 0 };
    cards.forEach(c => {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++;
    });

    const today = new Date().toISOString().split('T')[0];
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
      streak: this._calculateStreak(log, sessions),
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
    if (logs) logs.forEach((l) => dates.add(l.date));
    if (sessions)
      sessions.forEach((s) => {
        if (s.seconds >= 60) dates.add(s.date);
      });

    let streak = 0;
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0];
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
    return {
      gradInt: Number(await this.getSetting('graduating_interval')) || 1,
      easyInt: Number(await this.getSetting('easy_interval')) || 4,
      initEase: (Number(await this.getSetting('initial_ease')) || 250) / 100,
      maxInt: Number(await this.getSetting('max_interval')) || 36500,
      leechThresh: Number(await this.getSetting('leech_threshold')) || 8,
      easyBonus: (Number(await this.getSetting('easy_bonus')) || 130) / 100,
      intMod: (Number(await this.getSetting('interval_modifier')) || 100) / 100,
      lapseMod: (Number(await this.getSetting('lapse_modifier')) || 0) / 100,
      leechAction: (await this.getSetting('leech_action')) || 'tag',
      learningSteps: ((await this.getSetting('learning_steps')) || '1 10')
        .split(' ')
        .map(Number)
        .filter((n) => n > 0),
    };
  }

  _calculateNextState(card, quality, settings) {
    const now = Date.now();
    const prevStatus = card.status || 'new';
    const prevInterval = card.interval || 0;
    const learningSteps = settings.learningSteps;
    const gradInt = settings.gradInt;
    const easyInt = settings.easyInt;
    const easyBonus = settings.easyBonus;
    const intMod = settings.intMod;
    const maxInt = settings.maxInt;
    const lapseMod = settings.lapseMod;

    let nextStatus;
    let nextInterval;
    let nextStepIndex = card.step_index || 0;
    let nextEase = card.ease_factor || 2.5;
    let nextLapses = card.lapses || 0;
    let nextReps = (card.reps || 0) + 1;
    let preLapseInterval = card.pre_lapse_interval || 0;

    if (prevStatus === 'new') {
      if (quality === 1) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
      } else if (quality === 2) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = (learningSteps[0] * 1.5) / 1440;
      } else if (quality === 3) {
        if (learningSteps.length <= 1) {
          nextStatus = 'review';
          nextStepIndex = 0;
          nextInterval = gradInt;
        } else {
          nextStatus = 'learning';
          nextStepIndex = 1;
          nextInterval = learningSteps[1] / 1440;
        }
      } else {
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = easyInt;
      }
    } else if (prevStatus === 'learning') {
      if (quality === 1) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
      } else if (quality === 2) {
        nextStatus = 'learning';
        const currentMin = learningSteps[nextStepIndex] || 1;
        nextInterval = (currentMin * 1.5) / 1440;
      } else if (quality === 3) {
        nextStepIndex++;
        if (nextStepIndex >= learningSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          if (preLapseInterval > 0) {
            nextInterval = Math.max(gradInt, preLapseInterval * lapseMod);
            preLapseInterval = 0;
          } else {
            nextInterval = gradInt;
          }
        } else {
          nextStatus = 'learning';
          nextInterval = learningSteps[nextStepIndex] / 1440;
        }
      } else {
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = easyInt;
        preLapseInterval = 0;
      }
    } else {
      if (quality === 1) {
        nextLapses++;
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
        nextEase = Math.max(1.3, nextEase - 0.2);
        preLapseInterval = prevInterval;
      } else {
        if (quality === 2) {
          nextInterval = Math.max(prevInterval * 1.2 * intMod, prevInterval + 1);
          nextEase = Math.max(1.3, nextEase - 0.15);
        } else if (quality === 3) {
          nextInterval = Math.max(prevInterval * nextEase * intMod, prevInterval + 1);
        } else {
          nextInterval = Math.max(prevInterval * nextEase * easyBonus * intMod, prevInterval + 1);
          nextEase += 0.15;
        }
        nextInterval = Math.min(nextInterval, maxInt);
        if (nextInterval >= 21) nextStatus = 'mature';
        else nextStatus = 'review';
      }
    }

    if (nextInterval >= 1) {
      const fuzz = 0.95 + Math.random() * 0.1;
      nextInterval = nextInterval * fuzz;
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
      ease_factor: nextEase,
      pre_lapse_interval: preLapseInterval,
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
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality]);
    
    const settings = await this.getSRSSettings();
    const res = await this._fetch(`cards?id=eq.${cardId}&limit=1`);
    if (!res || !res.length) throw new Error('Card não encontrado');
    let card = res[0];

    card = this._calculateNextState(card, quality, settings);

    if (card.lapses >= settings.leechThresh) {
      card.is_leech = true;
      if (settings.leechAction === 'suspend') card.suspended = true;
    }

    await this.updateCard(card);

    await this._fetch('review_log', {
      method: 'POST',
      body: {
        card_id: cardId,
        quality,
        date: new Date().toISOString().split('T')[0],
        ts: new Date().toISOString()
      }
    });

    return { ok: true, nextDue: new Date(card.due_date).getTime() };
  }

  async getReviewLog(days = 30) {
    if (this.isProxyMode) return this._proxy('getReviewLog', [days]);
    const minDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return (await this._fetch(`review_log?date=gte.${minDate}`)) || [];
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
    const date = new Date().toISOString().split('T')[0];
    const sessions = await this._fetch(`sessions?date=eq.${date}&limit=1`);
    
    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      await this._fetch(`sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        body: { seconds: session.seconds + seconds }
      });
    } else {
      await this._fetch('sessions', {
        method: 'POST',
        body: { date, seconds }
      });
    }
    return true;
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const minDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return (await this._fetch(`sessions?date=gte.${minDate}`)) || [];
  }

  async exportDatabase() {
    return JSON.stringify({}); 
  }

  async importDatabase(jsonData) {
    return true; 
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
    if (this.isProxyMode) return this._proxy('suspendCard', [wordId, suspend]);
    let body = { suspended: suspend };
    if (suspend) {
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      body.due_date = future;
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

  async bulkUpdateDeck(wordIds, deckId) {
    if (this.isProxyMode) return this._proxy('bulkUpdateDeck', [wordIds, deckId]);
    if (!wordIds.length) return true;
    const res = await this._fetch(`words?id=in.(${wordIds.join(',')})`, {
      method: 'PATCH',
      body: { deck_id: deckId }
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
