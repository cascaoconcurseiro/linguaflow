// Fonte única de "palavra fraca" (#338), usada pelo site e pela extensão:
// Home, sessão de reforço, fila de estudo, modo de recuperação e reencontro
// nas histórias. O leech do servidor (leech_threshold, padrão 8) é outra
// coisa: sinaliza/pausa; aqui só decidimos quem recebe reforço.
export const WEAK_LAPSES = 2;

export function isWeakCard(card) {
  return (card?.lapses || 0) >= WEAK_LAPSES || !!card?.is_leech;
}
