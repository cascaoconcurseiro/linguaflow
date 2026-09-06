import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
const method = source.slice(
  source.indexOf('async function fetchDictionary(word) {'),
  source.indexOf('// ── Funções de IA'),
);
const popupSource = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
const dictMethod = popupSource.slice(popupSource.indexOf('  _dict(w) {'), popupSource.indexOf('  _convertIPAtoPT', popupSource.indexOf('  _dict(w) {')));
assert.match(method, /fetchWithTimeout = async \(url, ms = 2000\)/,
  'cada provedor deve ter timeout finito compatível com o orçamento total');
assert.match(dictMethod, /}, 7000\);/,
  'o popup deve aguardar os três provedores antes de encerrar o dicionário');

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

// Fallback tier 2: Datamuse
const datamuseContext = vm.createContext({
  encodeURIComponent,
  console,
  fetch: async (url) => {
    if (url.includes('dictionaryapi.dev')) throw new Error('Timeout simulado');
    if (url.includes('datamuse.com')) {
      return {
        ok: true,
        json: async () => [
          {
            word: 'good',
            tags: ['adj', 'ipa_pron:gˈʊd'],
            defs: ['adj\tActing in the interest of what is beneficial, ethical, or moral.'],
          },
        ],
      };
    }
    return { ok: false };
  },
});
vm.runInContext(method, datamuseContext);
const datamuseResult = await vm.runInContext("fetchDictionary('good')", datamuseContext);
assert.equal(datamuseResult.phonetic, '/gˈʊd/', 'fallback Datamuse extrai IPA');
assert.equal(datamuseResult.partOfSpeech, 'adjective', 'fallback Datamuse mapeia classe gramatical');
assert.ok(datamuseResult.definition.includes('beneficial'), 'fallback Datamuse extrai definição');
console.log('Fallback para Datamuse verificado com sucesso.');

// Fallback tier 3: Wiktionary
const wiktionaryContext = vm.createContext({
  encodeURIComponent,
  console,
  fetch: async (url) => {
    if (url.includes('dictionaryapi.dev') || url.includes('datamuse.com')) {
      throw new Error('Offline simulado');
    }
    if (url.includes('wiktionary.org')) {
      return {
        ok: true,
        json: async () => ({
          en: [
            {
              partOfSpeech: 'Noun',
              definitions: [{ definition: '<p>A fruit that grows on a tree.</p>' }],
            },
          ],
        }),
      };
    }
    return { ok: false };
  },
});
vm.runInContext(method, wiktionaryContext);
const wiktionaryResult = await vm.runInContext("fetchDictionary('apple!')", wiktionaryContext);
assert.equal(wiktionaryResult.definition, 'A fruit that grows on a tree.', 'fallback Wiktionary extrai definição limpa');
console.log('Fallback para Wiktionary verificado com sucesso.');
