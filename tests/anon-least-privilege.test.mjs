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

test('sequências: anon perde o grant herdado e os privilégios padrão', () => {
  const seq = readFileSync(new URL('../supabase/migrations/20261119140000_anon_least_privilege_sequences.sql', import.meta.url), 'utf8')
    .replace(/--.*$/gm, '');
  assert.match(seq, /revoke all on sequence public\.admin_audit_log_id_seq from public, anon/);
  assert.match(seq, /alter default privileges for role postgres in schema public revoke all on sequences from anon/);
  assert.match(seq, /if exists \(select 1 from pg_roles where rolname = 'postgres'\)/);
  assert.doesNotMatch(seq, /grant [^;]* to anon/i);
});

test('léxico canônico: sem leitura anônima (frases de contexto dos usuários)', () => {
  const lex = readFileSync(new URL('../supabase/migrations/20261119150000_canonical_lexicon_authenticated_only.sql', import.meta.url), 'utf8')
    .replace(/--.*$/gm, '');
  assert.match(lex, /revoke all on table public\.canonical_lexicon from public, anon;/);
  assert.match(lex, /create policy canonical_lexicon_read on public\.canonical_lexicon\s+for select to authenticated using \(true\);/);
  assert.doesNotMatch(lex, /to [^;]*\banon\b/i, 'nenhuma policy ou grant volta a incluir o anon');
});

test('privilégios padrão deixam de abrir tabelas e funções novas ao anon', () => {
  assert.match(sql, /alter default privileges for role postgres in schema public revoke all on tables from anon/);
  assert.match(sql, /alter default privileges for role postgres in schema public revoke execute on functions from anon/);
  // O replay da CI não tem o papel postgres: o bloco precisa ser condicional.
  assert.match(sql, /if exists \(select 1 from pg_roles where rolname = 'postgres'\)/);
});
