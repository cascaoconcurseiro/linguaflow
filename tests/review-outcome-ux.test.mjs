import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [db, overlay, study, app, worker] = await Promise.all([
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/review-overlay.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8'),
]);

assert.match(db, /export function createOperationId/);
assert.match(db, /logReview\(cardId, quality, category, plannedState = null, operationId = null\)/);
assert.match(db, /operationId \|\| createOperationId\(\)/);
assert.match(db, /outcome:\s*saved\?\.outcome/,
  'Database adapter must preserve the authoritative RPC outcome');
assert.match(db, /eligibilityReason:\s*saved\?\.eligibility_reason/);
assert.match(db, /rewardReason:\s*saved\?\.reward_reason/);
assert.match(db, /persisted: true/);
assert.match(db, /xpAwarded: idempotent \? 0/);
assert.match(db, /response\.errorKind/);
assert.match(worker, /errorRetryable: Boolean\(error\?\.retryable\)/);
assert.match(db, /async getStudyCards\(\{[\s\S]*?newLimit[\s\S]*?reviewLimit[\s\S]*?topic/s,
  'o adaptador deve expor uma fila de estudo com cotas independentes');
const studyQueueMethod = db.slice(db.indexOf('async getStudyCards'), db.indexOf('\n  // Contadores do dia', db.indexOf('async getStudyCards')));
assert.match(studyQueueMethod, /query\('eq\.learning', 1000\)[\s\S]*query\('in\.\(review,mature\)', safeReviewLimit\)[\s\S]*query\('eq\.new', safeNewLimit\)/,
  'learning, review e new devem ser consultados separadamente para um estado não esconder outro');
assert.match(studyQueueMethod, /Math\.min\(1000,[\s\S]*reviewLimit/,
  'a consulta deve suportar a configuração máxima de 1000 reviews');
assert.match(studyQueueMethod, /words!inner[\s\S]*words\.category=eq\./,
  'o filtro de tópico deve ser aplicado no banco antes dos limites');

assert.match(overlay, /if \(this\._answerBusy \|\| !this\._currentCard\) return/);
assert.match(overlay, /operation\.operationId/);
assert.match(overlay, /if \(!result\?\.persisted\) throw/);
assert.match(overlay, /result\?\.outcome === 'ineligible'/,
  'Quick review must branch before treating an ineligible result as success');
assert.match(overlay, /stale_card_state[\s\S]+await this\._loadCards\(\)/,
  'Quick review refetches authoritative cards after stale state');
assert.match(overlay, /\['not_due', 'new_daily_limit', 'review_daily_limit', 'suspended'\][\s\S]+this\.cards\.splice/,
  'Quick review reconciles authoritatively ineligible cards without grading them');
assert.match(overlay, /A avaliação não foi salva; este card continua aqui/);
assert.match(overlay, /aria-live="polite"/);
assert.match(overlay, /review_daily_limit/);
assert.match(study, /review_daily_limit/);
assert.match(study, /!res\?\.prevCard\?\.is_leech && res\?\.card\?\.is_leech/,
  'a transição para leech deve ser anunciada somente uma vez');
assert.match(study, /ficou difícil recorrente e foi pausado[\s\S]*reativá-lo no Cofre/,
  'leech suspenso deve explicar como recuperar o card');
const answerBody = overlay.slice(overlay.indexOf('async _answer'), overlay.indexOf('\n  destroy()', overlay.indexOf('async _answer')));
const loadCardsBody = overlay.slice(overlay.indexOf('async _loadCards()'), overlay.indexOf('\n  show()', overlay.indexOf('async _loadCards()')));
assert.match(loadCardsBody, /Promise\.all\(\[\s*this\._db\.getTodayCounts\(\),\s*this\._db\.getSRSSettings\(\)/,
  'revisão rápida deve carregar fila e limites configurados juntos');
assert.match(loadCardsBody, /this\._db\.getStudyCards\(\{[\s\S]*newLimit: newAllowed[\s\S]*reviewLimit: revAllowed/,
  'revisão rápida deve buscar cada estado com sua cota restante');
assert.match(loadCardsBody, /newAllowed[\s\S]*revAllowed[\s\S]*getStudyCards[\s\S]*slice\(0, 10\)/,
  'revisão rápida deve respeitar limites de novas e revisões antes de cortar a sessão');
assert.match(loadCardsBody, /settings\?\.newPerDay[\s\S]*todayCounts\?\.newIntroducedToday/,
  'revisão rápida deve usar os nomes reais do limite e do contador de cards novos');
assert.match(loadCardsBody, /settings\?\.maxRevPerDay[\s\S]*todayCounts\?\.reviewsToday/,
  'revisão rápida deve usar os nomes reais do limite e do contador de revisões');
assert.match(loadCardsBody, /getStudyCards\(\{ newLimit: newAllowed, reviewLimit: revAllowed \}\)/,
  'a classificação por estado deve acontecer no adaptador sem truncamento compartilhado');
assert.doesNotMatch(loadCardsBody, /newCardsPerDay|reviewsPerDay|newCount|reviewCount|lastReviewed|repetition/,
  'aliases inexistentes não podem liberar ou bloquear cards incorretamente');
assert.ok(answerBody.indexOf('this.index++') > answerBody.indexOf('await this._db.logReview'));
assert.ok(answerBody.indexOf('this.index++') < answerBody.indexOf('} catch (e)'));

assert.match(study, /pendingReviewOperations/);
assert.match(study, /res\?\.outcome === 'ineligible'/,
  'Study must reconcile an ineligible result before the success path');
const ineligibleBody = study.slice(
  study.indexOf("if (res?.outcome === 'ineligible')"),
  study.indexOf('if (liveStatus) liveStatus.textContent = res.idempotent', study.indexOf("if (res?.outcome === 'ineligible')")),
);
assert.match(ineligibleBody, /app\.navigate\('study'\)/,
  'stale scheduler state forces an authoritative queue refetch');
assert.match(ineligibleBody, /\['not_due', 'new_daily_limit', 'review_daily_limit', 'suspended'\][\s\S]+dueQueue/,
  'not-due, capped-new, and suspended cards leave only the current due queue');
assert.doesNotMatch(ineligibleBody, /sessionCards\+\+|sessionXp|showXPAnimation|playFeedbackSound/,
  'ineligible reconciliation never counts a session answer, XP, or feedback success');
assert.match(study, /operation\.operationId/);
assert.match(study, /pendingReviewOperations\.delete\(gradedCard\.id\)/);
assert.match(study, /catch \(e\) \{[\s\S]*lastReview = \{ prevCard, card, reviewLogId, isCorrect \};[\s\S]*updateUndoButton\(\)/,
  'falha ao desfazer deve restaurar a ação para nova tentativa');
const buryBody = study.slice(study.indexOf('async function buryCard(app)'), study.indexOf('\nfunction injectStyles()', study.indexOf('async function buryCard(app)')));
assert.match(buryBody, /lastReview = null;[\s\S]*updateUndoButton\(\)/,
  'adiar um card não pode deixar Desfazer apontando para uma revisão anterior');
assert.match(study, /A avaliação não foi salva; este card continua aqui/);
assert.match(study, /lfDb\.getStudyCards\(\{[\s\S]*newLimit: newAllowed[\s\S]*reviewLimit: revAllowed[\s\S]*topic: topicFilter/,
  'a tela principal deve aplicar cotas e tópico na consulta autoritativa');
assert.match(app, /toast\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
assert.match(app, /toast\.setAttribute\('aria-live'/);

console.log('Review outcome UX contracts passed.');
