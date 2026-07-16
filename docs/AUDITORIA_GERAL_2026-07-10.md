# Auditoria Arquitetural Geral — LinguaFlow
**Data:** 2026-07-10 · **Auditoria original:** leitura linha-a-linha do código real + inspeção do banco Supabase de produção (`qnutoswrufznztoznlql`) via MCP (tabelas, triggers, funções, advisors).

## Redirecionamento de produto — Codex (2026-07-14)

A continuidade da auditoria mostrou que concluir ondas de funcionalidades não resolve o problema atual. O produto possui módulos maduros, mas não uma espinha pedagógica nem uma economia baseada em evidência. A Etapa 4 puramente visual foi substituída pelo plano `docs/PLANO_MESTRE_PRODUTO_REAL_2026-07-14.md`.

Achados críticos novos:

- o teto de 40 XP/dia dos jogos existe, mas a RPC recebe tipo/quantidade agregados do cliente e não identifica tentativas ou itens;
- autoavaliação, vídeo passivo e conclusão de conteúdo podem influenciar XP sem evidência comparável;
- não existe modelo persistente de fonte/trecho/sentido/tentativa/domínio por habilidade;
- a Home e a navegação organizam funcionalidades, não o próximo passo pedagógico;
- o banco real ainda está em escala de validação (1 usuário, 6 cards, 47 revisões), portanto este é o momento adequado para corrigir o modelo.

Nenhuma alteração de banco ou produção foi realizada durante esta revisão.

## Livro de execução — Codex

> Esta seção é mantida por **Codex** a partir de 2026-07-10. Ela não substitui a auditoria original: registra, com evidência, o que foi validado, alterado e ainda falta concluir. Nenhum item é marcado como concluído apenas por declaração de outro agente.

### Linha de base validada (2026-07-10)

- **Branch de trabalho:** `codex/auditoria-completa`, criada a partir do PR #3 (`claude/learning-system-audit-4uwb83`, commit `e43fad1`).
- **Código:** `node tests/engine.test.mjs` executado por Codex: **14/14 testes passaram**.
- **Vercel:** preview do PR #3 está `READY`; produção permanece na `main` (`d7ae137`) até revisão e merge explícitos.
- **Supabase produção:** migrations `security_hardening_e0`, `translation_cache_e2`, `learning_engine_e4`, `league_rollover_e5` e `harden_ensure_user_stats` existem e as tabelas `translation_cache`, `league_meta`, coluna `cards.introduced_at` e `user_stats.daily_counters` foram confirmadas.
- **Divergências confirmadas:** as migrations aplicadas não existem no Git; `settings` possui 104 linhas (não aproximadamente 40); ainda há avisos para quatro funções `SECURITY DEFINER` executáveis por `authenticated` e para a proteção de senhas vazadas desativada.

### Execuções registradas por Codex

- **2026-07-15 — produção promovida e observada (Codex, coordenação de release):** `main` avançou por fast-forward de `4db1e58` para `53a69d8`; a Vercel publicou `dpl_5GuwRZEJGhEPVpRyVXUyPSsN3Sry` como `production`, `READY`, no SHA exato. `https://linguaflow-web-tau.vercel.app/` serviu `app.js?v=3.0.3`, sem overflow em 390 px e sem warning/error próprio; Vercel registrou zero erro runtime. Os logs Supabase posteriores mostraram leituras autenticadas de cards/configurações com HTTP 200 e atualização de sessão com 204. A contração P0.2b ficou intencionalmente para o próximo corte: ela só será segura após confirmar que a extensão Chrome instalada/recarregada usa as novas RPCs em salvar palavra, review, bury, suspender e restaurar; aplicá-la agora poderia quebrar silenciosamente um cliente antigo mesmo com o PWA correto em produção.

- **2026-07-15 — rollout remoto expand e preview 3.0.3 (Codex, coordenação de release):** o commit `96139b4` gerou o deployment Vercel `dpl_ABJQVUdSXFJhgQMcS5QV6dwUkKYn`, estado `READY`, SHA exato e sem erro de build/runtime. O cliente carregado confirmou `app.js?v=3.0.3`, console próprio limpo e ausência de overflow horizontal em 320/375/390 px. No Supabase `qnutoswrufznztoznlql`, P0, P0.1 e P0.2a foram aplicadas com sucesso em ordem; o advisor encontrou três FKs sem índice e um índice duplicado, corrigidos pela migration `evidence_fk_index_hardening_p0_2`, após a qual restaram somente avisos informativos de índices novos/ainda não usados. As RPCs públicas intencionais continuam reportadas como `SECURITY DEFINER` pelo advisor porque são justamente as portas estreitas autenticadas, todas com `search_path=''`, ownership e grants explícitos. A P0.2b continua retida: o navegador isolado não possui sessão LinguaFlow para QA autenticado, portanto os grants amplos ainda não foram contraídos.

- **2026-07-15 — P0.2a/P0.2b e Etapas 4–5 implementados localmente (Codex + frentes sêniores de dados, aprendizagem, UX e design):** `record_card_review` passou a decidir elegibilidade, quota, cap, snapshots e idempotência sob locks; undo tornou-se append-only e protegido por revisão monotônica; criação/bury/suspensão/restauração saíram de `PATCH cards` e foram para RPCs estreitas. A migration contract P0.2b foi criada separadamente e, em PostgreSQL local, deixou `cards`/`review_log` com apenas `SELECT` para `authenticated` e policies SELECT do proprietário. Em produto, Home, Cofre, Histórias, Configurações e navegação mobile foram reorganizados por tarefa sem remover funções; o design system ganhou tokens, foco visível, touch targets de 44 px, movimento reduzido, forced-colors e estados loading/empty/error. O cache PWA foi elevado para `3.0.3`. Código e migrations passaram os gates locais; P0.2b permanece **deliberadamente não aplicado remotamente** até o cliente integrado ser validado no preview autenticado.

- **2026-07-15 — contrato pedagógico/Anki e economia anti-farm P0.2 (Codex, frente sênior de ciência da aprendizagem):** formalizado o contrato canônico em `docs/CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md`: as quatro notas honestas valem o mesmo XP; 20 novos/dia; teto competitivo de 300 XP sem bloquear memória; prática livre separada de XP/streak/liga/FSRS; retry e undo sem farming. A revisão adversarial bloqueou e corrigiu seis atalhos reais: jogos repetíveis ainda davam XP apesar do rótulo Prática livre; missão diária duplicava recompensa; missão semanal tinha meta/prêmio circular de XP; captura era premiada sem recuperação; Home prometia bônus desconectado de evidência; `ineligible` era normalizado como `accepted` e avançava a fila. No banco, a revisão também impediu card novo enterrado/futuro via RPC direta, quota de novos reaberta por undo, suspensão injetada no payload, retry inelegível transformado em sucesso e perda de streak em undo→redo com XP zero. `tests/pedagogy-economy-contract.test.mjs` passou **19/19**, `tests/review-economy-p0-2.test.mjs` passou **23/23**, ambos entraram no `test:release`; `review-outcome-ux` e `card-write-contract` também passaram. O replay integral em PostgreSQL 17.6 e os testes SQL dinâmicos confirmaram: quatro notas = 10 XP; 21º novo inelegível; 31º review agenda com XP 0; retry; card futuro/suspenso; undo→redo com saldo 0; e 20 conexões no mesmo card produzindo 20 eventos auditáveis, mas apenas 1 review, 1 award, `reps=1` e XP 10. Regressão completa: release smoke, motor 37/37, áudio 8/8, Etapa 2 59/59 e Etapa 3 39/39. A promoção remota continua condicionada ao preflight/aplicação controlada no Supabase, QA autenticado do preview e gates operacionais registrados neste documento.

- **2026-07-14 — Plano UX/Races, Etapa 3 implementada (Codex + frentes sêniores):** o Estudo agora ativa um shell de foco com saída, progresso real e menu secundário; topbar e navegação deixam de competir com o card e são restauradas com segurança fora da rota. A frente ficou restrita a áudio, prompt/exercício e Revelar; o verso coloca resposta/fonética/tradução e notas antes de Explorar. Tutor, vídeo, palavra/mnemônico, YouGlish, Tatoeba, chunks, Undo, Bury e melhoria de frase continuam presentes, recolhidos sob demanda. Mobile usa quatro notas em uma linha e elimina a compensação de 186 px. Exercícios não avançam por timer: erro confirma Errei, acerto oferece Difícil/Bom/Fácil. Waveform acompanha playback real, foco/ARIA e movimento reduzido foram tratados. Evidência específica: shell 25/25 e Estudo 14/14, mais regressões completas. Produção permanece bloqueada até QA visual autenticado.

- **2026-07-14 — Plano UX/Races, Etapa 2 implementada (Codex + frentes sêniores):** o player de trecho passou a ter máquina de estados única e loop por `seekTo`, sem reload/flash preto; os campos reais `video_start_ms`/`video_end_ms` agora chegam ao Estudo e callbacks antigos não alteram outra apresentação do card. A extensão ganhou epoch/AbortController por navegação, guards de cue/tradução e `destroy()` completo. O Web Reader foi excluído do próprio produto, deduplica seleção, descarta tradução obsoleta e salva em fila local-first. Evidência: 69 verificações específicas da etapa (12 player + 10 contexto + 4 Estudo + 14 fronteira + 6 Web Reader + 13 legendas), além de áudio 8/8, motor 37/37 e dia local 5/5. Produção continua bloqueada até QA autenticado do preview e teste real da extensão. Handoff detalhado em `HANDOFF.md`.

- **2026-07-14 — Plano UX/Races, Etapa 1 implementada (Codex + frentes sêniores):** entregue áudio exclusivo por generation token no site e extensão, cancelamento de HTMLAudio/Web Speech, fallback idempotente e 8 testes determinísticos. O Estudo não dispara mais autoplay após enriquecimento, mantém o prompt imutável, encerra recursos ao sair, bloqueia sessões/renders obsoletos e só remove/contabiliza card depois de persistência confirmada; nota/bury possuem mutex e falha mantém a fila. `app.js` ganhou epochs/AbortController e guardas de commit/efeitos. Evidência e roteiro manual em `HANDOFF.md`; quadro vivo e próximas etapas em `CHECKLIST.md`. Regressão: motor 37/37, vídeo 4/4, dia local 5/5. Estado: branch/preview, aguardando QA visual antes de produção.

- **2026-07-14 — auditoria sênior de UX, fluxo e race conditions (Codex + frentes de UX/IA, aprendizagem e frontend/áudio):** revisão geral registrada em [`docs/AUDITORIA_UX_FLUXO_2026-07-14.md`](./AUDITORIA_UX_FLUXO_2026-07-14.md). Foram confirmadas chamadas duplicadas de autoplay, concorrência no TTS, lifecycle incompleto da tela de Estudo, races em nota/bury, dois donos do loop do YouTube e pipelines obsoletos de legenda. A direção de produto preserva todas as funções, mas transforma Estudo em modo foco e move tutor, vídeo, exemplos, mnemônicos, YouGlish, Tatoeba e chunks para progressive disclosure. O plano também reorganiza Home, Cofre, Histórias, Configurações e navegação por tarefa/momento, em ordem P0–P2 e com critérios de aceite verificáveis.

- **2026-07-12 — P0 / cards repetidos e 403 em `review_log` (Codex):** o erro não era ausência legítima de permissão. A escrita direta em `review_log` está corretamente revogada para `authenticated`; a revisão deve passar por `record_card_review`, cuja permissão `EXECUTE` foi confirmada em produção. O navegador estava combinando o HTML novo com um `db.js` muito antigo preservado pelo service worker PWA (`stale-while-revalidate` para JavaScript), e essa versão antiga ainda tentava `INSERT` direto. O cache foi versionado para `v3.0.2`; scripts e estilos passaram a **network-first com fallback offline**; o registro do worker ignora cache HTTP e força verificação; troca de controller recarrega a página; e uma sentinela `rpc-atomic-v1` impede inicializar o estudo se app e camada de dados forem de gerações incompatíveis. Não foi concedido `INSERT` direto, preservando RLS, atomicidade, XP e undo.

- **2026-07-12 — P0 / save local-first e auditoria de performance (Codex):** confirmados dois bloqueios no caminho crítico. O popup aguardava sessão, consulta de duplicidade, tradução e classificação por IA (timeout de até 4 s) antes do `saveWord`; agora persiste a intenção em `chrome.storage.local`, atualiza o vocabulário do player imediatamente e sincroniza pelo service worker em segundo plano, com retry por alarme de 1 minuto. Categoria estática acompanha a primeira gravação; IA, tradução faltante, criação de chunks, badge e broadcast rodam depois. Fechar o popup ou perder a rede não descarta a fila. O popup também escolhe sua tela pela sessão local no primeiro frame e valida/renova em background. No painel, a auditoria encontrou apenas **6 palavras ocupando 8,5 MB**, sendo **5,4 MB de snapshots base64 nunca renderizados**; todas as leituras de palavras/cards embutidos deixaram de usar `select=*` e excluem `snapshot`. A Home também parou de consultar `user_stats` duas vezes e Configurações passou de 16 consultas individuais para uma consulta em lote. No banco, `settings` ainda continha 238 chaves `trans_*` apesar da tabela dedicada; a migration `20260712220319_finish_translation_cache_cleanup` foi aplicada e verificada, copiando/atualizando os valores antes da remoção: `settings` caiu para 44 linhas, zero `trans_*`, e `translation_cache` ficou com 6.940 linhas. Vercel não registrou erros de runtime nos últimos 7 dias; o gargalo observado é cliente/Data API, não função serverless.

- **2026-07-12 — configuração/performance restante após a correção (Codex):** os advisors do Supabase não apontaram índice ausente nem consulta crítica; somente índices ainda não usados, preservados porque a base é pequena e removê-los agora prejudicaria o crescimento. As configurações funcionais ausentes em `settings` possuem defaults explícitos no cliente/motor; quatro chaves `lf_srs_*` antigas permanecem como legado inerte e não participam do agendamento atual. Alertas administrativos ainda abertos: proteção contra senhas vazadas desativada, extensão `pg_net` no schema público e RPCs `SECURITY DEFINER` intencionalmente expostas ao papel autenticado — revisar permissões e `search_path` numa rodada de segurança dedicada, sem alterar produção às cegas. A Vercel está sem erros de runtime, porém o front estático não possui Speed Insights/RUM instalado; portanto ainda não há medição de LCP/INP real por aparelho. Isso é o próximo item de observabilidade, não a causa do bloqueio inicial corrigido acima.

- **2026-07-12 — P0 / tela preta e vídeo passando da frase (Codex):** o player de contexto foi fechado como player de **trecho**, não como navegação livre do YouTube. Os controles nativos foram desativados e a interface passou a oferecer “Ouvir em loop”, “Pausar/Continuar” e “Do início”. Ao chegar ao `video_end_ms`, o controlador usa novamente `loadVideoById({ startSeconds, endSeconds })` para preservar o limite final em cada repetição; `seekTo()` não é usado para o loop porque a própria IFrame API informa que ele invalida `endSeconds`. O polling de 100 ms permanece como proteção adicional e pedidos de cards anteriores continuam invalidados. Cards novos usam bounds exatos capturados da cue; cards antigos, que só possuem o timestamp do clique, recebem uma janela curta reconstruída para trás conforme o tamanho da frase e são identificados na UI como “trecho aproximado”, sem alegar precisão inexistente. O carregamento agora tem estado textual e fallback explícito para abrir no YouTube em vez de permanecer numa tela preta silenciosa.

- **2026-07-12 — P0 / nova aba do Chrome devolvida ao usuário (Codex):** removido `chrome_url_overrides.newtab` do `manifest.json`. A extensão não substitui mais toda nova aba por `dashboard/newtab.html`. Permanecem apenas aberturas explícitas e esperadas: criar conta/abrir painel no popup, abrir o painel nas configurações e clicar voluntariamente numa notificação. O arquivo `dashboard/newtab.html` pode permanecer como legado sem rota ativa até a faxina final; ele não é mais carregado pelo Chrome.
- **2026-07-14 — Nova aba removida definitivamente (Codex):** apagados `dashboard/newtab.html` e `dashboard/newtab.js`. O smoke de release agora exige simultaneamente ausência de `chrome_url_overrides.newtab` e ausência dos arquivos legados.
- **2026-07-14 — Fundação de Evidência P0 expand-only (Codex):** migration `20260714154841_learning_evidence_foundation_p0.sql` criada pela CLI oficial, revisada adversarialmente e validada em Postgres 17 efêmero. Cria `learning_events`/`xp_ledger`, RLS, grants mínimos, FKs compostas de propriedade e reversão exata; não muda RPCs, `user_stats` ou produção. Opening balance foi reservado ao cutover atômico para não fotografar um saldo ainda mutável.
- **2026-07-14 — publicação e verificação remota do P0 (Codex):** commit `7662ea5` enviado ao branch `codex/review-mobile-video`. A Vercel publicou o preview `dpl_m5a2xRe1mfZVUd2WFynYnMugpKPv` como `READY`; a raiz respondeu `200` e não houve erro de runtime na janela de uma hora consultada. O GitHub Actions run `29348470440` não iniciou nenhum passo: a anotação oficial informa conta bloqueada por problema de faturamento. É bloqueio de infraestrutura, recorrente nos commits anteriores, não resultado dos testes. Produção e banco remoto permanecem intactos.
- **2026-07-14 — desenho da Onda P0.1 (Codex + frentes sêniores):** mapeados review, jogos, histórias, vídeo, missões, undo e rollover como escritores/projeções que precisam entrar no cutover. A sequência aprovada separa infraestrutura transacional expand-only, identidades server-side e cutover atômico. Não será criada outra RPC genérica premiável. Contrato, bugs de UX e testes concorrentes estão em `docs/ONDA_P0_1_PORTAO_DE_EVIDENCIA_2026-07-14.md`.
- **2026-07-14 — Onda P0.1 implementada (Codex + revisão adversarial de dados):** criada a helper privada `private.commit_qualified_learning_event`, sem `EXECUTE`/`USAGE` para papéis da API e sem caller público. Evento, ledger e projeção compartilham transação e lock por usuário; retry valida também o contrato contábil, caps e entitlements. A revisão encontrou quatro defeitos antes do commit (socket/banco incorretos no harness, falhas concorrentes não verificadas, namespace `_reward` e comparação incompleta de retries/dedupe), todos corrigidos. Replay das 23 migrations, rollback forçado, timezone UTC+14 e 40 conexões concorrentes passaram. Nenhuma alteração no Supabase remoto, clientes ou economia ativa.
- **2026-07-14 — P0.2/cliente, confiança da revisão (Codex + frentes sêniores de produto/UX, aprendizagem e plataforma):** corrigido o pior falso sucesso restante: a revisão rápida da extensão capturava a falha de `logReview`, avançava o índice mesmo assim e podia dizer “Revisões concluídas” sem persistir. Agora site e overlay criam um `operation_id` estável antes do primeiro envio, reutilizam exatamente a mesma nota/estado/id em timeout, offline ou sessão expirada, bloqueiam clique+tecla concorrentes e só avançam depois de confirmação `accepted` ou `duplicate`. `db.logReview` expõe `outcome`, `persisted` e `idempotent`; duplicate retorna XP visual zero. Falha mantém o card e diferencia offline, autenticação, retry e erro definitivo; falha de carga não vira fila vazia. Regiões `aria-live`, `aria-busy`, botões e toasts receberam semântica acessível sem alterar o layout. Contratos em `tests/review-outcome-ux.test.mjs` entraram no gate de release; suítes de motor, calendário, áudio, vídeo, foco e evidência passaram. Commit `25f65e4` publicado no branch de preview: Vercel `dpl_FnwVZLxMrVYoTrk5MKpYCrVjNoo6` confirmou o SHA exato, estado `READY` e zero erros de runtime na janela de uma hora. A análise de banco definiu rollout expand/contract: a próxima migration mantém compatibilidade, move elegibilidade/locks/snapshot/undo para o servidor e só depois do cliente publicado revoga a escrita ampla em `cards`/`review_log`. Supabase remoto e produção permaneceram inalterados nesta fatia.

- **2026-07-12 — P0 / fila, limites e previsão de intervalo (Codex; branch `codex/review-mobile-video`):** learning vencido agora é reinserido no topo da fila, preservando a ordem de vencimento, em vez de ficar atrás de cards novos/review. O `learn-ahead` automático de 20 minutos e seu botão de antecipação foram removidos: a tela espera o vencimento real ou permite encerrar a sessão, sem encurtar silenciosamente os learning steps. O cálculo de intervalo deixou de aplicar fuzz aleatório no cliente e a prévia do botão é reutilizada na gravação; sem prévia, o fallback também é determinístico. A migration `20260712213444_learning_review_counts` foi aplicada e verificada no Supabase: adiciona `review_log.previous_status`, capturado pela RPC sob lock antes de atualizar o card; `getTodayCounts()` conta somente eventos cujo estado anterior era `review`/`mature`. Eventos antigos ficam `NULL` por não existir reconstrução confiável de estado pré-evento, portanto o novo limite fica exato para avaliações feitas após a migration. Grants conferidos: `authenticated=true`, `anon=false`. Validação local: 37 testes do motor, 4 de vídeo, 5 de dia local, smoke de release e sintaxe verdes. O replay em banco efêmero segue pendente por indisponibilidade do Docker local; a branch ainda não foi publicada em produção.

- **2026-07-12 — P0 / revisão mobile e trecho de vídeo (branch `codex/review-mobile-video`, baseada em `main` `f040de6`):** iniciada a correção da entrega de produção, sem misturar a branch de auditoria antiga. O mobile deixa de ter três áreas de rolagem concorrentes: no breakpoint móvel o `#app-root` é o único dono da rolagem, a área principal reserva espaço seguro para avaliação e os quatro botões tornam-se um rodapé fixo 2×2. O tutor foi movido da cauda da sidebar para o contexto imediato da frase. **Complemento UX feito por Codex:** o contexto do vídeo agora fica ao lado do card, abaixo do tutor e só é preenchido após a revelação; YouGlish, Tatoeba, chunks e mnemônico ficam agrupados em “Mais exemplos e recursos”, fechado inicialmente no celular e aberto no desktop. Assim o primeiro viewport móvel contém uma única tarefa — recuperar e avaliar — sem remover os recursos de aprofundamento. A migration `20260712212413_video_clip_bounds` foi aplicada e verificada no Supabase de produção: adiciona `words.video_start_ms`/`video_end_ms` e três checks de integridade, sem backfill inventado; cards antigos mantêm o fallback de URL. A extensão passa a capturar os bounds da cue antes de awaits e o dashboard os consome. O player foi convertido de embed preparado em controlador de trecho: timeout de API, invalidação de pedidos antigos, reprodução somente após gesto explícito, replay e pausa/seek no fim conhecido. Validação: `node --check` dos módulos alterados, 4 testes de contexto de vídeo, 34 testes do motor, 5 de calendário e smoke de release verdes. A branch ainda não foi mesclada nem publicada na produção.

- **2026-07-10 — P0 / integridade da revisão:** criada e aplicada no Supabase a migration `20260710173210_record_card_review_atomically`. Ela adiciona chave de idempotência ao `review_log` e a RPC `record_card_review`, que grava estado do card + histórico + trigger de XP na mesma transação. O cliente agora usa essa RPC, bloqueia duplo clique de avaliação e mostra somente XP confirmado pelo servidor. A migration foi confirmada no histórico do Supabase e `node --check` + 14 testes do motor passaram.
- **2026-07-10 — P0 / limites diários:** a fila de estudo passou a aplicar a cota de revisões apenas a cards de revisão, sem esconder cards novos ou passos de aprendizagem. O recorte anterior usava uma única lista e podia bloquear conteúdo indevidamente.
- **2026-07-10 — P0 / undo íntegro:** criada e aplicada a migration `20260710173541_reversible_review_events`. O `review_log` agora registra o XP e um snapshot das estatísticas anteriores; `revert_card_review` restaura card + XP + streak como uma transação e só permite desfazer a última atividade. O cliente não pode mais apagar logs diretamente.
- **2026-07-10 — P0 / recuperação de migrations:** os scripts históricos de `security_hardening_e0`, `translation_cache_e2`, `learning_engine_e4`, `league_rollover_e5` e `harden_ensure_user_stats` foram recuperados para `supabase/migrations/` a partir do schema e funções efetivamente inspecionados na produção. Eles não foram reaplicados (já constam no histórico do Supabase); a próxima validação é executá-los num banco efêmero antes de considerar a reprodução integral concluída.
- **2026-07-10 — P1 / nivelamento confiável:** o resultado combinado agora exige refazer o teste quando o controle de pseudo-palavras aponta chute. Antes, alguém podia obter um nível alto acertando alternativas de cloze/listening apesar de invalidar o vocabulário; agora o nível fica limitado à base verificada e não pode ser aplicado.
- **2026-07-10 — P0 / autorização de revisão:** validação de grants revelou que `anon` ainda podia executar as novas RPCs apesar do revoke genérico. A migration `20260710174406_revoke_anon_review_rpcs` foi aplicada e confirmada: somente `authenticated`, `service_role` e `postgres` mantêm execução.
- **2026-07-10 — P1 / observabilidade:** aplicada a migration `20260710174601_client_error_telemetry`. O dashboard captura erros não tratados de forma deduplicada e grava apenas metadados técnicos mínimos em `client_errors`, protegido por RLS de inserção do próprio usuário. Nenhum texto de card, prompt, token, e-mail ou stack trace é enviado.
- **2026-07-10 — P1 / estudo acessível e mobile:** `studyView` recebeu região principal identificada, anúncio discreto do novo card para leitor de tela, rótulos explícitos nos quatro botões de avaliação e foco visível por teclado. Em telas de até 768 px a lateral passa abaixo do card e os botões quebram em grade; em 380 px reduzem espaçamentos e tipografia sem perder a área de toque. Validação: sintaxe JavaScript e testes do motor. Uma inspeção visual do preview em dispositivo real ainda faz parte da validação final.
- **2026-07-10 — P1 / semântica diária por fuso:** aplicada a migration `20260710181500_timezone_daily_semantics`. `user_stats.timezone` armazena o identificador IANA sincronizado após o login; XP, streak, freeze e limites anti-farm passam a usar a data desse fuso, não `CURRENT_DATE` em UTC. O dashboard conta revisões e cards introduzidos entre o início e o fim do dia local. A RPC `set_user_timezone` valida o IANA, exige autenticação e só atualiza o próprio perfil; `anon` não tem execução. Evidência: grants conferidos e cálculo de São Paulo/Tóquio retornou dias distintos na produção. O advisor ainda lista a RPC como `SECURITY DEFINER` por ela ser intencionalmente a porta estreita para essa atualização sob RLS.
- **2026-07-10 — P0 / retomada do Web Push iniciado por Fable:** a revisão sênior encontrou a migration `20260710190558_web_push` aplicada diretamente na produção, com `push_subscriptions`, chaves VAPID no Vault e cron diário. Porém a Edge Function `push-reminder` não foi publicada e nenhum fonte/migration estava no Git; o cron chamava endpoint inexistente. **Codex desativou o job `push-daily-reminder`** antes de qualquer novo deploy (confirmado `active=false`) para eliminar chamadas 404. A recuperação do schema, a função de envio e o opt-in do PWA serão versionados antes de reativá-lo. Não marcar Web Push como entregue até existir inscrição real e teste de notificação.
- **2026-07-10 — P0 / reprodutibilidade e release:** as equipes de banco e qualidade criaram `scripts/replay-migrations-local.ps1` e `tests/release-smoke.mjs`. O replay só roda com `-Execute`, em cópia temporária e `supabase db reset --local`, sem ref, URL ou segredo remoto; a validação estática verifica migrations, RLS/revokes críticos, manifest MV3, shell PWA, rewrites Vercel e sintaxe. `npm run test:release -- --allow-dirty` e `npm run test:engine` passaram. O replay completo continua pendente até instalar/usar Supabase CLI local com Docker; esse é um critério objetivo de pré-merge, não uma aprovação presumida.
- **2026-07-10 — P1 / onboarding de primeiro acesso:** o empty state antigo foi substituído por jornada acessível e persistida em `settings.onboarding_v1`: nível atual → meta diária de 10/20/40 revisões → primeira atividade em Histórias. A meta passa a orientar a missão diária, com redução apenas no primeiro retorno após ausência. A tela separa falha de leitura de conta vazia e oferece retry; só avança após a gravação ser confirmada pelo servidor. Validação: `node --check`, smoke de release e 14 testes do motor.
- **2026-07-10 — P1 / dia local completo no cliente:** criada `utils/local-day.js` e aplicada em `db.js` e Início. Logs, sessões, metas, heatmap, previsão e afastamento agora usam chave de calendário local e limites entre meias-noites locais — não `toISOString()`/UTC. Há 5 testes para mudança de data, DST e chaves inválidas; `npm run test:local-day`, engine e smoke passaram.
- **2026-07-10 — P2 / player contextual:** cards salvos pela extensão já guardavam URL/título/plataforma, mas o dashboard não os usava. `videoContext.js` agora exibe link seguro para o ponto salvo em Estudo e Cofre; apenas URLs HTTPS do YouTube válidas podem abrir iframe lazy em `youtube-nocookie.com`. Netflix/DRM e URLs externas recebem somente link, e `javascript:`/HTTP/malformadas são rejeitadas. Validação cobre timestamp `1m2s`, fallback externo e rejeição de URL perigosa.
- **2026-07-10 — P2 / chave pública do Push:** aplicada e versionada `20260710194500_expose_push_public_key`. A RPC exige `auth.uid()`, entrega exclusivamente `lf_vapid_public` do Vault para `authenticated` e revoga `PUBLIC`/`anon`; nunca lê a chave privada ou a chave do cron. O cron continua pausado. Falta o cliente de consentimento, handlers do Service Worker, configurar `LF_VAPID_SUBJECT`, publicar/testar a Edge Function e só então reativar o cron.
- **2026-07-11 — gerência / revisão da continuação Claude:** localizados os commits `c0c31fc`…`a56b06d` na branch `claude/learning-system-audit-4uwb83`, descendente direta desta branch. Eles **não foram integrados automaticamente**: a revisão de linguista, banco e QA encontrou progresso útil, mas bloqueadores reais (cron Push reativado sem inscrição real/verificação de secret, replay de migrations sem Vault/cron/CI, fallback VAPID hardcoded, bordas do `Difícil`, quiz repetível e reencontro ausente na extensão). Evidência operacional: o job `push-daily-reminder` foi encontrado `active=true` na produção e Codex o pausou novamente (`active=false`). O roteiro de integração passa a ser seletivo, com teste e documentação por bloco.
- **2026-07-11 — P0 / automação de qualidade:** o workflow GitHub Actions agora roda `test:engine`, `test:local-day` e `test:release` em pull requests e branches de trabalho; o empacotamento da extensão permanece exclusivo para tags. O replay local ganhou fallback seguro para `npx supabase`. A tentativa de execução foi interrompida antes de tocar qualquer banco porque o Docker daemon desta máquina está desligado; o bloqueio foi registrado de forma explícita.
- **2026-07-11 — P1 / fim do loop de “Difícil”:** a revisão confirmou que a implementação atual não avançava `step_index` ao receber qualidade 2, permitindo repetição eterna no learning. A política agora é explícita: “Difícil” repete o primeiro passo uma vez, depois avança mais devagar (1,5×); com `n` passos, gradua em no máximo `n + 1` respostas difíceis. Testes cobrem dois passos e passo único, além da suíte FSRS existente: 15/15 verdes.
- **2026-07-11 — P1 / Histórias sem spoiler e quiz seguro:** o quiz agora aceita somente três perguntas bem formadas, com quatro alternativas distintas e índice de resposta válido; foca assuntos variados e embaralha alternativas. XP é bloqueado ao refazer o quiz da mesma história aberta (o limite diário do servidor continua como segunda barreira). A tradução inicial do modal mostra só a palavra; a frase exige ação explícita. Hover e foco exibem só a tradução da palavra, e as palavras podem ser abertas por teclado. A renderização de conteúdo da IA usa nós DOM/texto, não `innerHTML`.

### Plano de conclusão (ordem obrigatória)

| Prioridade | Bloco | Responsável | Situação | Critério de aceite |
|---|---|---|---|---|
| P0 | Versionar migrations já aplicadas e eliminar divergência Git↔Supabase | Codex | Em validação | Todas as migrations conhecidas estão no Git; o replay local atual ainda precisa cobrir Vault/cron e rodar de fato em ambiente provisionado. |
| P0 | Corrigir/validar segurança e permissões de RPC | Codex | Em validação | Grants/RLS críticos são checados no smoke; ainda falta a ação manual de proteção contra senhas vazadas e revisão final dos advisors. |
| P0 | Revisão e testes integrados do PR #3 | Codex | Em andamento | Testes automatizados, validação do banco e smoke test do preview passam. |
| P1 | Observabilidade de erros | Codex | Implementado | Falhas de cliente são capturadas sem texto de usuário, token, e-mail ou stack trace. |
| P1 | Acessibilidade e responsividade do estudo | Codex | Em validação | Uso por teclado e ARIA implementados; falta inspeção visual do preview em dispositivo real. |
| P1 | Dia local, streak e limites | Codex | Implementado | Fuso IANA por usuário aplicado a XP/streak/caps, logs, sessões, metas e contadores; validar em uma conta real perto da meia-noite. |
| P1 | Onboarding de primeiro acesso | Codex | Implementado | Novo usuário registra nível, meta e é levado à primeira atividade; gravação e erro de rede têm tratamento explícito. |
| P2 | Web Push do PWA com consentimento | Codex | Bloqueado com contenção | Há código posterior do Claude, mas cron foi reativado sem prova de assinatura real; está pausado. Falta E2E com secret VAPID validado, inscrição real e handlers auditados. |
| P2 | Player YouTube contextual reutilizável | Codex | Implementado | Estudo e Cofre reproduzem somente YouTube permitido no timestamp salvo; demais plataformas usam link seguro. |
| P2 | Consolidação/faxina final | Codex | Pendente | Site e extensão têm responsabilidades sem rotas/código duplicado. |

---

> **Escopo:** este documento é o "raio-X" pedido pelo dono. Ele responde a UMA pergunta central, lista TODOS os problemas por criticidade, faz o benchmark contra Anki/SuperMemo/LingQ/Duolingo/Language Reactor/Readlang/Mochi/Memrise, aponta o que NÃO foi pedido mas deveria existir, e termina com um **roadmap em etapas para o Fable 5 executar**. Nenhuma alteração de código foi feita — só diagnóstico.

---

## 0. A resposta curta

**O LinguaFlow hoje funciona de verdade ou só *parece* funcionar?**

Resposta honesta: **o coração bate, mas os órgãos não estão ligados uns nos outros.**

- ✅ O **motor de repetição espaçada é REAL e bom.** `utils/db.js` implementa FSRS-4.5 de verdade (os 17 pesos oficiais, estabilidade, dificuldade, retrievability, learning steps, leech, undo). Isso é nível Anki moderno. Não é fachada.
- ✅ O **XP e a ofensiva SÃO calculados no backend** por um trigger Postgres real (`calculate_xp_on_activity` no `review_log`). Não é `Math.random()`.
- ❌ **Mas quase nada conversa entre si, e várias telas mentem para o usuário.** O jogo diz "Você ganhou XP!" e não dá XP nenhum. As Ligas têm um botão "Simular Fim da Semana" porque não existe promoção automática. Metade das Configurações são enfeite (salvam numa chave que o motor nunca lê, ou nem salvam). O teste de nivelamento não é um exame — é um quiz de "conhece esta palavra? sim/não". A tabela de `settings` virou lixão de cache de tradução (3.195 linhas para 1 usuário), e isso deixa o sistema lento.
- ❌ **O bug dos cards que "voltam" é real e tem causa raiz clara** (seção 2). Não é impressão sua.

**Veredito:** o LinguaFlow é hoje um **conjunto de telas boas sobre um motor bom, sem um "sistema nervoso central" que ligue as duas coisas.** Falta o *Learning Engine* — a camada única que recebe "o aluno fez X" e propaga isso para card + XP + streak + missão + LingQ + dashboard de forma consistente. Ele existe pela metade (só o caminho card→XP está ligado). Todo o resto é ilha.

---

## 1. Como o sistema está montado hoje (mapa real)

**Três superfícies, um banco:**
- **Extensão Chrome (MV3)** — captura legenda dupla em vídeo (YouTube/Netflix/HBO/Prime/Disney), clicar palavra → dicionário/IA → salvar card. É a parte mais madura (`content/subtitle-engine.js`, 4.182 linhas). É a razão-de-existir estilo Language Reactor.
- **Site/PWA na Vercel** (`linguaflow-web-tau.vercel.app`) — o dashboard pesado (Início, Estudo, Cofre, Histórias, Ligas, Config). Servido de `dashboard/`.
- **Supabase** — Postgres (fonte da verdade), Auth, 2 Edge Functions (`deepseek-chat`, `tts`).

**Banco real (produção), hoje:** `words` 4 linhas, `cards` 4, `review_log` 29, `sessions` 3, `stories` 1, `user_stats` 1, `known_words` 0, `sentences` 0, **`settings` 3.195 linhas.** Guarde esse 3.195 — ele é o sintoma nº1 da lentidão (seção 4).

**O mesmo dashboard roda em DOIS contextos** (página `chrome-extension://` e site). Isso dobra a superfície de teste e gera divergências (CSP diferente, `chrome.runtime` que só existe na extensão). O `PLANO_MESTRE_FABLE5.md` já decidiu consolidar tudo no site — ainda não foi feito.

---

## 2. 🔴 O BUG DOS CARDS QUE VOLTAM — causa raiz confirmada

Você clica em Estudar, revisa, o sistema diz **"Sessão Concluída! 🎉"**, você volta ao Início e **os mesmos cards estão lá de novo**. Isto NÃO é um bug de sincronização de banco — o banco está certo. São **três causas somadas**, todas no `dashboard/js/ui/studyView.js` + `utils/db.js`:

### 2.1. Não existe fila de aprendizado dentro da sessão (a causa principal)
No Anki de verdade, um card novo tem "learning steps" (padrão `1 10` minutos). Quando você acerta um card novo com **"Bom"**, ele **não** vai embora — ele volta na mesma sessão daqui a 10 minutos, e só "gradua" depois de passar por todos os passos. É assim que a memória fixa.

No LinguaFlow, o `_calculateNextState` (`db.js:688`) faz a conta certa — agenda o card para "daqui a 10 min" (`nextInterval = learningSteps[...]/1440`). **Mas o `studyView` não tem fila de curto prazo.** Olhe o `handleGrade` (`studyView.js:1017`):

```js
dueQueue.shift();      // tira o card da fila
loadNextCard(app);     // e NUNCA o recoloca, mesmo que ele vença em 10 min
```

Resultado: a sessão "acaba" (fila vazia) enquanto **vários cards estão agendados para daqui a poucos minutos**. Você volta ao Início, o tempo passou, eles venceram de novo → reaparecem. Da sua perspectiva: *"eu finalizei e eles voltaram"*. Do ponto de vista do Anki, eles nunca foram finalizados — só saíram da tela cedo demais.

### 2.2. Os botões de nota MENTEM o intervalo
Os rótulos "Errei <1 min / Difícil 1 dia / Bom 3 dias / Fácil 7 dias" são **texto fixo no HTML** (`studyView.js:89-91`) — não vêm do card. Já existe uma função `predictNextInterval()` (`db.js:773`) pronta para calcular o valor real, **e ela não é usada na tela.** Então um card novo mostra "Bom = 3 dias" mas na verdade é agendado para 10 minutos. O usuário sente que o motor é fake porque o número na tela não bate com o comportamento.

### 2.3. O contador "Para Revisar" no Início conta os cards em learning
`getStats()` conta `dueCards = cards.filter(due <= now)` (`db.js:509`). Os cards em learning (10 min) entram nessa conta assim que vencem. Então o número no dashboard "não zera nunca", reforçando a sensação de loop.

**Efeito combinado:** o sistema promete "acabou", mas a arquitetura de fila não corresponde ao agendamento. **Correção:** implementar uma fila de sessão que reinsere cards com intervalo < 1 dia (learning) e só encerra quando não há mais nada vencido *nem no curto prazo*; e trocar os rótulos fixos por `predictNextInterval()`. (Detalhe no roadmap, Etapa 1.)

---

## 3. 🔴 As Configurações que NÃO refletem no sistema

Você pediu especificamente: *"se aplico algo nas configurações, ela reflete no sistema?"* Auditei uma a uma (`settingsView.js`). Veredito por controle:

| Configuração | Salva? | O motor lê? | Situação |
|---|---|---|---|
| Nível CEFR (botões + teste) | ✅ `lf_cefr_level` | ✅ IA/histórias | **Funciona** |
| Retenção desejada (slider FSRS) | ✅ `lf_srs_retention` | ✅ `getSRSSettings` | **Funciona** |
| Sotaque TTS (US/GB) | ✅ `lf_tts_lang` | ✅ tts | **Funciona** |
| Velocidade TTS | ✅ `lf_tts_speed` | ⚠️ salva, quase não usada | **Parcial** |
| Cartões reversos | ✅ `lf_reverse_cards` | ✅ studyView | **Funciona** |
| Exercícios variados | ✅ `lf_varied_exercises` | ✅ studyView | **Funciona** |
| Voz Kokoro | ✅ localStorage | ✅ tts | **Funciona** |
| **"Novas cartas/dia" (20)** | ❌ input sem `id`, sem handler | ❌ | **FANTASMA** — nunca salva; o limite diário de cards novos **não existe** no sistema |
| **"Revisões máximas/dia" (200)** | ❌ | ❌ | **FANTASMA** |
| **"Passos de Aprendizagem" (1m 10m)** | ❌ input sem `id`, sem handler | ⚠️ motor lê `learning_steps`, sem UI | **FANTASMA** — o campo mais importante do FSRS é decorativo |
| **"Áudio automático Frente/Verso"** | ❌ checkbox sem handler | ❌ | **FANTASMA** — o áudio sempre toca, marcando ou não |
| **Intervalo mín. após graduação** | ✅ `lf_srs_min_interval` | ❌ motor lê `graduating_interval` | **DESCONECTADO** — salva numa chave que ninguém lê |
| **Ease factor inicial** | ✅ `lf_srs_ease` | ❌ motor lê `initial_ease` | **DESCONECTADO** |
| **Penalidade por lapso** | ✅ `lf_srs_penalty` | ❌ motor lê `lapse_modifier` | **DESCONECTADO** |
| **Suspender após N erros** | ✅ `lf_srs_suspend` | ❌ motor lê `leech_threshold` | **DESCONECTADO** |

**O problema é grave e sutil:** o `getSRSSettings()` (`db.js:589`) lê as chaves `graduating_interval`, `initial_ease`, `leech_threshold`, `lapse_modifier`… mas a tela de Configurações salva `lf_srs_min_interval`, `lf_srs_ease`, `lf_srs_penalty`, `lf_srs_suspend`. **São nomes diferentes.** O usuário mexe nos 4 controles "Nível Anki", clica Salvar, vê "Configurações salvas ✅" — e o motor de memória continua exatamente igual. É a definição literal de "parece funcionar mas não funciona".

---

## 4. 🔴 A lentidão: a tabela `settings` virou lixão de tradução

Este é o achado que explica *"o sistema e a IA estão muito lentos"*.

O `translator.js` usa `db.setSetting(...)` como cache de tradução de legenda (`translator.js:49,60,67`). **Cada linha de legenda traduzida num vídeo vira uma linha na tabela `settings`.** Amostra real do banco:

```
key: "trans_auto:pt:this is actually sort of nice." → value: "Na verdade, isso é legal."
key: "trans_en:pt:here" → value: "aqui"
... (3.195 linhas assim, para UM usuário)
```

Consequências em cadeia:
1. **`setSetting` invalida o cache do SRS a cada chamada** (`db.js:283`: `this._srsCache = null`). Ou seja, **cada tradução de legenda joga fora o cache do motor de memória.** O cache de 60s que existe pra acelerar o estudo é destruído o tempo todo enquanto você assiste vídeo.
2. **`getSetting`/`getSRSSettings` fazem `SELECT` numa tabela que cresce sem limite.** Com RLS reavaliando `auth.uid()` por linha (advisor `auth_rls_initplan` confirmou isso em TODAS as tabelas), a leitura fica progressivamente mais cara.
3. **Sem índice em `settings(user_id, key)`** para essa carga — vira scan.
4. Mistura dados de configuração (o que o motor precisa) com cache descartável (o que devia poder ser apagado). Você não consegue nem limpar o cache sem risco de apagar config.

**Correção:** cache de tradução vai para uma tabela própria (`translation_cache`) ou fica só no cliente (IndexedDB/memória). `settings` volta a ter ~20 linhas. Isso sozinho já dá um salto de performance. (Roadmap, Etapa 2.)

---

## 5. 🟠 Gamificação: metade real, metade teatro

| Sistema | Real? | Evidência |
|---|---|---|
| **XP** | ⚠️ Real no backend, mas incompleto | Trigger `calculate_xp_on_activity` dá +10 XP por revisão correta (`quality>=2`). **MAS:** só revisão de card dá XP. Assistir vídeo, salvar palavra, ler história, jogar o Match → **0 XP.** E o front tem um XP paralelo em `localStorage` (`lf_xp_today`) que pode divergir do banco. XP é **fixo em 10** — não escala com dificuldade do card, streak, nem "primeira vez do dia". |
| **Ofensiva (streak)** | ⚠️ Real, mas com duas fontes | O trigger calcula streak + streak freeze de verdade (bonito, inclusive perdoa 1 dia com freeze). **MAS** só conta dias com revisão correta. `getStats._calculateStreak` (`db.js:559`) calcula um streak DIFERENTE incluindo dias de vídeo. O dashboard mostra o do trigger; o vídeo não conta pra ofensiva. Duas verdades. |
| **Missões** | ⚠️ Dados reais, lógica fixa | `homeView.js:101` — pool fixo de 7 missões, 3 sorteadas por dia via seed da data. Progresso é real (lê `reviewsToday`, `wordsToday`, `xpToday`). **MAS:** não se adapta à rotina. Não existe missão de "volte a estudar" para quem sumiu, nem escala de dificuldade por histórico, nem missão semanal/mensal, nem recompensa por completar. |
| **Ligas** | ❌ Teatro | `leaguesView.js:219` — botão **"Simular Fim da Semana"**. Não há cron de promoção/rebaixamento. O leaderboard é real (lê `user_stats`) mas você está sozinho (1 usuário). O comentário no código admite: *"in a real backend, a cron job would run weekly"*. |
| **Jogo "Ligar Colunas"** | ❌ Mentira explícita | `gameView.js:210` — `finishGame()` mostra **"Você ganhou XP! 🎉"** e **não dá XP, não registra review, não afeta o SRS.** Puro enfeite. Desconectado do motor. |
| **Conquistas / desafios / metas** | ❌ Não existem | Mencionados no prompt, não há tabela nem código. |
| **Incentivo para quem sumiu** | ❌ Não existe (o seu ponto) | A única notificação (`service-worker.js:1145`) é: existe na **extensão apenas**, dispara no máx 1x/20h, e só diz "você tem N cards". O PWA/site **não tem push nenhum.** Não há e-mail, não há "sentimos sua falta", não há recuperação de ofensiva proativa. Se o aluno some por 3 dias, **nada** o chama de volta. |

---

## 6. 🟠 Teste de nivelamento: não é um exame

Você disse: *"o teste não está real, não está no nível de Cambridge/Duolingo"*. Correto. O `placement.js` faz **reconhecimento de vocabulário por faixa**: mostra 30 palavras (6 por faixa A1–C1) + 6 pseudo-palavras (controle anti-chute), pergunta "conhece? sim/não", e estima o nível pela maior faixa com ≥60% de acerto.

Isso é honesto como *estimador de tamanho de vocabulário* (estilo testyourvocab), e o controle anti-chute com palavras falsas é inteligente. **Mas não é um teste de proficiência.** Comparado às referências:

| Recurso | Cambridge / Oxford Placement | Duolingo English Test | LinguaFlow hoje |
|---|---|---|---|
| Adaptativo (dificuldade muda conforme acerta) | ✅ | ✅ | ❌ (30 itens fixos) |
| Mede leitura/compreensão | ✅ | ✅ | ❌ |
| Mede escuta (listening) | ✅ | ✅ | ❌ |
| Mede gramática/uso em contexto | ✅ | ✅ | ❌ (só "conhece a palavra") |
| Produção (escrita/fala) | ✅ | ✅ | ❌ |
| Mapeia CEFR com corte calibrado | ✅ | ✅ | ⚠️ heurístico, **para em C1** (a wordlist só vai até B2; C2 é impossível de medir) |
| Identifica lacunas por habilidade | ✅ | parcial | ❌ |

**Para virar "real"** precisa no mínimo: itens adaptativos (IRT ou escada de dificuldade), questões de *cloze* (completar frase) e de compreensão de leitura, um bloco de listening (o TTS já existe), e cortes CEFR calibrados. Não precisa clonar o Cambridge — precisa medir mais que "vi essa palavra antes". (Roadmap, Etapa 6.)

---

## 7. 🟠 Histórias: falta o essencial do LingQ

O `storiesView.js` gera história por IA, deixa clicar palavra → tradução, tem player de áudio (TTS por frase), salva no banco. Bom começo. Mas comparado ao LingQ falta o núcleo do método (*input compreensível com tracking*), e há **2 bugs concretos**:

- 🐞 **Bug:** ao salvar palavra da história (`storiesView.js:547`), passa `translation: '[Salvo via História]'` (placeholder — a tradução real que já foi buscada é jogada fora) e `context:` em vez de `context_sentence:` (o campo que `saveWord` lê). Resultado: o card nasce **sem tradução e sem contexto**. A palavra salva da história vira um card quebrado.
- **Falta (LingQ):** perguntas de compreensão ao fim da história; status por palavra (novo/aprendendo/conhecido) com cores; contador de "palavras conhecidas" progredindo conforme você lê; % de palavras conhecidas da história (o número que engaja no LingQ); reuso: as palavras que você já sabe deviam aparecer destacadas nas próximas histórias; e as histórias deviam poder ser geradas *usando* o seu vocabulário salvo.

---

## 8. Tabela-mestra de todos os problemas (por criticidade)

Legenda de complexidade: **P** pequena (horas), **M** média (dias), **G** grande (semana+).

| # | Problema | Área | Impacto no usuário | Impacto técnico | Complex. | Depende de |
|---|---|---|---|---|---|---|
| 1 | Cards voltam: sem fila de learning intra-sessão | Motor | 🔴 Altíssimo (quebra a confiança no app) | Médio | **M** | — |
| 2 | Botões de nota mostram intervalo fixo (mentem) | Motor/UX | 🔴 Alto | Baixo | **P** | #1 |
| 3 | `settings` = lixão de cache de tradução (3.195 linhas) → lentidão + invalida cache SRS | Banco/Perf | 🔴 Alto (lentidão geral) | Alto | **M** | — |
| 4 | 4 configs "Nível Anki" salvam em chaves que o motor não lê | Config | 🔴 Alto | Médio | **P** | — |
| 5 | 5 controles de config são fantasmas (não salvam nada) | Config | 🟠 Médio-alto | Baixo | **P** | — |
| 6 | Limite de cards novos/dia não existe (só enfeite) | Motor | 🟠 Médio (avalanche de cards) | Médio | **M** | #1 |
| 7 | Jogo "Match" diz que dá XP e não dá; desligado do SRS | Gamif. | 🟠 Médio | Baixo | **M** | Learning Engine |
| 8 | Ligas sem cron; promoção é botão manual "Simular" | Gamif. | 🟠 Médio | Médio | **M** | pg_cron |
| 9 | XP só vem de review; vídeo/história/jogo dão 0 | Gamif. | 🟠 Médio | Médio | **M** | Learning Engine |
| 10 | Streak tem 2 fontes divergentes (trigger vs client) | Gamif. | 🟠 Médio | Médio | **P** | — |
| 11 | Salvar palavra da história cria card sem tradução/contexto | Histórias | 🟠 Médio | Baixo | **P** | — |
| 12 | Teste de nivelamento não mede proficiência (só vocab) | Placement | 🟠 Médio | Alto | **G** | — |
| 13 | Nenhum reengajamento p/ quem sumiu (sem push no site) | Gamif./Retenção | 🟠 Médio (seu ponto) | Alto | **G** | Web Push/e-mail |
| 14 | Missões não se adaptam à rotina; sem semanais/recompensa | Gamif. | 🟠 Médio | Médio | **M** | Learning Engine |
| 15 | Histórias sem perguntas/tracking LingQ | Histórias | 🟠 Médio | Médio | **G** | — |
| 16 | RPC `get_due_cards` referencia colunas dropadas (`chunks`, `deck_id`) → quebrada | Banco | 🟡 Baixo (código morto) | Baixo | **P** | — |
| 17 | Advisor: 6 funções `SECURITY DEFINER` executáveis por anon/authenticated | Segurança | 🟡 Baixo-médio | Médio | **P** | — |
| 18 | Advisor: `search_path` mutável em 6 funções | Segurança | 🟡 Baixo | Baixo | **P** | — |
| 19 | Advisor: RLS reavalia `auth.uid()` por linha (todas as tabelas) | Perf/Seg | 🟡 Baixo (piora na escala) | Médio | **P** | — |
| 20 | Advisor: FK `cards.word_id` sem índice; RLS sem policy em `api_usage_log`; senha vazada (HIBP) off | Banco/Seg | 🟡 Baixo | Baixo | **P** | — |
| 21 | Dashboard servido em 2 contextos (extensão + site) → divergência | Arquitetura | 🟡 Baixo (dobra bugs) | Alto | **G** | decisão do dono |
| 22 | XP paralelo em `localStorage` pode divergir do banco | Estado | 🟡 Baixo | Baixo | **P** | Learning Engine |

---

## 9. Benchmark — o que cada referência tem que o LinguaFlow poderia adotar

Não é "copiar tudo". É identificar **quais conceitos realmente melhoram o aprendizado** e o LinguaFlow não tem (ou tem pela metade).

| Plataforma | Ideias-chave | LinguaFlow tem? | Vale trazer? |
|---|---|---|---|
| **Anki** | FSRS ✅, learning steps, limite diário, suspender/enterrar, undo, decks/tags, filtered decks, estatísticas (forecast, retention por dia), editor de card | FSRS ✅, undo ✅, suspend/bury ✅, tags ✅ · **falta:** limite diário real, forecast de carga, estatísticas de verdade, editor de card, decks | **Alto** — limite diário e forecast são o que impede a "avalanche de cards" que assusta o aluno |
| **SuperMemo** | Incremental reading, prioridade de material, A-Factor | Não | Baixo (complexo demais pro público) |
| **LingQ** | Status por palavra (novo→aprendendo→conhecido), contador de palavras conhecidas, % conhecido do texto, import de qualquer conteúdo, perguntas | Histórias tem clique+áudio · **falta:** todo o tracking de status e o contador | **Alto** — é o coração do "input compreensível" e do vício saudável do LingQ |
| **Duolingo** | XP escalonado, ligas com cron real, missões adaptativas + semanais, streak com metas/freeze, notificações espertas, path de lições, corações/energia | XP+streak+ligas+missões existem mas rasos · **falta:** profundidade de todos | **Alto** — é exatamente o que o dono sentiu faltar ("não incentiva de verdade") |
| **Language Reactor** | Legenda dupla, clicar palavra, salvar, player com replay de frase, velocidade | ✅ (é a parte mais madura) | Já tem — polir |
| **Readlang** | Tradução inline ao clicar, exporta para Anki/SRS, leitor web universal | Extensão faz parte disso · **falta:** leitor web universal robusto | Médio |
| **Mochi / Memrise** | Cards com mídia, mnemônicos, vídeos de nativos ("Learn with locals"), TTS nativo | YouGlish embutido (nativos falando) ✅ · **falta:** mnemônicos, mídia rica | Médio — o vídeo de nativos casa com a ideia do dono (seção 11) |

---

## 10. 💡 O que você NÃO pediu, mas eu faria (você disse que não conhece o nicho)

Priorizado pelo retorno para *aprendizado real* e *retenção do aluno*:

1. **Um "Learning Engine" central (a peça que falta).** Uma camada única — 1 função no cliente + 1 RPC no Postgres — que recebe **qualquer** evento de aprendizado (revisou card, assistiu 5 min, leu história, salvou palavra, acertou no jogo) e atualiza **tudo** de forma consistente: XP, streak, missões, LingQ, dashboard. Hoje só existe o caminho card→XP. Isso é o conserto arquitetural de fundo — resolve os itens #7, #9, #10, #14, #22 de uma vez e impede que o problema volte.
2. **Estatísticas de verdade (tipo Anki).** Forecast de revisões dos próximos dias, retenção real por dia, tempo por dia, curva de maturação. Você tem os dados (`review_log`, `cards`), só falta a tela. Isso dá ao aluno a sensação de progresso que o motiva.
3. **Limite diário + "botão de pânico" de carga.** Sem limite de cards novos/dia, quem salva 50 palavras num vídeo leva uma avalanche no dia seguinte e desiste. Limite + "adiar excedente" é retenção pura.
4. **Reengajamento proativo (o seu ponto, feito direito):** Web Push no PWA + e-mail opcional. "Sua ofensiva de 12 dias acaba hoje", "sentimos sua falta — 3 cards de 2 min", "você aprendeu 40 palavras esse mês". É o que traz o aluno que sumiu.
5. **Onboarding de primeiro acesso.** Hoje quem entra sem palavras vê uma tela pedindo pra instalar a extensão. Precisa de um fluxo: fazer o teste de nível → escolher meta diária → primeira história/primeiros cards prontos. Sem isso, o "empty state" perde o usuário.
6. **Deck/coleção temática e revisão por tópico** (viagem, trabalho, séries). Ajuda o aluno a estudar com propósito.
7. **Acessibilidade e responsivido mobile de verdade** (o estudo hoje é pensado pra desktop). Grande parte do uso de idioma é no celular.
8. **Telemetria de erros (Sentry ou similar).** Hoje, quando um salvamento falha, ninguém fica sabendo. Você está pilotando às cegas.
9. **Modelo de dados para o LingQ** (`word_status`: new/learning/known por palavra) — habilita o tracking das histórias e o contador de palavras conhecidas de forma consistente com os cards.
10. **Segurança:** aplicar as correções dos advisors (funções `SECURITY DEFINER` restritas, `search_path` fixo, RLS com `(select auth.uid())`, proteção de senha vazada). Barato e importante antes de crescer a base.

---

## 11. 🎬 O player do YouTube reutilizável (sua ideia) — é viável, sim

Sua proposta: usar o **vídeo original** como *contexto* do card (a frase falada por um nativo no momento exato), mantendo o **Google Neural como TTS oficial** da palavra. E a pergunta-chave: *dá pra ter UMA instância global do player e só trocar `videoId/startTime/endTime`?*

**Sim, é viável e é a abordagem certa.** A YouTube IFrame API expõe `player.loadVideoById({ videoId, startSeconds, endSeconds })` — dá pra criar **um único `<iframe>` global uma vez** e, a cada card, chamar `loadVideoById` (ou `cueVideoById` + `seekTo`) para reaproveitar o mesmo player. Ganhos reais: sem recriar iframe por card (menos memória, abertura instantânea, experiência fluida tipo YouGlish). Princípios que respeitam o que você pediu:

- **Não substitui nada:** Google Neural continua o TTS oficial; o vídeo é só contexto visual/auditivo do card.
- **Player descartável, dados soberanos:** o banco guarda só `video_id + start + end + texto + tradução + palavra` (as colunas `video_url`, `video_title` já existem em `words`; faltaria só `video_start`/`video_end`). O iframe nunca faz parte da regra de negócio.
- **Falha elegante:** vídeo removido/privado/sem embed → o card funciona 100% com palavra + Google Neural + frase + fonética + tradução; só o vídeo some.
- **Componente isolado e reutilizável** (`lf-video-context`), sem tocar no pipeline de áudio existente.

**Ressalvas técnicas honestas:** (a) na **extensão MV3**, o CSP proíbe scripts remotos — o iframe do YouTube funciona, mas a API JS precisa de cuidado; no **site (Vercel)** é tranquilo. (b) uma única instância global exige gerenciar o ciclo de vida (pause/seek ao trocar de card) — o mesmo cuidado que o YouGlish atual já pede (`pauseYouglish`). (c) captura de `start/end` precisa vir do momento em que a palavra é salva no vídeo (a extensão já sabe o timestamp). Recomendo prototipar **só no site primeiro**. (Roadmap, Etapa 7 — opcional/alto valor.)

---

## 12. 🗺️ Roadmap para o Fable 5 — em etapas, com critério de aceite

> Regras de ouro (herdadas do `PLANO_MESTRE_FABLE5.md`): não reescrever o que funciona (o FSRS do `db.js` e o `subtitle-engine.js` são sólidos — cirurgia, não marreta); não inventar colunas/APIs (conferir no Supabase via MCP antes); escritas nunca falham em silêncio; `node --check` nos JS antes de commit; testar o critério de aceite antes de fechar cada etapa.

**Ordem pensada por dependência e por "maior alívio de dor primeiro".**

### Etapa 0 — Fundação de segurança e banco (rápida, destrava o resto)
- Corrigir advisors: `search_path` fixo nas 6 funções; restringir `EXECUTE` das `SECURITY DEFINER` a `authenticated`; RLS com `(select auth.uid())`; índice em `cards(word_id)`; policy em `api_usage_log`; ligar proteção de senha vazada.
- Remover/*corrigir* a RPC morta `get_due_cards` (referencia colunas dropadas).
- **Aceite:** `get_advisors` sem WARN de segurança; nenhuma função pública executável por `anon`.

### Etapa 1 — Consertar o coração dos cards (a dor nº1)
- Implementar **fila de sessão** no `studyView`: cards com próximo intervalo < 1 dia (learning) voltam para a fila e reaparecem no tempo certo dentro da sessão; a tela "Sessão Concluída" só aparece quando não há mais nada vencido nem no curto prazo.
- Trocar os rótulos fixos dos botões por `predictNextInterval()` (mostrar o intervalo real de cada nota).
- **Aceite:** revisar um card novo com "Bom" e vê-lo voltar na mesma sessão; ao terminar, voltar ao Início e o card **não** reaparece imediatamente; os botões mostram o tempo real.

### Etapa 2 — Tirar o cache de tradução de dentro de `settings` (a lentidão)
- Criar tabela `translation_cache (user_id, source_lang, target_lang, source_text, translation)` OU mover o cache para IndexedDB/memória no cliente. Migrar/expurgar as ~3.180 linhas `trans_*` de `settings`.
- Fazer `setSetting` **parar de invalidar o cache do SRS** quando a chave for de tradução (ou eliminar a escrita em settings de vez).
- **Aceite:** `settings` volta a ~20 linhas; assistir vídeo não invalida mais o cache do SRS; leitura de config perceptivelmente mais rápida.

### Etapa 3 — Configurações que refletem de verdade
- Ligar os 4 controles "Nível Anki" às chaves que o motor realmente lê (`graduating_interval`, `initial_ease`, `leech_threshold`, `lapse_modifier`) — ou renomear no motor. Uma verdade só.
- Dar `id` + handler + persistência aos 5 fantasmas (novas/dia, revisões/dia, learning steps, áudio auto frente/verso). Fazer o **limite diário de cards novos** funcionar de verdade no `getCardsDue`.
- **Aceite:** mudar cada config e **observar o efeito** (ex.: baixar learning steps muda o agendamento; limite de 5 novos/dia entrega no máx 5 cards novos).

### Etapa 4 — O Learning Engine (a peça que falta)
- Criar uma RPC única `record_learning_event(type, payload)` + wrapper no cliente. Todo evento (review, sessão de vídeo, história lida, palavra salva, jogo) passa por ela e atualiza XP/streak/missões/LingQ de forma consistente. Unificar a streak numa fonte só. XP escalonado (bônus de primeira do dia, de streak, de dificuldade).
- **Aceite:** ganhar XP jogando o Match e lendo história; a streak conta dia de vídeo; sem XP paralelo divergente no `localStorage`.

### Etapa 5 — Gamificação com profundidade
- Jogo Match dá XP real e conta como micro-review. Ligas com `pg_cron` semanal (promoção/rebaixamento automático) — matar o botão "Simular". Missões adaptativas (dificuldade por histórico) + missão de reengajamento ("volte a estudar") + missões semanais + recompensa ao completar. Tela de estatísticas real (forecast, retenção, tempo).
- **Aceite:** semana vira e a liga promove sozinha; quem sumiu 2 dias recebe missão de volta; missões variam com o histórico.

### Etapa 6 — Reengajamento + teste de nível real
- Web Push no PWA + e-mail opcional (ofensiva em risco, "sentimos sua falta", resumo mensal).
- Reformular o placement: itens adaptativos, *cloze*/compreensão, bloco de listening (TTS já existe), cortes CEFR calibrados.
- **Aceite:** sumir 1 dia gera notificação de ofensiva; o teste mede mais que "conhece a palavra".

### Etapa 7 — Histórias nível LingQ + vídeo de contexto (alto valor)
- Corrigir o bug de salvar palavra da história (tradução real + `context_sentence`). Status por palavra (modelo `word_status`), contador de conhecidas, % da história, perguntas de compreensão, geração usando o vocabulário do aluno.
- Player YouTube único e global reutilizável como contexto do card (seção 11), com falha elegante. Prototipar no site.
- **Aceite:** ler história atualiza o contador de conhecidas; card com vídeo mostra o nativo falando no timestamp certo, e funciona igual se o vídeo sumir.

### Etapa 8 — Consolidar arquitetura (faxina final)
- Dashboard só no site; extensão só captura+revisão em contexto (decisão já tomada no plano mestre). Telemetria (Sentry). Onboarding de 1º acesso. Responsivo mobile do estudo.

---

## 13. Recomendações arquiteturais (o resumo para o dono)

1. **Uma fonte de verdade por conceito.** Streak, XP e "palavra conhecida" têm hoje mais de uma fonte. Escolha uma (o Postgres) e faça todo o resto derivar dela.
2. **Separe dado de config de dado de cache.** `settings` é sagrado (o motor depende); cache é descartável. Nunca no mesmo lugar.
3. **Todo evento de aprendizado passa por um só portão** (o Learning Engine). É isso que faz "tudo conversar", que era o pedido central.
4. **Nada na tela pode mentir.** Se o botão diz "3 dias", tem que ser 3 dias. Se diz "ganhou XP", tem que ganhar. Confiança é o ativo do app.
5. **Corrija a fundação antes de adicionar features.** Segurança, `settings`, fila de cards e configs reais (Etapas 0–3) valem mais que 10 telas novas — porque sustentam todas elas.

**Riscos se nada mudar:** o aluno perde a confiança (cards que voltam, botões que mentem), o sistema fica mais lento a cada vídeo assistido (settings crescendo), e a gamificação não segura ninguém (jogo/ligas/missões vazias). **Risco das mudanças:** a Etapa 1 mexe na fila de estudo (testar bem o encerramento de sessão) e a Etapa 2 migra dados de `settings` (fazer backup/expurgo com cuidado). O resto é aditivo e de baixo risco.

---

## Atualização Codex — preparação segura do P0.2b (estado antes do cutover, 2026-07-15)

**Responsável:** Codex, com revisão paralela de banco/Supabase, extensão/PWA e QA.

O P0.2b ainda **não foi aplicado no Supabase remoto**. A revisão adversarial
encontrou caminhos que precisavam ser fechados antes do revogue definitivo:

- removido `updateCard()` (PATCH arbitrário de cards) e adicionado tombstone
  explícito `LEGACY_CARD_WRITE_BLOCKED` no service worker;
- versão da extensão alinhada para `3.0.3`, tornando a atualização verificável;
- restauração de backup agora contabiliza separadamente falhas de palavras e
  de estados de card; a interface não anuncia mais sucesso falso;
- `restore_card_state` do contrato passa a aceitar somente card virgem, cria
  evento imutável `card_state_restored`, impede nova sobrescrita e nunca
  antecipa o primeiro vencimento restaurado para o mesmo dia;
- exclusão direta de `words` será revogada. `delete_word_safely` exclui somente
  palavra sem review; cards com histórico devem ser suspensos;
- migration ganhou preflight fail-closed: se o conjunto de policies remotas
  divergir do auditado, aborta em vez de apagar policy desconhecida;
- criado gate SQL comportamental `tests/db/card-permissions-p0-2b.sql`, cobrindo
  ACLs, RLS entre usuários, bloqueio de escrita direta e as RPCs estreitas.

**Evidência desta fatia:** contratos P0.2 de cliente/permissão aprovados,
JavaScript validado e `git diff --check` limpo. O replay SQL completo depende de
Postgres descartável; Docker/Supabase CLI não estão disponíveis nesta máquina.

**Próximo corte:** publicar/recarregar a extensão `3.0.3`, executar os cinco
smokes reais e então aplicar P0.2b, verificar grants/policies/advisors e observar
403/5xx. FSRS ainda recebe a proposta de estado do cliente e continua como P1.

**Publicação desta preparação:** commit `e357c7b`, preview
`dpl_Hn65eVsQcbq6ZwZUEiVvy9KhF1tK` e produção
`dpl_ATazDnkq1XPmNvkgx23cwGqDSWjM`, ambos `READY`. Produção serviu
`app.js?v=3.0.3`, sem overflow em 390 px e sem erros de runtime Vercel na janela
observada. O contrato P0.2b permaneceu deliberadamente sem aplicação remota.

---

## Atualização Codex — fechamento do cutover P0.2b (2026-07-15)

**Responsável:** Codex, com revisão independente de banco/Supabase e QA.

O contrato foi aplicado no projeto Supabase `qnutoswrufznztoznlql` como migration
remota `20260715165807` (`card_review_permissions_contract_p0_2b`), somente após
o dono recarregar a extensão `3.0.3` e aprovar os cinco fluxos reais: criar,
revisar, enterrar, suspender/reativar e restaurar backup.

**Estado comprovado depois da migration:**

- `cards` e `review_log`: somente `SELECT` para `authenticated`; nenhum grant
  para `anon`/`PUBLIC`;
- policies reconstruídas como `SELECT` owner-only com `(select auth.uid())`;
- as oito RPCs estreitas de card/review/delete executam para `authenticated` e
  não executam para `anon`/`PUBLIC`;
- `words.DELETE` direto foi removido; palavra revisada preserva o histórico;
- constraints de `learning_events` aceitam o evento não competitivo
  `card_state_restored` apenas com subject `card`;
- smoke transacional remoto, integralmente revertido com `ROLLBACK`, confirmou
  bloqueio de escrita direta e os caminhos create/review/bury/suspend/restore,
  backup e delete seguro sem deixar fixtures;
- na janela pós-corte consultada, logs API/Postgres tiveram zero erro 4xx/5xx,
  `permission denied`, `ERROR` ou `FATAL`.

Uma revisão adversarial encontrou ainda que `difficulty`, `stability` e
`pre_lapse_interval` aceitariam JSON `null` no restore. O Codex corrigiu isso de
forma append-only na migration `restore_card_state_numeric_types_p0_2b`, aplicada
remotamente no mesmo dia, e ampliou o gate para rejeitar `null` e string sem
alterar o card ou criar evento.

**Advisors:** permanecem somente avisos conhecidos/explicitados: `pg_net` em
`public`, proteção de senha vazada indisponível no plano atual e RPCs
`SECURITY DEFINER` intencionalmente expostas ao usuário autenticado, todas com
`auth.uid()`, checagem de propriedade, `search_path=''` e ACL explícita. Os
avisos de performance são informativos de índices ainda sem uso e não justificam
remoção sem janela de observação.

**Limite honesto:** o replay integral do histórico em Postgres descartável não
foi executado nesta máquina por falta de Supabase CLI/`psql`. Ele não foi marcado
como concluído; o smoke remoto com rollback é evidência complementar, não a mesma
coisa.

**Próximo corte técnico:** FSRS totalmente server-side, removendo a proposta de
estado calculada pelo cliente. Depois: identidades server-side verificáveis para
jogo/quiz/vídeo/quests e P0.3 do ledger anti-farm.

---

## Atualização Codex — correção visual Max/HBO sem tocar no engine (2026-07-15)

**Diagnóstico:** os controles existentes eram limitados explicitamente ao
YouTube; a Max usava distância inferior fixa em vez da timeline real; e popup e
legenda eram calculados em sistemas de coordenadas diferentes. O retângulo da
palavra clicada também era recebido, mas ignorado.

**Implementação:** o Codex criou uma camada visual isolada em
`content/max-player-ui.js`, com safe-area derivada dos controles/timeline, dock
Max e coordenação de normal/fullscreen/remount. O popup passou a compartilhar o
mesmo overlay, ancorar no termo clicado e reduzir sua altura com scroll para
nunca ocupar a legenda. A extensão foi versionada como `3.0.4`.

**Proteção solicitada pelo dono:** `content/subtitle-engine.js` e todo
`content/engine/*` permaneceram sem alteração. Nenhuma regra de captura,
sincronização, tradução ou mecânica foi modificada.

**Evidência:** testes geométricos cobrem 1280×720, 854×480, barra oculta, clamps
horizontal/vertical, popup alto, fullscreen/remount e contrato dos seis controles.
O smoke visual autenticado na HBO permanece pendente até a extensão ser
recarregada no Chrome do dono.

**Correção após QA real:** as imagens do dono na versão `3.0.4` provaram que o
dock horizontal concorria com a legenda e que o popup ainda caía no ramo
genérico. O Codex corrigiu a versão `3.0.5` com dock vertical à direita, posição
vertical Max fixa em `137px` e detecção do popup por retângulo visível, sem usar
`offsetParent`. O engine permaneceu novamente sem alterações.
# Execução Codex — P0-A Arquitetura de Informação e Hoje (2026-07-15)

**Responsável:** Codex, com revisão independente das frentes sêniores de produto/pedagogia, UX/arquitetura de informação e design de interação.
**Escopo:** primeiro corte da reforma integral de UX. O engine de revisão, FSRS, áudio, vídeo, persistência e RPCs não foi alterado.

## O que o Codex implementou

- A navegação principal passou de sete módulos concorrentes para quatro destinos pedagógicos: **Hoje, Aprender, Cofre e Progresso**.
- Foram criados os hubs `Aprender` e `Progresso`. Histórias, Leitor, Prática, Estatísticas e Ligas continuam existentes e acessíveis, mas agora estão subordinados à intenção do aluno.
- Configurações, tema e saída foram movidos para um menu de perfil acessível no desktop e no celular.
- Rotas antigas e cache de views foram preservados. Entrar em História, Leitor ou Prática mantém `Aprender` ativo; Estatísticas e Ligas mantêm `Progresso` ativo.
- O shell exclusivo do Estudo continua escondendo toda a navegação global e preserva progresso, menu e lifecycle existentes.
- A Home ganhou um resolvedor determinístico `chooseTodayAction()`. Revisões vencidas levam ao Estudo; fila vazia leva a conteúdo real e nunca abre uma sessão sem cards.
- O topo da Home agora possui uma única CTA, motivo e carga real. XP, ofensiva, forecast, missões, diagnóstico, conquistas e heatmap foram preservados dentro de divulgação progressiva.
- Não foi exibida duração estimada: ainda não existe medição confiável de tempo médio por revisão, portanto o produto não deve inventar a promessa.
- O cache do PWA foi versionado para o build web `3.0.4`.

## Contratos adicionados pelo Codex

- `tests/navigation-home-p0-a.test.mjs` cobre quatro destinos, hubs, rotas preservadas, menu de perfil, agrupamento ativo e sete estados do treinador diário.
- O gate `test:p0-a` foi incluído no `test:release`, junto do contrato do shell de foco.
- `tests/product-ux-stage4.test.mjs` deixou de exigir a navegação antiga e passou a exigir próxima ação antes das informações secundárias.

## Decisões que devem ser preservadas

1. Apenas uma ação primária aparece no primeiro bloco de Hoje.
2. Fila vazia nunca navega para Estudo.
3. XP, ofensiva e maturidade FSRS não são apresentados como domínio linguístico.
4. Nenhuma rota ou função foi removida; funções secundárias foram agrupadas.
5. O engine permanece congelado durante os cortes de UX.
6. Aprender e Progresso são hubs; suas telas filhas continuam podendo ser abertas diretamente.

## Estado e sequência

- Implementação registrada pelo Codex no commit `566bf1b` e publicada somente no branch `codex/review-mobile-video`.
- Preview Vercel `dpl_DwQechHca5i3N7uMuoQsRUmmVAyk` ficou `READY`: `https://linguaflow-hferjto3i-wesleys-projects-de111a83.vercel.app`.
- A raiz respondeu HTTP 200 servindo os quatro destinos e `app.js?v=3.0.4`; build sem erros e nenhum log de runtime `error`/`fatal` na janela consultada.
- QA estrutural local em desktop e 390 px confirmou ausência de overflow horizontal e troca correta entre navegação desktop/mobile.
- QA visual **autenticado** em 1440/1024/768/390/320 px permanece como gate antes de produção.
- **Próximo corte:** P0-B — substituir a gaveta plana `Explorar esta frase` pelo painel responsivo `Entender melhor`, organizado em Ouvir no contexto → Entender → Praticar → Mais contextos, sem alterar o player/engine.

---
# Execução Codex — P0-B Painel Entender melhor (2026-07-15)

**Responsável:** Codex, com especificação revisada pelas frentes sêniores de UX, design de interação, produto pedagógico e frontend.
**Regra:** engine, FSRS, máquina do player, bounds do vídeo, persistência e economia permaneceram intactos.

## O que o Codex implementou

- `Explorar esta frase` foi renomeado para **Entender melhor** e deixou de ser uma lista plana de ferramentas.
- Nova hierarquia: **Ouvir no contexto → Entender → Praticar → Mais exemplos e fontes**.
- O trecho original passou a ser o primeiro bloco quando existe vídeo. Replay, pausa, loop, mount e fallbacks anteriores foram preservados sem alteração do player.
- Palavra-alvo, tradução, pronúncia e mnemônico foram condensados em um resumo contextual.
- O tutor continua opt-in e sem chamadas automáticas, mas agora oferece três perguntas contextuais antes do campo livre.
- Chunks mostram no máximo dois blocos inicialmente; os demais ficam em `Ver mais`, preservando todos os dados e ações de áudio/download.
- YouGlish e Tatoeba foram movidos para `Mais exemplos e fontes` e continuam lazy/on-demand.
- Desfazer, editar/regenerar e deixar para amanhã foram removidos do conteúdo pedagógico e colocados no menu `⋯` do card.
- Desktop abre um painel lateral de até 440 px e desloca a área principal quando há espaço. Mobile abre bottom sheet acima dos botões de nota, mantendo-os visíveis.
- O build web/PWA passou para `3.0.5`.

## Contratos e evidência

- Novo gate `tests/understand-panel-p0-b.test.mjs`, incluído em `test:release`.
- O teste protege ordem pedagógica, separação das ações administrativas, prompts do tutor, limite inicial de chunks, painel responsivo e preservação dos IDs/player.
- Regressões já executadas: modo foco 14/14, vídeo 4/4 e áudio 8/8.
- Commit funcional `1401b46`; preview Vercel `dpl_3YRiNr7aTNXQXroE5YQP1kD7TtXv` ficou `READY` em `https://linguaflow-n7ynd84lp-wesleys-projects-de111a83.vercel.app`.
- A raiz respondeu HTTP 200, o build terminou sem erros e a consulta pós-deploy não encontrou logs `error`/`fatal`.

## Decisões que devem ser preservadas

1. O painel só aparece depois de revelar a resposta.
2. Avaliar continua sendo a decisão dominante; o painel é opcional.
3. No celular, o painel termina acima do dock de notas.
4. Tutor e fontes externas não carregam antes da intenção do aluno.
5. Ações administrativas nunca voltam a competir com Ouvir/Entender/Praticar.
6. Qualquer mudança futura no layout deve preservar `saved-video-context`, `study-yt-mount` e a máquina única do player.

## Próximo corte

P0-C — nomenclatura única (`frase salva`, `palavra-alvo`, `card` técnico), estados globais de carregamento/vazio/erro/retry e componentes compartilhados entre Cofre, Histórias e Leitor.

---

# Execução Codex — P0-C Linguagem pedagógica e estados globais (2026-07-15)

**Responsável:** Codex, coordenando revisões independentes de produto/pedagogia,
UX/arquitetura de informação e design/frontend. **Escopo protegido:** nenhuma
alteração em engine, FSRS, player, áudio, RPC, migration ou economia.

## O que o Codex implementou

- Criou `dashboard/js/ui/viewState.js`, contrato compartilhado e acessível para
  loading, vazio e erro, com `role`, `aria-live`, ação única e HTML escapado.
- Hoje, Cofre, Progresso, Leitor, Histórias e Prática passaram a usar estados
  consistentes, altura estável e retry local onde existe leitura remota.
- Histórias não converte mais falha do Supabase em “nenhuma história”: sem
  fallback local mostra erro/retry; com fallback mostra os dados do dispositivo
  e avisa que a sincronização está indisponível.
- Os três modos de Prática agora capturam rejeição de consulta. O usuário não
  fica preso em loading e pode tentar novamente com segurança.
- O vocabulário principal passou a distinguir frase/contexto, expressão-alvo,
  item de revisão e estado da memória. `card`, `mature`, `leech` e FSRS ficam
  restritos ao contexto técnico/avançado.
- Home deixou de chamar estado FSRS de conhecimento: exibe “memória estável” e
  “itens familiares”; “palavras fracas” virou “termos para reforçar”.
- Progresso usa “expressões na memória” e “estado da memória”; zero dados ganha
  próximo passo real em vez de quatro gráficos vazios.
- Leitor diferencia seus “textos” do Cofre e explica que salvar adiciona à
  revisão. Prática diferencia treino livre de revisão agendada.
- Web/PWA versionado como `3.0.6`.

## Contratos e validação

- Novo gate `tests/product-language-state-p0-c.test.mjs`, incluído em
  `test:release`, protege semântica, escaping, retries e microcopy proibida.
- Testes legados de design system e produto foram atualizados para validar o
  contrato compartilhado, em vez de depender de markup literal incidental.
- `npm run test:release -- --allow-dirty`, `npm run test:design-system` e
  `npm run test:product-ux` passaram localmente.
- Commit funcional `dab4da7`; preview Vercel
  `dpl_HCzxdDNFChuezeadpP5oZzEK7Zau` ficou `READY` em
  `https://linguaflow-jdm5nae3k-wesleys-projects-de111a83.vercel.app`.
- A raiz respondeu HTTP 200 com `app.js?v=3.0.6`; build sem erros e nenhum log
  de runtime `error`/`fatal` na janela consultada.

## Decisões que devem ser preservadas

1. Falha de leitura nunca pode aparecer como coleção vazia.
2. Prática livre não atualiza FSRS, XP, ofensiva ou liga.
3. “Aprendido/dominado” não pode ser inferido de salvar, acertar uma vez ou
   atingir estado `mature`.
4. Toda tela bloqueada por erro remoto oferece retry local; nenhum retry entra
   em loop automático.
5. Estados operacionais de player, geração e salvamento continuam locais; o
   helper é apenas para página/região sem conteúdo utilizável.

## Próxima sequência

P1-A — reforma do Cofre e Configurações; depois unificação Histórias/Leitor,
onboarding, Prática/Progresso e QA autenticado antes da decisão de produção.

---

# Execução Codex — P1-A Cofre e Configurações (2026-07-15)

**Responsável:** Codex, após revisão sênior independente de UX/IA, produto
pedagógico e frontend/acessibilidade. Engine, FSRS, writers, player e banco não
foram alterados.

## Cofre

- O card virou um `article` escaneável: estado real, frase de contexto como
  informação principal, expressão-alvo, tradução, origem/vídeo e ações.
- O badge deixou de inferir memória por `w.reps`; usa `card.status`, `due_date`
  e `suspended`: Nova, Começando, Consolidando, Memória estável, Revisar hoje e
  Revisões pausadas.
- Conteúdo salvo (`word`, tradução, contexto e busca) agora é escapado antes de
  entrar no HTML, fechando a injeção encontrada na auditoria.
- Categorias, estados e A–Z expõem `aria-pressed`; card pausado continua legível
  e é diferenciado por borda, não por opacidade extrema.
- Empty real leva a Aprender; empty filtrado limpa os filtros. Editar,
  pausar/retomar, excluir, revisão por categoria e vídeo foram preservados.
- Confirmações e toasts passaram a falar em frase/revisões, não em entidades de
  banco.

## Configurações

- Corrigido risco funcional: falha em `getSettings()` não vira mais defaults
  editáveis que poderiam sobrescrever preferências reais. Agora há erro
  bloqueante e retry, sem montar o formulário.
- `new_per_day` ficou coerente com o limite server-side: default inicial 5,
  máximo visível 20; valores antigos acima do teto são limitados na UI.
- CEFR é apresentado como estimativa, B2/C2 deixaram de prometer fluência ou
  maestria, e o teste explica seus limites.
- Retenção de 90% é ponto inicial recomendado, não “equilíbrio ideal”. Leech,
  passos e ações ganharam linguagem compreensível sem renomear nenhuma chave.
- O botão agora diz `Salvar configurações`; todas as chaves e IDs consumidos
  pelo motor foram preservados.

## Gates

- Novo `tests/cofre-settings-p1-a.test.mjs` dentro de `test:release` cobre
  escaping, hierarquia, status real, ações, falha segura de Settings e cap 20.
- `test:p1-a`, `test:product-ux`, `test:design-system`, `test:p0-c` e a suíte de
  release completa passaram com árvore suja permitida.
- Build web/PWA: `3.0.7`.
- Commit funcional `28a64a8`; preview Vercel
  `dpl_5VjfRUnCWukiL6kew9ubZpQqQnvS` ficou `READY` em
  `https://linguaflow-c543kzmik-wesleys-projects-de111a83.vercel.app`.
- A raiz respondeu HTTP 200; build sem erros e nenhum runtime `error`/`fatal`
  na janela consultada.

## Próximo corte

P1-B — Histórias e Leitor como duas entradas de uma única experiência de
leitura contextual, sem remover geração, importação, áudio, quiz ou salvamento.

---

# Execução Codex — P1-B Experiência unificada de leitura (2026-07-15)

**Responsável:** Codex. Engine, geração, importação, TTS, quiz, marcação,
salvamento no Cofre e persistência permaneceram funcionais e sem mudança de
contrato.

## Implementado

- Criado `readingHub.js`: Histórias e Leitor compartilham o mesmo cabeçalho,
  promessa e seletor acessível `Histórias guiadas | Meus textos`.
- A troca entre as duas fontes acontece dentro da experiência de leitura, sem
  obrigar o aluno a voltar ao hub Aprender.
- As instruções extensas do Leitor viraram ajuda recolhida; importar/salvar um
  texto passou a ser a ação dominante da tela.
- `loadStatusSets()` agora informa sucesso/falha. Em falha, o texto permanece
  utilizável, a interface avisa que as cores podem estar incompletas e oferece
  retry; não apresenta progresso desconhecido como zero.
- Histórias mostra `Familiaridade estimada`, explicando que mistura marcações do
  aluno e memória estável e não mede compreensão.
- A promessa “reencontrar fixa” foi removida; o texto orienta tentativa de
  lembrança antes de tocar. Loading de geração deixou de expor “a IA”.
- Build web/PWA `3.0.8`.

## Gates

- Novo `tests/reading-experience-p1-b.test.mjs` dentro de `test:release`.
- `test:p1-b`, `test:web-reader`, produto UX, design system e release completo
  passaram.
- Commit funcional `768221e`; preview Vercel
  `dpl_3Fv2Y53ntRFEepgE5bs784x51i9i` ficou `READY` em
  `https://linguaflow-ipcg8n8kn-wesleys-projects-de111a83.vercel.app`.

## Próximo corte

P1-C — onboarding progressivo: objetivo, nível aproximado, carga inicial segura
e primeira experiência real, sem prometer fluência ou forçar configuração SRS.

---

# Execução Codex — P1-C Onboarding seguro (2026-07-15)

**Responsável:** Codex. O teste de nivelamento e o agendador não foram
modificados; apenas apresentação e confirmação da configuração inicial.

- Nível virou “ponto de partida aproximado”; o teste curto é chamado de
  estimativa e não de medição CEFR real.
- Carga inicial mostra Leve/Regular/Intensa, explicitando revisões/dia e o teto
  correspondente de 5/10/20 novas expressões.
- A confirmação final explica exatamente o que será configurado e mantém a
  primeira ação real: começar por uma história e salvar uma expressão.
- Corrigida race de persistência: CEFR e `new_per_day` eram disparados sem
  `await`, enquanto o onboarding já ficava concluído. Agora todas as
  preferências são confirmadas primeiro; só então `onboarding_v1` é marcado e
  a navegação acontece. Falha mantém o usuário no passo final com retry.
- Build `3.0.9`; novo gate `tests/onboarding-p1-c.test.mjs` dentro do release.
- `test:p1-c`, `test:p0-a` e release completo passaram.
- Commit funcional `285d6a3`; preview Vercel
  `dpl_7Rmw53ngcTQBekdVrWn9ftR7eJT1` ficou `READY` em
  `https://linguaflow-nebgifb96-wesleys-projects-de111a83.vercel.app`.

**Próximo:** P1-D — separar Prática de Progresso, explicar o que cada atividade
mede e tornar retenção/carga as métricas principais.

---

# Execução Codex — P1-D Prática e Progresso com papéis claros (2026-07-15)

**Responsável:** Codex, com revisão pedagógica sênior independente. Engine,
FSRS, economia, writers, player, áudio, Supabase e regras da Liga não foram
alterados.

## Implementado

- A entrada de Prática agora apresenta cada modo como treino de uma habilidade:
  Reconhecimento, Escuta ou Produção guiada, com descrição curta do exercício.
- A interface declara antes da escolha que a rodada é prática livre: resultado
  local, sem alterar agendamento, XP, ofensiva ou liga. O comentário legado que
  dizia que o combo aumentava XP também foi corrigido; combo continua apenas
  como feedback visual.
- Corrigida contaminação cognitiva encontrada na revisão sênior: os três modos
  deixaram de usar prioritariamente expressões vencidas. A seleção exclui a fila
  devida, evitando ensaio imediato antes da revisão SRS.
- Progresso diferencia visualmente a rota principal de memória da Liga
  opcional. A ação de retenção/carga é primária; competição permanece acessível,
  mas secundária.
- Estatísticas passou a abrir por retenção nas revisões, agenda futura e estado
  da memória. Minutos e volume são identificados como atividade, não como prova
  de domínio; o gráfico de tempo ficou em detalhe expansível.
- Métricas passaram a dizer “lembradas pelas suas notas” e “expressões na
  revisão”, sem tratar presença no banco como memória nem autoavaliação como
  teste objetivo. A Liga explica que XP agrega atividades e não mede domínio.
- Nenhuma função foi removida e IDs/handlers dos três modos foram preservados.
- Build web/PWA `3.0.10`.

## Gates

- Novo `tests/practice-progress-p1-d.test.mjs` dentro de `test:release` cobre
  habilidades, não-farming, prioridade das métricas e Liga opcional.
- `test:p1-d`, contrato pedagógico, sintaxe e release completo passaram.
- Commit funcional `c7f0c4a`; preview Vercel
  `dpl_6WeDKTx9Di6K3yUqPsR6YBo7ATAD` ficou `READY` em
  `https://linguaflow-aee5u6518-wesleys-projects-de111a83.vercel.app`.
- A raiz respondeu HTTP 200 com `app.js?v=3.0.10`; build concluiu sem erros e
  não houve runtime `error`/`fatal` na janela consultada.

## Próximo corte

QA autenticado desktop/mobile dos cortes P0-A a P1-D; corrigir qualquer falha
observada e só então decidir promoção para produção.

---

# Execução Codex — P0.3 Hardening de produção (2026-07-16)

**Responsável:** Codex, coordenando revisões independentes sênior de UX/QA,
pedagogia/economia e Infra/Supabase. A engine de legendas/vídeo e o algoritmo
FSRS não foram alterados.

## Por que este corte foi aberto

A revisão pré-produção recusou o candidato 3.0.10 por quatro problemas que os
checklists anteriores não detectavam: falha de banco na revisão aparecia como
“Tudo feito”; rotas privadas não tinham uma guarda central de sessão; duas RPCs
legadas aceitavam XP declarado pelo navegador; e a policy pública de
`user_stats` expunha a linha inteira de todos os participantes e ainda permitia
`INSERT` próprio com projeção arbitrária.

## Implementado pelo Codex

- Build web/PWA elevado para `3.0.11`, incluindo rotas diretas `/learn` e
  `/progress` nos rewrites da Vercel.
- Guarda central de autenticação: shell desktop/mobile fica oculto durante a
  validação e no login; rota privada sem sessão volta para login; expiração e
  logout atualizam o estado antes da navegação.
- Cadastro com confirmação de e-mail não entra na Home sem uma sessão real;
  permanece na autenticação e explica a próxima ação.
- Rejeição assíncrona de qualquer view troca loading por erro com retry. Na
  revisão, falha de fila/contagens/SRS não pode mais virar “Tudo feito”.
- Listeners globais do Leitor e Histórias agora são abortados ao redesenhar ou
  sair; popup do Leitor é limitado à viewport e prefere ficar acima quando não
  cabe abaixo.
- Home sinaliza dados complementares indisponíveis em vez de apresentar zeros
  silenciosos; CEFR só confirma depois de persistir os dois espelhos usados por
  dashboard e extensão.
- Reforço de palavras fracas usa somente cards fracos já vencidos. Prática
  consulta todos os cards e exclui toda a fila vencida, sem o antigo teto de
  500 que podia contaminar uma revisão grande.
- Histórias, quiz e duração de vídeo deixaram de conceder XP competitivo porque
  são fatos declarados pelo cliente. Apenas reviews qualificados pelo writer
  atômico continuam alimentando a economia competitiva.
- Liga deixou de mostrar uma zona de rebaixamento incompatível com a regra do
  banco. Promessas de fluência/fixação e familiaridade `0%` em falha foram
  substituídas por estados observáveis.
- Cliente do placar foi trocado para `rpc/get_leaderboard`; o retorno usa
  `is_current_user` e não expõe UUID.
- Duas migrations forward-only compatíveis foram preparadas. A etapa expand
  `20260716124439_expand_safe_leaderboard_p0_3.sql` cria primeiro o leaderboard
  mínimo sem UUID, timezone, datas, e-mail ou contadores privados. A etapa
  contract `20260716124440_contract_user_stats_and_legacy_xp_p0_3.sql` revoga
  `record_learning_event` e `claim_weekly_quest`, remove leitura global/escrita
  direta de `user_stats` e mantém leitura somente da própria linha.

## Gates executadas

- `npm run test:release -- --allow-dirty`: aprovado em 2026-07-16.
- A gate agora inclui engine, calendário local, concorrência de áudio, YouTube,
  vídeo, race do estudo, isolamento de domínio, Web Reader, lifecycle de
  legendas, HBO/Max, fundação de evidência, economia, autenticação/UX e P0.3.
- 55 arquivos JavaScript passaram no parser e `git diff --check` passou.
- Novos contratos: `auth-ux-resilience-p0-p1`,
  `pedagogy-production-cut` e `user-stats-security-p0-3`.
- Replay local SQL não foi executado porque Docker/Supabase CLI não estão
  disponíveis nesta máquina.
- Commit funcional `0a8688a`; PR GitHub `#8` aberto como draft. Preview Vercel
  `dpl_9rHjmtmYqizxsEC8YPckb5dmFW1A` ficou `READY` em
  `https://linguaflow-dn4mg4a2m-wesleys-projects-de111a83.vercel.app`, raiz
  HTTP 200, build sem erros e nenhum runtime error observado.
- Etapa expand aplicada no Supabase como migration remota
  `20260716160424_expand_safe_leaderboard_p0_3`. Verificação pós-DDL confirmou
  `SECURITY DEFINER`, `search_path` vazio, EXECUTE para `authenticated` e
  ausência de EXECUTE para `anon`. Policies antigas permanecem de propósito
  até o contract; o site de produção não foi quebrado.
- Etapa contract **não aplicada**: ela continua bloqueada até o dashboard
  3.0.11 ser promovido e validado.

## Estado e ordem obrigatória de rollout

O código está apto a seguir para preview, mas ainda é **NO-GO para produção**
até cumprir, nesta ordem:

1. PR com workflow GitHub `verify` verde;
2. validar o placar no preview com a etapa expand já aplicada;
3. QA autenticado desktop/mobile/extensão no preview;
4. integrar/promover o mesmo SHA aprovado;
5. aplicar imediatamente a etapa contract e fazer smoke do placar/revisão;
6. executar smoke final de produção. Nunca usar `supabase db push`, pois os
   timestamps do histórico remoto anterior não correspondem aos nomes locais.

Rollback web preservado: produção anterior `ca9fbc9` /
`dpl_8eLCZupbmkBtAvGJVeYaLytSRghw`. A migration é forward-only; em incidente,
o caminho seguro é corrigir por nova migration, não reescrever histórico.

---
