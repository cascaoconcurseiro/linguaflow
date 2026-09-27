import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const study = readFileSync(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');

// 1. Deve importar o translator para fallback
assert.match(
  study,
  /import\s*\{\s*translator\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/utils\/translator\.js['"]/,
  'studyView deve importar o utilitário translator para fallback'
);

// 2. Não deve quebrar com TypeError ao verificar chunks
assert.match(
  study,
  /c\?\.eng\?\.toLowerCase\(\)/,
  'studyView deve usar safe navigation ao buscar chunks para evitar TypeErrors com campos ausentes'
);

// 3. Deve apresentar estado explícito de carregamento em vez de deixar a tradução oculta
assert.match(
  study,
  /transEl\.textContent = 'Traduzindo…'/,
  'studyView deve exibir estado de carregamento amigável quando a tradução ainda não estiver disponível'
);

// 4. Deve disparar fallback rápido via translator para contexto e palavra
assert.match(
  study,
  /translator\.translate\(context,\s*['"]en['"],\s*['"]pt['"]\)/,
  'studyView deve acionar tradução de fallback para a frase quando a IA não forneceu tradução'
);
assert.match(
  study,
  /translator\.translate\(word,\s*['"]en['"],\s*['"]pt['"]\)/,
  'studyView deve acionar tradução de fallback para a palavra isolada'
);

// 5. Deve garantir persistência do fallback se a chamada de IA falhar
assert.match(
  study,
  /await Promise\.allSettled\(fallbackTasks\)/,
  'studyView deve aguardar e aproveitar o fallback do translator caso enrichCard falhe'
);

console.log('Todos os contratos de fallback de tradução no estudo passaram ✅');
