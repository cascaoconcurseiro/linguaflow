// Gera a migration de conteúdo dos cursos a partir de supabase/content/*.mjs.
// Uso: node scripts/generate-course-seed.mjs <arquivo-de-saida.sql>
// Falha (exit 1) se uma palavra não estiver no léxico, se um grupo sintático
// não existir na frase ou se algum IPA não passar no validador do projeto.

import { writeFileSync } from 'node:fs';
import { COURSES } from '../supabase/content/courses.mjs';
import { LEXICON } from '../supabase/content/lexicon.mjs';
import { isValidIpa } from '../utils/ipa-validator.js';

const errors = [];
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;

export function wordsOf(text) {
  return text.split(/\s+/)
    .map((raw) => raw.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, ''))
    .filter(Boolean);
}

export function buildUnit(text, unitId) {
  const annotations = wordsOf(text).map((surface) => {
    const entry = LEXICON[surface.toLowerCase()];
    if (!entry) {
      errors.push(`${unitId}: "${surface}" fora do léxico`);
      return { surface, pos: '', ipa: '', gloss: '' };
    }
    const [pos, ipa, gloss] = entry;
    if (!isValidIpa(ipa)) errors.push(`${unitId}: IPA inválido para "${surface}": ${ipa}`);
    return { surface, pos, ipa, gloss };
  });
  const sentenceIpa = `/${annotations.map((a) => a.ipa.replace(/^\/|\/$/g, '')).join(' ')}/`;
  return { annotations, sentenceIpa };
}

export function buildGroups(text, groups, unitId) {
  let cursor = 0;
  return groups.map(([surface, role]) => {
    const start = text.indexOf(surface, cursor);
    if (start < 0) {
      errors.push(`${unitId}: grupo "${surface}" não encontrado em "${text}"`);
      return { start: 0, end: 0, role, surface };
    }
    cursor = start + surface.length;
    return { start, end: cursor, role, surface };
  });
}

function courseSql(course) {
  return `INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, is_published)
VALUES (${q(course.id)}, ${q(course.slug)}, ${q(course.title)}, ${q(course.short)}, ${q(course.long)}, ${q(course.level)}, ${q(course.category)}, ${course.order}, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, is_published = EXCLUDED.is_published, updated_at = now();`;
}

function lessonSql(course, lesson) {
  const rows = lesson.units.map(([text, pt, note, groups], i) => {
    const unitId = `${lesson.id.replace('lesson-', 'unit-')}-${String(i + 1).padStart(2, '0')}`;
    const { annotations, sentenceIpa } = buildUnit(text, unitId);
    if (!isValidIpa(sentenceIpa)) errors.push(`${unitId}: IPA da frase inválido: ${sentenceIpa}`);
    const syntax = buildGroups(text, groups, unitId);
    return `  (${q(unitId)}, ${q(lesson.id)}, ${i + 1}, 'sentence', ${q(text)}, ${q(pt)}, ${q(sentenceIpa)}, ${q(note)}, ${j(syntax)}, ${j(annotations)})`;
  });
  return `INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES (${q(lesson.id)}, ${q(course.id)}, ${lesson.chapter}, ${q(lesson.title)}, ${q(lesson.description)})
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations;`;
}

export function generate() {
  const parts = [
    '-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.',
    '-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.',
  ];
  for (const course of COURSES) {
    parts.push(courseSql(course));
    for (const lesson of course.lessons) parts.push(lessonSql(course, lesson));
  }
  return { sql: `${parts.join('\n\n')}\n`, errors };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-course-seed.mjs')) {
  const out = process.argv[2];
  const { sql } = generate();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  if (out) writeFileSync(out, sql);
  const lessons = COURSES.reduce((n, c) => n + c.lessons.length, 0);
  const units = COURSES.reduce((n, c) => n + c.lessons.reduce((m, l) => m + l.units.length, 0), 0);
  console.log(`ok: ${COURSES.length} cursos, ${lessons} lições, ${units} frases`);
}
