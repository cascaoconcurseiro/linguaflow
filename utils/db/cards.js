// utils/db/cards.js — Cards: fila de estudo, devidos de hoje, enterrar, suspender, restaurar e resetar.
import { WORD_SELECT } from './shared.js';
import { localDayBounds } from '../local-day.js';

export class CardsMethods {
  async getAllCards() {
    // Mesma estratégia SWR de getAllWords (Onda 4) — ver comentário lá.
    if (this._cardsCache) {
      if (Date.now() - this._cardsCache.ts >= 30000 && !this._cardsRefreshing) {
        this._cardsRefreshing = this._fetchCards().finally(() => { this._cardsRefreshing = null; });
        this._cardsRefreshing.catch(() => {});
      }
      return this._cardsCache.data;
    }
    return this._fetchCards();
  }

  async _fetchCards() {
    const gen = this._cacheGeneration; // ver comentário em _fetchWords
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllCards', []);
    else data = await this._fetch('cards?select=*');
    if (gen !== this._cacheGeneration) return data || [];
    this._cardsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  // minutesAhead: "learn ahead" do Anki — inclui cards de aprendizado que
  // vencem nos próximos N minutos (permite fechar a sessão de verdade).
  async getCardsDue(limit = 50, includeWordData = true, minutesAhead = 0) {
    if (this.isProxyMode) return this._proxy('getCardsDue', [limit, includeWordData, minutesAhead]);
    const horizon = new Date(Date.now() + minutesAhead * 60000).toISOString();
    const select = includeWordData ? `select=*,words(${WORD_SELECT})&` : '';
    // suspended filtrado NO BANCO (antes vinha tudo e filtrava no cliente)
    const query = `cards?${select}due_date=lte.${encodeURIComponent(horizon)}&suspended=is.false&order=due_date.asc&limit=${limit}`;

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

  async getCardsDueCount(minutesAhead = 0) {
    if (this.isProxyMode) return this._proxy('getCardsDueCount', [minutesAhead]);
    const horizon = new Date(Date.now() + minutesAhead * 60000).toISOString();
    const query = `cards?select=id&due_date=lte.${encodeURIComponent(horizon)}&suspended=is.false`;
    const res = await this._fetch(query);
    return Array.isArray(res) ? res.length : 0;
  }

  // Busca cada estado com seu próprio limite. Uma grande quantidade de cards
  // novos nunca pode consumir a janela SQL destinada a reviews já vencidos.
  async getStudyCards({ newLimit = 0, reviewLimit = 0, topic = null } = {}) {
    if (this.isProxyMode) return this._proxy('getStudyCards', [{ newLimit, reviewLimit, topic }]);

    const horizon = encodeURIComponent(new Date().toISOString());
    const safeNewLimit = Math.min(1000, Math.max(0, Math.floor(Number(newLimit) || 0)));
    const safeReviewLimit = Math.min(1000, Math.max(0, Math.floor(Number(reviewLimit) || 0)));
    const topicFilter = typeof topic === 'string' && topic.trim() ? topic.trim() : null;
    const select = topicFilter ? `select=*,words!inner(${WORD_SELECT})&` : `select=*,words(${WORD_SELECT})&`;
    const category = topicFilter ? `&words.category=eq.${encodeURIComponent(topicFilter)}` : '';
    const query = (status, limit) => `cards?${select}status=${status}&due_date=lte.${horizon}&suspended=is.false${category}&order=due_date.asc&limit=${limit}`;

    const [learning, reviews, newCards] = await Promise.all([
      this._fetch(query('eq.learning', 1000)),
      safeReviewLimit ? this._fetch(query('in.(review,mature)', safeReviewLimit)) : Promise.resolve([]),
      safeNewLimit ? this._fetch(query('eq.new', safeNewLimit)) : Promise.resolve([]),
    ]);
    if (!learning || !reviews || !newCards) return null;

    const cards = [...learning, ...reviews, ...newCards];
    cards.forEach(card => {
      card.wordData = card.words;
      delete card.words;
    });
    return cards;
  }

  // Palavras que o aluno salvou hoje (dia local). Alimenta o resumo do popup da extensão.
  async getWordsSavedToday() {
    if (this.isProxyMode) return this._proxy('getWordsSavedToday', []);
    const { start, end } = localDayBounds();
    const rows = await this._fetch(`words?select=id&added_at=gte.${encodeURIComponent(start.toISOString())}&added_at=lt.${encodeURIComponent(end.toISOString())}`);
    return Array.isArray(rows) ? rows.length : 0;
  }

  // Contadores do dia para os limites diários (novas/dia e revisões/dia)
  async getTodayCounts() {
    if (this.isProxyMode) return this._proxy('getTodayCounts', []);
    const { start, end } = localDayBounds();
    const [logToday, introduced, undosToday] = await Promise.all([
      // O teto diário é de revisões propriamente ditas. Um passo de card novo
      // ou learning não consome esse orçamento. previous_status é gravado no
      // servidor pela RPC, antes de alterar o card; nunca vem do cliente.
      this._fetch(`review_log?previous_status=in.(review,mature)&ts=gte.${encodeURIComponent(start.toISOString())}&ts=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`cards?introduced_at=gte.${encodeURIComponent(start.toISOString())}&introduced_at=lt.${encodeURIComponent(end.toISOString())}&select=id`),
      this._fetch(`card_review_undos?created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lt.${encodeURIComponent(end.toISOString())}&select=review_log_id`).catch(() => []),
    ]);
    const undoneSet = new Set((undosToday || []).map((u) => u.review_log_id).filter(Boolean));
    const activeReviews = (logToday || []).filter((l) => !undoneSet.has(l.id));
    return {
      reviewsToday: activeReviews.length,
      newIntroducedToday: (introduced || []).length,
    };
  }

  async buryCard(cardId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('buryCard', [cardId]);
    return this._fetch('rpc/bury_card', {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async setCardSuspended(cardId, suspended = true) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('setCardSuspended', [cardId, suspended]);
    return this._fetch(`rpc/${suspended ? 'suspend_card' : 'restore_card'}`, {
      method: 'POST',
      body: { p_card_id: cardId },
    });
  }

  async restoreCardState(cardId, state) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('restoreCardState', [cardId, state]);
    return this._fetch('rpc/restore_card_state', {
      method: 'POST',
      body: { p_card_id: cardId, p_state: state },
    });
  }

  // Resetar card (Forget / Reset do Anki): volta o card ao estado 'new' sem apagar histórico
  async resetCardToNew(cardId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('resetCardToNew', [cardId]);
    return this._fetch('rpc/reset_card_to_new', {
      method: 'POST',
      body: { p_card_id: cardId },
    });
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
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('suspendCard', [wordId, suspend]);
    // BUG antigo: suspender empurrava due_date +365d (corrompia o agendamento).
    // Agora a fila filtra suspended no banco; due_date fica intacto. Ao
    // reativar, cards corrompidos pelo sistema antigo voltam pra "agora".
    const card = await this.getCardByWordId(wordId);
    if (!card) return false;
    return !!(await this.setCardSuspended(card.id, suspend));
  }
}
