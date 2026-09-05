import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
const method = source.slice(
  source.indexOf('async function fetchDictionary(word) {'),
  source.indexOf('// ── Funções de IA'),
);

const context = vm.createContext({
  encodeURIComponent,
  console,
  fetch: async () => ({
    ok: true,
    json: async () => [{
      word: 'good',
      phonetics: [{ text: '/ɡʊd/', audio: '' }],
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{ definition: 'of high quality' }],
        synonyms: [],
        antonyms: [],
      }],
    }],
  }),
});
vm.runInContext(method, context);
const result = await vm.runInContext("fetchDictionary('good')", context);
assert.equal(result.phonetic, '/ɡʊd/', 'usa phonetics[].text quando entry.phonetic não existe');
console.log('Dicionário preserva IPA disponível no formato alternativo da API.');
