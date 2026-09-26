// readability.js — mede o nível CEFR REAL de um texto gerado (A4 do backlog).
// Consulta a cefr-wordlist com lematização resiliente e ignora nomes próprios.
// Devolve a banda em que o vocabulário reconhecido está coberto de forma pedagogicamente
// realista (norma Krashen i+1 / graded readers).

import { lemma } from '../../../utils/lemma.js';

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const CEFR_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const MIN_KNOWN_TOKENS = 20;

// Nomes de personagens e localidades recorrentes gerados no LinguaFlow
const PROPER_NAMES = new Set([
  'maya', 'leo', 'priya', 'daniel', 'sofia', 'ethan', 'amara', 'lucas',
  'nina', 'omar', 'clara', 'felix', 'grace', 'mateo', 'elena', 'chicago',
  'madrid', 'paris', 'london', 'tokyo', 'rome', 'berlin', 'brasilia'
]);

function minBand(b1, b2) {
  if (!b1) return b2;
  if (!b2) return b1;
  return (CEFR_ORDER[b1] || 99) <= (CEFR_ORDER[b2] || 99) ? b1 : b2;
}

export function measureStoryLevel(text, cefrMap) {
  const rawTokens = String(text || '').match(/[A-Za-z']+/g) || [];
  const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let known = 0;

  for (let i = 0; i < rawTokens.length; i++) {
    const raw = rawTokens[i];
    const lower = raw.toLowerCase().replace(/^'+|'+$/g, '');
    if (!lower) continue;

    // Nomes próprios não penalizam o nível pedagógico do aluno
    if (PROPER_NAMES.has(lower)) continue;
    const isSentenceStart = (i === 0) || /[.!?]['"]*$/.test(rawTokens[i - 1]);
    if (!isSentenceStart && /^[A-Z]/.test(raw)) continue;

    // Lematização e formas base
    const lem = typeof lemma === 'function' ? lemma(lower) : lower;
    let band = minBand(cefrMap?.[lower], cefrMap?.[lem]);

    // Heurísticas adicionais para desinências regulares inglesas (-ed, -ing, -s)
    if (!band && lower.endsWith('ed')) {
      band = cefrMap?.[lower.slice(0, -2)] || cefrMap?.[lower.slice(0, -1)];
    }
    if (!band && lower.endsWith('ing')) {
      band = cefrMap?.[lower.slice(0, -3)] || cefrMap?.[lower.slice(0, -3) + 'e'];
    }
    if (!band && lower.endsWith('s') && !lower.endsWith('ss')) {
      band = cefrMap?.[lower.slice(0, -1)];
    }

    if (band && counts[band] !== undefined) {
      counts[band] += 1;
      known += 1;
    }
  }

  // Texto curto demais (ou wordlist ausente): sem veredito — melhor silêncio
  // que um selo chutado.
  if (known < MIN_KNOWN_TOKENS) return { level: null, coverage: null, known, counts };

  let cumulative = 0;
  // Calibragem pedagógica CEFR: 80% de cobertura caracteriza a banda de leitura confortável (Krashen i+1 / Graded Readers)
  const COVERAGE_THRESHOLD = 0.80;
  for (const band of BANDS) {
    cumulative += counts[band];
    if (cumulative / known >= COVERAGE_THRESHOLD) {
      return { level: band, coverage: cumulative / known, known, counts };
    }
  }

  return { level: 'C2', coverage: 1, known, counts };
}

