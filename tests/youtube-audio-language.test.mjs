import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../content/youtube-hook.js', import.meta.url), 'utf8');

function detect({ tracks = [], selected = null, available = [], responseVideoId = 'video123' } = {}) {
  const location = new URL('https://www.youtube.com/watch?v=video123');
  const messages = [];
  const listeners = new Map();
  const player = {
    getAudioTrack: () => selected,
    getAvailableAudioTracks: () => available,
    getPlayerResponse: () => ({
      videoDetails: { videoId: responseVideoId },
      captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } },
    }),
    getOption: () => [], addEventListener: () => {},
  };
  const document = {
    currentScript: { dataset: { lfNonce: 'test-nonce', lfNavigationUrl: location.href } },
    getElementById: () => player, readyState: 'complete', addEventListener: () => {},
  };
  const window = {
    location, fetch: async () => { throw new Error('audio detection must not fetch captions'); },
    addEventListener: (name, fn) => listeners.set(name, fn), postMessage: message => messages.push(message),
  };
  class XHR {} XHR.prototype.open = function() {};
  runInNewContext(script, { window, document, XMLHttpRequest: XHR, URL, URLSearchParams, setTimeout: () => {}, console: { debug() {}, warn() {} } });
  listeners.get('message')({ source: window, origin: location.origin, data: { type: 'LF_GET_AUDIO_LANGUAGE' } });
  const result = messages.find(message => message.type === 'LF_AUDIO_LANGUAGE');
  return { language: result?.language || null, evidence: result?.evidence || null };
}

const asr = (languageCode = 'en') => ({ kind: 'asr', languageCode, baseUrl: `https://www.youtube.com/api/timedtext?lang=${languageCode}` });

test('one original ASR track supplies qualified evidence when selected audio is unavailable', () => {
  assert.deepEqual(detect({ tracks: [asr()] }), { language: 'en', evidence: 'caption_asr' });
  assert.deepEqual(detect({ tracks: [asr()], selected: { id: 'default' } }), { language: 'en', evidence: 'caption_asr' });
});
test('explicit selected Portuguese audio wins over English ASR', () => {
  assert.deepEqual(detect({ tracks: [asr()], selected: { languageCode: 'pt' } }), { language: 'pt', evidence: 'audio_track' });
});
test('manual or translated captions never assert audio language', () => {
  assert.deepEqual(detect({ tracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?lang=en' }] }), { language: null, evidence: null });
  assert.deepEqual(detect({ tracks: [{ ...asr(), baseUrl: 'https://www.youtube.com/api/timedtext?lang=en&tlang=en' }] }), { language: null, evidence: null });
});
test('multiple audio or ASR languages and stale player response stay unconfirmed', () => {
  assert.deepEqual(detect({ tracks: [asr()], available: [{ languageCode: 'en' }, { languageCode: 'pt' }] }), { language: null, evidence: null });
  assert.deepEqual(detect({ tracks: [asr('en'), asr('pt')] }), { language: null, evidence: null });
  assert.deepEqual(detect({ tracks: [asr()], responseVideoId: 'other' }), { language: null, evidence: null });
});
