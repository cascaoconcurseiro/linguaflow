#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL(
  '../supabase/migrations/20260906120000_authoritative_review_daily_limits.sql',
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

console.log('AUTHORITATIVE REVIEW DAILY LIMITS CONTRACT OK');
