# Fundação de Evidência P0 — Especificação Executável

**Responsável:** Codex, com revisão de aprendizagem/economia, produto/UX e plataforma/dados.

**Estado:** migration expand-only criada e validada em Postgres 17 descartável; não aplicada em produção.

## Objetivo

Substituir “atividade declarada pelo cliente” por evidência identificável, idempotente e auditável. O usuário pode praticar infinitamente; a recompensa competitiva não pode ser infinita.

## Regra de XP qualificado

- O servidor calcula o XP; o cliente nunca envia a quantidade.
- `Errei`, `Difícil`, `Bom` e `Fácil` alteram o SRS, não o valor do XP.
- Repetição imediata, card não vencido, vídeo passivo e “marcar como lida” valem zero XP competitivo.
- Primeira evidência elegível por item/habilidade/janela pode gerar XP.
- Caps são defesa secundária; a chave semântica é a defesa principal.
- Streak, missões e ligas usam somente XP qualificado.

## Primeiro corte de dados

### `learning_events`

Ledger append-only de fatos aceitos:

- `id`/`event_id` para retry idempotente;
- `user_id`, `event_type`, `subject_type`, `subject_id`;
- `session_id`, `received_at`, `local_date` e origem;
- `semantic_key` calculada pela RPC;
- evidência mínima não sensível;
- elegibilidade e motivo;
- `UNIQUE(user_id, semantic_key)`.

### `xp_ledger`

Ledger contábil append-only:

- referência obrigatória ao evento;
- award, reversal ou opening balance;
- valor e motivo calculados no servidor;
- chave de deduplicação;
- período local/semanal e flag competitivo;
- reversão referenciando o lançamento original;
- unicidade de evento/reversão.

`user_stats` permanece temporariamente como projeção compatível com a UI. A soma do ledger precisa reconciliar com a projeção.

## Segurança

- RLS habilitado nos dois ledgers.
- Usuário autenticado lê somente as próprias linhas.
- `anon` não lê nem escreve.
- `authenticated` não faz INSERT/UPDATE/DELETE direto.
- Escrita somente por RPC específica com `auth.uid()`, propriedade e parâmetros validados.
- Helper de premiação fica em schema privado e sem `EXECUTE` público.
- `SECURITY DEFINER` só com `search_path` seguro e objetos qualificados.

## RPCs v2

Nenhuma RPC recebe `p_amount` ou estado FSRS calculado pelo browser:

- `complete_practice_item(...)`;
- `complete_story(...)`;
- `submit_story_quiz(...)`;
- `complete_video_block(...)`;
- `claim_daily_quest_v2(...)`;
- `claim_weekly_quest_v2(...)`;
- `record_card_review_v2(event_id, card_id, grade, expected_version)`.

Retorno uniforme: evento, aceite, elegibilidade, motivo, XP concedido, projeções atuais, idempotência e estado autoritativo quando aplicável.

## Revisão v2

1. Lock do card do usuário.
2. Validação de suspensão, vencimento e `expected_version`.
3. Cálculo FSRS no servidor.
4. Gravação de card, review, evento e XP na mesma transação.
5. XP fixo por revisão elegível, independente da nota.
6. Prática antecipada registra evidência, mas não gera XP competitivo.
7. Undo cria reversão contábil única; não apaga a história.

## Rollout seguro

1. Migration expand-only: tabelas, RLS, grants mínimos e validação de reversão.
2. Advisors, grants e testes reais de isolamento/constraints.
3. Cliente v2 com `event_id` persistido antes da rede.
4. Jogos/stories/quests/vídeo migram para RPCs específicas.
5. No cutover, sob a mesma transação: capturar opening balance e desativar/rotear todos os escritores legados.
6. RPC genérica legada passa a prêmio zero após adoção do cliente v2.
7. Review v2 e `cards.state_version` entram em corte próprio.
8. Só depois, remoção de caminhos e campos antigos.

## Testes obrigatórios

- mesmo UUID repetido: um evento e um prêmio;
- UUIDs diferentes para a mesma chave semântica: um prêmio;
- 20 requisições concorrentes: um lançamento;
- usuário B não lê nem premia evento do usuário A;
- escrita direta negada;
- valor/tipo/subject forjados rejeitados;
- cap concorrente nunca ultrapassado;
- meia-noite respeita timezone canônico;
- reversão duplicada não duplica débito;
- ledger reconcilia com `user_stats`;
- quiz/story/item repetido não paga novamente;
- missão usa meta do servidor;
- vídeo fora de ordem não paga;
- review futuro/custom vale zero competitivo;
- versão antiga do card retorna conflito sem mutação;
- retry após timeout retorna o resultado autoritativo original.

## Evidência de validação local

- CLI Supabase `2.109.1` gerou `20260714154841_learning_evidence_foundation_p0.sql`.
- O changelog de 2026 foi considerado: grants da Data API são explícitos e independentes de RLS.
- `npm run test:evidence`: contratos estáticos da migration.
- `tests/db/evidence-foundation.sql`: constraints, grants, RLS, propriedade cruzada, reversão e reconciliação em Postgres 17 real.
- Resultado do replay: `EVIDENCE FOUNDATION SQL OK`.
- Todas as 22 migrations versionadas, da baseline ao P0, foram reaplicadas em ordem num banco vazio antes do teste SQL.
- O workflow de release agora executa `test:evidence` e `tests/db/validate-migrations.sh`; o SQL P0 deixou de ser uma prova manual opcional.
- O Postgres efêmero foi encerrado após o teste.

O saldo inicial foi deliberadamente removido da migration expand-only: enquanto o XP legado continuar escrevendo, qualquer fotografia ficaria defasada. Ele será criado atomicamente somente no cutover.
