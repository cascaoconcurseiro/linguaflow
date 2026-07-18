import assert from 'node:assert/strict';
import fs from 'node:fs';

const study = fs.readFileSync(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../utils/db.js', import.meta.url), 'utf8');
const migrations = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(x => x.includes('adaptive_learning_profiles'));
assert.equal(migrations.length, 1);
const sql = fs.readFileSync(new URL(`../supabase/migrations/${migrations[0]}`, import.meta.url), 'utf8');
assert.match(sql, /enable row level security/i);
assert.match(sql, /auth\.uid\(\).*user_id/is);
assert.match(sql, /revoke all on function public\.record_card_learning_signal/is);
assert.match(study, /getAdaptiveProfiles/);
assert.match(study, /recordAdaptiveSignal/);
assert.match(study, /preloadNaturalAudio/);
assert.match(db, /async getAdaptiveProfiles/);
console.log('Contrato adaptativo e RLS: 7 testes passaram ✅');
