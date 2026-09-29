// tests/subtitle-words-tab.test.mjs — Issue #344: aba Palavras com lema,
// palavras-chave do vídeo, score honesto, tema claro e teclado.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  comprehensionSummary,
  extractVideoVocabulary,
  learnerKeywords,
  lemmaOf,
} from '../content/subtitles/video-vocabulary.js';
import { highlightTerms } from '../content/subtitles/transcript-render.js';

const rankMap = new Map([['run', 1], ['thing', 2], ['make', 3], ['new', 4], ['coffee', 900]]);

test('lema agrupa formas flexionadas e irregulares', () => {
  const lexicon = new Set(['run', 'thing', 'make', 'new', 'carry']);
  assert.equal(lemmaOf('running', lexicon), 'run');
  assert.equal(lemmaOf('ran', lexicon), 'run');
  assert.equal(lemmaOf('things', lexicon), 'thing');
  assert.equal(lemmaOf('making', lexicon), 'make');
  assert.equal(lemmaOf('carries', lexicon), 'carry');
  assert.equal(lemmaOf('news', lexicon), 'news', '"news" não vira "new"');
});

test('vocabulário conta por lema e ignora nomes próprios', () => {
  const cues = [
    { text: 'Sarah was running late again.' },
    { text: 'I told Sarah the coffee things.' },
    { text: 'Running is hard. Coffee helps with running.' },
  ];
  const vocab = extractVideoVocabulary(cues, { rankMap });
  assert.ok(!vocab.has('sarah'), 'nome próprio fora');
  assert.equal(vocab.get('run').count, 3);
  assert.deepEqual(vocab.get('run').forms, ['running']);
  assert.equal(vocab.get('coffee').count, 2, '"Coffee" no início da frase continua sendo palavra');
  assert.equal(vocab.get('thing').count, 1);
});

test('palavras-chave: não marcadas, mais frequentes no vídeo primeiro', () => {
  const cues = [{ text: 'coffee coffee coffee tea tea routine' }];
  const vocab = extractVideoVocabulary(cues, { rankMap });
  const keywords = learnerKeywords(vocab, new Set(['tea']), new Map(), 5).map((k) => k.lemma);
  assert.deepEqual(keywords, ['coffee', 'routine']);
  const withGrammar = extractVideoVocabulary([{ text: 'out out out coffee' }], { rankMap: new Map([['out', 47], ['coffee', 900]]) });
  assert.deepEqual(learnerKeywords(withGrammar, new Set(), new Map()).map((k) => k.lemma), ['coffee'], 'palavras gramaticais muito frequentes ficam fora');
});

test('score honesto: sem marcações não há dado; cobre só conhecidas/dominadas', () => {
  const vocab = extractVideoVocabulary([{ text: 'coffee coffee tea routine' }], { rankMap });
  assert.equal(comprehensionSummary(vocab, new Set(), new Map()).hasData, false);
  const summary = comprehensionSummary(vocab, new Set(['coffee']), new Map([['tea', 'learning']]));
  assert.equal(summary.hasData, true);
  assert.equal(summary.percent, 50);
  assert.equal(summary.counts.known, 1);
  assert.equal(summary.counts.learning, 1);
  assert.equal(summary.counts.unmarked, 1);
});

test('explorador destaca a forma encontrada, inclusive separada', () => {
  assert.equal(
    highlightTerms('So I looked it up.', ['looked it up']),
    'So I <mark class="lf-term-hit">looked it up</mark>.',
  );
  assert.equal(highlightTerms('Running, runner', ['running']), '<mark class="lf-term-hit">Running</mark>, runner');
  assert.equal(highlightTerms('<b>x</b>', []), '&lt;b&gt;x&lt;/b&gt;');
});

test('aba Palavras: tokens de tema, controles de teclado, sem scale no hover', async () => {
  const src = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
  const words = src.slice(src.indexOf('  _rebuildWordsList(container) {'), src.indexOf('  _showSentenceExplorer('));
  const explorer = src.slice(src.indexOf('  _showSentenceExplorer('), src.indexOf('  _updateSubtitlePanelHighlight('));
  assert.doesNotMatch(words, /scale\(1\.0[68]\)/);
  assert.doesNotMatch(explorer, /#0f172a/, 'explorador sem fundo escuro fixo');
  assert.doesNotMatch(words, /id="lf-stat-btn-/, 'estatísticas não são div clicável');
  assert.match(words, /learnerKeywords\(/);
  assert.match(words, /comprehensionSummary\(/);
  assert.doesNotMatch(words, /Fluente/, 'rótulo "Fluente" removido');
  assert.match(words, /aria-expanded/, 'faixas recolhíveis são botões com aria-expanded');
  assert.match(src, /#lf-subtitle-panel\.theme-light \.lf-words-card/);
});
