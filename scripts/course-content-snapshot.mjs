// Conteúdo efetivo para auditoria curricular: replay editorial cronológico, com offsets e retiradas.
// Inclui a primeira aula histórica que existe somente na migration inicial, sem alterar lotes publicados.
import { readdirSync, readFileSync } from 'node:fs';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const batchesDir = new URL('../supabase/content/batches/', import.meta.url);

export async function loadCourseContentSnapshot({ through = null } = {}) {
  const migrations = readdirSync(migrationsDir).sort();
  const sources = [{ file: '20260927180100_course_content.sql', url: new URL('../supabase/content/courses.mjs', import.meta.url) }];
  for (const file of readdirSync(batchesDir).filter(f => f.endsWith('.mjs')).sort()) {
    const name = file.slice(0, -4);
    const migration = migrations.find(m => m.endsWith(`_course_content_${name.replaceAll('-', '_')}.sql`) || m.endsWith(`_course_content_${name}.sql`));
    if (!migration) throw new Error(`Lote sem migration: ${name}`);
    if (!through || migration.slice(0,14) <= through) sources.push({ file: migration, url: new URL(file, batchesDir) });
  }
  const courses = new Map(), lessons = new Map(), units = new Map();
  const seed = readFileSync(new URL('20260927150200_course_seed_street_english_a1.sql', migrationsDir), 'utf8');
  const initialId = 'lesson-street-a1-01';
  lessons.set(initialId, { id: initialId, courseId: 'course-street-a1', chapter: 1, title: 'Cumprimentos, chegadas e saídas' });
  for (const row of seed.matchAll(/^\s*\('unit-street-a1-01-\d{2}'.*$/gm)) {
    const fields = [...row[0].matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replaceAll("''", "'"));
    units.set(fields[0], { id: fields[0], lessonId: fields[1], order: Number(fields[0].slice(-2)), kind: fields[2], text: fields[3], pt: fields[4], ipa: fields[5], note: fields[6] });
  }
  if (units.size !== 10) throw new Error('Aula inicial histórica incompleta');
  for (const source of sources.sort((a,b) => a.file.localeCompare(b.file))) {
    const { COURSES } = await import(source.url.href);
    for (const course of COURSES) {
      const { lessons: incoming, retireUnits, ...metadata } = course;
      courses.set(course.id, { ...courses.get(course.id), ...metadata });
      for (const id of retireUnits || []) units.delete(id);
      for (const lesson of incoming) {
        const { units: incomingUnits, unitOffset = 0, ...details } = lesson;
        lessons.set(lesson.id, { ...lessons.get(lesson.id), ...details, courseId: course.id });
        incomingUnits.forEach((raw, i) => {
          const order = i + 1 + unitOffset;
          const id = `${lesson.id.replace('lesson-', 'unit-')}-${String(order).padStart(2, '0')}`;
          const unit = Array.isArray(raw) ? { kind: 'sentence', text: raw[0], pt: raw[1], note: raw[2], groups: raw[3] } : raw;
          units.set(id, { ...unit, id, lessonId: lesson.id, order });
        });
      }
    }
  }
  const unitsByLesson = new Map();
  for (const unit of units.values()) {
    const list = unitsByLesson.get(unit.lessonId) || [];
    list.push(unit); unitsByLesson.set(unit.lessonId, list);
  }
  return [...courses.values()].map(course => ({ ...course, lessons: [...lessons.values()]
    .filter(l => l.courseId === course.id).sort((a,b) => a.chapter - b.chapter)
    .map(lesson => ({ ...lesson, units: (unitsByLesson.get(lesson.id) || []).sort((a,b) => a.order - b.order) })) }));
}
