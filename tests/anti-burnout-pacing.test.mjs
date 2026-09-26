// tests/anti-burnout-pacing.test.mjs
// Contratos do Motor Anti-Burnout e Pacing de Backlog (Fase 2)

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSessionFatigue } from '../dashboard/js/core/adaptiveLearning.js';
import { balanceBacklogQueue, buildSessionQueue } from '../dashboard/js/core/sessionQueue.js';

test('Anti-Burnout: detectSessionFatigue requer dados mínimos para acionar', () => {
  assert.equal(typeof detectSessionFatigue, 'function', 'detectSessionFatigue deve ser uma função exportada');

  const shortSession = [
    { responseMs: 3000, correct: true },
    { responseMs: 4000, correct: false },
  ];
  const res = detectSessionFatigue(shortSession, 3500);
  assert.equal(res.fatigued, false, 'Sessão curta não deve disparar fadiga prematura');
  assert.equal(res.reason, 'insufficient_data');
});

test('Anti-Burnout: detectSessionFatigue detecta cansaço com aumento de latência e erros', () => {
  const baseline = 3000;
  // 4 iniciais rápidos e corretos + 4 finais lentos com múltiplos erros
  const fatiguedSession = [
    { responseMs: 2800, correct: true },
    { responseMs: 3100, correct: true },
    { responseMs: 2900, correct: true },
    { responseMs: 3200, correct: true },
    { responseMs: 6500, correct: false },
    { responseMs: 7200, correct: false },
    { responseMs: 5800, correct: true },
    { responseMs: 8000, correct: false },
  ];

  const res = detectSessionFatigue(fatiguedSession, baseline);
  assert.equal(res.fatigued, true, 'Deve detectar fadiga quando a latência dobra e erros sobem');
  assert.equal(res.reason, 'latency_and_errors');
  assert.ok(res.confidence > 0.7, 'Confiança da detecção deve ser superior a 70%');
});

test('Anti-Burnout: detectSessionFatigue permanece inativo quando o estudante mantém ritmo estável', () => {
  const baseline = 3500;
  const goodSession = [
    { responseMs: 3200, correct: true },
    { responseMs: 3400, correct: true },
    { responseMs: 3600, correct: true },
    { responseMs: 3300, correct: true },
    { responseMs: 3500, correct: true },
    { responseMs: 4000, correct: false },
    { responseMs: 3200, correct: true },
    { responseMs: 3400, correct: true },
  ];

  const res = detectSessionFatigue(goodSession, baseline);
  assert.equal(res.fatigued, false, 'Não deve detectar fadiga em sessão produtiva e estável');
});

test('Anti-Burnout: balanceBacklogQueue fatia revisões acumuladas após inatividade', () => {
  assert.equal(typeof balanceBacklogQueue, 'function', 'balanceBacklogQueue deve ser uma função exportada');

  const cards = [];
  // 2 cards em learning (sensíveis ao tempo)
  cards.push({ id: 'l1', status: 'learning', stability: 0.5 });
  cards.push({ id: 'l2', status: 'learning', stability: 0.8 });

  // 60 cards de revisão acumulados
  for (let i = 1; i <= 60; i++) {
    cards.push({
      id: `r${i}`,
      status: 'review',
      stability: (i % 10) + 1, // stabilities variando de 1 a 10
      lapses: i % 4,
    });
  }

  // Com maxDailyBacklog = 25
  const result = balanceBacklogQueue(cards, { maxDailyBacklog: 25, daysInactive: 4 });
  assert.equal(result.paced, true, 'Deve ativar o pacing quando o backlog excede o limite');
  assert.equal(result.postponedCount, 35, 'Deve adiar 35 cards de revisão para o dia seguinte');

  // Os 2 cards de learning devem estar preservados na fila ativa
  const learningInActive = result.activeQueue.filter((c) => c.status === 'learning');
  assert.equal(learningInActive.length, 2, 'Cards de learning nunca devem ser adiados');

  // Total de reviews na fila ativa não deve exceder 25
  const reviewsInActive = result.activeQueue.filter((c) => c.status === 'review');
  assert.equal(reviewsInActive.length, 25, 'Deve conter exatamente 25 cards de revisão selecionados');
});

test('Anti-Burnout: buildSessionQueue aceita backlogPacing integrado', () => {
  const cards = [];
  cards.push({ id: 'l1', status: 'learning' });
  for (let i = 1; i <= 40; i++) {
    cards.push({ id: `r${i}`, status: 'review', stability: 2 });
  }

  const queue = buildSessionQueue(cards, {
    backlogPacing: { maxDailyBacklog: 20, daysInactive: 3 },
  });

  // Fila resultante deve ter o learning + 20 reviews = 21 cards
  assert.equal(queue.length, 21, 'Fila montada com pacing deve respeitar o limite diário');
});

test('Anti-Burnout: studyView.js integra detecção de fadiga e pacing de backlog', async () => {
  const { readFileSync } = await import('node:fs');
  const studyCode = readFileSync('dashboard/js/ui/studyView.js', 'utf8');

  assert.match(studyCode, /detectSessionFatigue/, 'studyView deve importar detectSessionFatigue');
  assert.match(studyCode, /backlogPacing/, 'studyView deve configurar backlogPacing');
  assert.match(studyCode, /sessionSignals/, 'studyView deve manter registro de sinais para fadiga');
});

