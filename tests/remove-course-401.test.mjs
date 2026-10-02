import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const store = readFileSync(new URL('../dashboard/js/ui/courses/courseStore.js', import.meta.url), 'utf8');

// Em Meus cursos o botão diz o que faz (remover), não "✓ Em Meus cursos".
assert.match(store, /function courseCard\(course, \{ showToggle = true, inMineLabel = '✓ Em Meus cursos' \} = \{\}\)/);
assert.match(store, /courseCard\(c, \{ inMineLabel: 'Remover da lista' \}\)/);
// Avisa como desfazer.
assert.match(store, /Para voltar, use a Loja/);
console.log('remove-course-401 ok');
