// Prévia visual do roteiro do vídeo (barra lateral) sem YouTube nem extensão.
// Usa o SubtitleEngine real com falas fixas e APIs do Chrome simuladas.
globalThis.chrome = {
  runtime: { id: 'preview', sendMessage: (_msg, cb) => cb?.({}), onMessage: { addListener() {} } },
  storage: { local: { get: (_k, cb) => cb?.({}), set: (_v, cb) => cb?.() } },
};

const { SubtitleEngine } = await import('../../content/subtitle-engine.js');
const { translator } = await import('../../utils/translator.js');
translator.translateBatch = async (texts, _from, _to, _concurrency, onResult) =>
  texts.map((text, index) => {
    const result = { translation: `(pt) ${text}` };
    onResult?.(result, index);
    return result;
  });

const lines = [
  "Hey guys, welcome back to the channel.",
  "Today I'm gonna show you how I set up my morning routine.",
  "So I looked it up, and it turns out most people give up after a week.",
  "You know, it's kind of hard to get over the first few days.",
  "Turn the lights off before you go to bed.",
  "I drink tea every morning, no cap.",
  "We ran out of coffee, so I had to put up with tea.",
  "That's a piece of cake once you get the hang of it.",
];
const cues = lines.map((text, i) => ({ start: i * 4, end: i * 4 + 3.6, text }));

const engine = Object.create(SubtitleEngine.prototype);
Object.assign(engine, {
  cues,
  xhrCues: [],
  knownWords: new Set(['welcome', 'morning', 'coffee']),
  savedWords: new Map([['routine', 'learning'], ['bed', 'mature'], ['hard', 'review'], ['channel', 'new']]),
  uiTheme: 'dark',
  targetLang: 'pt',
  sourceLang: 'en',
  currentCueIndex: -1,
  videoElement: document.getElementById('video'),
  _navigationEpoch: 1,
  _navigationController: new AbortController(),
  _captionsPendingSince: Date.now(),
  wordPopup: {
    showForWord(word, sentence) {
      document.title = `popup: ${word}`;
      console.info('[preview] showForWord', word, '|', sentence);
    },
  },
});

document.getElementById('open').onclick = () => engine._createSubtitlePanel();
document.getElementById('theme').onclick = () => {
  engine.uiTheme = engine.uiTheme === 'dark' ? 'light' : 'dark';
  document.getElementById('lf-subtitle-panel-wrapper')?.remove();
  engine._createSubtitlePanel();
};
document.getElementById('empty').onclick = () => {
  engine.cues = [];
  engine._captionsPendingSince = Date.now();
  engine._rebuildSubtitleList();
};
window.__engine = engine;
engine._createSubtitlePanel();
