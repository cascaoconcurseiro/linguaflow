#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL(
  '../supabase/migrations/20260906120000_authoritative_review_daily_limits.sql',
  import.meta.url,
), 'utf8');
const snapshotSql = await readFile(new URL(
  '../supabase/migrations/20260906130000_review_undo_snapshot_authority.sql',
  import.meta.url,
), 'utf8');

assert.match(sql, /CREATE INDEX IF NOT EXISTS review_log_user_date_previous_status_idx\s+ON public\.review_log \(user_id, date, previous_status\)/i);
assert.match(sql, /key = 'new_per_day'[\s\S]+key = 'max_reviews_per_day'/i);
assert.match(sql, /key = 'leech_threshold'[\s\S]+key = 'leech_action'/i);
assert.match(sql, /v_new_limit\s*:=\s*greatest\(0,[\s\S]+v_review_limit\s*:=\s*greatest\(1,/i);
assert.match(sql, /EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range/i);
assert.match(sql, /v_new_today\s*>=\s*v_new_limit[\s\S]+new_daily_limit/i);
assert.match(sql, /previous_status\s+IN\s*\('review',\s*'mature'\)[\s\S]+v_review_today\s*>=\s*v_review_limit[\s\S]+review_daily_limit/i);
assert.match(sql, /FROM public\.user_stats WHERE user_id = v_user_id FOR UPDATE[\s\S]+FROM public\.settings[\s\S]+FROM public\.cards[\s\S]+FOR UPDATE/i);
assert.match(sql, /is_leech\s*=\s*v_card\.is_leech OR[\s\S]+suspended\s*=\s*v_card\.suspended OR/i,
  'leech e suspensão devem ser derivados no servidor');
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_card_review\(\s*p_card_id uuid,\s*p_quality smallint,\s*p_state jsonb,\s*p_client_review_id uuid/i);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_card_review\(uuid, smallint, jsonb, uuid\)[\s\S]+GRANT EXECUTE[\s\S]+TO authenticated/i);

assert.match(snapshotSql, /RENAME TO record_card_review_before_snapshot_response/i);
assert.match(snapshotSql, /event\.evidence->'card_before'[\s\S]+event\.id = p_client_review_id/i,
  'a primeira resposta e o retry idempotente devem devolver o snapshot imutável do evento');
assert.match(snapshotSql, /v_result \|\| jsonb_build_object\('card_before', v_card_before\)/i);
assert.match(snapshotSql, /RENAME TO revert_card_review_from_stored_snapshot/i);
const publicUndo = snapshotSql.slice(snapshotSql.indexOf('CREATE OR REPLACE FUNCTION public.revert_card_review('));
assert.doesNotMatch(publicUndo, /revert_card_review_from_stored_snapshot\(p_review_log_id,\s*p_previous_card\)/i,
  'o wrapper público nunca pode encaminhar o snapshot do navegador');
assert.match(publicUndo, /revert_card_review_from_stored_snapshot\(p_review_log_id, NULL\)/i,
  'undo compatível deve delegar sem estado controlado pelo cliente');
assert.match(snapshotSql, /REVOKE ALL ON FUNCTION public\.revert_card_review_from_stored_snapshot[\s\S]+FROM PUBLIC, anon, authenticated, service_role/i,
  'a implementação interna não pode permanecer exposta pela Data API');

console.log('AUTHORITATIVE REVIEW DAILY LIMITS CONTRACT OK');
