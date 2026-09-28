// Progresso = estatísticas de todo o sistema (Issue #216).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StatsRepository } from '../utils/db/stats-repo.js';
import { heatLevel, yearGrid } from '../dashboard/js/ui/activityHeatmap.js';

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sql = read('supabase/migrations/20260927190000_system_stats.sql');
const view = read('dashboard/js/ui/progressView.js');

test('RPC: autenticada, sem anon e toda tabela filtrada pelo usuário', () => {
  assert.match(sql, /v_uid UUID := auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.rpc_system_stats\(INT\) FROM PUBLIC, anon;/);
  assert.match(sql, /SECURITY DEFINER\nSET search_path = ''/);
  for (const table of ['sessions', 'review_log', 'words', 'cards', 'course_practice_sessions', 'user_course_enrollment', 'reader_texts', 'stories', 'listening_intervals', 'user_stats']) {
    const refs = sql.match(new RegExp(`FROM public\\.${table}\\b[^;]*?WHERE user_id = v_uid`, 'g')) || [];
    const all = sql.match(new RegExp(`FROM public\\.${table}\\b`, 'g')) || [];
    assert.equal(refs.length, all.length, `${table}: toda leitura filtra por v_uid`);
  }
  assert.doesNotMatch(sql, /CREATE INDEX[^;]*now\(\)/);
});

test('repositório: períodos válidos, resto vira 30 dias', async () => {
  const calls = [];
  const repo = new StatsRepository({ _fetch: async (endpoint, options) => { calls.push({ endpoint, options }); return {}; } });
  await repo.getSystemStats(7);
  await repo.getSystemStats(0);
  await repo.getSystemStats(9999);
  assert.deepEqual(calls.map((c) => c.options.body.p_days), [7, 0, 30]);
  assert.equal(calls[0].endpoint, 'rpc/rpc_system_stats');
});

test('página: só estatísticas, com estados, sem Liga e com Check no rodapé', () => {
  assert.match(view, /db\.stats\.getSystemStats\(state\.days\)/);
  assert.match(view, /role="alert"/, 'estado de erro');
  assert.match(view, /aria-busy="true"/, 'estado de carregando');
  assert.match(view, /isEmpty\(s\)/, 'estado vazio');
  assert.match(view, /data-go="fluency-check"/);
  assert.doesNotMatch(view, /leagues|Liga|product-destination-card/);
  assert.match(view, /<table class="visually-hidden">/, 'gráfico com tabela acessível');
  for (const section of ['Tempo por atividade', 'Memória (cartões)', 'Dia a dia', 'Atividade no ano', 'Revisões no período', 'Revisões nos próximos 14 dias', 'Vocabulário por nível', 'Leitura e histórias']) {
    assert.match(view, new RegExp(section.replace(/[()]/g, '\\$&')), section);
  }
});

test('mapa de calor: níveis e grade do ano', () => {
  assert.deepEqual([0, 1, 899, 900, 1800, 3600].map(heatLevel), [0, 1, 1, 2, 3, 4]);
  const { days, offset } = yearGrid({ '2026-01-02': 120 }, 2026);
  assert.equal(days.length, 365);
  assert.equal(offset, 3, '1º de janeiro de 2026 é quinta (segunda = 0)');
  assert.equal(days[1].seconds, 120);
});
