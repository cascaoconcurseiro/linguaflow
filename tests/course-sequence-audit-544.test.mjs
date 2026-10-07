// #544: a sequência não pode usar estrutura antes de ensiná-la sem exceção declarada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditSequence, buildDoc, MARKERS, ALLOWED, DOC_FILE } from '../scripts/audit-course-sequence.mjs';

test('nenhuma violação sem exceção declarada e nenhuma exceção obsoleta', async () => {
  const { unexplained, stale, lessons } = await auditSequence();
  assert.equal(lessons, 247 - 14, 'aulas-base A1–B2 auditadas');
  assert.deepEqual(unexplained.map(v => `${v.lessonId}|${v.marker}: ${v.text}`), []);
  assert.deepEqual(stale, []);
});

test('toda exceção tem motivo e todo marcador aponta para aula que existe', async () => {
  for (const [key, reason] of Object.entries(ALLOWED)) assert.match(reason, /.{20,}/, key);
  const { SEQUENCE_CURRICULUM } = await import('../supabase/content/curriculum-sequence.mjs');
  const ids = new Set(SEQUENCE_CURRICULUM.map(l => l.id));
  for (const m of MARKERS) assert.ok(ids.has(m.teachesIn), m.id);
});

test('os marcadores reconhecem as estruturas e não acusam texto neutro', () => {
  const hit = (id, text) => MARKERS.find(m => m.id === id).regex.test(text);
  assert.ok(hit('can', "I can't find my keys."));
  assert.ok(hit('do-does', 'What does this mean?'));
  assert.ok(hit('there-is', "There's a bus."));
  assert.ok(hit('progressive', "I'm studying now."));
  assert.ok(hit('was-were', 'We were late.'));
  assert.ok(hit('future', "I'm going to leave."));
  assert.ok(hit('perfect', 'She has just arrived.'));
  assert.ok(hit('used-to', 'I used to smoke.'));
  assert.ok(!hit('can', 'I am a student.'));
  assert.ok(!hit('if', 'This is a gift.'));
  assert.ok(!hit('comparative', 'She is my sister.'));
});

test('o documento gerado está atualizado', async () => {
  assert.equal(readFileSync(new URL('../' + DOC_FILE, import.meta.url), 'utf8'), await buildDoc());
});
