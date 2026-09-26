## Issue #173 · Modularização interna do serviço de banco de dados utils/db.js — Fase 2 (2026-09-25)

- [x] Registrar Issue #173 e trabalhar na branch `codex/173-modular-database-service`.
- [x] Extrair repositório `ReaderStoriesRepository` para `utils/db/reader-stories-repo.js` (histórias, textos sincronizados do leitor, progresso e arquivamento).
- [x] Extrair repositório `GamificationRepository` para `utils/db/gamification-repo.js` (estatísticas, ligas, telemetria, Web Push e conquistas).
- [x] Implementar padrão Facade em `Database` (`utils/db.js`), delegando métodos aos repositórios e mantendo 100% de retrocompatibilidade com todas as chamadas existentes.
- [x] Declarar `utils/db/reader-stories-repo.js` e `utils/db/gamification-repo.js` no `manifest.json` sob `web_accessible_resources`.
- [x] Atualizar testes estruturais (`tests/study-depth-stories-contract.test.mjs`, `tests/reader-progress-contract.test.mjs`, `tests/user-stats-security-p0-3.test.mjs`, `tests/professional-hardening.test.mjs` e `tests/engine.test.mjs`).
- [x] Criar suíte de teste de contrato para a Facade em `tests/modular-database-facade-contract.test.mjs` (3/3 testes verdes).
- [x] Validar que `npm run test:web-reader`, `npm run test:e2e`, `npm run lint:biome` e `npm run test:release` passam 100%.

## Issue #171 · Decomposição modular de Configurações e Histórias — Fase 1 (2026-09-25)

- [x] Extrair modal interativo de nivelamento CEFR em 4 fases para `dashboard/js/ui/cefrPlacementTest.js`, reduzindo `settingsView.js` em 267 linhas.
- [x] Extrair quiz de compreensão LingQ-style para `dashboard/js/ui/storiesQuiz.js`, reduzindo `storiesView.js` em 139 linhas.
- [x] Adicionar suíte de contrato `tests/stories-quiz-contract.test.mjs` validando `normalizeQuiz`, `generateStoryQuiz` e `runPlacementTest`.
- [x] Manter retrocompatibilidade total reexportando `runPlacementTest` e preservando a API e estilos intactos.
- [x] Regressões `test:p1-a`, `test:p1-b`, `test:e2e`, `lint:biome` e `release-smoke` 100% verdes.

## Issue #169 · Conectar progresso persistido no Reader, release unificado e expansão de lint (2026-09-25)

- [x] Conectar `updateReaderProgress` na interface do Web Reader (`readerView.js` com auto-save em scroll com debounce, flush e marcação de conclusão).
- [x] Incluir `last_read_position, reading_percentage, is_completed` em `getReaderTexts` no `utils/db.js`.
- [x] Adicionar `updateReaderProgress` na allowlist de proxy do `background/service-worker.js`.
- [x] Criar suíte de contrato `tests/reader-progress-contract.test.mjs` e jornada Playwright E2E `tests/e2e/reader-journey.spec.mjs`.
- [x] Unificar empacotamento da extensão no release workflow chamando `npm run build:extension` (ZIP curado com 37 arquivos).
- [x] Expandir lint Biome para analisar código executável de produção (`utils/`, `dashboard/js/core/`, `scripts/`, `tests/`) com 40 arquivos limpos.
- [x] Atualizar documentação desatualizada em `README.md`, `docs/ARQUITETURA.md` e `HANDOFF.md`.
- [x] Resolver sobreposição das PRs #166 e #168 com rebase limpo e merge em `main`.

## Issue #135 · Layout vertical compacto, auto-atualização do PWA e versão 3.0.55 (2026-09-24)

- [x] Organizar "Trecho original" e "Ouvir em outros contextos" em coluna vertical compacta de 340px, devolvendo espaço para o card principal.
- [x] Implementar acordeom compacto para Trecho original que exibe apenas cabeçalho/resumo e expande o vídeo no clique.
- [x] Conter altura máxima da gaveta lateral (`--study-grading-dock-height`) impedindo que ultrapasse os botões de classificação.
- [x] Pausar áudio/vídeo imediatamente ao fechar o acordeom de Trecho original ou gaveta de Entender melhor.
- [x] Sincronizar versão 3.0.55 em todo o repositório, aplicar cache busting `v=115` no CSS e revalidação de rotas no Vercel.
- [x] Limpar caches legados do PWA e ativar atualizações automaticamente via worker no cliente.
- [x] Contratos e release smoke 100% verdes; CI verde e deploy publicado na Vercel.

## Issue #125 · simplificação da lateral de estudo e correção de sobreposição da barra (2026-09-24)

- [x] Remover seções intermediárias redundantes da lateral do card ("Sentido nesta frase", "Blocos úteis", mnemônicos e chat).
- [x] Manter exclusivamente "OUVIR NO CONTEXTO" (trecho original) e "Ouvir em outros contextos" (YouGlish).
- [x] Fixar rolagem independente em `.study-explore` com `max-height` proporcional à barra inferior.
- [x] Evitar sobreposição de botões fixos de avaliação (`Errei`, `Difícil`, `Bom`, `Fácil`) e adicionar rolagem suave automática.
- [x] Atualizar contratos de teste e garantir CI e release smoke verdes.
- [x] Deploy e validação visual no navegador na Vercel em produção.

## Issue #118 · estabilização de aprendizagem (2026-09-23)

- [x] Corrigir contagem audível de vídeos com idioma confirmado e impedir duplo crédito/inflação simples.
- [x] Isolar rascunhos de fluência e usar tarefas emitidas/submissão estável.
- [x] Corrigir Max, escrita e histórico sem idioma; retirar CEFR global por reviews de cards.
- [x] Replay efêmero das 56 migrations e contratos de autorização/idempotência da nova RPC.
- [ ] CI PostgreSQL real e browser e2e da PR.
- [ ] Revisão, QA autenticada da extensão/players, rollout das duas migrations na ordem e deploy.
- [ ] Avaliação pedagógica longitudinal com usuários e diálogo interativo real em issue separada.

# Checklist — LinguaFlow

## Issue #167 · inicialização imediata do player da extensão (2026-09-25)

- [x] Identificar bloqueio no caminho crítico: settings assíncronos e retries de até 15s antes de montar a UI.
- [x] Montar o host visual imediatamente no `body` com defaults seguros.
- [x] Aplicar posição salva em background e reposicionar quando o player existir.
- [x] Reduzir polling de descoberta do vídeo para 250ms sem duplicar listeners/loops.
- [x] Adicionar contrato `tests/player-startup-performance.test.mjs`.
- [x] Rodar contratos direcionados e `npm run test:release`.
- [ ] Repetir `release-smoke` após commit e fazer QA visual em YouTube/Max.

## Issue #165 · destacar pronúncia IPA no card e popup (2026-09-25)

- [x] Registrar Issue #165 e trabalhar na branch `codex/165-highlight-ipa-pronunciation`.
- [x] Exibir IPA ampliada e rotulada no card de estudo do dashboard.
- [x] Exibir IPA ampliada e rotulada no popup da extensão.
- [x] Ocultar o bloco sem IPA e limpar valores entre cards/palavras.
- [x] Manter inserção segura via `textContent` e apoio secundário da pronúncia em português.
- [x] Adicionar `tests/ipa-pronunciation-display.test.mjs`.
- [x] Rodar contratos direcionados, `npm run test:release` e `node tests/release-smoke.mjs` após commit.
- [x] Abrir PR #166 com `Closes #165`.
- [x] Remover a pronúncia abrasileirada das superfícies, payloads novos e prompts de IA; manter apenas IPA.
- [x] Atualizar regressões para garantir ausência de `pronunciation_pt`, transliteração PT-BR e conversão IPA→português no código ativo.
- [ ] Revisão humana, QA visual autenticada do card e QA do popup dentro do Chrome.

## 0. Proteção e baseline

- [x] Confirmar que `main` local está em `0c33b26`.
- [x] Confirmar que a referência local `origin/main` aponta para `0c33b26`.
- [x] Confirmar que existem referências locais de backup.
- [x] Pushes recentes para `main` foram aceitos pelo GitHub; consulta independente via `git ls-remote` continua bloqueada por Schannel.
- [x] Preservar as 8 alterações locais; não executar reset ou limpeza destrutiva.
- [x] Separar as alterações locais em branch/commit revisável antes do release.

## 1. Correção imediata do Reader

- [x] Remover o fallback de `fetch` direto para `translate.googleapis.com` em `content/web-reader.js`.
- [x] Manter a tradução do Web Reader pelo service worker, respeitando CORS.
- [x] Definir comportamento explícito quando o service worker estiver indisponível.
- [x] Adicionar regressão que impeça novo fetch direto de tradução no content script.
- [ ] Verificar seleção, Alt+seleção, menu de contexto e duplo-clique.
- [ ] Verificar que controles interativos e elementos editáveis não abrem o popup.

## 2. Revisão das alterações locais

- [x] Revisar `WORD_SAVED` em `background/service-worker.js` e remover o anúncio redundante antes da confirmação remota.
- [x] Confirmar sincronização da versão em `content/boot.js`.
- [x] Confirmar origem autorizada de `openWordPopup` em `content/subtitle-engine.js`.
- [x] Confirmar revogação segura de object URLs em `dashboard/js/core/tts.js`.
- [x] Confirmar embaralhamento do Builder em `dashboard/js/ui/gameView.js`.
- [x] Confirmar interrupção de TTS ao sair de Histórias.
- [x] Executar testes específicos após cada grupo.
- [x] Corrigir a linha em branco extra em `tests/web-reader-contract.test.mjs`.

## 3. Bug de tradução no hover de Histórias

- [ ] Reproduzir no navegador autenticado um caso real de “Tradução indisponível”.
- [ ] Registrar token, contexto, idioma, endpoint, status HTTP e ordem das respostas.
- [ ] Rastrear hover → token → normalização → vault → translateText → tooltip.
- [ ] Confirmar uma única causa raiz antes de editar `storiesView.js`.
- [ ] Criar teste de regressão para o caso reproduzido.
- [ ] Corrigir somente a causa confirmada.
- [ ] Validar corrida entre hovers, troca de história e saída da rota.
- [ ] Validar pontuação, apóstrofo, hífen e expressão composta.

## 4. Schema e migrations

- [x] Confirmar live pelo SQL Editor o inventário público de 33 tabelas; migrations remotas estão alinhadas até `20260913123000`.
- [ ] Exportar o schema remoto completo; CLI dump bloqueado por Docker/`cli_login_postgres` ausente.
- [ ] Comparar colunas, tipos, defaults e constraints em inventário completo.
- [ ] Comparar chaves estrangeiras e índices críticos.
- [ ] Comparar assinaturas de RPCs e sobrecargas antigas.
- [x] Confirmar que as migrations locais e remotas estão alinhadas até `20260913123000`.
- [ ] Reexecutar replay em PostgreSQL real; bloqueado por `npm`/cache com erro `EPERM` ao inicializar o Supabase CLI.
- [ ] Confirmar que não existem mudanças manuais ausentes do repositório.
- [ ] Confirmar que não há consumidor front sem tabela ou coluna correspondente.

## 5. RLS, grants e segurança Supabase

- [ ] Executar isolamento real com dois usuários.
- [ ] Confirmar leitura e escrita owner-only nas tabelas pessoais.
- [ ] Confirmar que usuário comum não executa RPC administrativa.
- [ ] Confirmar que usuário A não opera sobre IDs de B.
- [ ] Confirmar ledgers sem escrita direta do cliente.
- [x] Confirmar live RLS habilitado nas 33 tabelas públicas; nenhuma está sem RLS.
- [x] Auditar live policies, grants e funções pelo SQL Editor autenticado.
- [x] Confirmar live que `anon` só tem grants de tabela em `keep_alive`; `authenticated` tem grants amplos protegidos por policies owner-only.
- [x] Confirmar live `SECURITY DEFINER` e `search_path` das RPCs; não há alteração direta sem revisão de necessidade.
- [ ] Testar lockout, expiração e concorrência administrativa.

## 6. Edge Functions e jobs

- [x] Confirmar live que as 6 Edge Functions estão ativas; `verify_jwt=false` em push/e-mail depende da chave de cron validada no código.
- [ ] Confirmar `verify_jwt` de cada função.
- [ ] Testar JWT ausente, expirado e adulterado.
- [ ] Testar método, payload, tamanho e CORS.
- [ ] Confirmar quota e idempotência de IA/fluência.
- [ ] Confirmar autorização de jobs de push e e-mail.
- [ ] Testar claims de push/e-mail sob concorrência.
- [ ] Revisar `url-import` contra redirects, IP privado e DNS rebinding.
- [ ] Confirmar timeout, tamanho e número de redirects.
- [ ] Confirmar cron jobs, URLs e chaves remotas.

## 7. Publicação e Vercel

- [ ] Fazer scan do artefato publicado.
- [x] Confirmar por HTTP que migration administrativa, teste de release e `.env` não são entregues; migration/teste terminam em 404 após redirect.
- [x] Revalidar exposição de `20260913100000_admin_authority_rpcs.sql`; após correção, termina em 404.
- [ ] Rotacionar PIN/hash ou credencial exposto.
- [x] Home pública respondeu 200 após a correção de publicação.
- [ ] Testar rewrites, fallback SPA e arquivos estáticos.
- [ ] Confirmar ausência de segredos nos bundles.

## 8. QA real

- [ ] Testar Home, Study, Learn, Progress, Settings, Stories e Reader autenticados.
- [ ] Testar service worker com cache antigo e aba aberta.
- [ ] Testar logout, expiração e novo login.
- [ ] Testar offline, timeout, retry e falha parcial.
- [ ] Testar Chrome MV3 em páginas com CSP restritiva.
- [ ] Testar YouTube/HBO, legendas, popup e Reader.
- [ ] Testar áudio natural, fallback e troca rápida de rota.
- [ ] Testar atalhos com input, leitor de tela, mobile e overlays.
- [ ] Testar texto/IA contendo HTML, atributos, URLs e caracteres especiais.
- [ ] Confirmar que tela obsoleta não commita UI ou efeitos.

## 9. Wiring e manutenção

- [ ] Investigar `utils/schema.js` antes de removê-lo.
- [ ] Revisar exports órfãos reportados pelo wiring audit.
- [ ] Distinguir imports dinâmicos legítimos de código morto.
- [ ] Cobrir carregamento dinâmico não reconhecido pelo auditor.
- [ ] Remover apenas código comprovadamente sem consumidor.
- [ ] Executar novamente `node scripts/wiring-audit.js`.

## 10. Gates de commit e release

- [x] `npm run test:release` passa sem falha.
- [x] `git diff --check` passa.
- [ ] Diff contém apenas arquivos esperados.
- [ ] Teste do Reader confirma ausência de fetch direto de tradução.
- [x] Testes de segurança, lifecycle, áudio, tradução e extensão passam.
- [ ] Replay SQL real passa.
- [ ] RLS real com dois usuários passa.
- [x] Build local da extensão passou e o ZIP de v3.0.46 contém os 33 arquivos esperados.
- [x] `npm audit --omit=dev` encontrou 0 vulnerabilidades.
- [ ] Artefato publicado foi escaneado.
- [ ] Revisar status, diff e log antes do commit.
- [x] Criar commit separado e descritivo (`a686fce`).
- [x] Fazer push para `main` (GitHub aceitou `0c33b26..a686fce`).
- [x] Commits de correção/documentação foram enviados para `main`; confirmação independente via `git ls-remote` continua bloqueada por Schannel.
- [x] Atualizar `HANDOFF.md`.

## Bloqueios conhecidos

- [ ] Credenciais GitHub para confirmação remota ao vivo.
- [ ] Ambiente seguro Supabase para schema, grants e RLS live.
- [ ] Navegador autenticado para reproduzir o hover de Histórias.
- [ ] Não declarar produção concluída sem evidência desses itens.

## 13. Issue #98 — card contextual e experiência editorial de revisão

- [x] Criar Issue #98 e branch isolada `codex/98-contextual-card-experience`.
- [x] Persistir ocorrência real, unidade de aprendizagem e variações no contrato JSONB `ai_chunks` existente.
- [x] Enviar o contexto do vídeo para a geração de chunks na extensão e no dashboard Web.
- [x] Tornar a explicação principal contextual, curta e sem badges técnicos no primeiro contato.
- [x] Remover duplicidade da palavra isolada no painel de aprofundamento e manter o mnemônico acessível.
- [x] Transformar o painel lateral em aprofundamento inline, sem estreitar o card principal.
- [x] Adicionar contratos para merge, persistência e renderização dos chunks contextuais.
- [x] Executar `npm run test:release`; gates funcionais passaram, mas o `release-smoke` ficou bloqueado por worktree sujo durante o comando e divergência preexistente de versão `3.0.49`/`3.0.51`.
- [x] Gerar o ZIP local da extensão com 33 arquivos.
- [ ] Validar o card em navegador autenticado com dados reais.
- [ ] Validar Supabase/RLS/Edge Function ao vivo; nenhuma migration foi necessária nesta implementação.

## 11. Governança criada em 2026-09-19

- [x] Criar Issue #77 para a investigação do hover de tradução em Histórias.
- [x] Criar Issue #78 para o fluxo obrigatório Issue → branch → PR → deploy.
- [x] Criar Issue #79 para motion, skeleton, lazy loading e progresso.
- [x] Criar Issue #80 para observabilidade com OpenTelemetry e backend de erros.
- [x] Criar Issue #81 para lint, análise estrutural, mutation testing e testes.
- [x] Adicionar `AGENTS.md` com instruções persistentes para agentes.
- [x] Reforçar o template de PR com Issue, gates e limites de validação.
- [x] Entregar e fazer merge do PR #82 na `main`.
- [x] Atualizar o auditor de wiring para considerar consumidores `.mjs`, imports por namespace e imports dinâmicos.
- [x] Adicionar regressão para não reportar `utils/schema.js` como módulo órfão.
- [x] Entregar e fazer merge do PR #83 na `main`.
- [x] Criar Issue #84 para os gates de qualidade e observabilidade aplicada.
- [x] Integrar Biome e validar `npm run lint:biome`.
- [x] Integrar Commitlint e validar a mensagem do commit de entrega.
- [x] Integrar Knip e validar `npm run lint:knip`.
- [x] Integrar Playwright com smoke E2E do shell PWA.
- [x] Integrar c8/Codecov; registrar cobertura estrutural atual de 8,86% sem declarar cobertura funcional completa.
- [x] Integrar Stryker em modo focado/manual; registrar score de 62,77% e mutantes sobreviventes.
- [x] Adicionar contrato de observabilidade com eventos, erros, spans e exportação opcional OTLP/events.
- [x] Adicionar skeleton, `aria-busy`, animação de entrada de rota e reduced motion no shell do dashboard.
- [x] Entregar e fazer merge do PR #85 na `main`.
- [x] Atualizar `HANDOFF.md` com o estado real pós-merge.

## 12. Auditoria e hardening — 2026-09-21

- [x] Auditoria OWASP Top 10 completa na base de código (extensão + dashboard + utils).
- [x] Corrigir XSS em `studyView.js` L957: `pt|word` sem escape no cartão reverso.
- [x] Corrigir XSS em `studyView.js` L974: `context` sem escape antes do regex cloze.
- [x] Remover `escapeHtml` duplicada local em `studyView.js` L1837; importar de `viewState.js`.
- [x] Confirmar `readerView.js`, `storiesView.js`, `gameView.js`, `libraryView.js` sem injeções inseguras.
- [x] Confirmar RLS ativo em todas as 25+ tabelas do Supabase.
- [x] Confirmar 0 vulnerabilidades em `npm audit --omit=dev`.
- [x] Mapear 100% das tabelas/RPCs do `db.js` contra as 55 migrations — tudo presente.
- [x] Confirmar colunas específicas: `sessions.language`, `review_log.response_time_ms`, `reader_texts.*`, `stories.archived`.
- [x] Commitar correções e fazer push para `main` (commit `2162c7b`).
- [x] Executar `test:untrusted-content`, `test:engine`, `test:product-ux`, `test:pedagogy` — todos verdes.
- [x] Criar `docs/ESTADO_ATUAL_2026-09-21.md` com snapshot completo do sistema.
- [x] Atualizar `HANDOFF.md`, `CHECKLIST.md` e `docs/PROMPT_PROXIMA_SESSAO.md`.
- [ ] QA autenticada no navegador (bloqueada — sem navegador nesta sessão).
- [x] Validar `updateReaderProgress` na UI (banco conectado, auto-save por scroll e conclusão).
- [ ] RLS real com dois usuários (bloqueado — sem ambiente Supabase real).

## 14. Issue #102 — Human Interface Pass

- [x] Criar Issue #102 e branch isolada `codex/102-human-interface-pass` baseada na implementação contextual da Issue #98.
- [x] Auditar popup, barra superior, Home e Estudo procurando cartões homogêneos, cápsulas, emoji como ícone, gradientes e motion ornamental.
- [x] Reduzir superfícies e badges sem remover estado, foco, alvo de toque ou ação principal.
- [x] Substituir ações de áudio e status visuais por rótulos verbais no fluxo de estudo.
- [x] Preservar o chunk contextual e o painel progressivo “Entender melhor”.
- [x] Adicionar contrato `tests/human-interface-pass.test.mjs` e script `test:human-interface`.
- [x] Executar `node --check`, `test:human-interface`, `test:product-ux`, `test:study-focus`, `test:design-system`, P0-A/B/C, P1-C, auth/lifecycle e build da extensão.
- [x] Executar `npm run test:release`; gates funcionais passaram, e o `release-smoke` ficou limitado às três divergências preexistentes de versão `3.0.49`/`3.0.51`.
- [x] `git diff --check` passou.
- [x] Completar a mesma linguagem visual no Cofre, Histórias, Leitor, Prática, Progresso e Ligas.
- [x] Revisar Configurações e Administração: rótulos explícitos, menos superfícies e sem emoji como substituto de ação.
- [x] Remover celebrações ornamentais da prática e manter sequência/acerto como feedback textual local.
- [x] Ampliar o contrato de interface humana para todas as telas do dashboard e ajustar regressão de segurança do editor do Cofre.
- [x] Confirmar `test:human-interface`, `test:product-ux`, `test:untrusted-content`, P0-A/B/C e P1-C após a segunda etapa.
- [x] Corrigir a consistência do `CLIENT_BUILD` para `3.0.51` e garantir histórico completo no checkout do workflow para o commitlint.
- [ ] QA autenticada da Home e do estudo em navegador desktop/mobile.
- [ ] Disponibilidade do Biome para executar o lint completo.
- [ ] Revisão do PR e merge para a branch contextual/main.

## 15. Issue #107 — Remover jogos do produto

- [x] Criar Issue #107 e branch `codex/107-remove-games` baseada na `origin/main`.
- [x] Remover o botão de prática livre da Home e o destino de jogos de “Aprender”.
- [x] Retirar a importação dinâmica, renderer e rota funcional de `gameView.js`.
- [x] Redirecionar bookmarks antigos de `game` para “Aprender” sem iniciar rodada ou registrar evento.
- [x] Remover rewrites específicos de `game` no Vercel.
- [x] Excluir `dashboard/js/ui/gameView.js` e atualizar contratos que dependiam da tela.
- [x] Preservar migrations, RPCs e histórico `game_match` para compatibilidade de dados.
- [x] Adicionar `test:game-removal` ao gate de regressão.
- [x] Abrir PR #108 e passar CI de release e preview da Vercel.
- [ ] QA de navegador para bookmark antigo `/game` e navegação principal.
- [ ] Revisão humana e merge da PR.

## 16. Issue #109 — Atualizar Home e Sessão de estudo conforme referência visual — 2026-09-22

- [x] Criar Issue #109 e branch isolada `codex/109-reference-designs` baseada em `origin/main`.
- [x] Aplicar a direção visual atualizada na Home: tema escuro, navegação enxuta, próxima ação dominante, métricas em linha e painel de horas.
- [x] Aplicar a direção visual atualizada na Sessão de estudo: frase em destaque, áudio, tradução, sentido contextual, avaliação e recursos progressivos.
- [x] Remover o tutor da superfície do card e manter “Mais exemplos e fontes” como aprofundamento.
- [x] Não reintroduzir jogos apesar da referência conter uma ação de prática livre; a retirada da Issue #107 permanece válida.
- [x] Atualizar contratos da interface e do painel contextual.
- [x] Executar os testes focados e o gate completo; o único bloqueio do `release-smoke` durante a execução foi o worktree sem commit.
- [x] Confirmar que nenhuma alteração de Supabase é necessária para este passe de UI.
- [ ] Commitar e fazer push da branch para disparar o preview da Vercel.
- [ ] QA visual autenticada no preview da Vercel em desktop e celular.
- [ ] Revisão humana e merge da PR.

## 17. Issue #114 — Direção editorial clara

- [x] Issue e branch isolada; tema claro padrão respeita preferência existente.
- [x] Tokens, tipografia, navegação e estilos compartilhados; revisão com dock de avaliação.
- [x] Prévia local sem gravações; QA desktop e viewport móvel documentada em design-qa.md.
- [x] Contratos de release e smoke com --allow-dirty.
- [ ] QA autenticada completa, áudio, persistência, offline e extensão.
- [ ] Aprovação visual e merge; produção não alterada.

## 18. Issue #122 — Estudo profundo e histórias por nível

- [x] Reservar dinamicamente espaço para a barra fixa de avaliação em cards longos.
- [x] Garantir quebra de frases longas e rolagem até todo o conteúdo revelado.
- [x] Preencher “Entender melhor” com sentido contextual, uso, mnemônico, chunks e prática.
- [x] Colocar atalho de Histórias no primeiro bloco e na seção “Depois” da Home.
- [x] Adicionar nível, duração e objetivo à criação de histórias.
- [x] Propagar o contrato na geração web e na extensão e medir o nível produzido.
- [x] Criar migration aditiva de `stories`, preservando RLS e validando valores no banco.
- [x] Adicionar contrato automatizado e incluir no gate de release.
- [x] Alinhar versão do aplicativo, extensão e cache em 3.0.53.
- [ ] Aplicar migration no Supabase remoto somente após revisão/CI.
- [ ] Executar QA autenticada no preview da PR em desktop e celular.

## 19. Issue #123 — Listening contínuo, tempo personalizado e popup

- [x] Corrigir frações, atrasos curtos e dependência indevida de legendas.
- [x] Idioma por faixa de áudio, confirmação manual quando desconhecido, nunca por legenda traduzida.
- [x] Preservar fila por conta, idempotência e evidência de áudio.
- [x] Duração personalizada 1–720 minutos com validação e erro recuperável.
- [x] Popup editorial claro/azul, foco e movimento reduzido; QA visual com fixture local.
- [x] Build 3.0.54, testes de regressão e pacote de extensão.
- [x] PR #122 integrado; migration de histórias aplicada remotamente.
- [ ] CI/replay SQL e merge #123; registrar resultado no PR.
- [ ] QA autenticada com extensão instalada e faixa de áudio real nas plataformas.

## 20. Issue #129 — Remoção da seção 'Depois' e aba 'Aprender' (2026-09-24)

- [x] Criar Issue #129 e branch de trabalho `codex/129-remove-learn-and-home-next`.
- [x] Remover o bloco `#home-next` e botões secundários `#home-secondary-actions` em `homeView.js`.
- [x] Remover botão de navegação "Aprender" do desktop e mobile em `dashboard.html`.
- [x] Redirecionar rota legada `learn` para `stories` em `app.js`.
- [x] Ajustar rotas do `chooseTodayAction` de imersão para `stories`.
- [x] Atualizar suítes de teste de regressão e UX (5 suítes verdes).
- [x] Abrir PR #130 e mesclar em `main` (`1b5ccbd`).
- [x] Validar deploy em produção na Vercel via navegador com captura de tela.

## 21. Issue #132 — Recursos de áudio lado a lado e pausa de vídeo ao fechar (2026-09-24)

- [x] Criar Issue #132 e branch de trabalho `codex/132-study-audio-side-by-side-and-pause`.
- [x] Dispor "OUVIR NO CONTEXTO" e "Ouvir em outros contextos" lado a lado em `editorial.css`.
- [x] Ajustar viewport e respiro para acomodar recursos sem forçar rolagem vertical desnecessária.
- [x] Pausar vídeo e áudio imediatamente ao fechar a gaveta de recursos em `studyView.js`.
- [x] Adicionar teste automatizado `tests/study-lateral-side-by-side-and-pause.test.mjs`.
- [x] Abrir PR #133 e mesclar em `main` (`adee245`).
- [x] Validar CI no GitHub Actions e deploy na Vercel.



## 20. Issue #138 — integridade das legendas YouTube

- [x] Auditoria de parser, faixa, requests, sidebar, captura e fallback oficial documentada.
- [x] Frases contínuas com limites, rolling revisions, faixa por idioma e precedência da faixa completa.
- [x] Tradução por tempo, fallback nativo e tentativas limitadas após 403/429.
- [x] Testes comportamentais RED→GREEN, versão 3.0.56 e ZIP real incluindo módulo de legendas.
- [ ] CI/PR e QA da extensão instalada num vídeo real; verificar risco contratual da coleta em internals antes de distribuição ampla.
## Issue #140 · Popup da legenda (2026-09-24)

- [x] Corrigir dependência `context-chunks.js` do popup no manifesto MV3, limitada às origens de vídeo.
- [x] Empacotar `story-variety.js` e demais dependências locais transitivas do service worker no ZIP.
- [x] Serializar a inicialização do Shadow DOM entre legenda, vídeo e navegação.
- [x] Testes RED→GREEN de acesso ao módulo e montagem simultânea; bump da extensão/site para `3.0.57`.
- [ ] QA no Chrome instalado: abrir palavra na legenda e troca de vídeo; verificar o contador de listening se ainda apresentar erro.

## Issue #142 · idioma do áudio no YouTube (2026-09-24)

- [x] Usar apenas ASR original de idioma único como estimativa, respeitando áudio selecionado, dublagens e troca de vídeo.
- [x] Registrar `caption_asr` separadamente na fila e RPC, com migration aditiva e replay efêmero.
- [x] Exibir a proveniência como estimativa no painel de listening.
- [x] CI, migration hospedada e merge da PR #143 no `main`.
- [ ] QA no Chrome instalado com vídeo do usuário.
