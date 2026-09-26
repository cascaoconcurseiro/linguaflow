import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateWpm,
  detectConnectedSpeech,
  annotateCaptionSegment,
} from '../utils/speech-cadence.js';

test('Speech Cadence: calculateWpm calcula palavras por minuto e cadência corretamente', () => {
  // 10 palavras em 3 segundos: (10 / 3) * 60 = 200 WPM
  const fast = calculateWpm('This is a test of rapid speech spoken in three seconds', 3);
  assert.equal(fast.words, 11);
  assert.equal(fast.wpm, 220);
  assert.equal(fast.cadence, 'very_fast');

  // 10 palavras em 4 segundos: (10 / 4) * 60 = 150 WPM (ritmo conversacional normal)
  const normal = calculateWpm('This is a test of normal speech spoken in four seconds', 4);
  assert.equal(normal.words, 11);
  assert.equal(normal.wpm, 165);
  assert.equal(normal.cadence, 'normal');

  // Fala pausada: 4 palavras em 4 segundos: (4 / 4) * 60 = 60 WPM
  const slow = calculateWpm('Hello my good friend', 4);
  assert.equal(slow.words, 4);
  assert.equal(slow.wpm, 60);
  assert.equal(slow.cadence, 'slow');

  // Casos extremos
  const zeroDur = calculateWpm('Test phrase', 0);
  assert.equal(zeroDur.wpm, 0);

  const empty = calculateWpm('', 5);
  assert.equal(empty.words, 0);
  assert.equal(empty.wpm, 0);
});

test('Speech Cadence: detectConnectedSpeech detecta reduções coloquiais frequentes', () => {
  const text = "I'm gonna go because I wanna see them and I gotta hurry.";
  const matches = detectConnectedSpeech(text);

  const reductions = matches.filter((m) => m.type === 'reduction');
  const foundWords = reductions.map((r) => r.phrase.toLowerCase());

  assert.ok(foundWords.includes('gonna'), 'deve detectar gonna');
  assert.ok(foundWords.includes('wanna'), 'deve detectar wanna');
  assert.ok(foundWords.includes('gotta'), 'deve detectar gotta');
});

test('Speech Cadence: detectConnectedSpeech detecta linking consoante + vogal', () => {
  const text = 'Please turn it off and pick an apple.';
  const matches = detectConnectedSpeech(text);

  const linkings = matches.filter((m) => m.type === 'linking');
  assert.ok(linkings.length >= 2, 'deve detectar junções de consoante final + vogal');
  const phrases = linkings.map((l) => l.phrase.toLowerCase());
  assert.ok(phrases.some((p) => p.includes('turn it') || p.includes('it off')));
});

test('Speech Cadence: detectConnectedSpeech detecta assimilação palatal (/t,d/ + /j/)', () => {
  const text = "Did you hear that? Don't you know who called you?";
  const matches = detectConnectedSpeech(text);

  const assimilations = matches.filter((m) => m.type === 'assimilation');
  assert.ok(assimilations.length >= 2, 'deve detectar assimilações Did you / Don\'t you');
  const phrases = assimilations.map((a) => a.phrase.toLowerCase());
  assert.ok(phrases.some((p) => p.includes('did you')));
  assert.ok(phrases.some((p) => p.includes("don't you")));
});

test('Speech Cadence: detectConnectedSpeech detecta elisão em encontros consonantais duplos', () => {
  const text = 'She lives next door and we met last night.';
  const matches = detectConnectedSpeech(text);

  const elisions = matches.filter((m) => m.type === 'elision');
  assert.ok(elisions.length >= 1, 'deve detectar elisão como next door ou last night');
  const phrases = elisions.map((e) => e.phrase.toLowerCase());
  assert.ok(phrases.some((p) => p.includes('next door') || p.includes('last night')));
});

test('Speech Cadence: annotateCaptionSegment enriquece segmento com métricas completas', () => {
  const segment = {
    start: 12.0,
    end: 14.5,
    text: "Did you pick it up right now?",
  };

  const annotated = annotateCaptionSegment(segment);
  assert.equal(annotated.start, 12.0);
  assert.equal(annotated.end, 14.5);
  assert.ok(annotated.cadence.wpm > 0);
  assert.ok(annotated.connectedSpeech.length >= 2);
  assert.equal(annotated.hasChallengingPhonetics, true);
});

test('Speech Cadence: subtitle-engine.js ou dock integra speech-cadence', () => {
  const code = readFileSync('content/subtitle-engine.js', 'utf8');
  assert.match(code, /speech-cadence|calculateWpm|detectConnectedSpeech/, 'subtitle-engine deve integrar speech-cadence');
});
