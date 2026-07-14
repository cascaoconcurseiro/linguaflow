#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const migration = 'supabase/migrations/20260714154841_learning_evidence_foundation_p0.sql';
const sql = readFileSync(path.join(root, migration), 'utf8');
let passed = 0;

function check(condition, message) {
  if (!condition) throw new Error(`Falhou: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

console.log('Fundação de Evidência P0');

check(/CREATE TABLE public\.learning_events/i.test(sql), 'cria ledger de evidências');
check(/CREATE TABLE public\.xp_ledger/i.test(sql), 'cria ledger contábil de XP');
check(/UNIQUE \(user_id, semantic_key\)/i.test(sql), 'deduplica o mesmo fato mesmo com UUIDs diferentes');
check(/UNIQUE \(user_id, id\)/i.test(sql), 'expõe chave composta de propriedade');
check(/UNIQUE \(user_id, dedupe_key\)/i.test(sql), 'deduplica recompensa por chave semântica');
check(/UNIQUE \(learning_event_id\)/i.test(sql), 'um evento produz no máximo um lançamento de XP');
check(/CREATE UNIQUE INDEX xp_ledger_single_reversal_idx/i.test(sql), 'um prêmio pode ser revertido no máximo uma vez');
check(/FOREIGN KEY \(user_id, learning_event_id\)/i.test(sql), 'lançamento pertence ao dono do evento');
check(/FOREIGN KEY \(user_id, reverses_entry_id\)/i.test(sql), 'reversão pertence ao dono do prêmio');
check(/entry_type = 'reversal' AND amount < 0/i.test(sql), 'reversões são lançamentos negativos');
check(/entry_type IN \('award', 'opening_balance'\) AND amount > 0/i.test(sql), 'prêmios e saldo inicial são positivos');
check(/ENABLE ROW LEVEL SECURITY/gi.test(sql), 'habilita RLS');
check((sql.match(/ENABLE ROW LEVEL SECURITY/gi) || []).length === 2, 'habilita RLS nos dois ledgers');
check((sql.match(/TO authenticated[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/gi) || []).length >= 2, 'políticas SELECT restringem pelo proprietário');
check(/REVOKE ALL ON TABLE public\.learning_events FROM PUBLIC, anon, authenticated/i.test(sql), 'revoga escrita/leitura implícita no ledger de eventos');
check(/REVOKE ALL ON TABLE public\.xp_ledger FROM PUBLIC, anon, authenticated/i.test(sql), 'revoga escrita/leitura implícita no ledger de XP');
check(/GRANT SELECT ON TABLE public\.learning_events TO authenticated/i.test(sql), 'expõe somente leitura própria de eventos');
check(/GRANT SELECT ON TABLE public\.xp_ledger TO authenticated/i.test(sql), 'expõe somente leitura própria de XP');
check(!/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]*?TO authenticated/i.test(sql), 'cliente autenticado não escreve diretamente');
check(/REVOKE ALL ON TABLE public\.learning_events FROM service_role/i.test(sql), 'remove grants implícitos do service role em eventos');
check(/REVOKE ALL ON TABLE public\.xp_ledger FROM service_role/i.test(sql), 'remove grants implícitos do service role em XP');
check(/pg_column_size\(evidence\) <= 4096/i.test(sql), 'limita tamanho da evidência');
check(/learning_events_event_subject_shape/i.test(sql), 'restringe evento ao tipo correto de objeto');
check(/learning_events_temporal_shape/i.test(sql) && /source = 'migration'/i.test(sql), 'saldo legado exige origem e shape canônicos');
check(/story_completed/i.test(sql) && /video_block/i.test(sql), 'razões cobrem história e vídeo');
check(/CREATE TRIGGER xp_ledger_validate_reversal/i.test(sql), 'reversão é validada no banco');
check(/NEW\.amount <> -original\.amount/i.test(sql), 'reversão precisa negar o valor exato');
check(!/FOR UPDATE/i.test(sql), 'reversão não exige privilégio UPDATE do service role');
check(!/INSERT INTO public\.learning_events/i.test(sql), 'expand-only não captura saldo antes do cutover');
check(!/FROM public\.user_stats/i.test(sql), 'expand-only não fotografa XP ainda mutável');
check(!/CREATE OR REPLACE FUNCTION public\.(record|complete|claim)/i.test(sql), 'corte expand-only ainda não troca RPCs de produção');
check(!/UPDATE public\.user_stats|UPDATE user_stats/i.test(sql), 'migration não altera projeção atual de XP');

console.log(`\n${passed} contratos da Fundação de Evidência passaram.`);
