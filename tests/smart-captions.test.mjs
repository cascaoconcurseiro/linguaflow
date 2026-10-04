import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { cueNewWordStats, hasNewWords, isFullyUnderstood } from '../content/subtitles/smart-captions.js';

const vocab = (known = [], saved = {}, ignored = []) => ({
  knownWords: new Set(known),
  savedWords: new Map(Object.entries(saved)),
  ignoredWords: new Set(ignored),
});

test('palavras comuns do idioma não contam como novas', () => {
  const stats = cueNewWordStats('I will go with you to the door', vocab());
  assert.equal(stats.unknown, 0);
  assert.ok(isFullyUnderstood(stats));
});

test('palavra fora do vocabulário do aluno conta como nova', () => {
  const stats = cueNewWordStats('The detective was meticulous', vocab());
  assert.equal(stats.unknown, 2);
  assert.ok(hasNewWords(stats));
  assert.ok(!isFullyUnderstood(stats));
});

test('conhecida, ignorada e salva dominada/em revisão contam como entendidas; em aprendizado não', () => {
  const v = vocab(['detective'], { meticulous: 'mature', frugal: 'review', stubborn: 'learning' }, ['quixotic']);
  assert.equal(cueNewWordStats('detective meticulous frugal quixotic', v).unknown, 0);
  assert.equal(cueNewWordStats('stubborn', v).unknown, 1);
});

test('flexões valem pela forma base entendida', () => {
  const v = vocab(['wander']);
  assert.equal(cueNewWordStats('wandering wandered wanders', v).unknown, 0);
  assert.equal(cueNewWordStats('wandering', vocab()).unknown, 1);
});

test('nomes próprios no meio da frase e palavras curtas são ignorados; início de frase conta', () => {
  assert.equal(cueNewWordStats('We met Bartholomew yesterday', vocab(['yesterday'])).unknown, 0);
  assert.equal(cueNewWordStats('Bartholomew arrived', vocab(['arrived'])).unknown, 1);
  assert.equal(cueNewWordStats('Oh no, it is ok', vocab()).total, 0);
});

test('fala vazia não é "entendida" nem pausa', () => {
  const stats = cueNewWordStats('', vocab());
  assert.equal(stats.total, 0);
  assert.ok(!isFullyUnderstood(stats));
  assert.ok(!hasNewWords(stats));
});

test('contrato: opções desligadas por padrão, salvas, aplicadas ao motor e ligadas na legenda e na pausa', async () => {
  const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
  const [panel, storage, markup, engine, display, capture, manifest] = await Promise.all([
    '../content/settings-panel.js', '../content/settings-panel/storage.js', '../content/settings-panel/markup.js',
    '../content/subtitle-engine.js', '../content/subtitles/engine/caption-display.js',
    '../content/subtitles/engine/capture.js', '../manifest.json',
  ].map(read));
  for (const key of ['smartAutoPause', 'smartHideKnownTranslation']) {
    assert.match(panel, new RegExp(`${key}: false`), `${key} deve nascer desligada`);
    assert.match(storage, new RegExp(`'${key}'`));
    assert.match(engine, new RegExp(`this\.${key} = false`));
    assert.ok(engine.includes(`getSetting('${key}')`));
  }
  assert.match(markup, /sel-smart-autopause/);
  assert.match(markup, /sel-smart-hide-known/);
  assert.match(display, /this\.smartHideKnownTranslation/);
  assert.match(capture, /!this\.smartAutoPause \|\| this\._cueHasNewWords\(shownCue\)/);
  assert.match(manifest, /content\/subtitles\/smart-captions\.js/);
});

test('telemetria: ligar cada opção conta no funil e a migração libera os três eventos', async () => {
  const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
  const [markup, sql] = await Promise.all([
    '../content/settings-panel/markup.js',
    '../supabase/migrations/20261004200000_usage_events_smart_captions.sql',
  ].map(read));
  for (const event of ['smart_pause_on', 'smart_hide_on', 'smart_lookup_on']) {
    assert.ok(markup.includes(`'${event}'`), `${event} deve ser registrado ao ligar`);
    assert.ok(sql.includes(`'${event}'`), `${event} deve estar no CHECK`);
  }
  // Expand-only: os eventos anteriores continuam permitidos.
  for (const old of ['player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done', 'weak_reinforce', 'weak_session_done']) {
    assert.ok(sql.includes(`'${old}'`), `${old} não pode sair do CHECK`);
  }
});
