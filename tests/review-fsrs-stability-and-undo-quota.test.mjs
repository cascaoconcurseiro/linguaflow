#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sql, db] = await Promise.all([
  readFile(new URL('../supabase/migrations/20260926110000_fsrs_stability_guard_and_undo_quota.sql', import.meta.url), 'utf8'),
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
]);

assert.match(sql, /RENAME TO record_card_review_before_stability_guard/i,
  'migration deve renomear a versão anterior');
assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_card_review_before_stability_guard[\s\S]+FROM PUBLIC, anon, authenticated, service_role/i,
  'função anterior deve ter permissões revogadas');

// Stability zero-division guard
assert.match(sql, /greatest\(0\.1,\s*coalesce\(nullif\(v_card\.stability,\s*0\)/i,
  'estabilidade zero deve ser normalizada para prevenir divisão por zero');
assert.match(sql, /v_retrievability:=power\(1\+v_factor\*greatest\(v_elapsed,0\.01\)\/v_stability,v_decay\)/i,
  'retrievability calculada com denominador seguro');
assert.match(sql, /IF v_stability IS NULL OR v_stability <= 0 THEN v_stability:=greatest\(0\.1,v_fsrs_w\[p_quality\]\); END IF;/i,
  'ramo new/learning deve normalizar estabilidade <= 0');

// Undo quota alignment
assert.match(sql, /v_new_today[\s\S]+FROM public\.learning_events le[\s\S]+NOT EXISTS \(\s*SELECT 1 FROM public\.card_review_undos undo[\s\S]+undo\.review_log_id = nullif\(le\.evidence->>'review_log_id', ''\)::uuid/i,
  'contagem de cards novos do dia deve excluir revisões desfeitas');
assert.match(sql, /v_review_today[\s\S]+FROM public\.review_log rl[\s\S]+NOT EXISTS \(\s*SELECT 1 FROM public\.card_review_undos undo[\s\S]+undo\.review_log_id = rl\.id/i,
  'contagem de revisões do dia deve excluir revisões desfeitas');

// getTodayCounts client alignment
assert.match(db, /card_review_undos\?created_at=gte\./i,
  'getTodayCounts no cliente deve buscar undos do dia');
assert.match(db, /const undoneSet = new Set\(\(undosToday \|\| \[\]\)\.map\(\(u\) => u\.review_log_id\)\.filter\(Boolean\)\);/i,
  'getTodayCounts deve indexar IDs de revisões desfeitas');
assert.match(db, /const activeReviews = \(logToday \|\| \[\]\)\.filter\(\(l\) => !undoneSet\.has\(l\.id\)\);/i,
  'getTodayCounts deve filtrar revisões desfeitas da contagem');

console.log('FSRS STABILITY GUARD AND UNDO QUOTA CONTRACT OK');
