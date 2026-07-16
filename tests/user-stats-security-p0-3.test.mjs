import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expandPath = path.join(root, 'supabase/migrations/20260716124439_expand_safe_leaderboard_p0_3.sql');
const contractPath = path.join(root, 'supabase/migrations/20260716124440_contract_user_stats_and_legacy_xp_p0_3.sql');
const expandSql = fs.readFileSync(expandPath, 'utf8');
const contractSql = fs.readFileSync(contractPath, 'utf8');
const sql = `${expandSql}\n${contractSql}`;
const db = fs.readFileSync(path.join(root, 'utils/db.js'), 'utf8');
const leagues = fs.readFileSync(path.join(root, 'dashboard/js/ui/leaguesView.js'), 'utf8');

const check = (condition, message) => assert.ok(condition, message);

for (const signature of [
  'public.record_learning_event(text, integer)',
  'public.claim_weekly_quest(integer)',
]) {
  const escaped = signature.replace(/[()]/g, '\\$&');
  check(
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i').test(sql),
    `${signature} deve ser revogada de todos os papeis cliente`,
  );
  check(
    !new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped}\\s+to\\s+service_role`, 'i').test(sql),
    `${signature} deve ser revogada inclusive do backend legado`,
  );
}

check(/create\s+or\s+replace\s+function\s+public\.get_leaderboard\s*\(/i.test(expandSql), 'expand cria RPC estreita de leaderboard');
check(/security\s+definer\s+set\s+search_path\s*=\s*''/i.test(sql), 'RPC privilegiada fixa search_path vazio');
check(/v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i.test(sql), 'RPC deriva identidade do JWT');
check(/not_authenticated/i.test(sql), 'RPC rejeita chamada sem autenticação');
check(/v_limit\s+integer\s*:=\s*greatest\s*\(\s*1\s*,\s*least\s*\([\s\S]*?,\s*100\s*\)\s*\)/i.test(sql), 'RPC limita o tamanho do ranking');
check(/returns\s+table\s*\(\s*username\s+text,\s*avatar_url\s+text,\s*xp_week\s+integer,\s*league_index\s+integer,\s*is_current_user\s+boolean/si.test(sql), 'retorno contém somente projeção pública mínima');

const leaderboardBlock = expandSql.match(/CREATE OR REPLACE FUNCTION public\.get_leaderboard[\s\S]*?\$\$;/i)?.[0] || '';
for (const privateColumn of ['email_opt_in', 'email_last_sent_at', 'timezone', 'last_study_date', 'xp_total', 'daily_counters']) {
  check(!new RegExp(`\\b${privateColumn}\\b`, 'i').test(leaderboardBlock), `leaderboard não expõe ${privateColumn}`);
}
check(!/stats\.user_id\s*,/i.test(leaderboardBlock), 'leaderboard não retorna UUID estável');
check(!/drop\s+policy|revoke\s+all\s+on\s+table\s+public\.user_stats/i.test(expandSql), 'expand não quebra o cliente antigo');

check(/drop\s+policy\s+if\s+exists\s+"Anyone can read user_stats"/i.test(sql), 'remove leitura global');
check(/drop\s+policy\s+if\s+exists\s+"Users can insert own stats"/i.test(sql), 'remove criação direta de stats');
check(/create\s+policy\s+"Users read own user_stats"[\s\S]*?for\s+select[\s\S]*?to\s+authenticated[\s\S]*?auth\.uid\(\)[\s\S]*?=\s*user_id/i.test(sql), 'mantém leitura somente do proprietário');
check(/revoke\s+all\s+on\s+table\s+public\.user_stats\s+from\s+public,\s*anon,\s*authenticated/i.test(sql), 'remove grants amplos do cliente');
check(/grant\s+select\s+on\s+table\s+public\.user_stats\s+to\s+authenticated/i.test(sql), 'restaura apenas SELECT autenticado sujeito a RLS');
check(!/grant\s+(?:insert|update|delete|all)[^;]*user_stats[^;]*authenticated/i.test(sql), 'não devolve escrita direta em user_stats');

check(/_fetch\('rpc\/get_leaderboard'/i.test(db), 'cliente usa a projeção segura do leaderboard');
check(!/_fetch\(`user_stats\?league_index=/i.test(db), 'cliente não lê o placar direto da tabela privada');
check(!/async\s+recordEvent\s*\(/i.test(db), 'cliente remove writer legado de XP');
check(!/async\s+claimWeeklyQuest\s*\(/i.test(db), 'cliente remove claim semanal controlado pelo navegador');
check(/u\.is_current_user\s*===\s*true/i.test(leagues), 'Liga identifica o usuário sem expor UUID');

console.log('✓ P0.3: user_stats privado e XP legado fora da Data API');
