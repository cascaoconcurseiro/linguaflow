import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const migrations = migrationFiles.map((name) => ({
  name,
  sql: readFileSync(join(migrationsDir, name), 'utf8'),
}));

const authorityMigration = migrations.find(({ sql }) =>
  /adaptive learning writes are rpc-only/i.test(sql));

assert.ok(authorityMigration, 'existe migration forward-only para tornar escrita adaptativa exclusiva da RPC');

const authoritySql = authorityMigration?.sql || '';
assert.match(authoritySql, /create index if not exists card_learning_signals_card_id_idx\s+on public\.card_learning_signals\s*\(card_id\)/i);
assert.match(authoritySql, /create index if not exists card_adaptive_profiles_card_id_idx\s+on public\.card_adaptive_profiles\s*\(card_id\)/i);
assert.match(
  authoritySql,
  /revoke all on table public\.card_learning_signals, public\.card_adaptive_profiles\s+from authenticated/i,
);
assert.match(authoritySql, /grant select on table public\.card_learning_signals, public\.card_adaptive_profiles to authenticated/i);
assert.match(authoritySql, /pg_advisory_xact_lock/i, 'sinais simultâneos do mesmo card são serializados');
assert.match(
  authoritySql,
  /create or replace function public\.record_card_learning_signal[\s\S]*security definer[\s\S]*set search_path = ''/i,
);
assert.match(authoritySql, /revoke all on function public\.record_card_learning_signal\(uuid, uuid, jsonb\)[\s\S]*from public, anon, authenticated, service_role/i);
assert.match(authoritySql, /grant execute on function public\.record_card_learning_signal\(uuid, uuid, jsonb\) to authenticated/i);

const adaptiveDefinition = readFileSync(
  join(migrationsDir, '20260718223730_adaptive_learning_profiles.sql'),
  'utf8',
);
assert.match(adaptiveDefinition, /v_user uuid := auth\.uid\(\)/i);
assert.match(adaptiveDefinition, /c\.id = p_card_id and c\.user_id = v_user/i);

for (const relativePath of [
  'supabase/functions/deepseek-chat/index.ts',
  'supabase/functions/tts/index.ts',
  'supabase/functions/url-import/index.ts',
]) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  assert.match(source, /MAX_BODY_BYTES/, `${relativePath} limita o corpo antes de processar`);
  assert.match(source, /readJsonBody\(req, MAX_BODY_BYTES\)/, `${relativePath} usa leitura limitada`);
  assert.match(
    source,
    /parsed === null[\s\S]{0,160}typeof parsed !== "object"[\s\S]{0,160}Array\.isArray\(parsed\)/,
    `${relativePath} rejeita JSON nulo, primitivo e array`,
  );
  assert.match(source, /AbortSignal\.(?:timeout|any)/, `${relativePath} limita upstreams com AbortSignal`);
  assert.match(source, /await fetch\([\s\S]{0,500}signal(?:\s*:|,)/, `${relativePath} entrega o sinal ao fetch upstream`);
  assert.doesNotMatch(source, /error:\s*\(error as Error\)\.message/, `${relativePath} não expõe erro interno no catch público`);
  assert.match(source, /method_not_allowed/, `${relativePath} rejeita métodos fora do contrato`);
}

const deepseek = readFileSync(join(root, 'supabase/functions/deepseek-chat/index.ts'), 'utf8');
assert.match(deepseek, /MAX_MESSAGES/);
assert.match(deepseek, /MAX_TEXT_INPUT_CHARS/);
assert.match(deepseek, /messages_invalid/);

const quotaMigration = migrations.find(({ sql }) => /atomic api quota/i.test(sql));
assert.ok(quotaMigration, 'rate limit possui autoridade transacional no banco');
assert.match(quotaMigration?.sql || '', /pg_advisory_xact_lock/i);
assert.match(quotaMigration?.sql || '', /create or replace function public\.consume_api_quota/i);
assert.match(quotaMigration?.sql || '', /p_endpoint is null\s+or\s+p_endpoint not in/i);
assert.match(quotaMigration?.sql || '', /api_usage_log_created_at_idx/i, 'retenção possui índice temporal global');
assert.match(
  quotaMigration?.sql || '',
  /pg_try_advisory_xact_lock[\s\S]*delete from public\.api_usage_log[\s\S]*created_at <[\s\S]*limit\s+500/i,
  'retenção é oportunista, serializada e possui lote limitado',
);
for (const relativePath of [
  'supabase/functions/deepseek-chat/index.ts',
  'supabase/functions/tts/index.ts',
  'supabase/functions/url-import/index.ts',
]) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  assert.match(source, /admin\.rpc\("consume_api_quota"/,
    `${relativePath} consome a cota atômica`);
  assert.doesNotMatch(source, /\.from\("api_usage_log"\)[\s\S]{0,300}count:\s*"exact"/,
    `${relativePath} não mantém count e insert separados`);
}

assert.ok(
  deepseek.lastIndexOf('await consumeQuota(admin, userId') > deepseek.indexOf('messages_invalid'),
  'chat de texto só consome quota depois de validar messages',
);
assert.ok(
  deepseek.indexOf('await consumeQuota(admin, userId') > deepseek.indexOf('Gravação, frase ou consentimento inválido.'),
  'rota de voz só consome quota depois de validar seu body',
);

const tts = readFileSync(join(root, 'supabase/functions/tts/index.ts'), 'utf8');
assert.ok(
  tts.indexOf('await consumeQuota(admin, userId') > tts.indexOf('Body inválido: text obrigatório.'),
  'TTS só consome quota depois de validar o texto',
);

const urlImport = readFileSync(join(root, 'supabase/functions/url-import/index.ts'), 'utf8');
assert.ok(
  urlImport.indexOf('await consumeQuota(admin, userId') > urlImport.indexOf('URL inválida.'),
  'importador só consome quota depois de validar o campo URL',
);

console.log('production security contract tests passed');
