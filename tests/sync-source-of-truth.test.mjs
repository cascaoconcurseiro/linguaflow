import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260718194534_sync_reader_and_atomic_sessions.sql', 'utf8');
const db = readFileSync('utils/db.js', 'utf8');
const reader = readFileSync('dashboard/js/ui/readerView.js', 'utf8');

assert.match(migration, /create table public\.reader_texts[\s\S]*enable row level security/i);
assert.match(migration, /primary key \(user_id, id\)/i);
assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.match(migration, /on conflict \(user_id, date, source\) do update[\s\S]*sessions\.seconds \+ excluded\.seconds/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /revoke all on function public\.log_study_time[\s\S]*from public, anon/i);
assert.match(db, /rpc\/log_study_time/);
assert.doesNotMatch(db, /sessions\?date=eq\.\$\{date\}/);
assert.match(db, /filter\(\(session\) => session\.date === today\)[\s\S]*reduce\(\(sum, session\)/);
assert.match(reader, /await loadSyncedTexts\(\)/);
assert.match(reader, /Promise\.all\(local\.map[\s\S]*migrateReaderText/);
assert.match(reader, /READER_MIGRATION_KEY/);
assert.match(reader, /escapeText\(t\.title\)/);

console.log('12 contratos de sincronização e fonte de verdade passaram ✅');
