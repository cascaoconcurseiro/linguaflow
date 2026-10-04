// tests/subtitle-transcript-panel.test.mjs — Issue #343: roteiro não-modal,
// palavras clicáveis, busca com destaque, estados e desempenho do destaque.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  CAPTION_WAIT_MS,
  highlightMatches,
  segmentSubtitle,
  transcriptState,
} from '../content/subtitles/transcript-render.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { readEngineSource } from './helpers/engine-source.mjs';

const source = await readEngineSource();
const panelSource = source.slice(
  source.indexOf('  _createSubtitlePanel() {'),
  source.indexOf('  toggleSubtitlePanel('),
);
const listSource = source.slice(
  source.indexOf("  _rebuildSubtitleList(container, filter = '') {"),
  source.indexOf('  _translateAllSidebarCues(cues) {'),
);

test('segmentação agrupa expressões e preserva pontuação', () => {
  const segments = segmentSubtitle("So I looked it up, right?");
  assert.equal(segments.map((s) => s.text).join(''), "So I looked it up, right?");
  const expression = segments.find((s) => s.expression);
  assert.equal(expression.text, 'looked it up');
  assert.equal(expression.expression, 'look up');
  assert.ok(segments.filter((s) => s.isWord && !s.expression).some((s) => s.text === 'right'));
});

test('busca destaca ocorrências sem diferenciar caixa e escapa HTML', () => {
  assert.equal(
    highlightMatches('Go <b>go</b> GO', 'go'),
    '<mark class="lf-search-hit">Go</mark> &lt;b&gt;<mark class="lf-search-hit">go</mark>&lt;/b&gt; <mark class="lf-search-hit">GO</mark>',
  );
  assert.equal(highlightMatches('plain', ''), 'plain');
});

test('estado do roteiro distingue carregando de indisponível', () => {
  const now = 1_000_000;
  assert.equal(transcriptState({ cueCount: 3, pendingSince: now, now }), 'ready');
  assert.equal(transcriptState({ cueCount: 0, pendingSince: now - 1000, now }), 'loading');
  assert.equal(transcriptState({ cueCount: 0, pendingSince: now - CAPTION_WAIT_MS - 1, now }), 'unavailable');
  assert.equal(transcriptState({ cueCount: 0, pendingSince: undefined, now }), 'unavailable');
});

test('painel é não-modal: sem overlay, sem aria-modal, Esc só com foco no painel', () => {
  assert.doesNotMatch(panelSource, /aria-modal/);
  assert.doesNotMatch(panelSource, /backdrop-filter: blur/);
  assert.match(panelSource, /setAttribute\('role', 'complementary'\)/);
  assert.match(panelSource, /event\.key === 'Escape' && panel\.contains\(document\.activeElement\)/);
});

test('item do roteiro: frase legível, ações como botões irmãos, palavras clicáveis', () => {
  assert.doesNotMatch(listSource, /setAttribute\('role', 'button'\)/);
  assert.doesNotMatch(listSource, /Ouvir trecho a partir de/, 'aria-label não pode substituir a frase');
  assert.match(listSource, /<button type="button" class="lf-time lf-sub-time lf-play-cue" aria-label="Tocar a partir de/);
  assert.match(listSource, /_renderTranscriptText\(textEl, cleanText, normalizedFilter\)/);
  assert.match(listSource, /closest\?\.\('\.lf-word'\)/);
  assert.match(listSource, /state === 'loading'/);
  assert.match(listSource, /lf-skeleton-row/);
});

test('sem motion ornamental nem código morto no motor', () => {
  assert.doesNotMatch(source, /lf-loop-pulse/);
  assert.doesNotMatch(source, /transform: scale\(1\.02\)/);
  assert.doesNotMatch(source, /_prefetchTranslations/);
  assert.doesNotMatch(source, /_renderedNode/);
  assert.doesNotMatch(source, /onSubtitle triggered/);
});

test('destaque do roteiro só mexe no DOM quando a fala ativa muda', () => {
  let queries = 0;
  const makeItem = (index) => {
    const classes = new Set();
    return {
      dataset: { index: String(index) },
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
      setAttribute() {},
      removeAttribute() {},
    };
  };
  const items = [makeItem(0), makeItem(1)];
  const list = { querySelectorAll: () => { queries += 1; return items; } };
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => (id === 'lf-subtitle-list' ? list : null) };
  try {
    const engine = Object.create(SubtitleEngine.prototype);
    engine.cues = [{ start: 0, end: 2, text: 'one' }, { start: 2, end: 4, text: 'two' }];
    engine.xhrCues = [];
    engine.videoElement = { currentTime: 1 };
    engine.currentCueIndex = -1;
    engine._updateSubtitlePanelHighlight();
    engine._updateSubtitlePanelHighlight();
    engine._updateSubtitlePanelHighlight();
    assert.equal(queries, 1, 'mesma fala ativa não percorre a lista de novo');
    assert.ok(items[0].classList.contains('active'));
    engine.videoElement.currentTime = 3;
    engine._updateSubtitlePanelHighlight();
    assert.equal(queries, 2);
    assert.ok(items[1].classList.contains('active'));
    assert.ok(!items[0].classList.contains('active'));
  } finally {
    globalThis.document = previousDocument;
  }
});

test('vídeo confirmado sem legenda: roteiro sai do carregando na hora', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  let rebuilt = 0;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = { location: { href: 'https://www.youtube.com/watch?v=vid12' } };
  globalThis.document = { getElementById: (id) => (id === 'lf-subtitle-list' ? {} : null) };
  try {
    Object.assign(engine, {
      cues: [],
      sourceLang: 'en',
      _captionsPendingSince: Date.now(),
      _setCaptionNotice() {},
      _rebuildSubtitleList() { rebuilt += 1; },
    });
    engine._handleCaptionAvailability({ videoId: 'vid12', available: false });
    assert.equal(transcriptState({ cueCount: 0, pendingSince: engine._captionsPendingSince }), 'unavailable');
    assert.equal(rebuilt, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
