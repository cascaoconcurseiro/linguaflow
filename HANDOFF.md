## Issue #183 — FinOps & Cache Léxico Canônico — Fase 1 (2026-09-26)

- **PR:** vinculada à Issue [#183](https://github.com/cascaoconcurseiro/linguaflow/issues/183), branch `codex/183-canonical-lexicon-cache`.
- **Issue:** [#183](https://github.com/cascaoconcurseiro/linguaflow/issues/183).
- **Feito:**
  - **Tabela `public.canonical_lexicon` & RPC**: Criada migration `supabase/migrations/20260926120000_canonical_lexicon_cache.sql` com índice único `(lower(trim(word)), lang)` e RPC `get_or_cache_canonical_lexicon` com merge seguro de contextos em JSONB, RLS ativo e permissões revogadas para anon.
  - **Database Client**: Implementados `db.getCanonicalLexicon(word, lang)` e `db.saveCanonicalLexicon(entry)` em `utils/db.js` com cache LRU em memória e suporte transparente a proxy no service worker.
  - **Proxy no Service Worker**: Adicionados `getCanonicalLexicon` e `saveCanonicalLexicon` ao Set `DB_PROXY_METHODS` em `background/service-worker.js`.
  - **Enriquecimento com Bypass Inteligente**: Atualizado `enrichCard` em `dashboard/js/core/ai.js` para consultar o cache canônico antes de chamar a Edge Function / LLM e persistir novos enriquecimentos no banco.
  - **Contratos e Testes**: Criada suíte `tests/canonical-lexicon-cache.test.mjs` integrada no script `npm run test:ai-routing`.
- **Validação:**
  - `npm run test:ai-routing` verde (100% dos contratos de IA e cache canônico aprovados).
  - `npm run test:contextual-translation` verde.
  - `npm run lint:biome` verde.
  - `node tests/release-smoke.mjs` verde.

## Issue #181 — Correções sistêmicas pós-auditoria — FSRS stability, undo quota, PWA shell e telemetria (2026-09-26)

- **PR:** vinculada à Issue [#181](https://github.com/cascaoconcurseiro/linguaflow/issues/181), branch `codex/181-audit-systemic-fixes`.
- **Issue:** [#181](https://github.com/cascaoconcurseiro/linguaflow/issues/181).
- **Feito:**
  - **FSRS & Divisão por Zero (AUD-01)**: Criada migration `supabase/migrations/20260926110000_fsrs_stability_guard_and_undo_quota.sql` que normaliza valores de estabilidade nulos ou zero (`stability = 0`) para `greatest(0.1, coalesce(nullif(v_card.stability, 0), ...))` na RPC `record_card_review`, impedindo erro de runtime `SQLSTATE 22012 (division_by_zero)`.
  - **Alinhamento de Quota Diária com Undo (AUD-02)**: Atualizada a lógica de limites diários da RPC `record_card_review` para desconsiderar revisões que constam em `public.card_review_undos` tanto em `v_new_today` quanto em `v_review_today`. Atualizado `getTodayCounts()` em `utils/db.js` para filtrar revisões desfeitas via `card_review_undos`.
  - **PWA Offline Shell (AUD-03)**: Adicionado `/js/core/app.js?v=3.0.58` ao array `APP_SHELL` em `dashboard/sw.js` para assegurar que o script de entrada do app esteja em cache no primeiro boot offline.
  - **YouTube Hook: Respostas de Erro (AUD-05)**: Atualizados os interceptores `fetch` e `XHR` em `content/youtube-hook.js` para checar `response.ok` e `status < 300` antes de notificar o motor de legendas, evitando que páginas HTML de erro 403/404/429 poluam o estado de legendas.
  - **Higienização de Telemetria OTLP (AUD-06)**: Adicionado `redactSensitive` em `utils/observability.js` mascarando chaves (`apikey`, `token`, `Bearer`) em mensagens e stack traces exportados.
  - **Contratos e Testes**: Criada suíte `tests/review-fsrs-stability-and-undo-quota.test.mjs` integrada no script `npm run test:review-economy`.
- **Validação:**
  - `npm run test:pedagogy` e `npm run test:review-economy` verdes.
  - `npm run test:observability` verde.
  - `npm run test:web-reader`, `npm run test:subtitle-lifecycle`, `npm run test:words-explorer` e `npm run test:translation-quality` verdes.
  - `npm run lint:biome` verde (42 arquivos analisados sem erros).
  - `node tests/release-smoke.mjs` verde.

## Issue #179 — Modularização linguística de content/word-popup.js — Fase 5 (2026-09-25)

- **PR:** vinculada à Issue [#179](https://github.com/cascaoconcurseiro/linguaflow/issues/179), branch `codex/179-modular-word-popup`.
- **Issue:** [#179](https://github.com/cascaoconcurseiro/linguaflow/issues/179).
- **Feito:**
  - Extraído `content/popup/popup-linguistics.js`: isola o catálogo curado de falsos amigos (`FALSE_FRIENDS`), conjuntos de expressões e colocações comuns (`COMMON_IDIOMS`, `COMMON_CHUNKS`), mapeador de classes gramaticais (`getPosLabel`, `getPosDetail`, `getPosPatterns`), detector de tipo de expressão com suporte a lematização e partículas (`detectExprType`), detecção de falsos amigos (`detectFalseFriend`) e normalizador textual (`cleanContextExplanation`).
  - Refatorado `content/word-popup.js`: importa os helpers linguísticos e delega as chamadas nos métodos `_initData()`, `_detectExprType()`, `_detectFalseFriend()`, `_posLabel()`, `_posDetail()` e `_patterns()`, mantendo 100% de retrocompatibilidade com a API de `WordPopup` e todos os testes existentes.
  - Declarado `content/popup/popup-linguistics.js` no `manifest.json` sob `web_accessible_resources` para que os content scripts possam importá-lo no contexto dos players de vídeo.
  - Criada nova suíte de testes de contrato em `tests/modular-popup-linguistics-contract.test.mjs` (5/5 testes verdes) e integrada no comando `npm run test:words-explorer`.
- **Validação:**
  - `npm run test:word-popup-hover` e `npm run test:words-explorer` 100% verdes.
  - `node --test tests/caption-popup-startup.test.mjs` verde (3/3 testes, validando que todas as dependências estáticas do popup estão expostas no manifest).
  - `npm run test:max-ui` e `npm run test:subtitle-lifecycle` verdes.
  - `npm run test:e2e` (Playwright) verde (3/3 cenários).
  - `npm run lint:biome` verde (42 arquivos analisados sem erros).
  - `node tests/release-smoke.mjs --allow-dirty` verde.

## Issue #177 — Decomposição modular de background/service-worker.js — Fase 4 (2026-09-25)

- **PR:** vinculada à Issue [#177](https://github.com/cascaoconcurseiro/linguaflow/issues/177), branch `codex/177-modular-service-worker`.
- **Issue:** [#177](https://github.com/cascaoconcurseiro/linguaflow/issues/177).
- **Feito:**
  - Extraído `background/cache-cleaner.js`: rotinas de garbage collection de entradas voláteis sob risco de QuotaExceeded (`evictDisposableCache`), rotina de sweep de itens expirados (>3 dias) ou excedentes de limites (`sweepStaleCache`), e limpeza de fragmentos corrompidos do Linguee (`clearBadLingueeCache`).
  - Extraído `background/ai-generator.js`: geração de frases de exemplo com tradução em português (`generateSentenceWithAI`), extração de até 8 palavras fracas e em aprendizado recente para reencontro pedagógico (`getReencounterWordsSW`), geração estruturada de histórias CEFR com diálogos realistas (`generateStoryWithAI`), geração de 3 variações da frase com o mesmo padrão gramatical (`generateAIVariation`), e backfill assíncrono em fila com rate limit de 6s para preencher frases e chunks faltantes no cofre (`backfillMissingSentences`).
  - Refatorado `background/service-worker.js`: importa os novos submódulos, delega as chamadas correspondentes, mantém reexportações e assinaturas intactas, garantindo 100% de compatibilidade com todos os testes e callers existentes.
  - Criada nova suíte de testes de contrato em `tests/modular-service-worker-contract.test.mjs` (5/5 testes verdes) e adicionada ao script `test:ai-routing` em `package.json`.
  - Validado que o script de empacotamento (`npm run build:extension`) rastreia e inclui automaticamente as dependências privadas no artefato de release sem expô-las em `web_accessible_resources`.
- **Validação:**
  - `npm run test:ai-routing` (10 contratos DeepSeek + dicionário + fallbacks + 5 testes do novo contrato verdes).
  - `npm run test:e2e` (Playwright) verde (3/3 testes).
  - `npm run build:extension` verde (45 arquivos empacotados no ZIP de release).
  - `npm run lint:biome` verde (42 arquivos analisados sem erros).
  - `node tests/release-smoke.mjs --allow-dirty` verde.

## Issue #175 — Modularização do motor de legendas content/subtitle-engine.js — Fase 3 (2026-09-25)

- **PR:** vinculada à Issue [#175](https://github.com/cascaoconcurseiro/linguaflow/issues/175), branch `codex/175-modular-subtitle-engine`.
- **Issue:** [#175](https://github.com/cascaoconcurseiro/linguaflow/issues/175).
- **Feito:**
  - Extraído `content/subtitles/bridge-security.js`: validação de mensagens vindas da bridge web accessible (`isTrustedSubtitleBridgeMessage`), constantes de segurança e restrições de origem.
  - Extraído `content/subtitles/dock-layout.js`: cálculo responsivo de classes do dock (`computeDockResponsiveClass`) e aplicação com memoização no DOM (`applyDockResponsiveClass`).
  - Extraído `content/subtitles/player-hotkeys.js`: manipulador unificado de atalhos de teclado do player com suporte a `AbortSignal` (`setupPlayerHotkeys`).
  - Extraído `content/subtitles/vtt-parser.js`: analisador e normalizador resiliente de WebVTT (`parseVTT`) com suporte a tags de estilo, timecodes com vírgula/ponto e cues multilinha.
  - Refatorado `content/subtitle-engine.js`: importa os novos submódulos, delega a execução interna dos métodos correspondentes e reexporta as funções públicas (`isTrustedSubtitleBridgeMessage`, `computeDockResponsiveClass`, `applyDockResponsiveClass`) preservando 100% de compatibilidade para todos os testes e callers.
  - Declarados os 4 novos submódulos em `manifest.json` sob `web_accessible_resources`.
  - Criada suíte de testes de contrato em `tests/modular-subtitles-contract.test.mjs` (4/4 testes verdes) e integrada no comando `npm run test:subtitle-lifecycle`.
- **Validação:**
  - `npm run test:subtitle-lifecycle` (26/26 testes verdes).
  - `npm run test:max-ui` verde.
  - `npm run test:e2e` (Playwright) verde (3/3 testes).
  - `npm run lint:biome` verde (42 arquivos analisados sem erros).
  - `node tests/release-smoke.mjs --allow-dirty` verde.

## Issue #173 — Modularização interna do serviço de banco de dados utils/db.js — Fase 2 (2026-09-25)

- **PR:** vinculada à Issue [#173](https://github.com/cascaoconcurseiro/linguaflow/issues/173), branch `codex/173-modular-database-service`.
- **Issue:** [#173](https://github.com/cascaoconcurseiro/linguaflow/issues/173).
- **Feito:**
  - Extraído o repositório `ReaderStoriesRepository` em `utils/db/reader-stories-repo.js`: centraliza persistência de histórias geradas, catálogo, cache SWR de 30s com refresh assíncrono, exclusão segura por UUID, arquivamento e gestão dos textos do Web Reader (`getReaderTexts`, `saveReaderText`, `migrateReaderText`, `deleteReaderText`, `updateReaderProgress`).
  - Extraído o repositório `GamificationRepository` em `utils/db/gamification-repo.js`: centraliza estatísticas do usuário (`getUserStats`), telemetria sem PII (`reportClientError`), ranking seguro de ligas (`getLeaderboard`), bootstrap atômico e sincronização de fuso horário com lock de promise (`ensureUserStats`), rollover semanal (`maybeLeagueRollover`), Web Push (`getPushPublicKey`, `savePushSubscription`, `deletePushSubscription`), opt-in de e-mail (`setEmailOptIn`) e conquistas (`saveAchievement`, `getUserAchievements`).
  - Aplicado padrão **Facade** na classe `Database` (`utils/db.js`): instancia ambos os repositórios no construtor e delega todas as operações mantendo as assinaturas e JSDoc intactos, garantindo 100% de retrocompatibilidade com todos os 50+ módulos e suítes de teste.
  - Atualizado `manifest.json` para expor `utils/db/reader-stories-repo.js` e `utils/db/gamification-repo.js` no `web_accessible_resources` da extensão MV3.
  - Atualizados testes contratuais e estruturais para refletir a nova organização modular dos arquivos de banco.
  - Criada nova suíte de testes de contrato em `tests/modular-database-facade-contract.test.mjs` validando delegações em proxy mode, isolamento de repositórios e a interface da Facade (3/3 testes verdes).
- **Validação:**
  - `npm run test:web-reader` e `tests/modular-database-facade-contract.test.mjs` verdes.
  - `npm run test:e2e` (Playwright) 100% verde (3/3 cenários passando).
  - `npm run lint:biome` verde (42 arquivos analisados sem erros).
  - `node tests/release-smoke.mjs --allow-dirty` verde.

## Issue #171 — Decomposição modular de Configurações e Histórias — Fase 1 (2026-09-25)

- **PR:** vinculada à Issue [#171](https://github.com/cascaoconcurseiro/linguaflow/issues/171), branch `codex/171-modular-settings-and-stories`.
- **Issue:** [#171](https://github.com/cascaoconcurseiro/linguaflow/issues/171).
- **Feito:**
  - Extraído o modal de nivelamento CEFR em 4 fases de `dashboard/js/ui/settingsView.js` para `dashboard/js/ui/cefrPlacementTest.js`, reduzindo `settingsView.js` em 267 linhas mantendo reexportação para retrocompatibilidade com `homeView.js`.
  - Extraído o quiz de compreensão LingQ-style de `dashboard/js/ui/storiesView.js` para `dashboard/js/ui/storiesQuiz.js`, reduzindo `storiesView.js` em 139 linhas.
  - Criada suíte de testes de contrato unitário em `tests/stories-quiz-contract.test.mjs` validando `normalizeQuiz`, `generateStoryQuiz` e a exportação de `runPlacementTest`.
  - Atualizado `tests/cofre-settings-p1-a.test.mjs` para checar `cefrPlacementTest.js` e adicionada execução de `stories-quiz-contract.test.mjs` em `package.json`.
- **Validação:**
  - `npm run test:p1-a` e `npm run test:p1-b` verdes.
  - `npm run test:e2e` (3/3 testes verdes).
  - `npm run lint:biome` (40 arquivos verdes).
  - `node tests/release-smoke.mjs` verde.

## Issue #169 — Progresso persistido no Reader, unificação de release e expansão de lint (2026-09-25)

- **PR:** vinculada à Issue [#169](https://github.com/cascaoconcurseiro/linguaflow/issues/169), branch `codex/169-reader-progress`.
- **Issue:** [#169](https://github.com/cascaoconcurseiro/linguaflow/issues/169).
- **Feito:**
  - Persistência de progresso de leitura conectada na UI do Reader (`readerView.js`):
    - Estante exibe badges de `✓ Lido` ou `${pct}% lido`.
    - Leitor rastreia rolagem com debounce seguro e chama `db.updateReaderProgress(id, { lastReadPosition, readingPercentage, isCompleted })`.
    - Botão no cabeçalho do leitor permite alternar manualmente entre concluído e em andamento.
    - Posição anterior de leitura é restaurada suavemente ao abrir texto em andamento.
  - `utils/db.js`: `getReaderTexts` agora inclui `last_read_position, reading_percentage, is_completed` na query REST do Supabase.
  - `background/service-worker.js`: `'updateReaderProgress'` adicionado à allowlist do DB proxy.
  - Empacotamento unificado no `.github/workflows/release.yml` para usar `npm run build:extension` (37 arquivos curados).
  - Gate de lint expandido: `biome.json` e `npm run lint:biome` agora cobrem `scripts/`, `utils/`, `dashboard/js/core/` e `tests/` (40 arquivos analisados e verdes).
  - Jornada E2E do Reader adicionada com Playwright em `tests/e2e/reader-journey.spec.mjs` e fixture local `tests/fixtures/reader-preview.html`.
  - Documentação alinhada: versão v3.0.58 atualizada no `README.md`, referência de RPC corrigida de `submit_review_fsrs` para `record_card_review` em `README.md` e `docs/ARQUITETURA.md`.
  - Resolução da sobreposição de PRs: PR #166 (Issue #165) e PR #168 (Issue #167) foram desacopladas com rebase limpo, validadas com CI verde e mescladas em `main`.
- **Validação:**
  - `npm run test:web-reader` e `tests/reader-progress-contract.test.mjs` verdes.
  - `npm run test:e2e` (3 cenários de navegador no Playwright verdes).
  - `npm run lint:biome` (40 arquivos de produção e testes verdes).
  - `npm run build:extension` (pacote de produção curado com 37 arquivos).
  - Release smoke determinístico e suíte funcional completos.

## Issue #167 — Inicialização imediata do player da extensão (2026-09-25)

- **PR:** [#168](https://github.com/cascaoconcurseiro/linguaflow/pull/168) (mesclada em `main`).
- **Issue:** [#167](https://github.com/cascaoconcurseiro/linguaflow/issues/167).
- **Diagnóstico:** `SubtitleEngine.init()` aguardava `_injectSubtitleUI()`, enquanto `_createSubtitleUI()` esperava import/leitura de settings e até cinco retries de 1, 2, 3, 4 e 5 segundos para encontrar o player. O `_waitForVideo()` ainda usava polling de 800ms.
- **Feito:**
  - O host de legendas agora é criado imediatamente no `body` com defaults seguros.
  - Settings de posição são carregadas em background e aplicadas depois da montagem.
  - O host é reposicionado no player assim que ele existir, preservando o fallback inicial.
  - A descoberta de vídeo passou para polling de 250ms sem criar um segundo loop.
  - Adicionado `tests/player-startup-performance.test.mjs`.
- **Validação:** contratos de startup/ciclo de vida/player passaram, checks remotos do CI verdes e PR mesclada em `main`.

## Issue #165 — Pronúncia IPA ampliada no card e popup (2026-09-25)

- **PR:** [#166](https://github.com/cascaoconcurseiro/linguaflow/pull/166) (mesclada em `main`), branch `codex/165-highlight-ipa-pronunciation`.
- **Issue:** [#165](https://github.com/cascaoconcurseiro/linguaflow/issues/165).
- **Commit:** `88b6160 feat(ui): destacar pronuncia IPA no card e popup`.
- **Atualização desta sessão:** removida a versão abrasileirada da interface, dos payloads novos e dos prompts de IA; a PR agora mantém somente IPA.
- **Feito:**
  - O card de estudo do dashboard agora possui bloco “Pronúncia (IPA)” com tipografia grande, responsiva e atualização anunciável.
  - O popup da extensão agora possui bloco “Pronúncia (IPA)” em 25px; o contêiner inteiro fica oculto quando não há IPA.
  - A pronúncia aproximada em português foi removida do popup, card contextual, exportação do Cofre, payloads novos e geração de IA.
  - A coluna histórica `words.pronunciation_pt` e os dados antigos permanecem no schema por compatibilidade, mas não são mais selecionados/renderizados nem enviados em novos salvamentos.
  - Valores vindos de conteúdo persistido/API continuam usando `textContent`; o card limpa a IPA entre apresentações.
  - Adicionado `tests/ipa-pronunciation-display.test.mjs`.
- **Validação:** contratos direcionados e `npm run test:release` passaram; o smoke será repetido após o commit desta atualização; `git diff --check` passou.
- **Próximo passo concreto:** revisão humana da [PR #166](https://github.com/cascaoconcurseiro/linguaflow/pull/166) e QA visual autenticada em `dashboard/js/ui/studyView.js`/`dashboard/css/editorial.css`, além de abrir o popup real da extensão com uma palavra que tenha IPA.
- **Bloqueios:** ainda não houve QA visual autenticada nem validação do popup dentro do Chrome; não houve merge, deploy, schema, RPC, RLS ou Edge Function.

## Issue #135 — Layout vertical compacto de aprofundamento, auto-atualização do PWA e versão 3.0.55 (2026-09-24)

- **PR:** #136 (mesclado em `main` `8e9cc43`).
- **Problema resolvido:**
  - A disposição lado a lado de "Trecho original" e "Ouvir em outros contextos" ocupava excessivo espaço horizontal e espremia o card principal de estudo.
  - Usuários com Service Worker ativo continuavam retidos em versões de cache antigas mesmo com `Ctrl + Shift + R`, devido à ausência de bump no `CACHE_NAME`, ao cache imutável de 1 ano no Vercel para CSS e à falta de ativação imediata do novo worker.
- **Mudanças realizadas:**
  - **Layout vertical em coluna única (340px):** "Trecho original" posicionado acima de "Ouvir em outros contextos", com divisor horizontal sutil e respiro total devolvido ao card principal.
  - **Acordeom compacto de Trecho original:** Inicia recolhido exibindo apenas kicker ("OUVIR NO CONTEXTO"), título e descrição, expandindo os controles do vídeo somente ao ser clicado pelo usuário.
  - **Contenção estrita de altura:** `.study-explore` configurado com `max-height: calc(100dvh - 100px - var(--study-grading-dock-height, 140px))` e `overflow-y: auto`, garantindo que conteúdos expandidos nunca passem por cima ou por trás dos botões de classificação.
  - **Pausa automática de áudio/vídeo:** Fechar o acordeom de Trecho original ou a gaveta de Entender melhor pausa instantaneamente qualquer player em reprodução.
  - **Cache Busting e Auto-atualização PWA (3.0.55):** Sincronização de versão para 3.0.55, bump de `editorial.css` para `?v=115`, cabeçalho `must-revalidate` para rotas HTML no `vercel.json` e auto-skipWaiting no cliente.
- **Validação:** Testes em `tests/study-lateral-side-by-side-and-pause.test.mjs`, `tests/multimodal-study-hours.test.mjs`, suíte completa e release smoke 100% verdes; CI no GitHub Actions verde e deploy publicado na Vercel.

## Issue #132 — Recursos de áudio lado a lado e pausa de vídeo ao fechar (2026-09-24)

- **PR:** #133 (mesclado em `main` `adee245`).
- **Problema resolvido:**
  - O aprofundamento empilhava verticalmente "OUVIR NO CONTEXTO" (trecho original) e "Ouvir em outros contextos" (YouGlish) em uma coluna estreita (290px), forçando rolagem vertical ("subir e descer") e deixando espaço vazio na tela.
  - Ao fechar o painel/gaveta de "Ouvir em outros contextos", o vídeo do YouGlish continuava reproduzindo áudio em segundo plano.
- **Mudanças realizadas:**
  - Dispostos "OUVIR NO CONTEXTO" e "Ouvir em outros contextos" lado a lado (em 2 colunas com divisor visual) em telas desktop em `editorial.css`, ajustando para caber na viewport sem necessidade de rolagem vertical.
  - Adicionada pausa imediata de vídeo e áudio ao fechar "Entender melhor" (clique em `#close-study-resources` e evento `toggle`), pausando YouGlish widget, disparando `postMessage('pauseVideo')` para iframes do YouTube e pausando tags `<video>` em `studyView.js`.
- **Validação:** Novo teste automatizado em `tests/study-lateral-side-by-side-and-pause.test.mjs`, suíte completa `npm run test:release` verde, CI no GitHub Actions verde e deploy validado na Vercel.

## Issue #129 — Remoção da seção 'Depois' e da página 'Aprender' (2026-09-24)

- **PR:** #130 (mesclado em `main` `1b5ccbd`).
- **Problema resolvido:** O usuário solicitou a remoção da seção intermediária "Depois" no dashboard (botões "EXPLORAR CONTEÚDO" e "LER OU CRIAR HISTÓRIA") e a remoção da aba "Aprender", visto que o atalho direto para Histórias já fica em destaque no topo do dashboard (#home-primary-plan).
- **Mudanças realizadas:**
  - Removido o bloco `#home-next` e os botões `#home-secondary-actions` em `homeView.js`.
  - Aposentada a aba "Aprender" nas barras de navegação desktop e mobile de `dashboard.html`.
  - Rota legada `learn` agora redireciona suavemente para `stories` em `app.js`.
  - Treinador diário (`chooseTodayAction`) encaminha intenções de imersão/história para `stories`.
- **Validação:** Contratos em `tests/navigation-home-p0-a.test.mjs`, `tests/product-ux-stage4.test.mjs`, `tests/study-depth-stories-contract.test.mjs`, `tests/game-removal-contract.test.mjs` e `tests/fluency-check-ux.test.mjs` atualizados e verdes. CI no GitHub Actions verde e deploy validado na Vercel.

## Issue #125 — Simplificação lateral do estudo e prevenção de sobreposição da barra de notas (2026-09-24)

- **PRs:** #126 e #127 (mesclados em `main` `36e2f6c`).
- **Problema resolvido:** Eliminação de seções redundantes na lateral do card de estudo (sentido textual redundante, blocos intermediários e mnemônicos), mantendo exclusivamente "OUVIR NO CONTEXTO" (trecho original com player) e "Ouvir em outros contextos" (YouGlish).
- **Layout e rolagem:** Adicionado `max-height: calc(100dvh - 120px - var(--study-grading-dock-height, 140px))` e `overflow-y: auto` no painel `.study-explore`, garantindo que a expansão da gaveta lateral nunca sobreponha ou passe para baixo dos botões fixos de avaliação (`Errei`, `Difícil`, `Bom`, `Fácil`). Aumentado `padding-bottom` e `scroll-padding-bottom` para garantir respiro visual completo.
- **CI & Release Smoke:** Contratos em `tests/study-depth-stories-contract.test.mjs` e `tests/understand-panel-p0-b.test.mjs` atualizados e validados. Build e Release no GitHub Actions verde; deploy na Vercel publicado e verificado no navegador com sucesso.

## Issue #118 — Estabilização do listening e da avaliação (2026-09-23)

Branch `codex/118-stabilize-learning` de `main` `3aed6ce`. Correções de contador de vídeo com idioma do áudio confirmado, fila idempotente, agregação de horas, rascunho por conta, emissão e envio autoritativo de tarefas, retirada da recalibração global por cards. Migration nova depende de `20260921160000_multimodal_study_and_language_tracking.sql`, ausente do banco hospedado no diagnóstico; nenhuma das duas foi aplicada lá. Replay local de 56 migrations e teste transacional passaram em PGlite; CI PostgreSQL e QA autenticada ainda são necessários. Detalhes de rollout, rollback, limitações pedagógicas e operacionais em `docs/audits/2026-09-23-issue-118-implementation.md`. Issue #118 aberta; PR e merge pendentes.

# Handoff — LinguaFlow

## Atualização da Issue #109 — Referência visual atualizada da Home e do estudo

**Data:** 2026-09-22
**Branch:** `codex/109-reference-designs`
**Worktree:** `C:\Users\Wesley\.codex\worktrees\issue-102-human-interface-pass\linguaflow`
**Issue:** https://github.com/cascaoconcurseiro/linguaflow/issues/109

### Feito nesta sessão

- A Home foi alinhada à referência fornecida: tema escuro azul-marinho, topbar enxuta, data, próxima ação dominante, métricas em linha, horas de estudo, cards críticos e uma continuação editorial sem jogos.
- A Sessão de estudo foi alinhada à referência: frase e palavra em destaque, áudio, tradução, bloco “Sobre esta palavra”, sentido contextual, quatro avaliações e recursos progressivos.
- O tutor foi retirado da superfície; “Mais exemplos e fontes” permanece como aprofundamento.
- O padrão de busca do topo foi preservado, e o perfil concentrou configurações/tema sem duplicar controles na barra.
- Os contratos de interface e do painel contextual foram atualizados.
- Não houve alteração de schema, RPC, RLS ou Edge Function; o Supabase não é necessário para a mudança.
- A referência continha “Prática livre — sem placar”, mas essa ação não foi reintroduzida porque os jogos foram retirados na Issue #107.

### Próximo passo concreto

Fazer commit e push de `codex/109-reference-designs`, abrir a PR vinculada à Issue #109 e conferir o preview que a Vercel gerar em `https://linguaflow-web-tau.vercel.app/` com autenticação, em desktop e celular.

### Bloqueios pendentes

- A execução completa dos gates passou nos contratos funcionais; o `release-smoke` foi interrompido apenas porque a alteração ainda estava sem commit.
- A Vercel está publicando a versão atualmente conectada ao GitHub; a tela pública já responde, mas a rota direta `/dashboard.html` nesse domínio retorna 404 e exige uso da entrada `/`/rewrites configurados.
- QA autenticada real, revisão humana e merge ainda pendentes.

## Atualização da Issue #107 — Remover jogos do produto

**Data:** 2026-09-21
**Branch:** `codex/107-remove-games`
**Worktree:** `C:\Users\Wesley\.codex\worktrees\issue-102-human-interface-pass\linguaflow`
**Issue:** https://github.com/cascaoconcurseiro/linguaflow/issues/107

### Feito nesta sessão

- O botão de prática livre foi removido da Home e os mini-jogos foram retirados de “Aprender”.
- O roteador deixou de importar e registrar `gameView.js`; a rota antiga `game` redireciona para `learn` sem iniciar jogo ou evento.
- Os rewrites específicos de `game` foram removidos do Vercel.
- `dashboard/js/ui/gameView.js` foi excluído e os contratos de navegação, UX, segurança, pedagogia e auditoria foram atualizados.
- Migrations, RPCs e histórico `game_match` do Supabase foram preservados; não houve migration destrutiva.
- Foi adicionado o contrato `tests/game-removal-contract.test.mjs` e o script `test:game-removal`.

### Próximo passo concreto

Validar no navegador a navegação normal e um bookmark antigo `/game`; depois fazer a revisão humana e decidir o merge da [PR #108](https://github.com/cascaoconcurseiro/linguaflow/pull/108).

### Bloqueios pendentes

- QA visual/autenticada ainda não executada.
- PR #108 aberta com `Closes #107`; CI de release e preview da Vercel passaram.
- Revisão humana, QA autenticada/visual e merge ainda pendentes.
- Histórico de banco preservado de propósito; remover `game_match` do schema exigiria uma decisão separada sobre retenção e migração.

---

## Atualização da Issue #102 — Human Interface Pass

**Data:** 2026-09-21
**Branch:** `codex/102-human-interface-pass`
**Worktree:** `C:\Users\Wesley\.codex\worktrees\issue-102-human-interface-pass\linguaflow`
**Issue:** https://github.com/cascaoconcurseiro/linguaflow/issues/102

### Feito nesta sessão

- O passe foi ampliado para o restante do dashboard: Cofre, Histórias, Leitor, Prática, Progresso, Ligas, Configurações e Administração.
- Ações antes apresentadas como emoji agora têm rótulos humanos e explícitos; ícones decorativos, bandeiras e medalhas foram retirados das decisões de estudo e operação.
- Reduzi superfícies empilhadas, sombras, bordas arredondadas e controles com aparência de cápsula; a hierarquia passou a depender de texto, separadores e bordas de seção.
- A prática livre perdeu confete e pulso de combo; o feedback continua no resultado e no contador local, sem transformar toda interação em recompensa visual.
- Estados compartilhados de carregamento, feedback do vídeo, status de importação e toasts também foram revisados para não depender de símbolos gráficos.
- O contrato `tests/human-interface-pass.test.mjs` agora cobre todas as telas do dashboard; a regressão de segurança do editor foi atualizada para o novo título textual.
- O `CLIENT_BUILD` foi alinhado à versão `3.0.51` do aplicativo e o workflow de release passou a buscar o histórico completo, corrigindo os três falsos bloqueios de versão e a faixa inválida do commitlint.
- Popup, Home, barra superior e estudo receberam uma direção editorial mais contida: menos cápsulas, sombras, bordas arredondadas, gradientes, caixa por métrica e emoji como ícone.
- A Home mantém a próxima ação como decisão dominante; métricas, memória, conquistas e missões ficaram em segundo plano e com separadores.
- O estudo preserva o card contextual da Issue #98, mas usa rótulos verbais para ouvir/salvar, explicação contextual sem clipping e aprofundamento progressivo sem animação ornamental.
- Estados de tema, popup, idioma, áudio, loading e feedback foram mantidos com nomes explícitos; `prefers-reduced-motion` continua coberto.
- Adicionado `tests/human-interface-pass.test.mjs` e script `test:human-interface`.
- Não houve alteração de schema, RPC, RLS ou Edge Function; Supabase não era necessário para este passe visual.
- QA visual local do popup deslogado passou por navegador; Home autenticada e card real continuam pendentes porque a rota local exibiu login.
- `npm run test:release` executou todos os gates funcionais; o `release-smoke` terminou com apenas três divergências preexistentes de versão `3.0.49` contra o build `3.0.51`.

### Próximo passo concreto

Abrir a PWA com uma conta autenticada e revisar o sistema completo em desktop e celular; conferir Cofre, Histórias, Leitor, Prática, Progresso, Configurações e Administração, além do topo da Home, do painel “Entender melhor”, dos botões de áudio dos chunks e da barra superior em viewport estreita.

### Bloqueios pendentes

- `npm run lint:biome` não executou porque o binário `biome` não está disponível neste worktree; o CI remoto deve validar esse gate no ambiente oficial.
- Não houve validação real de Supabase/RLS/Edge Function; nenhuma migration foi necessária.
- O branch está pronto para commit/PR, mas não deve ser mergeado/deployado antes da revisão e QA autenticada.

---

## Atualização da Issue #98 — card contextual e experiência editorial

**Data:** 2026-09-21
**Branch:** `codex/98-contextual-card-experience`
**Worktree:** `C:\Users\Wesley\.gemini\antigravity\scratch\linguaflow-issue-98`
**Issue:** https://github.com/cascaoconcurseiro/linguaflow/issues/98

### Feito nesta sessão

- O contexto do vídeo passou a acompanhar a geração de chunks na extensão e no dashboard Web.
- O contrato existente `words.ai_chunks` foi reaproveitado: `is_context` representa o trecho original e `is_learning_unit` representa a unidade lexical que merece ser guardada.
- O salvamento inicial e o enriquecimento tardio preservam tradução, fonética, contexto e chunks sem exigir migration do Supabase.
- O card revela primeiro uma explicação contextual editorial; CEFR, POS, tags e definição técnica deixaram de competir com a resposta.
- O antigo painel lateral foi transformado em aprofundamento inline; vídeo, tutor, mnemônico, prática e fontes continuam disponíveis em sequência.
- Foram adicionados contratos para merge, integração e persistência dos chunks contextuais.
- `npm run test:release` executou os gates; testes funcionais passaram. O `release-smoke` ainda acusa worktree sujo durante a execução e divergência preexistente de build `3.0.49`/`3.0.51`.
- `npm run build:extension` passou e gerou o ZIP local com 33 arquivos.

### Próximo passo concreto

Abrir a PWA local ou o preview da PR com uma conta autenticada, revelar um card salvo de vídeo e conferir em viewport desktop e móvel: frase completa, explicação contextual, ausência de corte lateral, ordem do aprofundamento e expansão do tutor.

### Bloqueios pendentes

- Não houve QA autenticada no navegador da branch; a rota local exibiu login.
- Não houve validação ao vivo de Supabase, RLS ou Edge Function; não foi necessária migration.
- O `release-smoke` permanece bloqueado pela divergência de versão já existente e pela exigência de worktree limpo.

## Última sessão

**Data:** 2026-09-21  
**Versão:** 3.0.51  
**Branch de referência:** `main` (histórico anterior; a Issue #98 está na branch isolada acima)

---

## O que foi feito nesta sessão

### 1. Auditoria de Segurança Completa (OWASP Top 10)

Varredura estática de toda a base de código (extensão, dashboard, utils):

- **XSS confirmado e corrigido** em `dashboard/js/ui/studyView.js`:
  - L957: `${pt || word}` injetado em `innerHTML` sem escape — `pt` vem da coluna `translation` do banco, podia conter `<>&`. **Corrigido com `escapeHtml()`.**
  - L974: `context.replace(regex, '<span>...')` aplicado sobre o texto cru — span inserido em texto com `<>` não escapados. **Corrigido: context e word são escapados antes do regex cloze.**
  - L1837: `escapeHtml` redefinida localmente (7 linhas idênticas) sem usar o import centralizado de `viewState.js`. **Removida a cópia local; adicionado `import { escapeHtml } from './viewState.js'`.**

- **Confirmado OK** (sem vulnerabilidades ativas):
  - `readerView.js` — usa `escapeText()` em todos os pontos de `innerHTML` com dados externos.
  - `storiesView.js` — importa `escapeHTML` de `utils/html.js` (implementação correta).
  - `gameView.js`, `libraryView.js`, `settingsView.js` — importam de `viewState.js` e sanitizam antes de injetar.
  - RLS ativo em todas as 25+ tabelas do Supabase.
  - Nenhum segredo exposto no código do cliente (chave publicável do Supabase é intencional).
  - RPCs com `SECURITY DEFINER` e `search_path = ''` — padrão correto.
  - Nenhuma coluna `USING (true)` em tabelas com dados de usuário.

### 2. Verificação Banco × Código (100% alinhado)

Cruzamento completo de todas as tabelas, colunas e RPCs usadas em `utils/db.js` contra as 55 migrations em `supabase/migrations/`:

- **25 tabelas** — todas existem no banco.
- **29 RPCs** — todas existem no banco, incluindo as mais recentes (`log_manual_study`, `log_study_time` com `p_language`).
- **Colunas específicas** confirmadas: `sessions.language`, `review_log.response_time_ms`, `reader_texts.last_read_position/reading_percentage/is_completed`, `stories.archived`.

> Observação: `updateReaderProgress` e `updateStoryArchive` em `db.js` estão prontos no banco, mas ainda sem entrada UI conectada. Não é bug — é feature aguardando implementação da tela.

### 3. Correções UX/Design (commits anteriores desta sessão, PR #96 e #97)

- Eliminados anti-padrões visuais de IA (gradientes, cards genéricos, animações ornamentais).
- Micro-interações humanas: hover com `box-shadow` direcional, estado `pressed`, ripple nos botões primários, `prefers-reduced-motion` respeitado.
- Sanitização de cartões no modo de estudo: `context_sentence` e `translation` escapados em todos os pontos de `innerHTML`.
- Correção de cálculo de weekday com DST.
- Remoção de classes mortas detectadas na auditoria de wiring.

### 4. Commits desta sessão (em `main`)

```
2162c7b  fix(security): escape pt|word no cartao reverso e context no cloze; importa escapeHtml de viewState
fbaadea  fix(sec, ux): sanitize critical cards, align edge cors, fix dst weekday calculation and remove dead classes (#97)
59ca808  feat(ux): eliminate AI design patterns and add human tactile interaction (#96)
b4b709c  docs: reconcile quality gate handoff (#86)
bcfb376  feat: adicionar cronometro ao vivo nos cards, info de hesitacao e bump v3.0.47 (#91)
ac4aaba  feat: controle multimodal de horas de estudo por idioma e listening no popup (#90)
```

---

## Estado atual dos testes

```
npm run test:untrusted-content  → ✅ 5 testes passando
npm run test:engine             → ✅ 40 testes passando
npm run test:product-ux         → ✅ passando
npm run test:pedagogy           → ✅ 19 contratos passando
```

Todos os testes de `test:release` continuam verdes.

---

## Próximos passos prioritários

1. **QA autenticada no navegador** — ainda pendente. Não declarar validação concluída sem abrir a PWA com uma conta real.
2. **`updateReaderProgress` na UI** — o banco tem as colunas (`last_read_position`, `reading_percentage`, `is_completed`), mas nenhuma tela chama o método ainda. Pode ser próxima feature.
3. **Bug de hover de Histórias (Issue #77)** — reproduzir no navegador autenticado e confirmar a causa raiz antes de editar `storiesView.js`.
4. **RLS real com dois usuários** — validação de isolamento entre contas ainda não executada em ambiente real.

---

## Bloqueios

- QA autenticada no navegador não executada nesta sessão.
- Schema/RLS remoto, Edge Functions e observabilidade real sem validação ao vivo.
- Confirmação independente de `git ls-remote` bloqueada por Schannel (não impede os pushes — GitHub aceitou normalmente).

## 2026-09-22 — Issue #114 / codex/114-editorial-light

Direção branca/editorial escolhida pelo dono aplicada como camada CSS compartilhada e ajustes mínimos de markup. Revisão mantém IDs e handlers, move trecho original para rail e fixa avaliação. Tema claro é padrão somente quando não há escolha salva. Tipografia carrega sem handler inline, compatível com CSP. Sem mudança de backend/agendamento.

Fixture local (`npm run dev`) usa módulos reais com banco simulado fail-closed; não é servidor de produção. QA e limitações em `design-qa.md`. Gate de release passou até smoke, que foi reexecutado com --allow-dirty após correção do cache. Não confundir isso com QA autenticada; áudio, gravação de notas, tema escuro completo e extensão seguem pendentes. Abrir PR draft, não fazer merge/deploy de produção antes da revisão.

## 2026-09-23 — Issue #122 / codex/122-study-depth-stories

- A revisão reserva dinamicamente a altura do dock de notas; conteúdo longo não termina escondido atrás dos botões.
- “Entender melhor” reúne sentido contextual, nota de uso, mnemônico, chunks e prática, com fallback honesto quando faltam dados.
- Histórias possui atalhos na Home e criação por nível, duração e objetivo. A geração web e da extensão compartilha o mesmo contrato.
- `stories` passa a guardar nível solicitado/medido, duração, objetivo, modo, validação e versão do prompt pela migration `20260923175407_story_generation_contract.sql`.
- Build alinhado em `3.0.53`. A migration permanece somente no repositório até revisão/CI; não foi aplicada remotamente.

## 2026-09-23 — Issue #123 / listening e popup / 3.0.54

- PR #122 foi integrado ao main remoto (33b15de). Migration de histórias aplicada ao projeto Supabase e colunas verificadas nesta sessão.
- Listening preserva frações entre flushes, aceita pequenos atrasos do timer com avanço compatível, não depende da visibilidade das legendas e aceita PiP. Pausa, mute, anúncios, seek e grandes lacunas não geram crédito. Intervalos fracionados respeitam duração e não se sobrepõem; resto subsegundo após pausa longa é descartado para não bloquear sincronização.
- Idioma automático vem de audioTracks ou da faixa selecionada exposta pelo player YouTube, por bridge validada. Legenda traduzida/configuração do aluno não confirma idioma. Plataforma sem metadados requer confirmação manual; não há reconhecimento de voz ou custo de IA. QA com extensão instalada nos players reais ainda pendente.
- Supabase: migration aditiva de evidência audio_track preserva autenticação, idempotência, isolamento e rejeição de duração inflada. Aplicar após CI verde, antes de disponibilizar novo cliente. Rollback: reverter cliente, manter schema compatível e dados.
- Home aceita 1–720 minutos inteiros personalizados com validação, foco, teclado, erro recuperável e aviso de soma ao total. Popup segue fundo marfim, azul, tipografia editorial e foco/reduced-motion.
- Testes: regressões RED→GREEN para atraso, frações e duração SQL; retry preserva ID/evidência; duração manual inválida não escreve. Release passou todos os contratos; smoke isolado com --allow-dirty passou (gate inicial recusou árvore suja). Biome, Knip (avisos existentes), pacote extensão passaram. Replay Postgres local indisponível; CI executa replay completo com testes SQL de áudio/anti-duplicação/autorização.
- Browser real com fixtures locais: popup 340px inspecionado; formulário validou 0, aceitou 27 e apresentou erro simulado sem perder entrada. Dados sintéticos, sem login/gravações reais. Fixture popup usa JS real e mocks fail-closed. Não equivale a teste fim a fim com YouTube/Max.
- Operação: investigar se contador tem idioma, se fila fica pendente e se período é rejeitado. Estados no vídeo + eventos estruturados existentes interval_failed/sync_pending (código, sem conteúdo/URL/PII) ajudam diagnóstico; não há dashboard de métricas/traces de produção novo nesta entrega.

## 2026-09-24 — Issue #138 / legendas YouTube

Auditoria e implementação detalhadas em `docs/audits/youtube-caption-integrity-2026-09-24.md`. Agrupamento conservador de eventos JSON3 para legenda/barra/card; língua e faixa manual priorizadas; sem fallback para faixa diferente; URL cache com idioma obrigatório; tradução pareada por tempo; faixa completa preservada diante de segmentos; pré-carga e recuperação original limitadas a uma tentativa por navegação; fetch interceptor não repete falha. Legenda oficial visível até haver cues LinguaFlow e restaurada na navegação e destruição. Fonte YouTube oficial confirma limitações do ASR e acesso autorizado da Data API. Pacote ZIP Linux corrigido e util de agrupamento incluído com exposição restrita. QA com extensão real pendente, sem garantia de imunidade a bloqueios por plataforma.
## Issue #140 — Popup da legenda e montagem concorrente (2026-09-24)

- Branch `codex/140-caption-popup-recovery` sobre `main` `cec5ed6`. Versão `3.0.57`.
- `word-popup.js` importa `utils/context-chunks.js`, ausente da lista de recursos acessíveis nas origens de vídeo. Isso bloqueava o módulo e impedia o popup de iniciar. Recurso exposto apenas nas origens de vídeo já autorizadas para o popup.
- O ZIP anterior também não copiava `utils/story-variety.js`, importado pelo service worker. Empacotamento agora inclui módulos locais transitivos sem expor imports privados no manifesto.
- A UI da legenda pode ser solicitada ao mesmo tempo na inicialização e ao detectar o vídeo. A montagem agora compartilha a operação pendente; na mudança de vídeo, uma nova montagem é solicitada explicitamente.
- `isolated.js`/`debounce` não existe neste repositório; o erro do console pode vir de um script antigo ainda residente na aba ou de outra extensão. `interval_failed` é do contador de listening e requer informação de erro adicional se persistir após atualização.
- Critério testado: import do popup e montagem concorrente. Sem evidência de QA real no navegador com a instalação do usuário ou de resolução de `interval_failed`.
- Rollback: restaurar a versão `3.0.56`; sem mudanças de banco, permissão ou fetch do YouTube.
## Issue #142 — Estimativa de idioma por ASR original (2026-09-24)

- Branch `codex/142-detect-youtube-audio-language` sobre árvore `3.0.57`; release da extensão `3.0.58`.
- Resposta do player do YouTube já consultada para legendas; o hook usa a faixa ASR original de idioma único somente quando não há faixa de áudio selecionada e não há várias faixas de áudio. Não faz nova requisição de rede.
- Ponte com nonce transporta `caption_asr` como evidência distinta; seleção explícita do usuário e faixa de áudio prevalecem. UI indica "estimado pela legenda automática"; idioma não confirmado continua quando só há legenda manual/traduzida ou áudio ambíguo.
- Migration append-only `20260924123246_listening_asr_evidence.sql` amplia a validação de evidência da RPC e do ledger sem alterar RLS, grants, janelas de idempotência ou contagem. Aplicada no projeto hospedado antes do merge da extensão 3.0.58; RPC, constraint e grants verificados. Versão antiga permanece compatível.
- Testes comportamentais do hook, ponte, contador, fila local e replay das 59 migrations em PGlite passaram. QA com extensão instalada no vídeo da captura ainda pendente; o vídeo específico pode não ter faixa ASR original.
- Rollback: voltar à extensão 3.0.57. A migration aditiva pode permanecer; não remover `caption_asr` enquanto houver intervalos desse tipo na fila local.
