import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const popup = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
const study = readFileSync(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');
const editorial = readFileSync(new URL('../dashboard/css/editorial.css', import.meta.url), 'utf8');

assert.match(popup, /id="fipa-wrap" style="display:none/, 'popup começa sem espaço vazio quando não há IPA');
assert.match(popup, /Pronúncia \(IPA\)/, 'popup rotula a pronúncia IPA');
assert.match(popup, /font-size:25px;line-height:1\.25/, 'popup exibe a IPA em escala legível');
assert.match(popup, /q\('#fipa'\)\.textContent = d\.phonetic/, 'popup injeta a IPA como texto, sem HTML');
assert.match(popup, /ipaWrap\.style\.display = 'block'/, 'popup revela o bloco apenas quando há IPA');
assert.match(popup, /ipaWrap\.style\.display = 'none'/, 'popup oculta o bloco sem IPA');

assert.match(study, /class="study-ipa hidden" aria-live="polite"/, 'card anuncia a atualização da IPA');
assert.match(study, /Pronúncia \(IPA\)/, 'card rotula a pronúncia IPA');
assert.match(study, /phonValueEl\.textContent = ctxEntry\.phon/, 'card injeta a IPA como texto');
assert.match(study, /phonValueEl\.textContent = ''/, 'card limpa IPA ausente ou de card anterior');
assert.match(editorial, /\.study-ipa-value \{[^}]*font:500 clamp\(24px,3vw,34px\)/, 'IPA do card tem hierarquia tipográfica grande');

console.log('ipa-pronunciation-display: ok');
