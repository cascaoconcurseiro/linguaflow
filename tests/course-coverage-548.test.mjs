// #548: cobertura de tópicos por nível, nível das frases e marcadores novos da auditoria de sequência.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPICS, coverage, buildDoc, DOC_FILE } from '../scripts/audit-course-coverage.mjs';
import { MARKERS, vocabularyLoad } from '../scripts/audit-course-sequence.mjs';

test('o documento de cobertura está atualizado e cada tópico tem aula ou evidência', async () => {
  assert.equal(readFileSync(new URL('../' + DOC_FILE, import.meta.url), 'utf8'), await buildDoc());
  for (const topic of TOPICS) assert.ok(topic.lesson || topic.regex, topic.label);
  assert.equal(new Set(TOPICS.map(t => `${t.level}|${t.label}`)).size, TOPICS.length, 'sem tópicos duplicados');
});

test('toda aula dedicada fica exatamente no nível esperado (nem antes, nem depois)', async () => {
  const rows = await coverage();
  const off = rows.filter(r => r.lesson && r.status !== 'coberto').map(r => `${r.label}: esperado ${r.level}, aula em ${r.lessonLevel}`);
  assert.deepEqual(off, []);
});

test('lacunas conhecidas ficam explícitas: criar a aula exige atualizar o relatório', async () => {
  const gaps = (await coverage()).filter(r => r.status === 'lacuna' || r.status === 'fino').map(r => `${r.level} ${r.label}`).sort();
  assert.deepEqual(gaps, [
    'A2 pronomes reflexivos',
    'B1 had better / be supposed to',
    'B1 so ... that / such ... that',
    'B2 the more ... the more',
    'B2 verbos de relato (suggest, admit, deny + -ing)',
  ]);
});

test('o tamanho das frases e a carga de palavras novas crescem de forma coerente com o nível', async () => {
  const { perLevel } = await vocabularyLoad();
  const average = level => perLevel[level].sentenceWords / perLevel[level].sentences;
  const levels = ['A1', 'A2', 'B1', 'B2'];
  for (let i = 1; i < levels.length; i += 1) assert.ok(average(levels[i]) > average(levels[i - 1]), `${levels[i]} tem frases mais longas que ${levels[i - 1]}`);
  assert.ok(perLevel.A1.longest <= 10 && perLevel.A2.longest <= 12 && perLevel.B1.longest <= 14 && perLevel.B2.longest <= 14);
  assert.ok(perLevel.A1.fresh / perLevel.A1.lessons < 12, 'A1 não despeja palavras novas');
});

test('marcadores novos reconhecem a estrutura e ignoram frases simples', () => {
  const hit = (id, text) => MARKERS.find(m => m.id === id).regex.test(text);
  assert.ok(hit('passive', 'The report was written by Ana.'));
  assert.ok(hit('reported', 'She said that he was tired.'));
  assert.ok(hit('relative', 'The man who lives here is kind.'));
  assert.ok(hit('would', "I would go with you."));
  assert.ok(hit('third-conditional', 'If I had known, I would have called.'));
  assert.ok(hit('wish', 'I wish I had more time.'));
  assert.ok(hit('causative', 'I had my car repaired.'));
  assert.ok(hit('might-may', 'It might rain later.'));
  assert.ok(hit('past-perfect', 'They had already left.'));
  assert.ok(hit('perfect-continuous', 'I have been waiting for an hour.'));
  for (const id of ['passive', 'reported', 'relative', 'would', 'third-conditional', 'wish', 'causative', 'might-may', 'past-perfect', 'perfect-continuous']) assert.ok(!hit(id, 'I am a student.'), id);
});
