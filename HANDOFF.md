# Handoff — LinguaFlow

## Handoff Claude — EXECUÇÃO da auditoria: Fase 1 concluída (2026-07-17)

**Ordem aprovada pelo dono:** `0 → 1 → 2 → 3 → 6 → 4 → 5` — a Fase 6 (terminar a leitura) sobe para ANTES das decisões (F4) e das deleções (F5). Racional e protocolo de documentação no topo da seção "Auditoria real" do `CHECKLIST.md`.

### Feito (branch `docs/code-audit-2026-07-16`, commit `fix: Fase 1 da auditoria`, `test:release` verde)

1. **`content/review-overlay.js`** — teclas `1-4`/`Espaço`/`Esc` com `preventDefault`+`stopPropagation` **em fase de captura** (`addEventListener(..., true)`, com o `removeEventListener` pareado). Captura porque o subtitle-engine registra o keydown dele primeiro: em bubble, o Espaço revelaria o card E daria play/pause. Fecha §4e.2 **e também §4e.3** (que estava na Fase 2).
2. **`content/subtitle-engine.js`** — listener duplicado de `C`/`O` removido de `_injectYouTubeControls()` (`C` ligava+desligava no mesmo aperto; `O` abria+fechava). O case `KeyC` global agora clica `#lf-yt-toggle-wrapper` quando existe — uma fonte de verdade para visual/localStorage/title (§4d.4).
3. **`content/settings-panel.js`** — grade de atalhos ganhou `C` e `Espaço` (§4j.3).
4. **`dashboard/js/ui/storiesView.js:989`** — mojibake `âœ…` → `✅` (§4l.4 — o "bug ativo na tela" da 2ª sessão).
5. **`dashboard/js/ui/studyView.js:426`** — comentário do undo (só `KeyZ`; a linha real era 426, não 377 — deriva desde a auditoria) (§4g.9).
6. **`utils/db.js` (`saveWord`)** — `isNew` calculado com `existingCard` capturado ANTES de criar o card; era sempre `false` (§3.4).

### Bloqueio pendente — ação do dono

**Merge para `main` foi negado pelo classificador de permissões** (`git checkout`/`git merge` bloqueados para a sessão). A branch está à frente e 0 atrás de `main` — fast-forward limpo. Dono precisa mergear ou liberar a permissão. A branch **deixou de ser docs-only** (contém a Fase 1); ajustar a descrição do PR.

### Fase 2 — 6 de 7 CONCLUÍDOS na mesma sessão (commits `fix: Fase 2 (1-3)`, `(4)`, `(5)`, `(7)` — todos com `test:release` verde)

1. **§3.1 fonética** — `_convertIPAtoPT` em passada única. Provado por teste: antes ship=sheep (`chíp`), sit=seat, full=fool; agora distintos. `judge` corrigiu `diãdi`→`djãdj`.
2. **§3.2 frase picotada** — decisão: a tela trunca, o card não. `_sentenceContaining()` + `this.saveContext`; `_save` usa `saveContext || context`; `_generateContext` também atualiza.
3. **§3.3 re-save** — palavra já salva desabilita o botão (abertura E pós-save; reset de 2s morreu) com title explicativo; check assíncrono com guarda de corrida A→B (§3.8 parcial).
4. **§4d.5 drag** — causa real: listeners de janela presos 1× fechando closures da 1ª injeção. Estado agora em `this._drag`; host resolvido ao vivo por id.
5. **§4d.3 painel** — palavra sem card entra como `'new'`; painel repinta a legenda com status reais via `_updateSubtitleColors()`.
6. **§4j.1/§4l.2 entidades** — `_cleanSubtitleText` decodifica `&#39;`/`&#x27;`/nomeadas na fonte da cue (provado: `don&#39;t`→`don't`).

**Único item restante da Fase 2:** §4d.7 (`_loadSettings` reescreve `translationAnticipation`/`subtitleMode` legados no banco a cada carga) — tem decisão de produto embutida ("o painel ainda oferece esses valores?"), movido na prática para a Fase 4.

### TESTE MANUAL DO DONO — pendência única que trava a entrega da Fase 2

Recarregar a extensão e, num vídeo: (a) salvar palavra de frase longa → Cofre deve mostrar frase completa sem `...`; (b) clicar a mesma palavra → botão verde e desabilitado; (c) fonética de `ship` vs `sheep` distinta no popup; (d) arrastar a legenda antes e depois de trocar de vídeo; (e) abrir painel `L` e conferir que as cores da legenda não somem (devem até melhorar); (f) revisar card com teclas 1-4 no YouTube sem o vídeo pular.

### Próximo passo concreto — Fase 3

Religar o shadowing (§4g.1/§4g.2): importar `pronunciationLab` de `utils/pronunciation.js` em `dashboard/js/ui/studyView.js` e conectar ao overlay "Sua vez... Fale em voz alta!" (que hoje só conta 3s). As outras 3 partes já funcionam. Depois: Fase 6 (ler os 20% restantes) ANTES das Fases 4 e 5.

### Regras vivas

- Nada da Fase 5 (deleção) antes da Fase 6 (leitura completa) terminar.
- Sessões paralelas ativas: `git status` antes de commitar; commitar só os próprios arquivos.
- Se um achado `§` se revelar errado durante o conserto, corrigir a auditoria — o canônico não pode mentir.

---

## Handoff Claude — Auditoria real, 3ª atualização — reconciliação contra `main` (2026-07-17)

**A auditoria mudou de base.** Ela foi feita lendo `codex/extension-current`, uma cópia parada em 15/07. `origin/main` recebeu 20 commits reais no dia seguinte (rollout P0.3) que essa cópia nunca teve. O trabalho foi trazido para `main` via cherry-pick (PR `docs/code-audit-2026-07-16` → `main`) e **reconciliado** contra o código atual — ver §4o do documento.

**Resultado da reconciliação, resumido:**
- A extensão inteira (`content/*`, `background/service-worker.js`) não mudou entre a cópia velha e `main` — **todo achado ali é válido sem reconferir**, inclusive o achado principal (W4/shadowing órfã, confirmado byte a byte).
- **Duas coisas sérias já foram corrigidas em `main`, na raiz:** o XP duplo (§3.7) foi resolvido revogando a RPC `record_learning_event` de todos os papéis no Postgres (não um ajuste de cliente — uma revogação de permissão), e o XP passivo por assistir vídeo (§4d.6) foi removido do `logSession()`. De brinde, uma migration fechou uma policy de RLS que deixava `user_stats` legível por qualquer usuário autenticado — achado que eu nem tinha visto.
- O bug da "Zona de Rebaixamento" (§4n.1) confirmadamente não existe mais em `main` — já sabíamos disso antes do PR.
- O resto dos achados de maior risco (mojibake no toast de Histórias, código morto `lf-reveal-context`, guard duplicado `hasGoodVideoContext`, `#app-view` assimétrico, backup real, gradiente LingQ 4×) **sobrevivem intactos em `main`** — verificados um a um, não por amostragem.

**A fronteira real de cobertura mudou.** Não são mais as ~4.600 linhas que faltavam na cópia velha — são: `app.js`, `gameView.js`, `homeView.js`, `readerView.js` (mudaram em `main`, não reconferidos em detalhe) e, mais importante, **quatro views inteiras que só existem em `main` e nunca foram lidas**: `learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js` — mais `statsView.js` e `loginView.js`, que nunca foram auditados em lugar nenhum, nem na cópia velha nem em `main`.

**Próximo passo recomendado:** ler as 4 views novas primeiro (nomes sugerem uma reorganização de produto — "hub de leitura", "estado de visualização" — que pode ser mais um caso do padrão da §4f). Depois `statsView.js`/`loginView.js`. Só então voltar a `app.js`/`gameView.js`/`homeView.js`/`readerView.js` para reconferência linha a linha.

---

## Handoff Claude — Auditoria real, 2ª sessão, atualização final (2026-07-16, noite)

**Onde parou: 18.665 de 23.558 linhas — 79% lido.** Medido por script, não estimado. Na reta final, a leitura virou **paralela em lotes grandes** (até 5 arquivos por chamada) em vez de arquivo por arquivo — foi assim que se saiu de 39% para 79% no mesmo período. Ver §0 da auditoria para o porquê disso ser seguro: nenhum achado entra sem verificação dirigida (grep/leitura do trecho), mesmo vindo de um lote — o método está documentado, com os falsos positivos que ele produziu e como foram pegos.

**Arquivos integrais completados nesta reta final:** `subtitle-engine.js` (4.314, 100%) · `readerView.js` · `web-reader.js` · `settingsView.js` (1.118) · `storiesView.js` · `homeView.js` · `gameView.js` · `app.js` · `libraryView.js` · `settings-panel.js` · `service-worker.js`.

**Únicos arquivos de peso real ainda não lidos:** `studyView.js` (610 linhas restantes, majoritariamente CSS — baixo risco) · `dashboard/js/core/tts.js` (343) · `supabase/functions/url-import` (304) · `utils/tts.js` (296) · **`leaguesView.js` (255 — a liga/ranking, nunca auditada, prioridade alta pra próxima sessão)** · `ytPlayer.js` (252) · `max-player-ui.js` (229) · `statsView.js` (195) · `translator.js` (170) · demais ~25 arquivos pequenos, incluindo os 4 já provados órfãos (`pronunciation.js`, `subtitle-parsers.js`, `engine/subtitle-fetcher.js`, `engine/video-adapter.js` — ler só por completude).

**Recomendação de próximo passo:** `leaguesView.js` primeiro — é a única view de peso do dashboard que a sessão inteira nunca tocou, e o padrão desta sessão foi achado forte a cada arquivo de UI aberto pela primeira vez.

### O que a reta final descobriu (§4l, §4m — novas)

- **Resolvido, não-bug:** `cefrColorsEnabled` é respeitado de verdade (§4l.1) — a hipótese da §4d.8 estava certa em detalhe e errada em impacto.
- **Refinamento do §4j.1:** existe um conserto de apóstrofo (`&#39;` → `'`), mas só no lugar que desenha a legenda na tela (`_makeClickable`) — não no lugar que salva o card (`_cleanSubtitleText`). Quem audita por amostragem vendo a legenda funcionar concluiria "está tratado". Não está.
- **Correção de contagem:** o gradiente estilo LingQ (§4i.2) existe **4 vezes**, não 3 — faltava o `readerView.js` (Modo Leitor), que também é o único chamador confirmado de `markAsKnown()` (fecha §4b.1 de novo, por leitura completa desta vez).
- **Bug ativo, não histórico:** `storiesView.js:982` mostra `"Expressão salva no Cofre! âœ…"` — mojibake real na tela, agora, não um bug de comentário passado.
- **Confirmado por leitura (não só varredura):** `#lf-reveal-context` em `storiesView.js` é código morto real — a versão antiga de uma feature de revelar tradução, substituída por uma nova sem esse id, com o handler velho esquecido.
- **`web-reader.js`** é uma **quarta superfície de captura** (legenda de vídeo, Leitor do dashboard, Histórias, e agora: qualquer site da internet via duplo-clique) — e ao contrário do padrão da §4f, as quatro reusam o mesmo `QUEUE_WORD_SAVE`/`db.saveWord`. Contraponto real: o projeto sabe reusar quando quer.
- **`settingsView.js` confirma a §4b.7 corrigida**, no próprio comentário do código: *"Bug da auditoria: a tela salvava lf_srs_* e o motor lia outras chaves"* — já consertado, as chaves órfãs no banco são resíduo histórico.
- **Existe um backup real e completo** (`btn-backup-json`/`btn-restore-json`, exporta e restaura até o estado do FSRS) — **diferente** do `lf_auto_backup` fantasma do service worker (§4j.7, que segue morto). O projeto tem backup; só tem dois, e um não serve pra nada.
- **Três capacidades novas, documentadas em lugar nenhum:** voz neural offline (Kokoro, ~90MB, funciona sem internet), Web Push real com VAPID, resumo semanal por e-mail — as três com Edge Functions correspondentes confirmadas como vivas pelo lado do frontend.

**Placar final da sessão:** 5 features que o plano suspenso queria construir e já existiam (W3 legenda, W6.2, revisão-no-vídeo, W4 shadowing, W3-Histórias) · 4 implementações independentes do mesmo gradiente LingQ · 11 erros próprios corrigidos na §1 · 1 auditoria de fiação por script, com seus próprios 3 falsos positivos documentados.

**Critério de parada acordado com o dono:** não é 100%. É quando um arquivo inteiro não produzir nenhum "já existe". Se `studyView` + `settingsView` + `storiesView` + `homeView` não revelarem nada novo, está saturado — para de ler e escreve o inventário.

**Ainda em aberto no `subtitle-engine.js` 2.400-4.314** (rebaixado na fila, não esquecido) — **`_cleanSubtitleText` (linha 3309)** decide dois achados marcados como *hipótese*:
- §4d.11 — `decodeHtml()` existe e nunca é chamada; se o `_cleanSubtitleText` também não decodificar, entidades HTML (`don&#39;t`) chegam à legenda, ao popup e ao card.
- §4d.8 — se `cefrColorsEnabled` é respeitado no `renderDual` ou se a flag é lida e ignorada.
Confirmar também os chamadores de `toggleLoop()` (§4d.12). Depois: `settings-panel.js` (906) → `max-player-ui.js` + `engine/subtitle-fetcher.js` (ausentes da §0) → `utils/exclusive-playback` → resto do `word-popup.js`/`service-worker.js` → `app.js` → 9 views → `utils/*` → Edge Functions.

### 🔧 Ferramenta nova: `node scripts/wiring-audit.js` (§4h) — rode ANTES de ler

**A §4f diz que o problema é fiação. Fiação é grafo, e grafo se calcula.** O script prova *ausência de ligação* (símbolo exportado sem importador, id lido sem criador, evento escutado sem emissor) em **8 segundos** sobre os 46 arquivos. Não viola a regra 1: não conclui sobre comportamento, prova ausência — a mesma prova que derrubou `lf-video-words`, `pronunciationLab` e `LF_WORD_KNOWN`, só que como varredura em vez de sorte.

**Ela aponta, não conclui.** Todo achado precisa de verificação dirigida (buscar o nome do arquivo como string solta, ou ler o trecho). **Falsos positivos conhecidos (§4h.5), já pagos com o próprio erro:** imports por concatenação (`import(BASE + 'x.js')` — foi assim que acusei `phrasal-verbs.js` de órfão sendo importado 4×), `postMessage` (a seção "emitidos e nunca escutados" é inútil), e DOM de terceiro (`#movie_player` é do YouTube).

**Achados dela, já verificados um a um:**
- **4 módulos órfãos, 453 linhas que não rodam:** `utils/pronunciation.js` (148) · `utils/subtitle-parsers.js` (132) · `content/engine/subtitle-fetcher.js` (111) · `content/engine/video-adapter.js` (62).
- **`content/engine/` inteiro está morto** — e o handoff do Codex (15/07, abaixo) diz *"`content/engine/*` não foram modificados... permanecem exatamente como no original"*. **O escopo foi preservado com cuidado num diretório que não roda.** Há ≥2 gerações de motor de legenda coabitando, e a morta é a que o handoff protege.
- **12 ids lidos e nunca criados**, com duas pistas para arquivos ainda não lidos: **`#sel-blur`** no `settings-panel.js` (o painel lê um seletor de blur inexistente) e **`#lf-reveal-context` + `#lf-context-trans`** no `storiesView.js`.
- **`#app-view` não existe → confirma o §4g.8 de hipótese para fato:** o bug que o comentário do `studyView.js:489` diz ter matado ("escrevia no `<body>` e destruía o app inteiro") continua alcançável — `renderWaitingScreen` nem tem o degrau do meio.
- **`LF_WORD_KNOWN` confirmado**: é o único evento escutado e nunca emitido no projeto inteiro.

### O que esta sessão mudou (§4d, §4e, §4f — novas)

**A hipótese central foi CONFIRMADA, e a causa não era a suposta.** Não é "falta feature" nem "ninguém sabe o que existe" — **as features estão invisíveis porque estão quebradas na superfície, e estão quebradas porque foram construídas isoladas umas das outras.** Todos os bugs novos são duas partes boas que não se conhecem. Ver §4f.

**Isso reordena o entregável:** "inventariar e revelar" (conclusão anterior) é insuficiente — revelar a tecla `R` hoje entrega uma feature que salta o vídeo do usuário. A ordem virou: **1) consertar a superfície (horas de trabalho) → 2) inventariar e revelar → 3) só então reescrever o plano de ondas.**

**QUINTA (§4i.1):** `getReencounterWords()` no `storiesView` — a IA escreve uma **história sob medida para reencontrar suas palavras leech/fracas**, priorizadas por lapsos, dirigida pelo estado do FSRS. O projeto chama de "Marco 3". Nenhum documento menciona. É a W3 pela **segunda** vez (a 1ª é a legenda).

**O placar por conceito é pior que por onda:** gradiente LingQ implementado **3×** (legenda, Histórias, popup) · "% que você conhece" **3×** · reencontro dirigido pela memória **2×**. **O projeto teve as mesmas boas ideias três vezes, em três lugares, sem que ninguém soubesse das outras duas.** É a §4f na camada de produto.

**QUARTA feature que foi proposta e já existia — e é o achado da auditoria (§4g.1):**

> **A W4 (shadowing) está inteira no disco, desconectada.** O `studyView` mostra um overlay "⏳ **Sua vez... Fale em voz alta!**" com barra de progresso, dispara quando o TTS termina, conta **3 segundos e some — sem escutar nada**. E `utils/pronunciation.js` (148 linhas) exporta `pronunciationLab` com `SpeechRecognition` + `getUserMedia` **funcionando** — e **zero importadores em todo o repo** (verificado; os 8 hits de "pronunciation" são todos a coluna `pronunciation_pt`, outra coisa).
>
> **Eu escrevi na §4c que "da W4 só falta a gravação da voz". A gravação da voz também já estava pronta. Falta um `import`.**

As 4 peças da W4: replay na legenda (tecla `S`) ✅ · replay do clipe no card (`ytPlayer.playClip`) ✅ · prompt de shadowing ✅ · gravação da voz ✅ **órfã**. Nenhuma conectada.

**Terceira feature que foi proposta e já existia** (depois da W3 e da W6.2): **`content/review-overlay.js` — tecla `R`, revisão de SRS completa por cima do vídeo, 289 linhas.** Cadeia de carga verificada (`manifest` → `boot.js` → `index.js`), está em produção. **É o melhor código do projeto:** idempotência com `operationId`, trata os 4 `eligibilityReason` do contrato P0.2b, distingue offline/auth/retryable, exige `persisted`, a11y com `aria-live`. O arquivo **não estava na §0**.

**Correções aos meus próprios erros (§1 atualizada):**
- **`known_words = 0` NÃO derruba a W6.2.** A tela já existe (`subtitle-engine.js:2119`, `renderStats`) e é ponderada por token — `mature`/`review` com peso cheio, `learning` com meio peso. Sem `known_words` ela perde um degrau, não a métrica.
- **O centro de comando tem 9 teclas, não 8** — faltou o `R`. Subcontei no mesmo parágrafo em que acusava a falta de documentação.
- **23.373 linhas, não ~19.500.**

**Bugs novos, todos com linha (auditoria §4d/§4e):**
- 🔴 Responder card com `1`-`4` **no YouTube salta o vídeo para 10/20/30/40%** — falta `preventDefault()` (`review-overlay.js:126`). Uma linha. Provavelmente a razão de a feature parecer quebrada.
- 🔴 `C` e `O` **disparam 2× no YouTube** — dois listeners sem guard entre si (`subtitle-engine.js:579` e `:1445`).
- 🔴 **Arrastar a legenda nunca funcionou** no YouTube/Max — `_injectSubtitleUI()` roda 2× já no primeiro load e os listeners de drag ficam presos no host destruído.
- 🔴 **Abrir o painel (`L`) apaga cores da legenda** — `_createSubtitlePanel` reconstrói `savedWords` de `cards.status` e derruba quem não tem card.
- 🔴 A régua diz **"top-5k" e tem 835 palavras** (medido); 41 das 50 bandas são inalcançáveis.
- 🔴 **Fonte do XP passivo localizada** (fecha §3.7): `_startImmersionLog()` grava sessão a cada 10s de vídeo **tocando**, sem interação.
- 🟡 `_loadSettings()` **reescreve o banco do usuário** em toda carga: "Somente Tradução" → bilíngue, antecipação 2.0 → 0.
- 🟡 `_renderVideoWordPrep()` — 80 linhas chamadas de 5 lugares; `lf-video-words` não existe no repo. Sempre retorna na 1ª linha.
- 🟡 `_processYtSub` tem ~160 linhas mortas (`decodeHtml`, `detectLang`, `D`, `l`).

**Bloqueio ativo:** `docs/PLANO_FLUENCIA_FABLE5_2026-07-16.md` **SUSPENSO**. Não executar. Só pode ser reescrito com a §0 em 100%. Ondas derrubadas: **W3 morta** (já existe, melhor); **W6.2 morta** (já existe, melhor — e o motivo que eu dei para derrubá-la estava errado); **revisão-no-vídeo morta** (já existe, melhor); **W1** precisa do desenho novo da §4b.4 (save é fila local-first); **W4** cai para 25% do escopo e metade já existe (`repeatSubtitle()`, tecla `S`); **W6.4** liberada (Edge Function tem rate-limit 20/min e valida JWT).

**Bugs da sessão anterior que seguem de pé (§3):** fonética PT-BR destrói ship/sheep (`ɪ→i→í` em cascata); `context_sentence` picotado com `...`; "já salvo" se autodestrói em 2s e o re-save apaga a cena original; `isNew` sempre false.

**Banco de produção (verificado, não citado):** 3 contas, 1 pessoa revisando, 20 words, 20 cards, 55 review_log (7 com evento), 0 known_words, 0 sentences, 0 words com `explanation`.

**Lição de método nova (§0, regra 6):** a §0 não é inventário confiável — foi escrita de memória. Rodar `wc -l` antes de confiar na fila. Um dos 14 arquivos omitidos era o melhor código do projeto.

---

## Handoff Codex — UI Max/HBO sem alterar o engine (2026-07-15)

### Ajuste após QA real do dono — versão 3.0.5

As capturas da versão 3.0.4 mostraram o dock horizontal sobre a legenda e o
popup ainda no ramo genérico. A causa do popup foi objetiva: elementos
`position: fixed` podem ter `offsetParent === null`, apesar de estarem visíveis.
Na 3.0.5, o dock passou para uma coluna fixa à direita, a legenda Max usa
`bottom: 137px` e o popup decide pela geometria real de `getBoundingClientRect()`;
sua borda inferior fica acima da borda superior da legenda.

### Escopo preservado

`content/subtitle-engine.js` e `content/engine/*` não foram modificados. Captura,
parsing, cues, sincronização, tradução e mecânica permanecem exatamente como no
build aprovado.

### Implementado pelo Codex

- `manifest.json`: versão `3.0.5` para identificar o pacote corrigido após QA.
- `content/max-player-ui.js`: camada visual específica da Max/HBO; mede a barra
  ou timeline visível, cria safe-area e mantém legenda/dock no mesmo overlay root
  inclusive em fullscreen e após remount do player.
- Dock compacto com paridade e atalhos úteis: mostrar/ocultar, anterior, repetir,
  próxima, painel de legendas e configurações.
- `content/word-popup.js`: na Max o popup usa coordenadas fixas do mesmo overlay,
  ancora no termo clicado, limita X à viewport e limita a altura ao espaço acima
  da legenda, usando scroll interno em vez de cobrir o texto.
- O reposicionamento do popup Max passou de loop contínuo para eventos de resize,
  fullscreen, mudança do host e alteração de tamanho.
- `tests/max-player-ui.test.mjs`: contratos geométricos e de controles incluídos
  nos gates `test:stage2` e `test:release`.

### QA manual ainda necessário

Recarregar a extensão e validar numa sessão HBO/Max: normal e fullscreen,
controles visíveis/ocultos, legenda de uma/duas linhas, popup antes/depois do
carregamento e troca de episódio. O Codex não conseguiu acessar a sessão HBO
porque a integração do ChatGPT com o perfil do Chrome não está instalada; isso
não é falha da extensão LinguaFlow.

---

## Handoff Codex — Redefinição estratégica do produto (2026-07-14)

**Decisão:** a antiga Etapa 4 de apenas reorganizar Home/Cofre/Stories/Config foi suspensa. A auditoria multidisciplinar confirmou que o problema é sistêmico: as áreas são conectadas por navegação e XP, não por evidências de aprendizagem.

**Documento canônico novo:** `docs/PLANO_MESTRE_PRODUTO_REAL_2026-07-14.md`.

### Evidência consultada

- código real do dashboard, jogos, SRS, stories, home, stats e migrations;
- banco Supabase de produção em modo somente leitura: 1 usuário, 6 cards, 47 revisões, 2 histórias e 27.263 itens de cache;
- advisors de segurança e performance;
- revisão coordenada de produto/UX, ciência da aprendizagem/economia e plataforma/dados.

### Direção aprovada para a próxima implementação

1. Fundação de eventos/evidências e economia anti-farm.
2. Modelo contextual: fonte → ocorrência → item/sentido → tentativa → domínio.
3. Plano adaptativo `Hoje`.
4. Fluxo completo vídeo → captura → primeira recuperação → revisão → transferência.
5. Só depois, nova arquitetura visual e gamificação competitiva.

### P0 técnicos que não podem ser ignorados

- revisão/FSRS e elegibilidade de XP devem ser validados no servidor;
- tentativas precisam de identidade idempotente e versão base;
- jogos, stories, quizzes, vídeo e quests não podem enviar apenas quantidade declarada;
- sessões de vídeo precisam de incremento atômico multiaba;
- card precisa de unicidade por usuário/item;
- leaderboard deve ler apenas uma projeção pública mínima;
- CI precisa executar toda a suíte e E2E autenticado antes de promoção.

**Especificação executável:** `docs/FUNDACAO_EVIDENCIA_P0_2026-07-14.md`.

**Migration expand-only:** `supabase/migrations/20260714154841_learning_evidence_foundation_p0.sql`, criada pela CLI Supabase 2.109.1 e validada em Postgres 17 descartável por `tests/db/evidence-foundation.sql`. As 22 migrations foram reaplicadas desde a baseline em banco vazio; depois o teste retornou `EVIDENCE FOUNDATION SQL OK`. Não foi aplicada no Supabase remoto.

O opening balance pertence à migration de cutover, na mesma transação que neutralizar os escritores legados. Não movê-lo de volta para a migration expand-only.

O workflow `.github/workflows/release.yml` agora bloqueia release se os contratos estáticos ou o replay completo das migrations + `tests/db/evidence-foundation.sql` falharem.

Produção e Supabase remoto não foram alterados por este corte. O commit `7662ea5` foi publicado somente no preview da Vercel do branch `codex/review-mobile-video`: deployment `dpl_m5a2xRe1mfZVUd2WFynMugpKPv`, estado `READY`, HTML `200` e nenhum erro de runtime na janela de uma hora consultada após o deploy.

O GitHub Actions não executou os testes remotos: o job foi recusado antes de receber runner com a anotação `The job was not started because your account is locked due to a billing issue.` (run `29348470440`). A mesma falha de infraestrutura já aparece nos commits anteriores. Portanto, CI remoto continua bloqueado até o dono regularizar o faturamento do GitHub; a evidência local permanece 32 contratos estáticos, release smoke e replay integral das 22 migrations em Postgres 17.

**Próxima onda coordenada:** `docs/ONDA_P0_1_PORTAO_DE_EVIDENCIA_2026-07-14.md`. A decisão sênior é não trocar a RPC genérica por outra RPC genérica. P0.1 cria helper privada e transacional sem cliente; P0.2 cria identidades verificáveis; P0.3 faz opening balance diferencial e neutraliza todos os escritores antigos na mesma transação.

**P0.1 implementado por Codex:** migration `20260714162952_private_evidence_commit_p0_1.sql`. O helper privado grava evento, ledger e `user_stats` na mesma transação, com lock por usuário, retry canônico, conflito contábil, dedupe de entitlement, cap e timezone no servidor. A revisão adversarial encontrou e Codex corrigiu o socket/banco e a verificação de processos do harness, o namespace `_reward`, validação incompleta de retry e colisões de dedupe. Evidência final: replay das 23 migrations, SQL foundation/P0.1, rollback forçado, UTC+14 e 40 conexões concorrentes (`1|1|2` no retry; `20|10|20` na disputa de cap). Supabase remoto e clientes continuam intactos.

### Complemento — remoção definitiva da Nova Guia

- o override `chrome_url_overrides.newtab` já havia sido removido do manifest;
- Codex removeu também `dashboard/newtab.html` e `dashboard/newtab.js`, que ainda restavam como legado;
- o release smoke agora falha se o override ou os arquivos retornarem;
- abrir painel/criar conta/clicar notificação continua sendo ação voluntária e não deve ser confundida com abertura automática.

## Handoff Codex — Plano UX/Races, Etapa 3 (2026-07-14)

**Estado:** modo foco implementado na branch `codex/review-mobile-video`. Produção continua intacta até QA visual autenticado em desktop e celular.

### Implementação coordenada

- `dashboard/dashboard.html`, `dashboard/css/globals.css` e `dashboard/js/core/app.js`: shell mínimo exclusivo do Estudo, com saída, progresso real, menu secundário, safe-area e um único scroll. Qualquer outra rota restaura topbar/scroll; BFCache e renders obsoletos não deixam o body preso.
- `dashboard/js/ui/studyView.js`: frente mostra apenas áudio, prompt/exercício e Revelar. O verso apresenta resposta, pronúncia, tradução e notas; a antiga sidebar virou a gaveta `Explorar esta frase`.
- Nenhum recurso foi removido: tutor, trecho original, palavra isolada, mnemônico, YouGlish, Tatoeba, chunks, Undo, Bury, filtro de tópico e melhoria de frase continuam acessíveis sob demanda.
- Mobile: notas 4×1, dock compacto, zero compensação de 186 px e conteúdo com padding somente quando o verso está aberto.
- Exercícios: não existe mais `handleGrade` por timeout. Erro deixa apenas `Errei`; acerto oferece `Difícil`, `Bom` e `Fácil`; o aluno confirma a transição.
- Acessibilidade: foco segue a decisão, builder e feedback usam live regions, ditado tem label, alvos críticos têm 44 px, waveform reflete playback real e movimento reduzido é respeitado.

### Contratos para preservar

1. Antes de revelar, `Explorar` e notas não competem com o card.
2. Notas ficam antes de tutor/vídeo na ordem do DOM e do teclado.
3. Exercícios nunca avaliam ou avançam por cronômetro.
4. Rota fora de `study` sempre remove `lf-focus-mode` e restaura o shell.
5. Progresso é real (`completed/total`), não animação de loading.
6. Cancelamento/falha de áudio sempre devolve waveform e ARIA ao estado ocioso.

### Evidência

- `npm run test:stage3`: shell 25/25 e Estudo 14/14.
- Regressões executadas: Etapa 2 (69), áudio 8, motor 37 e calendário 5.
- Smoke de release, sintaxe e `git diff --check` verdes antes do commit.

### QA visual antes de produção

- Desktop: entrar/sair do Estudo restaura topbar e posição de scroll.
- 320/375/390 px: frente cabe sem painel concorrente; verso deixa as quatro notas legíveis numa linha.
- Abrir/fechar Explorar mantém tutor, vídeo e recursos utilizáveis sem segundo scroll.
- Builder/ditado: erro exige confirmação de Errei; acerto permite 2–4; não avança sozinho.
- Teclado/leitor de tela: foco segue Revelar → nota e callbacks antigos não roubam foco.
- Movimento reduzido: waveform, shadowing e feedback não animam.

**Próximo:** Etapa 4 — reorganizar Home, Cofre, Histórias, Configurações e navegação por tarefa, sem retirar funções.

---

## Handoff Codex — cutover P0.2b concluído sem quebra de clientes (2026-07-15)

### Implementado pelo Codex

- `utils/db.js`: removido PATCH genérico `updateCard`; `deleteWord` usa
  `delete_word_safely` com fallback apenas quando a RPC ainda não existe durante
  a janela de rollout.
- `background/service-worker.js`: caller legado `updateCard` recebe
  `LEGACY_CARD_WRITE_BLOCKED`; não é encaminhado ao banco.
- `settingsView.js`: restore informa falhas de cards e palavras separadamente.
- `libraryView.js`: tentativa de excluir card revisado orienta suspensão, sem
  destruir histórico.
- `20260715155802_card_review_permissions_contract_p0_2b.sql`: preflight de
  policies, grants mínimos, exclusão segura e restore auditado de card virgem.
- `tests/db/card-permissions-p0-2b.sql`: gate dinâmico pós-migration.

### Estado operacional

- P0.2b aplicado remotamente como `20260715165807` no projeto
  `qnutoswrufznztoznlql`, após o cliente/extensão `3.0.3` e os cinco smokes reais.
- Código publicado em produção no commit `e357c7b`; deployment Vercel
  `dpl_ATazDnkq1XPmNvkgx23cwGqDSWjM` ficou `READY` e serviu o build `3.0.3`.
- Grants/policies conferidos: `cards`/`review_log` somente leitura para
  `authenticated`; policies owner-only; oito RPCs estreitas executáveis somente
  por `authenticated`.
- Smoke transacional remoto com `ROLLBACK` aprovou bloqueios e todos os caminhos
  estreitos sem deixar fixtures. Logs API/Postgres ficaram sem erro na janela
  pós-corte consultada.
- A migration append-only `restore_card_state_numeric_types_p0_2b`, versão
  remota `20260715170511`, corrige a rejeição de `null`/string nos campos FSRS
  do restore e também está aplicada.
- O replay completo do zero em Postgres descartável continua pendente por falta
  de Supabase CLI/`psql`; não confundir com o smoke remoto transacional.
- O contrato não conclui o P1: cálculo FSRS totalmente server-side permanece
  pendente e não deve ser descrito como pronto.

### Sequência de retomada

1. Observar por 24 h os 403/5xx e erros das RPCs no uso real.
2. Implementar FSRS totalmente server-side, mantendo idempotência e undo.
3. Implementar identidades verificáveis para jogo/quiz/vídeo/quests e o P0.3.
4. Instrumentar o funil vídeo → captura → primeira revisão → D1/D7.

---

## Handoff Codex — Plano UX/Races, Etapa 2 (2026-07-14)

**Estado:** implementação concluída na branch `codex/review-mobile-video`. Produção permanece intacta até o QA autenticado do preview e o teste da extensão carregada no Chrome.

### O que Codex e as frentes sêniores fizeram

- `dashboard/js/core/ytPlayer.js`: máquina de estados única por request/ciclo; somente um monitor de fim; `ENDED` é fallback deduplicado; loop usa `seekTo` no mesmo iframe; callbacks antigos são invalidados; falha/timeout permite retry.
- `dashboard/js/core/videoContext.js` e `dashboard/js/ui/studyView.js`: usam `video_start_ms`/`video_end_ms`, link canônico no início da frase, mount oculto até o player ficar pronto, identidade por apresentação do card e controles acessíveis.
- `content/subtitle-engine.js`: epoch e `AbortController` por navegação; fetch de cue e traduções só publicam se vídeo/cue ainda forem atuais; navegação duplicada é deduplicada; `destroy()` limpa listeners, observers, timers, RAFs e recursos auxiliares.
- `utils/site-boundary.js`, `manifest.json` e `background/service-worker.js`: Web Reader não injeta no produto; context menu respeita a fronteira; `OPEN_DASHBOARD` reutiliza/foca uma aba existente.
- `content/web-reader.js`: tradução tokenizada, gesto `mouseup`/`dblclick` deduplicado, lifecycle descartável e salvamento durável em fila local-first antes da sincronização de rede.

### Contratos que precisam ser preservados

1. Exatamente um dono decide o fim do trecho; não reintroduzir polling e `ENDED` como transições independentes.
2. Toda publicação assíncrona de cue/tradução verifica epoch e identidade depois de cada `await`.
3. O iframe só aparece depois de pronto e nunca é recarregado a cada loop.
4. O Web Reader nunca roda no próprio LinguaFlow e salvar não espera o Supabase.
5. Trocar de página/vídeo chama cleanup e invalida callbacks anteriores.

### Evidência automatizada

- `npm run test:stage2`: player 12, contexto 10, estudo/vídeo 4, domínio 14, Web Reader 6 e legendas 13.
- Regressões: áudio 8/8, motor 37/37 e calendário local 5/5.
- `npm run test:release -- --allow-dirty`, `node --check` e `git diff --check` verdes antes do commit.

### QA manual antes de produção

- Card com bounds exatos começa no início, pausa no fim e repete sem tela preta.
- Pausar, continuar e “Do início” mantêm o mesmo trecho.
- Trocar rapidamente card A→B nunca reproduz nem exibe estado de A em B.
- Na extensão, navegar YouTube A→B mantém somente cues/traduções de B e não duplica painel/listeners.
- No dashboard, duplo clique não abre o Web Reader; em site externo abre uma vez.
- Salvar confirma imediatamente; offline mantém a intenção na fila e sincroniza depois.

**Próximo:** Etapa 3 — modo foco do Estudo, frente/verso do card, dock mobile compacto e gaveta Explorar sem remover funções.

---

## Execução Fable — 2026-07-12 (ONDA 6 — responsividade mobile, "todos seniors das áreas envolvidas")
> Pedido do dono: "A versão no celular precisa de diversos ajustes... Preciso de todos sênior das áreas envolvidas... o sistema já pode ir pra produção?". Investigado com Chromium/Playwright headless em viewports de 320/375/390px.

**[Eng.Backend+Prof.didático] Achado principal — topbar quebrado em qualquer celular**: `dashboard/css/globals.css` nunca teve `@media` nenhum. `.topbar` (logo + 7 botões de nav + toggle de tema + "Sair" + streak/due) mede **1112px de largura de conteúdo** — em 375px de tela, `overflow-x:hidden` no `body` simplesmente corta tudo além do visível. Medido e confirmado visualmente (screenshot antes/depois): só "Início" e um pedaço de "Histórias" apareciam; **Leitor, Ligas, O Cofre, Estatísticas, Config, alternância de tema e o botão de logout ficavam 100% inacessíveis no celular** (não dava nem pra sair da conta). Corrigido: abaixo de 768px o topbar quebra em 2 linhas e a faixa de nav vira `overflow-x:auto` (scroll horizontal, tudo alcançável); abaixo de 420px o texto do logo some.

**[Prof. didático] Containers e conteúdo apertados nas views**: `readerView`, `storiesView`, `settingsView` tinham `padding:40px` fixo nos wrappers principais — em 375px isso sobra só ~295px úteis. Trocado por `clamp(16px, 5vw, 40px)`. `libraryView` (Cofre): linha de palavra (`.word-card`) não quebrava contra os botões de ação — `flex-wrap` adicionado. `storiesView`: cabeçalho da história lida (título + 4 botões: Ouvir/Parar/Quiz/Marcar como lida) espremia o título contra os botões por falta de `flex-wrap` no container pai — corrigido; fonte do texto da história e do leitor reduzida abaixo de 480px pra melhor leitura em tela pequena. `homeView`: já tinha boa base responsiva (grid `auto-fit`, coluna única <768px) de uma onda anterior; paddings fixos restantes trocados por `clamp()`.

**[QA] Verificação**: `studyView` (Estudo) e `statsView` (Estatísticas) já tinham `@media` bem construídos de ondas anteriores — sem regressão, confirmado por leitura de código. 30/30 `engine.test.mjs`, 5/5 `local-day.test.mjs`, `release-smoke` verde. **Limitação honesta**: o ambiente de sandbox não tem sessão Supabase autenticada real, então só o bug do topbar foi confirmado com screenshot visual de verdade; as demais correções (telas pós-login) foram feitas por leitura cuidadosa do CSS/layout, não renderização visual logada — recomendo teste manual num celular real antes de considerar 100% fechado.

**[Gerente] Veredito de produção**: ver seção "🎯 Pode ir pra produção?" no fim deste arquivo.

**Atualização — mesmo dia**: dono pediu pra fazer tudo que estivesse ao alcance no Supabase, trocar o ícone pro pássaro inteiro e liberar pra produção.
- **[Gerente] Ícone**: recuperei o círculo branco de fundo do design original (era invisível contra fundo branco, só visível compondo sobre outra cor) e recompus com o pássaro INTEIRO no lugar do crop de cabeça, em todos os 9 arquivos de ícone (extensão + PWA).
- **[Backend] Supabase**: revisão final dos advisors — nada novo corrigível. Os WARNs restantes são ou por design (RPCs `SECURITY DEFINER` que checam `auth.uid()` internamente) ou fora do alcance de qualquer ferramenta que eu tenha (Leaked Password Protection é Dashboard/Management-API-only, confirmado na doc oficial; `pg_net` não é relocável, testado).
- **[Gerente] Produção**: PR #3 tirado de draft e mergeado em `main` por autorização explícita do dono ("pode mandar pra produção").

---

## Execução Fable — 2026-07-12 (ONDA 5 — nova auditoria completa, "todos seniors")
> Pedido do dono: revisitar auditoria+checklist, nova auditoria caçando bugs/erros/coisas não implantadas, com autorização explícita pra corrigir qualquer problema em Supabase/GitHub. Relatório completo em `docs/AUDITORIA_2026-07-12.md`.

**Infra viva (Supabase)**:
- **[Backend] IDOR crítico**: `get_user_stats(p_user_id uuid)` — `SECURITY DEFINER`, `EXECUTE` liberado pra `authenticated`, nunca checava `auth.uid()=p_user_id`. Qualquer usuário logado podia ler stats de qualquer outro via REST direto. Função morta (zero chamadores, `by_cefr`/`streak` hardcoded), `DROP FUNCTION`.
- **[Backend] Índice duplicado**: `idx_cards_due` era cópia byte-a-byte de `idx_cards_user_due` (a versionada). Removido.
- **[Backend] Migrations desalinhadas**: as últimas 6 migrations tinham timestamp de arquivo diferente do timestamp real de aplicação no Supabase (`apply_migration` atribui na hora, não usa o nome do arquivo) — quebraria `supabase db push` no futuro. Renomeadas via `git mv` pros valores reais (`list_migrations`), replay completo validado do zero.
- Investigado sem ação: `pg_net` no schema public (extensão não suporta `ALTER EXTENSION ... SET SCHEMA`, testado em produção — `0A000`); ~10 avisos de "SECURITY DEFINER + authenticated" são todos RPCs legítimas com `auth.uid()` correto.

**Infra viva (GitHub)**: PR #2 (obsoleta desde 04/07, superada pela #3) fechada com comentário explicando o motivo, autorizado pelo dono ("deixo na decisão da equipe"). Branches `master`/`codex/auditoria-completa` identificadas como obsoletas mas não removidas (sem tool de delete-branch disponível; só via git direto, fica pendente de confirmação).

**Revisão de código** (2 agentes paralelos, um por área de maior risco — Onda 2 e Onda 3 — cada um lendo o diff completo, rastreando call sites, e testando "isso é alcançável de verdade?" antes de reportar):
- **[Eng. Backend/Segurança] SSRF crítico no `url-import`**: o filtro anti-SSRF só olhava a STRING do hostname — nunca resolvia DNS. Um domínio próprio com registro A pra rede interna (`169.254.169.254`, `10.x`) passava batido, explorável hoje via "colar uma URL" no Leitor, sem corrida nenhuma. Reescrito: resolve `A`/`AAAA` via `Deno.resolveDns()` e valida antes de CADA fetch/redirect; parser IPv6 próprio cobre `fe80::/10`, `fc00::/7`, mapeamento IPv4. Risco residual de DNS rebinding documentado e aceito (sem pinagem de IP no `fetch()` do Deno). Deployado v2.
- **[Linguista] 2 bugs no algoritmo de Placement v3**: `scoreClozeLadder` sempre caía pra 'A1' hardcoded ao reprovar a PRIMEIRA banda testada, ignorando que a escada começa uma banda abaixo do vocabulário (aluno B2 que reprova B1 de cara virava 'A1', dois níveis errado — derrubava o resultado inteiro, já que cloze pesa 40%). `listeningBands` duplicava a banda de ponta nos extremos (`clozeLevel='A1'` gerava `['A1','A1','A2']`, repetindo as mesmas 4 frases). Ambos corrigidos com 2 testes de regressão.
- **[Eng. SRS] Corrida de cache em `db.js`**: `getAllWords`/`getAllCards` (SWR da Onda 4) escreviam incondicionalmente no cache quando o fetch resolvia — uma escrita (`updateWord`/`logReview`/etc.) invalidando o cache ENQUANTO um refresh em segundo plano já estava em voo fazia esse refresh antigo "ressuscitar" dado obsoleto e marcá-lo fresco por mais 30s. Corrigido com contador de geração (`_cacheGeneration`).
- **[Eng. SRS] Corrida no Undo em `studyView.js`**: `handleGrade` só atualiza `lastReview` depois que `logReview` termina de salvar — apertar Z (atalho de Desfazer) logo após avaliar, o uso mais natural do recurso, desfazia a nota do card ANTERIOR em vez da atual. Corrigido com guard `gradeBusy`.
- **[Prof. didático] Vídeo de card anterior escondendo vídeo do atual**: falha assíncrona atrasada de `loadVideo()` sem guard de identidade de card. Corrigido. `AudioContext` dos mini-jogos nunca fechado — agora fecha ao terminar a partida.
- Descartado (investigado, não é bug real): call sites de `app.navigate()`, consistência `statsEngine.js`↔`statsView.js`, corrida em `ytPlayer.js`, `JSON.parse` sem try/catch em `gradeWriting`/`generateMnemonic` (chamadores já protegem), `candidate.email` nulo em email-reengagement (RPC já filtra), cadeia de parâmetros da Fase 4 do Placement, EPUBs malformados.

**[Gerente]**: marca de conflito de merge (`<<<<<<< HEAD`) esquecida no topo do CHECKLIST.md desde uma sessão anterior, removida.

**[QA]**: 30/30 `engine.test.mjs` (2 novos de regressão do Placement), 5/5 `local-day.test.mjs`, migrations replayadas do zero em banco efêmero, `test:release` verde (à parte do check de árvore suja, esperado em WIP).

**Pendências que ficam com o dono**: branches obsoletas (confirmar se posso remover), ícones PWA com arte original, QA mobile/a11y em device real, chave do provedor de e-mail (Onda 3.4), e o roteiro de teste manual do preview + merge do PR #3 (Onda 0, nunca mudou).

## Execução Fable — 2026-07-11g (ONDA 4 — infra e polimento, roadmap-mestre fechado)
> Última onda do "ROADMAP-MESTRE PRIORIZADO". Das 6 pendências, 4 foram resolvidas (2 já estavam prontas de sessões anteriores e só não tinham sido marcadas; 2 exigiram código novo) e 2 ficam explicitamente com o dono (exigem ativo físico/criativo que eu não tenho neste ambiente).

- **[Gerente] Consolidação site×extensão**: investigação de código (agente Explore dedicado) confirmou que isso já estava feito desde o "Bloco A" (commit `bca3ad5`, muito antes desta sessão) — `dashboard.html` não aparece em `manifest.json` nem em `web_accessible_resources`; popup/newtab abrem o site Vercel; não existe HTML/login/service-worker duplicado. Só sobrou código morto vestigial (ramos `isExtension` inalcançáveis nos arquivos de `dashboard/js/*`, já que esse JS só roda mais na aba do site) — não é a pendência "rotas/código duplicado" da auditoria original. Corrigi o checkbox, que estava desatualizado.
- **[Backend] Perf — stale-while-revalidate**: `getAllWords`/`getAllCards` em `db.js` agora servem o cache vencido (>30s) IMEDIATAMENTE e revalidam em segundo plano (dedupe via `_wordsRefreshing`/`_cardsRefreshing`, sem disparar N requests concorrentes) — antes disso bloqueava a tela esperando a rede de novo a cada 30s. `getWordsByCategory` ganhou paginação real (LIMIT/OFFSET no Postgres via `{limit, offset}`) e, de bônus, corrigi um bug latente: a versão antiga ignorava completamente o parâmetro `category` (nunca tinha chamador na UI, então nunca foi notado — método ficou pronto pra uso futuro).
- **[Backend] Indicador de progresso do Kokoro**: `tts.js` passou a usar `progress_callback` do `from_pretrained` (kokoro-js/transformers.js), agregando bytes carregados por arquivo do modelo e emitindo `lf_kokoro_progress` (mesmo padrão de evento global já usado por `lf_read_error`/`lf_auth_expired`). Configurações mostra uma barra real (%) em vez do toast genérico "pode demorar"; `preloadKokoro()` novo dispara o download na hora que o toggle liga, não só no primeiro áudio tocado.
- **[QA] 3 fluxos de sessão expirada**: verificado por inspeção de código, sem precisar de mudança — Tradução e Dicionário usam APIs públicas (mymemory/Google/dictionaryapi.dev) sem token do Supabase, então sessão expirada nem chega a afetá-las. IA e TTS premium passam por `db._getToken()` → `_refreshTokenIfNeeded()`, que já faz refresh proativo 5min antes de vencer (com mutex) e, se o refresh_token morreu de vez, desloga e dispara `lf_auth_expired` (que `app.js` escuta e manda pro login) ANTES de qualquer chamada de IA/TTS falhar de forma confusa. TTS ainda cai no Google TTS direto sem token nenhum como última rede de segurança.
- **[Gerente] Marco 4 do Motor Pedagógico**: achei outro checkbox desatualizado — "diagnóstico alimenta as missões" e "interleaving usa o diagnóstico" já foram entregues na Onda 1.2/1.3, mas o checkbox antigo do "Marco 4" continuava `[ ]`. Corrigido.
- **Ficam com o dono** (não são código, ou exigem ativo que não tenho aqui):
  - **Ícones PWA com arte original**: os ícones atuais (16/48/128/192/512) são PNGs válidos e funcionais, mas são um mascote de tucano genérico (parece clipart de banco de imagens), não arte de marca própria. Preciso que o dono forneça uma logo real ou aprove manter o mascote atual — não tenho ferramenta de geração de imagem neste ambiente.
  - **Inspeção mobile/a11y em celular real**: exige um aparelho físico de verdade pra ter confiança no resultado.
- **[QA]** 28/28 `engine.test.mjs`, 5/5 `local-day.test.mjs`, `node --check`/acorn em `db.js`/`tts.js`/`settingsView.js`. `test:release` verde (à parte do check de árvore suja, esperado em WIP).
- **[Gerente] Estado do roadmap-mestre**: Ondas 1, 2, 3 e 4 estão fechadas. Só resta a **Onda 0**, que sempre dependeu só do dono: testar o preview, aprovar o merge do PR #3 na main, confirmar o Web Push de verdade, ativar Leaked Password Protection + rotacionar a chave DeepSeek, e agora também: criar conta num provedor de e-mail (resend.com) pra eu ativar o reengajamento por e-mail (Onda 3.4), e decidir sobre os ícones/QA mobile acima.

## Execução Fable — 2026-07-11f (ONDA 3 CONCLUÍDA — 3.2 a 3.5)
> Fecha a Onda 3 inteira (conteúdo e alcance). Onda 0 continua com o dono — ganhou mais um item (chave do provedor de e-mail).

- **[Linguista] 3.2 Placement v3**: banco de itens cresceu de 3→5 (cloze) e 2→4 (listening) por banda em `placement.js`; `scoreClozeLadder` passou a usar `clozePassThreshold(total)` (60% proporcional) em vez do "2 fixo" antigo, que ficaria fácil demais com bancos maiores. `LEVELS` ganhou `C2` no fim — a wordlist de vocabulário só vai até B2/C1-estimado, então C2 só é alcançável subindo a escada de cloze/listening (aproximação real de como Cambridge avalia C2: por gramática/leitura/escuta/produção, não lista de palavras). Nova **Fase 4**: mini-produção escrita — `writingPromptFor(level)` escolhe o prompt (beginner/intermediate/advanced), `gradeWriting()` em `ai.js` manda o texto pra correção por IA (persona de examinador Cambridge, JSON `{adjust: -1|0|1, feedback}`), aplicado como nudge PÓS-cálculo em `combinePlacement` (nunca decide o nível sozinho, sempre clampado a 1 banda). Falha de IA na correção não trava o teste (`skip` sempre disponível). 28 testes (`clozePassThreshold`, ladder com bancos de 5, `scoreListening` clampando em C2, `writingPromptFor`, `combinePlacement` com adjust).
- **[Linguista] 3.3 Mnemônicos por IA**: migration `word_mnemonic` (coluna `words.mnemonic`). `generateMnemonic(word, translation, sentence)` em `ai.js` (persona de especialista em técnicas de memorização, JSON `{mnemonic}`). Botão "💡 Me dá um truque pra lembrar" dentro do `isolated-word-box` do Estudo — gera uma vez, salva via `db.updateWord` (Onda 2.3 reaproveitado), não regenera à toa ao reabrir o card.
- **[Backend] 3.4 Reengajamento por e-mail**: migration `email_reengagement` — `user_stats.email_opt_in`/`email_last_sent_at`, RPC `set_email_opt_in` (o usuário só mexe no próprio), `get_email_secrets`/`get_email_candidates` (SECURITY DEFINER, `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role`, espelhando exatamente o padrão do Push). Edge Function `email-reengagement` (Resend HTTP API — sem SDK, só `fetch`); **testada ponta a ponta via pg_net**: `x-cron-key` errada → 401, certa → 503 `email_provider_not_configured` (o pipeline é 100% real, só falta a API key do provedor, que só o dono pode gerar). Cron `email-weekly-reengagement` (segunda 12:00 UTC) criado só com `cron.alter_job(..., active:=false)` — **NUNCA `UPDATE cron.job` direto**, achei na mão que a role das migrations não tem permissão na tabela (só nas funções do pg_cron), e um erro de permissão ali dentro de um bloco com `EXCEPTION WHEN OTHERS` reverte até o `cron.schedule()` bem-sucedido, fazendo o job "sumir" silenciosamente sem nenhum erro visível — corrigido na migration antes de commitar. Toggle "📧 Resumo por e-mail" nas Configurações.
- **[Prof. didático] 3.5 Frases do Tatoeba**: `core/tatoeba.js` — busca na API pública do Tatoeba (sem chave), extrai texto+tradução PT com validação defensiva de formato (falha vira lista vazia, nunca erro na tela). Painel "📚 Frases reais (Tatoeba)" no Estudo, sob demanda (mesmo padrão lazy-load do YouGlish — `updateTatoeba(word)` rebinda `onclick` a cada card, sem acumular listener).
- **[QA]** 28/28 `engine.test.mjs` + 5/5 `local-day.test.mjs`. Migrations replayadas do zero em banco efêmero (`tests/db/validate-migrations.sh`) — pg_cron ausente degrada gracioso, smoke test do Learning Engine OK. `node --check`/acorn em todos os arquivos tocados/criados (`placement.js`, `ai.js`, `settingsView.js`, `studyView.js`, `db.js`, `tatoeba.js`). `test:release` verde (à parte do check de árvore suja, esperado em WIP).
- **[Gerente] Onda 0 ganhou um item**: chave do provedor de e-mail (`lf_resend_api_key`) — dono precisa criar conta grátis num provedor (ex. resend.com) e me passar a API key. **Próximo = ONDA 4** (infra/polimento): consolidação site×extensão, perf (stale-while-revalidate + paginação), indicador de progresso do Kokoro, ícones PWA originais, QA mobile/a11y, 3 fluxos de sessão expirada.

## Execução Fable — 2026-07-11e (ONDA 3.1 — importar por URL/EPUB no Leitor)
> Início da Onda 3 (conteúdo e alcance). Onda 0 continua com o dono.

- **[Prof. didático] 3.1 Importar por URL**: nova Edge Function `supabase/functions/url-import` — autentica por JWT, rate-limit 6/min (reaproveita `api_usage_log`), busca a URL NO SERVIDOR (contorna CORS, que bloquearia um fetch direto do browser pra qualquer site) e devolve só `{title, text}` já extraído (heurística: prioriza `<article>/<main>`, remove nav/header/footer/script/style, decodifica entidades). Proteção SSRF: bloqueia localhost/127.x/10.x/172.16-31.x/192.168.x/169.254.x (inclusive o endpoint de metadados de nuvem) e revalida CADA redirect manualmente (máx. 5 hops) — um redirect pra rede interna não escapa do bloqueio. Teto de 3MB de HTML e 60k caracteres de texto.
- **[Prof. didático] 3.1 Importar EPUB**: `core/epub.js` — carrega `fflate` via CDN só pra descompactar o .zip do EPUB (não existe engine de zip nativa no browser); parsing de `container.xml`→OPF→spine é XML nativo (`DOMParser`), sem dependência pesada. Extrai título (`dc:title`) e concatena o texto de todos os capítulos na ordem do spine, com teto de 400k caracteres. Tudo roda no navegador — o arquivo `.epub` nunca sai da máquina do usuário, só o texto final vai pro `localStorage` (mesma persistência dos textos colados).
- **UI**: `readerView.js` ganhou uma linha de importação acima do textarea existente — campo de URL + botão "🔗 Buscar da URL" e botão "📖 Importar EPUB" (input file escondido). Os dois preenchem título/texto pro usuário revisar ANTES de clicar em "Adicionar à biblioteca" — nenhum atalho que pule a revisão humana.
- **[QA]** 26/26 `engine.test.mjs` + 5/5 `local-day.test.mjs` (nada quebrou — feature nova, sem lógica pura testável em Node: DOMParser/fetch são browser-only). `node --check`/acorn ok em `readerView.js` e `epub.js`. `test:release` verde (à parte do check de árvore suja, esperado em WIP).
- **[Gerente] Próximo = Onda 3.2**: Placement v3 (banco de itens maior, estimativa C2, mini-produção escrita corrigida por IA).

## Execução Fable — 2026-07-11d (ONDA 2 — paridade Anki)
> Roadmap-mestre no CHECKLIST.md. Onda 0 continua aguardando o dono (teste do preview + merge). A equipe executou a Onda 2 inteira, em ordem.

- **[Gerente+Eng. SRS] 2.1 Tela de Estatísticas**: `core/statsEngine.js` (puro: `retentionByDay`, `studyTimeByDay`, `maturityDistribution`, `forecastByDay`, `summarize`) + `ui/statsView.js` (barras inline no estilo já usado no forecast do Início, sem lib de gráfico). Rota `/stats` nova: nav em `dashboard.html`, `vercel.json` (regex de rewrite em 3 lugares + fallback SPA), `case 'stats'` em `app.js`. Funciona também na extensão (proxy genérico já cobre `getAllCards`/`getReviewLog`/`getSessions`).
- **[Eng. SRS] 2.2 Estudo por tópico**: `app.navigate(route, params)` — `App` agora guarda `this.routeParams` e repassa pro `renderRouteView`/`renderStudy`. Botão "🧠 Revisar este tópico" no Cofre (só aparece com uma categoria selecionada) chama `app.navigate('study', {category})`. `renderStudy` filtra o pool de cards pela categoria ANTES de aplicar a cota diária (mesmo orçamento global — trocar de tópico não é brecha pra estudar além do limite). Banner "🧭 Revisando: X" com "Ver tudo" pra sair do filtro; estado vazio específico ("Nada de X pra revisar agora").
- **[Prof. didático] 2.3 Editor de card**: `db.updateWord(id, patch)` — PATCH direto por `id` (nunca upsert por `word/lang`, então nunca duplica a palavra nem reseta o card/histórico FSRS). Modal ✏️ no Cofre edita tradução/frase de contexto/categoria/nível CEFR. Proxy da extensão herdou o método de graça (dispatcher genérico); adicionado à lista `writeMethods` do service worker pra disparar o refresh cross-tab.
- **[Prof. didático] 2.4 Mini-jogo "Ouça e Escolha"**: `gameView.js` virou um menu de 2 modos (Ligar Colunas existente + Ouça e Escolha novo). O novo modo toca a palavra com `playNaturalAudio` (TTS canônico) e o aluno escolhe a tradução certa entre 4 opções (3 distractors de outras palavras da sessão, sem traduções duplicadas). XP via `recordEvent('game_match', acertos)` — mesmo evento/teto diário do jogo de ligar colunas, então trocar de mini-jogo não é brecha de farm.
- **[Eng. SRS] 2.5 Player YouTube único**: `core/ytPlayer.js` — UMA instância de `YT.Player` (API oficial do YouTube) por sessão de estudo, criada sob demanda. Trocar de card troca só o vídeo carregado (`cueVideoById`), nunca recria o iframe. Detalhe que importava: a API do YouTube SUBSTITUI o elemento passado por um `<iframe>` (não injeta dentro) — por isso existe um wrapper estável que nunca é tocado pela API, só ele é reanexado quando a tela de Estudo é reconstruída. `videoContext.js` ganhou `videoId`/`start` no retorno de `getVideoContext` (além de `embedUrl`, que o Cofre continua usando do jeito antigo — só o Estudo usa o player global). Sem autoplay (não compete com o TTS); pausa/esconde ao trocar de card, ao terminar a sessão e ao (re)entrar em `/study`; degrada pro link externo se não for YouTube ou não carregar.
- **[QA]** 26/26 testes (`node tests/engine.test.mjs`, incluindo os 5 novos de `statsEngine`) + 5/5 `test:local-day`. `node --check`/acorn ok em todos os arquivos tocados/criados (`app.js`, `statsEngine.js`, `statsView.js`, `studyView.js`, `libraryView.js`, `gameView.js`, `db.js`, `service-worker.js`, `ytPlayer.js`, `videoContext.js`). `npm run test:release` verde (à parte do check de árvore suja pré-commit, esperado em WIP).
- **[Gerente] Próximo = ONDA 3** (conteúdo e alcance): importar por URL/epub no Leitor, Placement v3 (banco maior + C2 + produção escrita por IA), mnemônicos por IA, reengajamento por e-mail, Tatoeba. Onda 0 (dono) continua pendente: teste do preview, merge do PR #3, Leaked Password Protection, rotação da chave DeepSeek.

## Execução Fable — 2026-07-11c (ONDA 1 — "tudo conversa entre si")
> Roadmap-mestre no CHECKLIST.md ("ROADMAP-MESTRE PRIORIZADO"). Onda 0 aguarda o dono (teste do preview + merge). A equipe executou a Onda 1 inteira.

- **[Eng. SRS] 1.1 XP por vídeo**: `db.logSession` agora calcula blocos de 5 min cruzados (`floor(after/300)-floor(before/300)`) e chama `recordEvent('video_session', blocos)`. O cap de 30 XP/dia e o anti-farm ficam no banco. Roda no service worker (a extensão proxia logSession). Falha de XP nunca quebra o registro de imersão (`.catch`).
- **[Linguista] 1.2 Diagnóstico→missões**: homeView agrega `log30` por categoria de card (via word_id→category), acha a pior (≥5 revisões, <80%) e cria a missão "🎯 Foco da semana" (alvo 3, ícone 🔬, fundo laranja). NÃO gate na recompensa das 3 core.
- **[Eng. SRS] 1.3 Diagnóstico→fila**: `sessionQueue.buildSessionQueue(cards, {priorityCategory, getCategory})` — categoria fraca à frente das revisões, ordenação estável, learning/novas/fracas intactos. studyView adiciona `getDiagnosisData(30)` ao Promise.all e extrai a pior categoria. `defaultGetCategory` lê `card.wordData?.category`.
- **[Prof. didático] 1.4 Reencontro na extensão**: `getReencounterWordsSW()` no service worker (fracas + em progresso, máx 8) injeta no prompt de `generateStoryWithAI` e retorna `requestedWords`. Paridade com `generateStoryWeb`.
- **[Prof. didático] 1.5 Missões semanais**: migration `20260711120000_weekly_quest` — coluna `user_stats.weekly_claim_week` + RPC `claim_weekly_quest(threshold)` (SECURITY DEFINER, semana do fuso, revoke anon, grant authenticated). `db.claimWeeklyQuest`. Painel "🗓️ Missão da Semana" no Início (progresso por `xp_week`, meta 500 → +100 XP, resgate 1x/semana).
- **[QA]** 20/20 testes (`node tests/engine.test.mjs`) — novo: priorityCategory traz a categoria fraca à frente. `node --check` ok em db/sessionQueue/homeView/studyView/service-worker. `npm run test:release` verde (à parte do check de árvore suja pré-commit).
- **[Gerente] Próximo = ONDA 2** (paridade Anki): tela de Estatísticas, estudo por tópico, editor de card, mini-jogo ouça-e-escolha, player YouTube global.

## Execução Fable — 2026-07-11b (MOTOR PEDAGÓGICO v1 — decisões POR PAPEL)
> Gestão: quadro vivo em CHECKLIST.md ("QUADRO VIVO DA EQUIPE") — cada frente tem um responsável e toda decisão fica registrada aqui. É assim que os papéis (e os agentes: Fable, Codex) conversam entre sessões.

- **[Linguista] Marco 1 — Diagnóstico semanal**: `db.getDiagnosisData(30)` agrega o review_log POR palavra/categoria/nível (retenção %, palavras sofrendo = 50%+ de Errei/Difícil com 2+ revisões, sólidas, leeches); `ai.generateWeeklyDiagnosis(data, cefr)` com persona de linguista SLA devolve JSON {resumo, forcas, fraquezas, plano_semana[3], dica_tecnica}; painel "🔬 Diagnóstico semanal" dentro do Plano de Hoje (Início), cache de 6,5 dias em `lf_weekly_diagnosis`, botão "↻ Atualizar", **gate de 10 revisões** (sem dados suficientes o painel diz isso em vez de inventar). Decisão do papel: a IA só recebe NÚMEROS reais — nunca pede pra ela "avaliar o aluno" sem dados.
- **[Eng. SRS] Marco 2 — Interleaving**: `dashboard/js/core/sessionQueue.js` (função PURA `buildSessionQueue`): learning primeiro (sensível a tempo), fracas (3+ lapsos/leech) espaçadas entre revisões, novas espalhadas (nunca em bloco no fim). No studyView, card fraco graduado FORÇA exercício de produção (builder/ditado) — decisão conjunta com o linguista: produção fixa mais que reconhecimento. `isWeakCard()` é o critério único compartilhado (mesmo usado no radar do Início).
- **[Prof. didático] Marco 3 — Reencontro nas histórias**: `getReencounterWords()` (fracas primeiro, depois em progresso recente, máx 8) → `generateStoryWeb(genre, onChunk, userWords)` instrui a IA a incorporar 4-6 naturalmente (sem destacar) → badge "🔁 Reencontro" lista as que REALMENTE entraram (verificação por regex, não confiança na IA). Na extensão o fluxo antigo continua (SW não recebe userWords ainda — anotado pro Marco 4).
- **[QA]**: 19/19 testes (`node tests/engine.test.mjs`) incluindo REGRESSÃO do bug de produção "16 Difícil sem graduar", ordem da fila (fracas não-adjacentes, novas não-amontoadas) e agregação do diagnóstico com stubs. Sintaxe ok em todos os arquivos tocados.
- **[Gerente] Próximo (Marco 4)**: diagnóstico alimentar missões e interleaving; passar userWords pro service worker (histórias na extensão); mini-jogo ouça-e-escolha; itens [Dono] do quadro.

## Execução Fable — 2026-07-11 (integração + feedback de uso real do dono)

**Merge:** `codex/auditoria-completa` (4 commits paralelos do Codex) unificado no PR #3. Conflitos resolvidos: onboarding = estrutura ARIA do Codex + fiação REAL (teste de nivelamento no passo 1 grava `lf_cefr_level`; escolha rápida mapeia beginner→A1/intermediate→B1/advanced→B2; meta 10/20/40 grava `new_per_day` 5/10/20). Edge Function = versão endurecida do Codex + subject com fallback + throttle 20h POR assinatura.

**Bugs do feedback do dono — diagnóstico com dados de produção:**
1. **"Cards sempre voltam" (CONFIRMADO)**: card "statement" tinha **16 revisões "Difícil" e nunca graduou** — no motor, Difícil em learning repetia o step pra sempre (loop de ~2 min eterno). FIX em `_calculateNextState`: Difícil agora AVANÇA o step (1,5x o intervalo) e gradua no fim com intervalo 20% menor que Bom. Os 2 cards presos ("statement", "stick around") foram graduados por reparo de dados (mereciam há muito).
2. **Contador "Para Revisar" nunca zerava**: somava cards de learning que vencem em minutos. `getStats` agora separa `dueLearning` de `dueCards` (e exclui suspensos — bug antigo); o Início mostra "💭 N em aprendizado" à parte.
3. **Quiz das histórias repetia perguntas**: agora sorteia 3 focos (fatos/intenções/sequência/inferência/vocabulário), temperatura 0.85, proíbe repetir perguntas anteriores da mesma história e embaralha as alternativas.
4. **Tradução da frase vazava no clique**: modal mostra SÓ a palavra; frase atrás de "👁 Ver tradução da frase".
5. **Hover**: tooltip de tradução da palavra ao passar o mouse (250ms, cache do translator).
6. **Áudio do modal**: blindado — stopAudio + fallback pra speechSynthesis nativa; nunca falha em silêncio.

**"Cérebro professor" (v1)**: painel "🧑‍🏫 Plano de hoje" no Início — 100% dados do banco: revisões agora vs em aprendizado, palavras fracas (3+ lapsos/leech) no radar, e dica pedagógica condicional (retenção <70% → só revisar; fila >15 → 2 sessões; palavra fraca → ler em voz alta; tudo em dia → história). Base para o motor pedagógico completo (ver plano no fim da auditoria).

**Web Push LIGADO ponta a ponta**: sw.js com handlers push/notificationclick; toggle de opt-in nas Configurações (subscribe real com VAPID via `get_push_public_key`); Edge Function v2 deployada (subject fallback, constant-time key); **testado E2E via pg_net: chave errada→401, certa→200**; cron `push-daily-reminder` REATIVADO (17:30 UTC). Falta só o teste com uma assinatura real do navegador do dono (ativar o toggle e esperar o próximo disparo).

**Mais:** falha de LEITURA agora avisa na tela (`lf_read_error` → toast, fim do "vazio" mentiroso); validação efêmera das migrations em Postgres local (`tests/db/validate-migrations.sh` — baseline `00000000000000` + shim de auth; smoke do Learning Engine verde); dependências npm instaladas pro `test:release` do Codex.

**Não feito (registrado):** mini-jogo "ouça-e-escolha" (gameView segue só com Match), indicador de progresso do download do Kokoro, ícones PWA com arte original, rotação da chave DeepSeek (ação do dono), Leaked Password Protection (dashboard Supabase, ação do dono).

## Execução Codex — 2026-07-10

- Branch de trabalho: `codex/auditoria-completa`, derivada do PR #3 (`e43fad1`).
- Validação inicial: `node tests/engine.test.mjs` passou 14/14; preview do PR está pronto na Vercel; produção permanece em `main` até integração explícita.
- Banco: a migration `20260710173210_record_card_review_atomically` foi aplicada e versionada em `supabase/migrations/`. Ela substitui o fluxo vulnerável PATCH-do-card + INSERT-do-log por `record_card_review`, uma RPC transacional e idempotente. Cliente atualizado em `utils/db.js`.
- Banco: a migration `20260710173541_reversible_review_events` foi aplicada e versionada. Undo agora restaura o snapshot de card/XP/streak pela RPC `revert_card_review`; `review_log` é append-only para o cliente.
- Estudo: avaliação ficou protegida contra duplo clique; XP exibido é o confirmado pelo servidor; limite de revisões não esconde mais cards novos/learning.
- Estudo (P1): acessibilidade e mobile iniciados em `dashboard/js/ui/studyView.js`: landmarks/ARIA, anúncio do card para leitor de tela, foco visível e grade responsiva dos botões. Falta apenas inspeção visual em dispositivo real antes de marcar o item como aceito.
- Banco (P1): `20260710181500_timezone_daily_semantics.sql` foi aplicada. O cliente sincroniza `Intl.DateTimeFormat().resolvedOptions().timeZone`; o servidor calcula XP, streak, freeze e caps pela data daquele fuso. `getTodayCounts()` passou a consultar a janela local por timestamps. O CLI do Supabase não existe neste ambiente, então o arquivo foi criado no repositório e a mesma migration foi aplicada pelo conector oficial. Conferido: `anon` não executa `set_user_timezone`, `authenticated` executa e a função usa o próprio `auth.uid()`.
- Retomada Fable (P0): foi achada na produção a migration não versionada `20260710190558_web_push`, com tabela, Vault e cron, mas sem Edge Function `push-reminder` e sem cliente PWA. Para não gerar 404 diário, Codex pausou o job `push-daily-reminder` (`active=false`). Não reativar antes de publicar e testar a função, o Service Worker e o opt-in; a auditoria contém o status e a evidência.
- Rodada sênior Codex (P0/P1): `scripts/replay-migrations-local.ps1` permite provar a reprodução das migrations apenas em Supabase local descartável (exige `-Execute`, CLI e Docker; nunca usa produção). `tests/release-smoke.mjs` e scripts npm verificam sintaxe, manifest, PWA/Vercel, migrations e invariantes de segurança. Onboarding real em `homeView.js`: settings `onboarding_v1` guarda nível/meta; o fluxo nível → 10/20/40 revisões → Histórias só conclui após persistência confirmada e não confunde queda de rede com conta vazia. Rodar antes de release: `npm run test:release` e `npm run test:engine`.
- Rodada sênior seguinte (P1/P2): `utils/local-day.js` unifica o calendário local em logs, sessões, metas, heatmap e forecast (`npm run test:local-day`). Contexto de vídeo salvo passou a aparecer em Estudo e Cofre; só YouTube HTTPS válido abre player nocookie, demais fontes abrem link no timestamp. Push: migration `20260710194500_expose_push_public_key` retorna só a VAPID pública para usuário autenticado; **cron permanece pausado**. Pré-requisitos para ligar Push: handlers/opt-in no PWA, secret `LF_VAPID_SUBJECT` válido, deploy da Edge Function e teste real de uma inscrição.
- Revisão de continuação Claude (2026-07-11): os commits `c0c31fc`…`a56b06d` existem na branch Claude e contêm fixes de cards/histórias e Motor Pedagógico v1, mas não foram promovidos sem revisão. Seniors de linguística, banco e QA bloquearam o fast-forward até corrigir: replay sem Vault/cron/CI, Push sem prova de inscrição real e com fallback de contato hardcoded, cobertura insuficiente para `Difícil`, respostas de quiz e reencontro da extensão. A produção foi conferida: Claude havia reativado `push-daily-reminder`; Codex voltou o job para `active=false`. Próxima ação é integrar apenas blocos aprovados, começando por P0.
- P0 de automação (2026-07-11): `.github/workflows/release.yml` ganhou job `verify` para PR/branches (engine, dia local e smoke). O script de replay aceita CLI global ou `npx supabase`; Docker Desktop está instalado, mas o daemon está desligado nesta máquina, portanto o replay ainda não pôde iniciar e não deve ser declarado aprovado.
- Correção P1 de aprendizagem (2026-07-11): qualidade `2`/“Difícil” em `utils/db.js` agora progride pelo learning sem loop eterno: repete o primeiro passo uma vez e, a seguir, avança com 1,5× do intervalo. Há testes para uma e duas etapas em `tests/engine.test.mjs` (15 testes verdes). Não confundir com a versão Claude que graduava em apenas duas exposições para dois passos; a política Codex preserva uma exposição extra.
- Histórias P1 (2026-07-11): `storiesView.js` valida o JSON do quiz (3×4, índice válido), varia focos e embaralha alternativas. Uma história aberta não concede XP de quiz novamente; o cap diário do banco permanece a defesa entre sessões. Tradução da frase não aparece junto da palavra, tooltip/foco não vaza contexto e a resposta da IA é renderizada como texto seguro. Testes de sintaxe, 15 do motor e 5 de dia local passaram.
- P0 ainda aberto: recuperar no Git as cinco migrations históricas do PR #3 e auditar permissões das RPCs. Não fazer merge em `main` antes disso.

## Última sessão — 2026-07-10 (IMPLEMENTAÇÃO DA AUDITORIA GERAL)
**Referência:** `docs/AUDITORIA_GERAL_2026-07-10.md` (etapas 0–7 implementadas nesta sessão, branch `claude/learning-system-audit-4uwb83`, PR #3).

**Banco (6 migrations aplicadas via MCP no projeto `qnutoswrufznztoznlql`):**
- `security_hardening_e0`: search_path fixo, REVOKE de anon nas SECURITY DEFINER, RLS com `(select auth.uid())` em todas as tabelas, índices `cards(word_id)` e `cards(user_id, due_date) WHERE NOT suspended`, policy em api_usage_log, DROP da RPC morta `get_due_cards`, coluna `cards.introduced_at`.
- `translation_cache_e2`: tabela própria pro cache de tradução; **3.155 linhas `trans_*` migradas pra fora de `settings` (3.195 → 40 linhas)**. `prune_translation_cache()` pra expurgo.
- `learning_engine_e4`: `apply_learning_xp()` (núcleo compartilhado de XP/streak/freeze + bônus de +15 na 1ª atividade do dia), trigger `calculate_xp_on_activity` reescrito (XP escala com a nota: 8/10/12), RPC `record_learning_event(type, amount)` com caps diários anti-farm em `user_stats.daily_counters` (game_match 40/dia, story_read 3/dia, story_quiz 30/dia, quests_complete 1/dia, video_session 30/dia).
- `league_rollover_e5`: `run_league_rollover()` (top 5 com XP sobem, inativos descem, zera xp_week) + **pg_cron agendado (`league-weekly-rollover`, seg 00:05 UTC)** + `maybe_league_rollover()` lazy idempotente (advisory lock) chamado pela tela de Ligas.
- `harden_ensure_user_stats`: logado não cria stats de outro usuário.
- Validação: `apply_learning_xp` e `run_league_rollover` executados em transação com ROLLBACK (sem sujar dados). Advisors: só restam WARNs intencionais (RPCs de authenticated) + "leaked password protection" que **só se ativa no dashboard do Supabase Auth (ação manual do dono)**.

**Cliente (todos com `node --check` ok + 14 testes em `tests/engine.test.mjs` verdes — rodar `node tests/engine.test.mjs`):**
- `utils/db.js`: `_calculateNextState` agora RESPEITA `graduating_interval`/`easy_interval`/`interval_modifier` (eram lidos e ignorados); `getCardsDue(limit, withWords, minutesAhead)` filtra suspended NO BANCO; `getTodayCounts()`; `logReview` grava `introduced_at` na 1ª revisão de card novo e retorna o card NOVO (pra fila de sessão); `suspendCard` não corrompe mais due_date (+365d); streak do `getStats` unificada com `user_stats`; novos: `recordEvent`, `maybeLeagueRollover`, `get/setTranslationCache`; `getSRSSettings` lê `new_per_day`/`max_reviews_per_day` e aceita learning steps "1m 10m".
- `dashboard/js/ui/studyView.js` (**o fix do bug nº1 da auditoria**): fila de sessão com REENTRADA de cards em learning (voltam quando o step vence), learn-ahead de 20 min, tela de espera com countdown ("Antecipar agora"/"Encerrar"), conclusão só quando NÃO há mais nada; no último card espera o logReview (senão concluía antes do learning entrar na fila); **rótulos dos botões de nota mostram o intervalo REAL via `predictNextInterval()`**; limites diários aplicados na montagem da fila; `lf_audio_auto_front/back` respeitados; XP paralelo em localStorage REMOVIDO.
- `dashboard/js/ui/settingsView.js`: os controles SRS gravam nas chaves QUE O MOTOR LÊ (`graduating_interval`, `max_interval`, `interval_modifier`, `leech_threshold` + select `leech_action`); fantasmas ganharam vida (novas/dia, revisões/dia, learning steps, áudio frente/verso); controles que o FSRS não usa (ease inicial, penalidade) REMOVIDOS; **teste de nivelamento em 3 FASES**: vocabulário (anti-chute) + cloze adaptativo por banda + listening com TTS, resultado combinado 40/40/20 com diagnóstico de lacunas.
- `dashboard/js/core/placement.js`: `CLOZE_BANK`/`LISTENING_BANK` (3 e 2 itens por banda A1–C1), `shuffleItem`, `clozeStartBand`, `scoreClozeLadder`, `listeningBands`, `scoreListening`, `combinePlacement`.
- `dashboard/js/ui/homeView.js`: missões ADAPTATIVAS (alvo = média 7d × 1.2 com clamp), missão de RETORNO leve pra quem sumiu 2+ dias (banner "Sentimos sua falta"), recompensa reivindicável +30 XP (`quests_complete`, cap no banco), forecast de 7 dias em barras (estilo Anki), XP/streak SÓ do servidor.
- `dashboard/js/ui/gameView.js`: Match dá XP REAL via `recordEvent('game_match')` (a tela antiga dizia "ganhou XP" e não dava nada).
- `dashboard/js/ui/leaguesView.js`: botão "Simular Fim da Semana" REMOVIDO; chama `maybeLeagueRollover()` no load; countdown real até segunda.
- `dashboard/js/ui/storiesView.js`: FIX do card quebrado (salvava translation placeholder e campo `context` errado → agora tradução real + `context_sentence`); status por palavra estilo LingQ (aprendendo=amarelo, conhecida=verde) + **badge "% conhecido"**; **quiz de compreensão** (3 MCQs geradas da própria história, XP por acerto); botão "Marcar como lida" (+20 XP, cap 3/dia).
- `utils/translator.js`: cache via `translation_cache` (NUNCA mais `setSetting` — cada legenda traduzida invalidava o cache do SRS e deixava tudo lento).

**Teste manual pro dono:** (1) estudar um card novo com "Bom" → ele volta na MESMA sessão em ~10 min (ou tela de espera com countdown); (2) mudar "Passos de aprendizagem" pra "1 3" nas Configurações → os botões de nota mostram os minutos novos; (3) jogar o Match → XP de verdade no Início; (4) fazer o teste de nivelamento novo (3 fases); (5) salvar palavra numa História → card nasce com tradução e frase. **Ação manual:** ativar "Leaked password protection" no dashboard do Supabase (Auth → Settings).

## Sessão anterior
**Data:** 2026-07-08
**O que foi feito:**
- Revisão multi-especialista completa do estado atual do repositório (havia diff massivo não commitado: 22 arquivos modificados, +1327/-1658 linhas, mais 8 arquivos untracked) antes de iniciar qualquer implementação nova.
- Confirmado por leitura direta de código (não suposição): `utils/db.js::login()`/`signUp()` não capturam `refresh_token`/`expires_at` — zero ocorrências no repo inteiro. Sessão Supabase expira em 3600s e quebra tudo autenticado silenciosamente. Já existe um fallback parcial (logout automático em 401 em `_fetch()`), mas não resolve a causa raiz.
- Achado crítico que mudou o plano original: a IA contextual do popup de palavra (`background/service-worker.js::explainWordWithAI`) chama `api.deepseek.com` **direto**, usando a chave própria do usuário (BYOK, `chrome.storage.local.aiApiKey`) — **não** passa pela Edge Function `supabase/functions/deepseek-chat`, que só é chamada por `dashboard/js/core/ai.js::explainGrammar()`, código sem nenhum caller (morto). A Edge Function já lê `DEEPSEEK_API_KEY` de Supabase Secrets corretamente, só está subutilizada e insegura (auth fake, CORS `*`, sem rate-limit).
- Decisão tomada com o usuário: migrar a IA contextual real para usar a Edge Function com chave compartilhada + rate-limit por usuário (padrão Language Reactor/freemium), mantendo BYOK como override opcional. Isso torna a Fase 0 (refresh de token) pré-requisito direto dessa migração.
- Confirmado com o usuário: remoção do sistema de decks em `utils/db.js` foi intencional (cards substituem decks) — só ficou incompleta (`bulkUpdateDeck()` e `utils/cloud-sync.js` ainda referenciam o conceito antigo). Terminar a remoção entra na Fase 1.
- Achados adicionais de repo hygiene: `background/service-worker.js_temp` é backup de um refactor feito por `cleanup.py` (removeu blocos de fallback Gemini, mas deixou condicionais mortas `config.provider !== 'gemini'`); `fix_enc_test.py`/`fix_mojibake.js` foram scripts de correção de mojibake (emoji/acentos corrompidos); `dashboard/js/ui/storiesView.js` (untracked) é feature nova legítima ("Histórias Dinâmicas"), já importada em `app.js` — não é lixo; `popup/popup.html` aponta para `icon_full.png`, que está untracked (risco de imagem quebrada se commitado assim).
- Criados `MASTER_BLUEPRINT.md` e `CHECKLIST.md` com o plano consolidado em 4 fases.
- **Nenhuma alteração de código foi feita nesta sessão** — só diagnóstico e alinhamento de plano.

## Próximo passo
**FIX REVISÃO (commit 3c8fd9e, 2026-07-10)**: o toast "Erro ao salvar a revisão" era o INSERT do review_log respondendo 201 com corpo vazio (sem Prefer) e o res.json() estourando — a revisão SALVAVA, só o parse quebrava. _fetch agora lê text() e só parseia com corpo (testado). Favicon 404 e logo do dashboard corrigidos. Erros "message channel closed" no console do dono são de OUTRA extensão (AdUnit/adblock), não nossos. IMPORTANTE pro undo: com esse erro, lastReview não era registrado — agora o undo volta a funcionar após avaliar.

**E1 KOKORO (commit 694f131, 2026-07-10)**: voz neural premium opt-in no site — kokoro-js via CDN lazy, WebGPU/WASM, vozes af_heart/bf_emma pelo sotaque, antes do Google TTS só pra inglês com fallback total, cache IndexedDB com motor na chave, toggle nas Configurações. Teste manual do dono: ativar o toggle no site, tocar um áudio (1ª vez baixa ~90MB — pode demorar), comparar a qualidade. **Restante do roadmap: mini-jogos (D3), ícones PWA originais, onboarding/Tatoeba/acessibilidade (E3), 6 sugestões da equipe (onboarding 1º acesso, username ligas, reuso de histórias, Web Push, mobile estudo, telemetria), indicador de progresso do download do Kokoro.**

**D3+E2 (commit e0bab0e, 2026-07-10)**: streak freeze no trigger do Postgres (perdoa 1 dia com freeze; +1 a cada 7 dias, máx 2; 🧊 no Início), notificações de revisão na extensão (1/20h, clique abre o site, permissão adicionada), limpeza (utils/fsrs.js e icon.png removidos; tabela decks+words.deck_id dropadas). **Restante do roadmap: mini-jogos novos (D3), Kokoro TTS (E1), ícones PWA originais, onboarding/Tatoeba/acessibilidade (E3), e as 6 sugestões da equipe (onboarding 1º acesso, username nas ligas, reuso de histórias, Web Push, mobile do estudo, telemetria Sentry).** Usuário precisa RECARREGAR A EXTENSÃO (permissão nova de notificações) e testar tudo do 2º feedback no site.

**RODADA SÊNIOR (commit 303e0bc, 2026-07-10)** — 2º feedback do dono todo endereçado: loadNextCard não-bloqueante (card aparece na hora, IA completa em background), cache 30s de getAllWords/getAllCards (navegação fluida), tutor SOB DEMANDA (zero chamadas de IA sem pergunta; 140 chars; max_tokens 320; persona fluência; colapsado em <details>), tabela `stories` no Supabase (migração aplicada; histórico do banco com fallback local; genre salvo), mojibake corrigido (select/botões/delimRegex das Histórias), banner "ofensiva em risco" no Início. **Sugestões da equipe pro dono decidir (não pedidas mas o sistema deveria ter): onboarding de 1º acesso (tour + placement + primeira palavra guiada), username configurável nas ligas (hoje "Estudante"), reuso de histórias entre usuários por nível+gênero (economia real de tokens), Web Push de lembrete, modo mobile revisado (sidebar do estudo em tela pequena), telemetria de erros client-side (ex: Sentry free tier).** Próximo em código: D3 (mini-jogos/streak freeze/notificações) e Bloco E (Kokoro TTS, limpeza fsrs.js/decks/newtab/ícones).

**STREAMING DA IA EXECUTADO (commit 3e81581, 2026-07-10)**: Edge Function deepseek-chat v4 repassa SSE (deployada + E2E com usuário real testado e removido); aiChatStream em ai.js (parser incremental testado); tutor de gramática e histórias renderizam ao vivo. Extensão continua não-stream (sendMessage não streama — ok, os fluxos dela são curtos). **Próximo: D3** (mini-jogos: ditado relâmpago/ouça-e-escolha; streak freeze — trigger calculate_xp no Postgres, pedir autorização; notificações via srs-reminder) **e Bloco E** (Kokoro TTS; limpeza: utils/fsrs.js morto, tabela decks órfã, grade 1/3 do newtab, ícones PWA, icon.png corrompido). Gargalos mapeados restantes: getWordsByCategory full-scan, sem cache HTTP nos GETs.

**HOTFIX EXECUTADO (commit 3a61e4f, 2026-07-10)** — todos os bugs do feedback: demora ao avaliar (11 requests→1+cache + grade otimista), tela final quebrada (#app-view→container real), YouGlish (topo/lazy/pause), salvar imediato no popup, ligas sem bots, histórico de histórias na web, nível TTL, missões variadas, Leitor com onboarding. NOTA: o commit incluiu edições pendentes da sessão paralela (word-popup UI + getSetting boolean) — repo compartilhado. **Próximas prioridades (usuário quer referência mundial): 1) STREAMING SSE na Edge Function (IA percebida como lenta — resposta deve aparecer enquanto gera); 2) D3 (mini-jogos, streak freeze via trigger, notificações); 3) Bloco E (Kokoro TTS, limpeza fsrs.js/decks/newtab/ícones); 4) gargalos restantes (getWordsByCategory full-scan, cache HTTP nos GETs).**

**D2 EXECUTADO (commit e186cee)**: teste de nivelamento CEFR nas Configurações — 36 palavras por faixa + pseudo-palavras anti-chute, lógica pura em dashboard/js/core/placement.js (testada com 4 perfis), resultado aplica o nível no sistema inteiro. Achado importante: cefr-wordlist.json só tem A1-B2; C1 é proxy por raridade, C2 não estimável. **Próximo: D3** (mini-jogos: ditado relâmpago/ouça-e-escolha; streak freeze — exige alterar o trigger calculate_xp no Postgres, pedir autorização de migração; notificações via srs-reminder). **Depois Bloco E** (Kokoro TTS local; limpeza: utils/fsrs.js morto, tabela decks órfã, grade 1/3 do newtab, ícones PWA originais, icon.png corrompido). Sessão paralela segue com content/word-popup.js e utils/db.js não commitados.

**D1 EXECUTADO (commit 57c965d)**: exercícios variados no estudo — montar frase (chips estilo Duolingo) + ditado + reverso no mesmo sorteio, só pra cards graduados, resultado objetivo alimenta o FSRS (acerto=3/erro=1), toggle lf_varied_exercises. **Próximo: D2 (placement test CEFR usando utils/cefr-wordlist.json + frequency-en.json — estimar nível por famílias conhecidas + teste de vocabulário por faixa de frequência) e D3 (mini-jogos: ditado relâmpago/ouça-e-escolha; streak freeze exige mexer no trigger calculate_xp do Postgres; notificações via srs-reminder do SW). Depois Bloco E** (Kokoro TTS local + limpeza: utils/fsrs.js morto, tabela decks órfã, grade 1/3 do newtab, ícones PWA originais, icon.png corrompido). Sessão paralela segue com content/word-popup.js e utils/db.js não commitados.

**BLOCO C EXECUTADO (commit 37311e1)**: Modo Leitor LingQ no site (rota /reader, nav "Leitor") — colar texto, palavras coloridas por status, popup tradução/áudio/salvar/já-sei usando known_words (tabela finalmente ligada; RLS+constraint verificadas), lematizador próprio em utils/lemma.js (testado), contador de famílias conhecidas no Início. **Próximo: Bloco D do PLANO_MESTRE_FABLE5.md** — D1 exercícios variados no studyView (cloze/montar frase/ditado usando ai_chunks), D2 avaliação oficial CEFR/placement test (usar utils/cefr-wordlist.json + frequency-en.json), D3 mini-jogos + streak freeze + notificações. Depois Bloco E (Kokoro TTS + limpeza: utils/fsrs.js morto, tabela decks órfã, ícones). Sessão paralela segue com content/word-popup.js e utils/db.js não commitados.

**B2 EXECUTADO (commit 6e47341)**: suspender/reativar no Cofre + filtro de suspensos no estudo, enterrar ("Deixar pra amanhã"), cartões reversos PT→EN opt-in (lf_reverse_cards), painel de memória no Início (retenção 30d + carga futura). Bugs corrigidos: exclusão no Cofre (parseInt de uuid — nunca funcionou) e "Gerar Agora" na web (agora via generateChunksWeb). **Bloco B COMPLETO. Próximo: Bloco C do PLANO_MESTRE_FABLE5.md** — C1 modo leitor LingQ (novo readerView evoluindo storiesView/web-reader, usar tabela known_words que está vazia) e C2 contador de palavras conhecidas + lemmatização (lib compromise). Sessão paralela segue com content/word-popup.js e utils/db.js não commitados.

**BLOCOS A e B1 EXECUTADOS (2026-07-09, commits bca3ad5 + dc289a6)**: A1 Histórias funcionam no site (roteamento extensão/web em storiesView + generateStoryWeb em ai.js + translator client-side — CORS verificado); A2 login próprio no popup da extensão (form + estados + logout, via proxy→SW); A3 dashboard consolidado site-only (popup/settings-panel/newtab abrem linguaflow-web-tau.vercel.app, dashboard/* fora do web_accessible_resources); B1 export Anki .txt real + backup JSON completo + restauração (settingsView). **Próximo passo concreto: B2 do PLANO_MESTRE_FABLE5.md** — opções de deck estilo Anki (suspender/enterrar/reposicionar em libraryView/studyView), cartões reversos PT→EN, painel de estatísticas de retenção usando review_log. Depois Bloco C (modo leitor LingQ + known_words). ATENÇÃO: sessão paralela tem `content/word-popup.js` e `utils/db.js` (coerção boolean em getSetting) não commitados — não tocar nesses arquivos sem conferir git status.

**PLANO-MESTRE PRO FABLE 5 (2026-07-09)**: criado `PLANO_MESTRE_FABLE5.md` — auditoria completa do sistema + decisões de arquitetura ratificadas pelo dono + roadmap priorizado em 5 blocos (A: consolidação site-only + login popup + fix Histórias; B: paridade Anki/export; C: LingQ/modo leitor; D: Duolingo/CEFR oficial/jogos; E: qualidade/Kokoro/limpeza). **Decisões tomadas:** dashboard SÓ no site (`linguaflow-web-tau.vercel.app`, deploy da `main`); extensão = captura + revisão rápida; login próprio no popup (sessão site≠extensão, são independentes). Doc `prompt-linguaflow-arquitetura.md` (Fases 0-3) está 100% concluído. **Próximo trabalho de código = Bloco A do PLANO_MESTRE_FABLE5.md**, começando por A1 (Histórias quebram no site: `storiesView.js` usa `chrome.runtime` que não existe na web). Escopo desta sessão foi só planejamento — nenhum código novo.

**SLIDER RETENÇÃO + UNDO (commit aeaec0b, 2026-07-09)**: slider de retenção FSRS agora funciona (lê/grava `lf_srs_retention`, faixa 80-97%). Undo na revisão implementado (Ctrl+Z/Z): `logReview` retorna `prevCard`, `undoReview` reverte card + apaga review_log, botão no studyView. Testado em Node. **Próximo trabalho de código** (roadmap MELHORIAS.md, escolher um): exercícios variados no studyView (cloze/montar frase/ditado, dados já em ai_chunks) OU modo leitor estilo LingQ OU Kokoro TTS local OU cartões reversos + streak freeze. NOTA: houve sessão paralela editando `content/word-popup.js` — conferir `git log`/`git status` antes de commitar pra não pisar no trabalho dela.

**CARDS V2 (commit 1f5bba6, 2026-07-09)**: `dashboard/js/ui/studyView.js` reescrita — fluxo agora é áudio + frase com lacuna (frente) → revelar (fonética/tradução DA frase do card, não mais do chunks[0] que vazava a resposta) → grading. Sidebar ganhou: tutor de gramática em CHAT (nível CEFR, multi-turno, web+extensão), chunks com salvar MP3, YouGlish embutido (widget na web; link na extensão por CSP do MV3), botão de regenerar frase quebrada. Enriquecimento (fonética BR da frase + da palavra + traduções) é 1 chamada de IA persistida em `ai_chunks` como entradas `is_context`/`is_word`. **Atenção: havia 2 sessões em paralelo neste repo hoje — antes de commitar, conferir `git log` e commitar só os próprios arquivos** (ficaram pendentes de outra sessão: `content/word-popup.js` e `dashboard/js/ui/settingsView.js` com slider de retenção FSRS).

**SESSÃO 2026-07-09 (commits 745ff18 + 26762d4)**: FSRS-4.5 substituiu o SM-2 (testado, cards legados compatíveis), PWA offline consertado (sw.js antigo nunca funcionou — pré-cache 404 abortava a instalação), _fetch relança erros de escrita, TTS ganhou cache IndexedDB + download de MP3 (trabalho da sessão paralela, integrado e deployado: Edge Function `tts` v1 ativa, anon → 401 testado), ai.js unificado com tutor de gramática reativado. **Próximo trabalho de código**: slider de retenção FSRS nas Configurações (backend já lê `lf_srs_retention`), depois exercícios variados no studyView (cloze/montar frase/ditado usando ai_chunks), depois modo leitor. Teste manual do usuário continua pendente (extensão + Vercel).

**FASE 2 COMPLETA E FUNCIONANDO (commits a756403 + 0185bc0)**: Edge Function deepseek-chat v3 em produção — JWT real, CORS restrito, rate-limit 20/min (api_usage_log), teto de tokens, e chave DeepSeek no **Vault** lida via RPC get_deepseek_key (só service_role; anon/authenticated → 403, testado). Service worker migrado: sem BYOK → Edge Function com token de sessão; com BYOK → direto. **Teste E2E passou: IA respondeu via chave compartilhada sem BYOK.** Não há mais bloqueios. Próximo trabalho de código: roadmap do MELHORIAS.md (ordem sugerida: PWA offline → FSRS via ts-fsrs → cadeia TTS Kokoro → exercícios variados → modo leitor). Nota de segurança: a chave DeepSeek foi colada no chat pelo usuário — recomendado rotacionar depois e atualizar só no Vault.

**CORREÇÕES DO FEEDBACK (commit f684169)**: causa raiz dos bugs relatados era saveWord falhando 100% com 400 silencioso (colunas inexistentes na tabela words — migração aplicada no Supabase: chunks→ai_chunks + synonyms/antonyms/definition/snapshot/category). Corrigidos também: Sair (db.signOut inexistente), áudio robótico na web, contraste dark (backgrounds hardcoded), missões diárias fake (agora dados reais), CEFR dessincronizado entre extensão e dashboard. Gamificação confirmada REAL no backend (trigger calculate_xp). Usuário precisa retestar: salvar palavras, estudar, Sair, dark mode, missões.

**FASES 0 e 1 IMPLEMENTADAS** (2026-07-08, sessão 2):
- Fase 0 (refresh de token): completa, 6 cenários testados em Node, commit `0574d20`.
- Fase 1 (limpeza): completa — 9 arquivos mortos removidos, oauth2+identity fora do manifest, `bulkUpdateDeck` removido, condicionais gemini mortas limpas, PWA corrigido (pasta `dashboard/icons/` criada com 192/512, webmanifest com `start_url: "/"`), rota `stories` no vercel.json.
- Relatório de melhorias: `MELHORIAS.md` (FSRS, Kokoro TTS, modo leitor, PWA offline).

**Falta (usuário):** teste manual — recarregar extensão, **deslogar/logar de novo** (sessão antiga não tem refresh_token), salvar palavra, conferir IA contextual, e testar o site na Vercel após o deploy (rota /stories, instalação PWA).
**Arquivo:** próximo passo de código é a Fase 2 — `supabase/functions/deepseek-chat/index.ts` (JWT real + CORS restrito + rate-limit `api_usage_log`) e depois migrar `explainWordWithAI`/`generateChunksWithAI`/`getPTPhoneticWithAI` no `background/service-worker.js` pra chamar a Edge Function com o token de sessão (BYOK como override). Padrão de chamada: ver `dashboard/js/core/ai.js`.
**Ação:** começar pela Edge Function (hardening) porque ela pode ser deployada e testada isoladamente sem tocar na extensão.

## Bloqueios
- Não confirmado se a coluna `deck_id` em `words` é `NOT NULL` no schema Postgres atual — `saveWord()` já não envia mais esse campo (só `bulkUpdateDeck()` ainda usa). Precisa de uma query no Supabase antes de mexer nisso na Fase 1, para não quebrar salvamento de palavra.
- Documento externo `D:\Downloads\prompt-linguaflow-arquitetura.md` foi atualizado nesta sessão (v2) mas não é mais a fonte única de verdade — `MASTER_BLUEPRINT.md`/`CHECKLIST.md` no repo é quem manda a partir de agora. O doc externo ainda tem o SQL da tabela `api_usage_log` usado na Fase 2.

---

## 🎯 Pode ir pra produção? (resposta de 2026-07-12, após ONDA 6)

**Curto:** não ainda — falta uma sessão de teste manual do dono, mais alguns itens de configuração que só o dono pode fazer (chaves, toggles de conta). O código em si (motor SRS, segurança, mobile) está em bom estado depois das Ondas 1-6.

**O que EU já resolvi e não bloqueia mais:**
- Bug crítico de mobile (topbar inacessível, logout impossível no celular) — corrigido nesta sessão.
- IDOR e SSRF críticos (Onda 5) — corrigidos e deployados.
- Motor FSRS, cache, corridas de dados, vazamento de `AudioContext` — corrigidos.
- Suíte de testes 100% verde, migrations validadas do zero em banco efêmero.

**O que só o DONO pode fechar antes de um lançamento real (nada disso eu consigo fazer sozinho neste ambiente):**
1. **Teste manual num celular físico de verdade** — eu corrigi o topbar (confirmado com screenshot) e as demais telas por leitura de CSS, mas nunca vi o app logado rodando de verdade num telefone. É o item de maior risco residual.
2. **Aprovar/mergear o PR #3** — nada disso vai pro `main`/produção até isso acontecer.
3. **Confirmar Web Push de ponta a ponta** com uma notificação real chegando no celular/navegador do dono.
4. **Ativar "Leaked Password Protection"** nas configurações de Auth do Supabase (toggle simples, mas é uma decisão de conta, não de código).
5. **Rotacionar a chave da API DeepSeek** (a atual foi usada/vista durante o desenvolvimento).
6. **Configurar uma chave de provedor de e-mail** (Resend ou similar) se quiser o reengajamento por e-mail (Onda 3.4) funcionando de verdade — hoje a função existe mas fica inerte sem a chave.
7. **Decidir a arte do ícone do PWA** (hoje é um mascote de tucano genérico, não uma marca própria) — ou aprovar mantê-lo.
8. Branches obsoletas (`master`, `codex/auditoria-completa`) — cosmético, não bloqueia produção, só perguntando se quer que eu remova.

Resumindo: o código não é mais o gargalo. O gargalo agora é uma rodada de decisões/testes que dependem de você.

---

## Atualização — 2026-07-12, resposta sobre e-mail / Leaked Password / chave DeepSeek

**[Gerente] Verifiquei de novo, com calma, se existia algum jeito de ativar "Leaked Password Protection" pelas ferramentas que tenho** (o dono pediu explicitamente, achando que eu tinha acesso). Confirmei que não é possível: não é uma configuração que mora no banco Postgres do projeto (rodei uma query em `information_schema.tables` procurando qualquer tabela de config em `auth`/`extensions`/`public` — não existe nenhuma) nem existe nenhuma ferramenta de MCP disponível pra chamar a Management API do Supabase (que é o único outro caminho, e exige um Personal Access Token que eu não tenho). Isso é uma limitação real de ferramental, não falta de permissão. **Só dá pra ativar em 1 clique no Dashboard**: Authentication → Settings → em "Password Security", ligar "Leaked password protection" (exige plano Pro ou superior).

**[Backend] Chave DeepSeek**: mantida como está, por decisão do dono — não vou rotacionar.

**[Linguista] Reengajamento por e-mail (Onda 3.4)**: fica pausado por enquanto, por decisão do dono — a função já existe no código (`supabase/functions/email-reengagement`) mas continua inerte até haver uma chave de provedor configurada. Nenhuma ação necessária agora.

Nenhuma mudança de código resultou desta rodada — PR #3 já está mergeado em `main`/produção desde o commit `63adfb0`.

---

## Atualização — 2026-07-12: Leaked Password Protection não se aplica (plano Free)

Dono confirmou que usa o plano **Free** do Supabase. Segundo a documentação oficial ("Leaked password protection is available on the Pro Plan and above"), esse recurso nem aparece como opção pra ativar num projeto Free — não é só limitação de ferramental minha, é limitação do plano. Item removido da lista de pendências; não é um bloqueio de segurança acionável no momento (upgrade de plano é decisão de custo do dono, fora de escopo técnico).

---

## Execução Fable — 2026-07-12 (ONDA 7 — performance do painel "Início")
> Pedido do dono: "Veja porque demora em carregar o painel... Veja se é algo no front ou no banco de dados."

**Diagnóstico**: é no front, não no banco. `renderHome()` (dashboard/js/ui/homeView.js) faz duas levas de fetch. A 1ª chama `db.getStats()`, que internamente já busca e retorna 30 dias de `review_log` completo (`stats.reviewLog`). A 2ª leva pedia os MESMOS 30 dias de novo via `db.getReviewLog(30)` — uma ida à rede idêntica e desperdiçada — e ainda por cima buscava `db.getReviewLog(1)`, que é apenas um subconjunto desses mesmos 30 dias (hoje já está contido no intervalo). Ou seja: toda carga da tela "Início" fazia 2 buscas de review_log 100% redundantes, nenhuma delas com cache.

Além disso, `getAllSentences()` e `getAllKnownWords()` nunca ganharam a otimização stale-while-revalidate que `getAllWords()`/`getAllCards()` já tinham desde a Onda 4 — buscavam a tabela inteira, sem cache, toda vez (chamadas de dentro de `getStats()` e diretamente na 2ª leva de `renderHome()`, e também no Leitor/Histórias). Como essas tabelas só crescem com o uso da conta, o painel ficava progressivamente mais lento pra contas mais antigas — não por falta de índice (os índices em `cards`/`review_log`/`words` já estavam corretos, confirmado nos advisors da Onda 5), mas por reprocessar dados que já tinham acabado de ser buscados segundos antes.

**Correção** (`utils/db.js` + `dashboard/js/ui/homeView.js`):
- `renderHome()`: a 2ª leva agora reaproveita `stats.reviewLog` em vez de buscar de novo; `logToday` é derivado filtrando esse mesmo array (resultado matematicamente idêntico ao antigo `getReviewLog(1)`, sem a rede extra).
- `getAllSentences()`/`getAllKnownWords()`: ganharam o mesmo cache SWR de 30s de `getAllWords()`/`getAllCards()` (`_sentencesCache`/`_knownWordsCache`, com `_fetchSentences()`/`_fetchKnownWords()` seguindo o padrão de `_cacheGeneration` já existente pra evitar corrida com invalidação). `saveSentence()`/`deleteSentence()` passaram a chamar `_invalidateReadCache()` (não chamavam antes — não havia cache pra invalidar).
- `dashboard.html`: `<link rel="preconnect">` pro domínio do Supabase e pro Google Fonts, pra sobrepor o handshake de DNS/TLS com o parse do HTML em vez de pagar esse custo depois.

**Testado**: 30/30 `engine.test.mjs`, `release-smoke` verde (só o aviso esperado de árvore suja). Não achei nada de banco pra corrigir — é puramente um padrão de busca no cliente que ficava pior com o tempo de uso da conta.

---

## Execução Fable — 2026-07-12 (ONDA 8 — UX/produto, "toda a equipe: UX, diretor de arte, experiência do usuário")
> Pedido do dono: "os jogos estão chatos, não inspirados no Duolingo... perguntas das histórias só geram 3 e não escondem o texto... deixo na decisão da equipe... quero que veja a UX/design de tudo no Dashboard inspirado no Duolingo." Primeiro entreguei `docs/VISAO_PRODUTO_2026-07-12.md` (benchmark Duolingo/Anki/LingQ/Language Reactor com custo de implementação por item); esta onda executa os itens de maior prioridade/menor custo dessa lista.

**[Prof. didático] Quiz de história — 2 bugs reais corrigidos**: `normalizeQuiz()` em `storiesView.js` travava em EXATAMENTE 3 perguntas — se a IA devolvesse 4 por variação natural, o quiz inteiro era descartado. Agora aceita 3-5. Mais grave: `story-content` nunca era escondido durante o quiz (a caixa de perguntas só era injetada ACIMA do texto no DOM, mas o texto continuava 100% visível e rolável embaixo) — dava pra copiar a resposta em vez de responder de memória. `renderQuiz()` agora esconde o texto por padrão e oferece um botão consciente "👀 Não lembro — reler o texto" (toggle), preservando a opção de reler sem tornar isso o comportamento padrão.

**[Diretor de Arte + Prof. didático] Jogo redesenhado** (`gameView.js`, reescrito): a auditoria de UX (`VISAO_PRODUTO_2026-07-12.md`) apontou que a tela tinha sua própria paleta escura (`#1e1e2e`/`#89b4fa`, "Catppuccin" de terminal) sem nenhuma relação com a identidade verde/branca do resto do app — parecia outro produto. Reescrito para usar as mesmas `var(--color-*)` de `globals.css`. Ganhos de "sensação de jogo" (a queixa "chato"): combo visual (`makeComboTracker`, badge 🔥 que sobe/zera conforme acertos emendam), celebração com confete em CSS puro ao terminar (`celebrate()`), som de acerto/erro melhorado (`playChime`: arpejo de 2-3 notas em vez do bipe único de oscilador cru — ainda sem asset de áudio real, esse recurso não está disponível neste ambiente). **3º minijogo novo — "Monte a Frase"**: reaproveita literalmente a mecânica de banco de palavras (clicar pra montar, clicar de novo pra desfazer) do exercício builder do Estudo (`studyView.js:renderBuilder`), usando `words.context_sentence` que já existe — zero coluna ou tabela nova no banco.

**[Gerente + Eng. SRS] Sistema de conquistas** (`dashboard/js/core/achievements.js`, novo módulo puro): a auditoria apontou que o app tem os NÚMEROS (estatísticas) mas não tem o RITUAL de comemorar marcos — número é informação, badge é celebração, psicologicamente diferente. 12 badges (streak 7/30/100 dias, palavras salvas 50/100/500, palavras maduras 25/100/300, histórias 1/10/30), todos computados por `computeAchievements()` a partir de dados que JÁ EXISTEM (`user_stats.streak`, `stats.totalWords`, `stats.byStatus.mature`, contagem de `stories`) — nenhuma coluna nova. O "já visto" (pra não repetir a animação de celebração toda vez) persiste em `settings` — chave `lf_achievements_seen`, valor JSON — reaproveitando o k/v genérico que já existe, sem migration nenhuma. `newlyUnlocked()` compara o estado atual contra os já vistos e dispara um toast por badge novo (`homeView.js`, roda depois do render principal, não bloqueia nada). Nova seção "🏆 Conquistas" visual no Início (grade de badges, desbloqueadas em cor cheia, bloqueadas em cinza/grayscale — mostra o que falta alcançar). 4 testes novos em `tests/engine.test.mjs`.

**[QA] Auditoria de consistência visual — achado real, não cosmético**: `leaguesView.js` tinha a tela inteira com cores hardcoded em hex (`#3c3c3c`, `#777`, `#e5e5e5`, `#f9f9f9`, `#eee`...) em vez das variáveis de tema — isso não é só "fora do padrão", é um bug de **dark mode**: texto cinza-escuro fixo sobre um fundo que vira escuro no tema dark fica com contraste ruim/ilegível. Corrigido: toda a tela migrada pra `var(--color-*)` (inclusive o dourado do top-3, que por coincidência já tinha o mesmo valor hex de `--color-warning` — troca sem mudança visual nenhuma no tema claro). `libraryView.js` tinha 1 cor de hover hardcoded, corrigida igual. Demais views (`studyView`/`storiesView`/`settingsView`) auditadas e usam cor fixa só em botões/badges de ação sólidos com texto branco — isso é intencional (mesmo padrão do Duolingo: botões vívidos não mudam com o tema), não é bug, não mexi.

**[QA] Testado**: 34/34 `engine.test.mjs` (4 novos de conquistas), `release-smoke` verde (só o aviso esperado de árvore suja pré-commit), `node --check` em todos os arquivos tocados.

**O que ficou para depois** (não descartado — é a lista de custo médio/alto do documento de visão): perfis de SRS por categoria, otimizador FSRS pessoal a partir do histórico real, karaokê sincronizado na leitura, modo de estudo customizado (leeches/categoria isolados), gradiente de exposição de palavras estilo LingQ (5 níveis em vez de 2).

---

## Execução Fable — 2026-07-12 (ONDA 9 — "Pode fazer": estudo customizado, gradiente, perfis de SRS por categoria)
> Dono aprovou seguir com a lista de custo médio/alto de `docs/VISAO_PRODUTO_2026-07-12.md` ("Pode fazer"). Tratei com cuidado redobrado porque 2 dos 5 itens tocam o motor FSRS e a leitura — o coração de confiança do app.

**[Eng. SRS] Modo de estudo customizado** (`dashboard/js/ui/studyView.js`, `dashboard/js/ui/homeView.js`): `renderStudy` ganhou o parâmetro `weakOnly` — quando ativo, monta a fila a partir de `getAllCards()`+`getAllWords()` filtrados por `isWeakCard()` (3+ lapsos ou `is_leech`, função que já existia em `sessionQueue.js`), **ignorando due_date e a cota diária normal** — é remediação isolada, não a fila do dia (mesmo espírito do "Custom Study" do Anki). Entrada: botão "Revisar só estas" no card "🔎 No radar" do Início. Zero DB novo.

**[Linguista] Gradiente de leitura — mudança de plano no meio do caminho**: o documento de visão prometia um "gradiente de exposição estilo LingQ" via coluna nova `words.exposure_count`. Ao implementar, percebi que isso seria pior do que o que já temos disponível: `cards.status` já tem 4 estágios reais (`new`/`learning`/`review`/`mature`) vindos do FSRS. Troquei a abordagem — `readerView.js` agora usa esses 4 estágios (`wordStatus()` retorna `new`/`learning`/`review`/`known`, com uma 4ª cor verde-clara pro estágio `review`) em vez de 3. Nenhuma coluna nova, nenhuma migration. É mais fiel ao que a repetição espaçada mede de verdade (retenção comprovada) do que uma contagem crua de "quantas vezes eu vi essa palavra", que é a métrica que a própria LingQ usa e que eu decidi não copiar cegamente.

**[Eng. SRS + Backend] Perfis de SRS por categoria** (`utils/db.js`): `getSRSSettings(category)` agora aceita um parâmetro opcional — quando presente, busca TAMBÉM as chaves sufixadas (`lf_srs_retention:idiom`, `learning_steps:idiom`, `graduating_interval:idiom`) no MESMO request e sobrepõe sobre o valor global se existirem. Zero tabela/coluna nova — reaproveita o k/v de `settings` que já existe. Só 3 configs são sobrescrevíveis por categoria (as que fazem diferença pedagógica real); leech e limites diários continuam globais de propósito. `predictNextInterval`/`logReview` agora recebem a categoria da palavra (já disponível em `wordData.category` no cliente — zero rede extra pra descobrir). **Verificação de segurança do motor**: `_calculateNextState()` (a função central do FSRS) NÃO foi tocada — só mudou de onde o objeto `settings` que ela recebe vem. Sem passar `category`, o comportamento é bit-a-bit idêntico a antes (cache continua funcionando igual, só ganhou uma chave por categoria). Nova UI em Configurações (seletor de categoria + 3 campos + salvar/limpar).

**[Gerente] Decisão de adiar 2 itens — não foi esquecimento, foi julgamento técnico**:
- **Otimizador FSRS pessoal**: recalcular os 17 pesos do algoritmo a partir do histórico real de cada usuário é um algoritmo de otimização numérica (gradiente/L-BFGS sobre milhares de revisões) — não uma tela. Rushar isso sem validação numérica dedicada arrisca corromper o agendamento de todo mundo se tiver um bug sutil no gradiente. Isso é trabalho de dias, com testes próprios, não de uma sessão dentro de uma onda maior. Registrado como item isolado pro backlog.
- **Karaokê sincronizado na leitura**: nem Kokoro nem Google TTS devolvem timestamp por palavra. Uma aproximação por contagem de caracteres é possível, mas fica imprecisa o bastante pra parecer bug (destaque dessincronizado) em vez de um recurso "quase perfeito". Prefiro não entregar isso pela metade.

**[QA] Testado**: 34/34 `engine.test.mjs` (o motor FSRS central não mudou, então os testes existentes continuam validando a mesma coisa — nenhum teste precisou ser reescrito), `release-smoke` verde, `node --check` em todos os arquivos tocados.

---

## Execução Fable — 2026-07-12 (ONDA 10 — auditoria de bugs, "somente erros e bugs")
> Pedido do dono: "Faça uma auditoria em busca somente de erros e bugs." Disparei 3 agentes em paralelo cobrindo todo o código das Ondas 6-9 (mobile, performance, jogos/histórias/conquistas, estudo customizado/leitor/perfis de SRS) — nada disso tinha passado por uma auditoria dedicada ainda. Instrução para os 3: só bugs reais e alcançáveis, nada de estilo/sugestão.

**9 achados confirmados, todos corrigidos:**

1. **`storiesView.js` — regex de pontuação quebrada**: faltava escapar `\s` e os colchetes `[]` fechavam a classe de caracteres cedo demais — o teste `if (/^[s.,!?;:...]+$/.test(token))` nunca era verdadeiro pra pontuação de verdade. Resultado: toda vírgula/ponto/aspas em QUALQUER história virava um `<span class="story-word" tabIndex=0 role="button">` clicável com `aria-label="Ver tradução de ,"` — quebra de ordem de tabulação e leitor de tela em todas as histórias, sempre. Corrigida.

2. **`storiesView.js` — `normalizeQuiz` ainda descartava o quiz inteiro** em certas condições: a checagem `questions.length <= 5` rodava ANTES do corte pra 5 — se a IA devolvesse 6+ perguntas válidas, o quiz inteiro virava `[]` (o mesmo bug do "exatamente 3" da Onda 8, só que deslocado pro teto). Corrigido: agora corta pra 5 primeiro, só depois checa o mínimo de 3.

3. **`gameView.js` — combo nunca aparecia em "Ouça e Escolha"/"Monte a Frase"**: esses 2 jogos remontam o `container.innerHTML` a cada pergunta/rodada, e `makeComboTracker()` era recriado junto — o contador de combo zerava toda rodada, então nunca chegava a 2 acertos seguidos pra mostrar o badge. Só "Ligar Colunas" (que não remonta o container por partida) funcionava. `makeComboTracker` agora aceita um objeto `state` externo que sobrevive à remontagem do DOM.

4. **`gameView.js` — "Monte a Frase" gerava chip fantasma**: `context_sentence.trim().replace(/[.!?,;:]+$/, '').split(/\s+/)` deixava um token `""` quando a frase tinha espaço antes da pontuação final (ex.: "I like cats !" → `["I","like","cats",""]`). O jogador precisava encontrar e clicar um chip sem texto pra liberar "Verificar". Corrigido com `.trim()` extra + `.filter(Boolean)`.

5. **`gameView.js`/`app.js` — vazamento de `AudioContext`**: os 3 minijogos só fechavam o áudio no fim de partida normal — sair pela nav bar no meio deixava o contexto aberto pra sempre (nenhum hook de limpeza existia em `app.navigate()`). Adicionei `app.onLeaveView(fn)`: views registram limpeza, chamada automaticamente ANTES de trocar de rota. Os 3 jogos agora registram `audioCtx.close()` ali, além de continuar fechando no fim normal (fechar 2x é inofensivo).

6. **`readerView.js` — palavra sem card ainda pintada de "aprendendo"**: `loadStatusSets()` usava `else learningLemmas.add(l)` como fallback pra QUALQUER coisa que não fosse `mature`/`review` — incluindo palavras SEM card nenhum (`st === undefined`, quando `saveWord()` salva a palavra mas a criação do card falha por rede — são 2 escritas separadas). Corrigido: sem `st`, a palavra não entra em nenhum set e cai no default `'new'` de `wordStatus()`.

7. **`homeView.js` — HTML não escapado**: `weakWords[i].word` (texto que o próprio usuário salvou, sem sanitização, plausivelmente capturado de legenda/página) ia direto pra dentro de um `container.innerHTML` em 2 lugares (o "Plano de hoje" e o "No radar"). Uma palavra com `<`/`>`/`&` quebrava o layout ou injetava markup. Adicionei `escapeHtml()` (mesmo padrão já usado em `studyView.js`/`videoContext.js`) nos dois pontos.

8. **`homeView.js` — corrida de renderização em `renderHome()`**: chamadas sobrepostas (evento `WORD_SAVED` da extensão chegando durante um carregamento em voo, ou navegação rápida) não tinham ordem garantida — uma chamada MAIS ANTIGA podia terminar DEPOIS de uma mais nova e sobrescrever um painel já carregado certo com a tela de erro, ou disparar o toast de conquista em dobro (2 IIFEs lendo/escrevendo `lf_achievements_seen` sem coordenação). Adicionei um contador de geração (`_homeRenderGen`) — cada chamada carimba a sua e só "comita" (innerHTML final, toast de conquista) se ainda for a mais recente.

9. **`'phrasal_verb'` vs `'phrasal'` — divergência de categoria pré-existente, exposta pela minha própria feature nova**: o classificador de palavras da extensão (`background/service-worker.js`) sempre salvou `category = 'phrasal_verb'`, mas TODO o resto do app (`CATEGORY_OPTIONS`/`catMap`/aba do Cofre em `libraryView.js`, `TOPIC_LABELS` em `studyView.js`, e agora os Perfis de SRS por Categoria que acabei de construir na Onda 9) usa `'phrasal'`. Consequência prática: palavras classificadas como phrasal verb pela extensão nunca apareciam na aba "Phrasal Verbs" do Cofre nem eram alcançadas por "Revisar por tópico" — e configurar um perfil de SRS pra "Phrasal verbs" em Configurações ficava silenciosamente sem efeito nenhum pra essas palavras. Unifiquei em `'phrasal'` em todo o código (`service-worker.js` — classificador estático + prompt de IA + lista de validação; `settingsView.js` — meu dropdown novo; `homeView.js` — `CAT_LABEL` do "Foco da semana"). **Verifiquei a produção via SQL**: havia 1 palavra ("stick around") já salva com `category='phrasal_verb'` — corrigida direto no banco (autorização já concedida pelo dono nesta sessão pra correções em Supabase).

**Bônus de defesa em profundidade**: `getSRSSettings`/`getSRSCategoryOverrides` em `utils/db.js` não escapavam `category` antes de montar o filtro `in.()` do PostgREST (inconsistente com o método irmão `setSRSCategoryOverride`, que já fazia isso). Como `words.category` não é validada como enum no banco — só no classificador da extensão, que o caminho web/PWA não passa — uma categoria com vírgula/parêntese poderia quebrar o filtro. Adicionei `encodeURIComponent` nas duas funções.

**Descartado**: possível divergência de fuso entre o cálculo client-side do início de semana (missão semanal) e a RPC server-side — degrada bem (servidor sempre vence), não confirmado como reproduzível na prática.

**[QA] Testado**: 34/34 `engine.test.mjs`, `release-smoke` verde, `node --check` em todos os 8 arquivos tocados. As correções de regex/tokenizer foram verificadas diretamente no interpretador Node (o projeto não tem jsdom pra testar renderização de DOM em teste automatizado).
# Handoff Codex — programa de integridade e UX

## Handoff Codex — contrato pedagógico/economia P0.2 (2026-07-15)

- Contrato canônico: `docs/CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md`.
- Gates: `tests/pedagogy-economy-contract.test.mjs` (19/19),
  `tests/review-economy-p0-2.test.mjs` (23/23),
  `tests/review-outcome-ux.test.mjs` e `tests/card-write-contract-p0-2.test.mjs`.
- Regras que não podem regredir: XP igual nas quatro notas; 20 novos/dia;
  300 XP competitivo/dia sem bloquear review; prática livre sem XP/streak/liga
  ou FSRS; retry conserva outcome; undo não reabre recompensa nem quota.
- `ineligible` não entra no caminho de sucesso: stale refaz a fila; futuro,
  novo excedente e suspenso saem apenas da fila atual; nenhum deles incrementa
  sessão, combo ou XP.
- O snapshot do undo nasce antes das projeções; `stats_revision` impede que
  undo antigo apague atividade posterior. Review elegível com XP zero ainda
  pode sustentar streak, inclusive no ciclo review → undo → redo.
**Estado à época (superado pelo fechamento P0.2b acima):**

- Antes de produção: executar as propriedades SQL dinâmicas da migration,
  aplicar no Supabase pelo fluxo aprovado, validar preview autenticado e só
  então promover/observar produção.
- P0.2b está em `20260715155802_card_review_permissions_contract_p0_2b.sql`:
  validada no PostgreSQL local com apenas `SELECT` para `authenticated`, mas
  não deve ser aplicada antes do preview com o cliente `3.0.3`.
- Rollout expand remoto concluído: P0, P0.1, P0.2a e hardening de índices
  aplicados com sucesso no projeto `qnutoswrufznztoznlql`. Preview Vercel
  `dpl_ABJQVUdSXFJhgQMcS5QV6dwUkKYn` confirmou o SHA `96139b4` e cliente
  `3.0.3`. QA público 320/375/390 e console passaram; falta sessão autenticada
  para liberar P0.2b.
- Produção: `main`/`53a69d8`, Vercel
  `dpl_5GuwRZEJGhEPVpRyVXUyPSsN3Sry` READY. A P0.2b deve ser o próximo corte,
  mas somente depois de recarregar a extensão e provar cinco operações reais:
  salvar palavra/criar card, avaliar review, bury, suspender/reativar e restore.
  Depois disso, aplicar a contract migration e confirmar grants/policies/advisors.

## Plano UX/Races, Etapa 1 (2026-07-14)

### Estado

Etapa 1 implementada na branch `codex/review-mobile-video`; ainda não promover para produção antes do QA visual do preview. Objetivo desta etapa: estabilizar áudio, navegação e persistência da sessão antes do redesign.

## Implementação

- `utils/exclusive-playback.js`: coordenador de generation/cancel compartilhado.
- `dashboard/js/core/tts.js`: somente a geração atual pode criar áudio; HTMLAudio/Web Speech exclusivos; fallback idempotente; promises canceladas encerram com `false`.
- `utils/tts.js`: mesma exclusão mútua no TTS usado pela extensão; reprodução aguarda `ended`.
- `dashboard/js/core/app.js`: `navigationEpoch`, `renderEpoch`, AbortController, container/app protegidos contra commits e efeitos de renders obsoletos. Views novas podem usar `app.renderSignal` e `app.isCurrentRender()`.
- `dashboard/js/ui/studyView.js`: remove segundo autoplay; prompt imutável; cleanup integral em `app.onLeaveView`; generation local; fila inicial local; nota/bury com mutex e commit após persistência; feedback/XP somente após sucesso; aria-live não revela a palavra.
- `tests/audio-race.test.mjs`: concorrência fora de ordem, cancelamento, HTMLAudio único, fallback once e cancelamento de Speech.

## Contratos importantes

1. Chamar `playNaturalAudio` invalida qualquer chamada anterior, inclusive se ainda aguarda IDB/rede.
2. `stopAudio` invalida a geração e cancela HTMLAudio + SpeechSynthesis.
3. Enriquecimento assíncrono nunca altera o prompt visível nem dispara autoplay.
4. O card permanece na fila até `logReview` confirmar.
5. Sair e voltar ao Estudo durante uma mutation aguarda a operação antes de refazer a fila.
6. Render obsoleto não pode navegar, mostrar toast, registrar cleanup ou alterar seu container.

## Evidência

- `npm run test:audio`: 8/8.
- `npm run test:engine`: 37/37.
- `npm run test:video`: 4/4.
- `npm run test:local-day`: 5/5.
- `node --check`: app, TTS site/extensão e studyView aprovados.
- `git diff --check`: aprovado.

## QA manual do preview

1. Abrir Estudo num card sem chunks completos: ouvir exatamente uma vez, mesmo após a IA terminar.
2. Apertar áudio rapidamente duas vezes: somente a última reprodução continua.
3. Sair do Estudo durante áudio e voltar: nenhum som/timer da sessão anterior reaparece.
4. Colocar rede offline antes da nota: card permanece, botões reabilitam e erro é apresentado.
5. Clicar duas vezes em Adiar: somente um card é adiado; o seguinte não é pulado.
6. Navegar rapidamente Estudo → Início → Estudo: apenas a sessão mais recente publica fila e áudio.

## Próximo

Este próximo passo era válido em 2026-07-14 e foi concluído no handoff P0.2b do
topo. O corte atual é FSRS integralmente server-side; depois identidades
verificáveis/P0.3 e instrumentação do funil de aprendizagem. Em UX, validar o
fluxo já reorganizado com usuários antes de nova expansão visual. Ver
`CHECKLIST.md` e `docs/AUDITORIA_UX_FLUXO_2026-07-14.md`.

---

## Handoff Codex — P0.2 cliente / contrato de UX da revisão (2026-07-14)

### O que foi corrigido

- `utils/db.js` + `background/service-worker.js`: `createOperationId()` exportado; `logReview(..., operationId)` conserva o ID no proxy e retorna `accepted`/`duplicate`, `persisted`, `idempotent` e XP confirmado. Erros de escrita recebem e preservam através do proxy `status`, `code`, `kind` e `retryable`.
- `dashboard/js/ui/studyView.js`: cada card conserva `{operationId, grade, plannedState}` até ACK; nova tentativa não troca silenciosamente a nota quando o resultado anterior é desconhecido. Fila, som, combo, sessão e XP só mudam após persistência.
- `content/review-overlay.js`: mutex de teclado/clique, `aria-busy`, feedback real de salvamento, retry com o mesmo ID e nenhuma progressão em falha. Erro ao carregar não é mais exibido como “sem revisões”.
- `dashboard/js/core/app.js`: toasts com `role`, `aria-live` e `aria-atomic`.
- `tests/review-outcome-ux.test.mjs`: contratos de regressão incluídos em `npm run test:release`.

### Decisões que precisam ser preservadas

1. Offline-first ainda não existe para reviews; nunca dizer “sincronizado em segundo plano”. O card permanece até confirmação.
2. Timeout pode significar “commit aconteceu, resposta se perdeu”; por isso o mesmo ID, nota e planned state são reutilizados.
3. `duplicate` é sucesso canônico e avança uma vez, mas não repete XP/animação.
4. Erro funcional definitivo pode liberar um novo ID; offline/timeout/auth preservam o ID.
5. Não revogar escrita direta em `cards` antes das RPCs estreitas e do cliente novo estarem publicados.

### Próximo corte seguro do banco

1. P0.2a expand/cutover compatível: lock de `user_stats` e card; elegibilidade pelo estado armazenado; helper P0.1; snapshot server-side; trigger legado removido atomicamente; undo append-only; RPCs estreitas.
2. Cliente: migrar suspend/bury/reset e validar site + extensão no preview.
3. P0.2b contract: `REVOKE ALL` e grants mínimos em `cards`/`review_log`; remover policy ampla.

### Publicação desta fatia

- Commit funcional: `25f65e4` (`codex/review-mobile-video`).
- Preview Vercel: `dpl_FnwVZLxMrVYoTrk5MKpYCrVjNoo6`, SHA confirmado, `READY`, sem erro de runtime na janela de uma hora.
- Nenhuma migration aplicada no Supabase remoto; nenhuma promoção para produção.

---
# Handoff Codex — Reforma UX P0-A (2026-07-15)

## Entregue

- Navegação global: Hoje | Aprender | Cofre | Progresso.
- Novos hubs: `learnView.js` e `progressView.js`, preservando todas as rotas anteriores.
- Perfil reúne Configurações, tema e saída.
- Home usa `chooseTodayAction()` e exibe uma única CTA baseada na fila real.
- Metas, memória, XP, ofensiva, diagnóstico, conquistas e heatmap continuam disponíveis sob `Ver metas, memória e conquistas`.
- PWA web atualizado para `3.0.4`.
- Novo gate `npm run test:p0-a`, incluído no release.
- Commit funcional: `566bf1b`; preview Vercel `dpl_DwQechHca5i3N7uMuoQsRUmmVAyk` em estado `READY`, raiz HTTP 200, build sem erro e build web `3.0.4` confirmado.

## Não alterar neste corte

- Engine/FSRS, áudio, vídeo, RPCs, persistência e economia.
- Shell de foco do Estudo.
- Contrato: fila vazia direciona para Aprender, nunca para Estudo.
- Contrato: uma única CTA no primeiro nível da Home.

## Próximo

P0-B: painel `Entender melhor`, com trecho original primeiro, explicação/tutor contextual, prática curta e fontes adicionais progressivas. Depois: P0-C de nomenclatura e estados globais.

---
# Handoff Codex — Reforma UX P0-B (2026-07-15)

## Entregue

- `Explorar esta frase` virou `Entender melhor`.
- Ordem: trecho original, significado/tutor, prática curta e fontes adicionais.
- Tutor tem três perguntas sugeridas e permanece estritamente sob demanda.
- Chunks: dois recomendados primeiro, restante em `Ver mais`.
- YouGlish/Tatoeba continuam lazy em `Mais exemplos e fontes`.
- Undo, regeneração e bury ficam no menu `⋯` separado.
- Painel lateral no desktop; bottom sheet acima das notas no celular.
- Engine e player não foram alterados; build web `3.0.5`.
- Commit funcional `1401b46`; preview Vercel `dpl_3YRiNr7aTNXQXroE5YQP1kD7TtXv` em estado `READY`, raiz HTTP 200 e nenhum erro de build/runtime na janela consultada.

## Gates

- `npm run test:p0-b`.
- `npm run test:study-focus`.
- `npm run test:study-video`.
- `npm run test:audio`.

## Próximo

P0-C: nomenclatura, estados globais e componentes compartilhados. Antes de produção, executar QA autenticado do P0-A/P0-B em desktop e celular real.

---

# Handoff Codex — Reforma UX P0-C (2026-07-15)

## Entregue pelo Codex

- Helper compartilhado `viewState.js` para loading/vazio/erro/retry.
- Adoção em Hoje, Cofre, Progresso, Leitor, Histórias e Prática.
- Histórias diferencia falha remota, fallback local e vazio real.
- Práticas não ficam presas em loading quando uma consulta rejeita.
- Linguagem principal usa frase/expressão/revisão/memória estável; jargão de
  card/FSRS permanece apenas em áreas técnicas.
- Home não apresenta `mature` como conhecimento ou domínio.
- Build web/PWA `3.0.6`; gate `npm run test:p0-c` dentro do release.
- Commit funcional `dab4da7`; preview
  `dpl_HCzxdDNFChuezeadpP5oZzEK7Zau` `READY` em
  `https://linguaflow-jdm5nae3k-wesleys-projects-de111a83.vercel.app`, raiz
  HTTP 200, build sem erros e nenhum runtime `error`/`fatal` observado.

## Preservar

- Engine, FSRS, player, áudio, persistência e economia não foram alterados.
- Erro de leitura não pode ser convertido em vazio.
- Prática livre não altera placar, ofensiva, liga ou agendamento.
- Estados compartilhados têm uma ação primária no máximo.

## Próximo

P1-A: Cofre e Configurações. Depois Histórias/Leitor, onboarding,
Prática/Progresso e QA autenticado desktop/mobile antes de produção.

---

# Handoff Codex — Reforma UX P1-A (2026-07-15)

## Entregue pelo Codex

- Cofre prioriza frase contextual, usa estado real do card e mantém todas as
  ações/vídeo.
- Dados salvos exibidos no Cofre são escapados antes do HTML.
- Filtros têm estado acessível e vazios oferecem próximo passo real.
- Settings não substitui falha remota por defaults salváveis.
- Novas expressões: default 5 e máximo 20, alinhado ao contrato server-side.
- CEFR/retention/leech ganharam microcopy honesta, sem trocar chaves técnicas.
- Build `3.0.7`; gate `npm run test:p1-a` dentro do release.
- Commit funcional `28a64a8`; preview
  `dpl_5VjfRUnCWukiL6kew9ubZpQqQnvS` `READY` em
  `https://linguaflow-c543kzmik-wesleys-projects-de111a83.vercel.app`, HTTP 200,
  build sem erros e nenhum runtime `error`/`fatal` observado.

## Preservar

- `renderVideoContext`, `attachVideoContext`, UUIDs e rota de revisão por
  categoria.
- Todas as chaves de Settings consumidas pelo agendador.
- Falha de leitura de Settings deve bloquear save e oferecer retry.

## Próximo

P1-B: unificar a arquitetura de Histórias e Leitor; depois onboarding,
Prática/Progresso e QA autenticado.

---

# Handoff Codex — Reforma UX P1-B (2026-07-15)

- `readingHub.js` une Histórias e Leitor sob `Ler com contexto`.
- Rotas, geração, importação, áudio, quiz e salvamento foram preservados.
- Leitor diferencia progresso indisponível de vocabulário realmente novo.
- Ajuda do Leitor ficou recolhida; importação é a ação principal.
- Histórias usa familiaridade estimada e não chama exposição de fixação.
- Build `3.0.8`; gate `npm run test:p1-b` no release.
- Preview `dpl_3Fv2Y53ntRFEepgE5bs784x51i9i` `READY` em
  `https://linguaflow-ipcg8n8kn-wesleys-projects-de111a83.vercel.app`.

**Próximo:** P1-C onboarding; depois Prática/Progresso e QA autenticado.

---

# Handoff Codex — Reforma UX P1-C (2026-07-15)

- Onboarding usa nível aproximado e carga Leve/Regular/Intensa.
- Cargas correspondem a 5/10/20 novas expressões, dentro do cap server-side.
- Preferências reais são aguardadas e confirmadas antes de marcar onboarding
  concluído; não há mais writes fire-and-forget.
- Build `3.0.9`; gate `npm run test:p1-c` no release.
- Preview `dpl_7Rmw53ngcTQBekdVrWn9ftR7eJT1` `READY` em
  `https://linguaflow-nebgifb96-wesleys-projects-de111a83.vercel.app`.

**Próximo:** P1-D Prática/Progresso; depois QA autenticado.

---

# Handoff Codex — Reforma UX P1-D (2026-07-15)

- Prática explica antes do início o que cada modo treina: Reconhecimento,
  Escuta ou Produção guiada.
- Resultado da rodada é local e não altera agendamento, XP, ofensiva ou Liga;
  combo permanece somente visual.
- A seleção de Prática exclui expressões atualmente devidas, evitando ensaio
  antes da revisão SRS; preservar `getPracticeWords()` e esse filtro.
- Progresso prioriza retenção/carga e apresenta Liga como atividade competitiva
  opcional.
- Estatísticas põe retenção, agenda e estado da memória acima de minutos e
  volume; atividade não é apresentada como domínio.
- Percentual de lembrança é identificado como autoavaliação; Liga declara que
  seu XP agrega atividades e não mede domínio.
- Build `3.0.10`; gate `npm run test:p1-d` dentro do release.
- Commit `c7f0c4a`; preview `dpl_6WeDKTx9Di6K3yUqPsR6YBo7ATAD` `READY` em
  `https://linguaflow-aee5u6518-wesleys-projects-de111a83.vercel.app`, HTTP 200,
  build sem erros e nenhum runtime `error`/`fatal` observado.
- Preservar engine, handlers dos três jogos, FSRS, economia e regras da Liga.

**Próximo:** QA autenticado desktop/mobile de toda a reforma antes de produção.

---

# Handoff Codex — P0.3 candidato de produção 3.0.11 (2026-07-16)

- Responsável: Codex, com auditorias sênior independentes de UX/QA,
  pedagogia/economia e Infra/Supabase.
- Fechados: guarda de autenticação, signup sem sessão, erros falsamente vazios,
  listeners globais, popup mobile, CEFR em dois espelhos, weak-only vencido e
  prática sem truncamento em 500.
- Economia: Stories/quiz/vídeo não mintam XP declarado pelo browser; os métodos
  cliente legados foram removidos. Review atômico continua sendo o escritor
  competitivo qualificado.
- Privacidade: cliente usa `rpc/get_leaderboard` e não depende mais da leitura
  global de `user_stats`.
- A etapa expand local `20260716124439_expand_safe_leaderboard_p0_3.sql` foi
  aplicada remotamente como `20260716160424_expand_safe_leaderboard_p0_3` e
  verificada sem retirar as policies do cliente antigo. Depois do deploy,
  `20260716124440_contract_user_stats_and_legacy_xp_p0_3.sql` revoga as RPCs
  legadas e remove INSERT/leitura global de `user_stats`; contract ainda não foi
  aplicada.
- Build `3.0.11`; rotas Vercel incluem `/learn` e `/progress`.
- `npm run test:release -- --allow-dirty` aprovado; a gate agora cobre também
  engine, áudio, YouTube, vídeo, legendas, HBO/Max e os três contratos novos.
- Docker/Supabase CLI indisponíveis: sem replay local SQL. Não usar
  `supabase db push`, porque há divergência histórica de timestamps entre o
  repositório e o projeto remoto.

**Evidência:** commit funcional `0a8688a`, PR GitHub `#8`, preview Vercel
`dpl_9rHjmtmYqizxsEC8YPckb5dmFW1A` `READY`, raiz HTTP 200, build limpo e sem
runtime errors observados. Smoke SQL autenticado confirmou a RPC do placar. QA
público `390x844` confirmou guarda de `/learn`, shell oculto, ausência de
overflow e console limpo.

**Bloqueios externos:** workflow `29514178635` não iniciou porque o GitHub
informa conta bloqueada por cobrança; ChatGPT Chrome Extension/native host não
estão instalados, impedindo usar a sessão real. Não confundir esses bloqueios
com falha da suíte, que passou localmente duas vezes.

**Ainda falta antes de produção:** desbloquear Actions, CI verde, QA autenticado
desktop/mobile/extensão, promoção do mesmo SHA, contract e smoke pós-migration.
Produção atual permanece em `ca9fbc9`;
rollback web disponível em `dpl_8eLCZupbmkBtAvGJVeYaLytSRghw`.

## Atualização de release — 2026-07-16

- GitHub Actions foi desbloqueado; rerun `29514633988` passou integralmente.
- PR `#8` está pronto para revisão e o preview mais recente
  `dpl_13DyPNiDQf2gmB8FhTrG2Qz1tqbZ` está `READY`.
- Codex atualizou `checkout`/`setup-node` para `v5`, removendo o aviso do
  runtime interno Node 20 das actions sem mudar o Node 20 usado para testar o
  produto.
- `test:release` agora inclui `test:stage3` (focus shell + study focus),
  `test:product-ux` e `test:design-system`; `max-ui` deixou de rodar duas vezes.
- GitHub Actions usa privilégio mínimo: leitura global, escrita somente no job
  de release por tag e checkout sem credencial persistida.
- Ordem restante: validar o CI do commit final; smoke autenticado; promover o
  SHA aprovado; aplicar somente então
  `20260716124440_contract_user_stats_and_legacy_xp_p0_3.sql`; smoke de placar,
  revisão e produção. Não usar `supabase db push`.
- Candidato final `123aac3`: release local verde, Actions `29515494106`
  `success`, preview `dpl_HSMLfAnL9PokuVGCiGPhJgsCZhUy` `READY` e build sem
  erros. Próximo gate é exclusivamente o smoke autenticado; não aplicar o
  contract antes dele e da promoção do dashboard.

## Handoff pós-produção — 2026-07-16

- PR `#8` foi integrado em `main` no merge `bcc53ed`.
- Produção `dpl_DWv1HTxD6DuS3ZP1Axzz5nvQwkcy` está `READY` no domínio oficial,
  com build `3.0.11`, `/` e `/learn` HTTP 200 e logs Vercel sem erros.
- Contract aplicado como migration remota
  `20260716163329_contract_user_stats_and_legacy_xp_p0_3`.
- Confirmado: RPCs antigas de XP sem EXECUTE; `user_stats` somente leitura da
  própria linha; leaderboard e writer atômico de revisão apenas para
  autenticado; tráfego real pós-corte retornando HTTP 200.
- Não reverter apenas o site para `ca9fbc9`: esse cliente é incompatível com o
  contract. Em incidente, corrigir web para frente e banco por nova migration;
  nunca reescrever histórico ou usar `supabase db push`.
- Limitação aceita pelo responsável: extensão/YouTube/Max não recebeu smoke
  interativo do Codex porque a integração Chrome permaneceu indisponível.

---
