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
  { id: 'passive', label: 'voz passiva', regex: /\b(is|are|was|were|been|being) (\w+ed|made|done|given|taken|seen|written|built|sold|known|told|found|paid|kept|held|left|lost|chosen|broken|stolen) (by|in|on|at|to|for)\b/i, teachesIn: 'lesson-tenses-b1-10' },
  { id: 'reported', label: 'discurso indireto', regex: /\b(said|told me|asked me|asked if|wondered if) (that|if|whether|me to|him to|her to)\b/i, teachesIn: 'lesson-tenses-b1-12' },
  { id: 'relative', label: 'oração relativa', regex: /\b\w+ (who|which|whose|whom) (is|are|was|were|has|have|had|\w+s|I|you|he|she|we|they)\b/i, teachesIn: 'lesson-pedagogy-b1-simple-relatives' },
  { id: 'would', label: 'would (hipótese)', regex: /\bwould(n't)? (be|have|go|like to|never|rather)\b|\b(I|you|he|she|we|they)'d (be|have|go|rather|better)\b/i, teachesIn: 'lesson-modals-b1-06' },
  { id: 'third-conditional', label: 'terceira condicional', regex: /\bif .* had(n't)? \w+.* would(n't)? have\b|\bwould(n't)? have .* if .* had\b/i, teachesIn: 'lesson-tenses-b1-09' },
  { id: 'wish', label: 'wish / if only', regex: /\b(wish|if only)\b/i, teachesIn: 'lesson-tenses-b1-08' },
  { id: 'causative', label: 'causativo', regex: /\b(have|had|get|got) (my|your|his|her|our|their|the|a) \w+ (\w+ed|done|fixed|cut|repaired|painted|cleaned)\b/i, teachesIn: 'lesson-grammar-b2-03' },
  { id: 'might-may', label: 'might / may', regex: /\b(might|may) (be|not|have|go|come|need|want|rain|take)\b/i, teachesIn: 'lesson-pedagogy-b1-probability' },
  { id: 'past-perfect', label: 'past perfect', regex: /\bhad (already|never|just|not|been|gone|seen|done|\w+ed)\b/i, teachesIn: 'lesson-tenses-b1-06' },
  { id: 'perfect-continuous', label: 'perfect contínuo', regex: /\b(have|has|had) been \w+ing\b/i, teachesIn: 'lesson-tenses-b1-04' },
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
  'lesson-prepositions-b1-03|passive': 'adjetivo participial com preposição ("married to"), não voz passiva',
  'lesson-survival-a2-01|relative': CHUNK,
  'lesson-stories-b1-01|reported': 'narrativa com discurso indireto como moldura de história, sem análise da estrutura',
  'lesson-pedagogy-b1-duration|perfect-continuous': CONTEXT,
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

// Palavras novas por aula (tipos ainda não vistos nas aulas-base anteriores da trilha) e comprimento das frases.
// Informativo: não reprova, mas denuncia aula cujo nível parece desproporcional ao que veio antes.
export async function vocabularyLoad() {
  const courses = await loadCourseContentSnapshot();
  const units = new Map(courses.flatMap(c => c.lessons).map(l => [l.id, l.units]));
  const seen = new Set();
  const perLevel = {};
  const lessonsLoad = [];
  for (const lesson of SEQUENCE_CURRICULUM.filter(l => l.role === 'base' && l.level !== 'C1').sort((a, b) => a.order - b.order)) {
    const list = units.get(lesson.id) || [];
    const words = list.flatMap(u => u.text.toLowerCase().match(/[a-z']+/g) || []);
    const fresh = new Set(words.filter(w => !seen.has(w)));
    words.forEach(w => seen.add(w));
    const sentences = list.filter(u => u.kind === 'sentence');
    const bucket = perLevel[lesson.level] ||= { lessons: 0, fresh: 0, longest: 0, sentenceWords: 0, sentences: 0 };
    if (sentences.length) { bucket.lessons += 1; bucket.fresh += fresh.size; }
    for (const u of sentences) {
      const length = (u.text.match(/[A-Za-z']+/g) || []).length;
      bucket.longest = Math.max(bucket.longest, length); bucket.sentenceWords += length; bucket.sentences += 1;
    }
    if (sentences.length) lessonsLoad.push({ id: lesson.id, level: lesson.level, fresh: fresh.size, tokens: words.length });
  }
  return { perLevel, top: lessonsLoad.sort((a, b) => b.fresh - a.fresh).slice(0, 8) };
}

export async function buildDoc() {
  const { found, unexplained, lessons } = await auditSequence();
  const load = await vocabularyLoad();
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

É heurística por expressão regular: acusa candidatos e não mede qualidade pedagógica nem substitui revisão humana. Cobre 23 estruturas (ver lista acima); vocabulário e coesão textual não são verificados por regra.

## Resultado

${found.length} frases em ${byKey.size} combinações aula/estrutura. Sem exceção declarada: ${unexplained.length}. Nenhuma frase foi alterada ou removida: as exceções são fórmulas de sobrevivência ("Can you repeat that?") ou molduras de exemplo ("There is a cup on the table") cuja aula-alvo depende da aula marcada, então reordenar criaria pré-requisito circular. Se algum item deixar de ser aceitável, a correção é uma migration append-only que ajuste \`curriculum_order\`, nunca editar a #535 publicada.

## Carga de vocabulário e comprimento das frases

Palavras novas por aula-de-frases (tipos ainda não vistos nas aulas-base anteriores) e comprimento médio/máximo das frases, por nível. Sem limite que reprove: serve para achar aula desproporcional ao nível. Não substitui lista de frequência/CEFR de vocabulário (não há uma publicada no projeto).

| Nível | Aulas de frases | Palavras novas por aula (média) | Palavras por frase (média) | Frase mais longa |
|---|---:|---:|---:|---:|
${Object.entries(load.perLevel).map(([level, b]) => `| ${level} | ${b.lessons} | ${(b.fresh / Math.max(1, b.lessons)).toFixed(1)} | ${(b.sentenceWords / Math.max(1, b.sentences)).toFixed(1)} | ${b.longest} |`).join('\n')}

Maior carga de palavras novas: ${load.top.map(t => `${t.id.replace('lesson-', '')} (${t.level}, ${t.fresh})`).join('; ')}.

## Estruturas antes do nível

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
