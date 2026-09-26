// utils/db/reader-stories-repo.js — Repositório especializado em Histórias e Web Reader
// Submódulo modular extraído de utils/db.js (Cloud-Only / Supabase)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ReaderStoriesRepository {
  /**
   * @param {import('../db.js').Database} db Instância do DatabaseService
   */
  constructor(db) {
    this.db = db;
    this._storiesCache = null;
    this._storiesRefreshing = null;
  }

  // ── HISTÓRIAS (biblioteca permanente — história gerada nunca se perde) ────

  async saveStory(story) {
    if (this.db.isProxyMode) return this.db._proxy('saveStory', [story]);
    const res = await this.db._fetch('stories', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: {
        title: story.title,
        content: story.content,
        level: story.level || null,
        genre: story.genre || null,
        requested_level: story.requestedLevel || story.level || null,
        target_minutes: story.targetMinutes || null,
        learning_goal: story.learningGoal || null,
        difficulty_mode: story.difficultyMode || null,
        measured_level: story.measuredLevel || null,
        validation_status: story.validationStatus || 'not_measured',
        prompt_version: story.promptVersion || 'story-v2',
      }
    });
    this.invalidateCache();
    return { ok: !!res?.[0], id: res?.[0]?.id, createdAt: res?.[0]?.created_at };
  }

  async getStories(limit = 50) {
    if (this.db.isProxyMode) return this.db._proxy('getStories', [limit]);
    if (limit === 50 && this._storiesCache) {
      if (Date.now() - this._storiesCache.ts >= 30000 && !this._storiesRefreshing) {
        this._storiesRefreshing = this._fetchStories(limit)
          .finally(() => { this._storiesRefreshing = null; });
        this._storiesRefreshing.catch(() => {});
      }
      return this._storiesCache.data;
    }
    return this._fetchStories(limit);
  }

  async _fetchStories(limit = 50) {
    const rows = await this.db._fetch(`stories?select=*&order=created_at.desc&limit=${limit}`);
    if (!rows) throw new Error('Não foi possível carregar as histórias do Supabase.');
    if (limit === 50) {
      this._storiesCache = { data: rows, ts: Date.now() };
      this.db._storiesCache = this._storiesCache;
    }
    return rows;
  }

  async deleteStory(id) {
    if (!UUID_PATTERN.test(String(id))) return false;
    if (this.db.isProxyMode) return this.db._proxy('deleteStory', [id]);
    await this.db._fetch(`stories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    this.invalidateCache();
    return true;
  }

  async updateStoryArchive(storyId, archived = true) {
    if (this.db.isProxyMode) return this.db._proxy('updateStoryArchive', [storyId, archived]);
    await this.db._fetch(`stories?id=eq.${encodeURIComponent(storyId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: { archived: Boolean(archived), updated_at: new Date().toISOString() },
    });
    return { ok: true };
  }

  // ── WEB READER & TEXTOS SINCRONIZADOS ────────────────────────────────────

  async getReaderTexts() {
    if (this.db.isProxyMode) return this.db._proxy('getReaderTexts', []);
    return this.db._fetch('reader_texts?select=id,title,content,source,last_read_position,reading_percentage,is_completed,created_at,updated_at&order=updated_at.desc');
  }

  async saveReaderText(text) {
    if (this.db.isProxyMode) return this.db._proxy('saveReaderText', [text]);
    const row = {
      id: String(text.id),
      title: String(text.title || 'Texto').slice(0, 300),
      content: String(text.content || ''),
      source: text.source || 'pasted',
      created_at: new Date(text.addedAt || Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const saved = await this.db._fetch('reader_texts?on_conflict=user_id,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: row,
    });
    return saved?.[0] || row;
  }

  async migrateReaderText(text) {
    if (this.db.isProxyMode) return this.db._proxy('migrateReaderText', [text]);
    const migratedAt = new Date(text.addedAt || Date.now()).toISOString();
    const row = {
      id: String(text.id),
      title: String(text.title || 'Texto').slice(0, 300),
      content: String(text.content || ''),
      source: text.source || 'migration',
      created_at: migratedAt,
      updated_at: migratedAt,
    };
    const saved = await this.db._fetch('reader_texts?on_conflict=user_id,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: row,
    });
    return saved?.[0] || null;
  }

  async deleteReaderText(id) {
    if (this.db.isProxyMode) return this.db._proxy('deleteReaderText', [id]);
    await this.db._fetch(`reader_texts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    return true;
  }

  async updateReaderProgress(textId, { lastReadPosition = 0, readingPercentage = 0, isCompleted = false } = {}) {
    if (this.db.isProxyMode) return this.db._proxy('updateReaderProgress', [textId, { lastReadPosition, readingPercentage, isCompleted }]);
    const body = {
      last_read_position: Math.max(0, Math.floor(Number(lastReadPosition) || 0)),
      reading_percentage: Math.min(100, Math.max(0, Number(readingPercentage) || 0)),
      is_completed: Boolean(isCompleted),
      updated_at: new Date().toISOString(),
    };
    await this.db._fetch(`reader_texts?id=eq.${encodeURIComponent(textId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body,
    });
    return { ok: true };
  }

  invalidateCache() {
    this._storiesCache = null;
    if (this.db) {
      this.db._storiesCache = null;
    }
  }
}
