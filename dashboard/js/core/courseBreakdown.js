// #544/#551: o que o painel "Mostrar resposta" exibe para a frase EFETIVAMENTE praticada.
// Na etapa do exemplo a frase é example_en e suas palavras vêm de example_annotations; texto, estrutura e anotações
// da unidade pertencem à palavra. TODA frase mostra "palavra por palavra" (uma linha por palavra, na ordem da frase),
// com a estrutura sintática a mais quando existir; palavra sem anotação aparece mesmo assim, sem tradução.

const edge = /^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g;
const surfaceOf = token => token.replace(edge, '');

// Alinha as palavras da frase às anotações: por posição quando os tamanhos batem, senão pela forma da palavra.
export function alignWords(sentence, annotations) {
  const tokens = String(sentence || '').split(/\s+/).map(surfaceOf).filter(Boolean);
  const list = Array.isArray(annotations) ? annotations.filter(a => a && a.surface) : [];
  const byForm = new Map();
  for (const a of list) if (!byForm.has(a.surface.toLowerCase())) byForm.set(a.surface.toLowerCase(), a);
  const aligned = list.length === tokens.length && tokens.every((t, i) => list[i].surface.toLowerCase() === t.toLowerCase());
  return tokens.map((token, i) => {
    const found = aligned ? list[i] : byForm.get(token.toLowerCase());
    return found ? { surface: token, pos: found.pos || '', ipa: found.ipa || '', gloss: found.gloss || '' } : { surface: token, pos: '', ipa: '', gloss: '' };
  });
}

export function buildBreakdown(unit, { stage = 'word', objective = '' } = {}) {
  const inExample = stage === 'example' && Boolean(unit?.example_en);
  const sentence = inExample ? unit.example_en : unit?.text || '';
  const groups = !inExample && Array.isArray(unit?.syntax_groups) ? unit.syntax_groups.filter(g => g && g.surface) : [];
  const words = alignWords(sentence, inExample ? unit?.example_annotations : unit?.annotations);
  return {
    inExample,
    sentence,
    translation: inExample ? unit.example_pt || '' : unit?.translation_pt || '',
    ipa: inExample ? '' : unit?.ipa || '',
    // Em etapa de exemplo, a palavra de origem aparece como contexto, não como frase principal.
    source: inExample ? { text: unit.text || '', translation: unit.translation_pt || '' } : null,
    note: unit?.explanation_note || '',
    exampleBlock: !inExample && unit?.example_en ? { text: unit.example_en, translation: unit.example_pt || '' } : null,
    mode: groups.length ? 'structure' : 'words',
    groups,
    words,
    objective: String(objective || '').trim(),
  };
}
