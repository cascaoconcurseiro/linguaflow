// Amostra para revisão humana do conteúdo dos cursos (Issue #435).
//
//   node scripts/content-review-sample.mjs [--per-course 5] [--seed texto] [--out arquivo.csv]
//
// O verificador (#428) garante formato, IPA válido e léxico, mas não se a tradução e a nota estão
// BOAS. Esta amostra, reproduzível pela semente, vai para uma planilha que um revisor humano preenche
// (aprovado / corrigir). Rodar de novo com a mesma semente devolve as mesmas linhas.

import { writeFileSync } from 'node:fs';
import { LEXICON as BASE_LEXICON } from '../supabase/content/lexicon.mjs';
import { batchNames } from './content-check.mjs';
import { wordsOf } from './generate-course-seed.mjs';

export const REVIEW_COLUMNS = ['curso', 'nivel', 'licao', 'id_unidade', 'tipo', 'ingles', 'portugues', 'ipa', 'nota', 'status_revisao', 'correcao_sugerida', 'revisor'];

// Gerador pseudoaleatório determinístico (mulberry32) alimentado por uma semente textual.
function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normalize = (raw) => (Array.isArray(raw)
  ? { kind: 'sentence', text: raw[0], pt: raw[1], note: raw[2] }
  : { kind: raw.kind || 'sentence', text: raw.text, pt: raw.pt, note: raw.note || '' });

// Mesma regra do gerador: léxico dos outros lotes, depois o base e, por último, o do próprio lote.
function sentenceIpa(text, lexicon) {
  const parts = wordsOf(text).map((surface) => lexicon[surface.toLowerCase()]?.[1]);
  if (!parts.length || parts.some((p) => !p)) return '';
  return `/${parts.map((p) => p.replace(/^\/|\/$/g, '')).join(' ')}/`;
}

/** Junta os cursos de todos os lotes (o mesmo curso aparece em vários lotes). */
export async function loadAllCourses() {
  const courses = new Map();
  const names = batchNames();
  const batches = await Promise.all(names.map((name) => import(`../supabase/content/batches/${name}.mjs`)));
  const sources = [{ mod: await import('../supabase/content/courses.mjs'), lexicon: BASE_LEXICON }];
  batches.forEach((mod, index) => {
    const others = {};
    batches.forEach((other, j) => { if (j !== index) Object.assign(others, other.LEXICON || {}); });
    sources.push({ mod, lexicon: { ...others, ...BASE_LEXICON, ...(mod.LEXICON || {}) } });
  });
  for (const { mod, lexicon } of sources) {
    for (const course of mod.COURSES) {
      const entry = courses.get(course.id) || { id: course.id, title: course.title, level: course.level, units: [] };
      for (const lesson of course.lessons) {
        lesson.units.forEach((raw, i) => {
          const unit = normalize(raw);
          entry.units.push({
            ipa: sentenceIpa(unit.text, lexicon),
            lesson: lesson.title,
            id: `${lesson.id.replace('lesson-', 'unit-')}-${String(i + 1).padStart(2, '0')}`,
            ...unit,
          });
        });
      }
      courses.set(course.id, entry);
    }
  }
  return [...courses.values()];
}

export function buildReviewSample(courses, { perCourse = 5, seed = 'linguaflow' } = {}) {
  const rows = [];
  for (const course of [...courses].sort((a, b) => a.id.localeCompare(b.id))) {
    const rand = seededRandom(`${seed}:${course.id}`);
    const pool = [...course.units].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const unit of pool.slice(0, perCourse).sort((a, b) => a.id.localeCompare(b.id))) {
      rows.push({ curso: course.title, nivel: course.level, licao: unit.lesson, id_unidade: unit.id, tipo: unit.kind, ingles: unit.text, portugues: unit.pt, ipa: unit.ipa || '', nota: unit.note || '', status_revisao: '', correcao_sugerida: '', revisor: '' });
    }
  }
  return rows;
}

export function toCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para o Excel abrir acentos corretamente.
  return `﻿${[REVIEW_COLUMNS.join(','), ...rows.map((r) => REVIEW_COLUMNS.map((c) => cell(r[c])).join(','))].join('\r\n')}\r\n`;
}

if (process.argv[1]?.endsWith('content-review-sample.mjs')) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const perCourse = Math.max(1, Number(opt('--per-course', 5)) || 5);
  const seed = opt('--seed', 'linguaflow');
  const out = opt('--out', null);
  const rows = buildReviewSample(await loadAllCourses(), { perCourse, seed });
  const csv = toCsv(rows);
  if (out) {
    writeFileSync(out, csv);
    console.log(`ok: ${rows.length} linhas em ${out} (semente "${seed}", ${perCourse} por curso)`);
  } else {
    process.stdout.write(csv);
  }
}
