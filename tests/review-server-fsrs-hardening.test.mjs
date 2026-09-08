#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sql, db] = await Promise.all([
  readFile(new URL('../supabase/migrations/20260908100000_harden_server_authoritative_fsrs.sql', import.meta.url), 'utf8'),
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
]);

assert.match(sql, /RENAME TO record_card_review_before_fsrs_hardening/i);
assert.match(sql, /v_interval:=least\(v_max_int,greatest\(v_easy_int/i,
  'Fácil deve respeitar max_interval ao graduar');
assert.match(sql, /v_interval:=least\(v_max_int,greatest\(v_grad_int/i,
  'Bom deve respeitar max_interval ao graduar');
assert.match(sql, /suspended=v_card\.suspended OR \(v_leech_action='suspend' AND v_lapses>=v_leech_threshold\)/i,
  'card já marcado como leech deve poder ser suspenso após mudança da ação');
assert.doesNotMatch(sql, /v_leech_action='suspend' AND NOT v_card\.is_leech/i);
assert.match(sql, /'nan','inf','\+inf','-inf','infinity','\+infinity','-infinity'/i);
assert.match(sql, /card_review_undos[\s\S]+review_was_undone[\s\S]+'card', to_jsonb\(v_card\)/i,
  'retry posterior ao undo deve devolver o card atualmente persistido');
assert.match(sql, /'outcome', 'undone'[\s\S]+'accepted', false[\s\S]+'eligible', false/i);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_card_review[\s\S]+GRANT EXECUTE[\s\S]+TO authenticated/i);
assert.match(db, /nextInterval = Math\.min\(maxInt, Math\.max\(settings\.easyInt/,
  'prévia de Fácil deve usar o mesmo max_interval do servidor');
assert.match(db, /nextInterval = Math\.min\(maxInt, Math\.max\(settings\.gradInt/,
  'prévia de Bom deve usar o mesmo max_interval do servidor');

console.log('SERVER FSRS HARDENING CONTRACT OK');
