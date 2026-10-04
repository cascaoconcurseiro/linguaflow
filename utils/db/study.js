// utils/db/study.js — Estatísticas e tempo de estudo: histórico, streak, sessões, estudo manual, fila de listening e resumo do painel.
import { WORD_SELECT } from './shared.js';
import { addLocalDays, localDateKey } from '../local-day.js';

export class StudyMethods {
  // ── ESTATÍSTICAS E LOGS ───────────────────────────────────────────────────

  async getHistory(limit = 100) {
    if (this.isProxyMode) return this._proxy('getHistory', [limit]);
    return (await this._fetch(`words?select=${WORD_SELECT}&order=added_at.desc&limit=${limit}`)) || [];
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
    const todaySecs = sessions
      .filter((session) => session.date === today)
      .reduce((sum, session) => sum + Number(session.seconds || 0), 0);
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
      userStats,
    };
  }

  async getStatsSnapshot(days = 60) {
    if (this.isProxyMode) return this._proxy('getStatsSnapshot', [days]);
    // Estatísticas são uma tela de conferência, não um feed otimista: sempre
    // descarte SWR e leia o banco sob o JWT da sessão atual.
    this._invalidateReadCache('cards');
    const [cards, reviewLog, sessions] = await Promise.all([
      this.getAllCards(),
      this.getReviewLog(days),
      this.getSessions(days),
    ]);
    return { cards, reviewLog, sessions };
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

  // Contador automático removido (#387): só drena intervalos que ficaram na fila do dispositivo.
  async drainListeningQueue() {
    if (this._listeningDrain) return this._listeningDrain;
    this._listeningDrain = (async () => {
      const userId = await this.getCurrentUserId();
      if (!userId) return { pending: true };
      const key = `lf_listening_queue_v1:${userId}`;
      const queue = await this._draftStorage('get', key) || [];
      for (const item of queue) {
        if (await this.getCurrentUserId() !== userId) return { pending: true };
        try {
          if (Date.now() - Date.parse(item.startedAt) < 7 * 86400000) await this._fetch('rpc/record_listening_interval', { method:'POST', signal:AbortSignal.timeout(12000), body:{
            p_event_id:item.id, p_account_id:userId, p_seconds:item.seconds,
            p_started_at:item.startedAt, p_ended_at:item.endedAt,
            p_language:item.language, p_date:item.date, p_evidence:item.evidence || 'user_confirmed',
          }});
        } catch (error) {
          console.warn('[Listening] sync_pending', { code:error.code || error.kind || 'network' });
          return { pending: true };
        }
        const remove = async () => {
          const current = await this._draftStorage('get', key) || [];
          await this._draftStorage('set', key, current.filter(row => row.id !== item.id));
        };
        const write = (this._listeningWrite || Promise.resolve()).then(remove);
        this._listeningWrite = write.catch(() => {});
        await write;
      }
      return { pending: (await this._draftStorage('get', key) || []).length > 0 };
    })().finally(() => { this._listeningDrain = null; });
    return this._listeningDrain;
  }

  // Funil de uso (#426): só evento + plataforma de uma lista fechada; nunca conteúdo, URL ou título.
  async logUsageEvent(event, platform = 'none') {
    if (this.isProxyMode) return this._proxy('logUsageEvent', [event, platform]);
    await this._fetch('rpc/log_usage_event', { method: 'POST', body: { p_event: event, p_platform: platform } });
  }

  async adminGetUsageFunnel(days = 14) {
    if (this.isProxyMode) return this._proxy('adminGetUsageFunnel', [days]);
    return await this._adminRpc('admin_usage_funnel', { p_days: days }) || {};
  }

  async logSession(seconds, platform, language = 'en') {
    if (this.isProxyMode) return this._proxy('logSession', [seconds, platform, language]);
    const date = localDateKey();
    const source = this._sessionSource(platform);
    const lang = String(language || 'en').toLowerCase().trim();
    await this._fetch('rpc/log_study_time', {
      method: 'POST',
      body: {
        p_seconds: Math.max(1, Math.min(300, Math.round(seconds))),
        p_date: date,
        p_source: source,
        p_language: lang,
      },
    });

    // Tempo assistido continua sendo métrica de atividade. Ele não concede XP:
    // duração enviada pelo cliente não é evidência competitiva verificável.
    return true;
  }

  formatStudyTime(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s > 0 ? '< 1m' : '0m';
    const totalMinutes = Math.floor(s / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  async getStudyStats(language = 'en') {
    if (this.isProxyMode) return this._proxy('getStudyStats', [language]);
    const lang = String(language || 'en').toLowerCase().trim();
    const today = localDateKey();
    const sessions = await this.getSessions(null);

    let unclassifiedSeconds = 0;
    let listeningToday = 0;
    let listeningTotal = 0;
    let cardsToday = 0;
    let cardsTotal = 0;
    let readingToday = 0;
    let readingTotal = 0;
    let writingToday = 0;
    let writingTotal = 0;
    let speakingToday = 0;
    let speakingTotal = 0;

    for (const s of sessions) {
      const sLang = String(s.language || 'und').toLowerCase().trim();
      if (sLang === 'und') unclassifiedSeconds += Math.max(0, Number(s.seconds) || 0);
      if (sLang !== lang) continue;
      const sec = Math.max(0, Number(s.seconds) || 0);
      const isToday = s.date === today;
      const src = String(s.source || '').toLowerCase();

      if (src === 'video' || src === 'manual_listening') {
        listeningTotal += sec;
        if (isToday) listeningToday += sec;
      } else if (src === 'review' || src === 'study') {
        cardsTotal += sec;
        if (isToday) cardsToday += sec;
      } else if (src === 'reader' || src === 'manual_reading') {
        readingTotal += sec;
        if (isToday) readingToday += sec;
      } else if (src === 'manual_writing') {
        writingTotal += sec;
        if (isToday) writingToday += sec;
      } else if (src === 'manual_speaking') {
        speakingTotal += sec;
        if (isToday) speakingToday += sec;
      }
    }

    const totalSecondsToday = listeningToday + cardsToday + readingToday + speakingToday + writingToday;
    const totalSecondsAllTime = listeningTotal + cardsTotal + readingTotal + speakingTotal + writingTotal;
    const totalHoursFloat = (totalSecondsAllTime / 3600).toFixed(1);

    return {
      language: lang,
      unclassified: { totalSeconds:unclassifiedSeconds, totalFormatted:this.formatStudyTime(unclassifiedSeconds) },
      listening: {
        todaySeconds: listeningToday,
        totalSeconds: listeningTotal,
        todayFormatted: this.formatStudyTime(listeningToday),
        totalFormatted: this.formatStudyTime(listeningTotal),
        totalHours: Math.round(listeningTotal / 3600),
      },
      cards: {
        todaySeconds: cardsToday,
        totalSeconds: cardsTotal,
        todayFormatted: this.formatStudyTime(cardsToday),
        totalFormatted: this.formatStudyTime(cardsTotal),
      },
      reading: {
        todaySeconds: readingToday,
        totalSeconds: readingTotal,
        todayFormatted: this.formatStudyTime(readingToday),
        totalFormatted: this.formatStudyTime(readingTotal),
      },
      writing: {
        todaySeconds: writingToday, totalSeconds: writingTotal,
        todayFormatted: this.formatStudyTime(writingToday), totalFormatted: this.formatStudyTime(writingTotal),
      },
      speaking: {
        todaySeconds: speakingToday,
        totalSeconds: speakingTotal,
        todayFormatted: this.formatStudyTime(speakingToday),
        totalFormatted: this.formatStudyTime(speakingTotal),
      },
      summary: {
        totalSecondsToday,
        totalSecondsAllTime,
        todayFormatted: this.formatStudyTime(totalSecondsToday),
        totalFormatted: this.formatStudyTime(totalSecondsAllTime),
        totalHours: totalHoursFloat,
      },
    };
  }

  async logManualStudy({ skill, minutes, date, language, notes }) {
    if (this.isProxyMode) return this._proxy('logManualStudy', [{ skill, minutes, date, language, notes }]);
    const validSkills = ['reading', 'speaking', 'listening', 'writing'];
    const safeSkill = String(skill || '').toLowerCase().trim();
    if (!validSkills.includes(safeSkill)) {
      throw new Error(`Habilidade de estudo inválida: ${skill}`);
    }
    const safeMinutes = Number(minutes);
    if (!Number.isInteger(safeMinutes) || safeMinutes < 1 || safeMinutes > 720) throw new Error('Informe de 1 a 720 minutos inteiros.');
    const safeDate = date || localDateKey();
    const safeLang = String(language || 'en').toLowerCase().trim();

    return await this._fetch('rpc/log_manual_study', {
      method: 'POST',
      body: {
        p_skill: safeSkill,
        p_minutes: safeMinutes,
        p_date: safeDate,
        p_language: safeLang,
        p_notes: notes ? String(notes).slice(0, 500) : null,
      },
    });
  }

  _sessionSource(platform) {
    const value = String(platform || '').toLowerCase();
    if (value === 'reader') return 'reader';
    if (value === 'review' || value === 'study') return 'review';
    if (value === 'pwa' || value === 'web') return 'pwa';
    if (this.isChromeContext && /youtube|netflix|disney|prime|video|^max$|hbo/.test(value)) return 'video';
    return this.isChromeContext ? 'extension' : 'pwa';
  }

  async getSessions(days = 30) {
    if (this.isProxyMode) return this._proxy('getSessions', [days]);
    const filter = days === null ? '' : `date=gte.${localDateKey(addLocalDays(-(Math.max(1, days) - 1))) }&`;
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this._fetch(`sessions?${filter}order=date.asc,id.asc&limit=1000&offset=${offset}`, { throwOnReadError: true });
      if (!Array.isArray(page)) throw new Error('Não foi possível carregar o tempo de estudo.');
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  // ── MÉTODOS DE AUDITORIA E HARDENING ─────────────────────────────────────

  // Resumo analítico ultrarrápido calculado no Postgres (<1 KB)
  async getDashboardSummary() {
    if (this.isProxyMode) return this._proxy('getDashboardSummary', []);
    return await this._fetch('rpc/get_dashboard_summary', { method: 'POST', body: {} });
  }

  // Sessões de vídeo / Histórico de imersão
  async saveWatchSession(sessionData) {
    if (this.isProxyMode) return this._proxy('saveWatchSession', [sessionData]);
    const payload = {
      platform: sessionData.platform || 'youtube',
      video_url: String(sessionData.video_url || ''),
      video_title: sessionData.video_title ? String(sessionData.video_title).slice(0, 300) : null,
      duration_seconds: Math.max(0, Math.round(Number(sessionData.duration_seconds || 0))),
      watched_at: sessionData.watched_at || new Date().toISOString(),
    };
    if (!payload.video_url) return { ok: false };
    const res = await this._fetch('media_watch_sessions', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: payload,
    });
    return { ok: !!res?.[0], id: res?.[0]?.id };
  }

  async getWatchSessions(limit = 50) {
    if (this.isProxyMode) return this._proxy('getWatchSessions', [limit]);
    return (await this._fetch(`media_watch_sessions?select=*&order=watched_at.desc&limit=${limit}`)) || [];
  }
}
