// #535: conclusão salva antes de consultar trilha; retry e saída não duplicam sessão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseCompletion } from '../dashboard/js/core/courseCompletion.js';
test('salva antes de consultar próxima aula e une cliques simultâneos',async()=>{
 const calls=[];let resolve;const states=[];
 const flow=createCourseCompletion({commit:()=>{calls.push('commit');return new Promise(r=>{resolve=r;});},loadNext:async()=>{calls.push('path');return {next:{lesson_id:'next',course_id:'other',title:'Próxima'}};},onState:s=>states.push(s)});
 const a=flow.save();const b=flow.save();assert.equal(a,b);assert.deepEqual(calls,['commit']);resolve({});await a;
 assert.deepEqual(calls,['commit','path']);assert.equal(states.at(-1).next.lesson_id,'next');
});
test('erro ao consultar trilha não volta a gravar a sessão salva',async()=>{
 let commits=0,reads=0;const states=[];
 const f=createCourseCompletion({commit:async()=>{commits++;},loadNext:async()=>{if(++reads===1)throw Error('offline');return {next:null,blocked:false};},onState:s=>states.push(s)});
 await f.save();assert.equal(states.at(-1).status,'next-error');await f.retryNext();assert.equal(commits,1);assert.equal(states.at(-1).status,'done');
});
test('erro ao salvar não consulta trilha; retry permite salvar uma vez com sucesso',async()=>{
 let attempts=0,reads=0;const states=[];
 const f=createCourseCompletion({commit:async()=>{if(++attempts===1)throw Error('offline');},loadNext:async()=>{reads++;return {next:null,blocked:true};},onState:s=>states.push(s)});
 await f.save();assert.equal(reads,0);assert.equal(states.at(-1).status,'save-error');await f.save();assert.equal(reads,1);assert.equal(states.at(-1).status,'blocked');
});
test('view descartada não recebe atualização tardia e revisão não consulta próxima aula',async()=>{
 let active=true;const states=[];let resolve;
 const f=createCourseCompletion({commit:()=>new Promise(r=>{resolve=r;}),onState:s=>states.push(s),isActive:()=>active});
 const pending=f.save();active=false;resolve({});await pending;assert.equal(states.length,1);
});
