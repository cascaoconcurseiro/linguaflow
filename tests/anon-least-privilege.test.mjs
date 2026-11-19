// Contrato: o papel anon não recebe escrita em tabelas do curso nem herda grants padrão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Comentários (instruções de rollback) não contam como SQL executável.
const sql = readFileSync(new URL('../supabase/migrations/20261119120000_anon_least_privilege_courses.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const userTables = ['course_practice_sessions', 'course_session_results', 'course_user_mistakes', 'course_user_notes',
  'course_user_reviews', 'course_user_vocabulary', 'user_course_enrollment'];
const readOnly = ['course_catalog', 'course_lessons', 'course_units', 'canonical_lexicon', 'keep_alive'];

test('tabelas por usuário: anon perde todos os grants e não recebe nenhum de volta', () => {
  for (const t of userTables) {
    assert.match(sql, new RegExp(`revoke all on table public\\.${t} from public, anon;`), t);
    assert.doesNotMatch(sql, new RegExp(`grant [^;]* on table public\\.${t} to anon`), t);
  }
});

test('catálogo, léxico e keep-alive: anon fica só com SELECT', () => {
  for (const t of readOnly) {
    assert.match(sql, new RegExp(`revoke all on table public\\.${t} from public, anon;`), t);
    assert.match(sql, new RegExp(`grant select on table public\\.${t} to anon;`), t);
  }
  assert.doesNotMatch(sql, /grant (all|insert|update|delete|truncate)[^;]* to anon/i);
});

test('privilégios padrão deixam de abrir tabelas e funções novas ao anon', () => {
  assert.match(sql, /alter default privileges for role postgres in schema public revoke all on tables from anon/);
  assert.match(sql, /alter default privileges for role postgres in schema public revoke execute on functions from anon/);
  // O replay da CI não tem o papel postgres: o bloco precisa ser condicional.
  assert.match(sql, /if exists \(select 1 from pg_roles where rolname = 'postgres'\)/);
});
