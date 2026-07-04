/**
 * LinguaFlow Extension — Supabase Auth + Sync
 * Faz o dashboard da extensão autenticar com a mesma conta do site.
 * Dados sincronizados entre extensão (IndexedDB) e nuvem (Supabase).
 */

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';

export class SupabaseAuth {
  constructor() {
    this.session = null;
    this.user = null;
    this.token = null;
  }

  async init() {
    // Tenta restaurar sessão do chrome.storage.local
    const stored = await chrome.storage.local.get('lf_supabase_session');
    if (stored.lf_supabase_session) {
      try {
        const { session, user } = JSON.parse(stored.lf_supabase_session);
        // Verifica se o token ainda é válido
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
        });
        if (res.ok) {
          this.session = session;
          this.user = user;
          this.token = session.access_token;
          return true;
        }
        // Token expirado — tenta refresh
        if (session.refresh_token) {
          const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          if (refreshRes.ok) {
            const newSession = await refreshRes.json();
            this.session = newSession;
            this.user = newSession.user;
            this.token = newSession.access_token;
            await this._saveSession(newSession);
            return true;
          }
        }
      } catch (e) {
        console.debug('[SupabaseAuth] Sessão inválida:', e.message);
      }
    }
    return false;
  }

  async login(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error_description || err.msg || 'Erro de autenticação');
    }
    const session = await res.json();
    this.session = session;
    this.user = session.user;
    this.token = session.access_token;
    await this._saveSession(session);
    return session;
  }

  async register(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.msg || err.error_description || 'Erro ao criar conta');
    }
    return await res.json();
  }

  async logout() {
    if (this.token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, apikey: SUPABASE_ANON_KEY },
      }).catch(() => {});
    }
    this.session = null;
    this.user = null;
    this.token = null;
    await chrome.storage.local.remove('lf_supabase_session');
  }

  async _saveSession(session) {
    await chrome.storage.local.set({
      lf_supabase_session: JSON.stringify({
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        user: session.user,
      }),
    });
  }

  isLoggedIn() {
    return !!this.token;
  }

  async syncUp(db) {
    if (!this.token) throw new Error('Não autenticado');

    const words = await db.getAllWords();
    const cards = await db.getAllCards();
    const reviewLogs = await db.getAllReviewLogs();
    const sentences = await db.getAllSentences();

    let synced = { words: 0, cards: 0, logs: 0, sentences: 0 };
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      apikey: SUPABASE_ANON_KEY,
      Prefer: 'resolution=merge-duplicates',
    };

    // Upload words
    for (const w of words) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/words?on_conflict=word,lang`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            word: w.word,
            lang: w.lang || 'en',
            translation: w.translation,
            context_sentence: w.context_sentence,
            phonetic: w.phonetic,
            pronunciation_pt: w.pronunciation_pt,
            level: w.level,
            tags: w.tags,
            chunks: w.chunks,
            added_at: new Date(w.added_at).toISOString(),
          }),
        });
        if (res.ok) synced.words++;
      } catch (_) {}
    }

    // Upload cards (SRS state)
    for (const c of cards) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cards?on_conflict=word_id`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            word: c.word,
            lang: c.lang || 'en',
            status: c.status,
            interval: c.interval,
            ease_factor: c.ease_factor,
            learning_step: c.learning_step,
            due_date: c.due_date ? new Date(c.due_date).toISOString() : null,
            last_review: c.last_review ? new Date(c.last_review).toISOString() : null,
            reps: c.reps || 0,
            lapses: c.lapses || 0,
            deck_id: c.deck_id || 1,
          }),
        });
        if (res.ok) synced.cards++;
      } catch (_) {}
    }

    // Upload review logs
    for (const r of reviewLogs) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/review_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            word: r.word,
            lang: r.lang || 'en',
            quality: r.quality,
            elapsed_ms: r.elapsed_ms,
            reviewed_at: new Date(r.reviewed_at || Date.now()).toISOString(),
          }),
        });
        if (res.ok) synced.logs++;
      } catch (_) {}
    }

    // Upload sentences
    for (const s of sentences) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sentences`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: s.text,
            translation: s.translation,
            source_url: s.source_url,
            source_title: s.source_title,
            saved_at: new Date(s.saved_at || Date.now()).toISOString(),
          }),
        });
        if (res.ok) synced.sentences++;
      } catch (_) {}
    }

    return synced;
  }

  async syncDown(db) {
    if (!this.token) throw new Error('Não autenticado');

    const headers = { Authorization: `Bearer ${this.token}`, apikey: SUPABASE_ANON_KEY };
    let imported = { words: 0, sentences: 0 };

    // Download words with cards
    const wordsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/words?select=*&order=added_at.desc&limit=500`,
      { headers },
    );
    if (!wordsRes.ok) return imported;
    const words = await wordsRes.json();

    for (const w of words) {
      try {
        // Check if card exists for this word
        const cardRes = await fetch(
          `${SUPABASE_URL}/rest/v1/cards?select=*&word=eq.${encodeURIComponent(w.word)}&lang=eq.${w.lang || 'en'}&limit=1`,
          { headers },
        );
        const cards = cardRes.ok ? await cardRes.json() : [];
        const card = cards[0];

        await db.saveWord({
          word: w.word,
          lang: w.lang || 'en',
          translation: w.translation,
          context_sentence: w.context_sentence,
          phonetic: w.phonetic,
          pronunciation_pt: w.pronunciation_pt,
          level: w.level,
          tags: w.tags,
          chunks: w.chunks,
          added_at: new Date(w.added_at).getTime(),
          // Preserve SRS state from Supabase if available
          status: card?.status || 'new',
          interval: card?.interval || 0,
          ease_factor: card?.ease_factor || 2.5,
          learning_step: card?.learning_step || 0,
          due_date: card?.due_date ? new Date(card.due_date).getTime() : Date.now(),
          last_review: card?.last_review ? new Date(card.last_review).getTime() : null,
          reps: card?.reps || 0,
          lapses: card?.lapses || 0,
        });
        imported.words++;
      } catch (_) {}
    }

    // Download sentences
    const sentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sentences?select=*&order=saved_at.desc&limit=100`,
      { headers },
    );
    if (sentRes.ok) {
      const sentences = await sentRes.json();
      for (const s of sentences) {
        try {
          await db.saveSentence({
            text: s.text,
            translation: s.translation,
            source_url: s.source_url,
            source_title: s.source_title,
            saved_at: new Date(s.saved_at).getTime(),
          });
          imported.sentences++;
        } catch (_) {}
      }
    }

    return imported;
  }
}

export const supabaseAuth = new SupabaseAuth();
