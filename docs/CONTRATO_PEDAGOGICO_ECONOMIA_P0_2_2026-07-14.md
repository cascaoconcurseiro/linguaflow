# Contrato Pedagógico e Economia P0.2

**Responsável pela especificação:** Codex — frente sênior de ciência da aprendizagem, SRS e economia anti-farm.
**Estado:** contrato canônico do primeiro corte; implementação e cutover remoto dependem dos testes listados neste documento.
**Escopo:** elegibilidade server-side de card review, XP qualificado, prática livre, feedback e CTAs. Não redefine o FSRS completo, mastery, ligas por coorte ou novos jogos.

## Regra de produto

XP recompensa a conclusão honesta de uma tentativa vencida. A nota informa memória e altera o agendamento; ela nunca altera o valor da recompensa.

- `Errei`, `Difícil`, `Bom` e `Fácil` concedem o mesmo XP quando a tentativa é elegível.
- Falhar é evidência negativa válida. Dar menos XP por `Errei` ensinaria o aluno a mentir para o algoritmo.
- `mature` é estado do agendador, não prova de domínio.
- Vídeo reproduzido, história aberta, palavra salva e repetição imediata são atividade, não retenção comprovada.
- Prática pode ser ilimitada. Placar competitivo não pode ser ilimitado.

## Autoridade do servidor

A elegibilidade é derivada do card bloqueado no banco antes da mutação. O cliente não declara que um card estava vencido, não envia XP e não define a chave contábil.

O P0.2 não porta todas as fórmulas FSRS para SQL. Para compatibilidade, o próximo estado ainda pode ser calculado pelo cliente, com estes limites obrigatórios:

1. lock por usuário/card;
2. `expected_reps` igual ao valor armazenado;
3. `reps` cresce exatamente uma unidade;
4. `last_review` e primeira `introduced_at` vêm do relógio do servidor;
5. allowlist de campos e faixas numéricas finitas;
6. estado futuro, suspenso, limite de novos ou versão obsoleta não sofre mutação.

Portar o FSRS ao servidor permanece dívida P1. Essa dívida afeta integridade do agendamento, mas não pode continuar afetando XP depois do P0.2.

## Matriz de review

| Estado armazenado antes da chamada | Regra | Agenda | XP qualificado |
|---|---|---:|---:|
| `new` dentro da quota | primeira introdução do dia | sim | 10, uma vez por card/dia |
| `new` após a quota | `new_daily_limit` | não | 0 |
| `learning` vencido | `due_date <= server_now + 30s` | sim | 10 se ainda não premiado no dia |
| `learning` futuro | `not_due` | não | 0 |
| `review`/`mature` vencido | mesma tolerância de 30s | sim | 10 se ainda não premiado no dia |
| `review`/`mature` futuro | `not_due` | não | 0 |
| qualquer estado suspenso | `suspended` | não | 0 |

Chave de retry da tentativa:

```text
card_review_attempt:v2:{card_id}:{operation_id}
```

Chave de recompensa:

```text
card_review:v2:{card_id}:{local_date}
```

Um card em learning pode vencer várias vezes no mesmo dia e precisa continuar sendo agendado. Somente a primeira tentativa elegível daquele card/dia concede XP. No dia seguinte, uma nova tentativa vencida pode voltar a ser premiada.

## Quotas e caps

- Novos introduzidos: cap server-side fixo de 20/dia no P0.2.
- Revisão competitiva: 300 XP/dia, equivalente a 30 cards únicos premiados.
- O 21º novo não é introduzido; isso preserva a carga diária.
- Depois de 300 XP, reviews vencidos continuam válidos e atualizam memória, mas retornam `xp_awarded=0` e `reward_reason=competitive_daily_cap`.
- A interface deve explicar que o limite é do placar, não do estudo.
- Streak acompanha a primeira evidência qualificada do dia, não o valor do
  prêmio. Uma revisão elegível com `xp_awarded=0` por cap ou entitlement já
  consumido ainda pode sustentar o hábito; prática livre não pode.

Mensagem canônica do cap:

> Seu estudo continua contando para a memória; o limite competitivo de hoje foi atingido.

## Prática livre

Card futuro, replay, jogo repetido e exploração voluntária pertencem ao modo Prática. Prática:

- não altera o FSRS de um card futuro;
- não sustenta streak;
- não aumenta liga;
- pode registrar tentativa, dica, replay, latência e acerto;
- nunca é bloqueada por cap competitivo.

O produto não deve dizer “não vale a pena continuar”. Deve dizer “prática livre — sem alterar seu placar”.

## Retry e concorrência

- O `operation_id` nasce antes da rede e é reutilizado até haver resultado autoritativo.
- Retry idêntico de tentativa aceita não reaplica estado e retorna `duplicate`
  com `xp_awarded=0`.
- Retry de tentativa inelegível permanece `ineligible` com `idempotent=true`;
  idempotência não pode apagar `not_due`, `new_daily_limit`, `suspended` ou
  `stale_card_state` e transformá-los semanticamente em sucesso.
- UUID novo não vence a chave contábil de card/dia.
- Duas abas disputam o mesmo lock; somente a primeira vê o card vencido. A segunda recebe `not_due` ou `stale_card_state`.
- O resultado original deve guardar `review_log_id`, `status_after`, `due_after`, `step_index_after` e XP original para reconstruir timeout sem devolver snapshot novo como se fosse antigo.

## Undo

O snapshot anterior é capturado pelo servidor. `p_previous_card` vindo do navegador não é autoridade.

- apenas a revisão mais recente pode ser desfeita;
- atividade contábil posterior bloqueia o undo durante a coexistência com escritores legados;
- o card volta ao estado anterior;
- o evento permanece como trilha auditável;
- um ledger reversal nega exatamente o award;
- não se restaura um snapshot global de `user_stats`, pois isso apagaria atividade posterior;
- a recompensa de `card + dia` permanece consumida depois do undo; refazer no mesmo dia vale zero.

Enquanto houver XP legado fora do ledger, streak e `last_study_date` só podem voltar ao snapshot server-side quando não houve nenhuma atividade posterior. No cutover completo, essas projeções passam a ser recompostas pelo ledger líquido.

## Contrato de resposta para UX

A UI apresenta o resultado do servidor; não infere sucesso por `streak > 0`, qualidade ou card removido da fila.

| Campo/estado | Comportamento |
|---|---|
| `accepted` | avançar e mostrar o próximo card |
| `duplicate` de tentativa originalmente aceita | reconciliar sem repetir animação |
| `ineligible/not_due` | oferecer Prática, não chamar de erro |
| `new_daily_limit` | manter card novo fora da sessão atual |
| `stale_card_state` | recarregar estado autoritativo |
| `xp.awardedNow > 0` | única condição para animar XP |
| `competitive_daily_cap` | confirmar aprendizagem e explicar limite do placar |
| `offline/retry` | manter card na tela até persistir ou existir outbox durável |

As quatro notas mostram o intervalo de memória, nunca valores diferentes de XP.

## Home, sessões e missões

CTA primário:

> Continuar seu plano

Ele deve informar reviews vencidos e estimativa de duração. Não deve competir com liga, streak, histórias e jogos por atenção.

Depois da sessão:

- mostrar o que foi realmente concluído;
- permitir `Encerrar por hoje`;
- oferecer `Continuar em prática livre` sem XP competitivo;
- não usar urgência artificial ou autoplay de nova sessão.

Missões não podem ser “ganhar XP” nem “salvar palavras”. Primeiro corte aceitável:

- concluir a fila essencial de reviews;
- recuperar clips fracos;
- produzir frases sem dica.

Concluir missão não duplica o XP das mesmas evidências.

## Critérios pedagógicos de aceite

1. O usuário não ganha mais escolhendo `Fácil` do que `Errei`.
2. Um erro honesto não prejudica streak/XP em relação a uma nota inflada.
3. Learning steps continuam acontecendo, mas não são uma mina de XP.
4. Card futuro não tem estabilidade inflada por prática antecipada.
5. Limite competitivo nunca bloqueia estudo legítimo.
6. Home leva à próxima ação de aprendizagem, não à coleta de moeda.
7. Feedback distingue exposição, prática e recuperação vencida.
8. Métricas e textos não chamam `mature`, XP ou vídeo reproduzido de domínio.

## Testes adversariais obrigatórios

- quatro notas no mesmo estado elegível produzem a mesma recompensa;
- segundo learning step do card/dia produz zero XP adicional;
- novo 21 não muda de estado;
- card futuro e suspenso não mudam de estado;
- 31º card único vencido atualiza memória e dá zero XP competitivo;
- mesmo operation ID não duplica review, ledger ou animação;
- retry de evento inelegível continua inelegível e não avança a fila;
- operation IDs diferentes não duplicam recompensa do card/dia;
- chamadas concorrentes geram uma mutação elegível;
- estado obsoleto não sobrescreve card atual;
- undo produz uma reversão exata e não apaga XP posterior;
- undo repetido é idempotente;
- undo + refazer nunca supera o saldo original;
- undo + refazer pode restaurar o streak do dia sem recriar XP;
- UI não associa XP maior a nenhuma nota;
- UI mantém o card quando persistência falha;
- Home não contém missão circular de XP nem CTA que bloqueie prática pelo cap.

## Gate de promoção para produção

Este contrato é bloqueante, não apenas uma recomendação de UX. A promoção só
pode ocorrer quando `tests/pedagogy-economy-contract.test.mjs` estiver verde e
o teste fizer parte da suíte de release. O gate reprova explicitamente:

- `recordEvent('game_match')` em qualquer modo apresentado como Prática livre;
- `recordEvent('quests_complete')` ou prêmio adicional por completar missões
  cujos eventos já foram contabilizados;
- meta ou recompensa semanal definida por quantidade de XP;
- missão de apenas salvar/capturar conteúdo, sem recuperação ou produção;
- texto que prometa bônus de primeiro estudo sem evidência qualificada;
- XP diferente nas quatro notas ou animação em retry/duplicate;
- cutover de banco sem quota de 20 novos, cap competitivo de 300 XP, lock,
  idempotência por operação e por card/dia, e undo sem reabrir recompensa.

Uma prática pode registrar telemetria não competitiva. Isso não autoriza
alterar `xp_total`, `xp_week`, streak, liga ou o estado FSRS de card futuro.
Se a infraestrutura de telemetria não competitiva ainda não estiver pronta,
a prática deve funcionar sem prêmio; não pode reutilizar o escritor legado de
XP como aproximação temporária.

## Fora do P0.2

- FSRS integral no servidor;
- mastery multidimensional;
- gabarito server-side de histórias;
- XP por vídeo/checkpoint;
- ligas em coortes;
- recompensas semanais;
- novos jogos.

Esses itens só entram depois que o review v2 reconciliar evento, ledger, projeção e UX sem dupla escrita.
