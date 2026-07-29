import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const migrationName = readdirSync(migrationsDir)
  .find((name) => name.endsWith('_seed_fluency_task_catalog_v1.sql'));

assert.ok(migrationName, 'migration seed_fluency_task_catalog_v1 existe');
const sql = readFileSync(join(migrationsDir, migrationName), 'utf8');
const catalogMatch = sql.match(/\$catalog\$\s*([\s\S]*?)\s*\$catalog\$::jsonb/i);
assert.ok(catalogMatch, 'seed mantém catálogo em JSON versionado e auditável');

const rows = JSON.parse(catalogMatch[1]);
const levels = ['A1', 'A2', 'B1', 'B2'];
const skills = ['listening', 'speaking_spontaneous', 'writing', 'interaction'];

assert.equal(rows.length, 32);
assert.equal(new Set(rows.map((row) => row.task_key)).size, 32);

for (const level of levels) {
  for (const skill of skills) {
    const pair = rows.filter((row) => row.level === level && row.skill === skill);
    assert.equal(pair.length, 2, `${level}/${skill} precisa de duas tarefas`);
    assert.equal(new Set(pair.map((row) => row.family)).size, 2);
  }
}

for (const row of rows) {
  assert.equal(row.catalog_version, '2026.07.1');
  assert.equal(row.ceiling_level, row.level);
  assert.equal(row.rubric.version, 'fluency-rubric-v1');
  assert.ok(row.rubric.critical_dimensions.includes('task_completion'));
  assert.ok(row.public_material.instruction);
  assert.ok(row.public_material.objective);
  assert.ok(row.public_material.audience);
  assert.equal('model_answer' in row.public_material, false);
  assert.equal('sample_response' in row.public_material, false);
  assert.equal('answer' in row.public_material, false);
  assert.equal('transcript' in row.public_material, false);
  assert.equal('correct_answer' in row.public_material, false);

  if (row.skill === 'listening') {
    assert.equal(row.public_material.options.length, 4);
    assert.ok(row.public_material.duration_seconds.min > 0);
    assert.ok(row.answer_key.transcript.length >= 10);
    assert.ok(Number.isInteger(row.answer_key.correct_answer));
    assert.ok(row.answer_key.correct_answer >= 0 && row.answer_key.correct_answer < 4);
  } else if (row.skill === 'speaking_spontaneous') {
    assert.ok(row.public_material.duration_seconds.min > 0);
    assert.ok(row.answer_key.required_moves.length >= 2);
  } else if (row.skill === 'writing') {
    assert.ok(row.public_material.word_count.min > 0);
    assert.ok(row.public_material.word_count.max >= row.public_material.word_count.min);
    assert.ok(row.answer_key.required_moves.length >= 2);
  } else {
    assert.ok(row.public_material.turns.min >= 3);
    assert.ok(row.public_material.turns.max >= row.public_material.turns.min);
    assert.ok(row.answer_key.required_moves.length >= 2);
  }
}

assert.match(sql, /create table private\.fluency_task_catalog/i);
assert.match(sql, /public_material jsonb not null/i);
assert.match(sql, /answer_key jsonb not null/i);
assert.match(sql, /rubric jsonb not null/i);
assert.match(sql, /revoke all on table private\.fluency_task_catalog from public, anon, authenticated/i);
assert.doesNotMatch(
  sql,
  /grant\s+(?:select|insert|update|delete)[^;]*private\.fluency_task_catalog[^;]*to\s+(?:public|anon|authenticated)/i,
);
assert.match(sql, /on conflict \(task_key\) do update/i);
assert.doesNotMatch(sql, /create table public\.fluency_task_catalog/i);

console.log('Seed privada do catálogo de fluência passou.');
