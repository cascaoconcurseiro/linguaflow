import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeMaxDockPlacement,
  computeMaxOverlayLayout,
  computeMaxPopupLayout,
  nextPlaybackRate,
  isMaxHost,
} from '../content/max-player-ui.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';

assert.equal(isMaxHost('play.max.com'), true);
assert.equal(isMaxHost('www.hbomax.com'), true);
assert.equal(isMaxHost('example.com'), false);

assert.equal(nextPlaybackRate(1), 1.25);
assert.equal(nextPlaybackRate(1.5), 0.75);
assert.equal(nextPlaybackRate(Number.NaN), 1);

assert.deepEqual(
  computeMaxDockPlacement({ viewportWidth: 1280, panelWidth: 420 }),
  { left: 'auto', right: 440, hidden: false },
  'dock fica fora do painel lateral quando há espaço',
);
assert.deepEqual(
  computeMaxDockPlacement({ viewportWidth: 420, panelWidth: 420 }),
  { left: 'auto', right: 20, hidden: true },
  'dock não cobre o painel quando ele ocupa a viewport',
);

const desktop = computeMaxOverlayLayout({
  viewportHeight: 720,
  controlsRect: { top: 620, width: 1280, height: 100 },
  progressRect: { top: 608, width: 1100, height: 8 },
  videoRect: { bottom: 720 },
});
assert.ok(desktop.dockBottom > 100, 'dock fica acima da timeline');
assert.equal(desktop.subtitleBottom, 137, 'posição vertical da legenda Max é estável');

const hiddenControls = computeMaxOverlayLayout({
  viewportHeight: 720,
  controlsRect: { top: 0, width: 0, height: 0 },
  videoRect: { bottom: 720 },
});
assert.ok(hiddenControls.dockBottom >= 64, 'fallback mantém dock fora da borda inferior');
assert.equal(hiddenControls.subtitleBottom, 137);

const compact = computeMaxOverlayLayout({
  viewportHeight: 480,
  controlsRect: { top: 410, width: 854, height: 70 },
  progressRect: { top: 402, width: 760, height: 6 },
  videoRect: { bottom: 480 },
});
assert.equal(compact.subtitleBottom, 137);

const popup = computeMaxPopupLayout({
  viewportWidth: 1280,
  subtitleTop: 510,
  popupWidth: 340,
  popupHeight: 360,
  anchorRect: { left: 900, width: 80 },
});
assert.ok(popup.left > 640, 'popup acompanha a palavra clicada');
assert.ok(popup.top + Math.min(360, popup.maxHeight) <= 510 - 16, 'popup não invade a legenda');

const tallPopup = computeMaxPopupLayout({
  viewportWidth: 390,
  subtitleTop: 280,
  popupWidth: 340,
  popupHeight: 700,
  anchorRect: { left: 350, width: 30 },
});
assert.equal(tallPopup.left, 40, 'popup é limitado à viewport móvel');
assert.equal(tallPopup.maxHeight, 252, 'popup alto usa scroll no espaço acima da legenda');
assert.ok(tallPopup.top + tallPopup.maxHeight <= 264);

const uiSource = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
for (const action of ['toggle', 'previous', 'loop', 'next', 'speed', 'panel', 'settings']) {
  assert.match(uiSource, new RegExp(`data-action=["']${action}["']`));
}
assert.doesNotMatch(uiSource, /data-action=["']repeat["']/);
assert.match(uiSource, /MutationObserver/);
assert.match(uiSource, /fullscreenchange/);
assert.match(uiSource, /toggleSubtitles\(this\.visible\)/);
assert.match(uiSource, /toggleSubtitlePanel\(\)/);
assert.match(uiSource, /toggleLoop\(\)/);
assert.match(uiSource, /playbackRate/);

const loopEngine = Object.create(SubtitleEngine.prototype);
let playCalls = 0;
Object.assign(loopEngine, {
  videoElement: {
    currentTime: 11,
    play: () => {
      playCalls += 1;
      return Promise.resolve();
    },
  },
  cues: [],
  xhrCues: [{ start: 10, end: 12, text: 'Context from Max' }],
  currentCueIndex: -1,
  _currentCue: { start: 10, end: 12, text: 'Context from Max' },
  isLooping: false,
  _managedIntervals: new Set(),
  _showNotification: () => {},
});
globalThis.document = { getElementById: () => null };
assert.equal(loopEngine.toggleLoop(), true, 'loop aceita a cue ativa capturada pela HBO/Max');
assert.equal(loopEngine.loopStartTime, 10);
assert.equal(loopEngine.loopEndTime, 12);
assert.equal(loopEngine.videoElement.currentTime, 10);
assert.equal(playCalls, 1);
assert.equal(loopEngine.toggleLoop(), false);

const popupSource = await readFile(new URL('../content/word-popup.js', import.meta.url), 'utf8');
assert.match(popupSource, /this\._anchorRect = rect \|\| null/);
assert.match(popupSource, /document\.fullscreenElement \|\| document\.body/);
assert.match(popupSource, /computeMaxPopupLayout/);
assert.match(popupSource, /ResizeObserver/);
assert.doesNotMatch(popupSource, /platform === 'max' && subtitleHost\?\.offsetParent/);

// Words tab on Max / HBO contracts
assert.equal(typeof SubtitleEngine.prototype._rebuildWordsList, 'function');

const mockContainer = {
  innerHTML: '',
  children: [],
  appendChild(child) {
    this.children.push(child);
    return child;
  },
};

const wordsEngine = Object.create(SubtitleEngine.prototype);
let subtitleTabClicked = false;
let videoPlayCalled = false;

Object.assign(wordsEngine, {
  xhrCues: [
    { start: 15, end: 18, text: 'Remember to stay calm and focus on learning.' },
    { start: 20, end: 25, text: 'This mysterious stranger arrived yesterday.' },
  ],
  cues: [],
  knownWords: new Set(['remember']),
  savedWords: new Map([['calm', 'learning']]),
  videoElement: {
    currentTime: 0,
    play() {
      videoPlayCalled = true;
      return Promise.resolve();
    },
  },
  _cleanSubtitleText: (t) => t,
});

globalThis.document = {
  getElementById(id) {
    if (id === 'lf-words-scroll') return mockContainer;
    if (id === 'lf-tab-subtitles') return { click() { subtitleTabClicked = true; } };
    return null;
  },
  createElement(tag) {
    const el = {
      tagName: tag,
      style: {},
      children: [],
      classList: new Set(),
      dataset: {},
      listeners: {},
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener(evt, fn) {
        this.listeners[evt] = fn;
      },
    };
    return el;
  },
};

wordsEngine._rebuildWordsList(mockContainer);
assert.ok(mockContainer.children.length > 0, 'Words tab deve conter elementos renderizados a partir de xhrCues');

// Contract: _debouncedRebuildPanels existe e funciona
assert.equal(typeof SubtitleEngine.prototype._debouncedRebuildPanels, 'function');

// Contract: hbo-inject.js inspeciona content-type para capturar VTT mesmo sem extensão explícita
const hboInjectSource = await readFile(new URL('../content/hbo-inject.js', import.meta.url), 'utf8');
assert.match(hboInjectSource, /contentType\.includes\('text\/vtt'\)/, 'hbo-inject deve verificar Content-Type text/vtt');

// Contract: subtitle-engine reparenta host para document.fullscreenElement no HBO Max
const engineSource = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
assert.match(engineSource, /targetRoot = document\.fullscreenElement \|\| document\.body/, 'subtitle-engine deve anexar host no targetRoot em fullscreen');
assert.match(engineSource, /existing\.translatedText = nc\.translatedText/, 'subtitle-engine não deve sobrescrever traduções existentes ao mesclar cues');

console.log('Max/HBO player UI contracts passed.');
