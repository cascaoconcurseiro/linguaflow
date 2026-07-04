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
    // Sincroniza IndexedDB → Supabase
    if (!this.token) throw new Error('Não autenticado');

    const words = await db.getAllWords();
    const cards = await db.getAllCards();
    const reviewLogs = await db.getAllReviewLogs();
    const sentences = await db.getAllSentences();

    let synced = 0;

    // Upload words + cards
    for (const w of words) {
      try {
        const wordPayload = {
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
        };
        const wordRes = await fetch(`${SUPABASE_URL}/rest/v1/words?on_conflict=user_id,word,lang`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
            apikey: SUPABASE_ANON_KEY,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(wordPayload),
        });
        if (wordRes.ok) synced++;
      } catch (e) {
        /* skip */
      }
    }

    return synced;
  }

  async syncDown(db) {
    // Sincroniza Supabase → IndexedDB
    if (!this.token) throw new Error('Não autenticado');

    const wordsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/words?select=*&order=added_at.desc&limit=200`,
      {
        headers: { Authorization: `Bearer ${this.token}`, apikey: SUPABASE_ANON_KEY },
      },
    );

    if (!wordsRes.ok) return 0;

    const words = await wordsRes.json();
    let imported = 0;

    for (const w of words) {
      try {
        await db.saveWord({
          word: w.word,
          lang: w.lang,
          translation: w.translation,
          context_sentence: w.context_sentence,
          phonetic: w.phonetic,
          pronunciation_pt: w.pronunciation_pt,
          level: w.level,
          tags: w.tags,
          chunks: w.chunks,
          added_at: new Date(w.added_at).getTime(),
        });
        imported++;
      } catch (e) {
        /* skip duplicates */
      }
    }

    return imported;
  }
}

export const supabaseAuth = new SupabaseAuth();
