# Plano de Fluência — documentação de execução para Fable 5

> # ⛔ SUSPENSO — NÃO EXECUTAR
>
> **Este plano foi escrito antes da auditoria de código real e contém ondas inválidas.** A auditoria posterior ([`AUDITORIA_REAL_2026-07-16.md`](AUDITORIA_REAL_2026-07-16.md)) provou que partes dele descrevem features que **já existem** ou que são **tecnicamente impossíveis** como especificadas.
>
> | Onda | Veredito da auditoria |
> |---|---|
> | **W3 — Reencontro na legenda** | ❌ **MORTA.** Já existe e é melhor do que o proposto: [`subtitle-engine.js:240`](../content/subtitle-engine.js:240) colore a legenda em **6 níveis pelo estado real do FSRS**. Não construir nada. |
> | **W1 — Primeira recuperação 15s** | ⚠️ **Reprojetar.** O save é fila local-first (`QUEUE_WORD_SAVE`); não existe `word_id` no momento do save. Desenho correto em §4b.4 da auditoria. |
> | **W4 — Shadowing** | ⚠️ **Escopo cai.** Só **5 de 20** palavras têm `video_start_ms`. E o replay do trecho já existe (`repeatSubtitle()`, tecla `S`). Falta **só a gravação da voz**. |
> | **W6.2 — "% conhecidas do episódio"** | ❌ **Sem substrato.** `known_words` = 0 linhas; `markAsKnown()` só existe no Leitor; `LF_WORD_KNOWN` é um listener sem emissor. Precisa da aquisição antes da tela. |
> | **W6.4 — Remover BYOK** | ✅ **Liberada.** O bloqueio (rate-limit) estava resolvido: a Edge Function tem 20/min por usuário e valida JWT. E o BYOK está em **um** lugar (`getApiConfig`), não três. |
> | Demais ondas | Não verificadas contra o código. Tratar como hipótese. |
>
> **Ler `AUDITORIA_REAL_2026-07-16.md` antes de qualquer linha de código.** A auditoria cobre ~8.000 das ~19.500 linhas; a tabela §0 diz exatamente o que foi verificado e o que ainda é chute.

**Data:** 2026-07-16 · **Planejador:** Claude · **Executor:** Fable 5
**Substitui:** `docs/BRIEF_FABLE5_2026-07-16.md` (v1 — não usar).
**Base:** ⚠️ leitura parcial + grep. Foi essa a origem dos erros acima.

**Como usar:** executar bloco a bloco, onda a onda, na ordem. Os arquivos e linhas estão citados — não explorar o repo além deles. Cada onda termina com teste de aceite verde, commit único e parada para reporte.

---

## 0. A tese (por que cada onda existe)

Vídeo + SRS entrega **compreensão**, não fluência — é o que a comunidade de sentence mining alcança em 1-2 anos, e eles travam na produção. Para virar fluência faltam três coisas que o app não tem:

1. **Boca.** Zero produção oral. `utils/pronunciation.js` existe e tem **zero chamadores** — é um braço amputado no repo.
2. **Teto.** Card minerado é dívida vitalícia. A fila cresce até a pessoa fechar o app pra sempre. É a causa nº 1 de desistência em SRS — nenhum concorrente resolveu.
3. **Verdade.** Nível é etiqueta declarada; história diz um nível e entrega outro; o app afirma coisas que nunca mediu.

Cadeia canônica: **assistir → capturar → recuperar em 15s → revisar → falar por cima → reencontrar → aposentar.**
Funcionalidade que não ocupa um elo sai da navegação principal.

**Congelado até 50 usuários reais:** P0.3, ligas, XP competitivo, novos jogos, karaokê.
**Não tocar:** `content/subtitle-engine.js`, `content/engine/*`, migrations aplicadas, RPCs P0.2b.
**Sem migration nova em nenhuma onda deste documento.** Tudo usa colunas, settings e RPCs existentes.

---

## 1. Veredito por opção (auditoria — o que fica, muda ou morre)

| Área | Estado real verificado | Veredito |
|---|---|---|
| FSRS-4.5, learning steps, graduating interval, leech, limites/dia, retenção, bury, suspend, undo, perfil por categoria, estudo por leech | Implementado. É paridade de motor com o Anki, de verdade. | **Fica.** Não mexer. |
| `FSRS_W` ([utils/db.js:873](utils/db.js:873)) | 17 pesos genéricos hardcoded. O Anki recalcula do histórico do próprio usuário. | **Gap real.** W8. |
| Export Anki ([settingsView.js:825](dashboard/js/ui/settingsView.js:825)) | Exporta frente/verso/tags. **Não exporta `stability`, `difficulty`, `due`, `reps`, `lapses`.** | **Mente.** W8. |
| Placement (vocab+cloze+listening+writing) | Estrutura correta, escada adaptativa, pseudo-palavras. | **Fica**, mas vira cold-start. W6. |
| `lf_cefr_level` | Usado só em 2 prompts. Não escolhe card, exercício nem conteúdo. | **Inútil hoje.** W6. |
| História: tamanho | "200 a 300 palavras" para **A1 e C2 igual** ([ai.js:205](dashboard/js/core/ai.js:205)). | **Quebrado.** W5. |
| História: nível | Instrução vaga no prompt. Zero verificação pós-geração. | **Quebrado.** W5. |
| Selo de nível da história ([storiesView.js:717](dashboard/js/ui/storiesView.js:717)) | Mostra o nível **pedido**, não o entregue. | **Mente.** W5. |
| História: reencontro de palavras do aluno ([ai.js:197](dashboard/js/core/ai.js:197)) | Implementado, com selo do que entrou de verdade. | **Fica.** É bom e é raro. |
| Quiz de história | 3-5 perguntas, esconde o texto, embaralha opções, deduplica. | **Já consertado.** Não tocar. |
| `story_read` → XP ([storiesView.js:469](dashboard/js/ui/storiesView.js:469)) | Marcar "lida" dá XP sem evidência de compreensão. Contradiz o contrato pedagógico. | **Morre.** W5. |
| Campo "cole sua chave `sk-...`" ([settingsView.js:444-453](dashboard/js/ui/settingsView.js:444)) | Legado do BYOK, recurso que não existe mais. Na web a seção nem funciona (lê `chrome.storage.local`). | **Morre.** W6.4. |
| BYOK no service worker ([service-worker.js:716-720](background/service-worker.js:716), [512](background/service-worker.js:512), [527](background/service-worker.js:527)) | Se o usuário tem chave própria, fala direto com `api.deepseek.com`, fora da Edge Function. | **Morre.** W6.4. |
| Edge Function `deepseek-chat` + `DEEPSEEK_API_KEY` (Supabase Secrets) | Chave do projeto. É o caminho oficial de toda IA do app. | 🔒 **NÃO TOCAR.** Ver trava em W6.4. |
| `utils/pronunciation.js` | SpeechRecognition + getUserMedia prontos. **Zero chamadores.** | **Ressuscita.** W4. |
| `video_start_ms`/`video_end_ms` | Já persistidos (migration `20260712212413`). | **Habilita W4.** |
| `utils/cefr-wordlist.json` (144KB) + `frequency-en.json` (143KB) | No disco, usados só no placement. | **Habilita W5 e W6.** |
| Ditado ([studyView.js:882](dashboard/js/ui/studyView.js:882)) | String exata. Typo → força `Errei` → lapso FSRS. | **Quebrado.** W2. |
| Seleção de exercício ([studyView.js:676](dashboard/js/ui/studyView.js:676)) | `Math.random()` enquanto o doc promete adaptação por habilidade. | **Quebrado.** W2. |
| TTS, Kokoro, lembretes push, e-mail, CSV, backup/restore JSON | Funcionam. | **Ficam.** Só descem de hierarquia. |
| Ligas / XP competitivo / cap 300 | Antifraude para 1 usuário. | **Congela** atrás de flag. W9. |
| Banner de ofensiva em risco ([homeView.js](dashboard/js/ui/homeView.js)) | Ensina a clicar "Bom" mentindo pra salvar o fogo — exatamente o que o contrato pedagógico combate. | **Morre.** W9. |

---

## BLOCO A — O ciclo de aprendizagem

### W1 — Primeira recuperação de 15s

**Por quê:** salvar cria card que ninguém estuda. É por esse buraco que vaza todo app de mineração. O plano do Codex previu a microetapa e ela nunca foi escrita.

**Onde:** `content/word-popup.js`. O momento é dentro do vídeo, não no site.

**Contrato:**
- Após salvar com sucesso, o popup **se transforma** (não abre outro): frase capturada com a palavra oculta + 3 chips de sentido.
- 1 chip correto (tradução salva); 2 distratores de outras palavras do usuário; fallback dicionário local.
- Sem cronômetro. `Pular` sempre visível, sem culpa, sem penalidade.
- Feedback de 1s → fecha. O vídeo nunca é bloqueado nem pausado por nós.
- Grava tentativa pela RPC de review existente. **Erro aqui não é lapso** — é a introdução do card.
- Falha de rede: fecha silencioso; o save permanece.

**Aceite** `tests/first-recall.test.mjs`: 3 chips com 1 correto; pular não grava tentativa; falha de rede não perde o save; popup não reabre após fechar.

---

### W2 — Ditado justo + rotação de habilidade

**Onde:** `dashboard/js/ui/studyView.js`.

**2.1 Ditado** (`renderDictation` ~L863, `exerciseFinish` L778) — hoje mede teclado, não audição:
- Levenshtein entre `normalizeAnswer(input)` e `normalizeAnswer(context)`.
- `0` → correto. `≤2` **ou** `≤10%` do comprimento → **`quase`**. Acima → errado.
- `quase`: marca só a palavra divergente, libera `Difícil` e `Bom`. **Nunca força `Errei`.**

**2.2 Seleção de exercício** (~L664-686) — trocar dado por **rotação determinística**, que garante cobertura das habilidades e é testável:
```
graduated && isWeakCard → produção (builder; senão dictation)
graduated               → [classic, builder, dictation, reverse][card.reps % 4]
                          (modalidade que não couber no wordCount → próxima do ciclo)
new/learning            → classic
```
**Trava por nível (nova):** se `lf_cefr_level` ∈ {A1, A2}, ditado só para frases ≤ 6 palavras. Pedir 12 palavras de ditado a um A1 é desenhar a desistência.

**2.3 Builder** (~L812): `sort(() => 0.5 - Math.random())` é embaralhamento enviesado e às vezes entrega a frase pronta. Fisher-Yates + rejeitar permutação idêntica.

**2.4** `docs/PLANO_MESTRE_PRODUTO_REAL_2026-07-14.md` §5: "vetor de habilidades" → **"rotação por encontro (P1: vetor real)"**. Doc não promete o que o código não faz.

**Aceite** `tests/study-exercise.test.mjs`: typo único nunca vira lapso; 4 encontros cobrem 4 modalidades; builder nunca nasce ordenado; A1 nunca recebe ditado longo.

---

### W3 — Reencontro na legenda (o diferencial)

**Por quê:** só o seu app tem a legenda e o vocabulário do aluno na mesma tela ao mesmo tempo. Anki não sabe o que você assiste. É a razão de existir do produto e está na Fase 5 do plano, atrás de ledger.

**Onde:** novo `content/known-word-marker.js`, chamado por `content/index.js`. **Zero alteração em `subtitle-engine.js`** — `MutationObserver` no overlay root existente.

**Contrato:**
- Palavra já salva recebe sublinhado âmbar de 1px na cue. Sem caixa, sem badge, sem animação.
- Clique → popup normal, com uma linha extra no topo: `Você salvou isto · <fonte original>`.
- Lista vem do cache já carregado no content script. **Nenhuma requisição por cue.**
- Match por lowercase + lemma simples (`-s`, `-ed`, `-ing`). Falso positivo é aceitável; requisição extra não é.
- Registra ocorrência via RPC de evento existente, dedupe `(palavra, vídeo, dia)`.

**Aceite** `tests/known-word-marker.test.mjs`: marca sem tocar no engine; troca de cue não vaza listener; 200 cues → zero requisições.

---

### W4 — Shadowing (a boca)

**Por quê:** é a única coisa que o vídeo dá e o Anki jamais dará: **prosódia humana real no instante exato**. O ator tem ritmo, entonação e emoção; TTS não tem. É a metade que falta pra sair de compreensão e chegar em fluência.

**Onde:** `dashboard/js/ui/studyView.js` (verso do card) + `utils/pronunciation.js` (ressuscitar) + `utils/video-utils.js`.

**Contrato:**
- Botão **Repetir por cima** no verso, só quando o card tem `video_start_ms`/`video_end_ms`.
- Ciclo: toca o trecho original (0,8s de pré-buffer, para exato no `end_ms`) → grava sua voz (`MediaRecorder`) → toca alternado: **ator → você → ator → você**.
- **Sem nota. Sem score. Sem IA avaliando pronúncia.** Nota automática de pronúncia em nível de consumidor é charlatanice; o ouvido comparando lado a lado ensina mais que um número inventado.
- Áudio gravado vive só em memória. Nunca sobe. Nunca persiste. Descarta ao trocar de card.
- Sem microfone/permissão negada: o botão não aparece. Nunca pede permissão sem clique explícito.
- Respeita `ExclusivePlayback` — nunca dois áudios juntos.
- Card sem clip de vídeo: botão usa o TTS como fonte, com rótulo honesto (`voz sintética`).

**Aceite** `tests/shadowing.test.mjs`: sem permissão → botão ausente; trocar de card mata gravação e stream; nenhum blob persistido; playback exclusivo respeitado.

---

## BLOCO B — Verdade do conteúdo e do nível

### W5 — Histórias calibradas de verdade

**Onde:** `dashboard/js/core/ai.js` (`generateStoryWeb` L192), `background/service-worker.js` (~L744), `dashboard/js/ui/storiesView.js`, novo `dashboard/js/core/readability.js`.

**5.1 Tamanho e estrutura por nível** — substituir o "200 a 300" único:

| Nível | Palavras | Frase máx | Estruturas permitidas |
|---|---|---|---|
| A1 | 90–130 | 8 | presente simples, `there is/are`, imperativo |
| A2 | 140–200 | 12 | + passado simples, `going to`, comparativo |
| B1 | 220–300 | 16 | + present perfect, 1º condicional, passado contínuo |
| B2 | 320–420 | 20 | + voz passiva, 2º/3º condicional, discurso indireto |
| C1 | 450–600 | 26 | + inversão, cleft, nominalização |
| C2 | 600–800 | livre | livre |

**5.2 Verificação pós-geração** (`readability.js`, função pura, sem rede):
- Tokeniza a história; consulta cada token em `utils/cefr-wordlist.json` e `utils/frequency-en.json`.
- Calcula `aboveBandPct` = % de tokens acima da banda alvo. **Ignora** nomes próprios e as palavras de reencontro do aluno (estão ali de propósito).
- `aboveBandPct > 12%` **ou** comprimento fora da faixa → **uma** regeração, com as palavras infratoras listadas no prompt.
- Se falhar de novo: publica com essas palavras glosadas inline e mostra o número real. Nunca uma terceira chamada.

**5.3 O selo para de mentir:** `story-level-badge` passa a exibir o nível **medido**, não o pedido. Se divergir do pedido, mostra os dois: `pedido B1 · medido B2`. Manter o selo de conhecidas (métrica LingQ) que já existe.

**5.4 `story_read` → XP morre.** Marcar "lida" não prova compreensão — o contrato pedagógico já diz isso e o código contradiz. XP de história vem só do quiz, que já funciona. Botão vira "Marcar como lida" sem prêmio.

**Aceite** `tests/story-readability.test.mjs` (só função pura, sem rede): texto A1 com palavra C1 acumula `aboveBandPct`; contagem por faixa; reencontro do aluno não conta como infrator; selo divergente renderiza os dois valores.

---

### W6 — Nível medido, não declarado (+ matar o BYOK)

**Por quê:** uma prova é o que se faz quando não há dados. Seu app observa a pessoa todo dia e ignora essa observação para preservar uma etiqueta de 4 minutos.

**Onde:** `dashboard/js/core/placement.js`, `dashboard/js/ui/settingsView.js`, novo `dashboard/js/core/levelEstimator.js`.

**6.1 Nivelamento contínuo** (`levelEstimator.js`, função pura):
- Entrada: `review_log` + `words` + `cefr-wordlist.json`.
- Cada palavra recebe banda CEFR pela wordlist. Retenção real por banda = acertos / tentativas.
- Nível medido = banda mais alta com ≥ 10 tentativas e ≥ 70% de retenção, exigindo continuidade (não pula buraco) — mesma régua do `scorePlacement`.
- Requer **≥ 50 tentativas qualificadas**. Abaixo disso, o nível do teste prevalece.
- Grava `lf_cefr_level` + novo `lf_cefr_source` = `test` | `measured` + `lf_cefr_updated_at` (settings, sem migration).
- Recalcula ao entrar em Hoje, no máximo 1x/dia.

**6.2 O nível passa a fazer alguma coisa** (hoje só tempera 2 prompts):
- tamanho/estrutura da história (W5);
- trava de modalidade de exercício (W2.2);
- **% de conhecidas do vídeo**: antes de assistir, com a legenda já carregada, exibir `você conhece 94% das palavras deste episódio`. A conta de conhecidas já existe para histórias ([storiesView.js:765](dashboard/js/ui/storiesView.js:765)) — reaproveitar em `content/`. É a resposta pra "essa série serve pra mim?", e é a pergunta nº 1 de quem aprende com série.

**6.3 O placement vira cold-start honesto:** continua como está (não reescrever — a estrutura está certa), mas o rótulo na UI muda para `Estimativa inicial · será recalibrada pelo seu estudo`. Não perseguir IRT/calibração de itens: sem base de usuários, é impossível e seria teatro.

**6.4 Remover o campo onde o usuário digita a chave dele (BYOK). A chave do projeto NÃO é tocada.**

> ### ⛔ LEIA ANTES DE TOCAR EM QUALQUER COISA COM "KEY" NO NOME
>
> Existem **duas** chaves diferentes neste projeto. Elas não têm nada a ver uma com a outra.
>
> | | Chave do projeto | Chave do usuário (BYOK) |
> |---|---|---|
> | Onde vive | `DEEPSEEK_API_KEY` em **Supabase Secrets** | `aiApiKey` em `chrome.storage.local`, no disco do usuário |
> | Quem usa | Edge Function `deepseek-chat` | ramo BYOK do service worker |
> | Status | **É o caminho oficial e único. Continua existindo.** | **Recurso descontinuado. Não existe mais no produto.** |
> | Nesta onda | 🔒 **NÃO TOCAR. NÃO LER. NÃO RENOMEAR. NÃO REMOVER.** | ❌ Remover da UI e do código |
>
> A Edge Function `supabase/functions/deepseek-chat` **permanece intacta e é o caminho de toda IA do app**. `dashboard/js/core/ai.js` continua chamando ela exatamente como hoje. Se ao fim desta onda a geração de história, o tutor, o mnemônico ou o `enrichCard` pararem de funcionar, a onda foi executada errado — reverter.

**O que remover (só o BYOK, só o lado cliente):**
- Seção `🤖 Inteligência Artificial (DeepSeek)` inteira em [settingsView.js:444-453](dashboard/js/ui/settingsView.js:444): título, texto explicativo, `input#ai-api-key-input`, `button#btn-toggle-key`, `button#btn-save-api-key`, `p#api-key-status`.
- Handler de `btn-save-api-key` (~L633) e o toggle de visibilidade (~L628).
- Leitura `chrome.storage.local.get(['aiApiKey'])` e a variável `savedApiKey` (L240-241).
- A entrada `'🤖 Inteligência Artificial (DeepSeek)'` no `group('Avançado', ...)` (L548).
- Ramo BYOK em [service-worker.js:716-720](background/service-worker.js:716): `chrome.storage.local.get(['aiApiKey'])`, `userKey` e o `fetch` direto para `api.deepseek.com`. Tudo passa a sair pela Edge Function, sem condicional.
- Verificar também [service-worker.js:512,527](background/service-worker.js:512) (`config.apiKey` / `Authorization: Bearer ${config.apiKey}`) — é o mesmo BYOK em outra rotina. Mesmo tratamento.

**Higiene, opcional e explícita:** `chrome.storage.local.remove('aiApiKey')` uma vez, no upgrade de versão. Isso apaga **a chave pessoal que o próprio usuário digitou, do disco dele**, agora que o recurso não existe mais — é um segredo em repouso sem finalidade. **Não tem relação com a chave do projeto.**

**Antes de fechar a onda (bloqueante):** confirmar que a Edge Function valida JWT de verdade (`auth.getUser(token)`) e tem rate-limit por usuário. Sem BYOK, todo mundo passa pela chave do projeto — sem limite, a fatura é do dono e vira conta aberta. Se não houver rate-limit, **a onda não fecha**.

**Fumaça manual obrigatória, com a extensão recarregada e logado:** gerar história, abrir o tutor no card, gerar mnemônico. Os três precisam responder. Só então commitar.

**Aceite** `tests/level-estimator.test.mjs` + `tests/no-byok.test.mjs`: <50 tentativas mantém nível do teste; retenção não pula buraco de banda; nenhuma ocorrência de `aiApiKey` no repo fora da limpeza; nenhum `fetch` para `api.deepseek.com` em código de cliente.

---

### W7 — Teto do cofre (a onda que ninguém tem coragem)

**Por quê:** todo app limita **novos/dia** — isso limita a velocidade da dívida, não o tamanho. A fila chega a 150/dia, a pessoa olha e fecha pra sempre. É a causa nº 1 de abandono em SRS e ninguém atacou.

**Onde:** `dashboard/js/ui/studyView.js`, `dashboard/js/ui/libraryView.js`, `content/word-popup.js`, `dashboard/js/ui/settingsView.js`.

**Contrato:**
- Setting nova `lf_vault_cap` (default **300**, faixa 100–2000, `0` = sem teto). Sem migration: é `settings`.
- Cofre cheio = cards ativos (não suspensos, não aposentados) ≥ cap. Salvar continua funcionando: a palavra entra como **não-ativada** e não gera revisão.
- Hoje mostra: `Cofre cheio (300/300) · 12 frases esperando vaga` com ação **Abrir vaga**.
- **Abrir vaga** = escolher um card `mature` com `stability` alta e **Aposentar**. Aposentar usa `suspend` (RPC estreita já existente) + tag `retired`. Não deletar nada, nunca.
- Enquadramento: aposentar é **conquista**, não perda. Copy: `Você domina esta. Ela sai da fila e continua no seu histórico.`
- Sugerir automaticamente os 5 candidatos de maior `stability` — a pessoa confirma, o app não decide sozinho.

**Aceite** `tests/vault-cap.test.mjs`: cap atingido não bloqueia save; card não-ativado nunca entra em `getCardsDue`; aposentar libera exatamente uma vaga; `lf_vault_cap=0` restaura comportamento atual.

---

## BLOCO C — Confiança e casca

### W8 — A porta destrancada (+ otimizador)

**Por quê:** ninguém investe 2 anos de memória num app indie que pode morrer. O superpoder do Anki não é o algoritmo — é ter 20 anos e a promessa de te sobreviver. Um app novo compra essa confiança de um jeito só: a saída. **A porta destrancada é o que faz a pessoa ficar.**

**Onde:** `dashboard/js/ui/settingsView.js` (~L805-840), novo `supabase/functions/fsrs-optimizer/`.

**8.1 Export que leva a memória junto** (~30 linhas, vale mais que qualquer feature nova):
- Além do TSV atual, um segundo arquivo `linguaflow_scheduling.csv` com `word`, `stability`, `difficulty`, `due`, `reps`, `lapses`, `status`, `introduced_at`.
- Copy honesta em Dados e Portabilidade: `Seus dados saem quando você quiser — com o agendamento junto, não só as palavras.`

**8.2 Otimizador FSRS** — a diferença entre usar FSRS e usar *sabor* FSRS:
- Edge Function mensal sobre `review_log` do usuário, estimando os 17 pesos e gravando em `settings` (`lf_fsrs_weights`).
- `Database.FSRS_W` ([utils/db.js:873](utils/db.js:873)) passa a ler a setting, caindo nos genéricos quando ausente.
- **Piso rígido:** menos de 400 revisões → não otimiza, usa os genéricos. Otimizar com pouco dado é pior que não otimizar.
- Rodar **depois** de W6 (as duas leem `review_log`; nada de duas varreduras diferentes).

**Aceite** `tests/export-scheduling.test.mjs` + `tests/fsrs-weights.test.mjs`: CSV contém as 8 colunas; pesos ausentes/malformados caem no default; <400 revisões nunca substitui pesos.

---

### W9 — Organização: 7 abas → 3

**Onde:** `dashboard/js/core/app.js`, `dashboard/dashboard.html`, `dashboard/js/ui/homeView.js`.

| Destino | Contém |
|---|---|
| **Hoje** | uma recomendação, um botão |
| **Biblioteca** | fontes (vídeos/histórias/textos), palavras, prática (jogos, histórias) |
| **Você** | progresso, estatísticas, conquistas, configurações |

- Rotas antigas vivem por redirect. **Nenhuma view deletada** — só sai da barra.
- Ligas: rota viva, fora da barra, flag `lf_leagues_enabled` (default off).

**Hoje — reescrita de `homeView.js`:**
- **Acima da dobra: uma frase de estado + um botão primário.** Nada mais.
- Os 4 stat cards (Revisar/Maduras/XP/Ofensiva) **saem** e vão para Você.
- Prioridade da recomendação: (1) revisões vencidas → (2) frases capturadas sem primeira recuperação → (3) cofre cheio, abrir vaga → (4) continuar fonte → (5) prática.
- **Banner de ofensiva em risco: deletado.** Num SRS a carga diária é ditada pelo passado; ameaçar perda num dia de 80 cards ensina a clicar "Bom" mentindo — o oposto do contrato pedagógico.
- Ofensiva vira **"dias com evidência"**: sem fogo, sem ameaça, sem banner. Um número em Você.
- `professorTip` e diagnóstico: uma linha abaixo do botão, sem `<details>` aninhado.

**Aceite** `tests/home-single-action.test.mjs`: exatamente 1 `.btn-primary` em Hoje; zero `stat-card`; barra com 3 itens.

---

### W10 — Sistema visual

**Por quê:** o app se veste de Duolingo (verde, emoji, peso 900) e o conteúdo dele é HBO. A pessoa está imersa num frame escuro e abre um app de papagaio. **Sua marca é a moldura do vídeo, não um mascote.**

**Onde:** `dashboard/css/globals.css` + as 3 telas da espinha (Hoje, Estudo, overlay). O resto herda e fica para depois.

```css
--bg:#0B0D10; --surface:#14171C; --surface-2:#1C2027; --border:#2A2F38;
--text:#E8EAED; --text-muted:#9AA0A6;
--brand:#FFB020;                    /* marca, ação, foco — só isso */
--correct:#3DD68C; --lapse:#FF5C5C; /* SÓ evidência. Nunca em navegação */
--radius:12px;
--s1:4px --s2:8px --s3:12px --s4:16px --s5:24px --s6:32px;
--fs-caption:13px --fs-body:15px --fs-lead:18px --fs-title:24px --fs-hero:32px;
```

**Regra que quase todo app erra: cor de marca ≠ cor de feedback.** No Duolingo o verde é marca *e* é "acertou" — por isso o acerto deles não emociona: é a cor do fundo. Verde e vermelho aqui só acendem por evidência.

- **Peso máximo 700.** Todo `font-weight:800/900` sai — é o que faz o app ler como brinquedo.
- Uma família. Frase do card = `--fs-hero`: é o maior elemento da tela.
- **Emoji não é ícone.** Proibido em Hoje, Estudo e overlay.
- Movimento 120ms ease-out. Celebração **só** com evidência real (acerto de recuperação). Nunca em navegação, nunca em save.
- Escuro é default; claro sobrevive via `prefers-color-scheme`.
- Despoluição: em `homeView.js` e `studyView.js`, `style="..."` inline vira classe. Só nesses dois.

**Aceite** `tests/design-tokens.test.mjs`: nenhum hex literal em `homeView.js`/`studyView.js`; nenhum `font-weight` > 700; `--correct`/`--lapse` ausentes fora de feedback.

---

### W11 — Overlay sob a mesma direção

**Onde:** `content/max-player-ui.js`, `content/review-overlay.js`.

- Dock lateral vertical **sai**. Os controles aparecem junto com os controles nativos do player e somem junto com eles. Se a pessoa escondeu a UI do player, ela quer o filme — não a nossa barra.
- `review-overlay`: adotar tokens da W10; o gradiente azul (`#0f172a → #1e293b`) sai.
- `bottom: 137px` fica como fallback medido. Não perseguir pixel na HBO.

**Aceite** `tests/max-player-ui.test.mjs` estendido: dock invisível quando os controles nativos estão ocultos.

---

## 2. Não fazer

- Migration, tabela ou coluna nova.
- Mexer em ligas, XP competitivo, cap, ledger, P0.3.
- Deletar view, rota ou funcionalidade — só tirar da navegação.
- Reescrever o placement (a estrutura está certa) ou o quiz de história (já consertado).
- Nota automática de pronúncia.
- Redesenhar Biblioteca/Stories/Reader/Config nesta rodada.
- Terceira chamada de IA para calibrar história.

## 3. Protocolo

Por onda: implementar → aceite verde → `npm run test:release` → commit único com prefixo (`W4: ...`) → atualizar `CHECKLIST.md` e `HANDOFF.md` → **parar e reportar**. Nunca duas ondas no mesmo commit.

CI remoto bloqueado por faturamento do GitHub — evidência é local até regularizar. Não fingir que o gate rodou.

## 4. O que nenhuma onda resolve

O banco de produção tem **1 usuário, 6 cards, 47 revisões** e o repo tem 170KB de documentação. O dono não usa o próprio app. Cinco pessoas reais assistindo série com a extensão ligada, sem ajuda, sob observação silenciosa — isso está na Fase 0 do plano mestre desde o começo e é o único item que nenhum executor pode entregar.
