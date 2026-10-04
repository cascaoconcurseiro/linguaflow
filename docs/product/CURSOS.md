# Cursos (prática de escuta e digitação)

Área **Cursos** do site: o aluno ouve uma frase do inglês cotidiano e a escreve palavra por palavra. É independente do Cofre — a prática não lê nem grava `words`, `cards` ou `review_log`; só o botão "Enviar ao Cofre", acionado pelo aluno, cria um cartão.

## Estado

| Item | Situação |
| --- | --- |
| Catálogo | 1 curso publicado ("Inglês das Ruas & Gírias Reais", A1), 1 lição, 10 frases. O catálogo mostra só cursos com frases no banco. |
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
- Revisão: acerto de primeira sem dica avança 1 → 3 → 7 → 15 dias → ×2,2 (máx. 180); erro ou dica volta para 1 dia. Um acerto limpo resolve o erro pendente da frase.

## Testes

- `npm run test:courses`: sessão (`course-practice-session`), contrato do banco/UI (`courses-system-contract`), motor de entrada e som.
- `tests/sql/courses-rpc-rls.sql`: teste comportamental (RPC, idempotência, RLS entre duas contas, anônimo) — rodar **só** num banco local do `scripts/replay-migrations-local.ps1`.

## Perguntas que a telemetria deve responder

1. Quantas lições iniciadas terminam com o resultado salvo? (`commit_failed` no console vs. sessões gravadas)
2. As frases mais erradas de cada lição (`course_user_mistakes.mistake_count`) — para revisar conteúdo.
3. O áudio falha no player? (mensagem de falha de áudio exibida)

## Próximos passos

- Mais lições e cursos (seed por migration, com revisão de tradução/IPA por humano).
- Treino só das frases com erro/revisão (hoje reabre a lição inteira).
- Interface gráfica de edição de conteúdo (hoje o fluxo editorial é por lotes e `npm run content:check`; ver `EDITORIAL_CURSOS.md`).
