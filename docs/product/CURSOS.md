# Cursos (prática de escuta e digitação)

Área **Cursos** do site: o aluno ouve uma frase do inglês cotidiano e a escreve palavra por palavra. É independente do Cofre — a prática não lê nem grava `words`, `cards` ou `review_log`; só o botão "Enviar ao Cofre", acionado pelo aluno, cria um cartão.

## Estado

| Item | Situação |
| --- | --- |
| Catálogo | 30 cursos, 372 aulas e 4.088 unidades. Publicação de conteúdo conferida em 2026-10-06 (#523/#524/#525). Auditoria #528: 186 aulas reclassificadas; níveis por aula e faixas por curso substituem a classificação única. Consulte [CURRICULO_CEFR.md](CURRICULO_CEFR.md) e [auditoria integral](CURRICULO_AULAS.csv). Implementação preparada; publicação da migration e QA desta classificação devem ser confirmados na Issue/PR, sem usar a conferência anterior como evidência. Fala Conectada e o piloto de reduções permanecem opcionais, aguardando aceite humano do áudio (#505/#503). |
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
