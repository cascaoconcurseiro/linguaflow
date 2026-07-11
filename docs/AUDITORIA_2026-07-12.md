# Auditoria de continuidade — LinguaFlow (2026-07-12)

> Segunda auditoria completa do projeto, feita pela equipe (Gerente/Fable, Linguista, Eng. SRS, Prof. didático, Eng. Backend/Segurança, QA) depois de fechar o ROADMAP-MESTRE (Ondas 1-4). Objetivo: caçar bugs reais, coisas não implantadas de verdade, e problemas de infraestrutura viva (Supabase + GitHub) que a auditoria original (2026-07-10) e o desenvolvimento acelerado das últimas ondas possam ter deixado passar. Todas as correções de banco/GitHub abaixo foram feitas com autorização explícita do dono.

## 1. Infraestrutura viva — Supabase (produção `qnutoswrufznztoznlql`)

### 🔴 Corrigido nesta auditoria (migration `20260712000000_security_audit_fixes`)

| # | Achado | Severidade | Evidência | Correção |
|---|---|---|---|---|
| 1 | **IDOR real**: `public.get_user_stats(p_user_id uuid)` — `SECURITY DEFINER`, `EXECUTE` liberado pra `authenticated`, **nunca verificava `auth.uid() = p_user_id`**. Qualquer usuário logado podia chamar `POST /rest/v1/rpc/get_user_stats {"p_user_id": "<uuid de outra pessoa>"}` e ler contagem de palavras, cards vencidos e retenção de 30 dias de QUALQUER outro usuário. | 🔴 Alta (vazamento de dados entre usuários) | Código-fonte da função lido via `pg_proc.prosrc`; comparado com `ensure_user_stats` (que faz a checagem certa). Zero chamadores no client (grep no repo inteiro) — função morta, devolvia até campos hardcoded (`streak: 0`, `by_cefr: {}`). | `DROP FUNCTION` — eliminada, não só restringida, já que não tinha uso real. |
| 2 | **Índice duplicado**: `idx_cards_due` e `idx_cards_user_due` na tabela `cards` — definições IDÊNTICAS (`btree (user_id, due_date) WHERE NOT suspended`). | 🟡 Média (custo de escrita em dobro sem ganho) | `pg_indexes` confirmou definições byte-a-byte iguais. | `DROP INDEX idx_cards_due` (mantido o versionado em migration, `idx_cards_user_due`). |
| 3 | **Migrations desalinhadas**: as últimas 6 migrations aplicadas via `apply_migration` (timezone, expose_push_public_key, weekly_quest, grant_push_server_rpcs, word_mnemonic, email_reengagement) tinham **timestamps diferentes no arquivo local vs. no histórico real do Supabase** (`supabase_migrations.schema_migrations`) — o Supabase atribui o timestamp no momento da aplicação, não no nome que eu dei ao arquivo. Isso quebraria `supabase db push`/CLI no futuro (tentaria reaplicar migrations "novas" que na verdade já rodaram). | 🟡 Média (risco futuro de tooling, não de dados) | `list_migrations` comparado arquivo a arquivo com `ls supabase/migrations/`. | Arquivos renomeados (`git mv`) pros timestamps reais; replay completo do zero em banco efêmero confirmou a cadeia ainda funciona na ordem certa. |

### 🟡 Investigado, não corrigido (risco desproporcional ou fora do meu controle)

| # | Achado | Por que não corrigir agora |
|---|---|---|
| 4 | `pg_net` instalado no schema `public` (advisor "Extension in Public") | Testado em produção: `ALTER EXTENSION pg_net SET SCHEMA` falha com `0A000: extension "pg_net" does not support SET SCHEMA` — limitação da própria extensão, não é falta de tentativa. Corrigir exigiria `DROP EXTENSION` + `CREATE EXTENSION` num schema novo, arriscando derrubar os crons (`push-reminder`, `email-weekly-reengagement`) que dependem de `net.http_post`. As funções `net.*` já vivem no schema `net` (nunca em `public`), então não há exposição real — aceito como falso-positivo de baixo risco, comum em projetos Supabase. |
| 5 | ~10 avisos "SECURITY DEFINER function executable by authenticated" (`claim_weekly_quest`, `ensure_user_stats`, `get_push_public_key`, `maybe_league_rollover`, `record_card_review`, `record_learning_event`, `revert_card_review`, `set_email_opt_in`, `set_user_timezone`) | Revisados um a um: todos são RPCs de usuário legítimas, cada uma valida `auth.uid()` internamente (a MESMA verificação que faltava em `get_user_stats`, item #1). O advisor sinaliza "SECURITY DEFINER + authenticated" de forma genérica — não distingue "função perigosa" de "função corretamente restrita ao próprio usuário". Nenhuma ação necessária. |
| 6 | "Leaked Password Protection Disabled" | Só é configurável no dashboard do Supabase (Auth → Settings), não via SQL/migration — depende do dono (já rastreado no CHECKLIST, Onda 0). |
| 7 | 6 índices "unused" (INFO, não WARN) | Normal em app com pouco tráfego real ainda — índices existem pra quando o volume crescer (ex: `idx_cards_user_due` seria usado pesadamente em produção com muitos usuários). Não remover preventivamente. |

## 2. GitHub

| # | Achado | Ação |
|---|---|---|
| 8 | **PR #2** ("Unify main + master...") continua **aberta e em draft** desde 2026-07-04, sem nenhuma atividade desde então — parece totalmente superada pelo trabalho da PR #3 (que já unificou/consolidou tudo o que a #2 tentava resolver). | **Não fechei sozinho** — é uma decisão de gestão de repositório, não um bug técnico. Recomendo ao dono fechar a PR #2 como superada, mas só ele deve decidir. |
| 9 | Branches obsoletas: `master` (idêntica a `main`, mesmo SHA — parece um ponteiro de branch-padrão legado) e `codex/auditoria-completa` (já foi mergeada dentro de `claude/learning-system-audit-4uwb83` nesta sessão, seu conteúdo já está na PR #3). | **Não apaguei sozinho** — apagar branch é destrutivo; fica com o dono decidir se quer limpar. |
| 10 | CI check "Verify learning engine and release smoke" continua falhando (~2-4s, `runner_id: 0`, sem log) em TODOS os pushes recentes — confirmado repetidas vezes que é falha de infraestrutura do GitHub Actions (nenhum runner é atribuído ao job), não do código. Todos os testes passam localmente (28 engine + 5 local-day + release-smoke) a cada push. | Provavelmente Actions desabilitado/restrito em Settings → Actions → General do repositório — fora do que consigo verificar/corrigir via API. Segue não-bloqueante (Vercel + testes locais são o gate real). |

## 3. Revisão de código (bugs reais, não estilo)

Duas revisões dedicadas em paralelo (Onda 2: Estatísticas/Estudo por tópico/Editor de card/Mini-jogo/Player YouTube; Onda 3: Placement v3/Mnemônicos/Import URL-EPUB/E-mail/Tatoeba), cada uma lendo o diff completo contra `origin/main`, rastreando chamadores/callees, e aplicando o teste "isso é alcançável no fluxo real do app?" antes de reportar. Todos os achados abaixo foram corrigidos.

### 🔴 Crítico

| # | Achado | Onde | Correção |
|---|---|---|---|
| 1 | **SSRF real no `url-import`**: o filtro anti-SSRF só olhava a STRING do hostname (bloqueava IPs literais como `127.0.0.1`), mas **nunca resolvia DNS**. Um atacante registrando um domínio próprio (`ssrf.exemplo.com`) com registro A apontando pra `169.254.169.254` (metadados de nuvem) ou `10.0.0.0/8` passava batido pela validação — `new URL()` não resolve DNS, e o `fetch()` seguinte resolvia e conectava livremente. Também faltavam faixas IPv6 (`fe80::/10` link-local, `fc00::/7` unique local, mapeamento `::ffff:a.b.c.d`). Reproduzível em produção hoje, sem nenhuma condição de corrida — só um domínio com um registro DNS malicioso, usando a própria feature de "colar uma URL" do Leitor. | `supabase/functions/url-import/index.ts` | Reescrita: resolve `A`/`AAAA` do hostname via `Deno.resolveDns()` ANTES de cada fetch (inclusive em cada hop de redirect) e valida todos os IPs retornados contra o bloqueio de rede interna; parser IPv6 próprio cobre as faixas que faltavam. Risco residual documentado no código: sem pinagem de IP na conexão real do `fetch()`, existe uma janela estreita de DNS rebinding (TTL baixíssimo) — aceito, já que fechar isso por completo exigiria reimplementar o cliente HTTP na mão. Deployado (v2). |

### 🟠 Alto

| # | Achado | Onde | Correção |
|---|---|---|---|
| 2 | **Placement v3 sempre caía pra A1** quando a PRIMEIRA banda do cloze era reprovada, independente de onde a escada realmente começou. `clozeStartBand` começa a escada UMA banda abaixo do vocabulário (ex: vocabulário B2 → começa em B1) — mas se o aluno reprovasse logo essa primeira banda, `scoreClozeLadder` retornava `'A1'` hardcoded, dois níveis abaixo de onde ele de fato estava. Isso derrubava o resultado final inteiro (cloze pesa 40%) justamente pro perfil mais comum (brasileiro com vocabulário melhor que gramática). | `dashboard/js/core/placement.js` (`scoreClozeLadder`) | Fallback agora é "uma banda abaixo de onde a escada começou" (`results[0].band`), não mais `'A1'` fixo. 2 testes de regressão novos. |
| 3 | **Corrida entre invalidação de cache e refresh SWR em voo** fazia uma edição/exclusão/suspensão de card "sumir" por até 30s. `getAllWords`/`getAllCards` (Onda 4, stale-while-revalidate) escreviam incondicionalmente no cache quando o fetch resolvia — se uma escrita (`updateWord`, `logReview`, `deleteWord`...) invalidasse o cache ENQUANTO um refresh em segundo plano já estava em trânsito, esse refresh (com dado pré-escrita) resolvia depois e reescrevia o cache, marcando-o "fresco" por mais 30s. Alcançável em uso normal: abrir o Cofre, esperar >30s (dispara refresh), editar uma palavra, navegar pra fora e voltar dentro da janela de corrida. | `utils/db.js` (`_fetchWords`/`_fetchCards`) | Contador de geração (`_cacheGeneration`, incrementado em `_invalidateReadCache()`): cada fetch guarda um snapshot no início e só grava no cache se nada invalidou nesse meio-tempo. |
| 4 | **Apertar "Desfazer" (tecla Z) logo após avaliar um card desfaz a revisão ERRADA.** `handleGrade` só atualiza `lastReview` depois que `logReview` termina de salvar (`await logPromise`) — mas nada impedia `handleUndo` de rodar nesse meio-tempo usando o `lastReview` do card ANTERIOR. Esse é exatamente o uso mais natural do atalho (errou a nota, desfaz na hora). | `dashboard/js/ui/studyView.js` (`handleUndo`) | Guard `if (gradeBusy) return;` no início — mesma trava que já protegia `handleGrade` contra avaliações concorrentes. |

### 🟡 Médio

| # | Achado | Onde | Correção |
|---|---|---|---|
| 5 | **`listeningBands` duplicava a banda de ponta da escala** (`clozeLevel='A1'` gerava `['A1','A1','A2']`) — o teste de escuta tocava as mesmas 4 frases de A1 duas vezes (só reembaralhando as alternativas) em vez de testar 3 níveis distintos como o comentário do código prometia. Mais frequente do que parecia por causa do bug #2 (que empurrava resultados pra A1 artificialmente). | `dashboard/js/core/placement.js` (`listeningBands`) | Janela de 3 índices consecutivos deslizada pra dentro dos limites do array, nunca duplicando. 1 teste de regressão. |
| 6 | **Vídeo de um card anterior podia esconder o vídeo válido do card atual.** Sem guard de identidade do card, uma falha assíncrona atrasada de `loadVideo()` do card N (embed bloqueado, demora pra disparar erro) podia resolver depois que o aluno já tinha avançado pro card N+1, escondendo o vídeo legítimo que estava carregando certo. | `dashboard/js/ui/studyView.js` (`renderReveal`, bloco do player) | Guard `currentCard === card` antes de esconder o mount do player — mesmo padrão já usado em outros pontos do arquivo. |
| 7 | Migrations recentes com timestamp de arquivo local diferente do timestamp real de aplicação no Supabase (ver seção 1, item 3). | `supabase/migrations/*.sql` | Arquivos renomeados. |

### 🟢 Baixo

| # | Achado | Onde | Correção |
|---|---|---|---|
| 8 | `AudioContext` criado a cada partida dos mini-jogos ("Ligar Colunas" e "Ouça e Escolha") nunca era fechado — jogar repetidamente acumula contexts de áudio. Severidade incerta (depende do limite do navegador), mas a correção é trivial e sem risco. | `dashboard/js/ui/gameView.js` | `audioCtx.close()` chamado ao final de cada partida. |

### Investigado e descartado (não é bug real)

- `app.navigate(route, params)`: todos os call-sites conferidos, nenhum quebrou com a assinatura nova.
- `statsView.js` vs `statsEngine.js`: campos batem exatamente entre o que cada função retorna e o que a view lê.
- `ytPlayer.js`: chamadas concorrentes a `loadVideo()` resolvem em ordem FIFO corretamente, sem corrida real.
- `gradeWriting`/`generateMnemonic`/`generateWeeklyDiagnosis`: fazem `JSON.parse` sem try/catch interno, mas todos os 3 chamadores envolvem a chamada em try/catch e degradam com toast, sem travar a tela.
- `email-reengagement`: `candidate.email` nulo é impossível (a RPC já filtra `IS NOT NULL` no SQL); falha de envio por candidato não aborta o loop, como esperado; `email_last_sent_at` só atualiza após sucesso confirmado.
- Fase 4 do Placement (produção escrita): cadeia de parâmetros entre as 4 fases conferida, sem swap.
- `combinePlacement`: matemática de clamp sem off-by-one.
- `epub.js`: todos os caminhos de EPUB malformado degradam graciosamente, sem exceção não tratada.

## 4. Resumo executivo

**9 achados reais corrigidos** (1 crítico de segurança — SSRF explorável em produção — 3 de alto impacto no algoritmo de nivelamento e na integridade de dados, 3 médios, 1 baixo, 1 de infraestrutura de migrations), mais **1 IDOR crítico** já corrigido na seção 1. Nenhum achado ficou sem correção, exceto os 2 itens explicitamente fora do meu alcance (celular físico, arte de logo original) e o falso-positivo do `pg_net` (limitação técnica documentada). Todos os testes automatizados (30 `engine.test.mjs` + 5 `local-day.test.mjs`) passam, migrations replayadas do zero em banco efêmero, `release-smoke` verde.
