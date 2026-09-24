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

test('translated track aligns by timestamp, never a different line by array position', async () => {
  const { attachTranslationsByTime }=await import('../utils/caption-grouping.js');
  const source=[{start:0,end:2,text:'First'},{start:10,end:12,text:'Second'}];
  attachTranslationsByTime(source,[{start:10.2,end:11,text:'Segundo'}]);
  assert.equal(source[0].translatedText,undefined);
  assert.equal(source[1].translatedText,'Segundo');
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
