import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const constraintMigration = '20260722224000_restore_cards_user_word_constraint.sql';
const [replay, concurrency, constraintSql, permissions] = await Promise.all([
  readFile(new URL('./validate-migrations.sh', import.meta.url), 'utf8'),
  readFile(new URL('./card-review-p0-2a-concurrency.mjs', import.meta.url), 'utf8'),
  readFile(new URL(`../../supabase/migrations/${constraintMigration}`, import.meta.url), 'utf8'),
  readFile(new URL('./card-permissions-p0-2b.sql', import.meta.url), 'utf8'),
]);

const reviewSql = 'tests/db/card-review-p0-2a.sql';
const reviewConcurrency = 'tests/db/card-review-p0-2a-concurrency.mjs';
const permissionsSql = 'tests/db/card-permissions-p0-2b.sql';

for (const gate of [reviewSql, reviewConcurrency, permissionsSql]) {
  assert.match(replay, new RegExp(gate.replaceAll('/', '\\/').replaceAll('.', '\\.')),
    `o replay efêmero deve executar ${gate}`);
}

assert.ok(
  replay.indexOf(reviewSql) < replay.indexOf(reviewConcurrency)
    && replay.indexOf(reviewConcurrency) < replay.indexOf(permissionsSql),
  'os gates devem executar revisão, concorrência e permissões nessa ordem',
);

assert.doesNotMatch(
  replay,
  /(?:card-review-p0-2a|card-permissions-p0-2b)[^\n]*(?:\|\|\s*true|if\s+command|SKIP)/i,
  'gates P0.2 não podem ser opcionais nem converter falha em sucesso',
);

assert.match(concurrency, /const \[psql, port, database, host, user\]/,
  'o teste concorrente deve aceitar socket e superusuário do Postgres efêmero');
assert.match(concurrency, /'-h',\s*host/,
  'o teste concorrente deve usar o host/socket recebido pelo replay');
assert.match(concurrency, /'-U',\s*user/,
  'o teste concorrente não pode presumir que o superusuário se chama postgres');
assert.match(constraintSql, /unique \(user_id, word_id\)/i,
  'a cadeia precisa restaurar a unicidade exigida por create_card_for_word');
assert.match(permissions, /record_card_review\([^,]+,\s*2::smallint/i,
  'o gate SQL deve chamar a assinatura real smallint de record_card_review');
assert.match(permissions, /reset role;[\s\S]*select 1 from public\.words/i,
  'a prova física da exclusão deve ocorrer fora do papel autenticado sem SELECT');

console.log('Replay efêmero executa todos os gates SQL P0.2 em modo fail-closed.');
