// #533: organização de conteúdo, sem alterar método ou revisão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCourseContentSnapshot } from '../scripts/course-content-snapshot.mjs';
import { PEDAGOGY_CURRICULUM, MODULES } from '../supabase/content/curriculum-pedagogy.mjs';
import { COURSES } from '../supabase/content/batches/pedagogy-533.mjs';

test('42 aulas reais preenchem lacunas de A1 a C1 usando unidades do player atual', () => {
  assert.deepEqual(COURSES.map(c=>[c.level,c.lessons.length]), [['A1',12],['A2',10],['B1',8],['B2',6],['C1',6]]);
  for(const c of COURSES) for(const l of c.lessons) {
    assert.equal(l.units.length,8,l.id);
    assert.equal(new Set(l.units.map(u=>u.text)).size,8,l.id);
    for(const u of l.units) {
      assert.equal(u.kind,'sentence');
      assert.ok(u.text && u.pt && u.note.length>20);
    }
  }
});

test('toda aula efetiva tem módulo, papel editorial e dependências anteriores que não exigem extras', async () => {
  const cs=await loadCourseContentSnapshot();
  const lessons=cs.flatMap(c=>c.lessons);
  assert.equal(lessons.length,414);
  assert.equal(lessons.reduce((n,l)=>n+l.units.length,0),4424);
  assert.deepEqual(new Set(lessons.map(l=>l.id)),new Set(PEDAGOGY_CURRICULUM.map(l=>l.id)));
  const byId=new Map(PEDAGOGY_CURRICULUM.map(l=>[l.id,l]));
  assert.equal(byId.size,414);
  assert.equal(new Set(PEDAGOGY_CURRICULUM.map(l=>l.order)).size,414);
  for(const l of PEDAGOGY_CURRICULUM) {
    assert.ok(['base','extra','optional'].includes(l.role));
    assert.equal(l.core,l.role==='base');
    assert.ok(MODULES[l.level].includes(l.module));
    for(const id of l.requires) {
      const prev=byId.get(id);
      assert.ok(prev?.core,`${l.id} exige extra/opcional ${id}`);
      assert.ok(prev.order<l.order);
    }
  }
  for(const l of PEDAGOGY_CURRICULUM.filter(l=>l.id.includes('essential-verbs')))assert.equal(l.role,'extra');
});

test('snapshot histórico e revisão recém-publicada continuam preservados', async () => {
  const cs=await loadCourseContentSnapshot({through:'20261006221000'});
  assert.equal(cs.flatMap(c=>c.lessons).length,372);
  assert.equal(cs.flatMap(c=>c.lessons).reduce((n,l)=>n+l.units.length,0),4088);
  const { generatePedagogy, MIGRATION_FILE, CONTENT_FILE }=await import('../scripts/generate-course-pedagogy.mjs');
  const {migration,content,rollback}=await generatePedagogy();
  assert.equal(readFileSync(new URL('../'+MIGRATION_FILE,import.meta.url),'utf8'),migration);
  assert.equal(readFileSync(new URL('../'+CONTENT_FILE,import.meta.url),'utf8'),content);
  assert.equal(readFileSync(new URL('../supabase/rollback/course_pedagogy_533.sql',import.meta.url),'utf8'),rollback);
  for(const s of [migration,content,rollback]){
    assert.doesNotMatch(s, /(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.(?:course_user_reviews|course_practice_sessions|course_session_results|course_user_mistakes|user_course_enrollment)\b/i);
    assert.doesNotMatch(s,/CREATE OR REPLACE FUNCTION public\.(?:rpc_course_commit_practice|rpc_course_review)/);
  }
});


test('filtro de nível e categoria exige a mesma aula; cursos mistos não produzem falso positivo', async () => {
  const { matchesCurriculumFilter, lessonRoleLabel }=await import('../dashboard/js/ui/courses/courseCurriculum.js');
  const course={level:'B2',lessons:[{level:'A1',lesson_role:'base'},{level:'B2',lesson_role:'optional'}]};
  assert.equal(matchesCurriculumFilter(course,'A1','optional'),false);
  assert.equal(matchesCurriculumFilter(course,'B2','optional'),true);
  assert.equal(matchesCurriculumFilter(course,'A1','base'),true);
  assert.equal(matchesCurriculumFilter(course,'','extra'),false);
  assert.equal(lessonRoleLabel({lesson_role:'optional'}),'Opcional por objetivo');
});
