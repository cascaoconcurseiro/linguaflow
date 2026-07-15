# P0.2a — revisão autoritativa e validação de dados

**Implementado por:** Codex, frente sênior Supabase/Postgres, em 2026-07-15.
**Estado:** código/gates concluídos e migrations expand aplicadas ao Supabase remoto em 2026-07-15 pela coordenação Codex; P0.2b ainda retida.

## O que foi alterado

- `record_card_review` manteve a assinatura do cliente e passou a decidir no servidor: ownership, card vencido, suspensão, quota de 20 novos, compare-and-swap por `reps`, relógio e XP.
- As quatro notas concedem o mesmo valor quando elegíveis. O card/dia recebe XP no máximo uma vez; o cap competitivo é 300 XP, sem bloquear a atualização de memória do 31º card.
- Retry usa o fato original. Retry de evento inelegível permanece `ineligible`; retry aceito retorna `duplicate` e zero XP para animação.
- Snapshot anterior/posterior é capturado no servidor. O undo ignora o snapshot do navegador, não apaga o review e cria evento e reversal exato append-only.
- `user_stats.stats_revision` é incrementada por todo `UPDATE`; qualquer escritor posterior bloqueia restauração de uma projeção antiga.
- A quota de novos conta `learning_events` imutáveis. Undo não devolve vaga e não abre ciclo de farming.
- Foram adicionadas RPCs estreitas para criar, enterrar, suspender, restaurar e restaurar snapshot de backup. Os grants diretos antigos permanecem até o contract P0.2b.

## Gates executados

- Replay integral de todas as migrations em PostgreSQL 17.6 descartável: aprovado.
- SQL comportamental: quatro notas, card futuro, suspenso, 21º novo, 31º review, retry, undo, redo sem XP e bloqueio por revisão de stats: aprovado.
- Concorrência real com 20 conexões no mesmo card: `20 eventos | 1 review | 1 award | reps 1 | XP 10`.
- Contratos estáticos P0.1, economia/pedagogia P0.2 e review P0.2: aprovados.

## Riscos e sequência

1. A migration ainda precisa de preflight e aplicação controlada no Supabase remoto.
2. O cliente compatível já propaga `outcome`, `eligibility_reason` e `reward_reason`; os gates garantem que `ineligible` não entra no caminho de sucesso.
3. Depois de publicar e validar esse cliente, P0.2b deve revogar INSERT/UPDATE diretos; os chamadores já foram migrados para RPCs estreitas.
4. O FSRS completo continua no cliente por decisão do contrato P0.2; o servidor valida forma, versão por `reps` e elegibilidade, mas ainda não recalcula a fórmula integral.

## Pós-deploy expand

- P0, P0.1 e P0.2a aplicadas em ordem no projeto `qnutoswrufznztoznlql`.
- Advisor corrigido com `20260715160836_evidence_fk_index_hardening_p0_2.sql`: FKs compostas ganharam índices de cobertura e o índice duplicado de cards foi removido.
- O cliente `3.0.3` está no preview; a contração P0.2b depende apenas do QA autenticado.
