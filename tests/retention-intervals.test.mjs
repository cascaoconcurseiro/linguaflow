import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { retentionByInterval } from '../dashboard/js/core/statsEngine.js';

const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString();
const log = (entries) => entries.map(([card_id, d, quality]) => ({ card_id, ts: day(d), quality }));

test('conta só revisões feitas depois de 7+ e 30+ dias desde a revisão anterior do mesmo cartão (#433)', () => {
  const entries = log([
    ['a', 0, 3], ['a', 10, 3], ['a', 50, 1], // 10 dias (lembrou), 40 dias (errou)
    ['b', 0, 3], ['b', 3, 4],                // 3 dias: não entra em nenhuma faixa
  ]);
  const r = retentionByInterval(entries, { minSample: 1 });
  assert.deepEqual([r.ge7.total, r.ge7.hits], [2, 1]);
  assert.deepEqual([r.ge30.total, r.ge30.hits], [1, 0]);
  assert.equal(r.ge7.rate, 50);
  assert.equal(r.ge30.rate, 0);
});

test('amostra pequena não vira percentual: rate fica null até minSample', () => {
  const entries = log([['a', 0, 3], ['a', 8, 3], ['a', 20, 3]]);
  const r = retentionByInterval(entries); // minSample padrão = 10
  assert.equal(r.ge7.total, 2);
  assert.equal(r.ge7.enough, false);
  assert.equal(r.ge7.rate, null);
  const many = log(Array.from({ length: 11 }, (_, i) => ['c' + i, 0, 3]).concat(Array.from({ length: 11 }, (_, i) => ['c' + i, 9, i < 8 ? 3 : 1])));
  const ok = retentionByInterval(many);
  assert.equal(ok.ge7.enough, true);
  assert.equal(ok.ge7.rate, 73, '8 de 11 = 73%');
});

test('Hard (nota 2) conta como lembrou; Errei (1) não; entradas inválidas e primeira revisão são ignoradas', () => {
  const entries = [
    ...log([['a', 0, 3], ['a', 8, 2], ['a', 20, 1]]),
    { card_id: null, ts: day(5), quality: 3 },
    { card_id: 'x', ts: 'não é data', quality: 3 },
    { card_id: 'x', ts: day(1), quality: null },
  ];
  const r = retentionByInterval(entries, { minSample: 1 });
  assert.deepEqual([r.ge7.total, r.ge7.hits], [2, 1]);
});

test('ordem do log não importa e entradas vazias não quebram', () => {
  const shuffled = log([['a', 20, 3], ['a', 0, 3], ['a', 8, 3]]);
  assert.equal(retentionByInterval(shuffled, { minSample: 1 }).ge7.total, 2);
  assert.deepEqual(retentionByInterval([], { minSample: 1 }).ge7, { days: 7, total: 0, hits: 0, rate: null, enough: false });
  assert.doesNotThrow(() => retentionByInterval(undefined));
});

test('tela: painel com estados de carregando, erro com nova tentativa e explicação; usa o histórico de 180 dias', async () => {
  const view = await readFile(new URL('../dashboard/js/ui/statsView.js', import.meta.url), 'utf8');
  assert.match(view, /Memória de longo prazo/);
  assert.match(view, /getReviewLog\(180\)/);
  assert.match(view, /Calculando…/);
  assert.match(view, /btn-longterm-retry/);
  assert.match(view, /precisa de pelo menos 10/);
});
