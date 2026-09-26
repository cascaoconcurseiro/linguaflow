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

// Um passo de aprendizagem que acabou de vencer é sensível ao tempo. Ele não
// deve voltar ao fim da sessão atrás de conteúdo novo ou de revisões comuns.
// Mantém a ordem recebida e não muta a fila, para poder ser testado sem DOM.
export function prioritizeDueLearning(queue, dueLearning) {
  return [...dueLearning, ...queue];
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

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Balanceador de backlog pós-inatividade (Anti-Burnout / Diluição da muralha de cards).
// Garante que cards em 'learning' nunca sejam adiados, enquanto limita o volume
// de revisões acumuladas a uma fatia pedagógica diária realizável.
export function balanceBacklogQueue(cards = [], opts = {}) {
  const maxDailyBacklog = Number(opts.maxDailyBacklog) || 30;
  const learningCards = [];
  const otherCards = [];

  for (const c of cards) {
    if (c?.status === 'learning') learningCards.push(c);
    else otherCards.push(c);
  }

  if (otherCards.length <= maxDailyBacklog || maxDailyBacklog <= 0) {
    return { activeQueue: [...cards], postponedCount: 0, paced: false, postponedCards: [] };
  }

  // Ordena por urgência: mais lapsos primeiro, depois menor estabilidade FSRS
  const sorted = [...otherCards].sort((a, b) => {
    const lapsesDiff = (b?.lapses || 0) - (a?.lapses || 0);
    if (lapsesDiff !== 0) return lapsesDiff;
    const stabA = a?.stability != null ? Number(a.stability) : 1;
    const stabB = b?.stability != null ? Number(b.stability) : 1;
    return stabA - stabB;
  });

  const selected = sorted.slice(0, maxDailyBacklog);
  const postponed = sorted.slice(maxDailyBacklog);

  return {
    activeQueue: [...learningCards, ...selected],
    postponedCount: postponed.length,
    paced: true,
    postponedCards: postponed,
  };
}

// opts.priorityCategory (Onda 1.3): a categoria mais fraca do diagnóstico. Os
// cards de revisão dessa categoria são estudados PRIMEIRO (memória fresca),
// sem quebrar o interleaving de novas/fracas. opts.getCategory permite testar.
// opts.newOrder ('sequential' | 'random') e opts.reviewOrder ('due' | 'random') (paridade Anki).
// opts.backlogPacing ({ maxDailyBacklog, daysInactive }) aplica diluição contra burnout.
export function buildSessionQueue(cards, opts = {}) {
  const {
    priorityCategory = null,
    getCategory = defaultGetCategory,
    newOrder = 'sequential',
    reviewOrder = 'due',
    backlogPacing = null,
  } = opts;

  let inputCards = cards;
  if (backlogPacing && typeof backlogPacing === 'object') {
    const pacingResult = balanceBacklogQueue(cards, backlogPacing);
    if (pacingResult.paced) {
      inputCards = pacingResult.activeQueue;
    }
  }

  const learning = [];
  const weak = [];
  const reviews = [];
  const news = [];

  for (const c of inputCards) {
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

  if (reviewOrder === 'random') {
    reviewsOrdered = shuffleArray(reviewsOrdered);
  }

  const newsOrdered = newOrder === 'random' ? shuffleArray(news) : news;

  // reviews mantêm a ordem; novas e fracas entram espaçadas
  const withNews = spreadInto(reviewsOrdered, newsOrdered);
  const interleaved = spreadInto(withNews, weak);
  return [...learning, ...interleaved];
}

