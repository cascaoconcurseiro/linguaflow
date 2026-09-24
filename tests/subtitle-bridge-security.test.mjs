import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const injectorSource = readFileSync(new URL('../content/injector.js', import.meta.url), 'utf8');
const youtubeHookSource = readFileSync(new URL('../content/youtube-hook.js', import.meta.url), 'utf8');
const hboHookSource = readFileSync(new URL('../content/hbo-inject.js', import.meta.url), 'utf8');
assert.match(injectorSource, /dataset\.lfPreviousNonce = previousNonce/);
for (const hook of [youtubeHookSource, hboHookSource]) {
  assert.match(hook, /currentNonce !== bridgeNonce \|\| !nonce/,
    'rotação do canal deve exigir conhecimento da credencial anterior');
}

globalThis.window = {
  location: {
    origin: 'https://www.youtube.com',
    href: 'https://www.youtube.com/watch?v=video-a',
  },
};

const { isTrustedSubtitleBridgeMessage } = await import('../content/subtitle-engine.js');
const state = { nonce: 'a'.repeat(48), url: window.location.href };
const base = {
  source: window,
  origin: window.location.origin,
  data: {
    type: 'LF_SUBTITLE_HOOK',
    nonce: state.nonce,
    pageUrl: window.location.href,
    url: 'https://www.youtube.com/api/timedtext?v=video-a&lang=en',
    data: '{"events":[]}',
  },
};

assert.equal(isTrustedSubtitleBridgeMessage(base, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, source: {} }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, origin: 'https://evil.test' }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, nonce: 'forged' } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, pageUrl: 'https://www.youtube.com/watch?v=old' } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage(base, { ...state, url: 'https://www.youtube.com/watch?v=old' }, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, type: 'LF_UNKNOWN' } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, url: 'javascript:alert(1)' } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, url: 'https://evil.test/not-a-subtitle' } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, url: `https://x.test/${'a'.repeat(4096)}` } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, data: 'a'.repeat(5 * 1024 * 1024 + 1) } }, state, window.location.href), false);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, data: 'á'.repeat(3 * 1024 * 1024) } }, state, window.location.href), false);

const binary = new ArrayBuffer(32);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, data: binary } }, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...base, data: { ...base.data, data: { forged: true } } }, state, window.location.href), false);

const playerState = { ...base, data: { type: 'LF_PLAYER_STATE', nonce: state.nonce, pageUrl: window.location.href, state: 1 } };
assert.equal(isTrustedSubtitleBridgeMessage(playerState, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...playerState, data: { ...playerState.data, state: '1' } }, state, window.location.href), false);

const toggle = { ...base, data: { type: 'LF_YT_SUB_TOGGLE', nonce: state.nonce, pageUrl: window.location.href, active: false } };
assert.equal(isTrustedSubtitleBridgeMessage(toggle, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...toggle, data: { ...toggle.data, active: 0 } }, state, window.location.href), false);

const audioMessage = { ...base, data: { type:'LF_AUDIO_LANGUAGE', nonce:state.nonce, pageUrl:window.location.href, language:'en-US'.toLowerCase(), evidence:'audio_track' } };
assert.equal(isTrustedSubtitleBridgeMessage(audioMessage, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...audioMessage, data:{ ...audioMessage.data, language:'en', evidence:'caption_asr' } }, state, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...audioMessage, data:{ ...audioMessage.data, language:null, evidence:null } }, state, window.location.href), true);
for (const patch of [{nonce:'forged'},{pageUrl:'https://www.youtube.com/watch?v=old'},{language:'English'},{language:{code:'en'}},{evidence:'captions'},{language:null}]) {
  assert.equal(isTrustedSubtitleBridgeMessage({ ...audioMessage, data:{ ...audioMessage.data, ...patch } }, state, window.location.href), false);
}

window.location.href = 'https://play.max.com/video/title';
window.location.origin = 'https://play.max.com';
const maxState = { nonce: 'b'.repeat(48), url: window.location.href };
const maxMessage = {
  source: window,
  origin: window.location.origin,
  data: {
    type: 'LF_HBO_SUB',
    nonce: maxState.nonce,
    pageUrl: window.location.href,
    url: 'https://cdn.max.com/captions/episode.vtt',
    response: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello',
  },
};
assert.equal(isTrustedSubtitleBridgeMessage(maxMessage, maxState, window.location.href), true);
assert.equal(isTrustedSubtitleBridgeMessage({ ...maxMessage, data: { ...maxMessage.data, url: 'https://cdn.max.com/video.mp4' } }, maxState, window.location.href), false);

console.log('26 testes de segurança do canal de legendas passaram — tudo verde ✅');
