/**
 * utils/schema.js
 * Utilitários defensivos para sanitização e validação de schemas em bordas:
 * - Respostas de LLMs (JSON truncado, markdown fences, chaves ausentes)
 * - Payloads de extensões / mensagens assíncronas
 * - Objetos recuperados de localStorage / cache
 */

import { safeParseJson } from '../dashboard/js/core/ai.js';

/**
 * Sanitiza e garante tipos primitivos com defaults seguros.
 */
export function sanitizeString(val, fallback = '') {
  if (typeof val === 'string') return val.trim();
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

export function sanitizeNumber(val, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

export function sanitizeBoolean(val, fallback = false) {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === 1 || val === '1') return true;
  if (val === 'false' || val === 0 || val === '0') return false;
  return fallback;
}

export function sanitizeArray(val, itemSanitizer = null) {
  if (!Array.isArray(val)) return [];
  if (typeof itemSanitizer === 'function') {
    return val
      .map(itemSanitizer)
      .filter(item => item !== null && item !== undefined && item !== '');
  }
  return val;
}

/**
 * Validador e normalizador do retorno de enriquecimento de cards pela IA.
 */
export function sanitizeCardEnrichment(raw) {
  const data = typeof raw === 'string' ? safeParseJson(raw) : raw;
  if (!data || typeof data !== 'object') {
    return {
      sentence_pt: '',
      word_pt: '',
      sentence_phon: '',
      word_phon: '',
      isValid: false,
    };
  }

  const sentence_pt = sanitizeString(data.sentence_pt || data.portuguese_sentence || data.translation);
  const word_pt = sanitizeString(data.word_pt || data.portuguese_word || data.word_translation);
  const sentence_phon = sanitizeString(data.sentence_phon || data.phonetic_sentence);
  const word_phon = sanitizeString(data.word_phon || data.phonetic_word);

  return {
    sentence_pt,
    word_pt,
    sentence_phon,
    word_phon,
    isValid: Boolean(sentence_pt || word_pt),
  };
}

/**
 * Validador e normalizador para questionários/quizzes de histórias.
 */
export function sanitizeStoryQuiz(raw) {
  const data = typeof raw === 'string' ? safeParseJson(raw) : raw;
  const list = Array.isArray(data) ? data : (data?.questions || data?.quiz || []);

  if (!Array.isArray(list)) return [];

  return list.map((q, idx) => {
    if (!q || typeof q !== 'object') return null;
    const question = sanitizeString(q.question || q.pergunta);
    const options = sanitizeArray(q.options || q.opcoes, (opt) => sanitizeString(opt));
    const answer = sanitizeNumber(q.answer !== undefined ? q.answer : q.resposta_correta, 0, { min: 0, max: Math.max(0, options.length - 1) });
    const explanation = sanitizeString(q.explanation || q.explicacao);

    if (!question || options.length < 2) return null;

    return {
      id: sanitizeString(q.id || `q_${idx + 1}`),
      question,
      options,
      answer,
      explanation,
    };
  }).filter(Boolean);
}

/**
 * Validador para feedback de pronúncia/escrita da IA.
 */
export function sanitizeEvaluationFeedback(raw) {
  const data = typeof raw === 'string' ? safeParseJson(raw) : raw;
  if (!data || typeof data !== 'object') {
    return {
      score: 0,
      accuracy: 0,
      feedback: 'Não foi possível avaliar a resposta no momento.',
      mistakes: [],
      isValid: false,
    };
  }

  const score = sanitizeNumber(data.score ?? data.nota, 0, { min: 0, max: 100 });
  const accuracy = sanitizeNumber(data.accuracy ?? score, 0, { min: 0, max: 100 });
  const feedback = sanitizeString(data.feedback || data.comentario || data.mensagem);
  const mistakes = sanitizeArray(data.mistakes || data.erros, (m) => sanitizeString(m));

  return {
    score,
    accuracy,
    feedback,
    mistakes,
    isValid: true,
  };
}
