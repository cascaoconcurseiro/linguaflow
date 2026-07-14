#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = 'supabase/migrations/20260714162952_private_evidence_commit_p0_1.sql';
const sql = readFileSync(path.join(root, file), 'utf8');
const concurrency = readFileSync(path.join(root, 'tests/db/evidence-commit-concurrency.sh'), 'utf8');
let passed = 0;

function check(condition, message) {
  if (!condition) throw new Error(`Falhou: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

console.log('Portão de Evidência P0.1');

check(/FUNCTION private\.commit_qualified_learning_event/i.test(sql), 'helper vive no schema privado');
check(/SECURITY DEFINER[\s\S]*?SET search_path = ''/i.test(sql), 'definer usa search_path vazio');
check(/REVOKE ALL ON FUNCTION private\.commit_qualified_learning_event[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i.test(sql), 'nenhum papel da API executa a helper');
check(!/GRANT EXECUTE/i.test(sql), 'migration não concede execução da helper');
check(!/CREATE OR REPLACE FUNCTION public\./i.test(sql), 'migration não cria RPC pública');
check(!/CREATE (?:OR REPLACE )?TRIGGER/i.test(sql), 'migration não altera triggers');
check(!/UPDATE public\.cards|UPDATE public\.review_log/i.test(sql), 'migration não muda review legado');
check(!/apply_learning_xp\s*\(/i.test(sql), 'helper não chama a projeção legada com bônus');
check((sql.match(/legacy_opening_balance/gi) || []).length === 1 &&
  /p_event_type = 'legacy_opening_balance'[\s\S]*opening balance is reserved for cutover/i.test(sql),
  'migration rejeita e não captura opening balance');

const lockPos = sql.indexOf('FOR UPDATE');
const eventLookupPos = sql.indexOf('FROM public.learning_events');
check(lockPos >= 0 && eventLookupPos > lockPos, 'user_stats é bloqueado antes de eventos e ledgers');
check(/MESSAGE = 'event_id_conflict'/i.test(sql), 'event ID divergente gera conflito explícito');
check(/MESSAGE = 'semantic_key_conflict'/i.test(sql), 'colisão semântica divergente gera conflito explícito');
check(/WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key/i.test(sql), 'entitlement é deduplicado antes do award');
check(/p_xp_reason NOT IN/i.test(sql), 'razão de XP usa allowlist mesmo sem ledger');
check(/\? '_reward'/i.test(sql), 'namespace de evidência gerado pelo servidor é reservado');
check(/\{_reward,dedupe_key\}/i.test(sql) && /\{_reward,daily_cap\}/i.test(sql), 'retry compara o contrato contábil completo');
check(/MESSAGE = 'dedupe_key_conflict'/i.test(sql), 'colisão incompatível de entitlement gera conflito');
check(/least\(p_base_xp, v_cap_remaining\)/i.test(sql), 'cap é calculado antes da escrita');
check(/INSERT INTO public\.learning_events[\s\S]*INSERT INTO public\.xp_ledger[\s\S]*UPDATE public\.user_stats/i.test(sql), 'evento, ledger e projeção compartilham a transação');
check(/v_stats\.xp_total := coalesce\(v_stats\.xp_total, 0\) \+ v_award/i.test(sql), 'projeção recebe exatamente o award do ledger');
check(!/\+\s*15|15\s*\+/i.test(sql), 'P0.1 não introduz bônus arbitrário de primeiro dia');
check(/'outcome', 'duplicate'[\s\S]*'xp_awarded', 0[\s\S]*'original_award'/i.test(sql), 'retry não repete animação e informa award original');
check(/'outcome', CASE WHEN p_evidence_eligible THEN 'accepted' ELSE 'ineligible' END/i.test(sql), 'accepted e ineligible são outcomes separados');
check(/'competitive_xp_awarded'/i.test(sql), 'retorno separa XP competitivo');
check(/-h "\$SOCK"[\s\S]*-d "\$DB"/i.test(concurrency), 'harness usa o socket e banco efêmeros corretos');
check(/pids\+=\("\$!"\)[\s\S]*wait "\$\{pids/i.test(concurrency), 'harness verifica cada processo concorrente');
check(/events <> 20 OR ledgers <> 10 OR total <> 20/i.test(concurrency), 'harness disputa cap com vinte fatos diferentes');

console.log(`\n${passed} contratos do portão P0.1 passaram.`);
