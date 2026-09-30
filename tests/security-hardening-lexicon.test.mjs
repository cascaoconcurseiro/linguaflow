// tests/security-hardening-lexicon.test.mjs — Issue #374: cache de léxico
// compartilhado com limites e TRUNCATE fora do alcance dos clientes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20260929234913_security_hardening_lexicon_truncate.sql', import.meta.url), 'utf8');

test('RPC do léxico: limites de tamanho e escrita inválida vira leitura', () => {
  assert.match(sql, /char_length\(v_norm_word\) > 80/);
  assert.match(sql, /char_length\(coalesce\(p_entry->>'word_pt', ''\)\) > 300/);
  assert.match(sql, /char_length\(coalesce\(\(p_entry->'context'\)::text, ''\)\) > 4000/);
  assert.match(sql, /THEN\s+p_entry := NULL;/);
});

test('RPC do léxico: no máximo 20 contextos e primeira gravação continua vencendo', () => {
  assert.match(sql, /c_max_contexts constant int := 20/);
  assert.match(sql, /jsonb_array_length\(coalesce\(v_row\.contexts, '\[\]'::jsonb\)\) < c_max_contexts/);
  assert.match(sql, /word_pt = coalesce\(nullif\(v_row\.word_pt, ''\), nullif\(v_word_pt, ''\)\)/);
  assert.match(sql, /SECURITY DEFINER\s+SET search_path TO 'public', 'pg_temp'/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.get_or_cache_canonical_lexicon\(text, text, jsonb\) FROM anon/);
});

test('TRUNCATE revogado de anon e authenticated, inclusive em tabelas futuras', () => {
  assert.match(sql, /REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated/);
});
