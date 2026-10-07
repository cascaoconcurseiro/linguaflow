import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('histórico é autoritativo e migration mantém progresso existente', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261007154111_course_level_history_537.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE public\.course_level_completions/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ON CONFLICT \(user_id, level\) DO NOTHING/);
  assert.match(sql, /CREATE TRIGGER/);
  assert.doesNotMatch(sql, /(?:DELETE FROM|UPDATE) public\.(?:course_units|course_user_reviews|user_course_enrollment)/);
});
