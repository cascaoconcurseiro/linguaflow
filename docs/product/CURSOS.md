# Cursos (prática de escuta e digitação)

Área **Cursos** do site: o aluno ouve uma frase do inglês cotidiano e a escreve palavra por palavra. É independente do Cofre — a prática não lê nem grava `words`, `cards` ou `review_log`; só o botão "Enviar ao Cofre", acionado pelo aluno, cria um cartão.

## Estado

| Item | Situação |
| --- | --- |
| Catálogo | 30 cursos, 372 aulas e 4.088 unidades. Publicação de conteúdo conferida em 2026-10-06 (#523/#524/#525). Auditoria #528: 186 aulas reclassificadas; níveis por aula e faixas por curso substituem a classificação única. Consulte [CURRICULO_CEFR.md](CURRICULO_CEFR.md) e [auditoria integral](CURRICULO_AULAS.csv). Classificação aplicada no banco em 2026-10-07 pela migration `20261006230000`, com histórico integral e hash de conteúdo preservado. Aulas por nível: A1 28, A2 88, B1 142, B2 102, C1 12; 363 eram centrais na publicação #528. Interface no PR [#529](https://github.com/cascaoconcurseiro/linguaflow/pull/529); consultar a Issue/PR para evidências de integração e QA autenticado. O dono aprovou o áudio de Fala Conectada e do piloto de reduções em 2026-10-07 (#505/#503). A migration separada `20261007090000_course_audio_acceptance.sql` inclui suas nove aulas na trilha e leva o total central a 372, sem alterar as 28 aulas A1, os níveis, requisitos, conteúdo ou progresso. Implementação e evidência de publicação no PR [#530](https://github.com/cascaoconcurseiro/linguaflow/pull/530). Revisão humana de tradução/IPA continua pendente. QA Brave da interface #529: filtro A1 com quatro cursos e recomendação A1 correta; uma aba anterior ao deploy precisou ser recarregada para carregar o filtro por aula. |
| Player | Pronto: modos fácil/médio/difícil, pausa, revelar resposta, salvar vocabulário/nota, envio idempotente com reenvio. |
| Cadernos | Erros pendentes, revisões vencidas e vocabulário salvo, lidos do banco. Praticar um erro/revisão reabre a lição de origem. |
| Conteúdo novo | Entra por migration de seed (append-only). Não há ferramenta editorial ainda. |
| Cofre | Opcional e explícito: "＋ Enviar ao Cofre" (resposta da prática e caderno de vocabulário) leva a frase para a fila única de revisão (FSRS no servidor) pelo mesmo caminho das palavras de vídeo (`db.saveWord`). Não sobrescreve palavra existente, respeita o teto do Cofre e não envia parágrafos/histórias (#434). |
| Tudo gratuito | Não há capítulos restritos nem planos pagos. |

## Fluxo

1. `coursesView` lista o catálogo (`CoursesRepository.listCatalog`) e o resumo (`rpc_get_course_hub_summary`).
2. O aluno escolhe a lição e o modo em `coursePrepareModal`.
3. `coursePracticeView` carrega as frases (`getLesson`), toca o áudio pela voz neural (`playNaturalAudio`, função `tts`) e usa `coursePracticeSession` para tentativas, dica, combo e pontos.
4. Ao terminar, envia `rpc_commit_course_session` com um `client_session_id`. Sem rede, o resultado fica em `sessionStorage` e é reenviado na próxima abertura do Hub.
5. O tempo ativo (sem ociosidade > 30 s nem pausa) entra no tempo de estudo diário via `logSession`, em batimentos de 10 s.

## Dados

Migrations `20260927150000_course_system.sql`, `…150100_course_rpcs.sql`, `…150200_course_seed_street_english_a1.sql`.

- Conteúdo: `course_catalog` → `course_lessons` → `course_units` (texto, `translation_pt`, `ipa`, `explanation_note`, `syntax_groups`, `annotations`). Leitura pública quando publicado.
- Do aluno: `user_course_enrollment`, `course_practice_sessions`, `course_user_mistakes`, `course_user_reviews` — **só leitura** pelo cliente; escrita apenas pela RPC. `course_user_vocabulary` e `course_user_notes` — o próprio aluno grava (`user_id` = `auth.uid()` por padrão).
- A RPC valida que os resultados cobrem exatamente as frases da lição, calcula precisão/erros no servidor, limita tempo ativo à duração real e pontuação/combo a tetos, e não reaplica nada num retry.
- Revisão: acerto de primeira sem dica avança 1 → 3 → 7 → 15 dias → ×2,2 (máx. 180). Erro, dica ou resposta revelada traz a frase de volta em 1 dia, mas só leva **metade do caminho de volta** (`repetition_number = floor(degrau / 2)`; antes zerava). Um acerto limpo resolve o erro pendente da frase (#501).
- Revisão guiada (#531): Fácil continua contando e avançando, com teto de **30 dias**. Médio/Difícil mantêm teto de 180 dias. Só frase vencida avança; no máximo uma alteração de estágio por dia no fuso do aluno. Práticas antecipadas e acertos adicionais no mesmo dia não empurram a data. Erros encurtam a agenda, sem rebaixamentos repetidos no mesmo dia; erro seguido de acerto não apaga a revisão próxima. Autoridade no servidor, com serialização por conta para duas abas.
- Na sessão de **revisão**, frases com resposta errada reaparecem uma vez após duas outras etapas ou no fim, se faltarem itens. O reforço pode ser pulado, não soma pontos/combos, não duplica respostas na meta e preserva o erro original enviado ao servidor. A frase de exemplo das palavras mantém o contrato anterior. Voltar/avançar, saída parcial e retry continuam funcionando. Reforços não são persistidos separadamente; ao sair, salvam-se só as evidências originais.
- Meta diária (#501): o servidor devolve no resumo `reviews_due_total` (todas as vencidas; `reviews_due_count` continua igual), `reviews_daily_cap` (20), `reviews_done_today` (respostas de sessões `review` no dia do fuso do aluno), `reviews_due_today = max(0, min(total, 20 − feitas hoje))` e `reviews_overdue_7d`. O Início, o plano de hoje, o selo e a aba Revisão mostram a meta de hoje e o resto como "na fila". A meta **nunca bloqueia**: depois dela há "Revisar mais 10 (opcional)". A meta não reduz a dívida, só a torna administrável; para reduzir é preciso olhar a entrada (cada frase de lição entra na revisão).

## Testes

- `npm run test:courses`: sessão (`course-practice-session`), contrato do banco/UI (`courses-system-contract`), motor de entrada e som.
- `tests/sql/courses-rpc-rls.sql`: teste comportamental (RPC, idempotência, RLS entre duas contas, anônimo) — rodar **só** num banco local do `scripts/replay-migrations-local.ps1`.

## Perguntas que a telemetria deve responder

1. Quantas lições iniciadas terminam com o resultado salvo? (`commit_failed` no console vs. sessões gravadas)
2. As frases mais erradas de cada lição (`course_user_mistakes.mistake_count`) — para revisar conteúdo.
3. O áudio falha no player? (mensagem de falha de áudio exibida)
4. Quantas frases ficam vencidas há mais de 7 dias, e a fila encolhe ou cresce semana a semana? (consulta acima; `reviews_overdue_7d` no resumo)

## Como medir a dívida de revisão (somente leitura, sem dados pessoais)

Consulta agregada para o dono do produto (SQL Editor do Supabase ou `execute_sql`); não devolve IDs de usuário:

```sql
select count(distinct user_id)                                        as contas_com_revisao,
       count(*)                                                       as frases_em_revisao,
       count(*) filter (where due_date <= now())                      as vencidas,
       count(*) filter (where due_date < now() - interval '7 days')   as vencidas_ha_mais_de_7_dias,
       count(*) filter (where due_date < now() - interval '14 days')  as vencidas_ha_mais_de_14_dias,
       count(*) filter (where repetition_number = 0)                  as no_degrau_0
from public.course_user_reviews;
```

Linha de base de 2026-10-05 (1 conta, ~5 dias de uso): 287 frases, 204 vencidas, **0 vencidas há mais de 7 dias**, 64 no degrau 0, nenhuma acima do degrau 3. Repetir semanalmente: se `vencidas_ha_mais_de_7_dias` passar a crescer, a meta diária está escondendo a pilha em vez de reduzi-la.

## Próximos passos

- Mais lições e cursos (seed por migration, com revisão de tradução/IPA por humano).
- Treino só das frases com erro/revisão (hoje reabre a lição inteira).
- Interface gráfica de edição de conteúdo (hoje o fluxo editorial é por lotes e `npm run content:check`; ver `EDITORIAL_CURSOS.md`).


## Validação e acompanhamento da revisão guiada (#531)

O teto de 30 dias é hipótese de produto. Avaliar retenção após dias sem texto antes de mudar intervalos. Agregados de `course_session_results` + `course_practice_sessions` permitem contar práticas por modalidade e práticas repetidas por unidade/dia; `course_user_reviews` permite acompanhar intervalos no teto. O banco não registra a conclusão dos reforços locais, portanto essa métrica permanece pendente e não é inferida de um acerto original.

Reversão: `supabase/rollback/course_review_method_531.sql` restaura a RPC anterior, preservando histórico e agenda já calculada; reverter o frontend remove os reforços. Testes de comportamento em `tests/sql/course-review-method-531.sql`, sessão em `tests/course-review-method-531.test.mjs` e fluxo em Playwright.

## Trilha e evolução por nível (#537)

A trilha abre páginas próprias por nível (#537), em `#courses/level/A1` até C1. Cada página reúne módulos, estados e progresso das aulas, conclusão da base e próxima aula. Recarregar ou usar voltar/avançar no navegador preserva o nível da URL. Ao finalizar uma prática iniciada ali, o aluno retorna ao nível; continuar abre o preparo da próxima aula no nível recomendado, inclusive A2 após A1. O dashboard mostra o resumo da trilha, sem expandir as aulas. Meus cursos reúne evolução por nível e os cursos individuais.

`course_level_completions` registra uma conquista por usuário/nível, com IDs da base disponível e data da conclusão. A captura ocorre no servidor após atualizar aulas concluídas, dentro da transação da prática. O cliente tem apenas leitura própria por RLS. Progresso anterior que já cobre a base recebe data de reconhecimento e `completed_at` nulo; não há data histórica inventada. A RPC da trilha conserva níveis já concluídos quando surgem aulas novas, mostra quantas foram acrescentadas e recomenda o próximo nível pendente. Novas aulas e revisões anteriores continuam acessíveis. Dispensa por configuração não cria conquista. A conclusão do material continua distinta de domínio CEFR.

Perguntas operacionais: a evolução carregou junto da trilha? A conclusão foi capturada sem duplicação? Novas aulas preservaram o nível seguinte? Falhas de leitura usam os eventos existentes `path_failed/refresh_failed`, com recuperação na interface; PK e teste transacional verificam duplicação. Nenhum conteúdo digitado ou identificador de conta é acrescentado aos logs. Rollback em `supabase/rollback/course_level_history_537.sql` desativa captura e restaura a RPC #535, preservando os registros.
