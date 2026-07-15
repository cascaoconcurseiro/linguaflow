#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [db, study, library, settings, worker] = await Promise.all([
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/settingsView.js', import.meta.url), 'utf8'),
  readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8'),
]);

assert.match(db, /rpc\/create_card_for_word/);
assert.match(db, /rpc\/bury_card/);
assert.match(db, /rpc\/\$\{suspended \? 'suspend_card' : 'restore_card'\}/);
assert.match(db, /rpc\/restore_card_state/);
assert.match(db, /rpc\/delete_word_safely/);
assert.match(db, /error\?\.status !== 404[\s\S]*error\?\.code !== 'PGRST202'/);
assert.doesNotMatch(db, /async updateCard\s*\(/);
assert.doesNotMatch(db, /cards\?id=eq\.\$\{card\.id\}[\s\S]*method:\s*'PATCH'/);
assert.doesNotMatch(study, /lfDb\.updateCard\(/);
assert.doesNotMatch(library, /lfDb\.updateCard\(/);
assert.doesNotMatch(settings, /lfDb\.updateCard\(/);
assert.match(study, /lfDb\.buryCard\(card\.id\)/);
assert.match(library, /lfDb\.setCardSuspended\(card\.id, !card\.suspended\)/);
assert.match(library, /reviewed_word_cannot_be_deleted[\s\S]*Pause as revisões/);
assert.match(settings, /lfDb\.restoreCardState\(newCard\.id/);
assert.match(worker, /'buryCard'[\s\S]*'setCardSuspended'[\s\S]*'restoreCardState'/);
assert.match(worker, /method === 'updateCard'[\s\S]*LEGACY_CARD_WRITE_BLOCKED/);
assert.doesNotMatch(worker, /writeMethods\s*=\s*\[[\s\S]*?'updateCard'/);

console.log('P0.2 narrow card-write client contracts passed.');
