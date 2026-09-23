import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../utils/db.js';
import {estimateLevelFromHistory} from '../dashboard/js/core/levelEstimator.js';
const makeDb = () => Object.assign(Object.create(Object.getPrototypeOf(db)),{isProxyMode:false,_invalidateReadCache(){}});
test('private drafts are scoped to account and removed at logout',async()=>{
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.window={localStorage:globalThis.localStorage};
 const d=makeDb();let user='A';d.getCurrentUserId=async()=>user;
 try {await d.saveFluencyCheckDraft({answers:{writing:'private A'}});user='B';assert.equal(await d.getFluencyCheckDraft(),null);
 user='A';assert.equal((await d.getFluencyCheckDraft()).answers.writing,'private A');await d.logout();assert.equal(await d.getFluencyCheckDraft(),null);
 storage.set('lf_fluency_check_draft_v1',JSON.stringify({answers:'legacy'}));assert.equal(await d.getFluencyCheckDraft(),null);
 }finally{delete globalThis.localStorage;delete globalThis.window;}
});
test('Max is listening and writing is included in lifetime totals',async()=>{
 const d=makeDb();d.isChromeContext=true;assert.equal(d._sessionSource('max'),'video');
 let period;d.getSessions=async(days)=>{period=days;return [{source:'video',seconds:60,language:'en'},{source:'manual_writing',seconds:180,language:'en'}];};
 const result=await d.getStudyStats('en');assert.equal(result.summary.totalSecondsAllTime,240);assert.equal(result.writing.totalSeconds,180);assert.equal(period,null);
});
test('five repeated words never certify a CEFR level',()=>{
 const bands=['A1','A2','B1','B2','C1'];const words=bands.map((level,i)=>({id:`w${i}`,word:`w${i}`,level}));const cards=words.map((w,i)=>({id:`c${i}`,word_id:w.id}));
 const logs=cards.flatMap(c=>Array.from({length:10},()=>({card_id:c.id,quality:3})));
 assert.equal(estimateLevelFromHistory(logs,cards,words,{}).level,null);
});

test('issued tasks reach the real submission contract and retain IDs on retry',async()=>{
 const {buildAttemptRecords,createFluencyDataAdapter}=await import('../dashboard/js/ui/fluencyCheckView.js');
 const d=makeDb();d.getCurrentUserId=async()=> 'A';d.getLatestLearningTaskAttempt=async()=>null;d.getFluencyCheckDraft=async()=>null;d.clearFluencyCheckDraft=async()=>{};
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 const issues=Object.fromEntries(['listening','writing','interaction'].map((skill,i)=>[skill,{id:ids[i],material:{options:['first','second']}}]));
 const attempts=Object.fromEntries(['listening','writing','interaction'].map((skill,i)=>[skill,ids[i]]));
 const records=buildAttemptRecords({listening:{choice:'1',replayCount:1},writing:'A valid synthetic message',interaction:{first:'A valid request',clarification:'A clarification'}},attempts,Date.now(),issues);
 const sent=[];d._fetch=async(endpoint,options)=>{sent.push(options.body);return {id:options.body.p_issue_id};};
 let fail=true;d.assessFluencySubmission=async()=>{if(fail){fail=false;throw new Error('temporary');}return {status:'evaluated'};};
 const adapter=createFluencyDataAdapter(d);await adapter.load();
 await assert.rejects(adapter.submit(records),/temporary/);const savedPayload=JSON.stringify(sent[0]);await adapter.submit(records);
 assert.equal(JSON.stringify(sent[1]),savedPayload);assert.equal(sent[0].p_response.choice,1);assert.equal(sent[0].p_issue_id,ids[0]);
});
