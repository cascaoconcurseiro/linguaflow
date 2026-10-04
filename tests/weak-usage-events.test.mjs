// Issue #450 — eventos de reforço de palavras fracas gravados em usage_events.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const EVENTS = ['weak_reinforce', 'weak_open_vault', 'weak_pause', 'weak_session_done'];

const migration = readdirSync(new URL('../supabase/migrations', import.meta.url))
  .find((f) => f.endsWith('_usage_events_weak_words.sql'));
assert.ok(migration, 'migration da lista de eventos');
const sql = read(`supabase/migrations/${migration}`);
for (const ev of ['player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done', ...EVENTS]) {
  assert.ok(sql.includes(`'${ev}'`), `lista fechada mantém/inclui ${ev}`);
}
assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i, 'expand-only');

const client = read('dashboard/js/ui/homeView.js') + read('dashboard/js/ui/studyView.js');
for (const ev of EVENTS) {
  assert.ok(new RegExp(`logUsageEvent(\\?\\.)?\\('${ev}'\\)`).test(client), `cliente grava ${ev}`);
}

console.log('weak-usage-events: ok');
