import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const player = readFileSync('dashboard/js/ui/coursePracticeView.js', 'utf8');
const css = readFileSync('dashboard/css/course-player.css', 'utf8');

test('#507: acerto de frase com estrutura abre o painel e segura o avanço até Enter/Espaço', () => {
  assert.match(player, /holdingForStructure = true;\s*toggleBreakdown\(true, \{ holdNext: true \}\);\s*return;/);
  assert.match(player, /if \(holdingForStructure\) \{ continueFromStructure\(\); return; \}/, 'Enter/Espaço continuam');
  assert.match(player, /'continue-structure': continueFromStructure/, 'botão Próximo exercício');
  assert.match(player, /holdingForStructure = false;\s*\n\s*const shown/, 'nova unidade limpa a espera');
});

test('#507: cartões de estrutura respeitam movimento reduzido', () => {
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.course-structure-group \{ animation: none; \} \}/);
});
