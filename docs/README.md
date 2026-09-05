# Documentação do LinguaFlow

Revisado em 05/09/2026: entrada direta e contratos sem captura de voz.

Esta pasta contém contratos ativos e registros históricos. O ponto de entrada
é [`ESTADO_ATUAL_2026-07-29.md`](ESTADO_ATUAL_2026-07-29.md).

## Ordem de leitura

1. [`ESTADO_ATUAL_2026-07-29.md`](ESTADO_ATUAL_2026-07-29.md)
2. [`../MASTER_BLUEPRINT.md`](../MASTER_BLUEPRINT.md)
3. [`../CHECKLIST.md`](../CHECKLIST.md)
4. [`../HANDOFF.md`](../HANDOFF.md)
5. [`ARQUITETURA_DADOS.md`](ARQUITETURA_DADOS.md)
6. [`BACKLOG_PRODUTO_2026-07-17.md`](BACKLOG_PRODUTO_2026-07-17.md)

## Contratos ativos

- [`CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md`](CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md)
  — memória, evidência, XP, prática e anti-farm.
- [`CONTRATO_FLUENCIA_A1_B2_2026-07-28.md`](CONTRATO_FLUENCIA_A1_B2_2026-07-28.md)
  — tarefas comunicativas, força da evidência e autoridade.
- [`SUPABASE_FONTE_DE_VERDADE_2026-07-18.md`](SUPABASE_FONTE_DE_VERDADE_2026-07-18.md)
  — dados, RLS e fronteiras server-side.
- [`product/ADAPTIVE_RECOVERY_CAPABILITY.md`](product/ADAPTIVE_RECOVERY_CAPABILITY.md)
  — adaptação por card sem contaminar o FSRS.

## Regra de autoridade

Quando documentos divergirem, use esta ordem:

1. schema/produção verificada e código de `main`;
2. testes executados no estado atual;
3. `ESTADO_ATUAL`, `MASTER_BLUEPRINT`, `CHECKLIST` e `HANDOFF`;
4. contratos ativos;
5. histórico Git.

Compilar ou passar em teste estático não prova interface, áudio, Chrome,
ou Supabase live. A documentação deve dizer explicitamente qual
superfície foi verificada.

## Histórico

Auditorias, briefings, ondas, etapas e planos datados foram consolidados e
removidos do diretório de trabalho. A política e a forma de recuperação estão
em [`HISTORY.md`](HISTORY.md).
