## Issue #165 — Pronúncia IPA ampliada no card e popup (2026-09-25)

- **PR:** [#166](https://github.com/cascaoconcurseiro/linguaflow/pull/166), branch `codex/165-highlight-ipa-pronunciation`.
- **Issue:** [#165](https://github.com/cascaoconcurseiro/linguaflow/issues/165).
- **Commit:** `88b6160 feat(ui): destacar pronuncia IPA no card e popup`.
- **Feito:**
  - O card de estudo do dashboard agora possui bloco “Pronúncia (IPA)” com tipografia grande, responsiva e atualização anunciável.
  - O popup da extensão agora possui bloco “Pronúncia (IPA)” em 25px; o contêiner inteiro fica oculto quando não há IPA.
  - A pronúncia aproximada em português permanece apoio secundário.
  - Valores vindos de conteúdo persistido/API continuam usando `textContent`; o card limpa a IPA entre apresentações.
  - Adicionado `tests/ipa-pronunciation-display.test.mjs`.
- **Validação:** contratos direcionados de popup/estudo/acessibilidade e `npm run test:release` passaram; `node tests/release-smoke.mjs` passou após o commit com a árvore limpa; `git diff --check` passou.
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
