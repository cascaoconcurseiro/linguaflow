import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare } from '../dashboard/js/ui/progressView.js';
import { formatDateTime } from '../dashboard/js/ui/courses/courseUi.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const home = read('dashboard/js/ui/homeView.js');
const progress = read('dashboard/js/ui/progressView.js');
const courseHome = read('dashboard/js/ui/courses/courseHome.js');

// Dois conceitos de sequência com nomes distintos.
assert.match(home, /Ofensiva de revisões/);
assert.doesNotMatch(home, /Dias de Ofensiva/);
assert.match(home, /ofensiva de revisões de \$\{streak\}/);
assert.match(progress, /Dias seguidos de estudo/);
assert.doesNotMatch(progress, /<span>Sequência<\/span>/);

// Unidades de fila rotuladas.
assert.match(home, /Cartões para hoje/);
assert.doesNotMatch(home, /Revisões de hoje/);
assert.match(courseHome, /frases dos cursos vencem/);

// Comparação sem base confiável não é exibida.
assert.equal(compare(314, 2, { baseCount: 2 }), '');
assert.equal(compare(95.9, 50, { baseCount: 2 }), '');
assert.match(compare(95.9, 50, { baseCount: 40 }), /▲/);
assert.match(compare(30, 20), /▲/);

// Instantes não carregam sufixo UTC.
assert.doesNotMatch(formatDateTime('2026-10-02T18:12:00Z'), /UTC/);
console.log('ux-labels-395 ok');
