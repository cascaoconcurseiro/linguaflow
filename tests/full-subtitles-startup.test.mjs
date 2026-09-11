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

// 4. Em vídeo de 20+ minutos onde o player inicial entrega apenas os primeiros 13 minutos (~800s),
// o sistema busca automaticamente os blocos subsequentes até cobrir os 20+ minutos inteiros desde o início.
{
  const engine = bareEngine('https://www.youtube.com/watch?v=long-20min-test');
  const navigation = engine._beginNavigation('https://www.youtube.com/watch?v=long-20min-test');
  engine.videoElement = { duration: 1350 }; // 22.5 minutos

  const chunk1Url = 'https://www.youtube.com/api/timedtext?v=long-20min-test&lang=en&spv=1&t=0';
  const chunk1Json = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Start at 00:00' }] },
      { tStartMs: 400000, dDurationMs: 2000, segs: [{ utf8: 'Middle at 06:40' }] },
      { tStartMs: 798000, dDurationMs: 2000, segs: [{ utf8: 'Boundary at 13:18' }] },
    ],
  });

  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    const uStr = typeof url === 'string' ? url : url.toString();
    requestedUrls.push(uStr);
    const parsed = new URL(uStr);

    // Se for a tentativa de trilha limpa sem spv, simula rejeição 403 do YouTube em streaming ASR
    if (!parsed.searchParams.has('spv')) {
      return { ok: false, status: 403, text: async () => '' };
    }

    // Bloco 2 cobrindo os minutos 13.3 a 22.5
    const chunk2Events = {
      events: [
        { tStartMs: 800000, dDurationMs: 2000, segs: [{ utf8: 'Chunk 2 at 13:20' }] },
        { tStartMs: 1000000, dDurationMs: 2000, segs: [{ utf8: 'Chunk 2 at 16:40' }] },
        { tStartMs: 1345000, dDurationMs: 3000, segs: [{ utf8: 'Chunk 2 final sentence at 22:25' }] },
      ],
    };
    return {
      ok: true,
      text: async () => JSON.stringify(chunk2Events),
    };
  };

  await engine._processYouTubeRawSubtitles(chunk1Url, chunk1Json, navigation);

  assert.ok(requestedUrls.some((u) => u.includes('t=') && (u.includes('798') || u.includes('800'))),
    'deve requisitar o bloco subsequente a partir de ~13 minutos');
  assert.equal(engine.cues.length, 6, 'todas as 6 frases dos 22 minutos devem estar unificadas na lista');
  assert.equal(engine.cues[0].text, 'Start at 00:00');
  assert.equal(engine.cues[engine.cues.length - 1].text, 'Chunk 2 final sentence at 22:25');
  assert.equal(engine._hasFullYoutubeTrack, true);
}

// 5. Cenário real de produção: URL limpa (sem spv, sem t, sem range) vinda do preloadFullSubtitleTrack
// em vídeo longo de 25 minutos onde o YouTube encerra o primeiro payload em ~13.3 minutos (~800s).
// O motor NÃO pode marcar a trilha como completa prematuramente e DEVE requisitar os chunks restantes com spv=1.
{
  const engine = bareEngine('https://www.youtube.com/watch?v=prod-clean-25min');
  const navigation = engine._beginNavigation('https://www.youtube.com/watch?v=prod-clean-25min');
  engine.videoElement = { duration: 1500 }; // 25 minutos

  // URL 100% limpa (como enviado pelo preloadFullSubtitleTrack no YouTube real)
  const cleanInitialUrl = 'https://www.youtube.com/api/timedtext?v=prod-clean-25min&lang=en&fmt=json3';
  const chunk1Events = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'First phrase at 00:00' }] },
      { tStartMs: 500000, dDurationMs: 4000, segs: [{ utf8: 'Middle phrase at 08:20' }] },
      { tStartMs: 799000, dDurationMs: 2000, segs: [{ utf8: 'Cutoff phrase at 13:19' }] },
    ],
  });

  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    const uStr = typeof url === 'string' ? url : url.toString();
    requestedUrls.push(uStr);
    const parsed = new URL(uStr);

    // O YouTube rejeita chamadas de blocos subsequentes se faltar spv=1
    if (!parsed.searchParams.has('spv')) {
      return { ok: false, status: 403, text: async () => '' };
    }

    // Retorna bloco 2 cobrindo até os 25 minutos
    return {
      ok: true,
      text: async () => JSON.stringify({
        events: [
          { tStartMs: 801000, dDurationMs: 2500, segs: [{ utf8: 'Continuation at 13:21' }] },
          { tStartMs: 1200000, dDurationMs: 3000, segs: [{ utf8: 'Later phrase at 20:00' }] },
          { tStartMs: 1490000, dDurationMs: 4000, segs: [{ utf8: 'Final phrase at 24:50' }] },
        ],
      }),
    };
  };

  await engine._processYouTubeRawSubtitles(cleanInitialUrl, chunk1Events, navigation);

  assert.ok(requestedUrls.length > 0, 'deve ter realizado requisição para os chunks restantes');
  assert.ok(requestedUrls.some((u) => u.includes('spv=1')), 'deve incluir spv=1 na requisição dos blocos subsequentes');
  assert.equal(engine.cues.length, 6, 'todas as frases dos 25 minutos devem estar presentes desde o início');
  assert.equal(engine.cues[0].text, 'First phrase at 00:00');
  assert.equal(engine.cues[5].text, 'Final phrase at 24:50');
  assert.equal(engine._hasFullYoutubeTrack, true);
}

// 6. Suporte a payload do YouTube InnerTube get_transcript (100% das legendas em uma única chamada)
{
  const engine = bareEngine('https://www.youtube.com/watch?v=innertube-transcript');
  const navigation = engine._beginNavigation('https://www.youtube.com/watch?v=innertube-transcript');

  const transcriptPayload = JSON.stringify({
    actions: [
      {
        updateEngagementPanelAction: {
          content: {
            transcriptRenderer: {
              content: {
                transcriptSearchPanelRenderer: {
                  body: {
                    transcriptSegmentListRenderer: {
                      initialSegments: [
                        {
                          transcriptSegmentRenderer: {
                            startMs: '0',
                            endMs: '2500',
                            snippet: { runs: [{ text: 'InnerTube first cue' }] },
                            startTimeText: { simpleText: '0:00' },
                          },
                        },
                        {
                          transcriptSegmentRenderer: {
                            startMs: '900000',
                            endMs: '903000',
                            snippet: { runs: [{ text: 'InnerTube cue at 15:00' }] },
                            startTimeText: { simpleText: '15:00' },
                          },
                        },
                        {
                          transcriptSegmentRenderer: {
                            startMs: '1800000',
                            endMs: '1805000',
                            snippet: { runs: [{ text: 'InnerTube final cue at 30:00' }] },
                            startTimeText: { simpleText: '30:00' },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  });

  const transcriptUrl = 'https://www.youtube.com/youtubei/v1/get_transcript?v=innertube-transcript';
  await engine._processYouTubeRawSubtitles(transcriptUrl, transcriptPayload, navigation);

  assert.equal(engine.cues.length, 3, 'deve parsear perfeitamente todos os segmentos da API de transcrição');
  assert.equal(engine.cues[0].text, 'InnerTube first cue');
  assert.equal(engine.cues[0].start, 0);
  assert.equal(engine.cues[1].start, 900);
  assert.equal(engine.cues[2].text, 'InnerTube final cue at 30:00');
  assert.equal(engine.cues[2].start, 1800);
  assert.equal(engine._hasFullYoutubeTrack, true);
}

console.log('Testes de carregamento completo e antecipado de legendas: tudo verde ✅');
