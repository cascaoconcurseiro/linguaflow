import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { db } from '../utils/db.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';

const injector = readFileSync(new URL('../content/injector.js', import.meta.url), 'utf8');

function mountInjector(chrome) {
  const timers = new Map();
  const listeners = new Map();
  const scripts = [];
  const context = {
    chrome, crypto: globalThis.crypto, Uint8Array,
    setInterval: (fn) => { timers.set(1, fn); return 1; },
    clearInterval: (id) => timers.delete(id),
    document: {
      createElement: () => ({ dataset: {} }),
      head: { appendChild: (script) => scripts.push(script) },
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    },
  };
  context.window = {
    location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/watch?v=a' },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  context.window.top = context.window;
  vm.runInNewContext(injector, context);
  return { context, timers, listeners, scripts };
}

test('injector does not start with missing runtime', () => {
  const mounted = mountInjector({});
  assert.equal(mounted.timers.size, 0);
  assert.equal(mounted.listeners.size, 0);
  assert.equal(mounted.scripts.length, 0);
});

test('injector stops on invalidation even without navigation', () => {
  const mounted = mountInjector({ runtime: { id: 'extension', getURL: (path) => path } });
  assert.equal(mounted.scripts.length, 1);
  mounted.context.chrome.runtime = undefined;
  mounted.timers.get(1)();
  assert.equal(mounted.timers.size, 0);
  assert.equal(mounted.listeners.size, 0);
});

test('injector rotates nonce on navigation and preserves previous credential', () => {
  const mounted = mountInjector({ runtime: { id: 'extension', getURL: (path) => path } });
  const first = mounted.context.window.__linguaFlowSubtitleBridge;
  mounted.context.window.location.href = 'https://www.youtube.com/watch?v=b';
  mounted.listeners.get('yt-navigate-finish')();
  assert.equal(mounted.scripts.length, 2);
  assert.equal(mounted.scripts[1].dataset.lfPreviousNonce, first.nonce);
  assert.notEqual(mounted.context.window.__linguaFlowSubtitleBridge.nonce, first.nonce);
  mounted.timers.get(1)();
  assert.equal(mounted.scripts.length, 2);
});

test('injector handles synchronous getURL invalidation without publishing nonce', () => {
  const mounted = mountInjector({ runtime: { id: 'extension', getURL: () => { throw new Error('Extension context invalidated.'); } } });
  assert.equal(mounted.context.window.__linguaFlowSubtitleBridge, undefined);
  assert.equal(mounted.timers.size, 0);
});

test('subtitle cache skips missing extension APIs without logging TypeError', async () => {
  const original = globalThis.chrome;
  const log = console.error;
  const errors = [];
  globalThis.chrome = {};
  console.error = (...args) => errors.push(args);
  try {
    const engine = Object.create(SubtitleEngine.prototype);
    engine.cues = [];
    engine._isNavigationCurrent = () => true;
    await engine._fetchYoutubeSubtitles({ url: 'https://www.youtube.com/watch?v=a' });
    assert.equal(errors.length, 0);
  } finally { globalThis.chrome = original; console.error = log; }
});

test('subtitle cache tolerates invalidation but still reports genuine storage failures', async () => {
  const original = globalThis.chrome;
  const log = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  const engine = Object.create(SubtitleEngine.prototype);
  engine.cues = [];
  engine._isNavigationCurrent = () => true;
  try {
    globalThis.chrome = { runtime: { id: 'extension' }, storage: { local: { get: async () => { throw new Error('Extension context invalidated.'); } } } };
    await engine._fetchYoutubeSubtitles({ url: 'https://www.youtube.com/watch?v=a' });
    assert.equal(errors.length, 0);
    chrome.storage.local.get = async () => { throw new Error('storage unavailable'); };
    await engine._fetchYoutubeSubtitles({ url: 'https://www.youtube.com/watch?v=a' });
    assert.equal(errors.length, 1);
  } finally { globalThis.chrome = original; console.error = log; }
});

test('proxy preserves successful replies and genuine worker timeouts', async () => {
  const originals = { chrome: globalThis.chrome, set: globalThis.setTimeout, clear: globalThis.clearTimeout, proxy: db.isProxyMode, error: console.error };
  const timers = new Map();
  const errors = [];
  globalThis.setTimeout = (fn) => { timers.set(1, fn); return 1; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  console.error = (...args) => errors.push(args);
  db.isProxyMode = true;
  try {
    globalThis.chrome = { runtime: { id: 'extension', sendMessage: (_message, cb) => cb({ result: 'pt' }) } };
    assert.equal(await db.getSetting('targetLang'), 'pt');
    assert.equal(timers.size, 0);
    chrome.runtime.sendMessage = () => {};
    const pending = db.getSetting('targetLang');
    const rejected = assert.rejects(pending, /DB proxy timeout/);
    timers.get(1)();
    await rejected;
    assert.equal(errors.length, 1);
    const orphan = db.getSetting('targetLang');
    const invalidated = assert.rejects(orphan, /Recarregue/);
    chrome.runtime = undefined;
    timers.get(1)();
    await invalidated;
    assert.equal(errors.length, 1);
  } finally {
    globalThis.chrome = originals.chrome; globalThis.setTimeout = originals.set; globalThis.clearTimeout = originals.clear; db.isProxyMode = originals.proxy; console.error = originals.error;
  }
});

test('proxy clears timeout on synchronous send failure and rejects missing runtime immediately', async () => {
  const originals = { chrome: globalThis.chrome, set: globalThis.setTimeout, clear: globalThis.clearTimeout, proxy: db.isProxyMode };
  const timers = new Map();
  globalThis.setTimeout = (fn) => { timers.set(1, fn); return 1; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  db.isProxyMode = true;
  try {
    globalThis.chrome = { runtime: { id: 'extension', sendMessage: () => { throw new Error('Extension context invalidated.'); } } };
    await assert.rejects(db.getSetting('targetLang'), /invalidated/);
    assert.equal(timers.size, 0);
    globalThis.chrome = {};
    await assert.rejects(db.getSetting('targetLang'), /Recarregue/);
    assert.equal(timers.size, 0);
  } finally {
    globalThis.chrome = originals.chrome; globalThis.setTimeout = originals.set; globalThis.clearTimeout = originals.clear; db.isProxyMode = originals.proxy;
  }
});
