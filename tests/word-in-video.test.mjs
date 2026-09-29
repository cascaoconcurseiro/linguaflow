// tests/word-in-video.test.mjs — Issue #366: outras falas do mesmo vídeo com
// a palavra do card, pelo mesmo lema da aba Palavras.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findWordInVideo } from '../content/subtitles/video-vocabulary.js';

const cues = [
  { start: 50.8, end: 54.7, text: "Well, I'm filming this August 29th, so it's not September yet" },
  { start: 56.5, end: 58.3, text: "It's weird I'm finally not filming a video for school." },
  { start: 70, end: 72, text: 'I filmed the whole trip.', translatedText: 'Eu filmei a viagem inteira.' },
  { start: 80, end: 82, text: 'Nobody films like that anymore.' },
  { start: 90, end: 92, text: 'The film was great.' },
  { start: 95, end: 97, text: 'Filmmaker life, you know.' },
  { start: 99, end: 101, text: 'I have to look after my sister and look after the dog.' },
];

test('encontra as outras formas da mesma palavra, sem repetir a fala atual', () => {
  const result = findWordInVideo(cues, 'filming', { excludeStart: 50.8 });
  assert.equal(result.total, 4, 'filming, filmed, films e film; "filmmaker" é outra palavra');
  assert.deepEqual(result.items.map((i) => i.start), [56.5, 70, 80]);
  assert.equal(result.items[1].translatedText, 'Eu filmei a viagem inteira.');
  assert.equal(result.items[1].form, 'filmed', 'informa a forma usada na fala para destacar');
});

test('com a forma base do dicionário, reconhece flexões mesmo sem a base no vídeo', () => {
  const noBase = cues.filter((c) => !/\bfilm\b/i.test(c.text));
  assert.equal(findWordInVideo(noBase, 'filming', { excludeStart: 50.8 }).total, 1, 'sem base só a mesma forma casa');
  assert.equal(findWordInVideo(noBase, 'filming', { excludeStart: 50.8, base: 'film' }).total, 3);
  const things = [{ start: 1, end: 2, text: 'The best things in life.' }, { start: 3, end: 4, text: 'One more thing.' }];
  assert.equal(findWordInVideo(things, 'thing', { base: 'thing' }).total, 2, '"the" não é forma de "thing"');
  const hope = [{ start: 1, end: 2, text: 'He hopped on the bus.' }, { start: 3, end: 4, text: 'I hope so.' }];
  assert.equal(findWordInVideo(hope, 'hoping', { base: 'hope' }).total, 1, '"hopped" é de "hop", não de "hope"');
});

test('respeita o limite e devolve vazio quando a palavra só aparece na fala atual', () => {
  assert.equal(findWordInVideo(cues, 'film', { limit: 1 }).items.length, 1);
  const only = findWordInVideo(cues, 'September', { excludeStart: 50.8 });
  assert.equal(only.total, 0);
  assert.deepEqual(only.items, []);
});

test('expressão de várias palavras conta por fala e ignora maiúsculas', () => {
  const result = findWordInVideo(cues, 'Look after');
  assert.equal(result.total, 1);
  assert.equal(result.items[0].form, 'look after');
});

test('entradas inválidas não quebram o card', () => {
  assert.deepEqual(findWordInVideo(null, 'film'), { total: 0, items: [] });
  assert.deepEqual(findWordInVideo(cues, ''), { total: 0, items: [] });
});
