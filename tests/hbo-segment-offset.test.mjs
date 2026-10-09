import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SEGMENT_OFFSET_SECONDS,
  estimateSegmentOffset,
  normalizeCaptionText,
  segmentKey,
  shiftCues,
} from '../content/subtitles/hbo-segment-offset.js';

const cues = [
  { start: 2969.9, end: 2972, text: 'I know what you meant.' },
  { start: 2973.6, end: 2976, text: "My mama's daddy was half Black." },
  { start: 2980.4, end: 2983, text: 'You know my mama delivered the Twins?' },
  { start: 3000, end: 3002, text: 'Yeah.' },
  { start: 3010, end: 3012, text: 'Yeah.' },
];

test('normaliza texto nativo e do VTT para o mesmo formato', () => {
  assert.equal(normalizeCaptionText('♪ Traveling ♪'), 'traveling');
  assert.equal(normalizeCaptionText('[Remmick] You should'), 'you should');
  assert.equal(normalizeCaptionText('  Hoo   hoo, boy!\n'), 'hoo hoo boy');
});

test('segmentKey ignora query e assina o arquivo', () => {
  assert.equal(
    segmentKey('https://x.hbo/gcs/abc/t/b76f9e/t33/4.vtt?CMCD=cid%3D1'),
    'https://x.hbo/gcs/abc/t/b76f9e/t33/4.vtt',
  );
  assert.equal(segmentKey(''), '');
});

test('estima o deslocamento do arquivo com amostras concordantes', () => {
  const samples = [
    { time: 3015.3, text: 'I know what you meant.' },
    { time: 3019.0, text: "My mama's daddy was half Black." },
    { time: 3025.8, text: 'You know my mama delivered the Twins?' },
  ];
  const offset = estimateSegmentOffset(samples, cues);
  assert.ok(Math.abs(offset - 45.4) < 0.3, String(offset));
});

test('exige pelo menos duas amostras concordantes', () => {
  assert.equal(estimateSegmentOffset([{ time: 3015.3, text: 'I know what you meant.' }], cues), null);
});

test('ignora falas repetidas no arquivo (casamento ambíguo)', () => {
  const samples = [
    { time: 3045, text: 'Yeah.' },
    { time: 3055, text: 'Yeah.' },
  ];
  assert.equal(estimateSegmentOffset(samples, cues), null);
});

test('amostras que discordam não calibram', () => {
  const samples = [
    { time: 3015.3, text: 'I know what you meant.' },
    { time: 3100, text: "My mama's daddy was half Black." },
  ];
  assert.equal(estimateSegmentOffset(samples, cues), null);
});

test('rejeita deslocamento fora do limite', () => {
  const far = [
    { time: 2969.9 + MAX_SEGMENT_OFFSET_SECONDS + 50, text: 'I know what you meant.' },
    { time: 2973.6 + MAX_SEGMENT_OFFSET_SECONDS + 50, text: "My mama's daddy was half Black." },
  ];
  assert.equal(estimateSegmentOffset(far, cues), null);
});

test('deslocamento abaixo de meio segundo vira zero', () => {
  const samples = [
    { time: 2970.1, text: 'I know what you meant.' },
    { time: 2973.8, text: "My mama's daddy was half Black." },
  ];
  assert.equal(estimateSegmentOffset(samples, cues), 0);
});

test('shiftCues parte dos tempos originais e é idempotente', () => {
  const list = [{ start: 10, end: 12, text: 'a' }];
  shiftCues(list, 45);
  assert.deepEqual([list[0].start, list[0].end], [55, 57]);
  shiftCues(list, 45);
  assert.deepEqual([list[0].start, list[0].end], [55, 57]);
  shiftCues(list, 0);
  assert.deepEqual([list[0].start, list[0].end], [10, 12]);
});

test('motor só calibra na Max e nunca mexe no caminho do YouTube', async () => {
  const { readEngineSource } = await import('./helpers/engine-source.mjs');
  const source = await readEngineSource();
  assert.match(source, /if \(this\.platform === 'max'\) this\._maxTagSegment\(newCues, url\)/);
  assert.match(source, /if \(this\.platform === 'max'\) this\._maxResetCalibration\(\)/);
  assert.ok(source.includes("this._maxStartCalibration();"));
  const maxSync = source.slice(source.indexOf('export class MaxSyncMethods'));
  assert.doesNotMatch(maxSync, /youtube|timedtext/i);
});
