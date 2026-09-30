import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
const study = readFileSync(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');
const editorial = readFileSync(new URL('../dashboard/css/editorial.css', import.meta.url), 'utf8');

assert.match(popup, /id="fipa-wrap" style="display:none/, 'popup começa sem espaço vazio quando não há IPA');
// #383: IPA ao lado da palavra, sem título visível (rótulo fica no title).
// Modelo anterior (bloco de 25px com título) na tag git popup-card-v1.
assert.match(popup, /id="fipa" title="Pronúncia \(IPA\)"/, 'popup rotula a pronúncia IPA');
assert.match(popup, /id="fipa"[^>]*font-size:17px;line-height:1\.25/, 'popup exibe a IPA em escala legível');
assert.match(popup, /q\('#fipa'\)\.textContent = d\.phonetic/, 'popup injeta a IPA como texto, sem HTML');
assert.match(popup, /ipaWrap\.style\.display = 'inline'/, 'popup revela a IPA apenas quando existe');
assert.match(popup, /ipaWrap\.style\.display = 'none'/, 'popup oculta o bloco sem IPA');
assert.doesNotMatch(popup, /pronunciation_pt|fprpt|_convertIPAtoPT/, 'popup não mantém pronúncia abrasileirada');

assert.match(study, /class="study-ipa hidden" aria-live="polite"/, 'card anuncia a atualização da IPA');
assert.match(study, /Pronúncia \(IPA\)/, 'card rotula a pronúncia IPA');
assert.match(study, /phonValueEl\.textContent = ctxEntry\.phon/, 'card injeta a IPA como texto');
assert.match(study, /phonValueEl\.textContent = ''/, 'card limpa IPA ausente ou de card anterior');
assert.match(editorial, /\.study-ipa-value \{[^}]*font:500 clamp\((?:14px,1\.6vw,20px|24px,3vw,34px)\)/, 'IPA do card tem hierarquia tipográfica legível');

console.log('ipa-pronunciation-display: ok');
