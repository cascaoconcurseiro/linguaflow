// utils/lexical-profile.js — Motor de auditoria lexical e densidade de novidade (i+1).
// Implementa a métrica de Comprehensible Input de Stephen Krashen & Paul Nation:
// para consolidação e aquisição natural, a cobertura de texto deve situar-se entre
// 90% e 98% de palavras conhecidas (2% a 10% de novidade vocabular). Acima de 15%
// de novidade o texto atinge a zona de sobrecarga cognitiva e frustração.

import { lemma } from './lemma.js';

const CEFR_ORDER = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function isCefrCovered(wordLevel, userCefr) {
  if (!wordLevel || !userCefr) return false;
  const wordRank = CEFR_ORDER[String(wordLevel).toUpperCase()] || 99;
  const userRank = CEFR_ORDER[String(userCefr).toUpperCase()] || 2; // Default A2
  return wordRank <= userRank;
}

/**
 * Analisa a composição lexical de um texto frente ao repertório do estudante.
 *
 * @param {string} text - Texto em inglês a ser analisado
 * @param {Set<string>|Array<string>} [knownLemmas] - Coleção de lemas conhecidos pelo aluno
 * @param {Object} [options]
 * @param {string} [options.userCefr] - Nível do aluno (A1, A2, B1, B2, C1, C2)
 * @param {Object} [options.cefrMap] - Mapeamento palavra -> nível CEFR
 * @returns {Object} Perfil lexical com taxas, categorização e recomendações pedagógicas
 */
export function analyzeLexicalProfile(text, knownLemmas = new Set(), options = {}) {
  const tokens = String(text || '').toLowerCase().match(/[a-z']+/g) || [];
  if (tokens.length === 0) {
    return {
      totalTokens: 0,
      uniqueLemmas: 0,
      knownTokens: 0,
      newTokens: 0,
      coverageRatio: 1,
      newRatio: 0,
      isOptimalIPlusOne: false,
      densityCategory: 'easy',
      newLemmas: [],
      recommendation: 'Texto vazio ou sem palavras reconhecidas.',
    };
  }

  const knownSet = knownLemmas instanceof Set ? knownLemmas : new Set(knownLemmas || []);
  const hasKnownRepository = knownSet.size > 0;
  const userCefr = options.userCefr || null;
  const cefrMap = options.cefrMap || null;

  let knownTokens = 0;
  let newTokens = 0;
  const allLemmas = new Set();
  const newLemmasFreq = new Map();

  for (const token of tokens) {
    const lem = lemma(token) || token;
    allLemmas.add(lem);

    let isKnown = false;

    if (hasKnownRepository) {
      if (knownSet.has(lem) || knownSet.has(token)) {
        isKnown = true;
      }
    }

    if (!isKnown && userCefr && cefrMap) {
      const band = cefrMap[token] || cefrMap[lem];
      if (band && isCefrCovered(band, userCefr)) {
        isKnown = true;
      }
    }

    if (!hasKnownRepository && !userCefr && !cefrMap) {
      isKnown = true;
    }

    if (isKnown) {
      knownTokens++;
    } else {
      newTokens++;
      newLemmasFreq.set(lem, (newLemmasFreq.get(lem) || 0) + 1);
    }
  }

  const totalTokens = tokens.length;
  const coverageRatio = totalTokens > 0 ? knownTokens / totalTokens : 1;
  const newRatio = totalTokens > 0 ? newTokens / totalTokens : 0;
  const isOptimalIPlusOne = newRatio >= 0.02 && newRatio <= 0.10;

  let densityCategory = 'easy';
  let recommendation = 'Texto altamente acessível. Excelente para consolidação de velocidade e fluência de leitura.';

  if (newRatio > 0.15) {
    densityCategory = 'frustrating';
    recommendation = 'Densidade excessiva de palavras novas. Recomendamos um texto mais acessível para evitar fadiga cognitiva.';
  } else if (newRatio > 0.10) {
    densityCategory = 'challenging';
    recommendation = 'Texto moderadamente exigente. Pode requerer esforço concentrado e pausas para consulta de vocabulário.';
  } else if (newRatio >= 0.02) {
    densityCategory = 'optimal';
    recommendation = 'Texto ideal para aquisição natural (i+1). Poucas palavras novas com máximo contexto compreensível.';
  }

  const sortedNewLemmas = Array.from(newLemmasFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lem]) => lem);

  return {
    totalTokens,
    uniqueLemmas: allLemmas.size,
    knownTokens,
    newTokens,
    coverageRatio,
    newRatio,
    isOptimalIPlusOne,
    densityCategory,
    newLemmas: sortedNewLemmas,
    recommendation,
  };
}

/**
 * Formata os dados de auditoria lexical para badge visual na interface.
 *
 * @param {Object} profile - Objeto retornado por analyzeLexicalProfile
 * @returns {Object} { label, status, title }
 */
export function formatLexicalBadge(profile) {
  if (!profile || profile.totalTokens === 0) {
    return {
      label: 'Leitura rápida',
      status: 'easy',
      title: 'Texto curto ou sem vocabulário auditável.',
    };
  }

  const percent = Math.round((profile.coverageRatio || 0) * 100);

  if (profile.densityCategory === 'optimal') {
    return {
      label: `${percent}% compreensível · Ideal i+1`,
      status: 'optimal',
      title: profile.recommendation || 'Faixa ideal de compreensão compreensível (Krashen i+1).',
    };
  }

  if (profile.densityCategory === 'easy') {
    return {
      label: `${percent}% compreensível · Fluido`,
      status: 'easy',
      title: profile.recommendation || 'Vocabulário quase totalmente consolidado.',
    };
  }

  return {
    label: `${percent}% compreensível · Desafiador`,
    status: profile.densityCategory || 'challenging',
    title: profile.recommendation || 'Contém volume moderado ou alto de termos novos.',
  };
}
