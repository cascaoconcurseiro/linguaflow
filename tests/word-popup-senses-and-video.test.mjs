// tests/word-popup-senses-and-video.test.mjs — Issue #366: seções "Outras
// traduções" e "Neste vídeo" do card da palavra (estado, conteúdo escapado,
// nomes acessíveis e "Ouvir no vídeo").
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readPopupSourceSync } from './helpers/popup-source.mjs';

globalThis.chrome = {
  runtime: { getURL: (p) => p, sendMessage() {}, onMessage: { addListener() {} } },
  storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } },
};
const { WordPopup } = await import('../content/word-popup.js');
const source = readPopupSourceSync();

function fakePopup(engine = {}) {
  const els = {};
  const el = (id) => (els[id] ??= { id, innerHTML: '', textContent: '', style: { display: 'none' }, querySelectorAll: () => [] });
  const popup = Object.create(WordPopup.prototype);
  Object.assign(popup, { engine, word: 'filming', _q: (s) => el(s.replace('#', '')) });
  return { popup, els: el };
}

test('seções novas começam escondidas e têm título ligado por aria-labelledby', () => {
  assert.match(source, /<section id="fsenses" aria-labelledby="fsenses-title" style="display:none;/);
  assert.match(source, /<section id="fvid" aria-labelledby="fvid-title" style="display:none;/);
});

test('traduções por classe: mostra forma base, escapa texto e some sem dados', () => {
  const { popup, els } = fakePopup();
  popup._renderSenses([{ pos: 'verb', label: 'verbo', base: 'film', terms: ['filmar', '<b>x</b>'] }]);
  assert.equal(els('fsenses').style.display, '');
  assert.match(els('fsenses-list').innerHTML, /verbo[\s\S]*\(film\)[\s\S]*filmar, &lt;b&gt;x&lt;\/b&gt;/);
  popup._renderSenses([]);
  assert.equal(els('fsenses').style.display, 'none');
});

test('neste vídeo: conta, destaca a forma, mostra tradução e nomeia o botão', () => {
  const engine = {
    xhrCues: [
      { start: 50.8, end: 54, text: "Well, I'm filming this" },
      { start: 70, end: 72, text: 'I filmed the whole trip.', translatedText: 'Eu filmei a viagem.' },
      { start: 125, end: 127, text: 'Nobody films like that.' },
    ],
  };
  const { popup, els } = fakePopup(engine);
  popup._renderVideoExamples({ start: 50.8 });
  assert.equal(els('fvid').style.display, 'none', 'sem a forma base, "filmed" e "films" não casam com "filming"');
  popup.cache = { filming: { senses: [{ pos: 'verb', base: 'film', terms: ['filmar'] }] } };
  popup._renderVideoExamples({ start: 50.8 });
  assert.equal(els('fvid').style.display, '');
  assert.equal(els('fvid-title').textContent, 'Neste vídeo · mais 2 vezes');
  const html = els('fvid-list').innerHTML;
  assert.match(html, /I <b style="color:#7dd3fc">filmed<\/b> the whole trip\./);
  assert.match(html, /Eu filmei a viagem\./);
  assert.match(html, /aria-label="Ouvir no vídeo a fala em 2:05"/);
  assert.doesNotMatch(html, /I'm filming this/, 'a fala atual não se repete');
});

test('neste vídeo some fora de vídeo ou quando a palavra só aparece uma vez', () => {
  const { popup, els } = fakePopup({});
  popup._renderVideoExamples(null);
  assert.equal(els('fvid').style.display, 'none');
});

test('ouvir no vídeo fecha o card e toca a partir da fala', () => {
  let played = false;
  const video = { currentTime: 0, play: async () => { played = true; } };
  const { popup } = fakePopup({ videoElement: video });
  let hidden = null;
  popup.hide = (resume) => { hidden = resume; };
  popup._playVideoExample({ start: 70 });
  assert.equal(hidden, false, 'fecha sem retomar do ponto antigo');
  assert.equal(video.currentTime, 69.9);
  assert.equal(played, true);
});
