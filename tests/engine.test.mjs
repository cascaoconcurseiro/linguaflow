// tests/engine.test.mjs — valida o motor FSRS (configs reais) e o scoring do
// teste de nivelamento em 3 fases. Rodar: node tests/engine.test.mjs
// (Copia os módulos pra .mjs porque o package.json não tem "type": "module".)

import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lf-test-'));
copyFileSync(join(root, 'utils/db.js'), join(tmp, 'db.mjs'));
copyFileSync(join(root, 'utils/local-day.js'), join(tmp, 'local-day.js'));
copyFileSync(join(root, 'dashboard/js/core/placement.js'), join(tmp, 'placement.mjs'));
copyFileSync(join(root, 'dashboard/js/core/sessionQueue.js'), join(tmp, 'sessionQueue.mjs'));
{
  const statsSrc = readFileSync(join(root, 'dashboard/js/core/statsEngine.js'), 'utf8')
    .replace("'../../../utils/local-day.js'", "'./local-day.js'");
  writeFileSync(join(tmp, 'statsEngine.mjs'), statsSrc);
}

const { db } = await import(pathToFileURL(join(tmp, 'db.mjs')).href);
const P = await import(pathToFileURL(join(tmp, 'placement.mjs')).href);
const Q = await import(pathToFileURL(join(tmp, 'sessionQueue.mjs')).href);
const S = await import(pathToFileURL(join(tmp, 'statsEngine.mjs')).href);

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

test('scoreClozeLadder: para na primeira banda reprovada (Onda 3.2: corte proporcional, banco de 5)', () => {
  assert.equal(P.scoreClozeLadder([{ band: 'A1', correct: 5, total: 5 }, { band: 'A2', correct: 3, total: 5 }, { band: 'B1', correct: 1, total: 5 }]), 'A2');
  assert.equal(P.scoreClozeLadder([{ band: 'A1', correct: 1, total: 5 }]), 'A1');
  assert.equal(P.scoreClozeLadder([{ band: 'A2', correct: 3, total: 5 }, { band: 'B1', correct: 3, total: 5 }, { band: 'B2', correct: 5, total: 5 }, { band: 'C1', correct: 3, total: 5 }]), 'C1');
  assert.equal(P.clozePassThreshold(5), 3); // 60% de 5, arredondado pra cima
});

test('clozeStartBand: começa uma banda abaixo do vocabulário', () => {
  assert.equal(P.clozeStartBand('B1'), 'A2');
  assert.equal(P.clozeStartBand('A1'), 'A1');
});

test('scoreListening: 5+/6 sobe, 3-4/6 mantém, <3 desce', () => {
  assert.equal(P.scoreListening('B1', 6, 6), 'B2');
  assert.equal(P.scoreListening('B1', 3, 6), 'B1');
  assert.equal(P.scoreListening('B1', 1, 6), 'A2');
  assert.equal(P.scoreListening('C1', 6, 6), 'C2'); // Onda 3.2: C2 existe agora, C1 acertando tudo sobe
  assert.equal(P.scoreListening('C2', 6, 6), 'C2'); // clamp no novo teto
});

test('combinePlacement: 40/40/20 com diagnóstico de lacunas', () => {
  const r = P.combinePlacement('B2', 'B1', 'A2');
  assert.equal(r.level, 'B1'); // 0.4*3 + 0.4*2 + 0.2*1 = 2.2 → B1
  assert.deepEqual(r.gaps, ['escuta']);
  const r2 = P.combinePlacement('B1', 'B1', 'B1');
  assert.equal(r2.level, 'B1');
  assert.deepEqual(r2.gaps, []);
  const cheated = P.combinePlacement('A1', 'C1', 'C1', 0);
  assert.equal(cheated.level, 'A1');
  assert.equal(cheated.retestRequired, true);
});

test('Difícil no learning progride sem graduação precoce ou loop eterno', () => {
  const first = db._calculateNextState(newCard(), 2, SETTINGS);
  assert.equal(first.status, 'learning');
  assert.equal(first.step_index, 0);
  const second = db._calculateNextState(first, 2, SETTINGS);
  assert.equal(second.status, 'learning');
  assert.equal(second.step_index, 1);
  const third = db._calculateNextState(second, 2, SETTINGS);
  assert.equal(third.status, 'review');

  const oneStep = db._calculateNextState(newCard(), 2, { ...SETTINGS, learningSteps: [5] });
  assert.equal(oneStep.status, 'learning');
  assert.equal(db._calculateNextState(oneStep, 2, { ...SETTINGS, learningSteps: [5] }).status, 'review');
});

test('shuffleItem preserva a resposta correta', () => {
  const item = { sentence: 'x ___', options: ['certa', 'e1', 'e2', 'e3'], answer: 0 };
  for (let i = 0; i < 20; i++) {
    const s = P.shuffleItem(item);
    assert.equal(s.options[s.answer], 'certa');
  }
});

test('bancos de cloze/listening: 5 e 4 itens por banda (Onda 3.2, incl. C2), answers válidos', () => {
  assert.deepEqual(P.LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  for (const band of P.LEVELS) {
    assert.equal(P.CLOZE_BANK[band].length, 5, `cloze ${band}`);
    assert.equal(P.LISTENING_BANK[band].length, 4, `listening ${band}`);
    [...P.CLOZE_BANK[band], ...P.LISTENING_BANK[band]].forEach(item => {
      assert.ok(item.answer >= 0 && item.answer < item.options.length);
    });
  }
});

test('writingPromptFor: escolhe prompt pela faixa de nível', () => {
  assert.equal(P.writingPromptFor('A1'), P.WRITING_PROMPTS.beginner);
  assert.equal(P.writingPromptFor('B1'), P.WRITING_PROMPTS.intermediate);
  assert.equal(P.writingPromptFor('C2'), P.WRITING_PROMPTS.advanced);
});

test('combinePlacement: writingAdjust nudga até 1 banda, nunca decide sozinho', () => {
  const up = P.combinePlacement('B1', 'B1', 'B1', 100, 1);
  assert.equal(up.level, 'B2');
  const down = P.combinePlacement('B1', 'B1', 'B1', 100, -1);
  assert.equal(down.level, 'A2');
  const clamped = P.combinePlacement('B1', 'B1', 'B1', 100, 5); // nunca mais que 1 banda
  assert.equal(clamped.level, 'B2');
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

console.log('── Motor pedagógico (interleaving + diagnóstico) ──');

test('Difícil em learning gradua em 3 (não 16 nem 2) — política conservadora do merge', () => {
  // Regressão do bug de produção (card "statement", 16 Difícil sem graduar) +
  // resolução do merge: com [1,10], TRÊS "Difícil" graduam (não dois).
  let card = { ...newCard() };
  card = db._calculateNextState(card, 2, SETTINGS); // novo → repete step0
  assert.equal(card.status, 'learning');
  card = db._calculateNextState(card, 2, SETTINGS); // step0 → step1
  assert.equal(card.status, 'learning', 'o 2º Difícil ainda NÃO gradua (não é tão rápido quanto Bom)');
  card = db._calculateNextState(card, 2, SETTINGS); // step1 → GRADUA
  assert.equal(card.status, 'review', 'o 3º Difícil gradua');
  assert.ok(card.interval >= 1);
});

test('buildSessionQueue: learning primeiro; fracas e novas espaçadas', () => {
  const mk = (id, status, lapses = 0) => ({ id, status, lapses });
  const cards = [
    mk('r1', 'review'), mk('r2', 'review'), mk('r3', 'review'),
    mk('r4', 'review'), mk('r5', 'review'), mk('r6', 'review'),
    mk('n1', 'new'), mk('n2', 'new'),
    mk('w1', 'review', 4), mk('w2', 'review', 5),
    mk('l1', 'learning'),
  ];
  const queue = Q.buildSessionQueue(cards);
  assert.equal(queue.length, cards.length, 'ninguém some da fila');
  assert.equal(queue[0].id, 'l1', 'learning vem primeiro');
  const ids = queue.map(c => c.id);
  const wPos = ['w1', 'w2'].map(id => ids.indexOf(id));
  assert.ok(Math.abs(wPos[0] - wPos[1]) > 1, `fracas espaçadas: ${wPos}`);
  const nPos = ['n1', 'n2'].map(id => ids.indexOf(id));
  assert.ok(Math.min(...nPos) < ids.length - 2, `novas espalhadas: ${nPos}`);
});

test('buildSessionQueue: priorityCategory traz a categoria fraca à frente', () => {
  const mk = (id, cat) => ({ id, status: 'review', lapses: 0, wordData: { category: cat } });
  const cards = [
    mk('r1', 'word'), mk('r2', 'phrasal_verb'), mk('r3', 'word'),
    mk('r4', 'phrasal_verb'), mk('r5', 'word'), mk('r6', 'word'),
  ];
  const queue = Q.buildSessionQueue(cards, { priorityCategory: 'phrasal_verb' });
  assert.equal(queue.length, 6);
  // os 2 phrasal_verb devem estar nas 2 primeiras posições
  assert.deepEqual(queue.slice(0, 2).map(c => c.wordData.category), ['phrasal_verb', 'phrasal_verb']);
});

test('isWeakCard: 3+ lapsos ou leech', () => {
  assert.equal(Q.isWeakCard({ lapses: 3 }), true);
  assert.equal(Q.isWeakCard({ lapses: 2 }), false);
  assert.equal(Q.isWeakCard({ is_leech: true }), true);
});

await (async () => {
  // getDiagnosisData: agrega POR palavra/categoria/nível com stubs de rede
  const origLog = db.getReviewLog, origCards = db.getAllCards, origWords = db.getAllWords;
  db.getReviewLog = async () => [
    { card_id: 'c1', quality: 1 }, { card_id: 'c1', quality: 2 },
    { card_id: 'c2', quality: 3 }, { card_id: 'c2', quality: 4 },
    { card_id: 'c3', quality: 3 },
  ];
  db.getAllCards = async () => [
    { id: 'c1', word_id: 'w1', lapses: 4, status: 'learning' },
    { id: 'c2', word_id: 'w2', lapses: 0, status: 'mature' },
    { id: 'c3', word_id: 'w3', lapses: 0, status: 'review' },
  ];
  db.getAllWords = async () => [
    { id: 'w1', word: 'stick around', category: 'phrasal_verb', level: 'B1' },
    { id: 'w2', word: 'statement', category: 'word', level: 'B1' },
    { id: 'w3', word: 'knowing', category: 'word', level: 'A2' },
  ];
  try {
    const d = await db.getDiagnosisData(30);
    test('getDiagnosisData: retenção por categoria com dados reais', () => {
      assert.equal(d.retentionByCategory.phrasal_verb.retention, 50);
      assert.equal(d.retentionByCategory.word.retention, 100);
      assert.equal(d.totalReviews, 5);
    });
    test('getDiagnosisData: aponta a palavra que está sofrendo', () => {
      assert.equal(d.strugglingWords.length, 1);
      assert.equal(d.strugglingWords[0].word, 'stick around');
      assert.ok(d.solidWords.includes('statement'));
      assert.equal(d.leeches, 1);
    });
  } finally {
    db.getReviewLog = origLog; db.getAllCards = origCards; db.getAllWords = origWords;
  }
})();

console.log('── Estatísticas (statsEngine) ──');

test('retentionByDay: agrega por dia local, dias sem revisão ficam null', () => {
  const today = new Date();
  const key = (d) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - d).toISOString().slice(0, 10);
  const log = [
    { date: key(0), quality: 3 }, { date: key(0), quality: 1 },
    { date: key(1), quality: 4 },
  ];
  const rows = S.retentionByDay(log, 3);
  assert.equal(rows.length, 3);
  const todayRow = rows[rows.length - 1];
  assert.equal(todayRow.total, 2);
  assert.equal(todayRow.hits, 1);
  assert.equal(todayRow.retention, 50);
  const noDataRow = rows[0];
  assert.equal(noDataRow.retention, null);
});

test('studyTimeByDay: soma segundos por dia e converte pra minutos', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = S.studyTimeByDay([{ date: today, seconds: 90 }, { date: today, seconds: 30 }], 2);
  assert.equal(rows[rows.length - 1].minutes, 2);
});

test('maturityDistribution: separa suspenso antes do status', () => {
  const dist = S.maturityDistribution([
    { status: 'new' }, { status: 'review', suspended: true }, { status: 'mature' },
  ]);
  assert.deepEqual(dist, { new: 1, learning: 0, review: 0, mature: 1, suspended: 1 });
});

test('forecastByDay: só conta a partir de amanhã, ignora vencidos', () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString();
  const rows = S.forecastByDay([
    { due_date: yesterday, suspended: false },
    { due_date: inThreeDays, suspended: false },
  ], 7);
  const total = rows.reduce((a, r) => a + r.count, 0);
  assert.equal(total, 1, 'só o card de daqui a 3 dias entra no forecast');
});

test('summarize: retenção geral e totais', () => {
  const sum = S.summarize(
    [{ id: 1 }, { id: 2 }],
    [{ seconds: 120 }],
    [{ quality: 3 }, { quality: 1 }],
  );
  assert.equal(sum.totalCards, 2);
  assert.equal(sum.totalMinutes, 2);
  assert.equal(sum.totalReviews, 2);
  assert.equal(sum.overallRetention, 50);
});

console.log(`\n${passed} testes passaram${process.exitCode ? ' (com falhas!)' : ' — tudo verde ✅'}`);
