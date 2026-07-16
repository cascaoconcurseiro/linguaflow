# Schema canônico do Supabase — Onda 0

**Projeto observado:** `qnutoswrufznztoznlql`  
**Data do inventário:** 2026-07-16  
**Responsável:** Codex — frente de arquitetura/dados  
**Escopo:** somente leitura; nenhum objeto ou dado remoto foi alterado.

## O que é canônico neste projeto

O estado do banco não pode ser representado apenas pelos nomes dos arquivos de
migration: a produção possui 38 entradas de histórico, enquanto o repositório
possui 29 arquivos. Parte do histórico remoto anterior à auditoria foi
consolidada numa baseline local e 12 migrations posteriores têm o mesmo efeito
semântico, mas timestamps diferentes.

Até que uma reconciliação formal seja concluída, a fonte de verdade é composta:

1. **estado estrutural observado na produção**, inventariado sem ler dados de
   usuário;
2. **29 migrations locais**, que precisam reconstruir o banco vazio no CI;
3. **matriz explícita local↔remoto abaixo**, que explica a divergência histórica;
4. **contratos de RLS, grants e RPCs**, que não podem ser inferidos apenas por
   um diff de tabelas.

Não executar `supabase db push`, não renomear migration já aplicada e não usar
`migration repair` para tornar os números visualmente iguais. Uma mudança nova
de produção deve ser forward-only, possuir um novo arquivo criado pela CLI e
ser aplicada uma única vez depois de expand/contract quando necessário.

## Inventário local↔remoto

### Resumo

| Classe | Local | Remoto | Situação |
|---|---:|---:|---|
| Baseline consolidada | 1 arquivo | 10 migrations | Mapeamento intencional |
| Mesmo timestamp e nome | 16 | 16 | Correspondência direta |
| Mesmo propósito, timestamp diferente | 12 | 12 | Correspondência semântica |
| **Total** | **29** | **38** | Histórico divergente, schema reproduzível |

### Baseline local que representa dez migrations remotas

`00000000000000_baseline_schema.sql` reconstrói o estado anterior à auditoria e
representa estas entradas remotas:

- `001_schema`;
- `002_fix_user_id_default`;
- `003_fix_rpcs`;
- `20260709014418_fix_words_missing_columns_savewords_400`;
- `20260709014803_add_words_category_column`;
- `20260709084548_create_api_usage_log_rate_limit`;
- `20260709090149_get_deepseek_key_rpc_service_role_only`;
- `20260710093439_create_stories_table`;
- `20260710094824_streak_freeze_in_xp_trigger`;
- `20260710094945_drop_orphan_decks_table`.

A baseline é destinada ao replay vazio. O fato de usar guardas não autoriza
reaplicá-la na produção como mecanismo de reconciliação.

### Correspondência direta

As 16 versões de `20260710141336_security_hardening_e0` até
`20260711221906_email_reengagement` possuem timestamp e nome iguais nos dois
históricos:

`security_hardening_e0`, `translation_cache_e2`, `learning_engine_e4`,
`league_rollover_e5`, `harden_ensure_user_stats`,
`record_card_review_atomically`, `reversible_review_events`,
`revoke_anon_review_rpcs`, `client_error_telemetry`,
`timezone_daily_semantics`, `web_push`, `expose_push_public_key`,
`weekly_quest`, `grant_push_server_rpcs`, `word_mnemonic` e
`email_reengagement`.

### Correspondência semântica com timestamps diferentes

| Migration local | Migration remota aplicada |
|---|---|
| `20260712000000_security_audit_fixes` | `20260711224312_security_audit_fixes` |
| `20260712212413_video_clip_bounds` | `20260712213007_video_clip_bounds` |
| `20260712213444_learning_review_counts` | `20260712214050_learning_review_counts` |
| `20260712220319_finish_translation_cache_cleanup` | `20260712220525_finish_translation_cache_cleanup` |
| `20260714154841_learning_evidence_foundation_p0` | `20260715160545_learning_evidence_foundation_p0` |
| `20260714162952_private_evidence_commit_p0_1` | `20260715160548_private_evidence_commit_p0_1` |
| `20260714171353_card_review_evidence_expand_p0_2a` | `20260715160551_card_review_evidence_expand_p0_2a` |
| `20260715160836_evidence_fk_index_hardening_p0_2` | `20260715160916_evidence_fk_index_hardening_p0_2` |
| `20260715155802_card_review_permissions_contract_p0_2b` | `20260715165807_card_review_permissions_contract_p0_2b` |
| `20260715190000_restore_card_state_numeric_types_p0_2b` | `20260715170511_restore_card_state_numeric_types_p0_2b` |
| `20260716124439_expand_safe_leaderboard_p0_3` | `20260716160424_expand_safe_leaderboard_p0_3` |
| `20260716124440_contract_user_stats_and_legacy_xp_p0_3` | `20260716163329_contract_user_stats_and_legacy_xp_p0_3` |

Há uma diferença de ordem relevante: localmente o contract de permissões P0.2b
vem antes do hardening de índices; remotamente o hardening foi aplicado antes
do contract. O replay local passou no CI nessa ordem e os dois cortes são
compatíveis, mas essa divergência deve permanecer documentada — não deve ser
“corrigida” reordenando arquivos históricos.

## Snapshot estrutural observado

- PostgreSQL `17.6`;
- 17 tabelas da aplicação em `public`, todas com RLS habilitada;
- nenhuma tabela da aplicação em `private`;
- 29 funções da aplicação: 26 em `public` e 3 em `private`;
- 17 policies nas tabelas públicas;
- três triggers pertencentes à aplicação, incluindo
  `auth.users.on_auth_user_created → public.handle_new_user`;
- extensões relevantes: `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`,
  `supabase_vault` e `uuid-ossp`;
- cron ativo: `league-weekly-rollover`; `push-daily-reminder` e
  `email-weekly-reengagement` permanecem inativos.

Tabelas públicas observadas:

`api_usage_log`, `card_review_undos`, `cards`, `client_errors`, `known_words`,
`league_meta`, `learning_events`, `push_subscriptions`, `review_log`,
`sentences`, `sessions`, `settings`, `stories`, `translation_cache`,
`user_stats`, `words` e `xp_ledger`.

### Contratos que precisam permanecer explícitos

- `user_stats`, `cards`, `review_log`, `learning_events` e `xp_ledger` possuem
  leitura própria estreita; escritas privilegiadas passam pelas RPCs previstas.
- `get_leaderboard(integer, integer)` não retorna UUID e marca o usuário atual
  por `is_current_user`.
- `record_card_review(uuid, smallint, jsonb, uuid)` é a porta atômica da revisão.
- `private.commit_qualified_learning_event(...)` não é uma API pública.
- funções `SECURITY DEFINER` devem manter verificação de identidade, grants
  mínimos e `search_path` explícito; um alerta do advisor não autoriza revogação
  em massa.
- policies antigas com role `public` continuam protegidas por ownership/RLS,
  mas grants amplos são dívida registrada e precisam de matriz de uso antes de
  qualquer contract adicional.

O crescimento é uma preocupação operacional separada do schema: na observação,
`translation_cache` ocupava aproximadamente 16,4 MB e `words` aproximadamente
10,3 MB, em grande parte por snapshots. Esses números são métricas mutáveis, não
fazem parte do fingerprint estrutural.

## Como gerar um snapshot comparável

Executar `scripts/schema-inventory-readonly.sql` numa conexão autorizada. O SQL:

- abre transação `READ ONLY`;
- não consulta conteúdo de tabelas de usuário;
- inventaria tabelas, colunas, constraints, índices, policies, funções, triggers,
  grants e extensões;
- inclui apenas hash MD5 da definição das funções, não o corpo;
- produz `inventory_md5` determinístico para o mesmo catálogo.

O hash serve para detectar mudança, não para aprovar automaticamente um deploy.
Diferenças esperadas de versão de extensão, ACL ou definição precisam de revisão
humana. Cron e configurações do Auth devem ser registrados à parte porque são
estado operacional e podem não existir num replay Postgres puro.

Validação desta versão: o arquivo versionado foi executado integralmente contra
o projeto em transação somente leitura e retornou
`inventory_md5 = a7a1728be0e6e03159471d8a52b8f9d0` no PostgreSQL `17.6`. Esse é o
fingerprint remoto de referência de 2026-07-16, não um valor que deva ser
sobrescrito automaticamente quando houver diferença.

## Métricas de entrada da Onda 0

Antes de remover código ou coalescer o cold start, registrar no mesmo SHA:

| Métrica | Método | Critério inicial |
|---|---|---|
| Tempo até CTA primário utilizável | Performance mark, p50/p95 por viewport | Baseline real, sem regressão >10% |
| Operações Supabase no bootstrap/Home | Contagem por rota e sessão | Baseline; depois reduzir sem ocultar erro |
| Erros de bootstrap/auth | `client_errors` + console do preview | Zero erro fatal no smoke |
| Requests e bytes do primeiro carregamento | HAR desktop e 390 px | Baseline por build |
| Atualização do service worker | 3.0.11 → candidato, online/offline | Sem loop, tela vazia ou mistura de builds |
| `translation_cache` | linhas, bytes e crescimento/dia | Alerta e política antes de atingir quota |
| `words.snapshot` | linhas não nulas e bytes | Backup/verificação antes de remover coluna |
| Cardinalidade de listas | cards/reviews/words/sentences | Testar acima do limite PostgREST |

Sem RUM no produto, os primeiros números são laboratório e devem ser rotulados
assim. Performance real só pode ser afirmada após observação por dispositivo.

## Critérios de saída da Onda 0

- [ ] Inventário local↔remoto revisado por outra pessoa e sem entrada órfã.
- [ ] Replay das 29 migrations em Postgres vazio aprovado no CI.
- [ ] `inventory_md5` do replay comparado ao remoto; toda diferença classificada
  como esperada, correção forward-only ou bloqueador.
- [ ] Matriz de grants/RPCs cliente→objeto documentada antes de revogar acesso.
- [ ] Testes comportamentais cobrem startup, auth, revisão idempotente, popup,
  lifecycle de legendas e escrita local-first; contratos de fonte não contam
  sozinhos como prova comportamental.
- [ ] Baselines de performance e capacidade registradas com método reproduzível.
- [ ] Critério de compatibilidade definido para site, extensão instalada e banco.
- [ ] Cada onda seguinte possui dono, preview, smoke web+extensão, rollback e
  limiar objetivo de abortar.
- [ ] Nenhuma alteração remota é feita para “alinhar timestamps”.

## Referências operacionais

- O replay usado pelo CI está em `tests/db/validate-migrations.sh`.
- A baseline está em
  `supabase/migrations/00000000000000_baseline_schema.sql`.
- A partir de 2026, novos objetos públicos podem exigir grants explícitos para a
  Data API; por isso grants fazem parte do inventário, separadamente de RLS.
- O fluxo declarativo do Supabase ainda possui limitações para policies, grants,
  ownership de views e outros objetos. Ele pode auxiliar o diff, mas não
  substitui migrations revisadas nem esta matriz de segurança.
