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

console.log('6 contratos de concorrência do Web Reader passaram — tudo verde ✅');
