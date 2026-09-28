// Gera migrations de conteúdo dos cursos a partir de supabase/content/.
// Uso: node scripts/generate-course-seed.mjs <lote> <arquivo-de-saida.sql>
//   lote "v1"          → supabase/content/courses.mjs (formato 1, já publicado)
//   lote "<nome>"      → supabase/content/batches/<nome>.mjs (formato 2)
// Falha (exit 1) se uma palavra não estiver no léxico, se um grupo sintático
// não existir na frase ou se algum IPA não passar no validador do projeto.
// A partir dos lotes novos, toda unidade que não é palavra exige nota
// gramatical (aparece em "Mostrar resposta"); "retireUnits" remove unidades
// que um lote anterior publicou e que o conteúdo novo substituiu.

import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LEXICON as BASE_LEXICON } from '../supabase/content/lexicon.mjs';
import { isValidIpa } from '../utils/ipa-validator.js';

const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const TRACKS = new Set(['fundamentos', 'dia-a-dia', 'viagem', 'gramatica', 'trabalho', 'fluencia']);
const KINDS = new Set(['sentence', 'word', 'verb_forms', 'phrasal', 'story', 'paragraph']);
// Lotes já publicados antes da regra de nota obrigatória (saída congelada).
const LEGACY_BATCHES = new Set(['fundamentos-1']);

export function wordsOf(text) {
  return text.split(/\s+/)
    .map((raw) => raw.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '').replace(/-$/, ''))
    .filter(Boolean);
}

function makeBuilders(lexicon, errors) {
  function buildUnit(text, unitId) {
    const annotations = wordsOf(text).map((surface) => {
      const entry = lexicon[surface.toLowerCase()];
      if (!entry) {
        errors.push(`${unitId}: "${surface}" fora do léxico`);
        return { surface, pos: '', ipa: '', gloss: '' };
      }
      const [pos, ipa, gloss] = entry;
      if (!isValidIpa(ipa)) errors.push(`${unitId}: IPA inválido para "${surface}": ${ipa}`);
      return { surface, pos, ipa, gloss };
    });
    const sentenceIpa = `/${annotations.map((a) => a.ipa.replace(/^\/|\/$/g, '')).join(' ')}/`;
    if (!isValidIpa(sentenceIpa)) errors.push(`${unitId}: IPA da frase inválido: ${sentenceIpa}`);
    return { annotations, sentenceIpa };
  }

  function buildGroups(text, groups, unitId) {
    let cursor = 0;
    return (groups || []).map(([surface, role]) => {
      const start = text.indexOf(surface, cursor);
      if (start < 0) {
        errors.push(`${unitId}: grupo "${surface}" não encontrado em "${text}"`);
        return { start: 0, end: 0, role, surface };
      }
      cursor = start + surface.length;
      return { start, end: cursor, role, surface };
    });
  }
  return { buildUnit, buildGroups };
}

// Aceita o formato antigo [texto, pt, nota, grupos] ou um objeto com kind.
function normalizeUnit(raw) {
  if (Array.isArray(raw)) {
    const [text, pt, note, groups] = raw;
    return { kind: 'sentence', text, pt, note, groups, example: null };
  }
  return { kind: raw.kind || 'sentence', text: raw.text, pt: raw.pt, note: raw.note || null, groups: raw.groups || [], example: raw.example || null };
}

function courseSql(course, format) {
  if (format === 1) {
    return `INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, is_published)
VALUES (${q(course.id)}, ${q(course.slug)}, ${q(course.title)}, ${q(course.short)}, ${q(course.long)}, ${q(course.level)}, ${q(course.category)}, ${course.order}, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, is_published = EXCLUDED.is_published, updated_at = now();`;
  }
  return `INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES (${q(course.id)}, ${q(course.slug)}, ${q(course.title)}, ${q(course.short)}, ${q(course.long)}, ${q(course.level)}, ${q(course.category)}, ${course.order}, ${q(course.track)}, ${course.trackOrder}, ${course.isCore !== false}, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();`;
}

function lessonSql(course, lesson, format, builders, errors, requireNotes) {
  const rows = lesson.units.map((raw, i) => {
    const unitId = `${lesson.id.replace('lesson-', 'unit-')}-${String(i + 1).padStart(2, '0')}`;
    const u = normalizeUnit(raw);
    if (!KINDS.has(u.kind)) errors.push(`${unitId}: tipo inválido ${u.kind}`);
    if (!u.text || !u.pt) errors.push(`${unitId}: texto e tradução são obrigatórios`);
    const { annotations, sentenceIpa } = builders.buildUnit(u.text, unitId);
    const syntax = builders.buildGroups(u.text, u.groups, unitId);
    if (format === 1) {
      return `  (${q(unitId)}, ${q(lesson.id)}, ${i + 1}, 'sentence', ${q(u.text)}, ${q(u.pt)}, ${q(sentenceIpa)}, ${q(u.note)}, ${j(syntax)}, ${j(annotations)})`;
    }
    if (requireNotes && u.kind !== 'word' && !u.note) errors.push(`${unitId}: nota gramatical obrigatória`);
    if (u.example && (!u.example[0] || !u.example[1])) errors.push(`${unitId}: exemplo precisa de inglês e português`);
    return `  (${q(unitId)}, ${q(lesson.id)}, ${i + 1}, ${q(u.kind)}, ${q(u.text)}, ${q(u.pt)}, ${q(sentenceIpa)}, ${q(u.note)}, ${j(syntax)}, ${j(annotations)}, ${q(u.example?.[0])}, ${q(u.example?.[1])})`;
  });
  const cols = format === 1
    ? 'id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations'
    : 'id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt';
  const extraSet = format === 1 ? '' : ',\n  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt';
  return `INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES (${q(lesson.id)}, ${q(course.id)}, ${lesson.chapter}, ${q(lesson.title)}, ${q(lesson.description)})
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (${cols})
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations${extraSet};`;
}

export function generateFrom(courses, { lexicon = BASE_LEXICON, format = 2, requireNotes = false } = {}) {
  const errors = [];
  const builders = makeBuilders(lexicon, errors);
  const parts = [
    '-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.',
    '-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.',
  ];
  for (const course of courses) {
    if (format === 2 && !TRACKS.has(course.track)) errors.push(`${course.id}: trilha inválida ${course.track}`);
    parts.push(courseSql(course, format));
    if (course.retireUnits?.length) {
      parts.push(`DELETE FROM public.course_units WHERE id IN (${course.retireUnits.map(q).join(', ')});`);
    }
    const chapters = new Set();
    for (const lesson of course.lessons) {
      if (chapters.has(lesson.chapter)) errors.push(`${lesson.id}: capítulo ${lesson.chapter} repetido`);
      chapters.add(lesson.chapter);
      parts.push(lessonSql(course, lesson, format, builders, errors, requireNotes));
    }
  }
  return { sql: `${parts.join('\n\n')}\n`, errors };
}

// Lote 1 (já publicado em 20260927180100): mantém a saída idêntica.
export async function generate() {
  const { COURSES } = await import('../supabase/content/courses.mjs');
  return generateFrom(COURSES, { format: 1 });
}

const BATCH_DIR = new URL('../supabase/content/batches/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const batchUrl = (file) => pathToFileURL(`${BATCH_DIR}${file}`).href;

// Léxico visível a um lote: palavras dos outros lotes, depois o léxico base e,
// por último, as do próprio lote (assim a saída de lotes já publicados não muda).
async function othersLexicon(name) {
  const others = {};
  for (const file of readdirSync(BATCH_DIR).filter((f) => f.endsWith('.mjs') && f !== `${name}.mjs`).sort()) {
    Object.assign(others, (await import(batchUrl(file))).LEXICON || {});
  }
  return others;
}

export async function generateBatch(name) {
  const mod = await import(batchUrl(`${name}.mjs`));
  const lexicon = { ...(await othersLexicon(name)), ...BASE_LEXICON, ...(mod.LEXICON || {}) };
  return { ...generateFrom(mod.COURSES, { lexicon, format: 2, requireNotes: !LEGACY_BATCHES.has(name) }), courses: mod.COURSES };
}

if (process.argv[1]?.endsWith('generate-course-seed.mjs')) {
  const [batch = 'v1', out] = process.argv.slice(2);
  const result = batch === 'v1' ? await generate() : await generateBatch(batch);
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
  if (out) writeFileSync(out, result.sql);
  const courses = result.courses || (await import('../supabase/content/courses.mjs')).COURSES;
  const lessons = courses.reduce((n, c) => n + c.lessons.length, 0);
  const units = courses.reduce((n, c) => n + c.lessons.reduce((m, l) => m + l.units.length, 0), 0);
  console.log(`ok: ${courses.length} cursos, ${lessons} lições, ${units} itens`);
}
