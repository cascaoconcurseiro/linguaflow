import test from 'node:test';
import assert from 'node:assert/strict';
import { levelStatus, levelCompletionText } from '../dashboard/js/ui/courses/courseLevelProgress.js';

test('conquista anterior permanece concluída mesmo com aulas novas', () => {
  assert.equal(levelStatus({ total: 49, completed: 48, completion: { total: 48 } }), 'Base concluída');
});
test('nível dispensado não recebe conclusão e parcial já aparece em andamento', () => {
  assert.equal(levelStatus({ total: 48, completed: 0, skipped: true }), 'Dispensado pelo nível escolhido');
  assert.equal(levelStatus({ total: 48, completed: 0, started_at: '2026-10-07' }), 'Em andamento');
  assert.equal(levelStatus({ total: 48, completed: 0 }), 'Não iniciado');
  assert.equal(levelStatus({ total: 0 }), 'Em breve');
});
test('data reconhecida não é apresentada como data histórica de conclusão', () => {
  assert.match(levelCompletionText({ completion: { recorded_at: '2026-10-07T12:00:00Z', total: 48 } }), /Conclusão reconhecida/);
  assert.match(levelCompletionText({ completion: { completed_at: '2026-10-07T12:00:00Z', total: 48 } }), /Base concluída em/);
  assert.equal(levelCompletionText({}), '');
});
