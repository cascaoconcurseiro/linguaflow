// readability.js — mede o nível CEFR REAL de um texto gerado (A4 do backlog).
// O selo da história mostrava o nível PEDIDO à IA, nunca verificado. Esta
// função pura consulta a cefr-wordlist (word -> banda) e devolve a banda em
// que ~92% do vocabulário reconhecido está coberto — o "nível medido".
// Nomes próprios e palavras fora da lista são ignorados (não penalizam).

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const COVERAGE_TARGET = 0.92;
const MIN_KNOWN_TOKENS = 20;

export function measureStoryLevel(text, cefrMap) {
  const tokens = String(text || '').toLowerCase().match(/[a-z']+/g) || [];
  const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  let known = 0;
  for (const token of tokens) {
    const band = cefrMap?.[token];
    if (band && counts[band] !== undefined) {
      counts[band] += 1;
      known += 1;
    }
  }
  // Texto curto demais (ou wordlist ausente): sem veredito — melhor silêncio
  // que um selo chutado.
  if (known < MIN_KNOWN_TOKENS) return { level: null, coverage: null, known, counts };

  let cumulative = 0;
  for (const band of BANDS) {
    cumulative += counts[band];
    if (cumulative / known >= COVERAGE_TARGET) {
      return { level: band, coverage: cumulative / known, known, counts };
    }
  }
  // Precisa de vocabulário além de C1 para fechar a cobertura => C2
  return { level: 'C2', coverage: 1, known, counts };
}
