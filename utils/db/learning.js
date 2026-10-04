// utils/db/learning.js — Tarefas de aprendizagem e checagem de fluência: perfis adaptativos, envio, avaliação e rascunho.
import { FLUENCY_DRAFT_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, UUID_PATTERN, classifyRequestError, createOperationId } from './shared.js';

export class LearningMethods {
  async getAdaptiveProfiles(cardIds = []) {
    if (this.isProxyMode) return this._proxy('getAdaptiveProfiles', [cardIds]);
    const ids = [...new Set(cardIds)].filter(id => UUID_PATTERN.test(id)).slice(0, 250);
    if (!ids.length) return {};
    const rows = await this._fetch(`card_adaptive_profiles?card_id=in.(${ids.join(',')})&select=card_id,recovery_stage,dominant_issue,unaided_success_streak,signal_count`);
    return Object.fromEntries((rows || []).map(row => [row.card_id, row]));
  }

  async recordAdaptiveSignal(cardId, signal, clientEventId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('recordAdaptiveSignal', [cardId, signal, clientEventId]);
    if (!UUID_PATTERN.test(cardId) || !UUID_PATTERN.test(clientEventId)) throw new Error('Identificador adaptativo inválido.');
    return await this._fetch('rpc/record_card_learning_signal', {
      method: 'POST', body: { p_card_id: cardId, p_client_event_id: clientEventId, p_signal: signal },
    });
  }

  async recordLearningTaskAttempt(attempt, clientAttemptId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('recordLearningTaskAttempt', [attempt, clientAttemptId]);
    if (!UUID_PATTERN.test(clientAttemptId)) throw new Error('Identificador da tentativa inválido.');
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
      throw new Error('Dados da tentativa inválidos.');
    }
    return await this._fetch('rpc/record_learning_task_attempt', {
      method: 'POST',
      body: {
        p_client_attempt_id: clientAttemptId,
        p_attempt: attempt,
      },
    });
  }

  async getLatestLearningTaskAttempt() {
    if (this.isProxyMode) return this._proxy('getLatestLearningTaskAttempt', []);
    const select = [
      'id',
      'client_attempt_id',
      'task_key',
      'task_type',
      'skill',
      'target_level',
      'evaluation_authority',
      'authoritative',
      'overall_score',
      'occurred_at',
    ].join(',');
    const rows = await this._fetch(
      `learning_task_attempts?select=${select}&order=occurred_at.desc,id.desc&limit=1`,
    );
    return rows?.[0] || null;
  }

  async issueFluencyTask(skill, targetLevel, clientIssueId = createOperationId()) {
    if (this.isProxyMode) return this._proxy('issueFluencyTask', [skill, targetLevel, clientIssueId]);
    if (!UUID_PATTERN.test(clientIssueId)) throw new Error('Identificador de emissão inválido.');
    return await this._fetch('rpc/issue_fluency_task', {
      method: 'POST',
      body: {
        p_client_issue_id: clientIssueId,
        p_skill: skill,
        p_target_level: targetLevel,
      },
    });
  }

  async getFluencyListeningText(issueId) {
    if (this.isProxyMode) return this._proxy('getFluencyListeningText', [issueId]);
    if (!UUID_PATTERN.test(issueId)) throw new Error('Tarefa inválida.');
    return this._fetch('rpc/get_fluency_listening_text', { method:'POST', body:{p_issue_id:issueId} });
  }

  async submitFluencyTask(
    issueId,
    response,
    assistanceUsed = {},
    responseTimeMs = null,
    clientSubmissionId = createOperationId(),
  ) {
    if (this.isProxyMode) {
      return this._proxy('submitFluencyTask', [
        issueId, response, assistanceUsed, responseTimeMs, clientSubmissionId,
      ]);
    }
    if (!UUID_PATTERN.test(issueId) || !UUID_PATTERN.test(clientSubmissionId)) {
      throw new Error('Identificador de submissão inválido.');
    }
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Resposta de fluência inválida.');
    }
    return await this._fetch('rpc/submit_fluency_task', {
      method: 'POST',
      body: {
        p_issue_id: issueId,
        p_client_submission_id: clientSubmissionId,
        p_response: response,
        p_assistance_used: assistanceUsed || {},
        p_response_time_ms: responseTimeMs,
      },
    });
  }

  async assessFluencySubmission(submissionId) {
    if (this.isProxyMode) {
      return this._proxy('assessFluencySubmission', [submissionId]);
    }
    if (!UUID_PATTERN.test(submissionId)) throw new Error('Identificador de avaliação inválido.');
    const token = await this._getToken();
    if (!token) throw classifyRequestError(new Error('Sessão expirada. Entre novamente para continuar.'), 401);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/fluency-assessment`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submission_id: submissionId }),
        signal: controller.signal,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw classifyRequestError(
          new Error(body?.error || `Falha ao avaliar fluência (${response.status}).`),
          response.status,
          body,
        );
      }
      return body;
    } catch (error) {
      if (!error.kind) classifyRequestError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getFluencyProfiles() {
    if (this.isProxyMode) return this._proxy('getFluencyProfiles', []);
    const select = [
      'skill',
      'observed_level',
      'evidence_status',
      'authoritative_attempt_count',
      'last_assessed_at',
      'updated_at',
    ].join(',');
    return (await this._fetch(`fluency_skill_profiles?select=${select}&order=skill.asc`)) || [];
  }

  async _draftStorage(operation, key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve, reject) => {
        const execute = (isRetry = false) => {
          if (operation === 'set') {
            chrome.storage.local.set({ [key]: value }, () => {
              if (chrome.runtime?.lastError) {
                const message = chrome.runtime.lastError.message || '';
                if (!isRetry && /quota|kQuotaBytes|exceeded/i.test(message)) {
                  this._evictDisposableStorage()
                    .then(() => execute(true))
                    .catch(() => reject(new Error(message)));
                  return;
                }
                reject(new Error(message));
              } else {
                resolve(null);
              }
            });
            return;
          }

          const callback = result => {
            if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(operation === 'get' ? result?.[key] || null : null);
          };
          chrome.storage.local[operation](key, callback);
        };

        execute(false);
      });
    }
    if (operation === 'remove') globalThis.localStorage?.removeItem(key);
    if (operation === 'set') {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
      } catch (err) {
        if (/quota|exceeded/i.test(err?.name || err?.message || '')) {
          try {
            const keysToRemove = [];
            for (let i = 0; i < (globalThis.localStorage?.length || 0); i++) {
              const k = globalThis.localStorage.key(i);
              if (k && (k.startsWith('lf_tr:') || k.startsWith('lf_lex:') || /^[a-z]{2,5}:[a-z]{2,5}:/.test(k))) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach(k => globalThis.localStorage.removeItem(k));
            globalThis.localStorage?.setItem(key, JSON.stringify(value));
            return;
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }
    if (operation === 'get') {
      try { return JSON.parse(globalThis.localStorage?.getItem(key) || 'null'); } catch { return null; }
    }
    return null;
  }

  async _evictDisposableStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime?.lastError || !items) return resolve();
        const disposable = Object.keys(items).filter(k =>
          k.startsWith('linguee_') ||
          k.startsWith('reverso_') ||
          k.startsWith('lf_tr:') ||
          k.startsWith('lf_lex:') ||
          /^[a-z]{2,5}:[a-z]{2,5}:/.test(k) ||
          k === 'lastYoutubeSubtitleUrls'
        );
        if (disposable.length === 0) return resolve();
        chrome.storage.local.remove(disposable, () => resolve());
      });
    });
  }

  async getFluencyCheckDraft() {
    await this._draftStorage('remove', FLUENCY_DRAFT_KEY); // Unowned legacy answers cannot be migrated safely.
    const userId = await this.getCurrentUserId();
    if (!userId) return null;
    const value = await this._draftStorage('get', `${FLUENCY_DRAFT_KEY}:${userId}`);
    if (await this.getCurrentUserId() !== userId) return null;
    return value?.ownerId === userId ? value : null;
  }

  async saveFluencyCheckDraft(draft, expectedUserId = null) {
    const generation = this._authGeneration || 0;
    const userId = await this.getCurrentUserId();
    if (!userId || (expectedUserId && userId !== expectedUserId)) throw new Error('A conta mudou. Reabra o check.');
    const value = { ...draft, ownerId: userId, savedAt: new Date().toISOString() };
    const key = `${FLUENCY_DRAFT_KEY}:${userId}`;
    if (generation !== (this._authGeneration || 0)) throw new Error('Sessão encerrada.');
    await this._draftStorage('set', key, value);
    if (generation !== (this._authGeneration || 0) || await this.getCurrentUserId() !== userId) {
      await this._draftStorage('remove', key);
      throw new Error('A conta mudou. Reabra o check.');
    }
    return value;
  }

  async clearFluencyCheckDraft() {
    const userId = await this.getCurrentUserId();
    await this._draftStorage('remove', FLUENCY_DRAFT_KEY);
    if (userId) await this._draftStorage('remove', `${FLUENCY_DRAFT_KEY}:${userId}`);
  }

  async getFluencyCheckStatus() {
    const [latestAttempt, profiles, draft] = await Promise.all([
      this.getLatestLearningTaskAttempt(),
      this.getFluencyProfiles(),
      this.getFluencyCheckDraft(),
    ]);
    const lastAt = latestAttempt?.occurred_at ? new Date(latestAttempt.occurred_at) : null;
    const due = !lastAt || !Number.isFinite(lastAt.getTime())
      || Date.now() - lastAt.getTime() >= 7 * 24 * 60 * 60 * 1000;
    return {
      fluencyDue: due,
      fluencyResumeAvailable: !!draft && draft.completed !== true,
      latestAttempt,
      profiles,
      draft,
    };
  }

  async submitFluencyCheck(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Nenhuma resposta de fluência para enviar.');
    }
    const results = [];
    for (const record of records) {
      const submission = await this.submitFluencyTask(
        record.issueId,
        record.response,
        record.assistanceUsed,
        record.responseTimeMs,
        record.clientSubmissionId,
      );
      const assessment = await this.assessFluencySubmission(submission.id);
      results.push({ submission, assessment });
    }
    await this.clearFluencyCheckDraft();
    return results;
  }
}
