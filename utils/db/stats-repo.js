// utils/db/stats-repo.js — Estatísticas de todo o sistema (página Progresso).

export class StatsRepository {
  /**
   * @param {import('../db.js').Database} db
   */
  constructor(db) {
    this.db = db;
  }

  // days: 7, 30, 90, 365 ou 0 (todo o período).
  getSystemStats(days = 30) {
    const d = Number(days);
    const clean = [0, 7, 30, 90, 365].includes(d) ? d : 30;
    return this.db._fetch('rpc/rpc_system_stats', { method: 'POST', body: { p_days: clean } });
  }
}
