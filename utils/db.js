// utils/db.js — Banco único do LinguaFlow
// Todos os módulos usam este arquivo. Sem chrome.storage para dados de aprendizado.

const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 11;

class Database {
  constructor() {
    this.db = null;
    // isProxyMode será verdadeiro apenas se estivermos em um Content Script (site externo)
    this.isProxyMode =
      typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:';

    if (!this.isProxyMode) {
      this.initPromise = this._open();
    } else {
      this.initPromise = Promise.resolve();
      console.debug('[LinguaFlow DB] Operando em modo Proxy (Content Script)');
    }
  }

  async _open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      console.debug('[LinguaFlow DB] Abrindo IndexedDB:', DB_NAME, 'v', DB_VERSION);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onblocked = () => {
        console.warn(
          '[LinguaFlow DB] Upgrade bloqueado por outra aba aberta. Feche todas as abas da extensão e recarregue.',
        );
      };

      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        console.debug('[LinguaFlow DB] Upgrade necessário v', e.oldVersion, '->', DB_VERSION);

        if (!idb.objectStoreNames.contains('words')) {
          const s = idb.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
          s.createIndex('word_lang', ['word', 'lang'], { unique: true });
          s.createIndex('deck_id', 'deck_id', { unique: false });
          s.createIndex('added_at', 'added_at', { unique: false });
          s.createIndex('category', 'category', { unique: false });
        }
        if (!idb.objectStoreNames.contains('cards')) {
          const s = idb.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
          s.createIndex('word_id', 'word_id', { unique: true });
          s.createIndex('due_date', 'due_date', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!idb.objectStoreNames.contains('decks'))
          idb.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
        if (!idb.objectStoreNames.contains('known_words'))
          idb.createObjectStore('known_words', { keyPath: ['word', 'lang'] });
        if (!idb.objectStoreNames.contains('sessions'))
          idb.createObjectStore('sessions', { keyPath: 'date' });
        if (!idb.objectStoreNames.contains('settings'))
          idb.createObjectStore('settings', { keyPath: 'key' });
        if (!idb.objectStoreNames.contains('sentences'))
          idb.createObjectStore('sentences', { keyPath: 'id', autoIncrement: true });
        if (!idb.objectStoreNames.contains('review_log')) {
          const s = idb.createObjectStore('review_log', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date', { unique: false });
        }

        // Upgrade incremental: adicionar índice category na store words existente
        if (e.oldVersion < 11) {
          try {
            const wordsStore = e.target.transaction.objectStore('words');
            if (!wordsStore.indexNames.contains('category')) {
              wordsStore.createIndex('category', 'category', { unique: false });
            }
          } catch(err) {
            console.warn('[DB] Falha ao adicionar índice category:', err);
          }
        }
      };

      req.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          if (typeof window !== 'undefined' && window.location) {
            console.debug('[LinguaFlow DB] Nova versão detectada. Recarregando...');
            window.location.reload();
          }
        };
        console.debug('[LinguaFlow DB] Banco aberto com sucesso');
        resolve(this.db);
      };
      req.onerror = () => {
        console.error('[LinguaFlow DB] Erro ao abrir banco:', req.error);
        reject(req.error);
      };
    });
  }

  async _proxy(method, args) {
    if (!this.isProxyMode) return null;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(`[LinguaFlow DB] Timeout na chamada ${method}. Service Worker travado.`);
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
        },
      );
    });
  }

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  async getSetting(key) {
    if (this.isProxyMode) return this._proxy('getSetting', [key]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('settings', 'readonly').objectStore('settings').get(key);
      req.onsuccess = () => r(req.result?.value);
      req.onerror = () => r(null);
    });
  }

  async setSetting(key, value) {
    if (this.isProxyMode) return this._proxy('setSetting', [key, value]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb
        .transaction('settings', 'readwrite')
        .objectStore('settings')
        .put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ── PALAVRAS E CARDS ──────────────────────────────────────────────────────
  async saveWord(wordData) {
    if (this.isProxyMode) return this._proxy('saveWord', [wordData]);
    const idb = await this.initPromise;
    const lang = wordData.lang || 'en';
    const word = (wordData.word || '').trim();
    if (!word) throw new Error('Word é obrigatório');

    return new Promise((resolve, reject) => {
      const tx = idb.transaction(['words', 'cards', 'decks'], 'readwrite');
      const wordsStore = tx.objectStore('words');
      const cardsStore = tx.objectStore('cards');

      const checkReq = wordsStore.index('word_lang').get([word, lang]);
      checkReq.onsuccess = () => {
        const existing = checkReq.result;
        const toSave = {
          ...wordData,
          word,
          lang,
          added_at: existing?.added_at || wordData.added_at || Date.now(),
        };
        if (existing) toSave.id = existing.id;

        const wordReq = wordsStore.put(toSave);
        wordReq.onsuccess = (e) => {
          const wordId = e.target.result;
          if (!existing) {
            cardsStore.put({
              word_id: wordId,
              interval: 0,
              ease_factor: 2.5,
              due_date: Date.now(),
              reps: 0,
              status: 'new',
            });
          }
          resolve({ ok: true, id: wordId, isNew: !existing });

          // Sync direto pro Supabase (sem esperar)
          chrome.runtime
            .sendMessage({
              type: 'SYNC_TO_SUPABASE',
              word: word,
              translation: wordData.translation,
              context: wordData.context_sentence,
              deckId: wordData.deck_id,
            })
            .catch(() => {});
        };
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getWord(word, lang = 'en') {
    if (this.isProxyMode) return this._proxy('getWord', [word, lang]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb
        .transaction('words', 'readonly')
        .objectStore('words')
        .index('word_lang')
        .get([word, lang]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getWordById(id) {
    if (this.isProxyMode) return this._proxy('getWordById', [id]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb.transaction('words', 'readonly').objectStore('words').get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteWord(id) {
    if (this.isProxyMode) return this._proxy('deleteWord', [id]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(['words', 'cards'], 'readwrite');
      tx.objectStore('words').delete(id);
      const cardsStore = tx.objectStore('cards');
      cardsStore.index('word_id').get(id).onsuccess = (e) => {
        if (e.target.result) cardsStore.delete(e.target.result.id);
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllWords(deckId = null, limit = 0) {
    if (this.isProxyMode) return this._proxy('getAllWords', [deckId, limit]);
    const idb = await this.initPromise;
    return new Promise((resolve) => {
      const req = idb.transaction('words', 'readonly').objectStore('words').getAll();
      req.onsuccess = () => {
        let res = req.result || [];
        const toFix = res.filter((w) => typeof w.deck_id !== 'number' || isNaN(w.deck_id));
        if (toFix.length) {
          const fixTx = idb.transaction('words', 'readwrite');
          const fixStore = fixTx.objectStore('words');
          toFix.forEach((w) => {
            let newId = parseInt(w.deck_id, 10);
            w.deck_id = isNaN(newId) || newId < 1 ? 1 : newId;
            fixStore.put(w);
          });
        }
        if (deckId) res = res.filter((w) => w.deck_id === deckId);
        res = res.reverse();
        if (limit > 0) res = res.slice(0, limit);
        resolve(res);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getWordsByCategory(category) {
    if (this.isProxyMode) return this._proxy('getWordsByCategory', [category]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(['words', 'cards'], 'readonly');
      const wordsStore = tx.objectStore('words');
      const cardsStore = tx.objectStore('cards');
      const results = [];
      const req = wordsStore.getAll();
      req.onsuccess = () => {
        let words = req.result || [];
        if (category !== 'all') {
          words = words.filter(w => (w.category || 'word') === category);
        }
        // Fetch card status for each word
        let pending = words.length;
        if (pending === 0) { resolve([]); return; }
        words.forEach(w => {
          const cardIdx = cardsStore.index('word_id');
          const cardReq = cardIdx.get(w.id);
          cardReq.onsuccess = () => {
            results.push({ ...w, reps: cardReq.result?.reps || 0, status: cardReq.result?.status || 'new' });
            pending--;
            if (pending === 0) {
              results.sort((a, b) => (a.word || '').localeCompare(b.word || ''));
              resolve(results);
            }
          };
          cardReq.onerror = () => { pending--; if (pending === 0) resolve(results); };
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getWordsByLetter(letter, category) {
    if (this.isProxyMode) return this._proxy('getWordsByLetter', [letter, category]);
    const allWords = await this.getWordsByCategory(category || 'all');
    if (!letter) return allWords;
    return allWords.filter(w => (w.word || '').toUpperCase().startsWith(letter.toUpperCase()));
  }

  async getAllReviewLogs() {
    if (this.isProxyMode) return this._proxy('getAllReviewLogs', []);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb.transaction('review_log', 'readonly').objectStore('review_log').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  async getAllCards() {
    if (this.isProxyMode) return this._proxy('getAllCards', []);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb.transaction('cards', 'readonly').objectStore('cards').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getCardsDue(limit = 50, includeWordData = true) {
    if (this.isProxyMode) return this._proxy('getCardsDue', [limit, includeWordData]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(includeWordData ? ['cards', 'words'] : ['cards'], 'readonly');
      const cardsStore = tx.objectStore('cards');
      const req = cardsStore.index('due_date').getAll(IDBKeyRange.upperBound(Date.now()));

      req.onsuccess = () => {
        let cards = (req.result || []).slice(0, limit);
        if (!cards.length || !includeWordData) {
          resolve(cards);
          return;
        }

        const wordsStore = tx.objectStore('words');
        let done = 0;
        cards.forEach((card) => {
          const r = wordsStore.get(card.word_id);
          r.onsuccess = () => {
            card.wordData = r.result;
            if (++done === cards.length) resolve(cards);
          };
          r.onerror = () => {
            if (++done === cards.length) resolve(cards);
          };
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateCard(card) {
    if (this.isProxyMode) return this._proxy('updateCard', [card]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb.transaction('cards', 'readwrite').objectStore('cards').put(card);
      req.onsuccess = () => resolve({ ok: true });
      req.onerror = () => reject(req.error);
    });
  }

  // ── DECKS ────────────────────────────────────────────────────────────────
  async getAllDecks() {
    if (this.isProxyMode) return this._proxy('getAllDecks', []);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('decks', 'readonly').objectStore('decks').getAll();
      req.onsuccess = () => {
        const res = req.result || [];
        if (!res.find((d) => d.id === 1)) {
          idb
            .transaction('decks', 'readwrite')
            .objectStore('decks')
            .put({ id: 1, name: 'Padrão', created_at: Date.now() });
          res.unshift({ id: 1, name: 'Padrão', created_at: Date.now() });
        }
        r(res);
      };
      req.onerror = () => r([]);
    });
  }

  async createDeck(name) {
    if (this.isProxyMode) return this._proxy('createDeck', [name]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb
        .transaction('decks', 'readwrite')
        .objectStore('decks')
        .add({ name, created_at: Date.now() });
      req.onsuccess = () => resolve({ ok: true, id: req.result });
      req.onerror = () => reject(req.error);
    });
  }

  async getOrCreateDeck(name, url = '') {
    if (this.isProxyMode) return this._proxy('getOrCreateDeck', [name, url]);
    const decks = await this.getAllDecks();
    const existing = decks.find((d) => d.name === name);
    if (existing) return existing.id;

    const idb = await this.initPromise;
    return new Promise((resolve) => {
      const tx = idb.transaction('decks', 'readwrite');
      const req = tx.objectStore('decks').add({
        name,
        url,
        created_at: Date.now(),
        icon: url.includes('youtube') ? '🎬' : '📺',
      });
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getDeckStats() {
    if (this.isProxyMode) return this._proxy('getDeckStats', []);
    const [decks, allCards] = await Promise.all([this.getAllDecks(), this.getAllCards()]);
    const words = await this.getAllWords();

    return decks.map((d) => {
      const deckWords = words.filter((w) => w.deck_id === d.id);
      const deckCards = allCards.filter((c) => deckWords.some((w) => w.id === c.word_id));

      return {
        ...d,
        newCount: deckCards.filter((c) => c.status === 'new').length,
        dueCount: deckCards.filter((c) => c.due_date <= Date.now() && c.status !== 'new').length,
        totalCount: deckCards.length,
      };
    });
  }

  async deleteDeck(id) {
    if (this.isProxyMode) return this._proxy('deleteDeck', [id]);
    if (id === 1) return false;
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(['decks', 'words'], 'readwrite');
      tx.objectStore('decks').delete(id);
      const wordsStore = tx.objectStore('words');
      wordsStore.getAll().onsuccess = (e) => {
        const words = e.target.result.filter((w) => w.deck_id === id);
        words.forEach((w) => {
          w.deck_id = 1;
          wordsStore.put(w);
        });
        tx.oncomplete = () => resolve(true);
      };
    });
  }

  // ── ESTATÍSTICAS E LOGS ───────────────────────────────────────────────────
  async getHistory(limit = 100) {
    if (this.isProxyMode) return this._proxy('getHistory', [limit]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const tx = idb.transaction('words', 'readonly');
      const store = tx.objectStore('words');
      let req;
      try {
        req = store.index('created_at').getAll(null, 'prev');
      } catch (e) {
        // Se o índice não existir, faz fallback
        req = store.getAll();
      }

      req.onsuccess = () => {
        let res = req.result || [];
        if (!store.indexNames.contains('created_at')) {
          res.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        }
        r(res.slice(0, limit));
      };
      req.onerror = () => r([]);
    });
  }

  async getStats() {
    if (this.isProxyMode) return this._proxy('getStats', []);
    const idb = await this.initPromise;

    const getCount = (store) =>
      new Promise((r) => {
        const req = idb.transaction(store, 'readonly').objectStore(store).count();
        req.onsuccess = () => r(req.result);
        req.onerror = () => r(0);
      });

    const [totalWords, totalSentences, dueCount, log, sessions] = await Promise.all([
      getCount('words'),
      getCount('sentences'),
      new Promise((r) => {
        const req = idb
          .transaction('cards', 'readonly')
          .objectStore('cards')
          .index('due_date')
          .count(IDBKeyRange.upperBound(Date.now()));
        req.onsuccess = () => r(req.result);
        req.onerror = () => r(0);
      }),
      this.getReviewLog(30),
      this.getSessions(30),
    ]);

    const byStatus = await new Promise((r) => {
      const tx = idb.transaction('cards', 'readonly');
      const store = tx.objectStore('cards');
      const res = { new: 0, learning: 0, review: 0, mature: 0 };
      let done = 0;
      ['new', 'learning', 'review', 'mature'].forEach((s) => {
        const req = store.index('status').count(s);
        req.onsuccess = (e) => {
          res[s] = e.target.result;
          if (++done === 4) r(res);
        };
      });
    });

    const today = new Date().toISOString().split('T')[0];
    const todaySession = sessions.find((s) => s.date === today);
    const todaySecs = todaySession ? todaySession.seconds : 0;
    const totalSecs = sessions.reduce((acc, s) => acc + (s.seconds || 0), 0);

    const byCEFR = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    const words = await this.getAllWords();
    const cards = await this.getAllCards();
    const cardMap = {};
    cards.forEach((c) => {
      cardMap[c.word_id] = c;
    });

    words.forEach((w) => {
      const card = cardMap[w.id];
      if (!card || card.status === 'new') return; // Só dá XP se já começou a estudar no deck

      if (w.level && byCEFR[w.level] !== undefined) {
        byCEFR[w.level]++;
      } else {
        // Heurística de fallback (Baseada em complexidade silábica estimada por tamanho)
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
        if (s.seconds >= 60) dates.add(s.date); // Pelo menos 1 min de imersão conta como dia estudado
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

  // ── SRS ALGORITHM (ANKI STYLE) ──────────────────────────────────────────
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

  /**
   * SM-2 Algorithm — Anki-compatible spaced repetition scheduler.
   *
   * Card states: new → learning → review → mature
   *
   * NEW cards:
   *   Again(1): enter learning at first step
   *   Hard(2):  enter learning at first step × 1.5
   *   Good(3):  advance to next learning step (or graduate if last)
   *   Easy(4):  graduate immediately with easy_interval
   *
   * LEARNING cards:
   *   Again(1): reset to first step
   *   Hard(2):  stay at current step × 1.5
   *   Good(3):  advance step (or graduate if last step)
   *   Easy(4):  graduate immediately with easy_interval
   *
   * REVIEW/MATURE cards:
   *   Again(1): lapse → learning step 0. Ease -= 0.20.
   *   Hard(2):  interval × 1.2 × interval_modifier. Ease -= 0.15.
   *   Good(3):  interval × ease × interval_modifier.
   *   Easy(4):  interval × ease × easy_bonus × interval_modifier. Ease += 0.15.
   *
   * Graduation: card leaves learning → interval = graduating_interval days.
   * After lapse, re-graduation uses max(gradInt, preLapseInterval × lapseMod).
   */

  async _syncCardToSupabase(card, quality) {
    try {
      const session = await chrome.storage.local.get('lf_supabase_session');
      const s = session.lf_supabase_session ? JSON.parse(session.lf_supabase_session) : null;
      const token = s?.session?.access_token;
      if (!token) return;
      const word = await this.getWordById(card.word_id);
      const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
      const SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: 'resolution=merge-duplicates',
      };
      if (word) {
        await fetch(`${SUPABASE_URL}/rest/v1/words?on_conflict=word,lang`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            word: word.word,
            lang: word.lang || 'en',
            translation: word.translation,
            context_sentence: word.context_sentence,
            added_at: new Date(word.added_at || Date.now()).toISOString(),
          }),
        });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/review_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          card_id: card.word_id,
          quality,
          date: new Date().toISOString().split('T')[0],
          ts: new Date().toISOString(),
        }),
      });
    } catch (_) {}
  }

  _calculateNextState(card, quality, settings) {
    const now = Date.now();
    const prevStatus = card.status || 'new';
    const prevInterval = card.interval || 0;
    const learningSteps = settings.learningSteps; // minutes, e.g. [1, 10]
    const gradInt = settings.gradInt; // days
    const easyInt = settings.easyInt; // days
    const easyBonus = settings.easyBonus; // e.g. 1.3
    const intMod = settings.intMod; // e.g. 1.0
    const maxInt = settings.maxInt; // e.g. 36500
    const lapseMod = settings.lapseMod; // 0.0–1.0, % of prev interval after lapse

    let nextStatus;
    let nextInterval;
    let nextStepIndex = card.step_index || 0;
    let nextEase = card.ease_factor || 2.5;
    let nextLapses = card.lapses || 0;
    let nextReps = (card.reps || 0) + 1;
    let preLapseInterval = card.pre_lapse_interval || 0;

    if (prevStatus === 'new') {
      if (quality === 1) {
        // Again: enter learning at step 0
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
      } else if (quality === 2) {
        // Hard: enter learning at step 0 × 1.5
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = (learningSteps[0] * 1.5) / 1440;
      } else if (quality === 3) {
        // Good: advance step or graduate
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
        // Easy: graduate immediately
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = easyInt;
      }
    } else if (prevStatus === 'learning') {
      if (quality === 1) {
        // Again: back to step 0
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = learningSteps[0] / 1440;
      } else if (quality === 2) {
        // Hard: stay at current step, × 1.5 time
        nextStatus = 'learning';
        const currentMin = learningSteps[nextStepIndex] || 1;
        nextInterval = (currentMin * 1.5) / 1440;
      } else if (quality === 3) {
        // Good: advance or graduate
        nextStepIndex++;
        if (nextStepIndex >= learningSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          // After lapse, use max(gradInt, preLapseInterval × lapseMod)
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
        // Easy: graduate immediately
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = easyInt;
        preLapseInterval = 0;
      }
    } else {
      // review or mature
      if (quality === 1) {
        // Again → Lapse
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

    // Fuzz: ±5% for intervals ≥ 1 day (Anki-like)
    if (nextInterval >= 1) {
      const fuzz = 0.95 + Math.random() * 0.1;
      nextInterval = nextInterval * fuzz;
    }

    // Due date: if ≥ 1 day → next day at midnight; else → now + minutes
    let nextDueDate;
    if (nextInterval >= 1) {
      const d = new Date();
      d.setDate(d.getDate() + Math.round(nextInterval));
      d.setHours(0, 0, 0, 0);
      nextDueDate = d.getTime();
    } else {
      nextDueDate = now + Math.round(nextInterval * 24 * 60 * 60 * 1000);
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
      last_review: now,
    };
  }

  async predictNextInterval(card, quality) {
    if (this.isProxyMode) return this._proxy('predictNextInterval', [card, quality]);
    const settings = await this.getSRSSettings();
    // Clone para evitar mutação do card original (efeito colateral)
    const clone = JSON.parse(JSON.stringify(card));
    const nextState = this._calculateNextState(clone, quality, settings);
    return nextState.interval;
  }

  async logReview(cardId, quality) {
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality]);
    const idb = await this.initPromise;
    const settings = await this.getSRSSettings();

    return new Promise((resolve, reject) => {
      const tx = idb.transaction(['cards', 'review_log'], 'readwrite');
      const cardsStore = tx.objectStore('cards');

      cardsStore.get(cardId).onsuccess = (e) => {
        let card = e.target.result;
        if (!card) return reject(new Error('Card não encontrado'));

        card = this._calculateNextState(card, quality, settings);

        // Leech Handling
        if (card.lapses >= settings.leechThresh) {
          card.is_leech = true;
          if (settings.leechAction === 'suspend') card.suspended = true;
        }

        cardsStore.put(card);

        const today = new Date().toISOString().split('T')[0];
        const logStore = tx.objectStore('review_log');
        logStore.add({ card_id: cardId, quality, date: today, ts: Date.now() });

        tx.oncomplete = () => {
          // Sync direto pro Supabase
          this._syncCardToSupabase(card, quality).catch(() => {});
          resolve({ ok: true, nextDue: card.due_date });
        };
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getReviewLog(days = 30) {
    if (this.isProxyMode) return this._proxy('getReviewLog', [days]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('review_log', 'readonly').objectStore('review_log').getAll();
      req.onsuccess = () => {
        const minTs = Date.now() - days * 24 * 60 * 60 * 1000;
        r((req.result || []).filter((x) => x.ts >= minTs));
      };
      req.onerror = () => r([]);
    });
  }

  async saveSentence(data) {
    if (this.isProxyMode) return this._proxy('saveSentence', [data]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const sentence = {
        ...data,
        id: data.id || Date.now(),
        added_at: data.added_at || Date.now(),
      };
      const req = idb.transaction('sentences', 'readwrite').objectStore('sentences').put(sentence);
      req.onsuccess = () => resolve({ ok: true, id: req.result });
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSentences() {
    if (this.isProxyMode) return this._proxy('getAllSentences', []);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('sentences', 'readonly').objectStore('sentences').getAll();
      req.onsuccess = () => r(req.result || []);
      req.onerror = () => r([]);
    });
  }

  async getSentenceById(id) {
    if (this.isProxyMode) return this._proxy('getSentenceById', [id]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb.transaction('sentences', 'readonly').objectStore('sentences').get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSentence(id) {
    if (this.isProxyMode) return this._proxy('deleteSentence', [id]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const req = idb
        .transaction('sentences', 'readwrite')
        .objectStore('sentences')
        .delete(Number(id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async markAsKnown(word, lang) {
    if (this.isProxyMode) return this._proxy('markAsKnown', [word, lang]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb
        .transaction('known_words', 'readwrite')
        .objectStore('known_words')
        .put({ word: word.toLowerCase(), lang });
      req.onsuccess = () => r(true);
      req.onerror = () => r(false);
    });
  }

  async isKnown(word, lang) {
    if (this.isProxyMode) return this._proxy('isKnown', [word, lang]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb
        .transaction('known_words', 'readonly')
        .objectStore('known_words')
        .get([word.toLowerCase(), lang]);
      req.onsuccess = () => r(!!req.result);
      req.onerror = () => r(false);
    });
  }

  async getAllKnownWords() {
    if (this.isProxyMode) return this._proxy('getAllKnownWords', []);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('known_words', 'readonly').objectStore('known_words').getAll();
      req.onsuccess = () => r(req.result || []);
      req.onerror = () => r([]);
    });
  }

  async logSession(seconds, platform) {
    if (this.isProxyMode) return this._proxy('logSession', [seconds, platform]);
    const idb = await this.initPromise;
    const date = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      store.get(date).onsuccess = (e) => {
        const session = e.target.result || { date, seconds: 0, by_platform: {} };
        session.seconds += seconds;
        session.by_platform[platform] = (session.by_platform[platform] || 0) + seconds;
        store.put(session).onsuccess = () => resolve(true);
      };
    });
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('sessions', 'readonly').objectStore('sessions').getAll();
      req.onsuccess = () => {
        const minDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        r((req.result || []).filter((s) => s.date >= minDate));
      };
      req.onerror = () => r([]);
    });
  }

  async exportDatabase() {
    if (this.isProxyMode) return this._proxy('exportDatabase', []);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const exportData = {};
      const storeNames = Array.from(idb.objectStoreNames);
      const tx = idb.transaction(storeNames, 'readonly');

      let completed = 0;
      if (storeNames.length === 0) return resolve(JSON.stringify({}));

      storeNames.forEach((storeName) => {
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = (e) => {
          exportData[storeName] = e.target.result;
          completed++;
          if (completed === storeNames.length) {
            resolve(JSON.stringify(exportData));
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async importDatabase(jsonData) {
    if (this.isProxyMode) return this._proxy('importDatabase', [jsonData]);
    const idb = await this.initPromise;

    return new Promise((resolve, reject) => {
      let data;
      try {
        data = JSON.parse(jsonData);
      } catch (e) {
        return reject(new Error('JSON inválido'));
      }

      const storeNames = Object.keys(data).filter((name) => idb.objectStoreNames.contains(name));
      if (storeNames.length === 0) return reject(new Error('Nenhum dado válido encontrado.'));

      const tx = idb.transaction(storeNames, 'readwrite');

      try {
        storeNames.forEach((storeName) => {
          const store = tx.objectStore(storeName);
          store.clear();
          if (Array.isArray(data[storeName])) {
            data[storeName].forEach((item) => store.put(item));
          }
        });
      } catch (err) {
        tx.abort();
        return reject(new Error('Falha ao processar os registros do JSON.'));
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  async getCardByWordId(wordId) {
    if (this.isProxyMode) return this._proxy('getCardByWordId', [wordId]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb
        .transaction('cards', 'readonly')
        .objectStore('cards')
        .index('word_id')
        .get(Number(wordId));
      req.onsuccess = () => r(req.result || null);
      req.onerror = () => r(null);
    });
  }

  async getCardStats(cardId) {
    if (this.isProxyMode) return this._proxy('getCardStats', [cardId]);
    const idb = await this.initPromise;
    return new Promise((r) => {
      const req = idb.transaction('review_log', 'readonly').objectStore('review_log').getAll();
      req.onsuccess = () => {
        const all = (req.result || []).filter((x) => x.card_id === Number(cardId));
        r(all.sort((a, b) => b.ts - a.ts).slice(0, 30));
      };
      req.onerror = () => r([]);
    });
  }

  async suspendCard(wordId, suspend = true) {
    if (this.isProxyMode) return this._proxy('suspendCard', [wordId, suspend]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      store.index('word_id').get(Number(wordId)).onsuccess = (e) => {
        const card = e.target.result;
        if (!card) return resolve(false);
        card.suspended = suspend;
        if (suspend) {
          // Move para data futura remota para sair da fila
          card.due_date = Date.now() + 365 * 24 * 60 * 60 * 1000;
        }
        store.put(card).onsuccess = () => resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async addTagsToWord(wordId, tags) {
    if (this.isProxyMode) return this._proxy('addTagsToWord', [wordId, tags]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('words', 'readwrite');
      const store = tx.objectStore('words');
      store.get(Number(wordId)).onsuccess = (e) => {
        const word = e.target.result;
        if (!word) return resolve(false);
        word.tags = Array.isArray(tags) ? tags.join(',') : tags || '';
        store.put(word).onsuccess = () => resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkUpdateDeck(wordIds, deckId) {
    if (this.isProxyMode) return this._proxy('bulkUpdateDeck', [wordIds, deckId]);
    const idb = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('words', 'readwrite');
      const store = tx.objectStore('words');
      let done = 0;
      if (!wordIds.length) return resolve(true);
      wordIds.forEach((id) => {
        store.get(Number(id)).onsuccess = (e) => {
          const word = e.target.result;
          if (word) {
            word.deck_id = deckId;
            store.put(word);
          }
          if (++done === wordIds.length) resolve(true);
        };
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTags() {
    if (this.isProxyMode) return this._proxy('getAllTags', []);
    const words = await this.getAllWords();
    const tagSet = new Set();
    words.forEach((w) => {
      if (w.tags)
        w.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => tagSet.add(t));
    });
    return [...tagSet].sort();
  }
}

export const db = new Database();
