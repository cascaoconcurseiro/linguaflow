// content/subtitles/expression-marks.js — Marcas de expressão na legenda (phrasal, gíria, fala reduzida, contração, "soa como", marcador): tipos, CSS de cada traço, chaves de configuração e rótulos.

// Cada tipo tem um traço diferente (não só cor): pontilhado (phrasal),
// ondulado (gíria), tracejado (fala reduzida/contração), duplo (marcador) e,
// no "soa como", a forma falada em miniatura depois do trecho. A classe
// lf-hide-<tipo> no contêiner desliga a marca sem tirar o clique.
export const EXPRESSION_KINDS = ['phrasal', 'slang', 'reduction', 'contraction', 'sounds_like', 'marker'];

export function expressionKindCss(scope) {
  const sel = (kind) => `${scope}.lf-expression[data-kind="${kind}"]`;
  return `
    ${sel('slang')} { border-bottom: none; text-decoration: underline wavy rgba(251, 146, 60, 0.9); text-underline-offset: 4px; text-decoration-thickness: 1.5px; }
    ${sel('reduction')}, ${sel('contraction')} { border-bottom: 2px dashed rgba(52, 211, 153, 0.85); }
    ${sel('sounds_like')} { border-bottom: 2px dotted rgba(192, 132, 252, 0.85); }
    ${sel('sounds_like')}::after { content: "≈" attr(data-hint); font-size: 0.55em; font-weight: 700; margin-left: 3px; opacity: 0.85; vertical-align: super; color: #d8b4fe; }
    ${sel('marker')} { border-bottom: 3px double rgba(148, 163, 184, 0.85); }
    ${EXPRESSION_KINDS.map((kind) => `${scope.trim() ? scope.replace(/ $/, '') : ''}.lf-hide-${kind} .lf-expression[data-kind="${kind}"]`).join(', ')} { border-bottom: none; text-decoration: none; }
    ${scope.trim() ? scope.replace(/ $/, '') : ''}.lf-hide-sounds_like .lf-expression[data-kind="sounds_like"]::after { content: none; }
  `;
}

export const DEFAULT_EXPRESSION_MARKS = { phrasal: true, slang: true, reduction: true, sounds_like: true, marker: false };
// Chave de configuração de cada marca (contração segue a de fala reduzida).
export const EXPRESSION_MARK_SETTINGS = {
  phrasal: 'markPhrasal',
  slang: 'markSlang',
  reduction: 'markReduction',
  sounds_like: 'markSoundsLike',
  marker: 'markMarkers',
};

export const EXPRESSION_KIND_LABELS = {
  phrasal: 'Phrasal verb',
  slang: 'Gíria',
  reduction: 'Fala reduzida',
  contraction: 'Contração',
  sounds_like: 'Na fala',
  marker: 'Marcador de conversa',
};

export const WORD_STATUS_LABELS = { known: 'conhecida', mature: 'dominada', review: 'revisando', learning: 'aprendendo', new: 'salva' };
