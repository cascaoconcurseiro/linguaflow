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
assert.match(sql, /tablename IN \('cards', 'review_log'\)/i);
assert.match(sql, /DROP POLICY %I ON public\.%I/i);
assert.match(sql, /ON public\.cards\s+FOR SELECT\s+TO authenticated/i);
assert.match(sql, /ON public\.review_log\s+FOR SELECT\s+TO authenticated/i);
assert.doesNotMatch(executable, /GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)/i);
assert.doesNotMatch(executable, /FOR\s+(?:ALL|INSERT|UPDATE|DELETE)/i);

console.log('P0.2b least-privilege card contracts passed.');
