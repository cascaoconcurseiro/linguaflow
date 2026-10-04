// content/settings-panel/expression-mark-options.js — As cinco marcas de expressão da legenda que o painel de configurações liga e desliga.

// Marcas de expressão na legenda (Issue #346); o estilo de cada tipo fica no motor.
export const EXPRESSION_MARK_OPTIONS = [
  { key: 'markPhrasal', label: 'Phrasal verbs', hint: 'Sublinhado pontilhado azul (give up, look after).' },
  { key: 'markSlang', label: 'Gírias', hint: 'Sublinhado ondulado laranja (no cap, my bad).' },
  { key: 'markReduction', label: 'Fala reduzida e contrações', hint: "Tracejado verde (gonna, 'cause, I'd = I had)." },
  { key: 'markSoundsLike', label: 'Como soa na fala', hint: 'Pontilhado roxo com a forma falada: going to ≈gonna.' },
  { key: 'markMarkers', label: 'Marcadores de conversa', hint: 'Linha dupla cinza (you know, I mean, like).' },
];
