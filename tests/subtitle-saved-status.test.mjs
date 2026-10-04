import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readEngineSource } from './helpers/engine-source.mjs';

const source = await readEngineSource();
const loader = source.slice(
  source.indexOf('async _loadSavedWords()'),
  source.indexOf('async _loadSavedWords()') + 1400,
);

assert.match(loader, /Promise\.all\(\[/,
  'boot deve carregar palavras, cards e conhecidas em paralelo');
assert.match(loader, /db\.getAllCards\(\)/,
  'boot deve consultar a autoridade do status FSRS');
assert.match(loader, /cardStatus\.get\(w\.id\)\s*\|\|\s*'new'/,
  'status deve ser correlacionado por cards.word_id');
assert.doesNotMatch(loader, /w\.status\s*\|\|\s*'new'/,
  'words não possui status FSRS');

console.log('Legenda carrega o status FSRS autoritativo no boot.');
