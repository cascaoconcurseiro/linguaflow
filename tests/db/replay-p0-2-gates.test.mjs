import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const constraintMigration = '20260722224000_restore_cards_user_word_constraint.sql';
const [replay, concurrency, constraintSql] = await Promise.all([
  readFile(new URL('./validate-migrations.sh', import.meta.url), 'utf8'),
  readFile(new URL('./card-review-p0-2a-concurrency.mjs', import.meta.url), 'utf8'),
  readFile(new URL(`../../supabase/migrations/${constraintMigration}`, import.meta.url), 'utf8'),
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

console.log('Replay efêmero executa todos os gates SQL P0.2 em modo fail-closed.');
