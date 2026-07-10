// tests/engine.test.mjs — valida o motor FSRS (configs reais) e o scoring do
// teste de nivelamento em 3 fases. Rodar: node tests/engine.test.mjs
// (Copia os módulos pra .mjs porque o package.json não tem "type": "module".)

import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lf-test-'));
copyFileSync(join(root, 'utils/db.js'), join(tmp, 'db.mjs'));
copyFileSync(join(root, 'dashboard/js/core/placement.js'), join(tmp, 'placement.mjs'));

const { db } = await import(pathToFileURL(join(tmp, 'db.mjs')).href);
const P = await import(pathToFileURL(join(tmp, 'placement.mjs')).href);

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

const SETTINGS = {
  gradInt: 1, easyInt: 4, initEase: 2.5, maxInt: 36500,
  leechThresh: 8, easyBonus: 1.3, intMod: 1, lapseMod: 0,
  leechAction: 'tag', retention: 0.9, learningSteps: [1, 10],
  newPerDay: 20, maxRevPerDay: 200,
};
const newCard = () => ({ id: 'c1', status: 'new', interval: 0, ease_factor: 2.5, step_index: 0, reps: 0, lapses: 0, stability: null, difficulty: null, due_date: new Date().toISOString(), last_review: null });

console.log('── Motor FSRS (_calculateNextState) ──');

test('card novo + Bom → learning, volta em ~10 min (learning step 2)', () => {
  const next = db._calculateNextState(newCard(), 3, SETTINGS);
  assert.equal(next.status, 'learning');
  assert.ok(Math.abs(next.interval - 10 / 1440) < 1e-9, `interval=${next.interval}`);
  // due_date tem que ser DENTRO da sessão (minutos), não amanhã
  const dueMs = new Date(next.due_date).getTime() - Date.now();
  assert.ok(dueMs > 8 * 60000 && dueMs < 12 * 60000, `due em ${Math.round(dueMs / 60000)} min`);
});

test('card novo + Errei → learning, volta em ~1 min (step 1)', () => {
  const next = db._calculateNextState(newCard(), 1, SETTINGS);
  assert.equal(next.status, 'learning');
  assert.ok(Math.abs(next.interval - 1 / 1440) < 1e-9);
});

test('learning no último step + Bom → GRADUA (review) respeitando graduating_interval', () => {
  const card = { ...newCard(), status: 'learning', step_index: 1, stability: 3.7, difficulty: 5 };
  const s = { ...SETTINGS, gradInt: 3 };
  const next = db._calculateNextState(card, 3, s);
  assert.equal(next.status, 'review');
  assert.ok(next.interval >= 3, `piso do gradInt: ${next.interval} >= 3`);
});

test('card novo + Fácil → gradua direto respeitando easy_interval como piso', () => {
  const s = { ...SETTINGS, easyInt: 6 };
  const next = db._calculateNextState(newCard(), 4, s);
  assert.equal(next.status, 'review');
  assert.ok(next.interval >= 6 * 0.95, `piso do easyInt (com fuzz): ${next.interval}`);
});

test('interval_modifier escala o intervalo de review (80% < 100% < 120%)', () => {
  const mkCard = () => ({ ...newCard(), status: 'review', stability: 10, difficulty: 5, interval: 10, last_review: new Date(Date.now() - 10 * 86400000).toISOString() });
  // média de 30 amostras neutraliza o fuzz de ±5%
  const avg = (mod) => {
    let sum = 0;
    for (let i = 0; i < 30; i++) sum += db._calculateNextState(mkCard(), 3, { ...SETTINGS, intMod: mod }).interval;
    return sum / 30;
  };
  const low = avg(0.8), mid = avg(1), high = avg(1.2);
  assert.ok(low < mid && mid < high, `${low.toFixed(1)} < ${mid.toFixed(1)} < ${high.toFixed(1)}`);
});

test('review + Errei → lapso: volta pra learning e lapses incrementa', () => {
  const card = { ...newCard(), status: 'review', stability: 10, difficulty: 5, interval: 10, lapses: 2, last_review: new Date(Date.now() - 10 * 86400000).toISOString() };
  const next = db._calculateNextState(card, 1, SETTINGS);
  assert.equal(next.status, 'learning');
  assert.equal(next.lapses, 3);
});

test('intervalo >= 21 dias → mature', () => {
  const card = { ...newCard(), status: 'review', stability: 60, difficulty: 3, interval: 30, last_review: new Date(Date.now() - 30 * 86400000).toISOString() };
  const next = db._calculateNextState(card, 3, SETTINGS);
  assert.equal(next.status, 'mature');
});

console.log('── Nivelamento em 3 fases (placement) ──');

test('scoreClozeLadder: para na primeira banda reprovada', () => {
  assert.equal(P.scoreClozeLadder([{ band: 'A1', correct: 3 }, { band: 'A2', correct: 2 }, { band: 'B1', correct: 1 }]), 'A2');
  assert.equal(P.scoreClozeLadder([{ band: 'A1', correct: 1 }]), 'A1');
  assert.equal(P.scoreClozeLadder([{ band: 'A2', correct: 2 }, { band: 'B1', correct: 2 }, { band: 'B2', correct: 3 }, { band: 'C1', correct: 2 }]), 'C1');
});

test('clozeStartBand: começa uma banda abaixo do vocabulário', () => {
  assert.equal(P.clozeStartBand('B1'), 'A2');
  assert.equal(P.clozeStartBand('A1'), 'A1');
});

test('scoreListening: 5+/6 sobe, 3-4/6 mantém, <3 desce', () => {
  assert.equal(P.scoreListening('B1', 6, 6), 'B2');
  assert.equal(P.scoreListening('B1', 3, 6), 'B1');
  assert.equal(P.scoreListening('B1', 1, 6), 'A2');
  assert.equal(P.scoreListening('C1', 6, 6), 'C1'); // clamp no teto
});

test('combinePlacement: 40/40/20 com diagnóstico de lacunas', () => {
  const r = P.combinePlacement('B2', 'B1', 'A2');
  assert.equal(r.level, 'B1'); // 0.4*3 + 0.4*2 + 0.2*1 = 2.2 → B1
  assert.deepEqual(r.gaps, ['escuta']);
  const r2 = P.combinePlacement('B1', 'B1', 'B1');
  assert.equal(r2.level, 'B1');
  assert.deepEqual(r2.gaps, []);
});

test('shuffleItem preserva a resposta correta', () => {
  const item = { sentence: 'x ___', options: ['certa', 'e1', 'e2', 'e3'], answer: 0 };
  for (let i = 0; i < 20; i++) {
    const s = P.shuffleItem(item);
    assert.equal(s.options[s.answer], 'certa');
  }
});

test('bancos de cloze/listening: 3 e 2 itens por banda, answers válidos', () => {
  for (const band of P.LEVELS) {
    assert.equal(P.CLOZE_BANK[band].length, 3, `cloze ${band}`);
    assert.equal(P.LISTENING_BANK[band].length, 2, `listening ${band}`);
    [...P.CLOZE_BANK[band], ...P.LISTENING_BANK[band]].forEach(item => {
      assert.ok(item.answer >= 0 && item.answer < item.options.length);
    });
  }
});

test('scorePlacement: pseudo-palavras derrubam o resultado (anti-chute)', () => {
  const honest = P.scorePlacement([
    ...Array(6).fill({ band: 'A1', known: true }),
    ...Array(6).fill({ band: 'A2', known: true }),
    ...Array(6).fill({ band: 'B1', known: false }),
    ...Array(6).fill({ band: 'PSEUDO', known: false }),
  ]);
  assert.equal(honest.level, 'A2');
  const cheater = P.scorePlacement([
    ...Array(6).fill({ band: 'A1', known: true }),
    ...Array(6).fill({ band: 'A2', known: true }),
    ...Array(6).fill({ band: 'B1', known: true }),
    ...Array(6).fill({ band: 'PSEUDO', known: true }),
  ]);
  assert.equal(cheater.level, 'A1');
});

console.log(`\n${passed} testes passaram${process.exitCode ? ' (com falhas!)' : ' — tudo verde ✅'}`);
