// utils/db/gamification-repo.js — Repositório especializado em Gamificação, Ligas, Telemetria e Web Push
// Submódulo modular extraído de utils/db.js (Cloud-Only / Supabase)

export class GamificationRepository {
  /**
   * @param {import('../db.js').Database} db Instância do DatabaseService
   */
  constructor(db) {
    this.db = db;
    this._ensureUserStatsPromise = null;
    this._timezoneSynced = null;
  }

  // ── ESTATÍSTICAS E TELEMETRIA ───────────────────────────────────────────

  async getUserStats() {
    if (this.db.isProxyMode) return this.db._proxy('getUserStats', []);
    const res = await this.db._fetch('user_stats?select=*&limit=1');
    return res && res.length > 0 ? res[0] : null;
  }

  // Telemetria mínima: nunca envia texto do card, pergunta, token, e-mail ou
  // stack trace. É só o suficiente para detectar uma tela/fluxo quebrado.
  async reportClientError(source, errorName, route = '', appVersion = '') {
    if (this.db.isProxyMode) return this.db._proxy('reportClientError', [source, errorName, route, appVersion]);
    const safe = value => String(value || 'Error').replace(/[^a-zA-Z0-9_.:/ -]/g, '').slice(0, 120);
    try {
      await this.db._fetch('client_errors', {
        method: 'POST',
        body: {
          source: safe(source).slice(0, 80),
          error_name: safe(errorName),
          route: safe(route).slice(0, 80) || null,
          app_version: safe(appVersion).slice(0, 40) || null,
        },
      });
    } catch { /* telemetria nunca interrompe o produto */ }
  }

  // ── LIGAS E CLASSIFICAÇÃO ────────────────────────────────────────────────

  async getLeaderboard(leagueIndex = 0, limit = 20) {
    if (this.db.isProxyMode) return this.db._proxy('getLeaderboard', [leagueIndex, limit]);
    const res = await this.db._fetch('rpc/get_leaderboard', {
      method: 'POST',
      body: { p_league_index: leagueIndex, p_limit: limit },
    });
    return res || [];
  }

  async ensureUserStats() {
    if (this.db.isProxyMode) return this.db._proxy('ensureUserStats', []);

    // App boot e a tela de Ligas podem pedir o mesmo bootstrap quase juntos.
    // Compartilhar a promessa evita duas RPCs e duas validações de fuso.
    if (this._ensureUserStatsPromise) return this._ensureUserStatsPromise;
    this._ensureUserStatsPromise = (async () => {
      // Apenas garante que o perfil exista via backend (XP agora é automático por Triggers)
      await this.db._fetch('rpc/ensure_user_stats', { method: 'POST' });
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone && timezone !== this._timezoneSynced) {
        await this.db._fetch('rpc/set_user_timezone', { method: 'POST', body: { p_timezone: timezone } });
        this._timezoneSynced = timezone;
        if (this.db) this.db._timezoneSynced = timezone;
      }
      return { ok: true };
    })();
    if (this.db) this.db._ensureUserStatsPromise = this._ensureUserStatsPromise;

    try {
      return await this._ensureUserStatsPromise;
    } catch (error) {
      this._ensureUserStatsPromise = null;
      if (this.db) this.db._ensureUserStatsPromise = null;
      throw error;
    }
  }

  // Rollover semanal das ligas (lazy, idempotente — o pg_cron é o titular)
  async maybeLeagueRollover() {
    if (this.db.isProxyMode) return this.db._proxy('maybeLeagueRollover', []);
    try {
      return await this.db._fetch('rpc/maybe_league_rollover', { method: 'POST', body: {} });
    } catch { return { ran: false }; }
  }

  // ── WEB PUSH & ENGAJAMENTO ───────────────────────────────────────────────

  async getPushPublicKey() {
    if (this.db.isProxyMode) return this.db._proxy('getPushPublicKey', []);
    const res = await this.db._fetch('rpc/get_push_public_key', { method: 'POST', body: {} });
    return typeof res === 'string' ? res : null;
  }

  async savePushSubscription(sub) {
    if (this.db.isProxyMode) return this.db._proxy('savePushSubscription', [sub]);
    const keys = sub?.keys || {};
    if (!sub?.endpoint || !keys.p256dh || !keys.auth) return { ok: false };
    const res = await this.db._fetch('push_subscriptions?on_conflict=user_id,endpoint', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return { ok: !!res };
  }

  async deletePushSubscription(endpoint) {
    if (this.db.isProxyMode) return this.db._proxy('deletePushSubscription', [endpoint]);
    if (!endpoint) return { ok: false };
    await this.db._fetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
    return { ok: true };
  }

  async setEmailOptIn(enabled) {
    if (this.db.isProxyMode) return this.db._proxy('setEmailOptIn', [enabled]);
    const res = await this.db._fetch('rpc/set_email_opt_in', {
      method: 'POST',
      body: { p_enabled: !!enabled },
    });
    return res || { ok: false };
  }

  // ── CONQUISTAS ───────────────────────────────────────────────────────────

  async saveAchievement(achievementId) {
    if (this.db.isProxyMode) return this.db._proxy('saveAchievement', [achievementId]);
    const res = await this.db._fetch('user_achievements?on_conflict=user_id,achievement_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: { achievement_id: String(achievementId) },
    });
    return !!res;
  }

  async getUserAchievements() {
    if (this.db.isProxyMode) return this.db._proxy('getUserAchievements', []);
    const rows = await this.db._fetch('user_achievements?select=achievement_id,unlocked_at');
    return (rows || []).map(r => r.achievement_id);
  }

  resetSessionState() {
    this._ensureUserStatsPromise = null;
    this._timezoneSynced = null;
    if (this.db) {
      this.db._ensureUserStatsPromise = null;
      this.db._timezoneSynced = null;
    }
  }
}
