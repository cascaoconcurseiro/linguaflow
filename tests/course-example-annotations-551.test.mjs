// #551: toda frase de exemplo tem palavra por palavra no banco (migration derivada do dicionário publicado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadCourseContentSnapshot } from '../scripts/course-content-snapshot.mjs';
import { LEXICON as BASE_LEXICON } from '../supabase/content/lexicon.mjs';

const migrationUrl = new URL('../supabase/migrations/20261008120000_course_example_annotations_551.sql', import.meta.url);
const sql = readFileSync(migrationUrl, 'utf8');
const strip = token => token.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '');

async function lexiconKeys() {
  const keys = new Set(Object.keys(BASE_LEXICON));
  const dir = new URL('../supabase/content/batches/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs'))) {
    const mod = await import(new URL(file, dir).href);
    for (const key of Object.keys(mod.LEXICON || {})) keys.add(key.toLowerCase());
  }
  const legacy = await import(new URL('../supabase/content/courses.mjs', import.meta.url).href);
  for (const key of Object.keys(legacy.LEXICON || {})) keys.add(key.toLowerCase());
  return keys;
}

function extraWords() {
  const block = sql.slice(sql.indexOf('INSERT INTO _extra_551'), sql.indexOf('CREATE TEMP TABLE _dict_551'));
  return [...block.matchAll(/\('((?:[^']|'')+)','([^']+)','([^']+)','((?:[^']|'')+)'\)/g)].map(m => ({ w: m[1].replaceAll("''", "'"), pos: m[2], ipa: m[3], gloss: m[4] }));
}

test('migration é aditiva, idempotente e protegida: só coluna derivada, guarda contra palavra sem dicionário', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS example_annotations jsonb/);
  assert.match(sql, /RAISE EXCEPTION 'palavras do exemplo sem dicionário/);
  assert.doesNotMatch(sql, /\b(DELETE FROM|TRUNCATE)\b|DROP TABLE (?!_tok_551|_dict_551|_extra_551)/i);
  assert.match(sql, /DROP TABLE _tok_551, _dict_551, _extra_551;/, 'tabelas temporárias removidas ao final');
  assert.doesNotMatch(sql, /ON COMMIT DROP/, 'o replay do CI roda cada arquivo em autocommit');
  assert.doesNotMatch(sql, /UPDATE public\.(?!course_units)/);
  assert.doesNotMatch(sql, /SET (text|translation_pt|ipa|explanation_note|annotations|syntax_groups)\b/);
  const rollback = readFileSync(new URL('../supabase/rollback/course_example_annotations_551.sql', import.meta.url), 'utf8');
  assert.match(rollback, /DROP COLUMN IF EXISTS example_annotations/);
});

test('as palavras acrescentadas têm classe, IPA entre barras e glosa, sem duplicatas', () => {
  const extras = extraWords();
  assert.ok(extras.length >= 130, `${extras.length} palavras`);
  assert.equal(new Set(extras.map(e => e.w)).size, extras.length);
  for (const e of extras) {
    assert.match(e.ipa, /^\/.+\/$/, e.w);
    assert.ok(e.gloss.length > 1 && e.pos.length > 2, e.w);
    assert.equal(e.w, e.w.toLowerCase(), e.w);
  }
});

test('toda palavra das 1100 frases de exemplo está no léxico publicado ou entre as acrescentadas', async () => {
  const known = await lexiconKeys();
  for (const e of extraWords()) known.add(e.w);
  const courses = await loadCourseContentSnapshot();
  let examples = 0;
  const missing = new Set();
  for (const unit of courses.flatMap(c => c.lessons.flatMap(l => l.units))) {
    const english = unit.example?.[0] ?? unit.example_en;
    if (!english) continue;
    examples += 1;
    for (const raw of english.split(/\s+/)) {
      const word = strip(raw).toLowerCase();
      if (word && !known.has(word)) missing.add(word);
    }
  }
  assert.equal(examples, 1100);
  assert.deepEqual([...missing].sort(), []);
});
