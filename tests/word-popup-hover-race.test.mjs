import assert from 'node:assert/strict';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { WordPopup } from '../content/word-popup.js';

function createFakeSpan() {
  const listeners = new Map();
  return {
    isConnected: true,
    className: '',
    textContent: '',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.({
        pointerType: 'mouse',
        cancelable: true,
        preventDefault() {},
        stopPropagation() {},
        ...event,
      });
    },
    getBoundingClientRect() {
      return { left: 10, top: 20, width: 30, height: 15 };
    },
  };
}

globalThis.document = {
  createElement() {
    return createFakeSpan();
  },
};

const engine = Object.create(SubtitleEngine.prototype);
Object.assign(engine, {
  savedWords: new Map(),
  knownWords: new Set(),
  cefrColorsEnabled: false,
  cefrList: null,
  videoElement: { paused: true },
  lastText: 'A word in context.',
  _currentCue: { start: 1, end: 2 },
  _wordClass: () => '',
});

let popupOpenCount = 0;
engine.wordPopup = {
  showForWord() {
    popupOpenCount += 1;
  },
};

const span = engine._createWordSpan('word', false);
span.dispatch('pointerenter');
span.dispatch('click');
await new Promise((resolve) => setTimeout(resolve, 180));

assert.equal(
  popupOpenCount,
  1,
  'clicar durante o debounce do hover deve cancelar a abertura pendente',
);

let expansionCount = 0;
const popup = Object.create(WordPopup.prototype);
Object.assign(popup, {
  popup: { style: { display: 'block' } },
  _isHiding: false,
  _activeSourceKey: 'word\u0000A word in context.',
  _expandTermInContext: async () => {
    expansionCount += 1;
    return 'word';
  },
});

const nextRect = { left: 99 };
const nextCue = { start: 3, end: 4 };
await popup.showForWord('word', 'A word in context.', nextRect, nextCue);

assert.equal(expansionCount, 0, 'hover repetido da mesma origem não deve reiniciar a sessão');
assert.equal(popup._anchorRect, nextRect, 'a âncora acompanha a legenda recriada');
assert.equal(popup.currentCue, nextCue, 'a cue mais recente continua disponível para salvar');

let reopenExpansionCount = 0;
const hidingPopup = Object.create(WordPopup.prototype);
Object.assign(hidingPopup, {
  popup: { style: { display: 'block', opacity: '0', pointerEvents: 'none' } },
  _isHiding: true,
  _contextRequestId: 0,
  _activeSourceKey: 'word\u0000A word in context.',
  _expandTermInContext: async () => {
    reopenExpansionCount += 1;
    return 'word';
  },
});

await hidingPopup.showForWord('word', 'A word in context.', nextRect, nextCue).catch(() => {});
assert.equal(
  reopenExpansionCount,
  1,
  'a mesma palavra durante o fade-out precisa reabrir, não cair na deduplicação',
);

console.log('3 regressões de concorrência do hover do popup passaram ✅');
