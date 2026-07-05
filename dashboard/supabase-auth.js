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
    const stored = await chrome.storage.local.get('lf_supabase_session');
    if (stored.lf_supabase_session) {
      try {
        const { session, user } = JSON.parse(stored.lf_supabase_session);
        // Timeout de 5s pra não travar o dashboard
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
          signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));
        if (res.ok) {
          this.session = session;
          this.user = user;
          this.token = session.access_token;
          return true;
        }
        if (session.refresh_token) {
          const ctrl2 = new AbortController();
          const timer2 = setTimeout(() => ctrl2.abort(), 5000);
          const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
            signal: ctrl2.signal,
          }).finally(() => clearTimeout(timer2));
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
    if (!this.token) return { words: 0 };
    const words = await db.getAllWords();
    let synced = 0;
    for (const w of words.slice(0, 50)) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/words`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
            apikey: SUPABASE_ANON_KEY,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            word: w.word,
            lang: w.lang || 'en',
            translation: w.translation,
            context_sentence: w.context_sentence,
            added_at: new Date(w.added_at || Date.now()).toISOString(),
          }),
        }).finally(() => clearTimeout(t));
        if (res.ok) synced++;
      } catch (_) {}
    }
    return { words: synced };
  }

  async syncDown(db) {
    if (!this.token) return { words: 0 };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/words?select=*&order=added_at.desc&limit=100`,
        {
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${this.token}`, apikey: SUPABASE_ANON_KEY },
        },
      ).finally(() => clearTimeout(t));
      if (!res.ok) return { words: 0 };
      const words = await res.json();
      let imported = 0;
      for (const w of words) {
        try {
          await db.saveWord({
            word: w.word,
            lang: w.lang || 'en',
            translation: w.translation,
            context_sentence: w.context_sentence,
            added_at: new Date(w.added_at).getTime(),
          });
          imported++;
        } catch (_) {}
      }
      return { words: imported };
    } catch (_) {
      return { words: 0 };
    }
  }
}

export const supabaseAuth = new SupabaseAuth();
