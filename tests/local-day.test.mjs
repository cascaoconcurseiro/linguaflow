import assert from 'node:assert/strict';
import {
  addLocalDays, dateFromLocalKey, daysBetweenLocalKeys, localDateKey, localDayBounds,
} from '../utils/local-day.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { console.error(`  ✗ ${name}\n    ${error.message}`); process.exitCode = 1; }
}

console.log('── Dia local ──');
test('formata pelo calendário local, sem UTC', () => {
  assert.equal(localDateKey(new Date(2026, 6, 10, 0, 5)), '2026-07-10');
});
test('limites começam e terminam na meia-noite local', () => {
  const { start, end } = localDayBounds(new Date(2026, 6, 10, 15));
  assert.equal(localDateKey(start), '2026-07-10');
  assert.equal(localDateKey(end), '2026-07-11');
  assert.equal(start.getHours(), 0);
});
test('soma dias de calendário sem assumir 24 horas', () => {
  assert.equal(localDateKey(addLocalDays(1, new Date(2026, 6, 10, 23))), '2026-07-11');
});
test('calcula afastamento por chaves de calendário', () => {
  assert.equal(daysBetweenLocalKeys('2026-07-08', '2026-07-10'), 2);
  assert.equal(daysBetweenLocalKeys('2026-07-10', '2026-07-10'), 0);
});
test('rejeita chaves inexistentes', () => {
  assert.throws(() => dateFromLocalKey('2026-02-30'), TypeError);
});

console.log(`${passed} testes de dia local passaram — tudo verde ✅`);
