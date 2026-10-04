// Limpeza do texto da legenda e detecção de plataforma pelo host (CodeQL: substring de URL, dupla decodificação).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SubtitleEngine } from '../content/subtitle-engine.js';

const engine = Object.create(SubtitleEngine.prototype);

test('entidades HTML são decodificadas uma única vez', () => {
  assert.equal(engine._cleanSubtitleText('don&#39;t &amp; won&apos;t'), "don't & won't");
  assert.equal(engine._cleanSubtitleText('Tom &amp; Jerry'), 'Tom & Jerry');
  // "&amp;lt;" é o texto literal "&lt;", não o caractere "<": decodificar duas vezes seria erro.
  assert.equal(engine._cleanSubtitleText('use &amp;lt;b&amp;gt;'), 'use &lt;b&gt;');
});

test('a plataforma vem do host inteiro, não de um pedaço do endereço', () => {
  const detect = (hostname) => {
    globalThis.window = { location: { hostname } };
    return engine._detectPlatform();
  };
  try {
    assert.equal(detect('www.youtube.com'), 'youtube');
    assert.equal(detect('youtube.com'), 'youtube');
    assert.equal(detect('www.netflix.com'), 'netflix');
    assert.equal(detect('play.max.com'), 'max');
    assert.equal(detect('www.hbomax.com'), 'max');
    assert.equal(detect('www.disneyplus.com'), 'disney');
    assert.equal(detect('www.primevideo.com'), 'prime');
    assert.equal(detect('www.amazon.com'), 'prime');
    assert.equal(detect('notyoutube.com'), 'generic');
    assert.equal(detect('example.com'), 'generic');
  } finally {
    delete globalThis.window;
  }
});
