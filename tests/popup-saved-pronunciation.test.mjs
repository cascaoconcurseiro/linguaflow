import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WordPopup } from '../content/word-popup.js';

const popupSource = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
assert.doesNotMatch(popupSource, /pronunciation_pt|_convertIPAtoPT|fprpt/, 'popup não mantém versão abrasileirada');
assert.match(popupSource, /q\('#fipa'\)\.textContent = d\.phonetic/, 'popup renderiza a IPA como texto');

const popup = new WordPopup({ cefrList: { good: 'B2' } });
popup.cefrList = { good: 'A1' };
assert.equal(popup._lookupCEFR('Good'), 'B2', 'popup usa a mesma classificação CEFR do motor');
assert.equal(popup._cefrLabel('A1'), 'CEFR A1 · Iniciante');

console.log('Popup mantém somente IPA e não renderiza pronúncia abrasileirada.');
