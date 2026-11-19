// Privacidade do léxico compartilhado (#559): um aluno nunca recebe a frase de
// contexto enviada por outro. O cache continua economizando IA para a mesma frase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const MIG = 'supabase/migrations/20261119170000_canonical_lexicon_private_contexts.sql';
const strip = (s) => s.replace(/--.*$/gm, '');

test('migration: tabela sem leitura direta e RPCs devolvem só a frase pedida', () => {
  assert.ok(existsSync(MIG), 'migration de privacidade do léxico existe');
  const sql = strip(readFileSync(MIG, 'utf8'));
  assert.match(sql, /drop policy if exists canonical_lexicon_read on public\.canonical_lexicon/);
  assert.match(sql, /revoke all on table public\.canonical_lexicon from public, anon, authenticated/);
  assert.match(sql, /alter function public\.get_or_cache_canonical_lexicon\(text, text, jsonb\) set schema private/);
  assert.match(sql, /create or replace function private\.canonical_lexicon_for_sentence\(p_row jsonb, p_sentence text\)/);
  assert.match(sql, /create or replace function public\.get_canonical_lexicon\(p_word text, p_lang text, p_sentence text\)/);
  assert.match(sql, /create or replace function public\.get_or_cache_canonical_lexicon\(p_word text, p_lang text, p_entry jsonb\)/);
  // As duas RPCs públicas exigem usuário e filtram o retorno pela frase.
  const publicFns = sql.split(/create or replace function public\./).slice(1);
  assert.equal(publicFns.length, 2);
  for (const fn of publicFns) {
    assert.match(fn, /auth\.uid\(\) is null/, 'exige usuário logado');
    assert.match(fn, /private\.canonical_lexicon_for_sentence\(/, 'filtra as frases pelo pedido');
  }
  // Nada volta a ser concedido ao anon e as funções internas não são chamáveis.
  assert.doesNotMatch(sql, /grant [^;]* to [^;]*\banon\b/i);
  assert.match(sql, /revoke all on function private\.canonical_lexicon_upsert\(text, text, jsonb\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function private\.canonical_lexicon_for_sentence\(jsonb, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.get_canonical_lexicon\(text, text, text\) to authenticated/);
});

test('cliente: lê pela RPC informando a frase, nunca pela tabela', () => {
  const words = readFileSync('utils/db/words.js', 'utf8');
  assert.doesNotMatch(words, /canonical_lexicon\?word=eq\./, 'sem leitura REST direta da tabela');
  assert.match(words, /rpc\/get_canonical_lexicon/);
  assert.match(words, /p_sentence/);
  assert.match(words, /async getCanonicalLexicon\(word, lang = 'en', sentence = ''\)/);
  assert.match(words, /_proxy\('getCanonicalLexicon', \[word, lang, sentence\]\)/, 'o service worker recebe a frase');

  const ai = readFileSync('dashboard/js/core/ai.js', 'utf8');
  assert.match(ai, /getCanonicalLexicon\(normWord, 'en', normSentence\)/);
  assert.match(ai, /getCanonicalLexicon\(normWord, 'en', normContext\)/);
});
