// #544: o que o painel "estrutura, pronúncia e significado" mostra para a frase EFETIVAMENTE praticada.
// Na etapa do exemplo a frase é example_en; texto, estrutura e anotações da unidade pertencem à palavra.
// Sem grupos sintáticos (a maioria das frases hoje) cai para palavra por palavra e, por fim, para o foco da aula,
// para o painel nunca ficar vazio nem mostrar uma seção "Estrutura" sem conteúdo.

export function buildBreakdown(unit, { stage = 'word', objective = '' } = {}) {
  const inExample = stage === 'example' && Boolean(unit?.example_en);
  const groups = !inExample && Array.isArray(unit?.syntax_groups) ? unit.syntax_groups.filter(g => g && g.surface) : [];
  const words = !inExample && Array.isArray(unit?.annotations) ? unit.annotations.filter(w => w && w.surface) : [];
  const mode = groups.length ? 'structure' : words.length ? 'words' : 'none';
  return {
    inExample,
    sentence: inExample ? unit.example_en : unit?.text || '',
    translation: inExample ? unit.example_pt || '' : unit?.translation_pt || '',
    ipa: inExample ? '' : unit?.ipa || '',
    // Em etapa de exemplo, a palavra de origem aparece como contexto, não como frase principal.
    source: inExample ? { text: unit.text || '', translation: unit.translation_pt || '' } : null,
    note: unit?.explanation_note || '',
    exampleBlock: !inExample && unit?.example_en ? { text: unit.example_en, translation: unit.example_pt || '' } : null,
    mode,
    groups,
    words,
    objective: String(objective || '').trim(),
  };
}
