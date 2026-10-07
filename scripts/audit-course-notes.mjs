// #544: auditoria de qualidade das notas de explicação. Mede o que é mensurável sem julgamento humano:
// notas ausentes, curtas, repetidas em muitas frases e sem nenhuma palavra da própria frase. Não altera frases.
// Preenchimento não é qualidade: o relatório lista amostras para revisão humana, não aprova conteúdo.
import { writeFileSync, readFileSync } from 'node:fs';
import { loadCourseContentSnapshot } from './course-content-snapshot.mjs';

export const DOC_FILE = 'docs/product/AUDITORIA_NOTAS.md';
export const SHORT_NOTE = 25;
export const REPEATED_MIN = 5;
const SAMPLE_PER_GROUP = 12;

const normalize = text => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
const words = text => normalize(text).match(/[a-z']+/g) || [];
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'is', 'am', 'are', 'it', 'i', 'you', 'and', 'or', 'do', 'no', 'so']);

export function analyzeNotes(courses) {
  const units = courses.flatMap(c => c.lessons.flatMap(l => l.units.map(u => ({ ...u, lessonId: l.id }))));
  const withNote = units.filter(u => normalize(u.note ?? u.explanation_note));
  const noteOf = u => normalize(u.note ?? u.explanation_note);
  const counts = new Map();
  for (const u of withNote) counts.set(noteOf(u), (counts.get(noteOf(u)) || 0) + 1);
  const repeated = [...counts].filter(([, n]) => n >= REPEATED_MIN).sort((a, b) => b[1] - a[1]);
  const repeatedSet = new Set(repeated.map(([text]) => text));
  const short = withNote.filter(u => noteOf(u).length < SHORT_NOTE);
  const unrelated = withNote.filter(u => {
    const own = words(u.text).filter(w => !STOP.has(w));
    const note = new Set(words(noteOf(u)));
    return own.length > 0 && !own.some(w => note.has(w) || [...note].some(n => n.length > 3 && w.startsWith(n.slice(0, 4))));
  });
  const kinds = {};
  for (const u of units) {
    const kind = u.kind || 'sentence';
    kinds[kind] ??= { total: 0, noNote: 0, withGroups: 0 };
    kinds[kind].total += 1;
    if (!normalize(u.note ?? u.explanation_note)) kinds[kind].noNote += 1;
    if (Array.isArray(u.groups ?? u.syntax_groups) && (u.groups ?? u.syntax_groups).length) kinds[kind].withGroups += 1;
  }
  return {
    total: units.length,
    withNote: withNote.length,
    noNote: units.length - withNote.length,
    short: short.length,
    repeatedNotes: repeated.length,
    unitsInRepeated: withNote.filter(u => repeatedSet.has(noteOf(u))).length,
    unrelated: unrelated.length,
    kinds,
    repeated: repeated.slice(0, 15),
    samples: {
      short: short.slice(0, SAMPLE_PER_GROUP).map(u => [u.id, u.text, noteOf(u)]),
      unrelated: unrelated.slice(0, SAMPLE_PER_GROUP).map(u => [u.id, u.text, noteOf(u)]),
    },
  };
}

const cell = text => String(text).replaceAll('|', '/').replace(/\s+/g, ' ');
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '0%');

export function renderDoc(a) {
  return `# Auditoria de qualidade das notas (#544)

Gerado por \`npm run content:notes\`; não edite manualmente. Mede o que é verificável por máquina e **não aprova** qualidade pedagógica: a revisão humana por amostragem (\`npm run content:review\`) continua pendente. Nenhuma frase foi alterada ou removida.

## Resumo

| Medida | Unidades | % |
|---|---:|---:|
| Total de unidades | ${a.total} | 100% |
| Com nota de explicação | ${a.withNote} | ${pct(a.withNote, a.total)} |
| Sem nota | ${a.noNote} | ${pct(a.noNote, a.total)} |
| Nota curta (< ${SHORT_NOTE} caracteres) | ${a.short} | ${pct(a.short, a.total)} |
| Nota repetida em ${REPEATED_MIN}+ unidades (${a.repeatedNotes} textos) | ${a.unitsInRepeated} | ${pct(a.unitsInRepeated, a.total)} |
| Nota sem nenhuma palavra da frase | ${a.unrelated} | ${pct(a.unrelated, a.total)} |

## Por tipo de unidade

| Tipo | Unidades | Sem nota | Com estrutura da frase (grupos sintáticos) |
|---|---:|---:|---:|
${Object.entries(a.kinds).map(([kind, k]) => `| ${kind} | ${k.total} | ${k.noNote} | ${k.withGroups} (${pct(k.withGroups, k.total)}) |`).join('\n')}

## Notas mais repetidas

${a.repeated.length ? a.repeated.map(([text, n]) => `- ${n}x: ${cell(text)}`).join('\n') : '- nenhuma'}

## Amostras para revisão humana

### Notas curtas
${a.samples.short.map(([id, text, note]) => `- ${id}: "${cell(text)}" → ${cell(note)}`).join('\n') || '- nenhuma'}

### Notas sem palavra da frase
${a.samples.unrelated.map(([id, text, note]) => `- ${id}: "${cell(text)}" → ${cell(note)}`).join('\n') || '- nenhuma'}

## Como usar

Notas repetidas e sem relação com a frase são candidatas a reescrita, por lote, com revisão humana; frases sem grupos sintáticos dependem das Issues #510 e #507. O painel de explicação já mostra palavra por palavra e o foco da aula quando não há estrutura (#544).
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const doc = renderDoc(analyzeNotes(await loadCourseContentSnapshot()));
  if (process.argv.includes('--check')) {
    if (readFileSync(DOC_FILE, 'utf8') !== doc) { console.error(`${DOC_FILE} desatualizado: rode npm run content:notes`); process.exit(1); }
    console.log('ok: auditoria de notas atualizada');
  } else {
    writeFileSync(DOC_FILE, doc);
    console.log(`${DOC_FILE} atualizado`);
  }
}
