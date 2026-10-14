// Regressões da inicialização: recuperação YouTube e entrega tardia de faixas Max, sem rede real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const flush = () => new Promise(resolve => setImmediate(resolve));
function youtube({ failure = 'empty' } = {}) {
  const listeners = new Map(), timers = [], options = [];
  let requests = 0;
  const location = new URL('https://www.youtube.com/watch?v=video123');
  const body = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hello.' }] }] });
  const player = {
    getPlayerResponse: () => ({ videoDetails: { videoId: 'video123' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?v=video123&lang=en' }] } } }),
    getOption: (_module, key) => key === 'track' ? { languageCode: 'en' } : [{ languageCode: 'en' }],
    setOption: (...args) => options.push(args), addEventListener() {},
  };
  const window = { location, addEventListener: (name, fn) => listeners.set(name, fn), postMessage() {}, fetch: async url => {
    requests++;
    if (String(url).includes('pot=')) return { ok: true, clone: () => ({ text: async () => body }) };
    if (failure === 'network') throw new TypeError('network');
    return { ok: failure !== 'http', status: failure === 'http' ? 403 : 200, text: async () => failure === 'invalid' ? '<html>unusable response</html>' : '' };
  } };
  const document = { currentScript: { dataset: { lfNonce: 'nonce', lfNavigationUrl: location.href } }, getElementById: () => player, readyState: 'loading', addEventListener() {} };
  class XHR {} XHR.prototype.open = () => {};
  runInNewContext(readFileSync(new URL('../content/youtube-hook.js', import.meta.url), 'utf8'), { window, document, XMLHttpRequest: XHR, URL, URLSearchParams, setTimeout: fn => timers.push(fn), console: { debug() {}, warn() {} } });
  const preload = async () => {
    listeners.get('message')({ source: window, origin: location.origin, data: { type: 'LF_PRELOAD_SUBTITLES' } });
    await flush();
    while (timers.length) timers.shift()();
  };
  return { window, options, preload, requests: () => requests };
}

for (const failure of ['network', 'http', 'invalid']) test(`YouTube recovers via player after ${failure}, without repeating direct fetch`, async () => {
  const sim = youtube({ failure });
  await sim.preload(); await sim.preload();
  assert.deepEqual(sim.options, [['captions', 'reload', true]]);
  assert.equal(sim.requests(), 1);
});

for (const query of ['lang=en&tlang=pt', 'lang=pt']) test(`captured ${query} cannot suppress source recovery`, async () => {
  const sim = youtube();
  await sim.window.fetch(`https://www.youtube.com/api/timedtext?v=video123&${query}&pot=token`);
  await flush(); await sim.preload();
  assert.deepEqual(sim.options, [['captions', 'reload', true]]);
});

test('Max replays early VTT only for the current page and trusted readiness message', async () => {
  const script = readFileSync(new URL('../content/hbo-inject.js', import.meta.url), 'utf8');
  const posted = [], listeners = new Map();
  const body = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello.';
  const window = { location: new URL('https://play.max.com/video/one'), postMessage: message => posted.push(message), addEventListener: (name, fn) => listeners.set(name, fn), fetch: async () => ({ headers: { get: () => 'text/vtt' }, clone: () => ({ text: async () => body }) }) };
  class XHR {} XHR.prototype.open = () => {}; XHR.prototype.send = () => {};
  const run = (nonce, previous = '') => runInNewContext(script, { window, document: { currentScript: { dataset: { lfNonce: nonce, lfPreviousNonce: previous, lfNavigationUrl: window.location.href } } }, XMLHttpRequest: XHR, Request, URL, ArrayBuffer, TextDecoder, console: { debug() {} } });
  run('first');
  await window.fetch('https://cdn.max.com/captions/one.vtt'); await flush();
  posted.length = 0;
  const ready = () => listeners.get('message')?.({ source: window, origin: window.location.origin, data: { type: 'LF_PRELOAD_SUBTITLES' } });
  ready();
  assert.equal(posted.length, 1, 'early capture must reach a late engine without refetch');
  assert.equal(posted[0].response, body);
  posted.length = 0;
  listeners.get('message')({ source: {}, origin: 'https://evil.test', data: { type: 'LF_PRELOAD_SUBTITLES' } });
  assert.equal(posted.length, 0);
  window.location = new URL('https://play.max.com/video/two');
  run('second', 'first'); ready();
  assert.equal(posted.length, 0, 'previous video must never be replayed');
  await window.fetch('https://cdn.max.com/captions/two.vtt'); await flush();
  posted.length = 0;
  run('third', 'second');
  assert.equal(posted.length, 1, 'rotation on same page replays with current nonce');
  assert.equal(posted[0].nonce, 'third');
  for (let i = 0; i < 8; i++) await window.fetch(`https://cdn.max.com/captions/${i}.vtt`);
  await flush(); posted.length = 0; ready();
  assert.equal(posted.length, 4, 'cache is bounded');
  assert.ok(posted.every(message => message.pageUrl === window.location.href));
  let resolveResponse;
  // Start a subtitle request on page two, then leave before its body arrives.
  const lateBody = new Promise(resolve => { resolveResponse = resolve; });
  window.fetch = async () => ({ headers: { get: () => 'text/vtt' }, clone: () => ({ text: () => lateBody }) });
  // A fresh hook wraps this controlled original fetch.
  delete window.__lf_hbo_bridge_update;
  run('fourth');
  await window.fetch('https://cdn.max.com/captions/late.vtt');
  window.location = new URL('https://play.max.com/video/three');
  posted.length = 0; resolveResponse(body); await flush(); ready();
  assert.equal(posted.length, 0, 'late response from previous page is discarded');
});
