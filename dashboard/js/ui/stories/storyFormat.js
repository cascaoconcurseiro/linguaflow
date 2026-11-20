// dashboard/js/ui/stories/storyFormat.js — Texto das histórias: lista de falsos cognatos e conversão do texto em parágrafos no formato de livro. Funções puras.

export const FALSE_FRIENDS = {
  actually: '"actually" = na verdade / de fato (NÃO "atualmente" → use "currently" ou "nowadays")',
  pretend: '"pretend" = fingir / simular (NÃO "pretender" → use "intend" ou "plan to")',
  eventually: '"eventually" = no fim das contas / com o tempo (NÃO "eventualmente" = às vezes → use "occasionally")',
  library: '"library" = biblioteca (NÃO "livraria" → use "bookstore")',
  college: '"college" = faculdade / universidade (NÃO "colégio" = high school)',
  fabric: '"fabric" = tecido / pano (NÃO "fábrica" → use "factory")',
  parents: '"parents" = pais (pai e mãe) (NÃO "parentes" = relatives)',
  push: '"push" = empurrar (NÃO "puxar" = pull)',
  exit: '"exit" = saída (NÃO "êxito" = success)',
  novel: '"novel" = romance (livro) (NÃO "novela" = soap opera)',
  sensible: '"sensible" = sensato / prudente (NÃO "sensível" = sensitive)',
  polite: '"polite" = educado / cortês (NÃO "político" = politician)',
  large: '"large" = grande (NÃO "largo" = wide)',
  assist: '"assist" = ajudar / auxiliar (NÃO "assistir" a um filme → "watch")',
  contest: '"contest" = competição / concurso (NÃO "contestar" = dispute/challenge)',
  editor: '"editor" = revisor / redator (NÃO "editor" de livros = publisher)',
  exquisite: '"exquisite" = refinado / primoroso (NÃO "esquisito" = weird/strange)',
  genial: '"genial" = simpático / cordial (NÃO "genial" = brilliant → "genius")',
  legend: '"legend" = lenda (NÃO "legenda" de vídeo = subtitle/caption)',
  realize: '"realize" = perceber / tomar consciência (NÃO "realizar" uma tarefa = carry out)',
  resume: '"resume" = retomar (NÃO "resumo" = summary)',
  sympathetic: '"sympathetic" = solidário / compreensivo (NÃO "simpático" = nice/friendly)',
};

export function formatStoryAsBook(text) {
  if (!text) return [];
  let normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

  // Se o texto veio com quebras simples (\n) sem quebra dupla (\n\n), expande para parágrafos
  if (!/\n\s*\n/.test(normalized) && /\n/.test(normalized)) {
    normalized = normalized.replace(/\n+/g, '\n\n');
  }

  const initialBlocks = normalized.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const formattedBlocks = [];

  for (const block of initialBlocks) {
    // Se o bloco for curto e não contiver turnos múltiplos de aspas, preserva
    if (block.length < 180 && !/(["”]).*?(["“])/.test(block)) {
      formattedBlocks.push(block);
      continue;
    }

    // Segmentação literária em turnos de diálogo e narrativa de livro:
    // 1. Narrativa anterior terminando em pontuação, seguida do início de fala direta
    let s = block.replace(/([.!?])\s+(["“])/g, '$1\n\n$2');

    // 2. Fim de fala/speech tag seguido do início de outra fala direta
    s = s.replace(/([.!?]["”])\s+(["“])/g, '$1\n\n$2');

    // 3. Fala com speech tag seguida de ação de outro personagem / mudança de cena
    s = s.replace(/([.!?]["”]\s*(?:[A-Z][a-z]+|he|she|they)\s+(?:says|said|asks|asked|replies|replied|smiles|whispers|tells|answers|murmurs|calls|shouts|yells|cries)\.?)\s+(?=[A-Z][a-z]+(?:\s+[a-z]+)*\s+[a-z]+|[A-Z][a-z]+\s+(?:looks|walks|thinks|sits|runs|takes|stops|holds|feels|cheers))/g, '$1\n\n');

    // 4. Quebra após fala completa fechada se a próxima frase for narrativa de ação
    s = s.replace(/([.!?]["”])\s+([A-Z][a-z]+\s+(?:looks|walks|thinks|sits|runs|takes|stops|holds|feels|cheers|smiles|shows|likes|is|was|has|had|goes))/g, '$1\n\n$2');

    // 5. Quebra narrativa antes de novo personagem agir
    s = s.replace(/([.!?])\s+(A\s+[a-z]+\s+man|The\s+people|The\s+next\s+day|At\s+home|After\s+class)\b/g, '$1\n\n$2');

    const parts = s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    formattedBlocks.push(...parts);
  }

  return formattedBlocks.length > 0 ? formattedBlocks : [normalized];
}
