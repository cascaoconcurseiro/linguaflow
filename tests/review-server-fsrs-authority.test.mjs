#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260907100000_server_authoritative_fsrs.sql', import.meta.url,
), 'utf8');
const db = await readFile(new URL('../utils/db.js', import.meta.url), 'utf8');

assert.match(migration, /p_state continua na assinatura[\s\S]+mas é ignorado/i);
assert.doesNotMatch(migration, /p_state\s*->/i, 'nenhum campo do estado do cliente pode orientar a transição');
assert.match(migration, /FROM public\.cards c JOIN public\.words w[\s\S]+FOR UPDATE OF c/i);
assert.match(migration, /lf_srs_retention:' \|\| v_category/i);
assert.match(migration, /learning_steps:' \|\| v_category/i);
assert.match(migration, /v_relearning_steps/i);
assert.match(migration, /v_previous_difficulty:=v_difficulty[\s\S]+v_stability:=greatest\(0\.1,[\s\S]+v_previous_difficulty/i,
  'FSRS deve atualizar estabilidade usando a dificuldade anterior');
assert.match(migration, /is_leech=v_card\.is_leech OR v_lapses>=v_leech_threshold/i);
assert.match(migration, /card_before',v_before_json/i);
assert.match(migration, /v_existing\.evidence->'card_before'/i);
assert.match(migration, /commit_qualified_learning_event/i);

const logReview = db.slice(db.indexOf('async logReview('), db.indexOf('async undoReview('));
assert.match(logReview, /p_card_id:\s*cardId/);
assert.match(logReview, /p_quality:\s*quality/);
assert.match(logReview, /p_state:\s*null/);
assert.match(logReview, /p_client_review_id:\s*clientReviewId/);
assert.doesNotMatch(logReview, /_calculateNextState/);
assert.doesNotMatch(logReview, /cards\?id=eq/);
const undoReview = db.slice(db.indexOf('async undoReview('), db.indexOf('async getReviewLog('));
assert.match(undoReview, /card:\s*res\?\.card\s*\|\|\s*null/,
  'undoReview deve retornar o card restaurado pelo servidor');

console.log('SERVER-AUTHORITATIVE FSRS CONTRACT OK');
