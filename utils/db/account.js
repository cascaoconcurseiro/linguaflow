// utils/db/account.js — Conta e engajamento: estatísticas do usuário, ranking, push, e-mail, cache de tradução e conquistas.
export class AccountMethods {
  // ── GAMIFICAÇÃO E ESTATÍSTICAS (delegadas ao GamificationRepository) ────────
  async getUserStats() {
    return this._gamificationRepo.getUserStats();
  }

  // Telemetria mínima: nunca envia texto do card, pergunta, token, e-mail ou
  // stack trace. É só o suficiente para detectar uma tela/fluxo quebrado.
  async reportClientError(source, errorName, route = '', appVersion = '') {
    return this._gamificationRepo.reportClientError(source, errorName, route, appVersion);
  }

  async getLeaderboard(leagueIndex = 0, limit = 20) {
    return this._gamificationRepo.getLeaderboard(leagueIndex, limit);
  }

  async ensureUserStats() {
    return this._gamificationRepo.ensureUserStats();
  }

  // Rollover semanal das ligas (lazy, idempotente — o pg_cron é o titular)
  async maybeLeagueRollover() {
    return this._gamificationRepo.maybeLeagueRollover();
  }

  // ── WEB PUSH (opt-in explícito nas Configurações) ─────────────────────────
  async getPushPublicKey() {
    return this._gamificationRepo.getPushPublicKey();
  }

  async savePushSubscription(sub) {
    return this._gamificationRepo.savePushSubscription(sub);
  }

  async deletePushSubscription(endpoint) {
    return this._gamificationRepo.deletePushSubscription(endpoint);
  }

  // Onda 3.4: opt-in de reengajamento por e-mail (resumo semanal + ofensiva
  // em risco) — mesmo padrão de RPC restrita ao próprio usuário do push.
  async setEmailOptIn(enabled) {
    return this._gamificationRepo.setEmailOptIn(enabled);
  }

  // ── CACHE DE TRADUÇÃO (tabela própria — NUNCA mais dentro de settings) ────
  async _translationCacheRequest(endpoint, options = {}) {
    const controller = new AbortController();
    let timeoutId;
    const deadline = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, 2500);
    });
    try {
      return await Promise.race([
        this._fetch(endpoint, { ...options, signal: controller.signal, silent: true }).catch(() => null),
        deadline,
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTranslationCache(cacheKey) {
    if (this.isProxyMode) return this._proxy('getTranslationCache', [cacheKey]);
    const res = await this._translationCacheRequest(`translation_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=value&limit=1`);
    return res && res.length > 0 ? res[0].value : null;
  }

  async setTranslationCache(cacheKey, value) {
    if (this.isProxyMode) return this._proxy('setTranslationCache', [cacheKey, value]);
    const res = await this._translationCacheRequest('translation_cache?on_conflict=user_id,cache_key', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: { cache_key: cacheKey, value },
    });
    return !!res;
  }

  // Conquistas normalizadas no banco
  async saveAchievement(achievementId) {
    return this._gamificationRepo.saveAchievement(achievementId);
  }

  async getUserAchievements() {
    return this._gamificationRepo.getUserAchievements();
  }
}
