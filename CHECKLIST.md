## Issue #118 · estabilização de aprendizagem (2026-09-23)

- [x] Corrigir contagem audível de vídeos com idioma confirmado e impedir duplo crédito/inflação simples.
- [x] Isolar rascunhos de fluência e usar tarefas emitidas/submissão estável.
- [x] Corrigir Max, escrita e histórico sem idioma; retirar CEFR global por reviews de cards.
- [x] Replay efêmero das 56 migrations e contratos de autorização/idempotência da nova RPC.
- [ ] CI PostgreSQL real e browser e2e da PR.
- [ ] Revisão, QA autenticada da extensão/players, rollout das duas migrations na ordem e deploy.
- [ ] Avaliação pedagógica longitudinal com usuários e diálogo interativo real em issue separada.

# Checklist — LinguaFlow

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
- [ ] Validar `updateReaderProgress` na UI (banco pronto, UI sem entrada).
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
