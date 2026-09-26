// tests/active-recall-verification.test.mjs
// Contratos de Verificação Ativa e Guarda de Honestidade no SRS (Fase 3)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveAdaptivePlan, evaluateActiveRecallHonesty } from '../dashboard/js/core/adaptiveLearning.js';

test('Active Recall: deriveAdaptivePlan sinaliza requires_active_verification para cards instáveis', () => {
  // Card estável em revisão normal
  const stableCard = { id: 'c1', status: 'review', lapses: 0, is_leech: false };
  const stablePlan = deriveAdaptivePlan(stableCard, { recovery_stage: 0, dominant_issue: 'none' });
  assert.equal(stablePlan.requires_active_verification, false, 'Card estável não exige verificação forçada');

  // Card em aprendizado inicial (learning)
  const learningCard = { id: 'c2', status: 'learning', lapses: 0 };
  const learningPlan = deriveAdaptivePlan(learningCard);
  assert.equal(learningPlan.requires_active_verification, true, 'Card em learning exige verificação ativa');

  // Card com reincidência de erro (lapses >= 2)
  const lapsingCard = { id: 'c3', status: 'review', lapses: 2 };
  const lapsingPlan = deriveAdaptivePlan(lapsingCard);
  assert.equal(lapsingPlan.requires_active_verification, true, 'Card com 2+ lapsos exige verificação ativa');

  // Card sanguessuga (leech)
  const leechCard = { id: 'c4', status: 'review', is_leech: true };
  const leechPlan = deriveAdaptivePlan(leechCard);
  assert.equal(leechPlan.requires_active_verification, true, 'Card leech exige verificação ativa');

  // Card em estágio de recuperação ativa
  const recoveringCard = { id: 'c5', status: 'review', lapses: 1 };
  const recoveringPlan = deriveAdaptivePlan(recoveringCard, { recovery_stage: 2 });
  assert.equal(recoveringPlan.requires_active_verification, true, 'Card em estágio de recuperação exige verificação ativa');
});

test('Active Recall: evaluateActiveRecallHonesty preserva avaliações quando não há instabilidade', () => {
  assert.equal(typeof evaluateActiveRecallHonesty, 'function', 'evaluateActiveRecallHonesty deve ser uma função exportada');

  const stableCard = { id: 'c1', status: 'review', lapses: 0 };
  const res = evaluateActiveRecallHonesty(stableCard, 4, { helpCount: 0, responseMs: 3000 });
  assert.equal(res.adjustedGrade, 4);
  assert.equal(res.honest, true);
});

test('Active Recall: evaluateActiveRecallHonesty corrige avaliação Fácil quando houve ajuda em card instável', () => {
  const instableCard = { id: 'c2', status: 'learning', lapses: 1 };
  // Usuário clicou em ajuda (hint) e depois tentou avaliar como 4 (Fácil)
  const res = evaluateActiveRecallHonesty(instableCard, 4, { helpCount: 1, responseMs: 4000 });
  assert.equal(res.adjustedGrade, 3, 'Deve corrigir nota 4 (Fácil) para 3 (Bom) se houve uso de dica');
  assert.equal(res.honest, false);
  assert.equal(res.reason, 'help_used_on_instable_card');

  // Avaliação 3 (Bom) em card com ajuda deve ser mantida
  const resGood = evaluateActiveRecallHonesty(instableCard, 3, { helpCount: 1, responseMs: 4000 });
  assert.equal(resGood.adjustedGrade, 3);
  assert.equal(resGood.honest, true);
});

test('Active Recall: evaluateActiveRecallHonesty corrige avaliação Fácil quando a resposta foi excessivamente lenta', () => {
  const instableCard = { id: 'c3', status: 'review', lapses: 3 };
  // Levou 22 segundos para lembrar de um card com 3 lapsos e tentou marcar Fácil
  const res = evaluateActiveRecallHonesty(instableCard, 4, { helpCount: 0, responseMs: 22000 });
  assert.equal(res.adjustedGrade, 3, 'Deve corrigir nota 4 para 3 se a latência excedeu o limite de fluência');
  assert.equal(res.honest, false);
  assert.equal(res.reason, 'slow_response_on_instable_card');
});

test('Active Recall: studyView.js integra guarda de honestidade e indicador de recuperação', () => {
  const studyCode = readFileSync('dashboard/js/ui/studyView.js', 'utf8');

  assert.match(studyCode, /evaluateActiveRecallHonesty/, 'studyView deve importar evaluateActiveRecallHonesty');
  assert.match(studyCode, /requires_active_verification/, 'studyView deve checar requires_active_verification');
});
