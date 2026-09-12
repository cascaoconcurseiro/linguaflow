import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slangsDB } from '../utils/slangs-db.js';
import { expressionsDB, matchExpressionCandidate } from '../utils/expressions-db.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';

// Verify inflected phrasal verb matcher
const gaveUpMatch = matchExpressionCandidate(['gave', 'up']);
assert.ok(gaveUpMatch, 'matchExpressionCandidate must match "gave up"');
assert.equal(gaveUpMatch.canonical, 'give up');
assert.equal(gaveUpMatch.matched, 'gave up');

const gotOverMatch = matchExpressionCandidate(['got', 'over']);
assert.ok(gotOverMatch, 'matchExpressionCandidate must match "got over"');
assert.equal(gotOverMatch.canonical, 'get over');

const separableMatch = matchExpressionCandidate(['give', 'it', 'up']);
assert.ok(separableMatch, 'matchExpressionCandidate must match separable "give it up"');
assert.equal(separableMatch.canonical, 'give up');

// 1. Verify Slangs DB structure and sample keys
assert.ok(slangsDB instanceof Set, 'slangsDB must be a Set');
assert.ok(slangsDB.size >= 50, 'slangsDB must contain a solid dictionary of slangs');
assert.ok(slangsDB.has('no cap'), 'slangsDB contains "no cap"');
assert.ok(slangsDB.has('goat'), 'slangsDB contains "goat"');
assert.ok(slangsDB.has('slay'), 'slangsDB contains "slay"');

// 2. Verify SubtitleEngine source code contracts
const engineSource = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');

// Slangs and Expressions imports
assert.match(engineSource, /import\s*\{\s*slangsDB\s*\}\s*from\s*['"]\.\.\/utils\/slangs-db\.js['"]/);
assert.match(engineSource, /import\s*\{\s*expressionsDB\s*\}\s*from\s*['"]\.\.\/utils\/expressions-db\.js['"]/);

// Auto-scroll contract: currentCueIndex updated in onSubtitle
assert.match(engineSource, /this\.currentCueIndex\s*=\s*idx/, 'onSubtitle must update currentCueIndex to idx');

// Auto-scroll contract: _scrollSubtitleItemIntoView with programmatic scroll guard
assert.match(engineSource, /_scrollSubtitleItemIntoView/, 'Engine must implement _scrollSubtitleItemIntoView');
assert.match(engineSource, /_isProgrammaticScroll/, 'Engine must track programmatic scroll to avoid false userScrolling');

// Looping button contract: visual active state and sync
assert.match(engineSource, /_syncLoopButtons/, 'Engine must implement _syncLoopButtons');
assert.match(engineSource, /_toggleCueLoopByCue/, 'Engine must implement _toggleCueLoopByCue');
assert.match(engineSource, /_startPreciseLoopByCue/, 'Engine must implement _startPreciseLoopByCue for frame-accurate loop cutoff');
assert.match(engineSource, /\.is-looping/, 'Engine must style looping phrase items and cards with .is-looping');
assert.match(engineSource, /\.lf-se-loop-btn/, 'Loop sync must handle sentence explorer loop buttons');

// Words tab contracts: tabs for Words, Phrasal verbs, Slangs
assert.match(engineSource, /📚 Palavras/, 'Words pane must contain Palavras tab');
assert.match(engineSource, /⚡ Phrasal/, 'Words pane must contain Phrasal tab');
assert.match(engineSource, /🔥 Gírias/, 'Words pane must contain Gírias tab');

// Sentence explorer contracts
assert.match(engineSource, /_showSentenceExplorer/, 'Engine must implement _showSentenceExplorer');
assert.match(engineSource, /lf-sentence-explorer/, 'Engine must use lf-sentence-explorer sub-view');
assert.match(engineSource, /lf-se-export-pdf/, 'Sentence explorer must have PDF export button');
assert.match(engineSource, /lf-se-export-csv/, 'Sentence explorer must have CSV/Excel export button');
assert.match(engineSource, /lf-se-export-anki/, 'Sentence explorer must have Anki export button');

// Export parameterized cues contracts
assert.match(engineSource, /_exportPDF\s*\(\s*customCues\s*=\s*null,\s*customTitle\s*=\s*null\s*\)/);
assert.match(engineSource, /_exportCSV\s*\(\s*customCues\s*=\s*null,\s*customTitle\s*=\s*null\s*\)/);
assert.match(engineSource, /_exportAnki\s*\(\s*customCues\s*=\s*null,\s*customTitle\s*=\s*null\s*\)/);

// 3. Functional tests for Words, Phrasal Verbs, and Slangs detection
const testEngine = Object.create(SubtitleEngine.prototype);

const sampleCues = [
  { start: 0, end: 4, text: "Don't give up now, you got this! That's no cap.", translatedText: "Não desista agora, você consegue! Isso não é mentira." },
  { start: 5, end: 9, text: "He decided to give up smoking because he wants to be the goat.", translatedText: "Ele decidiu desistir de fumar porque quer ser o melhor." },
  { start: 10, end: 14, text: "She will slay this performance, honestly lowkey impressive.", translatedText: "Ela vai arrasar nessa apresentação, sinceramente meio impressionante." },
];

Object.assign(testEngine, {
  cues: sampleCues,
  xhrCues: [],
  knownWords: new Set(['now']),
  savedWords: new Map(),
  currentCueIndex: -1,
  _cleanSubtitleText: (t) => t,
  videoElement: {
    currentTime: 0,
    play: () => Promise.resolve(),
    pause: () => {},
  },
  _showNotification: () => {},
});

function createMockElement(tag = 'div') {
  const listeners = {};
  const children = [];
  const classes = new Set();
  let _html = '';
  const el = {
    tagName: tag,
    style: {},
    dataset: {},
    children,
    id: '',
    className: '',
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          classes.has(c) ? classes.delete(c) : classes.add(c);
        } else if (force) {
          classes.add(c);
        } else {
          classes.delete(c);
        }
      },
      contains: (c) => classes.has(c),
    },
    appendChild: (child) => {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    addEventListener: (evt, fn) => {
      listeners[evt] = fn;
    },
    querySelector: (sel) => {
      const cleanSel = sel.trim();
      for (const c of children) {
        if (cleanSel.startsWith('#') && c.id === cleanSel.slice(1)) return c;
        if (cleanSel.startsWith('.') && c.className && c.className.includes(cleanSel.slice(1))) return c;
        if (c.dataset && c.dataset.tab === cleanSel.replace(/\[data-tab=['"]|['"]\]/g, '')) return c;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const cleanSel = sel.trim();
      return children.filter((c) => {
        if (cleanSel.startsWith('#')) return c.id === cleanSel.slice(1);
        if (cleanSel.startsWith('.')) return c.className && c.className.includes(cleanSel.slice(1));
        return false;
      });
    },
    remove: () => {},
    get innerHTML() {
      return _html;
    },
    set innerHTML(val) {
      _html = val;
      const matches = val.matchAll(/<([a-z0-9]+)[^>]*\bid=["']([^"']+)["'][^>]*>/gi);
      for (const m of matches) {
        const child = createMockElement(m[1]);
        child.id = m[2];
        const classMatch = m[0].match(/\bclass=["']([^"']+)["']/i);
        if (classMatch) child.className = classMatch[1];
        children.push(child);
      }
    },
  };
  return el;
}

const mockDockBtn = createMockElement('button');
mockDockBtn.dataset = { action: 'loop' };
const mockSidebarLoopBtn = createMockElement('button');
mockSidebarLoopBtn.className = 'lf-loop-cue';
const mockParentItem = createMockElement('div');
mockParentItem.className = 'lf-subtitle-item';
mockParentItem.dataset = { index: '1' };
mockSidebarLoopBtn.closest = () => mockParentItem;

const mockSeLoopBtn = createMockElement('button');
mockSeLoopBtn.className = 'lf-se-loop-btn';
mockSeLoopBtn.dataset = { cueStart: String(sampleCues[1].start) };
const mockCard = createMockElement('div');
mockCard.className = 'lf-sentence-card';
mockSeLoopBtn.closest = () => mockCard;

const explorerContainer = createMockElement('div');
explorerContainer.id = 'lf-sentence-explorer';
const wordsScrollContainer = createMockElement('div');
wordsScrollContainer.id = 'lf-words-scroll';

globalThis.document = {
  createElement: (tag) => createMockElement(tag),
  createDocumentFragment: () => createMockElement('fragment'),
  createTextNode: (text) => ({ text }),
  getElementById: (id) => {
    if (id === 'lf-sentence-explorer') return explorerContainer;
    if (id === 'lf-words-scroll') return wordsScrollContainer;
    return null;
  },
  querySelector: () => null,
  querySelectorAll: (sel) => {
    if (sel === 'button[data-action="loop"]') return [mockDockBtn];
    if (sel === '.lf-loop-cue') return [mockSidebarLoopBtn];
    if (sel === '.lf-se-loop-btn') return [mockSeLoopBtn];
    return [];
  },
};

// Test onSubtitle updates currentCueIndex
testEngine.onSubtitle(sampleCues[1]);
assert.equal(testEngine.currentCueIndex, 1, 'onSubtitle must set currentCueIndex to index of current cue');

const mockContainer = createMockElement('div');
testEngine._rebuildWordsList(mockContainer);

// Check that mockContainer received children
assert.ok(mockContainer.children.length > 0, 'mockContainer must contain elements rendered by _rebuildWordsList');

// Verify Sentence Explorer invocation
let explorerTitle = '';
let exportedPdfCues = null;
let exportedCsvCues = null;
let exportedAnkiCues = null;

testEngine._exportPDF = async (cues, title) => {
  exportedPdfCues = cues;
  explorerTitle = title;
};
testEngine._exportCSV = (cues, title) => {
  exportedCsvCues = cues;
  explorerTitle = title;
};
testEngine._exportAnki = (cues, title) => {
  exportedAnkiCues = cues;
  explorerTitle = title;
};

// Test _showSentenceExplorer
const occurrences = [sampleCues[0], sampleCues[1]];
testEngine._showSentenceExplorer('give up', 'phrasal', occurrences);

assert.ok(explorerContainer.children.length > 0, 'explorerContainer must render sentence cards');

// Verify export clicks from sentence explorer header
const header = explorerContainer.children[0];
const pdfBtn = header.querySelector('#lf-se-export-pdf');
const csvBtn = header.querySelector('#lf-se-export-csv');
const ankiBtn = header.querySelector('#lf-se-export-anki');

if (pdfBtn && pdfBtn.onclick) pdfBtn.onclick();
assert.equal(exportedPdfCues, occurrences, 'PDF export must receive matching cues');

if (csvBtn && csvBtn.onclick) csvBtn.onclick();
assert.equal(exportedCsvCues, occurrences, 'CSV export must receive matching cues');

if (ankiBtn && ankiBtn.onclick) ankiBtn.onclick();
assert.equal(exportedAnkiCues, occurrences, 'Anki export must receive matching cues');

// Verify Loop button synchronization
// When looping is activated on cue 1
testEngine.isLooping = true;
testEngine.loopStartTime = sampleCues[1].start;
testEngine.loopEndTime = sampleCues[1].end;
testEngine._syncLoopButtons();

assert.ok(mockDockBtn.classList.contains('is-active'), 'Dock loop button must have is-active class');
assert.ok(mockSidebarLoopBtn.classList.contains('is-active'), 'Sidebar cue 1 loop button must have is-active class');
assert.ok(mockParentItem.classList.contains('is-looping'), 'Sidebar cue 1 parent item must have is-looping class');
assert.ok(mockSeLoopBtn.classList.contains('is-active'), 'Sentence explorer cue 1 loop button must have is-active class');
assert.ok(mockCard.classList.contains('is-looping'), 'Sentence explorer card must have is-looping class');

// When looping is deactivated
testEngine.isLooping = false;
testEngine.loopStartTime = null;
testEngine.loopEndTime = null;
testEngine._syncLoopButtons();

assert.ok(!mockDockBtn.classList.contains('is-active'), 'Dock loop button must not have is-active class when inactive');
assert.ok(!mockSidebarLoopBtn.classList.contains('is-active'), 'Sidebar loop button must not have is-active class when inactive');
assert.ok(!mockParentItem.classList.contains('is-looping'), 'Sidebar cue 1 parent item must not have is-looping class when inactive');
assert.ok(!mockSeLoopBtn.classList.contains('is-active'), 'Sentence explorer loop button must not have is-active class when inactive');
assert.ok(!mockCard.classList.contains('is-looping'), 'Sentence explorer card must not have is-looping class when inactive');

// Verify Auto-scroll contracts and instant centering
const mockList = createMockElement('div');
mockList.id = 'lf-subtitle-list';
mockList.offsetTop = 0;
mockList.clientHeight = 500;
mockList.scrollTop = 0;
mockList._userScrolling = false;

const mockAutoScrollToggle = createMockElement('input');
mockAutoScrollToggle.id = 'lf-autoscroll-panel';
mockAutoScrollToggle.checked = true;

const mockSubtitleItem0 = createMockElement('div');
mockSubtitleItem0.className = 'lf-subtitle-item';
mockSubtitleItem0.dataset = { index: '0' };
mockSubtitleItem0.offsetTop = 0;
mockSubtitleItem0.clientHeight = 60;

const mockSubtitleItem1 = createMockElement('div');
mockSubtitleItem1.className = 'lf-subtitle-item';
mockSubtitleItem1.dataset = { index: '1' };
mockSubtitleItem1.offsetTop = 300;
mockSubtitleItem1.clientHeight = 60;

mockList.children.push(mockSubtitleItem0, mockSubtitleItem1);

const origGetElementById = globalThis.document.getElementById;
globalThis.document.getElementById = (id) => {
  if (id === 'lf-subtitle-list') return mockList;
  if (id === 'lf-autoscroll-panel') return mockAutoScrollToggle;
  return origGetElementById(id);
};

// Simulate videoElement playing at cue 1 time
testEngine.videoElement = { currentTime: sampleCues[1].start + 0.1, play: () => {} };
testEngine.currentCueIndex = -1;

testEngine._updateSubtitlePanelHighlight(true);
assert.equal(testEngine.currentCueIndex, 1, 'Highlight sync must compute active cue index from videoElement.currentTime');
assert.ok(mockSubtitleItem1.classList.contains('active'), 'Matching subtitle item must be marked active');
assert.ok(mockList.scrollTop > 0, 'Instant scroll must center the active cue in the list');

globalThis.document.getElementById = origGetElementById;

console.log('All words explorer, slangs, phrasal verbs, auto-scroll and loop contracts passed successfully!');
process.exit(0);
