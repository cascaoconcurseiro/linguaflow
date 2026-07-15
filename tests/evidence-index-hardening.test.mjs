#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL(
  '../supabase/migrations/20260715160836_evidence_fk_index_hardening_p0_2.sql',
  import.meta.url,
), 'utf8');

assert.match(sql, /DROP INDEX IF EXISTS public\.cards_user_word_key/i);
assert.match(sql, /card_review_undos \(user_id, learning_event_id\)/i);
assert.match(sql, /xp_ledger \(user_id, learning_event_id\)/i);
assert.match(sql, /xp_ledger \(user_id, reverses_entry_id\)/i);

console.log('P0.2 evidence FK indexes passed.');
