import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ListeningClock} from '../utils/listening-clock.js';
const base={key:'video-a',language:'en',active:true,visible:true,ad:false,paused:false,ended:false,seeking:false,muted:false,volume:1,readyState:4,rate:1};
const run=(patch={},rate=1)=>{const c=new ListeningClock();for(let n=0;n<=10;n++)c.sample({...base,...patch,rate,now:1e12+n*1000,time:n*rate});return c;};
test('counts wall seconds at normal, half and double playback speed',()=>{for(const r of [0.5,1,2])assert.equal(run({},r).take().seconds,10);});
test('requires language evidence and audible, advancing, active playback',()=>{for(const p of [{language:null},{muted:true},{volume:0},{readyState:1},{paused:true},{seeking:true},{visible:false},{ad:true},{active:false}])assert.equal(run(p).take(),null);});
test('seeks, stalls and delayed timers do not earn exposure',()=>{for(const [ms,time] of [[1000,30],[1000,0],[30000,30]]){const c=new ListeningClock();c.sample({...base,now:1e12,time:0});c.sample({...base,now:1e12+ms,time});assert.equal(c.take(),null);}});
test('changing video or language requires a new baseline',()=>{const c=new ListeningClock();c.sample({...base,now:1e12,time:0});assert.equal(c.sample({...base,key:'b',language:null,now:1e12+1000,time:1}),0);assert.equal(c.take(),null);});
