// Regressões da auditoria #528: nível da aula, cobertura integral e ordem por pré-requisitos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const uiSource = readFileSync(new URL('../dashboard/js/ui/courses/courseUi.js', import.meta.url), 'utf8')
  .replace(/import .*openCoursePrepareModal.*\r?\n/, 'const openCoursePrepareModal = () => {};\n')
  .replace("'../../../../utils/html.js'", JSON.stringify(new URL('../utils/html.js', import.meta.url).href));
const ui = await import(`data:text/javascript;base64,${Buffer.from(uiSource).toString('base64')}`);

test('fim da aula auditada consulta novamente a trilha, sem saltar para outro nível no mesmo curso', () => {
  const course = { lessons: [{ id: 'a2', level: 'A2', curriculum_order: 10 }, { id: 'b2', level: 'B2', curriculum_order: 20 }] };
  assert.equal(ui.nextLessonOf(course, 'a2'), null);
  assert.equal(ui.nextLessonOf({ lessons: [{ id: 'legacy' }, { id: 'next' }] }, 'legacy').id, 'next');
});

test('ordem curricular vem antes da categoria e considera o início de um curso misto', () => {
  const application = { level: 'A2', track: 'dia-a-dia', track_order: 1, curriculum_order: 200 };
  const grammar = { level: 'B1', level_min: 'A2', track: 'gramatica', track_order: 9, curriculum_order: 10 };
  assert.ok(ui.byPathOrder(grammar, application) < 0);
});

test('faixa e filtro de curso misto refletem níveis reais das aulas, sem incluir níveis ausentes', () => {
  const mixed={level:'B2',level_min:'A2',level_max:'B2',lessons:[{level:'A2'},{level:'B2'}]};
  assert.equal(ui.courseLevelLabel(mixed),'A2–B2');
  assert.equal(ui.courseHasLevel(mixed,'A2'),true);
  assert.equal(ui.courseHasLevel(mixed,'B1'),false);
  assert.equal(ui.courseHasLevel(mixed,'A1'),false);
  assert.equal(ui.courseLevelLabel({level:'A1'}),'A1');
});

test('todas as aulas efetivas têm decisão editorial e gírias/perfect/inversão não entram no A1', async () => {
  const { loadCourseContentSnapshot } = await import('../scripts/course-content-snapshot.mjs');
  const { CURRICULUM } = await import('../supabase/content/curriculum.mjs');
  const courses = await loadCourseContentSnapshot();
  const lessons = courses.flatMap(c => c.lessons);
  assert.equal(courses.length, 30);
  assert.equal(lessons.length, 372);
  assert.equal(lessons.reduce((n,l) => n+l.units.length, 0), 4088);
  assert.deepEqual(new Set(CURRICULUM.map(l => l.id)), new Set(lessons.map(l => l.id)));
  assert.equal(CURRICULUM.length, lessons.length);
  const byId = new Map(CURRICULUM.map(l => [l.id,l]));
  for (const l of CURRICULUM) {
    assert.ok(l.reason.length > 15);
    assert.ok(['A1','A2','B1','B2','C1'].includes(l.level));
    if (l.id.startsWith('lesson-street-') || l.id.startsWith('lesson-essential-verbs-')) assert.notEqual(l.level, 'A1');
    for (const id of l.requires) {
      const previous = byId.get(id);
      assert.ok(previous, `pré-requisito ausente: ${id}`);
      assert.ok(previous.order < l.order, `dependência posterior: ${l.id}`);
    }
  }
  assert.equal(byId.get('lesson-grammar-b2-07').level, 'C1');
  assert.ok(CURRICULUM.filter(l=>l.courseId.includes('spoken-reductions')||l.courseId.includes('connected-speech')).every(l=>!l.core));
});

test('artefatos curriculares correspondem à fonte e a migration não reescreve conteúdo ou progresso', async () => {
  const {generateCourseCurriculum,MIGRATION_FILE}=await import('../scripts/generate-course-curriculum.mjs');
  const {migration,report,rollback}=await generateCourseCurriculum();
  assert.equal(readFileSync(new URL('../'+MIGRATION_FILE,import.meta.url),'utf8').replaceAll('\r\n','\n'),migration.replaceAll('\r\n','\n'));
  assert.equal(readFileSync(new URL('../docs/product/CURRICULO_AULAS.csv',import.meta.url),'utf8').replaceAll('\r\n','\n'),report.replaceAll('\r\n','\n'));
  for(const text of [migration,rollback]) assert.doesNotMatch(text, /(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.(?:course_units|course_practice_sessions|user_course_enrollment|course_user_reviews|course_user_mistakes)\b/i);
});
