// tests/subtitle-active-cue.test.mjs — Issue #342: uma única regra escolhe a
// fala ativa (tela e barra lateral) e a pausa automática usa o mesmo fim.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  effectiveCueEnd,
  findActiveCueIndex,
  crossedCueEnd,
  MAX_CUE_SECONDS,
} from '../content/subtitles/active-cue.js';
import { parseVTT } from '../content/subtitles/vtt-parser.js';

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('fim efetivo respeita o fim real de falas longas até o teto de segurança', () => {
  const longCue = { start: 10, end: 20, text: words(20) };
  assert.equal(effectiveCueEnd(longCue), 20, 'fala de 10 s com 20 palavras não pode sumir aos 8 s');
  const stuckCue = { start: 0, end: 60, text: 'Yeah' };
  assert.ok(effectiveCueEnd(stuckCue) < 10, 'cue curta presa em música/silêncio continua limitada');
  const hugeCue = { start: 0, end: 500, text: words(200) };
  assert.equal(effectiveCueEnd(hugeCue), MAX_CUE_SECONDS);
});

test('fala ativa por busca binária, sem varrer a lista inteira', () => {
  const cues = [
    { start: 0, end: 2, text: 'one' },
    { start: 2, end: 4, text: 'two' },
    { start: 4, end: 6, text: 'three' },
  ];
  assert.equal(findActiveCueIndex(cues, 3), 1);
  assert.equal(findActiveCueIndex(cues, 5.5), 2);
  assert.equal(findActiveCueIndex(cues, 10), -1);
  assert.equal(findActiveCueIndex([], 1), -1);
  assert.equal(findActiveCueIndex(cues, Number.NaN), -1);
});

test('sobreposição: vence a fala mais longa e, no empate, a mais recente (regra antiga)', () => {
  const cues = [
    { start: 0, end: 5, text: 'short' },
    { start: 1, end: 5, text: 'a much longer line' },
    { start: 2, end: 5, text: 'same size line xx' },
  ];
  assert.equal(findActiveCueIndex(cues, 3), 1);
  const tie = [
    { start: 0, end: 5, text: 'aaaa' },
    { start: 1, end: 5, text: 'bbbb' },
  ];
  assert.equal(findActiveCueIndex(tie, 2), 1);
});

test('pausa automática dispara ao cruzar o fim, mesmo quando o frame pula a janela', () => {
  const cue = { start: 10, end: 20, text: words(20) };
  assert.equal(crossedCueEnd(cue, 19.9, 19.96), true);
  assert.equal(crossedCueEnd(cue, 19.9, 20.3), true, 'a 2x o frame pode pular a janela de 50 ms');
  assert.equal(crossedCueEnd(cue, 12, 13), false);
  assert.equal(crossedCueEnd(cue, 5, 20.2), false, 'salto (seek) não conta como fim natural');
  assert.equal(crossedCueEnd(null, 1, 2), false);
});

test('motor usa a mesma regra na tela, na pausa e na barra lateral', async () => {
  const src = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
  assert.match(src, /findActiveCueIndex\(/);
  assert.match(src, /crossedCueEnd\(/);
  assert.doesNotMatch(src, /Math\.min\(8\.0/, 'teto de 8 s removido do sync loop');
  assert.doesNotMatch(src, /cue\.start > 100000/, 'sem heurística de unidade');
  const highlight = src.slice(src.indexOf('_updateSubtitlePanelHighlight(forceInstant'));
  assert.match(highlight.slice(0, 1500), /findActiveCueIndex\(/, 'barra lateral usa a mesma escolha da tela');
});

test('VTT preserva o fim real da fala (limite só na sincronia)', () => {
  const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:12.000', words(20), ''].join('\n');
  const [cue] = parseVTT(vtt);
  assert.equal(cue.start, 1);
  assert.equal(cue.end, 12);
});

test('Netflix: fala do DOM em segundos, fechada quando muda/some e sem duplicar', async () => {
  const { recordDomCue, closeDomCue } = await import('../content/subtitles/active-cue.js');
  const cues = [];
  recordDomCue(cues, 'Hello there', 10);
  recordDomCue(cues, 'How are you?', 12.5);
  assert.equal(cues[0].end, 12.5, 'fala anterior fecha quando o texto muda');
  closeDomCue(cues, 14);
  assert.equal(cues[1].end, 14, 'fala fecha quando a legenda some');
  recordDomCue(cues, 'Hello there', 10.2);
  assert.equal(cues.length, 2, 'voltar o vídeo não duplica a mesma fala');
  recordDomCue(cues, 'In between', 11);
  assert.deepEqual(cues.map((c) => c.start), [10, 11, 12.5], 'lista continua ordenada após voltar o vídeo');
  assert.ok(cues.every((c) => c.end - c.start < 60), 'sem fim a 8000 s');
});

test('botão de tradução rápida mantém o ícone e tem nome acessível; idioma do áudio alcançável', async () => {
  const src = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /translateBtn\.textContent = /, 'não troca o ícone SVG por texto');
  assert.match(src, /id="lf-translate-btn"[^>]*aria-label="Traduzir frase"/);
  assert.doesNotMatch(src, /listeningControls\.style\.cssText = 'display:none;'/, 'controle de idioma do áudio não pode ficar inalcançável');
  assert.match(src, /createElement\('details'\);\s*listeningControls\.id = 'lf-listening-controls'/);
});
