// #544: métricas de qualidade das notas (lógica pura + documento gerado sempre atualizado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeNotes, renderDoc, DOC_FILE, REPEATED_MIN, SHORT_NOTE } from '../scripts/audit-course-notes.mjs';
import { loadCourseContentSnapshot } from '../scripts/course-content-snapshot.mjs';

const unit = (id, text, note, extra = {}) => ({ id, text, note, kind: 'sentence', ...extra });
const course = units => [{ lessons: [{ id: 'l1', units }] }];

test('conta ausentes, curtas, repetidas e sem relação com a frase', () => {
  const repeatedNote = 'Esta é uma nota genérica repetida em várias frases.';
  const units = [
    unit('a', 'I like coffee.', 'Verbo like com coffee: gostar de algo.'),
    unit('b', 'She runs.', ''),
    unit('c', 'We go.', 'curta'),
    unit('d', 'The bus is late.', 'Explica um assunto totalmente diferente sobre pronomes.'),
    ...Array.from({ length: REPEATED_MIN }, (_, i) => unit(`r${i}`, `Sentence number ${i}.`, repeatedNote)),
  ];
  const a = analyzeNotes(course(units));
  assert.equal(a.total, 4 + REPEATED_MIN);
  assert.equal(a.noNote, 1);
  assert.equal(a.withNote, 3 + REPEATED_MIN);
  assert.equal(a.short, 1);
  assert.ok('curta'.length < SHORT_NOTE);
  assert.equal(a.repeatedNotes, 1);
  assert.equal(a.unitsInRepeated, REPEATED_MIN);
  assert.ok(a.unrelated >= 1);
  assert.equal(a.repeated[0][1], REPEATED_MIN);
});

test('aceita explanation_note e syntax_groups do banco além de note/groups do snapshot', () => {
  const a = analyzeNotes(course([{ id: 'x', text: 'Hello there.', explanation_note: 'Saudação: hello é informal.', syntax_groups: [{ surface: 'Hello' }], kind: 'sentence' }]));
  assert.equal(a.withNote, 1);
  assert.equal(a.kinds.sentence.withGroups, 1);
});

test('conjunto vazio não quebra e o documento tem as seções', () => {
  const doc = renderDoc(analyzeNotes(course([])));
  for (const heading of ['## Resumo', '## Por tipo de unidade', '## Notas mais repetidas', '## Amostras para revisão humana']) assert.ok(doc.includes(heading), heading);
  assert.match(doc, /Total de unidades \| 0 \| 100%/);
});

test('o currículo real mantém as 4704 unidades e o documento está atualizado', async () => {
  const analysis = analyzeNotes(await loadCourseContentSnapshot());
  assert.equal(analysis.total, 4704);
  assert.equal(readFileSync(new URL('../' + DOC_FILE, import.meta.url), 'utf8'), renderDoc(analysis));
});
