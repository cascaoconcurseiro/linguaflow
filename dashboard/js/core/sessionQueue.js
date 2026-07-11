// sessionQueue.js — Interleaving inteligente da sessão (Marco 2 do motor
// pedagógico). Decisão do Eng. SRS + Linguista:
//
// 1. LEARNING primeiro — são sensíveis a tempo (steps em minutos).
// 2. Palavras FRACAS (3+ lapsos ou leech) NÃO se amontoam: entram espaçadas
//    entre as revisões normais (espaçamento dentro da própria sessão reduz
//    a interferência entre itens difíceis — efeito de interleaving da SLA).
// 3. Cards NOVOS se espalham entre as revisões (não em bloco no fim): cada
//    novo chega com a memória "aquecida", e a sessão não termina num paredão
//    de desconhecidos.
//
// Função PURA (sem DOM, sem rede) — testada em tests/engine.test.mjs.

export function isWeakCard(card) {
  return (card?.lapses || 0) >= 3 || !!card?.is_leech;
}

// Espalha `items` uniformemente dentro de `base`, preservando a ordem relativa
function spreadInto(base, items) {
  if (!items.length) return [...base];
  if (!base.length) return [...items];
  const out = [...base];
  const step = (base.length + items.length) / (items.length + 1);
  items.forEach((item, i) => {
    const pos = Math.min(out.length, Math.round((i + 1) * step));
    out.splice(pos, 0, item);
  });
  return out;
}

function defaultGetCategory(card) {
  return (card && (card.wordData?.category || card.category)) || null;
}

// opts.priorityCategory (Onda 1.3): a categoria mais fraca do diagnóstico. Os
// cards de revisão dessa categoria são estudados PRIMEIRO (memória fresca),
// sem quebrar o interleaving de novas/fracas. opts.getCategory permite testar.
export function buildSessionQueue(cards, opts = {}) {
  const { priorityCategory = null, getCategory = defaultGetCategory } = opts;
  const learning = [];
  const weak = [];
  const reviews = [];
  const news = [];

  for (const c of cards) {
    if (c.status === 'learning') learning.push(c);
    else if (isWeakCard(c)) weak.push(c);
    else if (c.status === 'new') news.push(c);
    else reviews.push(c);
  }

  // Categoria fraca à frente das revisões (ordenação estável preserva o resto)
  let reviewsOrdered = reviews;
  if (priorityCategory) {
    reviewsOrdered = [
      ...reviews.filter(c => getCategory(c) === priorityCategory),
      ...reviews.filter(c => getCategory(c) !== priorityCategory),
    ];
  }

  // reviews mantêm a ordem; novas e fracas entram espaçadas
  const withNews = spreadInto(reviewsOrdered, news);
  const interleaved = spreadInto(withNews, weak);
  return [...learning, ...interleaved];
}
