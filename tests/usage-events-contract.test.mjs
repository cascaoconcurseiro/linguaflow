import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readEngineSource } from './helpers/engine-source.mjs';
import { readDbSource } from './helpers/db-source.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('migration: lista fechada, sem conteúdo, RLS sem acesso direto e RPCs com grants mínimos', async () => {
  const sql = await read('supabase/migrations/20261003160000_usage_events.sql');
  assert.match(sql, /event\s+text\s+NOT NULL CHECK \(event IN \('player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done'\)\)/);
  assert.match(sql, /platform\s+text\s+NOT NULL DEFAULT 'none' CHECK/);
  assert.match(sql, /PRIMARY KEY \(user_id, event, platform, day\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.usage_events FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /admin_assert_role\(p_session_token, false\)/);
  assert.doesNotMatch(sql, /\b(url|title|text_content|email)\b\s+text/i, 'a tabela não pode guardar conteúdo');
});

test('cliente: db expõe os métodos, o service worker libera e a extensão falha em silêncio', async () => {
  const db = await readDbSource();
  assert.match(db, /async logUsageEvent\(event, platform = 'none'\)/);
  assert.match(db, /rpc\/log_usage_event/);
  assert.match(db, /admin_usage_funnel/);
  const sw = await read('background/service-worker.js');
  assert.match(sw, /'logUsageEvent', 'adminGetUsageFunnel'/);
  const engine = await readEngineSource();
  assert.match(engine, /_trackUsage\('player_opened'\)/);
  assert.match(engine, /_trackUsage\(this\.isActivated \? 'lf_enabled' : 'lf_disabled'\)/);
  assert.match(engine, /db\.logUsageEvent\(event, this\.platform\)\)\s*\.catch\(\(\) => \{\}\)/);
});

test('admin: Visão geral mostra o funil e explica quando não há dados', async () => {
  const view = await read('dashboard/js/ui/admin/adminOverview.js');
  assert.match(view, /Funil de uso/);
  assert.match(view, /Salvaram uma palavra/);
  assert.match(view, /Ainda sem dados ou indisponível/);
});
