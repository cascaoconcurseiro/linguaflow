import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../content/web-reader.js', import.meta.url), 'utf8');

assert.match(source, /if \(isLinguaFlowPage\(window\.location, document\)\) return;/,
  'o leitor não inicializa dentro do LinguaFlow');
assert.match(source, /const interactionEpoch = \+\+lifecycle\.interactionEpoch;/,
  'cada seleção recebe um epoch');
assert.match(source, /interactionEpoch !== lifecycle\.interactionEpoch \|\| currentWord !== word/,
  'tradução antiga não publica na seleção atual');
assert.match(source, /const handleDoubleClick = \(e\) => \{[\s\S]*clearTimeout\(lifecycle\.selectionTimer\);[\s\S]*handleWordClick\(e\);/,
  'dblclick cancela o mouseup agendado do mesmo gesto');
assert.match(source, /type: 'QUEUE_WORD_SAVE'/,
  'salvamento confirma pela fila local-first');
assert.match(source, /window\.addEventListener\('pagehide', dispose, \{ once: true \}\)/,
  'lifecycle da página descarta listeners e popup');
assert.match(source, /request\?\.action === 'openWordPopup'/,
  'o leitor aceita comando de tradução disparado pelo menu de contexto (botão direito)');
assert.match(source, /if \(!e\.altKey\) return;/,
  'seleção simples com botão esquerdo não abre popup sem tecla Alt');
assert.match(source, /closest\('button, \[role="button"\], a, input, textarea, select/,
  'cliques em controles interativos e botões são ignorados');
assert.doesNotMatch(source, /translate\.googleapis\.com\/translate_a\/single/,
  'o content script não faz fetch direto de tradução fora do service worker');
assert.doesNotMatch(source, /sendMessage\(\{ type: 'WORD_SAVED' \}\)/,
  'o Reader não anuncia salvamento remoto antes da sincronização da fila');

console.log('11 contratos de concorrência e interação do Web Reader passaram — tudo verde ✅');
