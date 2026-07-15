#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL(
  '../supabase/migrations/20260715155802_card_review_permissions_contract_p0_2b.sql',
  import.meta.url,
), 'utf8');
const executable = sql.replace(/--.*$/gm, '');

assert.match(sql, /REVOKE ALL ON TABLE public\.cards, public\.review_log FROM PUBLIC, anon, authenticated/i);
assert.match(sql, /GRANT SELECT ON TABLE public\.cards, public\.review_log TO authenticated/i);
assert.match(sql, /p0_2b_policy_preflight_failed/i);
assert.match(sql, /REVOKE DELETE ON TABLE public\.words FROM PUBLIC, anon, authenticated/i);
assert.match(sql, /FUNCTION public\.delete_word_safely\(p_word_id uuid\)/i);
assert.match(sql, /reviewed_word_cannot_be_deleted/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_word_safely\(uuid\) TO authenticated/i);
assert.match(sql, /card_state_restored/i);
assert.match(sql, /backup_restore_requires_pristine_card/i);
assert.match(sql, /due_date=greatest\(v_due, v_earliest_review\)/i);
assert.match(sql, /card_backup_restore:v1:/i);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.restore_card_state\(uuid, jsonb\) TO authenticated/i);
assert.match(sql, /tablename IN \('cards', 'review_log'\)/i);
assert.match(sql, /DROP POLICY %I ON public\.%I/i);
assert.match(sql, /ON public\.cards\s+FOR SELECT\s+TO authenticated/i);
assert.match(sql, /ON public\.review_log\s+FOR SELECT\s+TO authenticated/i);
assert.doesNotMatch(executable, /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)/i);
assert.doesNotMatch(executable, /CREATE\s+POLICY[\s\S]*?FOR\s+(?:ALL|INSERT|UPDATE|DELETE)/i);

console.log('P0.2b least-privilege card contracts passed.');
