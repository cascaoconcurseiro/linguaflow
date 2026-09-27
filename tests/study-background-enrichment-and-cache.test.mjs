// tests/study-background-enrichment-and-cache.test.mjs
// Contrato de FinOps, Cache Léxico Multi-tier e Pipeline em 2º Plano no Estudo

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('FinOps & Resiliência: updateWord permite ai_chunks sem perdas', () => {
  const dbCode = readFileSync('utils/db.js', 'utf8');
  assert.match(
    dbCode,
    /const\s+allowed\s*=\s*\[[^\]]*'ai_chunks'[^\]]*\]/,
    'updateWord deve incluir ai_chunks na lista de campos permitidos'
  );
});

test('FinOps & Resiliência: db.js possui Cache Multi-tier (L1 RAM + L2 Storage + L3 Supabase)', () => {
  const dbCode = readFileSync('utils/db.js', 'utf8');
  assert.match(
    dbCode,
    /storageKey\s*=\s*`lf_lex:\$\{cacheKey\}`/,
    'getCanonicalLexicon e saveCanonicalLexicon devem usar chave de storage local lf_lex:'
  );
  assert.match(
    dbCode,
    /_draftStorage\('get',\s*storageKey\)/,
    'getCanonicalLexicon deve consultar L2 storage local antes de falhar ou chamar a rede'
  );
  assert.match(
    dbCode,
    /_draftStorage\('set',\s*storageKey,/,
    'saveCanonicalLexicon deve persistir no L2 storage local'
  );
});

test('FinOps & Performance: enrichCard possui in-flight de-duplication e cache canônico', () => {
  const aiCode = readFileSync('dashboard/js/core/ai.js', 'utf8');
  assert.match(
    aiCode,
    /const\s+pendingEnrichments\s*=\s*new\s+Map\(\)/,
    'ai.js deve manter mapa de requisições pendentes para evitar chamadas duplicadas simultâneas'
  );
  assert.match(
    aiCode,
    /pendingEnrichments\.set\(enrichKey,\s*promise\)/,
    'enrichCard deve registrar promessa em voo para de-duplicação'
  );
});

test('FinOps & Performance: generateChunksWeb consulta cache canônico antes da IA', () => {
  const aiCode = readFileSync('dashboard/js/core/ai.js', 'utf8');
  assert.match(
    aiCode,
    /getCanonicalLexicon\(normWord\)/,
    'generateChunksWeb deve consultar o cache canônico antes de gastar tokens com IA'
  );
  assert.match(
    aiCode,
    /saveCanonicalLexicon/,
    'generateChunksWeb deve indexar chunks gerados no cache canônico'
  );
});

test('Estudo & UX: studyView possui pipeline em segundo plano (prewarmCard e scheduleBackgroundPipeline)', () => {
  const studyCode = readFileSync('dashboard/js/ui/studyView.js', 'utf8');
  assert.match(
    studyCode,
    /async\s+function\s+prewarmCard\s*\(card\)/,
    'studyView deve implementar prewarmCard para enriquecer frases em 2º plano'
  );
  assert.match(
    studyCode,
    /function\s+scheduleBackgroundPipeline\s*\(\)/,
    'studyView deve implementar scheduleBackgroundPipeline'
  );
  assert.match(
    studyCode,
    /preloadNaturalAudio\(word/,
    'prewarmCard deve pré-aquecer áudio em segundo plano'
  );
  assert.match(
    studyCode,
    /scheduleBackgroundPipeline\(\)/,
    'scheduleBackgroundPipeline deve ser agendado na navegação de cards'
  );
});

test('Resiliência: parseChunks desempacota strings JSON aninhadas e persistChunks usa updateWord', () => {
  const studyCode = readFileSync('dashboard/js/ui/studyView.js', 'utf8');
  assert.match(
    studyCode,
    /while\s*\(\s*typeof\s+arr\s*===\s*'string'\s*\)/,
    'parseChunks deve desempacotar recursivamente strings JSON aninhadas'
  );
  assert.match(
    studyCode,
    /updateWord\(card\.wordData\.id,\s*patch\)/,
    'persistChunks deve atualizar ai_chunks diretamente via updateWord'
  );
});

test('Banco de Dados: Migration 20260927120000_canonical_lexicon_update_merge existe e é válida', () => {
  const migPath = 'supabase/migrations/20260927120000_canonical_lexicon_update_merge.sql';
  assert.ok(existsSync(migPath), 'Arquivo de migration de merge deve existir');
  const sql = readFileSync(migPath, 'utf8');
  assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_or_cache_canonical_lexicon/i);
  assert.match(sql, /jsonb_agg/i, 'Merge inteligente de contextos deve usar jsonb_agg');
});

test('Cache léxico: L2 local é descartável e o cache compartilhado resiste a envenenamento', () => {
  const dbSrc = readFileSync('utils/db.js', 'utf8');
  // Sem isso o L2 cresce até estourar a cota e toda gravação local falha.
  const evictions = dbSrc.match(/startsWith\('lf_lex:'\)/g) || [];
  assert.ok(evictions.length >= 2, 'lf_lex: entra na evicção do chrome.storage e do localStorage');

  const sql = readFileSync('supabase/migrations/20260927120000_canonical_lexicon_update_merge.sql', 'utf8');
  assert.match(sql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_or_cache_canonical_lexicon\(text, text, jsonb\)\s+FROM\s+anon/i,
    'visitante anônimo não escreve no cache compartilhado');
  assert.doesNotMatch(sql, /GRANT[^;]*TO[^;]*\banon\b/i);
  assert.match(sql, /ON CONFLICT \(word, lang\) DO NOTHING/i, 'insert concorrente não lança unique_violation');
  assert.match(sql, /coalesce\(nullif\(v_row\.word_phon, ''\), nullif\(v_word_phon, ''\)\)/i,
    'IPA já existente não é sobrescrito por outro cliente (só preenche lacunas)');
});
