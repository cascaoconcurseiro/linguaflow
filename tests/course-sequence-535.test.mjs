import test from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCE_CURRICULUM as rows, BLOCKS } from '../supabase/content/curriculum-sequence.mjs';
test('cobre todas as aulas, preserva extras e encerra cada bloco com consolidação',()=>{
 assert.equal(rows.length,449);assert.equal(new Set(rows.map(l=>l.id)).size,449);
 assert.equal(rows.filter(l=>l.core).length,247);assert.equal(rows.filter(l=>l.role==='extra').length,129);assert.equal(rows.filter(l=>l.role==='optional').length,73);
 for(const b of BLOCKS){const ls=rows.filter(l=>l.level===b.level&&l.module===b.title&&l.core);assert.equal(ls.at(-1).stage,'consolidation');assert.deepEqual(new Set(ls.at(-1).requires),new Set(ls.slice(0,-1).map(l=>l.id)));assert.ok(ls.length<=18);}
});
test('dependências são anteriores, apenas base, e fundamentos precedem aplicação',()=>{
 const byId=new Map(rows.map(l=>[l.id,l]));
 for(const l of rows)for(const id of l.requires){const p=byId.get(id);assert.ok(p?.core);assert.ok(p.order<l.order,`${id} antes de ${l.id}`);}
 for(const [base,application] of [['lesson-1000-words-a1-05','lesson-numbers-a1-02'],['lesson-first-sentences-a1-06','lesson-pedagogy-a1-frequency'],['lesson-first-sentences-a1-11','lesson-pedagogy-a2-past-simple']]){assert.ok(byId.get(base).order<byId.get(application).order);assert.ok(byId.get(application).requires.includes(base));}
});

test('fontes, migrations e rollback preservam histórico e não redefinem revisão',async()=>{
 const {readFileSync}=await import('node:fs');
 const {loadCourseContentSnapshot}=await import('../scripts/course-content-snapshot.mjs');
 const courses=await loadCourseContentSnapshot();assert.equal(courses.length,39);assert.equal(courses.flatMap(c=>c.lessons).reduce((n,l)=>n+l.units.length,0),4704);
 assert.deepEqual(new Set(courses.flatMap(c=>c.lessons).map(l=>l.id)),new Set(rows.map(l=>l.id)));
 const {generateSequence,CONTENT_FILE,MIGRATION_FILE}=await import('../scripts/generate-course-sequence.mjs');
 const outputs=await generateSequence();
 for(const [key,path] of Object.entries({content:CONTENT_FILE,migration:MIGRATION_FILE,rollback:'supabase/rollback/course_sequence_535.sql',doc:'docs/product/SEQUENCIA_PEDAGOGICA.md'})){
 assert.equal(readFileSync(new URL('../'+path,import.meta.url),'utf8'),outputs[key]);
 if(key!=='doc'){
 assert.doesNotMatch(outputs[key],/(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.(?:course_user_reviews|course_practice_sessions|course_session_results|course_user_mistakes|user_course_enrollment)\b/i);
 assert.doesNotMatch(outputs[key],/CREATE OR REPLACE FUNCTION public\.(?:rpc_course_commit_practice|rpc_course_review)/);
 }
 }
});
