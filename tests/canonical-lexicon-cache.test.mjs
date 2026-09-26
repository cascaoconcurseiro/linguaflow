// tests/canonical-lexicon-cache.test.mjs
// Contrato de FinOps e Cache Léxico Canônico (Fase 1)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_PATH = 'supabase/migrations/20260926120000_canonical_lexicon_cache.sql';

test('FinOps: Migration do Cache Léxico Canônico', () => {
  assert.ok(existsSync(MIGRATION_PATH), 'Arquivo de migration deve existir');
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  assert.match(sql, /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.canonical_lexicon/i, 'Cria tabela public.canonical_lexicon');
  assert.match(sql, /word\s+text\s+NOT\s+NULL/i, 'Coluna word obrigatória');
  assert.match(sql, /lang\s+text\s+NOT\s+NULL/i, 'Coluna lang obrigatória');
  assert.match(sql, /word_phon\s+text/i, 'Coluna word_phon para IPA canônico');
  assert.match(sql, /word_pt\s+text/i, 'Coluna word_pt para tradução canônica');
  assert.match(sql, /contexts\s+jsonb\s+NOT\s+NULL/i, 'Coluna contexts jsonb para frases enriquecidas');
  assert.match(sql, /usage_count\s+integer\s+NOT\s+NULL/i, 'Contador de uso para métricas de popularidade');
  assert.match(sql, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i, 'RLS deve estar habilitado');
  assert.match(sql, /idx_canonical_lexicon_lookup/i, 'Índice de busca rápido por lower(trim(word))');
  assert.match(sql, /FUNCTION\s+public\.get_or_cache_canonical_lexicon/i, 'RPC get_or_cache_canonical_lexicon deve existir');
  assert.match(sql, /SECURITY\s+DEFINER/i, 'RPC deve ser SECURITY DEFINER');
  assert.match(sql, /SET\s+search_path\s*=\s*public,\s*pg_temp/i, 'search_path restrito');
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION[\s\S]*FROM\s+PUBLIC/i, 'Revoga grants públicos na RPC');
});

test('FinOps: Métodos no DB Client e Proxy no Service Worker', () => {
  const dbCode = readFileSync('utils/db.js', 'utf8');
  assert.match(dbCode, /async\s+getCanonicalLexicon\s*\(/, 'db.js deve exportar getCanonicalLexicon');
  assert.match(dbCode, /async\s+saveCanonicalLexicon\s*\(/, 'db.js deve exportar saveCanonicalLexicon');

  const swCode = readFileSync('background/service-worker.js', 'utf8');
  assert.match(swCode, /'getCanonicalLexicon'/, 'service-worker deve permitir getCanonicalLexicon em DB_PROXY_METHODS');
  assert.match(swCode, /'saveCanonicalLexicon'/, 'service-worker deve permitir saveCanonicalLexicon em DB_PROXY_METHODS');
});

test('FinOps: enrichCard consulta o cache antes de chamar a IA', async () => {
  const aiCode = readFileSync('dashboard/js/core/ai.js', 'utf8');
  assert.match(aiCode, /getCanonicalLexicon/, 'enrichCard deve verificar o cache canônico');
  assert.match(aiCode, /saveCanonicalLexicon/, 'enrichCard deve persistir novos enriquecimentos no cache canônico');
  assert.match(aiCode, /_cached:\s*true/, 'enrichCard deve sinalizar acertos no cache');
});

test('FinOps: Lógica de resolução em memória do Cache Léxico', () => {
  // Simula a lógica de matching de contexto do canonical lexicon
  const cachedRecord = {
    word: 'through',
    lang: 'en',
    word_phon: '/θruː/',
    word_pt: 'através',
    contexts: [
      {
        sentence: 'I walked through the park.',
        sentence_phon: '/aɪ wɔːkt θruː ðə pɑːrk/',
        sentence_pt: 'Eu caminhei pelo parque.',
        word_pt: 'pelo',
      },
    ],
  };

  const normSent = 'I walked through the park.'.trim().toLowerCase();
  const matched = cachedRecord.contexts.find(
    (ctx) => ctx.sentence.trim().toLowerCase() === normSent
  );

  assert.ok(matched, 'Deve encontrar o contexto exato independente de case');
  assert.equal(matched.word_pt, 'pelo');
  assert.equal(cachedRecord.word_phon, '/θruː/');

  // Contexto não correspondente
  const unknownSent = 'Through hard work, he succeeded.'.trim().toLowerCase();
  const notFound = cachedRecord.contexts.find(
    (ctx) => ctx.sentence.trim().toLowerCase() === unknownSent
  );
  assert.equal(notFound, undefined, 'Deve retornar undefined para contexto inédito');
});

