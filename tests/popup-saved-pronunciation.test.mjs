import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WordPopup } from '../content/word-popup.js';
import { db } from '../utils/db.js';

for (const savedFirst of [true, false]) {
  let resolveSaved, resolveDictionary;
  const saved = new Promise(resolve => { resolveSaved = resolve; });
  const dictionary = new Promise(resolve => { resolveDictionary = resolve; });
  db.getWord = (word, lang) => {
    assert.equal(word, 'apple'); assert.equal(lang, 'en'); return saved;
  };
  const popup = new WordPopup({ sourceLang: 'en' });
  Object.assign(popup, {
    cache: {}, word: 'apple', engine: { sourceLang: 'en' },
    _render() {}, _translate: async () => 'maçã', _dict: () => dictionary,
    _convertIPAtoPT: () => 'fallback',
  });
  await popup._loadData('apple');
  const finishSaved = async () => { resolveSaved({ pronunciation_pt: 'á-pou' }); await Promise.resolve(); };
  const finishDictionary = async () => { resolveDictionary({ phonetic: '/apple/' }); await Promise.resolve(); };
  if (savedFirst) { await finishSaved(); await finishDictionary(); }
  else { await finishDictionary(); await finishSaved(); }
  assert.equal(popup.cache.apple.pronunciation_pt, 'á-pou');
}

{
  const rendered = [];
  db.getWord = async () => null;
  const popup = new WordPopup({ sourceLang: 'en' });
  Object.assign(popup, {
    cache: {}, word: 'good',
    _render(data) { rendered.push({ ...data }); },
    _translate: async () => 'bom',
    _dict: async () => ({}),
  });
  await popup._loadData('good');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(rendered[0].pronunciation_pt, '', 'não exibe reticências como pronúncia pronta');
  assert.equal(popup.cache.good.definition, 'Definição indisponível no momento.');
}

{
  const popup = new WordPopup({ cefrList: { good: 'B2' } });
  popup.cefrList = { good: 'A1' };
  assert.equal(popup._lookupCEFR('Good'), 'B2', 'popup usa a mesma classificação CEFR do motor');
  assert.equal(popup._cefrLabel('A1'), 'CEFR A1 · Iniciante');
  assert.equal(popup._convertIPAtoPT('/ɡʊd/'), 'gud', 'converte o símbolo IPA ɡ para escrita brasileira');
}
const popupSource = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
assert.match(popupSource, /q\('#fcefr-prog'\)\.style\.display = 'none'/, 'remove progresso CEFR da palavra anterior');
const engineSource = readFileSync(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
assert.match(engineSource, /await this\.wordPopup\.init\(\)/, 'espera listas CEFR e frequência antes de liberar o popup');
console.log('Pronúncia salva prevalece nas duas ordens de resposta banco/dicionário.');
