// Read-only audit probes. No requests, credentials or production writes.
// Run from repository root: node docs/audits/2026-09-22-probes.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {parse} from 'acorn';
import {db} from '../../utils/db.js';
import {estimateLevelFromHistory} from '../../dashboard/js/core/levelEstimator.js';
const out = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network forbidden in audit probes'); };
try {
  const bands = ['A1','A2','B1','B2','C1'];
  const words = bands.map((level,i)=>({id:`w${i}`,word:`synthetic${i}`,level}));
  const cards = words.map((w,i)=>({id:`c${i}`,word_id:w.id}));
  const logs = cards.flatMap(c=>Array.from({length:10},()=>({card_id:c.id,quality:3})));
  const estimate = estimateLevelFromHistory(logs,cards,words,{});
  out.cefrFromFiveRepeatedWords = {distinctWords:5,reviews:50,estimatedLevel:estimate.level};
  assert.equal(estimate.level,'C1');
  const dbPrototype = Object.getPrototypeOf(db);
  const sourceDb = Object.create(dbPrototype);
  sourceDb.isChromeContext = true;
  out.platformClassification = Object.fromEntries(['youtube','max','netflix','video'].map(p=>[p,sourceDb._sessionSource(p)]));
  assert.equal(out.platformClassification.max,'extension');

  const statDb = Object.create(dbPrototype);
  statDb.getSessions = async () => [
    {source:'video',seconds:60,language:'en'},
    {source:'extension',seconds:120,language:'en'},
    {source:'manual_writing',seconds:180,language:'en'},
  ];
  const stats = await statDb.getStudyStats('en');
  out.activityTotals = {inputSeconds:360,reportedTotal:stats.summary.totalSecondsAllTime,listeningSeconds:stats.listening.totalSeconds};
  assert.equal(stats.summary.totalSecondsAllTime,60);

  const store = new Map();
  globalThis.localStorage = {getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  globalThis.window = {localStorage:globalThis.localStorage};
  const privacyDb = Object.create(dbPrototype);
  privacyDb._invalidateReadCache = () => {};
  await privacyDb.saveFluencyCheckDraft({answers:{writing:'SYNTHETIC_PRIVATE_DRAFT_A'}});
  await privacyDb.logout();
  out.draftSurvivesLogout = (await privacyDb.getFluencyCheckDraft())?.answers?.writing === 'SYNTHETIC_PRIVATE_DRAFT_A';
  assert.equal(out.draftSurvivesLogout,true);
  delete globalThis.window;
  delete globalThis.localStorage;

  const view = fs.readFileSync('dashboard/js/ui/fluencyCheckView.js','utf8');
  const tree = parse(view,{ecmaVersion:'latest',sourceType:'module'});
  const needed = new Set(['FLUENCY_STEPS','isStepComplete','responseLength','buildAttemptRecords']);
  const pieces = tree.body.filter(n=>needed.has(n.id?.name)||n.declarations?.some(d=>needed.has(d.id.name))).map(n=>view.slice(n.start,n.end));
  const buildRecords = vm.runInNewContext(pieces.join('\n')+'\nbuildAttemptRecords');
  const uuid = '00000000-0000-4000-8000-000000000001';
  const records = buildRecords({listening:{choice:'early',replayCount:1},writing:'This is a synthetic response.',interaction:{first:'A synthetic first answer.',clarification:'A synthetic clarification.'}},{listening:uuid,writing:uuid,interaction:uuid},Date.now());
  const fluencyDb = Object.create(dbPrototype);
  try { await fluencyDb.submitFluencyCheck(records); out.fluencyError = null; }
  catch(error){ out.fluencyError = error.message; }
  out.fluencyRecordKeys = Object.keys(records[0]);
  assert.equal(out.fluencyError,'Identificador de submissão inválido.');

  const engine = fs.readFileSync('content/subtitle-engine.js','utf8');
  const engineTree = parse(engine,{ecmaVersion:'latest',sourceType:'module'});
  const classNode = engineTree.body.map(n=>n.declaration||n).find(n=>n.type==='ClassDeclaration' && n.body.body.some(m=>m.key.name==='_startImmersionLog'));
  const method = classNode.body.body.find(m=>m.key.name==='_startImmersionLog');
  // Replace only the dynamic database import with an in-memory dependency.
  const methodCode = engine.slice(method.start,method.end).replace("import('../utils/db.js')",'Promise.resolve({db: probeDb})');
  out.immersion = {};
  for(const [name,patch] of Object.entries({normal:{},muted:{muted:true},buffering:{readyState:1},wrongAudioLanguage:{audioLanguage:'pt'},paused:{paused:true}})){
    const writes=[];
    const context = {document:{visibilityState:'visible'},Date,Promise,chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}},probeDb:{logSession:async(...args)=>writes.push(args)}};
    const start = vm.runInNewContext('({'+methodCode+'})._startImmersionLog',context);
    const state={isActivated:true,currentCueIndex:0,lastText:'Synthetic subtitle',sourceLang:'en',platform:'youtube',videoElement:{paused:false,ended:false,muted:false,readyState:4,currentTime:120,...patch},_setManagedInterval(fn){this.tick=fn;}};
    start.call(state); await state.tick();
    out.immersion[name]=writes;
  }
  assert.equal(out.immersion.muted.length,1);
  assert.equal(out.immersion.buffering.length,1);
  assert.equal(out.immersion.wrongAudioLanguage[0][2],'en');
  assert.equal(out.immersion.paused.length,0);
  console.log(JSON.stringify(out,null,2));
} finally { globalThis.fetch = originalFetch; }
