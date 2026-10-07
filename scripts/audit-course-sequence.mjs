// #544: auditoria de sequência. Para cada frase da base A1–B2, detecta estruturas gramaticais que a trilha
// só ensina numa aula posterior. É uma heurística por expressões regulares: acusa candidatos, não substitui
// revisão humana. Exceções (fórmulas ensinadas como bloco) ficam declaradas com motivo e são conferidas pelo teste.
import { writeFileSync, readFileSync } from 'node:fs';
import { SEQUENCE_CURRICULUM } from '../supabase/content/curriculum-sequence.mjs';
import { loadCourseContentSnapshot } from './course-content-snapshot.mjs';

export const DOC_FILE = 'docs/product/AUDITORIA_SEQUENCIA.md';

// Estrutura -> aula que a ensina. Frases dessa aula e das seguintes podem usá-la livremente.
export const MARKERS = [
  { id: 'can', label: "can / can't", regex: /\b(can|can't|cannot)\b/i, teachesIn: 'lesson-first-sentences-a1-08' },
  { id: 'do-does', label: "do / does / don't", regex: /\b(do|does|don't|doesn't)\b/i, teachesIn: 'lesson-first-sentences-a1-06' },
  { id: 'there-is', label: 'there is / there are', regex: /\bthere (is|are)\b|\bthere's\b/i, teachesIn: 'lesson-first-sentences-a1-04' },
  { id: 'progressive', label: 'presente contínuo', regex: /\b(am|is|are) \w+ing\b|\b(I'm|you're|he's|she's|we're|they're) \w+ing\b/i, teachesIn: 'lesson-pedagogy-a1-now' },
  { id: 'was-were', label: 'was / were', regex: /\b(was|were|wasn't|weren't)\b/i, teachesIn: 'lesson-first-sentences-a1-11' },
  { id: 'did', label: "did / didn't", regex: /\b(did|didn't)\b/i, teachesIn: 'lesson-pedagogy-a2-past-simple' },
  { id: 'future', label: 'will / going to', regex: /\b(will|won't|going to|gonna)\b/i, teachesIn: 'lesson-tenses-b1-05' },
  { id: 'could', label: 'could', regex: /\bcould(n't)?\b/i, teachesIn: 'lesson-modals-b1-02' },
  { id: 'obligation', label: 'should / have to / must', regex: /\b(have to|has to|should|shouldn't|must|mustn't)\b/i, teachesIn: 'lesson-pedagogy-a2-advice-rules' },
  { id: 'if', label: 'if (condicional)', regex: /\bif\b/i, teachesIn: 'lesson-pedagogy-a2-simple-conditionals' },
  { id: 'comparative', label: 'comparativo', regex: /\b\w+er than\b|\bmore \w+ than\b/i, teachesIn: 'lesson-pedagogy-a2-comparatives' },
  { id: 'perfect', label: 'present perfect', regex: /\b(have|has|haven't|hasn't) (already|ever|never|just|been|gone|seen|done|\w+ed)\b/i, teachesIn: 'lesson-pedagogy-a2-recent-experiences' },
  { id: 'used-to', label: 'used to', regex: /\bused to\b/i, teachesIn: 'lesson-pedagogy-b1-used-to' },
];

const CHUNK = 'fórmula de sobrevivência ensinada como bloco, sem análise gramatical';
const CONTEXT = 'estrutura aparece como moldura do exemplo; a aula que a ensina depende desta (pré-requisito circular)';
// Chave `${aula}|${estrutura}`. Cada exceção precisa continuar sendo uma violação real (teste de exceção obsoleta).
export const ALLOWED = {
  'lesson-pedagogy-a1-clarify|can': CHUNK,
  'lesson-pedagogy-a1-clarify|do-does': CHUNK,
  'lesson-sequence-a1-m1|can': CHUNK,
  'lesson-numbers-a1-03|can': CHUNK,
  'lesson-numbers-a1-02|can': CHUNK,
  'lesson-numbers-a1-02|do-does': CHUNK,
  'lesson-numbers-a1-02|future': CHUNK,
  'lesson-numbers-a1-02|was-were': CHUNK,
  'lesson-pedagogy-a1-object-pronouns|can': CHUNK,
  'lesson-pedagogy-a1-basic-connectors|can': CHUNK,
  'lesson-pedagogy-a1-articles|there-is': CONTEXT,
  'lesson-pedagogy-a1-plurals|there-is': CONTEXT,
  'lesson-prepositions-b1-01|future': CONTEXT,
  'lesson-first-sentences-a1-08|could': CHUNK,
  'lesson-social-a2-02|obligation': CHUNK,
};

export async function auditSequence() {
  const courses = await loadCourseContentSnapshot();
  const units = new Map(courses.flatMap(c => c.lessons).map(l => [l.id, l.units]));
  const order = new Map(SEQUENCE_CURRICULUM.map(l => [l.id, l.order]));
  const base = SEQUENCE_CURRICULUM.filter(l => l.role === 'base' && l.level !== 'C1');
  const found = [];
  for (const marker of MARKERS) {
    if (order.get(marker.teachesIn) === undefined) throw new Error(`Aula inexistente: ${marker.teachesIn}`);
  }
  for (const lesson of base) {
    for (const unit of units.get(lesson.id) || []) {
      for (const marker of MARKERS) {
        if (lesson.order < order.get(marker.teachesIn) && marker.regex.test(unit.text)) {
          found.push({ lessonId: lesson.id, level: lesson.level, order: lesson.order, marker: marker.id, label: marker.label, teachesIn: marker.teachesIn, unitId: unit.id, text: unit.text });
        }
      }
    }
  }
  const unexplained = found.filter(v => !ALLOWED[`${v.lessonId}|${v.marker}`]);
  const stale = Object.keys(ALLOWED).filter(key => !found.some(v => `${v.lessonId}|${v.marker}` === key));
  return { found, unexplained, stale, lessons: base.length };
}

export async function buildDoc() {
  const { found, unexplained, lessons } = await auditSequence();
  const byKey = new Map();
  for (const v of found) {
    const key = `${v.lessonId}|${v.marker}`;
    const entry = byKey.get(key) || { ...v, count: 0 };
    entry.count += 1; byKey.set(key, entry);
  }
  const rows = [...byKey.values()].sort((a, b) => a.order - b.order || a.marker.localeCompare(b.marker)).map(v => `| ${v.level} | ${v.lessonId.replace('lesson-', '')} | ${v.label} | ${v.teachesIn.replace('lesson-', '')} | ${v.count} | ${v.text.replaceAll('|', '/')} | ${ALLOWED[`${v.lessonId}|${v.marker}`] || '**sem exceção**'} |`);
  return `# Auditoria de sequência pedagógica (#544)

Gerado por \`npm run content:audit\`; não edite manualmente. O teste \`tests/course-sequence-audit-544.test.mjs\` falha se surgir violação sem exceção declarada ou exceção obsoleta.

## O que verifica

Para cada frase das ${lessons} aulas-base de A1 a B2 (C1 fica fora: sem blocos de gramática comparáveis), procura estruturas que a trilha só ensina depois. Estrutura (aula que a ensina): ${MARKERS.map(m => `${m.label} (${m.teachesIn.replace('lesson-', '')})`).join('; ')}.

É heurística por expressão regular: acusa candidatos e não mede qualidade pedagógica nem substitui revisão humana. Estruturas de leitura (passiva, relativas, discurso indireto) não são verificadas.

## Resultado

${found.length} frases em ${byKey.size} combinações aula/estrutura. Sem exceção declarada: ${unexplained.length}. Nenhuma frase foi alterada ou removida: as exceções são fórmulas de sobrevivência ("Can you repeat that?") ou molduras de exemplo ("There is a cup on the table") cuja aula-alvo depende da aula marcada, então reordenar criaria pré-requisito circular. Se algum item deixar de ser aceitável, a correção é uma migration append-only que ajuste \`curriculum_order\`, nunca editar a #535 publicada.

| Nível | Aula | Estrutura | Ensinada em | Frases | Exemplo | Situação |
|---|---|---|---|---:|---|---|
${rows.join('\n') || '| — | — | — | — | 0 | — | — |'}
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const doc = await buildDoc();
  if (process.argv.includes('--check')) {
    if (readFileSync(DOC_FILE, 'utf8') !== doc) { console.error(`${DOC_FILE} desatualizado: rode npm run content:audit`); process.exit(1); }
    console.log('ok: auditoria de sequência atualizada');
  } else {
    writeFileSync(DOC_FILE, doc);
    const { unexplained, stale } = await auditSequence();
    console.log(`${DOC_FILE} atualizado; sem exceção: ${unexplained.length}; exceções obsoletas: ${stale.length}`);
  }
}
