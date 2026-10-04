// utils/db/srs.js — Agendamento: configurações de SRS, perfis por categoria, FSRS-4.5, previsão e registro/desfazer de revisão.
import { createOperationId } from './shared.js';
import { addLocalDays, localDayBounds } from '../local-day.js';
import { FSRS_DECAY, FSRS_FACTOR, FSRS_W, SRS_OVERRIDABLE_KEYS } from './srs-constants.js';

export class SrsMethods {
  async getSRSSettings(category) {
    if (this.isProxyMode) return this._proxy('getSRSSettings', [category]);
    // GARGALO CORRIGIDO: eram 11 chamadas REST sequenciais A CADA avaliação
    // de card (a "demora ao clicar em Difícil"). Agora: 1 request em lote +
    // cache de 60s (por categoria), invalidado quando qualquer setting é gravada.
    const cacheKey = category || '__global__';
    if (this._srsCache && this._srsCache.key === cacheKey && Date.now() - this._srsCache.ts < 60000) {
      return this._srsCache.value;
    }

    const baseKeys = ['graduating_interval', 'easy_interval', 'initial_ease', 'max_interval',
      'leech_threshold', 'easy_bonus', 'interval_modifier', 'lapse_modifier',
      'leech_action', 'lf_srs_retention', 'learning_steps', 'relearning_steps',
      'new_per_day', 'max_reviews_per_day', 'srs_new_order', 'srs_review_order'];
    const catKeys = category ? SRS_OVERRIDABLE_KEYS.map(k => `${k}:${category}`) : [];
    // Onda 9 (auditoria de bugs): `category` chega da coluna words.category,
    // que não é validada como enum no banco (a checagem contra a lista
    // fixa só roda no classificador da extensão) — sem encode, uma vírgula
    // ou parêntese na categoria quebraria o filtro in.(...) do PostgREST.
    // O método irmão (setSRSCategoryOverride) já fazia isso; faltava aqui.
    const keys = [...baseKeys, ...catKeys].map(encodeURIComponent);
    const map = {};
    const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
    (rows || []).forEach(r => { map[r.key] = r.value; });
    // Override por categoria vence o valor global, só se estiver de fato gravado
    if (category) {
      SRS_OVERRIDABLE_KEYS.forEach(k => {
        const catVal = map[`${k}:${category}`];
        if (catVal !== undefined && catVal !== null && catVal !== '') map[k] = catVal;
      });
    }

    const parsedNewPerDay = Number(map.new_per_day ?? 20);
    const parsedMaxRevPerDay = Number(map.max_reviews_per_day ?? 200);
    const value = {
      gradInt: Number(map.graduating_interval) || 1,
      easyInt: Number(map.easy_interval) || 4,
      initEase: (Number(map.initial_ease) || 250) / 100,
      maxInt: Number(map.max_interval) || 36500,
      leechThresh: Number(map.leech_threshold) || 8,
      easyBonus: (Number(map.easy_bonus) || 130) / 100,
      intMod: (Number(map.interval_modifier) || 100) / 100,
      lapseMod: (Number(map.lapse_modifier) || 0) / 100,
      leechAction: map.leech_action || 'tag',
      // Retenção desejada do FSRS (0.7-0.97): mais alto = revisões mais frequentes
      retention: Math.min(0.97, Math.max(0.7, Number(map.lf_srs_retention) || 0.9)),
      learningSteps: String(map.learning_steps || '1 10')
        .replace(/m/gi, '')
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => n > 0),
      relearningSteps: String(map.relearning_steps || '10')
        .replace(/m/gi, '')
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => n > 0),
      // Limites diários (paridade Anki): controlam a fila de estudo
      newPerDay: Number.isFinite(parsedNewPerDay)
        ? Math.min(20, Math.max(0, parsedNewPerDay))
        : 20,
      maxRevPerDay: Number.isFinite(parsedMaxRevPerDay)
        ? Math.min(1000, Math.max(1, parsedMaxRevPerDay))
        : 200,
      newOrder: map.srs_new_order || 'sequential',
      reviewOrder: map.srs_review_order || 'due',
    };
    if (value.learningSteps.length === 0) value.learningSteps = [1, 10];
    if (value.relearningSteps.length === 0) value.relearningSteps = [10];
    this._srsCache = { key: cacheKey, value, ts: Date.now() };
    return value;
  }

  // Onda 9: overrides de SRS por categoria salvos/lidos pela Config (chaves
  // sufixadas ":categoria" no mesmo k/v de settings). category=null limpa.
  async getSRSCategoryOverrides(category) {
    if (this.isProxyMode) return this._proxy('getSRSCategoryOverrides', [category]);
    const keys = SRS_OVERRIDABLE_KEYS.map(k => encodeURIComponent(`${k}:${category}`));
    const rows = await this._fetch(`settings?key=in.(${keys.join(',')})`);
    const out = {};
    (rows || []).forEach(r => {
      const base = r.key.split(':')[0];
      out[base] = r.value;
    });
    return out;
  }

  async setSRSCategoryOverride(category, key, value) {
    if (this.isProxyMode) return this._proxy('setSRSCategoryOverride', [category, key, value]);
    if (!SRS_OVERRIDABLE_KEYS.includes(key)) throw new Error(`Chave não sobrescrevível por categoria: ${key}`);
    const fullKey = `${key}:${category}`;
    if (value === null || value === '') {
      this._srsCache = null;
      await this._fetch(`settings?key=eq.${encodeURIComponent(fullKey)}`, { method: 'DELETE' });
      return true;
    }
    return this.setSetting(fullKey, value);
  }

  _fsrsInitDifficulty(q) {
    const w = FSRS_W;
    return Math.min(10, Math.max(1, w[4] - (q - 3) * w[5]));
  }

  _fsrsInitStability(q) {
    return Math.max(0.1, FSRS_W[q - 1]);
  }

  _fsrsRetrievability(elapsedDays, stability) {
    const s = Math.max(0.1, Number(stability) || 0.1);
    return Math.pow(1 + FSRS_FACTOR * elapsedDays / s, FSRS_DECAY);
  }

  _fsrsInterval(stability, retention) {
    const s = Math.max(0.1, Number(stability) || 0.1);
    const ret = Math.min(0.99, Math.max(0.7, Number(retention) || 0.9));
    return (s / FSRS_FACTOR) * (Math.pow(ret, 1 / FSRS_DECAY) - 1);
  }

  _fsrsNextDifficulty(d, q) {
    const w = FSRS_W;
    const dPrime = d - w[6] * (q - 3);
    const meanReverted = w[7] * this._fsrsInitDifficulty(4) + (1 - w[7]) * dPrime;
    return Math.min(10, Math.max(1, meanReverted));
  }

  _fsrsNextStability(d, s, r, q) {
    const w = FSRS_W;
    if (q === 1) {
      // Esqueceu: estabilidade pós-lapso
      return Math.max(0.1, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
    }
    const hardPenalty = q === 2 ? w[15] : 1;
    const easyBonus = q === 4 ? w[16] : 1;
    return Math.max(0.1, s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
      (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus));
  }

  _calculateNextState(card, quality, settings, now = Date.now()) {
    const prevStatus = card.status || 'new';
    const learningSteps = settings.learningSteps;
    const relearningSteps = settings.relearningSteps?.length ? settings.relearningSteps : [10];
    const retention = settings.retention;
    const maxInt = settings.maxInt;

    let nextStatus;
    let nextInterval;
    let nextStepIndex = card.step_index || 0;
    let nextLapses = card.lapses || 0;
    let preLapseInterval = Number(card.pre_lapse_interval || 0);
    const nextReps = (card.reps || 0) + 1;

    // Estado FSRS: semeia a partir do histórico se o card veio do SM-2 antigo
    let stability = (Number.isFinite(Number(card.stability)) && Number(card.stability) > 0) ? Number(card.stability) : null;
    let difficulty = (Number.isFinite(Number(card.difficulty)) && Number(card.difficulty) > 0) ? Number(card.difficulty) : null;

    const elapsedDays = card.last_review
      ? Math.max(0, (now - new Date(card.last_review).getTime()) / 86400000)
      : 0;
    const isRelearning = prevStatus === 'learning' && preLapseInterval > 0;

    if (prevStatus === 'new' || prevStatus === 'learning') {
      const activeSteps = isRelearning ? relearningSteps : learningSteps;
      // Learning steps (minutos), como no Anki com FSRS habilitado
      if (difficulty === null) difficulty = this._fsrsInitDifficulty(quality);
      if (stability === null) stability = this._fsrsInitStability(quality);

      if (quality === 1) {
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = activeSteps[0] / 1440;
      } else if (quality === 2) {
        // Semântica do Anki: Difícil repete o passo atual e nunca gradua o card.
        // No primeiro passo com dois ou mais steps, usa a média entre o passo
        // atual e o próximo; com um único step, usa 1,5× o intervalo.
        nextStatus = 'learning';
        nextStepIndex = prevStatus === 'new' ? 0 : Math.min(nextStepIndex, activeSteps.length - 1);
        if (activeSteps.length === 1) {
          nextInterval = (activeSteps[0] * 1.5) / 1440;
        } else if (nextStepIndex === 0) {
          nextInterval = ((activeSteps[0] + activeSteps[1]) / 2) / 1440;
        } else {
          nextInterval = activeSteps[nextStepIndex] / 1440;
        }
      } else if (quality === 4) {
        // Fácil: gradua direto com bônus do FSRS.
        // easy_interval (config) é o piso; interval_modifier escala tudo.
        if (!isRelearning) {
          stability = this._fsrsInitStability(4);
          difficulty = this._fsrsInitDifficulty(4);
        }
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = Math.min(maxInt, Math.max(settings.easyInt || 4,
          this._fsrsInterval(stability, retention) * settings.intMod));
      } else {
        // Bom: avança um step; gradua no fim dos steps.
        // graduating_interval (config) é o piso da graduação.
        nextStepIndex = prevStatus === 'new' ? 1 : nextStepIndex + 1;
        if (nextStepIndex >= activeSteps.length) {
          nextStatus = 'review';
          nextStepIndex = 0;
          nextInterval = Math.min(maxInt, Math.max(settings.gradInt || 1,
            this._fsrsInterval(stability, retention) * settings.intMod));
        } else {
          nextStatus = 'learning';
          nextInterval = activeSteps[nextStepIndex] / 1440;
        }
      }
    } else {
      // review/mature: FSRS puro
      if (stability === null) stability = Math.max(card.interval || 1, 0.1); // legado SM-2
      if (difficulty === null) difficulty = this._fsrsInitDifficulty(3);

      const r = this._fsrsRetrievability(Math.max(elapsedDays, 0.01), stability);
      const previousDifficulty = difficulty;
      difficulty = this._fsrsNextDifficulty(previousDifficulty, quality);
      stability = this._fsrsNextStability(previousDifficulty, stability, r, quality);

      if (quality === 1) {
        preLapseInterval = Math.max(0, Number(card.interval || 0));
        nextLapses++;
        nextStatus = 'learning';
        nextStepIndex = 0;
        nextInterval = relearningSteps[0] / 1440;
      } else {
        // interval_modifier (config) escala o intervalo do FSRS (100% = neutro)
        nextInterval = Math.max(1, this._fsrsInterval(stability, retention) * settings.intMod);
        nextInterval = Math.min(nextInterval, maxInt);
        nextStatus = nextInterval >= 21 ? 'mature' : 'review';
      }
    }

    // Sem fuzz aleatório no cliente: ele fazia a prévia e a gravação chamarem
    // cálculos diferentes, exibindo um intervalo e salvando outro. A data de
    // vencimento já é normalizada ao dia, portanto o ganho operacional do fuzz
    // não compensava a quebra de confiança na interface.

    let nextDueDate;
    if (nextInterval >= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + Math.round(nextInterval));
      d.setHours(0, 0, 0, 0);
      nextDueDate = d.toISOString();
    } else {
      nextDueDate = new Date(now + Math.round(nextInterval * 24 * 60 * 60 * 1000)).toISOString();
    }

    return {
      ...card,
      interval: nextInterval,
      status: nextStatus,
      step_index: nextStepIndex,
      ease_factor: card.ease_factor || 2.5, // mantido por compat; FSRS não usa
      stability,
      difficulty,
      pre_lapse_interval: preLapseInterval,
      reps: nextReps,
      lapses: nextLapses,
      due_date: nextDueDate,
      last_review: new Date(now).toISOString(),
    };
  }

  async predictNextState(card, quality, category) {
    if (this.isProxyMode) return this._proxy('predictNextState', [card, quality, category]);
    const settings = await this.getSRSSettings(category);
    const clone = JSON.parse(JSON.stringify(card));
    return this._calculateNextState(clone, quality, settings);
  }

  async predictNextInterval(card, quality, category) {
    const nextState = await this.predictNextState(card, quality, category);
    return nextState.interval;
  }

  async logReview(cardId, quality, category, plannedState = null, operationId = null) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('logReview', [cardId, quality, category, plannedState, operationId]);

    // A prévia continua sendo calculada no cliente para mostrar os intervalos
    // antes do clique. A gravação, porém, envia somente intenção: o servidor
    // relê o card sob lock e calcula toda a transição SRS autoritativamente.
    const clientReviewId = operationId || createOperationId();
    const saved = await this._fetch('rpc/record_card_review', {
      method: 'POST',
      body: {
        p_card_id: cardId,
        p_quality: quality,
        p_state: null,
        p_client_review_id: clientReviewId,
      },
    });
    if (!saved?.card) throw new Error('Servidor não devolveu o card revisado');
    const savedCard = saved.card;

    // prevCard permite reverter o agendamento (undo); card é o estado NOVO —
    // a fila de sessão usa pra reagendar cards em aprendizado (learning steps)
    const idempotent = Boolean(saved?.idempotent);
    return {
      ok: true,
      outcome: saved?.outcome || (idempotent ? 'duplicate' : 'accepted'),
      accepted: saved?.accepted !== false,
      eligible: saved?.eligible !== false,
      eligibilityReason: saved?.eligibility_reason || null,
      rewardReason: saved?.reward_reason || null,
      operationId: clientReviewId,
      persisted: true,
      idempotent,
      nextDue: new Date(savedCard.due_date).getTime(),
      prevCard: saved?.card_before || null,
      card: savedCard,
      reviewLogId: saved?.review_log_id || null,
      xpAwarded: idempotent ? 0 : Number(saved?.xp_awarded || 0),
    };
  }

  // Desfaz a última revisão: restaura o card ao estado anterior e apaga o
  // registro mais recente de review_log daquele card (Ctrl+Z do Anki).
  async undoReview(prevCard, reviewLogId) {
    this._invalidateReadCache('cards');
    if (this.isProxyMode) return this._proxy('undoReview', [prevCard, reviewLogId]);
    if (!prevCard || !prevCard.id || !reviewLogId) return { ok: false };

    // XP/streak e agendamento precisam voltar juntos. O cliente não pode mais
    // apagar o log diretamente, pois isso deixava XP creditado para trás.
    const res = await this._fetch('rpc/revert_card_review', {
      method: 'POST',
      body: { p_review_log_id: reviewLogId, p_previous_card: prevCard },
    });
    return {
      ok: true,
      xpReverted: Number(res?.xp_reverted || 0),
      card: res?.card || null,
    };
  }

  async getReviewLog(days = 30) {
    if (this.isProxyMode) return this._proxy('getReviewLog', [days]);
    const start = localDayBounds(addLocalDays(-(Math.max(1, days) - 1))).start;
    return (await this._fetch(`review_log?ts=gte.${encodeURIComponent(start.toISOString())}`)) || [];
  }
}
