import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SubtitleEngine } from '../content/subtitle-engine.js';

function bareEngine(url) {
  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, {
    _disposed: false,
    _navigationController: null,
    _navigationEpoch: 0,
    _navigationUrl: '',
    _managedTimeouts: new Set(),
    _managedIntervals: new Set(),
    cues: [],
    xhrCues: [],
    sourceLang: 'en',
    usingXhr: false,
  });
  globalThis.window = { location: { href: url } };
  return engine;
}

// Uma navegação nova invalida e aborta deterministicamente a anterior.
const engine = bareEngine('https://www.youtube.com/watch?v=old');
const oldNavigation = engine._beginNavigation(window.location.href);
window.location.href = 'https://www.youtube.com/watch?v=new';
const newNavigation = engine._beginNavigation(window.location.href);
assert.equal(oldNavigation.signal.aborted, true);
assert.equal(engine._isNavigationCurrent(oldNavigation), false);
assert.equal(engine._isNavigationCurrent(newNavigation), true);
assert.equal(newNavigation.epoch, oldNavigation.epoch + 1);

// Repetir o mesmo evento de navegação do YouTube + URL poll não cria epoch dupla.
const repeated = engine._beginNavigation(window.location.href);
assert.equal(repeated.epoch, newNavigation.epoch);

// Fetch iniciado no vídeo antigo não pode publicar cues depois da troca.
const fetchEngine = bareEngine('https://www.youtube.com/watch?v=old');
const fetchNavigation = fetchEngine._beginNavigation(window.location.href);
let releaseStorage;
globalThis.chrome = {
  storage: {
    local: {
      get: () => new Promise((resolve) => { releaseStorage = resolve; }),
    },
  },
};
let fetchCalled = false;
globalThis.fetch = async () => {
  fetchCalled = true;
  return { ok: true, text: async () => JSON.stringify({ events: [{ tStartMs: 0 }] }) };
};
fetchEngine._processYtSub = () => [{ start: 0, end: 1, text: 'old cue' }];
fetchEngine._renderVideoWordPrep = () => { throw new Error('DOM antigo não pode ser publicado'); };
const pendingFetch = fetchEngine._fetchYoutubeSubtitles(fetchNavigation);
window.location.href = 'https://www.youtube.com/watch?v=new';
fetchEngine._beginNavigation(window.location.href);
releaseStorage({
  lastYoutubeSubtitleUrls: ['https://www.youtube.com/api/timedtext?v=old&lang=en'],
});
await pendingFetch;
assert.equal(fetchCalled, false);
assert.deepEqual(fetchEngine.cues, []);

// Contratos de lifecycle/guards que protegem callbacks de tradução e dispose.
const source = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
assert.match(source, /this\._navigationController\?\.abort\('navigation-superseded'\)/);
assert.match(source, /fetch\(new URL\(url\)\.toString\(\), \{ signal: navigation\.signal \}\)/);
assert.match(source, /!this\._isNavigationCurrent\(navigation\) \|\| !this\.cues\.includes\(cue\)/);
assert.match(source, /subtitleEpoch !== this\._domSubtitleEpoch/);
assert.match(source, /this\._lifecycleController\.abort\('engine-disposed'\)/);
assert.match(source, /this\._managedObservers\.forEach\(\(observer\) => observer\.disconnect\(\)\)/);
assert.match(source, /removeListener\(this\._runtimeMessageListener\)/);

console.log('13 testes de epoch/lifecycle de legendas passaram — tudo verde ✅');
