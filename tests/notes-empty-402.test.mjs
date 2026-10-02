import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const notes = read('dashboard/js/ui/courses/courseNotebooks.js');
const progress = read('dashboard/js/ui/progressView.js');

// Estado vazio de notas ensina com exemplo e leva a uma ação.
assert.match(notes, /Exemplo de nota/);
assert.match(notes, /label: 'Ir para Meus cursos', onClick: \(\) => ctx\.navigate\('my-courses'\)/);
// Rótulo de "difíceis" explica o limiar real (leech_threshold), não só "erra com frequência".
assert.match(progress, /esquecimentos/);
assert.doesNotMatch(progress, /\(erra com frequência\)/);
console.log('notes-empty-402 ok');
