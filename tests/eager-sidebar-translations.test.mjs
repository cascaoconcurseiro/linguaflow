import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translator } from '../utils/translator.js';
import { SubtitleEngine } from '../content/subtitle-engine.js';

const originalTranslate = translator.translate.bind(translator);

try {
  let active = 0;
  let peak = 0;
  translator.translate = async (text) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return { translation: `pt:${text}`, source: 'test', cached: false };
  };

  const source = Array.from({ length: 23 }, (_, index) => `cue-${index}`);
  const batch = await translator.translateBatch(source, 'en', 'pt', 5);
  assert.equal(peak, 5, 'fila deve ocupar, sem exceder, a concorrência configurada');
  assert.deepEqual(batch.map((item) => item.translation), source.map((text) => `pt:${text}`));

  const rendered = new Map();
  globalThis.document = {
    querySelector(selector) {
      if (!rendered.has(selector)) rendered.set(selector, { textContent: '' });
      return rendered.get(selector);
    },
  };

  const controller = new AbortController();
  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, {
    _navigationEpoch: 3,
    _navigationController: controller,
    targetLang: 'pt',
    sourceLang: 'en',
    translationSpeed: 6,
    _sidebarTranslationPromise: null,
    _sidebarTranslationKey: '',
    _navigationSnapshot() { return { epoch: 3, url: 'https://www.youtube.com/watch?v=test', signal: controller.signal }; },
    _isNavigationCurrent(navigation) { return navigation.epoch === 3 && !navigation.signal.aborted; },
  });
  const cues = source.slice(0, 8).map((text, index) => ({ text, start: index, end: index + 1 }));
  await engine._translateAllSidebarCues(cues);
  assert.deepEqual(cues.map((cue) => cue.translatedText), source.slice(0, 8).map((text) => `pt:${text}`));
  assert.ok(cues.every((cue) => cue._transLang === 'pt'));

  const [engineSource, hookSource] = await Promise.all([
    readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../content/youtube-hook.js', import.meta.url), 'utf8'),
  ]);
  assert.match(engineSource, /if \(showTrans\) this\._translateAllSidebarCues\(cues\)/);
  assert.match(engineSource, /if \(cues\?\.length\) this\._translateAllSidebarCues\(cues\)/,
    'tradução deve começar assim que as cues chegam, mesmo antes de abrir o painel');
  assert.doesNotMatch(engineSource, /new IntersectionObserver/,
    'tradução da lista inteira não pode depender da posição da rolagem');
  assert.match(hookSource, /LF_PRELOAD_SUBTITLES/);
  assert.match(hookSource, /playerCaptionsTracklistRenderer\?\.captionTracks/);
  assert.match(hookSource, /searchParams\.delete\('tlang'\)[\s\S]*searchParams\.delete\('spv'\)[\s\S]*searchParams\.set\('fmt', 'json3'\)/);
  assert.doesNotMatch(hookSource, /LF_FETCH_ALL_CHUNKS|Promise\.allSettled/,
    'pré-carga deve buscar uma trilha completa, sem fan-out de blocos');
} finally {
  translator.translate = originalTranslate;
}

console.log('Trilha completa e tradução antecipada da barra lateral: contratos verdes.');
