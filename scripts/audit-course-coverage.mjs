// #548: matriz de cobertura de tópicos por nível. Para cada tópico esperado em um nível do CEFR (lista editorial
// abaixo), diz se há aula dedicada e quantas frases o usam, e aponta lacunas. É heurística por regex sobre as
// frases publicadas: acusa onde olhar, não substitui a decisão pedagógica nem cria conteúdo.
import { writeFileSync, readFileSync } from 'node:fs';
import { SEQUENCE_CURRICULUM } from '../supabase/content/curriculum-sequence.mjs';
import { loadCourseContentSnapshot } from './course-content-snapshot.mjs';

export const DOC_FILE = 'docs/product/AUDITORIA_COBERTURA.md';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const THIN = 3; // menos frases que isso, sem aula dedicada, é cobertura fina

// level: nível em que o tópico é esperado; lesson: aula dedicada (opcional); regex: evidência nas frases.
export const TOPICS = [
  { level: 'A1', label: 'verbo to be', lesson: 'lesson-first-sentences-a1-01' },
  { level: 'A1', label: 'artigos a/an/the', lesson: 'lesson-pedagogy-a1-articles' },
  { level: 'A1', label: 'plural', lesson: 'lesson-pedagogy-a1-plurals' },
  { level: 'A1', label: 'this/that/these/those', lesson: 'lesson-pedagogy-a1-demonstratives' },
  { level: 'A1', label: 'there is / there are', lesson: 'lesson-first-sentences-a1-04' },
  { level: 'A1', label: 'possessivos', lesson: 'lesson-first-sentences-a1-05' },
  { level: 'A1', label: 'presente simples', lesson: 'lesson-first-sentences-a1-06' },
  { level: 'A1', label: 'can (habilidade e pedido)', lesson: 'lesson-first-sentences-a1-08' },
  { level: 'A1', label: 'imperativo', lesson: 'lesson-first-sentences-a1-09' },
  { level: 'A1', label: 'presente contínuo', lesson: 'lesson-pedagogy-a1-now' },
  { level: 'A1', label: 'perguntas com what/where/when/who/how', lesson: 'lesson-sequence-a1-wh' },
  { level: 'A1', label: 'some e any', lesson: 'lesson-pedagogy-a1-some-any' },
  { level: 'A1', label: 'pronomes de objeto', lesson: 'lesson-pedagogy-a1-object-pronouns' },
  { level: 'A1', label: 'preposições de lugar', lesson: 'lesson-prepositions-b1-02' },
  { level: 'A1', label: 'would like (pedir com educação)', regex: /\b(would like|'d like)\b/i },
  { level: 'A1', label: 'how much / how many', regex: /\bhow (much|many)\b/i },
  { level: 'A2', label: 'passado simples', lesson: 'lesson-pedagogy-a2-past-simple' },
  { level: 'A2', label: 'was / were', lesson: 'lesson-first-sentences-a1-11' },
  { level: 'A2', label: 'passado contínuo', lesson: 'lesson-tenses-b1-02' },
  { level: 'A2', label: 'comparativos', lesson: 'lesson-pedagogy-a2-comparatives' },
  { level: 'A2', label: 'superlativos', lesson: 'lesson-pedagogy-a2-superlatives' },
  { level: 'A2', label: 'contáveis e incontáveis', lesson: 'lesson-pedagogy-a2-countability' },
  { level: 'A2', label: 'too / enough', lesson: 'lesson-pedagogy-a2-too-enough' },
  { level: 'A2', label: 'futuro: will, going to', lesson: 'lesson-tenses-b1-05' },
  { level: 'A2', label: 'obrigação e conselho (have to, should)', lesson: 'lesson-pedagogy-a2-advice-rules' },
  { level: 'A2', label: 'primeira condicional', lesson: 'lesson-pedagogy-a2-simple-conditionals' },
  { level: 'A2', label: 'verbo + infinitivo/-ing', lesson: 'lesson-pedagogy-a2-verb-patterns' },
  { level: 'A2', label: 'experiências recentes (present perfect básico)', lesson: 'lesson-pedagogy-a2-recent-experiences' },
  { level: 'A2', label: 'as ... as (igualdade)', regex: /\bas \w+ as\b/i },
  { level: 'A2', label: 'pronomes reflexivos', regex: /\b(myself|yourself|himself|herself|itself|ourselves|themselves)\b/i },
  { level: 'A2', label: "let's / shall we (sugestões)", regex: /\b(let's|shall (we|I))\b/i },
  { level: 'A2', label: 'whose', regex: /\bwhose\b/i },
  { level: 'A2', label: 'a lot of / much / many / a few / a little', regex: /\b(a lot of|lots of|much|many|a few|a little)\b/i },
  { level: 'B1', label: 'present perfect × passado simples', lesson: 'lesson-tenses-b1-03' },
  { level: 'B1', label: 'present perfect contínuo', lesson: 'lesson-tenses-b1-04' },
  { level: 'B1', label: 'past perfect', lesson: 'lesson-tenses-b1-06' },
  { level: 'B1', label: 'used to', lesson: 'lesson-pedagogy-b1-used-to' },
  { level: 'B1', label: 'segunda condicional', lesson: 'lesson-tenses-b1-08' },
  { level: 'B1', label: 'orações relativas simples', lesson: 'lesson-pedagogy-b1-simple-relatives' },
  { level: 'B1', label: 'voz passiva (presente e passado)', lesson: 'lesson-tenses-b1-10' },
  { level: 'B1', label: 'discurso indireto', lesson: 'lesson-tenses-b1-12' },
  { level: 'B1', label: 'question tags', lesson: 'lesson-sequence-b1-tags' },
  { level: 'B1', label: 'probabilidade: might, may, must be', lesson: 'lesson-pedagogy-b1-probability' },
  { level: 'B1', label: 'contraste: although, despite, however', lesson: 'lesson-pedagogy-b1-reasons-contrast' },
  { level: 'B1', label: 'be able to', regex: /\b(am|is|are|was|were|be) able to\b/i },
  { level: 'B1', label: 'had better / be supposed to', regex: /\bhad better\b|\bsupposed to\b/i },
  { level: 'B1', label: 'so ... that / such ... that', regex: /\b(so|such) [^.?!]*\bthat\b/i },
  { level: 'B1', label: 'both / either / neither', regex: /\b(both|either|neither)\b/i },
  { level: 'B1', label: 'gerúndio depois de preposição', regex: /\b(of|at|in|about|for|by|without|before|after) \w+ing\b/i },
  { level: 'B2', label: 'terceira condicional', lesson: 'lesson-tenses-b1-09' },
  { level: 'B2', label: 'condicionais mistos', lesson: 'lesson-grammar-b2-02' },
  { level: 'B2', label: 'wish e if only', lesson: 'lesson-grammar-b2-01' },
  { level: 'B2', label: 'passiva em outros tempos', lesson: 'lesson-tenses-b1-11' },
  { level: 'B2', label: 'causativo (have/get)', lesson: 'lesson-grammar-b2-03' },
  { level: 'B2', label: 'futuro contínuo e perfeito', lesson: 'lesson-pedagogy-b2-future-perfect' },
  { level: 'B2', label: 'modais no passado (should have)', lesson: 'lesson-connected-b2-01' },
  { level: 'B2', label: 'gerúndio × infinitivo', lesson: 'lesson-grammar-b2-05' },
  { level: 'B2', label: 'orações relativas completas', lesson: 'lesson-grammar-b2-04' },
  { level: 'B2', label: 'verbos de relato (suggest, admit, deny + -ing)', regex: /\b(suggested|admitted|denied|advised|insisted|warned|promised|refused|suggests|admits|denies) (that |to |\w+ing )/i },
  { level: 'B2', label: 'the more ... the more', regex: /\bthe (more|less|\w+er)\b[^.?!]*\bthe (more|less|\w+er)\b/i },
  { level: 'B2', label: 'frases clivadas (it was ... that)', regex: /\bIt (was|is) [^.?!]* (that|who)\b|\bWhat I [^.?!]* is\b/i },
  { level: 'C1', label: 'inversão', lesson: 'lesson-grammar-b2-07' },
  { level: 'C1', label: 'ênfase', lesson: 'lesson-grammar-b2-06' },
  { level: 'C1', label: 'orações reduzidas (participiais)', lesson: 'lesson-pedagogy-c1-participle-clauses' },
  { level: 'C1', label: 'elipse e substituição', lesson: 'lesson-pedagogy-c1-ellipsis' },
  { level: 'C1', label: 'passivas para relatar', lesson: 'lesson-pedagogy-c1-reporting-passives' },
];

export async function coverage() {
  const courses = await loadCourseContentSnapshot();
  const units = new Map(courses.flatMap(c => c.lessons).map(l => [l.id, l.units]));
  const byId = new Map(SEQUENCE_CURRICULUM.map(l => [l.id, l]));
  return TOPICS.map(topic => {
    const lesson = topic.lesson ? byId.get(topic.lesson) : null;
    if (topic.lesson && !lesson) throw new Error(`Aula inexistente: ${topic.lesson}`);
    const perLevel = Object.fromEntries(LEVELS.map(level => [level, 0]));
    if (topic.regex) {
      for (const row of SEQUENCE_CURRICULUM.filter(l => l.role === 'base')) {
        for (const unit of units.get(row.id) || []) if (topic.regex.test(unit.text)) perLevel[row.level] += 1;
      }
    }
    const total = Object.values(perLevel).reduce((a, b) => a + b, 0);
    const expectedRank = LEVELS.indexOf(topic.level);
    const atOrAfter = LEVELS.slice(expectedRank).reduce((n, level) => n + perLevel[level], 0);
    let status;
    if (lesson) status = lesson.level === topic.level ? 'coberto' : LEVELS.indexOf(lesson.level) < expectedRank ? 'coberto antes' : 'coberto depois';
    else if (atOrAfter === 0) status = 'lacuna';
    else if (atOrAfter < THIN) status = 'fino';
    else status = 'em contexto';
    return { ...topic, lessonLevel: lesson?.level || null, perLevel, total, status };
  });
}

export async function buildDoc() {
  const rows = await coverage();
  const count = status => rows.filter(r => r.status === status).length;
  const gaps = rows.filter(r => r.status === 'lacuna' || r.status === 'fino');
  const table = rows.map(r => `| ${r.level} | ${r.label} | ${r.lesson ? `${r.lesson.replace('lesson-', '')} (${r.lessonLevel})` : '—'} | ${r.regex ? LEVELS.map(l => r.perLevel[l]).join(' / ') : '—'} | ${r.status} |`);
  return `# Auditoria de cobertura de tópicos por nível (#548)

Gerado por \`npm run content:coverage\`; não edite manualmente. Mede o que a trilha publicada cobre em relação a uma lista editorial de ${rows.length} tópicos esperados por nível (CEFR, em linha com os repertórios do British Council e do Conselho da Europa citados em CURRICULO_CEFR.md). Heurística por regex sobre as frases publicadas: aponta onde olhar, não cria conteúdo nem substitui decisão pedagógica.

## Resumo

- Coberto por aula dedicada no nível esperado: ${count('coberto')}
- Aula dedicada em nível anterior ao esperado: ${count('coberto antes')}; em nível posterior: ${count('coberto depois')}
- Só em contexto (sem aula dedicada, ${THIN}+ frases): ${count('em contexto')}
- Cobertura fina (1 a ${THIN - 1} frases): ${count('fino')}
- Lacuna (nenhuma frase no nível esperado ou depois): ${count('lacuna')}

## Lacunas e coberturas finas (candidatas a aula nova)

${gaps.length ? gaps.map(r => `- **${r.level} · ${r.label}**: ${r.status}${r.total ? ` (frases por nível A1/A2/B1/B2/C1: ${LEVELS.map(l => r.perLevel[l]).join(' / ')})` : ''}`).join('\n') : '- nenhuma'}

## Matriz completa

Colunas de frases: contagem em A1 / A2 / B1 / B2 / C1 nas aulas-base (só para tópicos sem aula dedicada).

| Nível esperado | Tópico | Aula dedicada | Frases por nível | Situação |
|---|---|---|---|---|
${table.join('\n')}
`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const doc = await buildDoc();
  if (process.argv.includes('--check')) {
    if (readFileSync(DOC_FILE, 'utf8') !== doc) { console.error(`${DOC_FILE} desatualizado: rode npm run content:coverage`); process.exit(1); }
    console.log('ok: auditoria de cobertura atualizada');
  } else {
    writeFileSync(DOC_FILE, doc);
    console.log(`${DOC_FILE} atualizado`);
  }
}
