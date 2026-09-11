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

// 7. HBO Max: Master Playlist M3U8 é interceptada, resolve playlist de legenda e busca 100% dos segmentos
{
  const engine = bareEngine('https://play.max.com/video/watch/episode-1');
  engine.platform = 'max';
  const navigation = engine._beginNavigation('https://play.max.com/video/watch/episode-1');

  const masterPlaylistText = `
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="en",URI="sub_en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=800000,SUBTITLES="subs"
video_800k.m3u8
  `.trim();

  const subPlaylistText = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
seg_000.vtt
#EXTINF:6.000,
seg_001.vtt
#EXTINF:6.000,
seg_002.vtt
#EXT-X-ENDLIST
  `.trim();

  const vttSegmentResponses = {
    'https://play.max.com/video/watch/seg_000.vtt': 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nWelcome to HBO Max full video',
    'https://play.max.com/video/watch/seg_001.vtt': 'WEBVTT\n\n00:00:07.000 --> 00:00:09.500\nMiddle of episode dialogue at 7s',
    'https://play.max.com/video/watch/seg_002.vtt': 'WEBVTT\n\n00:22:00.000 --> 00:22:05.000\nFinal scene of 22-minute episode on Max',
  };

  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s === 'https://play.max.com/video/watch/sub_en.m3u8') {
      return { ok: true, text: async () => subPlaylistText };
    }
    if (vttSegmentResponses[s]) {
      return { ok: true, text: async () => vttSegmentResponses[s] };
    }
    return { ok: false, status: 404, text: async () => '' };
  };

  await engine._processHboM3u8Playlist('https://play.max.com/video/watch/master.m3u8', masterPlaylistText, navigation);

  assert.equal(engine._hasFullHboTrack, true, 'deve marcar _hasFullHboTrack como true');
  assert.equal(engine.xhrCues.length, 3, 'deve conter todas as frases da trilha inteira');
  assert.equal(engine.cues.length, 3);
  assert.equal(engine.cues[0].text, 'Welcome to HBO Max full video');
  assert.equal(engine.cues[2].text, 'Final scene of 22-minute episode on Max');
  assert.equal(engine.cues[2].start, 1320); // 22:00
}

// 8. HBO Max: Recebe apenas o segmento inicial do player (que cobre só os primeiros minutos),
// deduz a sequência e busca todos os segmentos até o final de um vídeo de 20+ minutos
{
  const engine = bareEngine('https://play.max.com/video/watch/long-movie');
  engine.platform = 'max';
  engine.videoElement = { duration: 1260 }; // 21 minutos
  const navigation = engine._beginNavigation('https://play.max.com/video/watch/long-movie');

  // Simula 4 segmentos gerados sequencialmente cobrindo 0 a 21 minutos
  const mockSegs = {
    'https://cdn.max.com/sub/segment_00000.vtt': 'WEBVTT\n\n00:00:00.500 --> 00:00:03.000\nHBO startup sentence at 0m',
    'https://cdn.max.com/sub/segment_00001.vtt': 'WEBVTT\n\n00:00:06.000 --> 00:00:09.000\nSentence at 6s',
    'https://cdn.max.com/sub/segment_00130.vtt': 'WEBVTT\n\n00:13:00.000 --> 00:13:04.000\nSentence at 13m where native player usually paused requests',
    'https://cdn.max.com/sub/segment_00200.vtt': 'WEBVTT\n\n00:20:30.000 --> 00:20:35.000\nFinal sentence at 20m30s of 21-min video',
  };

  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.endsWith('.m3u8')) {
      return { ok: false, status: 404, text: async () => '' };
    }
    if (mockSegs[s]) {
      return { ok: true, text: async () => mockSegs[s] };
    }
    // Segmentos intermediários vazios ou não encontrados
    return { ok: false, status: 404, text: async () => '' };
  };

  const initialCues = [{ start: 0.5, end: 3.0, text: 'HBO startup sentence at 0m' }];
  await engine._scheduleHboRemainingSegments('https://cdn.max.com/sub/segment_00000.vtt', initialCues, navigation);

  assert.equal(engine._hasFullHboTrack, true, 'deve marcar a trilha como 100% completa');
  assert.ok(engine.xhrCues.length >= 3, 'deve carregar segmentos além do minuto 13');
  const hasPast13Min = engine.xhrCues.some((c) => c.start >= 1200);
  assert.equal(hasPast13Min, true, 'deve conter legendas do minuto 20');
}

// 9. HBO Max: Extração de TextTracks do elemento <video> como fallback de segurança
{
  const engine = bareEngine('https://play.max.com/video/watch/tracks-test');
  engine.platform = 'max';
  engine.videoElement = {
    textTracks: [
      {
        kind: 'subtitles',
        cues: [
          { startTime: 2.0, endTime: 5.0, text: 'Fallback TextTrack cue 1' },
          { startTime: 1200.0, endTime: 1204.0, text: 'Fallback TextTrack cue at 20m' },
        ],
      },
    ],
  };

  const extracted = engine._extractCuesFromTextTracks();
  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].text, 'Fallback TextTrack cue 1');
  assert.equal(extracted[1].start, 1200);

  // Testa integração no _rebuildSubtitleList
  globalThis.document = { getElementById: () => null };
  engine.xhrCues = [];
  engine.cues = [];
  SubtitleEngine.prototype._rebuildSubtitleList.call(engine);
  assert.equal(engine.cues.length, 2, '_rebuildSubtitleList deve preencher cues a partir de TextTracks no Max');
}

console.log('Testes de carregamento completo e antecipado de legendas: tudo verde ✅');
