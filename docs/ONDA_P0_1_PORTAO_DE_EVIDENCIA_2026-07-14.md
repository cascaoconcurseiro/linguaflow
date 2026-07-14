# Onda P0.1 — Portão de Evidência

**Responsável:** Codex, com revisão sênior de aprendizagem/economia, produto/UX e plataforma/dados.

**Estado:** P0.1 implementado e validado localmente; não aplicado no Supabase remoto e sem caller público.

## Decisão

O sistema não receberá outra RPC genérica baseada em `tipo + quantidade`. A antiga `record_learning_event(text, integer)` é a origem comum do farming porque o navegador declara o fato e o volume.

Três estados passam a ser independentes:

1. evento aceito e persistido;
2. evidência elegível para aprendizagem qualificada;
3. recompensa efetivamente concedida.

## Escritores legados confirmados

- review: trigger de `review_log` chama `apply_learning_xp`;
- três finishers de jogo chamam `record_learning_event` com quantidade agregada;
- leitura, quiz e missão diária chamam a mesma RPC genérica;
- vídeo cruza blocos passivos e dispara a RPC sem aguardar o resultado;
- missão semanal aceita threshold do cliente e chama `apply_learning_xp`;
- undo restaura snapshot global e apaga o log;
- rollover semanal zera a projeção `xp_week`.

## Sequência obrigatória

### P0.1 — infraestrutura expand-only

- [x] criar `private.commit_qualified_learning_event`;
- serializar cada usuário com lock de `user_stats`;
- calcular dia e semana pelo timezone persistido;
- distinguir retry pelo mesmo `event_id` de conflito de payload;
- usar a chave semântica calculada por um validador específico, nunca recebida livre do cliente;
- inserir evento, ledger e projeção de `user_stats` numa transação;
- registrar evento inelegível/capped sem ledger e devolver o mesmo resultado em retry;
- helper privada sem `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ou `service_role`;
- manter RPCs, triggers e clientes atuais inalterados;
- [x] não criar opening balance.

Migration: `supabase/migrations/20260714162952_private_evidence_commit_p0_1.sql`.

O portão valida também o contrato contábil em retries (`dedupe_key`, razão, base XP, cap e competitividade), reserva `evidence._reward`, distingue colisão de entitlement e rejeita opening balance. Nenhuma função pública, trigger, card, review ou RPC legada é alterada.

### P0.2 — identidades verificáveis

- review: `operation_id` estável, elegibilidade derivada do card bloqueado e, depois, `state_version`;
- jogo: sessão e itens emitidos pelo servidor; tentativa por item, não placar agregado;
- quiz: versão, perguntas e gabarito persistidos;
- vídeo: sessão e `block_index` monotônico/idempotente; exposição passiva vale zero XP;
- quests: definição/meta persistida ou calculada integralmente no servidor;
- story read: conclusão identificada por história/versão; leitura isolada vale zero XP qualificado.

### P0.3 — cutover atômico

Na mesma transação:

1. bloquear escritores;
2. calcular `legacy_component = xp_total - soma_líquida(xp_ledger)`;
3. abortar se houver componente negativo ou divergência;
4. inserir opening balance não competitivo somente para o componente legado positivo;
5. substituir ou neutralizar todos os escritores antigos;
6. desligar o trigger legado da revisão para impedir dupla contabilidade;
7. trocar undo por reversão append-only;
8. validar que opening + awards + reversals = `xp_total` antes do commit.

## Contrato canônico de cliente

Toda view recebe um resultado normalizado por `utils/db.js`:

- `accepted`: nova evidência confirmada;
- `duplicate`: progresso já persistido; não animar XP outra vez;
- `ineligible`: atividade válida, mas sem recompensa, com motivo explícito;
- `offline`: servidor não contatado; só dizer “guardado” quando houver outbox durável;
- `retry`: resultado desconhecido; repetir o mesmo `operationId`.

Somente `xp.awardedNow > 0` pode disparar animação. Streak só é celebrada quando o servidor devolver `changed` ou `firstOfDay`; ler `streak > 0` não prova atividade no dia.

## Bugs de UX que entram no cutover

- extensão não pode avançar review quando `logReview` falha;
- retry de review não pode gerar outro ID;
- história não pode depender de flag em memória;
- semanal precisa separar `below_threshold` de `already_claimed` e remover fallback visual de 100 XP;
- vídeo não pode descartar o outcome nem afirmar streak por inferência;
- views não calculam XP, elegibilidade ou streak; apenas apresentam o contrato canônico.

## Testes de aceite

- mesmo event ID duas vezes: um evento, um ledger, um delta e retry canônico;
- mesmo event ID com payload diferente: conflito explícito;
- UUIDs diferentes e mesma chave semântica: no máximo um award;
- 20 chamadas concorrentes: cap e bônus nunca duplicam;
- falha em qualquer ponto reverte evento, ledger e projeção juntos;
- evento capped/inelegível não cria ledger e seu retry continua zero;
- delta de `xp_total` é exatamente o valor inserido no ledger;
- grants das helpers/RPCs são conferidos explicitamente;
- timezone e início da semana são calculados no servidor;
- RPCs e triggers antigos permanecem bit a bit inalterados no P0.1;
- replay integral das migrations e advisors passam antes do cutover.

## Fora do P0.1

- portar todo o FSRS para PL/pgSQL;
- conceder XP a leitura, vídeo passivo ou quiz cujo gabarito vem do navegador;
- promover preview para produção;
- aplicar opening balance enquanto existir qualquer escritor fora do ledger.

## Evidência executada por Codex

- replay das 23 migrations em Postgres 17 vazio;
- contratos da fundação: `EVIDENCE FOUNDATION SQL OK`;
- contratos transacionais P0.1: `EVIDENCE COMMIT P0.1 SQL OK`;
- rollback forçado entre evento e ledger deixou zero mutação parcial;
- timezone `Pacific/Kiritimati` confirmou `local_date` e semana ISO do servidor;
- 20 chamadas com a mesma chave: 1 evento, 1 ledger e 2 XP;
- 20 eventos diferentes disputando cap 20: 20 eventos, 10 ledgers e 20 XP;
- todas as 40 conexões retornaram `accepted` ou `duplicate`; falha individual reprova o harness;
- papéis `authenticated` e `service_role` sem `USAGE` no schema privado e sem `EXECUTE` na função;
- testes estáticos e release smoke executados sem depender de serviço pago.
- `supabase db lint` conectou ao banco descartável, mas não pôde habilitar `pgsql_check`, ausente no PostgreSQL 17 instalado no Windows; por isso lint de função não é alegado como aprovado. Replay, contratos SQL e revisão adversarial são a evidência disponível.

## Dívidas que bloqueiam o primeiro caller público

- `daily_counters` ainda pertence ao motor legado; a Home não pode misturar projeções;
- cap v2 lê somente o ledger e não pode coexistir com prêmio legado do mesmo modo;
- timezone ainda pode ser alterado pelo usuário; a política anti-troca de fuso precisa ser fechada antes do cutover;
- review, jogos, quiz, vídeo e quests ainda precisam das identidades server-side descritas no P0.2.
