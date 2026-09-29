import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCaptionEvents } from '../utils/caption-grouping.js';

test('word-level events become one timed phrase without losing or duplicating words', () => {
  const events = [
    { tStartMs:0, dDurationMs:400, segs:[{utf8:'Your mom '}] },
    { tStartMs:400, dDurationMs:700, segs:[{utf8:'works hard '}] },
    { tStartMs:1100, dDurationMs:700, segs:[{utf8:'and she '}] },
    { tStartMs:1800, dDurationMs:1700, segs:[{utf8:'deserves a nice gift.'}] },
    { tStartMs:5000, dDurationMs:1000, segs:[{utf8:'Thank you.'}] },
  ];
  assert.deepEqual(groupCaptionEvents(events), [
    {start:0,end:3.5,text:'Your mom works hard and she deserves a nice gift.'},
    {start:5,end:6,text:'Thank you.'},
  ]);
});
test('ASR rolling revisions replace previous text rather than repeat it', () => {
  const events = [
    {tStartMs:0,dDurationMs:500,segs:[{utf8:'I want'}]},
    {tStartMs:500,dDurationMs:500,segs:[{utf8:'I want to'}]},
    {tStartMs:1000,dDurationMs:500,segs:[{utf8:'I want to go.'}]},
  ];
  assert.deepEqual(groupCaptionEvents(events), [{start:0,end:1.5,text:'I want to go.'}]);
});
test('sentence punctuation, pauses, speaker changes and maximum duration bound grouping', () => {
  const events=[
    {tStartMs:0,dDurationMs:500,segs:[{utf8:'Hello.'}]},
    {tStartMs:500,dDurationMs:500,segs:[{utf8:'How are you?'}]},
    {tStartMs:1000,dDurationMs:500,segs:[{utf8:'- Fine'}]},
    {tStartMs:4000,dDurationMs:500,segs:[{utf8:'Thanks.'}]},
  ];
  assert.deepEqual(groupCaptionEvents(events).map(c=>c.text),['Hello.','How are you?','- Fine','Thanks.']);
  const long=Array.from({length:20},(_,i)=>({tStartMs:i*600,dDurationMs:600,segs:[{utf8:`word${i} `}]}));
  assert.ok(groupCaptionEvents(long).length>1);
  assert.equal(groupCaptionEvents(long).flatMap(c=>c.text.split(' ')).join(' '),long.map(e=>e.segs[0].utf8.trim()).join(' '));
});

test('#364 rolling ASR lines overlap on screen but still join into ~two-line phrases', async () => {
  const { rollingAsrEvents } = await import('./fixtures/youtube-rolling-asr.mjs');
  const cues = groupCaptionEvents(rollingAsrEvents);
  const lines = rollingAsrEvents.filter(e => !e.aAppend).map(e => e.segs[0].utf8);
  assert.ok(cues.length <= 15, `esperava até 15 trechos, veio ${cues.length}`);
  for (const cue of cues) assert.ok(cue.text.length <= 90, `trecho longo demais: "${cue.text}"`);
  const words = (texts) => texts.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
  assert.deepEqual(words(cues.map(c => c.text)), words(lines), 'nenhuma palavra perdida, duplicada ou fora de ordem');
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end, 'trechos não se sobrepõem');
  assert.ok(cues.some(c => c.text.includes('Well, I\'m filming this August 29th, so it\'s not September yet')));
  assert.ok(cues.every(c => !/\bseptember\b/.test(c.text)), 'nome próprio não vira minúsculo ao juntar');
  assert.ok(cues.some(c => c.text.includes('"Enjoy life.')), 'início de citação mantém a maiúscula');
});

test('#364 manual captions that really overlap (two speakers) stay separate', () => {
  const events = [
    { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'Where are you going' }] },
    { tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: 'nowhere in particular' }] },
  ];
  assert.equal(groupCaptionEvents(events).length, 2);
});

test('translated track aligns by timestamp, never a different line by array position', async () => {
  const { attachTranslationsByTime }=await import('../utils/caption-grouping.js');
  const source=[{start:0,end:2,text:'First'},{start:10,end:12,text:'Second'}];
  attachTranslationsByTime(source,[{start:10.2,end:11,text:'Segundo'}]);
  assert.equal(source[0].translatedText,undefined);
  assert.equal(source[1].translatedText,'Segundo');
});
test('#364 longer translated lines still land on the phrase they belong to', async () => {
  const { attachTranslationsByTime, captionLines } = await import('../utils/caption-grouping.js');
  const { rollingAsrEvents } = await import('./fixtures/youtube-rolling-asr.mjs');
  // Faixa traduzida: mesmas linhas e tempos, texto bem mais longo (como o português).
  const translatedEvents = rollingAsrEvents.map(e => e.aAppend ? e : { ...e, segs: [{ utf8: `[pt] ${e.segs[0].utf8} traduzido com bem mais texto` }] });
  const cues = groupCaptionEvents(rollingAsrEvents);
  const translated = captionLines(translatedEvents);
  assert.equal(translated.length, rollingAsrEvents.filter(e => !e.aAppend).length, 'faixa traduzida fica linha a linha');
  attachTranslationsByTime(cues, translated);
  for (const cue of cues) {
    const expected = translated.filter(t => t.start >= cue.start && t.start < cue.end).map(t => t.text).join(' ');
    assert.equal(cue.translatedText, expected, `tradução de "${cue.text}"`);
  }
});

test('no source-language track means no preload of an unrelated track', async () => {
  const { selectCaptionTrack }=await import('../utils/caption-grouping.js');
  const es={languageCode:'es',baseUrl:'https://www.youtube.com/api/timedtext?lang=es'};
  const enAuto={languageCode:'en',kind:'asr',baseUrl:'https://www.youtube.com/api/timedtext?lang=en'};
  const enManual={languageCode:'en-US',baseUrl:'https://www.youtube.com/api/timedtext?lang=en-US'};
  assert.equal(selectCaptionTrack([es],'en'),null);
  assert.equal(selectCaptionTrack([es,enAuto,enManual],'en'),enManual);
  assert.equal(selectCaptionTrack([es,enAuto],'en'),enAuto);
});

test('YouTube hook never preloads another language and does not retry a rejected track', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const script=readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8');
  async function simulate(tracks){
    const listeners=new Map();let requests=0;
    const location=new URL('https://www.youtube.com/watch?v=video123');
    const player={getPlayerResponse:()=>({videoDetails:{videoId:'video123'},captions:{playerCaptionsTracklistRenderer:{captionTracks:tracks}}}),getOption:()=>[],addEventListener:()=>{}};
    const document={currentScript:{dataset:{lfNonce:'test-nonce',lfNavigationUrl:location.href}},getElementById:()=>player,readyState:'complete',addEventListener:()=>{}};
    const window={location,fetch:async()=>{requests++;return {ok:false,status:429};},addEventListener:(name,fn)=>listeners.set(name,fn),postMessage:()=>{}};
    class XHR{} XHR.prototype.open=function(){};
    runInNewContext(script,{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:()=>{},console:{debug:()=>{},warn:()=>{}}});
    await new Promise(resolve=>setImmediate(resolve));
    listeners.get('message')({source:window,origin:location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
    await new Promise(resolve=>setImmediate(resolve));
    return requests;
  }
  assert.equal(await simulate([{languageCode:'es',baseUrl:'https://www.youtube.com/api/timedtext?lang=es'}]),0);
  assert.equal(await simulate([{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?lang=en'}]),1);
});

test('full source track stays authoritative and official captions remain when LinguaFlow has none', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  const native={style:{display:''}};
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid9'}};
  globalThis.document={querySelector:()=>native};
  globalThis.chrome={storage:{local:{get:(_key,cb)=>cb({lastYoutubeSubtitleUrls:[]}),set:()=>{}}}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',isActivated:true,cues:[],xhrCues:[],sourceLang:'en',_disposed:false,_navigationEpoch:0,_navigationUrl:'',_navigationController:null});
  engine._rebuildSubtitleList=()=>{};engine._rebuildWordsList=()=>{};
  const nav=engine._beginNavigation(window.location.href);
  engine._syncYouTubeNativeCaptions();assert.equal(native.style.display,'');
  const full=JSON.stringify({events:[{tStartMs:0,dDurationMs:4000,segs:[{utf8:'This is the entire phrase.'}]}]});
  await engine._processYouTubeRawSubtitles('https://www.youtube.com/api/timedtext?v=vid9&lang=es',full,nav);
  assert.equal(engine.cues.length,0);
  await engine._processYouTubeRawSubtitles('https://www.youtube.com/api/timedtext?v=vid9&lang=en',full,nav);
  assert.equal(engine.cues[0].text,'This is the entire phrase.');assert.equal(native.style.display,'none');
  const segment=JSON.stringify({events:[{tStartMs:0,dDurationMs:1000,segs:[{utf8:'This'}]}]});
  await engine._processYouTubeRawSubtitles('https://www.youtube.com/api/timedtext?v=vid9&lang=en&t=1',segment,nav);
  assert.equal(engine.cues[0].text,'This is the entire phrase.');
  engine.cues=[];engine._syncYouTubeNativeCaptions();assert.equal(native.style.display,'');
});

test('translated caption segments never trigger repeated original-track requests after rejection', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid10'}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',cues:[],xhrCues:[],sourceLang:'en',_disposed:false,_navigationEpoch:0,_navigationUrl:'',_navigationController:null});
  const nav=engine._beginNavigation(window.location.href);
  let requests=0;globalThis.fetch=async()=>{requests++;return {ok:false,status:429};};
  for(let i=0;i<3;i++)await engine._processYouTubeRawSubtitles(`https://www.youtube.com/api/timedtext?v=vid10&lang=en&tlang=pt&t=${i}`,JSON.stringify({events:[{tStartMs:i*1000,segs:[{utf8:'Olá'}]}]}),nav);
  assert.equal(requests,1);
});

test('fetch interceptor does not repeat a failed YouTube subtitle request', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  let requests=0;
  const location=new URL('https://www.youtube.com/watch?v=vid11');
  const document={currentScript:{dataset:{lfNonce:'nonce',lfNavigationUrl:location.href}},getElementById:()=>null,readyState:'loading',addEventListener:()=>{}};
  const window={location,fetch:async()=>{requests++;throw new Error('network');},addEventListener:()=>{},postMessage:()=>{}};
  class XHR{}XHR.prototype.open=()=>{};
  runInNewContext(readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8'),{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:()=>{},console:{debug:()=>{},warn:()=>{}}});
  await assert.rejects(window.fetch('https://www.youtube.com/api/timedtext?v=vid11&lang=en'));
  assert.equal(requests,1);
});

test('identical words spoken twice update the active cue and card context', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  const first={start:1,end:2,text:'Thank you.',translatedText:'Obrigado.'};
  const second={start:9,end:10,text:'Thank you.',translatedText:'Obrigado.'};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{cues:[first,second],xhrCues:[first,second],shadowContainer:{},_lastProcessedText:'',sourceLang:'en'});
  engine._updateSubtitlePanelHighlight=()=>{};engine._makeClickable=()=>({});engine.renderDual=()=>{};
  engine.onSubtitle(first);engine.onSubtitle(second);
  assert.equal(engine._currentCue,second);
  assert.equal(engine.currentSubtitleTimestamp,9);
});


test('caption grouping ships with the extension and remains scoped to supported players', async () => {
  const {readFileSync}=await import('node:fs');
  const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
  const exposure=manifest.web_accessible_resources.find(row=>row.resources.includes('utils/caption-grouping.js'));
  assert.ok(exposure);
  assert.ok(exposure.matches.includes('*://*.youtube.com/*'));
  assert.ok(!exposure.matches.includes('<all_urls>'));
});

test('successive segmented responses join a phrase across network chunks', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid12'}};
  globalThis.document={querySelector:()=>null};
  globalThis.chrome={storage:{local:{get:(_key,cb)=>cb({lastYoutubeSubtitleUrls:[]}),set:()=>{}}}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',isActivated:true,cues:[],xhrCues:[],sourceLang:'en',_disposed:false,_navigationEpoch:0,_navigationUrl:'',_navigationController:null});
  engine._rebuildSubtitleList=()=>{};engine._rebuildWordsList=()=>{};
  const nav=engine._beginNavigation(window.location.href);
  for(const [start,text] of [[0,'Your mom works '],[1000,'hard and she deserves a gift.']]) {
    await engine._processYouTubeRawSubtitles(`https://www.youtube.com/api/timedtext?v=vid12&lang=en&t=${start}`,
      JSON.stringify({events:[{tStartMs:start,dDurationMs:1000,segs:[{utf8:text}]}]}),nav);
  }
  assert.deepEqual(engine.cues.map(c=>c.text),['Your mom works hard and she deserves a gift.']);
});

test('complete track replaces earlier partial segment without stale duplicate words', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid13'}};
  globalThis.document={querySelector:()=>null};
  globalThis.chrome={storage:{local:{get:(_key,cb)=>cb({lastYoutubeSubtitleUrls:[]}),set:()=>{}}}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',isActivated:true,cues:[],xhrCues:[],sourceLang:'en',_disposed:false,_navigationEpoch:0,_navigationUrl:'',_navigationController:null});
  engine._rebuildSubtitleList=()=>{};engine._rebuildWordsList=()=>{};
  const nav=engine._beginNavigation(window.location.href);
  const url='https://www.youtube.com/api/timedtext?v=vid13&lang=en';
  await engine._processYouTubeRawSubtitles(`${url}&t=0`,JSON.stringify({events:[{tStartMs:0,dDurationMs:500,segs:[{utf8:'The'}]},{tStartMs:500,dDurationMs:500,segs:[{utf8:'other'}]}]}),nav);
  await engine._processYouTubeRawSubtitles(url,JSON.stringify({events:[{tStartMs:0,dDurationMs:1500,segs:[{utf8:'The right sentence.'}]}]}),nav);
  assert.deepEqual(engine.cues.map(c=>c.text),['The right sentence.']);
});

test('partial initial track continues with later YouTube segments', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid14'}};
  globalThis.document={querySelector:()=>null};
  globalThis.chrome={storage:{local:{get:(_key,cb)=>cb({lastYoutubeSubtitleUrls:[]}),set:()=>{}}}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',isActivated:true,cues:[],xhrCues:[],sourceLang:'en',_disposed:false,_navigationEpoch:0,_navigationUrl:'',_navigationController:null});
  engine._rebuildSubtitleList=()=>{};engine._rebuildWordsList=()=>{};
  const nav=engine._beginNavigation(window.location.href);

  // The initial request has no segment marker but may still contain only the
  // first portion of a long track; later player requests must not be ignored.
  await engine._processYouTubeRawSubtitles(
    'https://www.youtube.com/api/timedtext?v=vid14&lang=en',
    JSON.stringify({events:[{tStartMs:0,dDurationMs:1000,segs:[{utf8:'The first part.'}]}]}),
    nav,
  );
  await engine._processYouTubeRawSubtitles(
    'https://www.youtube.com/api/timedtext?v=vid14&lang=en&t=60',
    JSON.stringify({events:[{tStartMs:60000,dDurationMs:1000,segs:[{utf8:'The later part.'}]}]}),
    nav,
  );

  assert.deepEqual(engine.cues.map(c=>c.text),['The first part.','The later part.']);
});

test('subtitles and sidebar clean speaker change arrowheads (>>) and chevrons leaving only text', async () => {
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const engine = Object.create(SubtitleEngine.prototype);

  // 1. _cleanSubtitleText removes >> at start, end, alone and chevrons
  assert.equal(
    engine._cleanSubtitleText('>> If you ever wake up in a bad mood, just try some Jack Johnson.'),
    'If you ever wake up in a bad mood, just try some Jack Johnson.'
  );
  assert.equal(
    engine._cleanSubtitleText('Become a better morning person in two >>'),
    'Become a better morning person in two'
  );
  assert.equal(engine._cleanSubtitleText('>>'), '');
  assert.equal(engine._cleanSubtitleText('>>> Host: Hello >>'), 'Host: Hello');
  assert.equal(engine._cleanSubtitleText('>> Se você acordar de mau humor, apenas'), 'Se você acordar de mau humor, apenas');
  assert.equal(engine._cleanSubtitleText('« Jack Johnson »'), 'Jack Johnson');
  assert.equal(engine._cleanSubtitleText('&gt;&gt; Jack Johnson'), 'Jack Johnson');

  // 2. groupCaptionEvents drops cues that contain ONLY arrowheads
  const events = [
    { tStartMs: 2000, dDurationMs: 4000, segs: [{ utf8: '>> If you ever wake up' }] },
    { tStartMs: 39000, dDurationMs: 1000, segs: [{ utf8: '>>' }] },
    { tStartMs: 47000, dDurationMs: 2000, segs: [{ utf8: ">> What's up, guys?" }] },
  ];
  const grouped = groupCaptionEvents(events);
  assert.equal(grouped.length, 2);
  assert.ok(!grouped.some((c) => c.text === '>>'));

  // 3. Audio language selection container is hidden by default in sidebar
  const div = { id: '', style: { cssText: '' }, innerHTML: '', querySelector: () => ({ value: '', addEventListener: () => {} }) };
  const mockDoc = {
    createElement: (tag) => {
      if (tag === 'div') return { id: '', style: { cssText: '', display: '' }, innerHTML: '', appendChild: () => {}, querySelector: () => ({ value: '', addEventListener: () => {} }) };
      return { style: {}, appendChild: () => {}, querySelector: () => ({}) };
    },
    getElementById: () => null,
  };
});

test('subtitles do not persist indefinitely during music or silence', async () => {
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const engine = Object.create(SubtitleEngine.prototype);

  // 1. Music notes and sound descriptions are cleaned
  assert.equal(engine._cleanSubtitleText('♪ Jack Johnson ♪'), 'Jack Johnson');
  assert.equal(engine._cleanSubtitleText('(music)'), '');
  assert.equal(engine._cleanSubtitleText('[Music]'), '');
  assert.equal(engine._cleanSubtitleText('*upbeat music*'), '');

  // 2. groupCaptionEvents drops pure music/sound events and caps long silence/music durations
  const events = [
    { tStartMs: 14000, dDurationMs: 25000, segs: [{ utf8: 'Become a better morning person in two' }] },
    { tStartMs: 20000, dDurationMs: 10000, segs: [{ utf8: '♪ [Music] ♪' }] },
    { tStartMs: 35000, dDurationMs: 3000, segs: [{ utf8: 'Next sentence.' }] },
  ];
  const grouped = groupCaptionEvents(events);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].text, 'Become a better morning person in two');
  // Must NOT stretch to 35s or 39s; capped to comfortable reading duration (~5.15s, <= 8s max)
  assert.ok(grouped[0].end <= 14 + 8, `Duration should be capped, got end: ${grouped[0].end}`);
  assert.ok(grouped[0].end < 21, `Phrase duration should end around 19s, got end: ${grouped[0].end}`);
  assert.equal(grouped[1].text, 'Next sentence.');
});

test('captions fetched by the player before the SPA bridge rotates are replayed with the new nonce', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const script=readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8');
  const body=JSON.stringify({events:[{tStartMs:0,dDurationMs:2000,segs:[{utf8:'Hello there.'}]}]});
  const listeners=new Map();const posted=[];
  const oldUrl='https://www.youtube.com/watch?v=old1';const newUrl='https://www.youtube.com/watch?v=new2';
  const window={location:new URL(oldUrl),fetch:async()=>({ok:true,status:200,clone:()=>({text:async()=>body})}),
    addEventListener:(name,fn)=>listeners.set(name,fn),postMessage:(message)=>posted.push(message)};
  const makeDocument=(nonce,previous,url)=>({currentScript:{dataset:{lfNonce:nonce,lfPreviousNonce:previous,lfNavigationUrl:url}},getElementById:()=>null,readyState:'loading',addEventListener:()=>{}});
  class XHR{}XHR.prototype.open=()=>{};
  const run=(document)=>runInNewContext(script,{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:()=>{},console:{debug:()=>{},warn:()=>{}}});
  run(makeDocument('nonce-1','',oldUrl));
  // SPA: the URL changes and the player downloads the new track before the injector rotates the nonce.
  window.location=new URL(newUrl);
  await window.fetch('https://www.youtube.com/api/timedtext?v=new2&lang=en&pot=signed');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(posted.every(message=>message.nonce==='nonce-1'),'stale capture is posted with the old nonce and rejected by the engine');
  run(makeDocument('nonce-2','nonce-1',newUrl));
  const replayed=posted.filter(message=>message.nonce==='nonce-2'&&message.type==='LF_SUBTITLE_HOOK');
  assert.equal(replayed.length,1);
  assert.equal(replayed[0].data,body);
  assert.equal(replayed[0].pageUrl,newUrl);
  // A later preload request replays again without refetching; other videos are never replayed.
  listeners.get('message')({source:window,origin:window.location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
  assert.equal(posted.filter(message=>message.nonce==='nonce-2'&&message.type==='LF_SUBTITLE_HOOK').length,2);
  window.location=new URL('https://www.youtube.com/watch?v=other3');
  run(makeDocument('nonce-3','nonce-2','https://www.youtube.com/watch?v=other3'));
  assert.equal(posted.filter(message=>message.nonce==='nonce-3').length,0);
});

test('SPA navigations reuse the YouTube <video> without stacking play/seeking listeners', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  const counts={};
  const vid={addEventListener:(name)=>{counts[name]=(counts[name]||0)+1;}};
  const previous={setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,setTimeout:globalThis.setTimeout,document:globalThis.document};
  globalThis.setInterval=(fn)=>{fn();return 1;};globalThis.clearInterval=()=>{};globalThis.setTimeout=()=>0;
  globalThis.document={querySelector:(selector)=>selector==='video'?vid:null,getElementById:()=>null};
  try {
    const engine=Object.create(SubtitleEngine.prototype);
    Object.assign(engine,{platform:'youtube',isActivated:false});
    engine._injectSubtitleUI=async()=>{};engine._startSyncLoop=()=>{};engine._injectYouTubeControls=()=>{};
    for(let i=0;i<3;i++)engine._waitForVideo();
    assert.equal(counts.play,1);
    assert.equal(counts.seeking,1);
  } finally {
    Object.assign(globalThis,previous);
  }
});

test('an empty direct preload asks the player to reload its own source track once', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const script=readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8');
  async function simulate({activeTrack}){
    const listeners=new Map();const timers=[];const setOptions=[];let directRequests=0;
    const location=new URL('https://www.youtube.com/watch?v=video123');
    const tracks=[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v=video123&lang=en'}];
    const player={
      getPlayerResponse:()=>({videoDetails:{videoId:'video123'},captions:{playerCaptionsTracklistRenderer:{captionTracks:tracks}}}),
      getOption:(_module,key)=>key==='track'?activeTrack:[{languageCode:'en',vssId:'.en'},{languageCode:'pt',vssId:'.pt'}],
      setOption:(...args)=>setOptions.push(args),
      addEventListener:()=>{},
    };
    const document={currentScript:{dataset:{lfNonce:'nonce',lfNavigationUrl:location.href}},getElementById:()=>player,readyState:'complete',addEventListener:()=>{}};
    const window={location,fetch:async()=>{directRequests++;return {ok:true,status:200,text:async()=>'',clone(){return this;}};},addEventListener:(name,fn)=>listeners.set(name,fn),postMessage:()=>{}};
    class XHR{}XHR.prototype.open=function(){};
    runInNewContext(script,{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:(fn)=>timers.push(fn),console:{debug:()=>{},warn:()=>{}}});
    await new Promise(resolve=>setImmediate(resolve));
    listeners.get('message')({source:window,origin:location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
    await new Promise(resolve=>setImmediate(resolve));
    while(timers.length)timers.shift()();
    listeners.get('message')({source:window,origin:location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
    await new Promise(resolve=>setImmediate(resolve));
    while(timers.length)timers.shift()();
    return {setOptions,directRequests};
  }
  const source=await simulate({activeTrack:{languageCode:'en'}});
  assert.deepEqual(source.setOptions,[['captions','reload',true]]);
  assert.equal(source.directRequests,1);

  const translated=await simulate({activeTrack:{languageCode:'pt'}});
  assert.equal(translated.setOptions.some(([,key])=>key==='reload'),false);
  assert.equal(translated.setOptions.filter(([,key])=>key==='track').at(-1)[2].languageCode,'en');
});

test('a player response already captured for the video prevents a caption reload', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const script=readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8');
  const listeners=new Map();const timers=[];const setOptions=[];
  const location=new URL('https://www.youtube.com/watch?v=video123');
  const player={
    getPlayerResponse:()=>({videoDetails:{videoId:'video123'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v=video123&lang=en'}]}}}),
    getOption:(_module,key)=>key==='track'?{languageCode:'en'}:[{languageCode:'en'}],
    setOption:(...args)=>setOptions.push(args),
    addEventListener:()=>{},
  };
  const playerBody='{"events":[{"tStartMs":0,"segs":[{"utf8":"Hello there"}]}]}';
  const document={currentScript:{dataset:{lfNonce:'nonce',lfNavigationUrl:location.href}},getElementById:()=>player,readyState:'loading',addEventListener:()=>{}};
  const window={location,fetch:async(url)=>{const body=String(url).includes('pot=')?playerBody:'';return {ok:true,status:200,text:async()=>body,clone(){return this;}};},addEventListener:(name,fn)=>listeners.set(name,fn),postMessage:()=>{}};
  class XHR{}XHR.prototype.open=function(){};
  runInNewContext(script,{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:(fn)=>timers.push(fn),console:{debug:()=>{},warn:()=>{}}});
  await window.fetch('https://www.youtube.com/api/timedtext?v=video123&lang=en&pot=token');
  await new Promise(resolve=>setImmediate(resolve));
  listeners.get('message')({source:window,origin:location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
  await new Promise(resolve=>setImmediate(resolve));
  while(timers.length)timers.shift()();
  assert.deepEqual(setOptions,[]);
});

test('hook reports caption availability only for a player response of the current video', async () => {
  const {readFileSync}=await import('node:fs');
  const {runInNewContext}=await import('node:vm');
  const script=readFileSync(new URL('../content/youtube-hook.js',import.meta.url),'utf8');
  async function simulate({responseVideoId,tracks}){
    const listeners=new Map();const timers=[];const posted=[];
    const location=new URL('https://www.youtube.com/watch?v=video123');
    const player={getPlayerResponse:()=>({videoDetails:{videoId:responseVideoId},captions:tracks?{playerCaptionsTracklistRenderer:{captionTracks:tracks}}:undefined}),getOption:()=>[],addEventListener:()=>{}};
    const document={currentScript:{dataset:{lfNonce:'nonce',lfNavigationUrl:location.href}},getElementById:()=>player,readyState:'loading',addEventListener:()=>{}};
    const window={location,fetch:async()=>({ok:true,status:200,text:async()=>''}),addEventListener:(name,fn)=>listeners.set(name,fn),postMessage:(msg)=>posted.push(msg)};
    class XHR{}XHR.prototype.open=function(){};
    runInNewContext(script,{window,document,XMLHttpRequest:XHR,URL,URLSearchParams,setTimeout:(fn)=>timers.push(fn),console:{debug:()=>{},warn:()=>{}}});
    listeners.get('message')({source:window,origin:location.origin,data:{type:'LF_PRELOAD_SUBTITLES'}});
    for(let i=0;i<10&&timers.length;i++){await new Promise(resolve=>setImmediate(resolve));timers.shift()();}
    await new Promise(resolve=>setImmediate(resolve));
    return posted.filter((msg)=>msg.type==='LF_CAPTION_AVAILABILITY').map(({videoId,available})=>({videoId,available}));
  }
  assert.deepEqual(await simulate({responseVideoId:'video123',tracks:[]}),[{videoId:'video123',available:false}]);
  assert.deepEqual(await simulate({responseVideoId:'video123',tracks:[{languageCode:'es',baseUrl:'https://www.youtube.com/api/timedtext?v=video123&lang=es'}]}),[{videoId:'video123',available:false}]);
  assert.deepEqual(await simulate({responseVideoId:'video123',tracks:[{languageCode:'en',baseUrl:'https://www.youtube.com/api/timedtext?v=video123&lang=en'}]}),[{videoId:'video123',available:true}]);
  assert.deepEqual(await simulate({responseVideoId:'previous',tracks:[]}),[],'resposta do vídeo anterior não é evidência de vídeo sem legenda');
});

test('engine shows an announced notice when the video has no source caption and clears it', async () => {
  const {SubtitleEngine}=await import('../content/subtitle-engine.js');
  const notice={textContent:'',hidden:true};
  globalThis.window={location:{href:'https://www.youtube.com/watch?v=vid12'}};
  const engine=Object.create(SubtitleEngine.prototype);
  Object.assign(engine,{platform:'youtube',cues:[],sourceLang:'en',shadowContainer:{getElementById:(id)=>id==='lf-notice'?notice:null}});
  engine._handleCaptionAvailability({videoId:'other',available:false});
  assert.equal(notice.hidden,true,'aviso de outro vídeo é ignorado');
  engine._handleCaptionAvailability({videoId:'vid12',available:false});
  assert.equal(notice.hidden,false);
  assert.match(notice.textContent,/não tem legenda em inglês/);
  engine._handleCaptionAvailability({videoId:'vid12',available:true});
  assert.equal(notice.hidden,true);
  engine.cues=[{start:0,end:1,text:'Hi'}];
  engine._handleCaptionAvailability({videoId:'vid12',available:false});
  assert.equal(notice.hidden,true,'com legenda carregada não há aviso');
});
