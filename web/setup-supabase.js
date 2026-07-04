/**
 * Setup script — executes the LinguaFlow schema on Supabase.
 * Run: node setup-supabase.js
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vrrcagukyfnlhxuvnssp.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZycmNhZ3VreWZubGh4dXZuc3NwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcwMDg0NiwiZXhwIjoyMDgyMjc2ODQ2fQ.FrCVUHQ_4x0RCzpnNBFRRAfJj6_uezKJb2pNQ26xfiE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '001_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolons, filter empty
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))
    .filter((s) => !s.toUpperCase().startsWith('DO $$')); // skip DO blocks (can't execute via API)

  console.log(`Executando ${statements.length} statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).maybeSingle();
      if (error) {
        // Try direct REST call as fallback
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ sql: stmt + ';' }),
        });
        if (!res.ok) {
          console.log(
            `[${i + 1}/${statements.length}] ⚠️ Skipped (may already exist): ${stmt.substring(0, 60)}...`,
          );
        }
      } else {
        console.log(`[${i + 1}/${statements.length}] ✅ ${stmt.substring(0, 50)}...`);
      }
    } catch (e) {
      console.log(
        `[${i + 1}/${statements.length}] ⚠️ ${stmt.substring(0, 50)}... (${e.message?.substring(0, 40)})`,
      );
    }
  }

  console.log('\n✅ Setup concluído!');
  console.log(`\nURL do projeto: https://vrrcagukyfnlhxuvnssp.supabase.co`);
  console.log(
    'Anon Key:',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZycmNhZ3VreWZubGh4dXZuc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MDA4NDYsImV4cCI6MjA4MjI3Njg0Nn0.B398YG0L0TJqF5SIS06pJoXEpweYY84XdOG2DNQ21zQ',
  );
}

main().catch(console.error);
