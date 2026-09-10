import assert from 'node:assert/strict';
import { SubtitleEngine } from '../content/subtitle-engine.js';

function bareEngine(url = 'https://www.youtube.com/watch?v=full-test') {
  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, {
    _disposed: false,
    _navigationController: null,
    _navigationEpoch: 0,
    _navigationUrl: '',
    _managedTimeouts: new Set(),
    _managedIntervals: new Set(),
    _hasFullYoutubeTrack: false,
    _fullTrackFetchKey: '',
    cues: [],
    xhrCues: [],
    sourceLang: 'en',
    targetLang: 'pt',
    usingXhr: false,
    _rebuildSubtitleList() {},
    _rebuildWordsList() {},
    _translateAllSidebarCues() { return Promise.resolve([]); },
  });
  globalThis.window = {
    location: {
      href: url,
      origin: 'https://www.youtube.com',
      search: new URL(url).search,
    },
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: (_key, cb) => {
          if (typeof cb === 'function') cb({});
          return Promise.resolve({});
        },
        set: (_val, cb) => {
          if (typeof cb === 'function') cb();
          return Promise.resolve();
        },
      },
    },
  };
  return engine;
}

// 1. Suporte a parser de XML clássico (<transcript>)
{
  const engine = bareEngine();
  const classicXml = `
    <transcript>
      <text start="0.5" dur="1.5">Welcome to the complete video</text>
      <text start="2.0" dur="3.0">Second line of dialogue</text>
      <text start="5.5" dur="2.5">End of the video transcript</text>
    </transcript>
  `;
  const cues = engine._parseYouTubeXml(classicXml);
  assert.equal(cues.length, 3, 'deve parsear as 3 frases do XML clássico');
  assert.equal(cues[0].start, 0.5);
  assert.equal(cues[0].end, 2.0);
  assert.equal(cues[0].text, 'Welcome to the complete video');
  assert.equal(cues[2].start, 5.5);
  assert.equal(cues[2].end, 8.0);
}

// 2. Suporte a parser de XML formato 3 (<timedtext><p t="..." d="...">)
{
  const engine = bareEngine();
  const format3Xml = `
    <?xml version="1.0" encoding="utf-8" ?>
    <timedtext format="3">
      <head/>
      <body>
        <p t="1000" d="2000">Line one in format 3</p>
        <p t="3500" d="1500">Line two in format 3</p>
      </body>
    </timedtext>
  `;
  const cues = engine._parseYouTubeXml(format3Xml);
  assert.equal(cues.length, 2, 'deve parsear as 2 frases do formato 3 XML');
  assert.equal(cues[0].start, 1.0);
  assert.equal(cues[0].end, 3.0);
  assert.equal(cues[0].text, 'Line one in format 3');
  assert.equal(cues[1].start, 3.5);
  assert.equal(cues[1].end, 5.0);
}

// 3. Ao receber segmento nativo inicial, busca a trilha completa e não fica restrito ao pedaço inicial
{
  const engine = bareEngine('https://www.youtube.com/watch?v=segment-test');
  const navigation = engine._beginNavigation('https://www.youtube.com/watch?v=segment-test');

  let fetchedUrl = '';
  globalThis.fetch = async (url) => {
    fetchedUrl = typeof url === 'string' ? url : url.toString();
    const fullTracks = {
      events: [
        { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Sentence 1 at 00:00' }] },
        { tStartMs: 2500, dDurationMs: 2000, segs: [{ utf8: 'Sentence 2 at 00:02' }] },
        { tStartMs: 5000, dDurationMs: 2000, segs: [{ utf8: 'Sentence 3 at 00:05' }] },
        { tStartMs: 120000, dDurationMs: 3000, segs: [{ utf8: 'Sentence at 02:00 end of video' }] },
      ],
    };
    return {
      ok: true,
      text: async () => JSON.stringify(fullTracks),
    };
  };

  // Simula recebimento de segmento inicial do player (spv=1, t=0) contendo apenas 1 frase
  const initialSegmentUrl = 'https://www.youtube.com/api/timedtext?v=segment-test&lang=en&spv=1&t=0&range=0-1000';
  const initialSegmentJson = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Sentence 1 at 00:00' }] },
    ],
  });

  await engine._processYouTubeRawSubtitles(initialSegmentUrl, initialSegmentJson, navigation);

  // Deve ter disparado a requisição da trilha completa sem spv, range, t
  assert.ok(fetchedUrl.includes('timedtext?v=segment-test'), 'deve buscar a trilha no endpoint do YouTube');
  assert.ok(!fetchedUrl.includes('spv='), 'não pode conter spv');
  assert.ok(!fetchedUrl.includes('range='), 'não pode conter range');
  assert.ok(!fetchedUrl.includes('t='), 'não pode conter t');

  // A lista de cues agora deve conter todas as 4 frases, incluindo o final do vídeo
  assert.equal(engine.cues.length, 4, 'todas as frases do vídeo completo devem estar carregadas');
  assert.equal(engine.cues[3].text, 'Sentence at 02:00 end of video');
  assert.equal(engine._hasFullYoutubeTrack, true);

  // Se outro segmento chegar depois (ex: reprodução avançando), ele não substitui a lista inteira por um bloco menor
  const midSegmentUrl = 'https://www.youtube.com/api/timedtext?v=segment-test&lang=en&spv=1&t=2500';
  const midSegmentJson = JSON.stringify({
    events: [
      { tStartMs: 2500, dDurationMs: 2000, segs: [{ utf8: 'Sentence 2 at 00:02' }] },
    ],
  });
  await engine._processYouTubeRawSubtitles(midSegmentUrl, midSegmentJson, navigation);
  assert.equal(engine.cues.length, 4, 'a lista completa não deve regredir com a chegada de novo segmento');
}

console.log('Testes de carregamento completo e antecipado de legendas: tudo verde ✅');
