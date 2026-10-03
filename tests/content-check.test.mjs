import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, lexiconStub, missingWords } from '../scripts/content-check.mjs';
import { generateFrom } from '../scripts/generate-course-seed.mjs';

test('todos os lotes de conteúdo são válidos e iguais às migrations publicadas (#428)', async () => {
  const results = await checkAll();
  assert.ok(results.length > 40, 'deve cobrir todos os lotes');
  const broken = results.filter((r) => r.errors.length);
  assert.deepEqual(broken.map((r) => `${r.name}: ${r.errors[0]}`), []);
  const drifted = results.filter((r) => r.drift);
  assert.deepEqual(drifted.map((r) => r.name), [], 'migration publicada é imutável: o lote mudou depois de publicado');
  assert.ok(results.filter((r) => r.migration).length >= results.length - 3, 'quase todo lote precisa ter migration');
});

test('erro de léxico vira lista pronta para o editor completar', () => {
  const course = {
    id: 'c', slug: 'c', title: 'T', short: 's', long: 'l', level: 'A1', category: 'x', order: 1,
    track: 'fundamentos', trackOrder: 1,
    lessons: [{ id: 'lesson-c-1', chapter: 1, title: 'L', description: 'd', units: [
      { kind: 'sentence', text: 'Zorblax runs.', pt: 'Zorblax corre.', note: 'n', groups: [] },
    ] }],
  };
  const { errors } = generateFrom([course], { lexicon: {}, format: 2, requireNotes: true });
  assert.deepEqual(missingWords(errors), ['runs', 'zorblax']);
  assert.match(lexiconStub(['runs', "o'clock"]), /runs: \['', '\/…\/', ''\],\n  "o'clock":/);
});
