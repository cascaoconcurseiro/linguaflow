// tests/expression-detection-rules.test.mjs — Issue #346: separação com
// objeto, fala reduzida, "'d", "soa como", marcadores e marcas por tipo.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { detectExpressions } from '../utils/expression-detector.js';
import { REDUCTIONS } from '../utils/speech-cadence.js';
import { slangMatchesContext, slangsDB } from '../utils/slangs-db.js';
import { detectExprType } from '../content/popup/popup-linguistics.js';
import { SubtitleEngine, EXPRESSION_MARK_SETTINGS } from '../content/subtitle-engine.js';
import { readEngineSource } from './helpers/engine-source.mjs';

const found = (text, type) =>
  detectExpressions(text).filter((d) => !type || d.type === type).map((d) => `${d.text}→${d.canonical}`);

test('phrasal separado por objeto com determinante', () => {
  assert.deepEqual(found('Turn the lights off before bed.', 'phrasal'), ['Turn the lights off→turn off']);
  assert.deepEqual(found('Pick the kids up at five.', 'phrasal'), ['Pick the kids up→pick up']);
  assert.deepEqual(found('Take your shoes off, please.', 'phrasal'), ['Take your shoes off→take off']);
  assert.deepEqual(found('Put the book on the table.', 'phrasal'), [], '"on" não é partícula separável; "book" é substantivo');
});

test('fala reduzida escrita é redução, não gíria', () => {
  const items = detectExpressions("I'm gonna call you 'cause, y'know, c'mon.");
  assert.deepEqual(items.map((d) => [d.type, d.canonical]), [
    ['reduction', 'gonna'], ['reduction', "'cause"], ['reduction', "y'know"], ['reduction', "c'mon"],
  ]);
  assert.equal(items[0].meaning, 'going to');
  assert.ok(slangsDB.has('gonna'), 'lookup antigo continua reconhecendo');
  assert.equal(REDUCTIONS.tryna, 'trying to');
});

test("'d vira had ou would pela palavra seguinte", () => {
  const sense = (text) => detectExpressions(text).filter((d) => d.type === 'contraction').map((d) => d.canonical);
  assert.deepEqual(sense("I'd never seen that."), ["'d = had"]);
  assert.deepEqual(sense("You'd better go."), ["'d = had"]);
  assert.deepEqual(sense("She'd finished early."), ["'d = had"]);
  assert.deepEqual(sense("I'd love to."), ["'d = would"]);
  assert.deepEqual(sense("He'd go if he could."), ["'d = would"]);
  assert.deepEqual(sense("I'd need more time."), ["'d = would"], '"need" termina em -ed mas é verbo base');
});

test('"soa como": só onde a legenda escreve a forma cheia que a fala reduz', () => {
  const hints = (text) => detectExpressions(text).filter((d) => d.type === 'sounds_like').map((d) => d.hint);
  assert.deepEqual(hints("I'm going to be honest."), ['gonna']);
  assert.deepEqual(hints("I'm going to the store."), [], 'ir a um lugar não vira gonna');
  assert.deepEqual(hints('I want to know.'), ['wanna']);
  assert.deepEqual(hints("I've got to go."), ['gotta']);
  assert.deepEqual(hints('I got to the station.'), []);
  assert.deepEqual(hints("He's kind of tired, a kind of magic."), ['kinda']);
  assert.deepEqual(hints('I should have told you.'), ['shoulda']);
});

test('marcadores de conversa só quando destacados por pontuação', () => {
  const markers = (text) => detectExpressions(text).filter((d) => d.type === 'marker').map((d) => d.canonical);
  assert.deepEqual(markers('You know, I mean, it was great.'), ['you know', 'I mean']);
  assert.deepEqual(markers('You know what I did?'), []);
  assert.deepEqual(markers('She was like, what?'), ['be like']);
  assert.deepEqual(markers('I like this song.'), []);
});

test('popup mostra o tipo falado com o sentido da frase', () => {
  const opts = { slangsDB, slangMatchesContext, detectExpressions, reductions: REDUCTIONS };
  const d = detectExprType("i'd", { ...opts, context: "I'd never seen that before." });
  assert.equal(d.type, 'contraction');
  assert.match(d.label, /I'd = I had/);
  assert.equal(detectExprType('gonna', { ...opts, context: "I'm gonna go" }).type, 'reduction');
  assert.equal(detectExprType('gonna', opts).type, 'reduction', 'sem frase usa o mapa de reduções');
});

test('marcas por tipo: estilo distinto além da cor, desligáveis e salvas', async () => {
  const src = await readEngineSource();
  assert.match(src, /underline wavy/);
  assert.match(src, /2px dashed/);
  assert.match(src, /3px double/);
  assert.match(src, /content: "≈" attr\(data-hint\)/);
  assert.deepEqual(Object.keys(EXPRESSION_MARK_SETTINGS).sort(), ['marker', 'phrasal', 'reduction', 'slang', 'sounds_like']);

  const classes = new Set();
  const wrap = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  const engine = Object.create(SubtitleEngine.prototype);
  engine.shadowContainer = { getElementById: (id) => (id === 'lf-wrap' ? wrap : null) };
  engine.expressionMarks = { phrasal: true, slang: false, reduction: false, sounds_like: true, marker: false };
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    engine._applyExpressionMarks();
  } finally {
    globalThis.document = previousDocument;
  }
  assert.deepEqual([...classes].sort(), ['lf-hide-contraction', 'lf-hide-marker', 'lf-hide-reduction', 'lf-hide-slang']);

  const settings = await readFile(new URL('../content/settings-panel.js', import.meta.url), 'utf8');
  for (const key of Object.values(EXPRESSION_MARK_SETTINGS)) assert.match(settings, new RegExp(`'${key}'`));
});
