# Checklist — LinguaFlow

## 🟠 MAX/HBO — safe-area, controles e popup (Codex, 2026-07-15)

- [x] Versionar a extensão como `3.0.4` para tornar a atualização verificável.
- [x] QA real 3.0.4: identificar dock horizontal sobre a legenda e fallback incorreto do popup fixo.
- [x] Corrigir em `3.0.5`: dock vertical à direita, legenda Max em `137px` e popup sempre acima do retângulo visível.
- [x] Preservar integralmente `content/subtitle-engine.js` e `content/engine/*`.
- [x] Posicionar legenda acima da timeline/barra real, com fallback estável quando controles somem.
- [x] Adicionar dock Max com toggle, anterior, replay, próxima, painel e configurações.
- [x] Reancorar popup no retângulo clicado, sempre acima da legenda e com scroll quando não couber.
- [x] Usar o mesmo overlay root em modo normal/fullscreen e sobreviver a remount da barra.
- [x] Adicionar testes determinísticos de desktop, viewport compacta, controles ocultos e popup alto.
- [ ] Revalidar visualmente a versão `3.0.5` na HBO autenticada.

## 🧠 REVOLUÇÃO DE PRODUTO — plano mestre real (Codex, 2026-07-14)

> Documento canônico: `docs/PLANO_MESTRE_PRODUTO_REAL_2026-07-14.md`. A antiga Etapa 4 de reorganização visual isolada não deve começar antes destas fundações.

### Remoção definitiva da Nova Guia

- [x] Confirmar que `manifest.json` não possui `chrome_url_overrides.newtab`.
- [x] Remover os arquivos legados `dashboard/newtab.html` e `dashboard/newtab.js`.
- [x] Manter aberturas de guia apenas após ação explícita do usuário.
- [x] Impedir regressão no smoke de release.

### Fase 0 — Verdade e medição

- [x] Auditar código, migrations, economia, jornadas e banco real.
- [x] Definir promessa, ciclo central e métrica norte.
- [x] Documentar arquitetura da informação e roadmap por dependência.
- [x] Definir taxonomia de eventos e esquema de evidência (`docs/FUNDACAO_EVIDENCIA_P0_2026-07-14.md` + migration expand-only).
- [ ] Instrumentar funil vídeo → captura → primeira revisão → retenção D1/D7.
- [ ] Realizar 5 sessões observadas e 6–8 entrevistas com público-alvo.

### Fase 1 — Integridade e anti-farm

- [x] Especificar ledger, regras de XP qualificado, RPCs v2, rollout e testes (`docs/FUNDACAO_EVIDENCIA_P0_2026-07-14.md`).
- [x] Criar migration expand-only dos ledgers com CLI oficial, RLS e grants explícitos.
- [x] Validar migration em Postgres 17 efêmero com testes SQL de propriedade, grants, reversão e RLS.
- [x] Publicar commit `7662ea5` no preview; Vercel `READY`, raiz `200`, sem erros de runtime na janela de uma hora consultada.
- [ ] Regularizar o faturamento do GitHub Actions e reexecutar o workflow `Build and Release` (o run `29348470440` foi recusado antes do runner).
- [ ] Ledger idempotente de tentativas e recompensas.
- [x] Mapear todos os escritores legados e fechar a sequência P0.1/P0.2/P0.3 (`docs/ONDA_P0_1_PORTAO_DE_EVIDENCIA_2026-07-14.md`).
- [x] P0.1: helper privada transacional expand-only + replay de 23 migrations, rollback, timezone, grants e 40 conexões concorrentes.
- [x] P0.2/cliente — contrato confiável de review: `operation_id` nasce antes da tentativa e é conservado no retry; accepted/duplicate são explícitos; duplicate nunca anima XP; falha mantém o card no site e na revisão rápida.
- [x] P0.2/UX — revisão rápida bloqueia clique+tecla concorrentes, distingue falha de carga de fila vazia, não anuncia conclusão após erro e expõe estados de salvamento via `aria-live`; toasts globais ganharam semântica acessível.
- [x] P0.2/QA cliente — contratos automatizados em `tests/review-outcome-ux.test.mjs`, incluídos no `test:release`; regressões de motor, áudio, vídeo, shell, evidência e release revalidadas.
- [x] P0.2a/banco expand — implementado, validado em PG17.6 e aplicado remotamente: elegibilidade/locks/snapshots server-side, ledger P0.1, undo append-only e RPCs estreitas.
- [x] P0.2/cliente cutover (código) — bury/suspender/restore/criação migrados para RPCs estreitas; nenhum chamador de tela usa `PATCH cards`.
- [x] P0.2/preview/extensão autenticados — cliente `3.0.3` recarregado e cinco fluxos reais aprovados pelo dono antes da contração de grants.
- [x] P0.2b/banco contract — aplicado remotamente como `20260715165807`: `cards`/`review_log` somente `SELECT` para `authenticated`, policies owner-only e oito RPCs estreitas sem `anon`/`PUBLIC`.
- [ ] P0.2: identidades server-side para review, jogo, quiz, vídeo e quests.
- [ ] P0.3: opening balance diferencial e neutralização atômica de todos os escritores legados.
- [ ] XP calculado no servidor por evidência, não por quantidade declarada.
- [ ] Separar prática ilimitada de pontuação competitiva.
- [ ] Impedir XP repetido por item × habilidade × janela.
- [ ] Revisar RPCs `SECURITY DEFINER`, propriedade e parâmetros.
- [ ] Migrar missões, streak e ligas para aprendizagem qualificada.

#### Gate pedagógico/economia para promoção

- [x] Formalizar o contrato canônico em `docs/CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md`.
- [x] Incluir `tests/pedagogy-economy-contract.test.mjs` e `tests/review-economy-p0-2.test.mjs` na suíte de release e mantê-los verdes.
- [x] Remover XP competitivo dos três jogos apresentados como Prática livre; manter a prática disponível sem alterar placar, streak, liga ou FSRS futuro.
- [x] Remover prêmio duplicado de missão diária e meta/prêmio semanal circular de XP.
- [x] Substituir missão de captura por evidência de recuperação ou produção; enquanto não houver medição confiável, não premiar coleta.
- [x] Remover promessa de bônus do primeiro estudo sem evento qualificado.
- [x] Validar em PostgreSQL 17.6 descartável: XP igual para quatro notas; 20 novos/dia; 300 XP competitivo/dia sem bloquear review; retry, 20 conexões concorrentes e undo/redo não farmáveis (`docs/P0_2A_DADOS_VALIDACAO_2026-07-15.md`).

### Fases seguintes

- [ ] Fase 2: fonte/trecho/item/sentido/domínio e deduplicação contextual.
- [ ] Fase 3: Home `Hoje` com plano adaptativo.
- [ ] Fase 4: vídeo + captura + revisão multimodal ponta a ponta.
- [ ] Fase 5: Imersão e biblioteca organizadas por fonte.
- [ ] Fase 6: progresso, ligas e motivação saudável.
- [ ] Fase 7: sistema visual próprio, QA e performance budgets.

## 🧭 PLANO UX/RACES — execução por etapas (Codex, iniciado em 2026-07-14)

> Plano completo: `docs/AUDITORIA_UX_FLUXO_2026-07-14.md`. Regra: nenhuma função é removida; corrigir concorrência antes de reorganizar a interface. Toda etapa termina com testes, handoff e preview antes de produção.

### ✅ ETAPA 1 — Áudio único e lifecycle seguro

- [x] Remover o segundo autoplay disparado pelo enriquecimento assíncrono do card.
- [x] Tornar o prompt imutável durante a tentativa; enriquecimento tardio vale no próximo encontro.
- [x] Criar controlador compartilhado `ExclusivePlayback` com generation token.
- [x] Invalidar respostas TTS antigas depois de cada `await`.
- [x] Garantir apenas um HTMLAudio ativo e fallback idempotente.
- [x] Cancelar também `speechSynthesis` ao trocar card/rota ou parar áudio.
- [x] Aplicar exclusão mútua ao TTS do site e da extensão.
- [x] Adicionar cleanup completo do Estudo: TTS, YouTube/loop, YouGlish, timers, atalhos, callbacks e AudioContexts.
- [x] Adicionar generation token local ao Estudo e impedir sessão antiga de publicar fila/DOM.
- [x] Adicionar `navigationEpoch`/`renderEpoch` e AbortController global em `app.js`.
- [x] Nota só remove card/contabiliza XP depois da RPC atômica confirmar.
- [x] Falha de nota mantém card e fila; não exibe sucesso falso.
- [x] `bury` com mutex; clique duplo não executa dois `shift()`.
- [x] `aria-live` não anuncia a resposta escondida.
- [x] Teste determinístico de áudio concorrente: 8/8.
- [x] Regressão: motor 37/37, vídeo 4/4, calendário 5/5.
- [ ] QA visual no preview: áudio único, sair/voltar, falha offline durante nota e clique duplo em adiar.

### ✅ ETAPA 2 — YouTube, legendas e Web Reader

- [x] Unificar o fim do clipe em uma máquina de estados/ciclo único.
- [x] Permitir retry da API/player após timeout ou erro inicial.
- [x] Repetir com `seekTo`, sem recarregar o iframe e sem flash preto entre ciclos.
- [x] Reconhecer `video_start_ms`/`video_end_ms` e abrir o link no início da frase.
- [x] Impedir callback atrasado de alterar outra apresentação do mesmo card.
- [x] Criar epoch/AbortController por navegação de vídeo na extensão.
- [x] Impedir cues/traduções antigas de sobrescrever vídeo/legenda atual.
- [x] Remover listeners, observers, timers e RAFs acumulados no subtitle engine.
- [x] Excluir os domínios próprios do LinguaFlow da injeção do Web Reader.
- [x] Deduplicar mouseup/dblclick e tokenizar tradução da seleção.
- [x] Salvar pelo Web Reader em fila local-first; sincronizar banco em segundo plano.
- [x] Adicionar testes de timer+ENDED, vídeo A→B, tradução obsoleta, domínio e lifecycle.
- [x] Testes específicos: player 12/12, contexto 10/10, estudo/vídeo 4/4, domínio 14/14, Web Reader 6/6 e legendas 13/13.
- [ ] QA autenticado no preview e QA da extensão real: loop/pause/replay, navegação A→B e salvamento local-first.

### ✅ ETAPA 3 — Modo foco e nova tela de cards

- [x] Ocultar shell global durante a sessão; header mínimo com sair/progresso real/menu.
- [x] Restaurar topbar, scroll e menu ao sair, trocar rota, autenticar ou voltar pelo BFCache.
- [x] Frente limitada a áudio, prompt/exercício e Revelar.
- [x] Verso prioriza resposta, pronúncia, tradução e notas antes de qualquer recurso auxiliar.
- [x] Tutor/vídeo/YouGlish/Tatoeba/chunks/mnemônico, Undo, Bury e melhoria de frase preservados em Explorar.
- [x] Remover sidebar permanente; gaveta fica invisível/recolhida até revelar.
- [x] Dock mobile de quatro notas em uma linha; remover compensação de 186 px.
- [x] Exercícios sem autoavanço: erro confirma Errei; acerto oferece Difícil/Bom/Fácil.
- [x] Atalhos ignoram notas ocultas e foco vai para a primeira decisão válida.
- [x] Waveform só durante playback, reseta em falha/cancelamento e respeita `prefers-reduced-motion`.
- [x] Um único scroll owner no modo foco, com safe-area e toast sem colisão com o dock.
- [x] Contratos automatizados: shell 25/25 e Estudo 14/14.
- [ ] QA visual autenticado em desktop e 320/375/390 px: frente, verso, Explorar, exercícios, teclado e scroll.

### 🗂️ ETAPA 4 — Arquitetura de informação

> Próxima etapa visual. O contrato de feedback verdadeiro da revisão (salvando/confirmado/duplicate/offline/auth/retry) foi fechado antes da reorganização para que o redesign não esconda estados falsos sob uma nova aparência.

- [x] Home organizada em Hoje → Missões → Insights → Conquistas/Atividade.
- [x] Cofre com busca, chips, filtros recolhidos e ações contextuais.
- [x] Histórias separa Criar de Ler e usa toolbar por etapa.
- [x] Configurações em cinco grupos; FSRS detalhado em Avançado.
- [x] Navegação mobile com Início, Conteúdo, Cofre e Mais.

### 🧩 ETAPA 5 — Design system e aceite final

- [x] Extrair estilos inline relevantes para componentes/tokens.
- [x] Uma CTA primária por estado e padrões únicos de loading/erro/retry/offline.
- [x] Auditoria automatizada de acessibilidade, responsividade e performance de layout.
- [x] Preview `96139b4`/cliente `3.0.3`: READY, zero erro próprio de console e sem overflow em 320/375/390 px na superfície pública.
- [x] Preview aprovado → produção `53a69d8` → observação inicial sem erro Vercel/console e API Supabase respondendo 200/204.

## 🔴 ONDA 10 — Auditoria de bugs (só erros, sem features) (2026-07-12)
> Pedido do dono: "Faça uma auditoria em busca somente de erros e bugs." 3 agentes em paralelo, cada um cobrindo o código das Ondas 6-9 (nunca tinha passado por uma auditoria dedicada). 9 achados reais confirmados e corrigidos, 1 descartado por baixa confiança.
- [x] [Prof. didático] **Regex quebrada em `storiesView.js`**: `/^[s.,!?;:"'()[]{}*#—–-“”‘’]+$/` (faltava `\` antes do `s`, colchetes não escapados fechando a classe cedo) fazia com que NENHUMA pontuação fosse reconhecida como pontuação — toda vírgula/ponto/aspas de TODA história virava um span clicável, focável por Tab, com `aria-label="Ver tradução de ,"`. Quebrava a ordem de tabulação e poluía leitores de tela em qualquer história. Corrigida.
- [x] [Prof. didático] **`normalizeQuiz` ainda descartava o quiz inteiro** se a IA devolvesse 6+ perguntas válidas (`length <= 5` antes de cortar, não depois) — o mesmo bug da trava em "exatamente 3" só que deslocado. Agora corta pra 5 ANTES de checar o mínimo de 3.
- [x] [Diretor de Arte] **Combo do Jogo nunca aparecia em "Ouça e Escolha" e "Monte a Frase"**: `makeComboTracker()` era recriado a CADA rodada (o container é remontado a cada pergunta), zerando o contador antes de completar 2 acertos seguidos — a feature "combo visual" da Onda 8 estava sistematicamente quebrada nesses 2 dos 3 jogos. Corrigido com um objeto de estado externo que sobrevive à remontagem do DOM.
- [x] [Prof. didático] **"Monte a Frase" gerava um chip fantasma vazio** quando a frase salva tinha espaço antes da pontuação final (ex.: "I like cats !") — o jogador precisava encontrar e posicionar um chip sem texto pra liberar o botão "Verificar". Corrigido.
- [x] [Eng. Backend] **Vazamento de `AudioContext`** nos 3 minijogos: sair do Jogo pela barra de navegação NO MEIO de uma partida nunca fechava o áudio (só fechava no fim de partida normal). `app.js` ganhou um hook genérico `onLeaveView()` — views registram limpeza, chamada automaticamente antes de trocar de rota.
- [x] [Linguista] **Palavras sem card ainda ficavam pintadas de "aprendendo" (amarelo) no Leitor** em vez de "nunca vista" (azul) — acontecia quando `saveWord()` salvava a palavra mas a criação do card falhava (são 2 operações separadas). Corrigido pra cair em "new" por padrão.
- [x] [Eng. Backend/Segurança] **Texto de palavra do usuário interpolado sem escape em `innerHTML`** no card "Plano de hoje" do Início — uma palavra salva contendo `<`/`>`/`&` (plausível, capturada de legendas/páginas) quebrava o layout ou injetava markup não intencional. Corrigido com `escapeHtml()`.
- [x] [Gerente] **Corrida de renderização em `renderHome()`**: chamadas sobrepostas (evento `WORD_SAVED` da extensão chegando enquanto um carregamento anterior ainda estava em voo, ou cliques rápidos na aba Início) não tinham ordem garantida — uma chamada mais antiga podia sobrescrever um painel já carregado certo com a tela de erro, ou disparar o toast de conquista em dobro. Corrigido com um contador de geração: só a chamada mais recente "comita" a tela.
- [x] [Backend] **`'phrasal_verb'` vs `'phrasal'` — categoria dividida em dois valores desde antes desta sessão**: o classificador da extensão (`service-worker.js`) salvava `'phrasal_verb'`, mas TODO o resto do app (abas do Cofre, `TOPIC_LABELS` do Estudo, e agora os novos perfis de SRS por categoria da Onda 9) espera `'phrasal'`. Palavras assim classificadas nunca apareciam na aba "Phrasal Verbs" nem eram alcançadas por "Revisar por tópico" — e o perfil de SRS por categoria que acabamos de construir ficava silenciosamente sem efeito pra quem configurasse "Phrasal verbs". Unificado em `'phrasal'` em todo o código; **1 palavra já afetada em produção corrigida via SQL** (autorização já concedida pelo dono nesta sessão).
- [x] [Eng. Backend/Segurança] **`category` sem `encodeURIComponent` no filtro `in.()` do PostgREST** em `getSRSSettings`/`getSRSCategoryOverrides` — inconsistente com o método irmão (`setSRSCategoryOverride`), que já escapava. `words.category` não é validada como enum no banco (só no classificador da extensão, que o caminho web/PWA não passa), então em teoria uma categoria com vírgula/parêntese quebraria o filtro. Corrigido por defesa em profundidade.
- [ ] **Descartado por baixa confiança**: possível divergência de fuso entre o cálculo client-side do início da semana (missão semanal) e o cálculo server-side da RPC — degrada bem (o servidor sempre vence), não confirmado como reproduzível.
- [x] [QA] Suíte revalidada: 34/34 `engine.test.mjs`, `release-smoke` verde. Correções de DOM/regex verificadas diretamente no interpretador Node (não há jsdom no projeto pra testar renderização).

## 🟣 ONDA 9 — Personalização Anki/LingQ: estudo customizado, gradiente, perfis por categoria (2026-07-12)
> Pedido do dono: "Pode fazer" (autorização pra seguir com a lista de custo médio/alto de `docs/VISAO_PRODUTO_2026-07-12.md`). Feito com cuidado redobrado — 2 dos 5 itens tocam o motor de agendamento (FSRS) e a leitura, que são o coração de confiança do app.
- [x] [Eng. SRS] **Modo de estudo customizado (paridade Anki "Custom Study")**: `app.navigate('study', {weakOnly: true})` — nova opção que revisa SÓ cards fracos (3+ lapsos) ou leech, **ignorando a cota diária normal e o `due_date`** (é remediação, não a fila do dia — mesmo espírito do Custom Study do Anki). Botão "Revisar só estas" aparece no card "🔎 No radar" do Início quando há palavras fracas. Zero coluna nova — reaproveita `isWeakCard()` que já existia em `sessionQueue.js`.
- [x] [Linguista] **Gradiente de estágio no Leitor (em vez de "gradiente de exposição" da LingQ)**: eu disse na visão de produto que ia ser "quantas vezes você viu a palavra" (coluna nova `exposure_count`) — no meio da implementação percebi que o app já rastreia algo MAIS confiável: os 4 estágios reais do FSRS (`new`/`learning`/`review`/`mature`). Troquei de plano: zero coluna nova, o Leitor agora usa 4 cores (era 3) baseadas no estágio de retenção de verdade, não em contagem crua de visualizações. Mais fiel ao que a repetição espaçada mede.
- [x] [Eng. SRS + Backend] **Perfis de SRS por categoria** (`getSRSSettings(category)`, `getSRSCategoryOverrides`, `setSRSCategoryOverride` em `utils/db.js`): retenção/learning-steps/intervalo-de-graduação agora podem ser sobrescritos por categoria (phrasal_verb/idiom/slang/word), reaproveitando o MESMO settings k/v com chave sufixada (`lf_srs_retention:idiom`) — zero tabela/coluna nova. Nova UI em Configurações. **Sem categoria, o comportamento é bit-a-bit idêntico a antes** (nenhum teste de `_calculateNextState` quebrou — a função central do FSRS não foi tocada, só a FONTE do objeto `settings` que ela recebe).
- [x] [QA] Suíte revalidada: 34/34 `engine.test.mjs` (o motor FSRS em si não mudou, então nenhum teste precisou mudar), `release-smoke` verde.
- **[Gerente] Adiado por decisão técnica, não esquecimento** — 2 itens da lista original:
  - **Otimizador FSRS pessoal** (recalcular os 17 pesos do algoritmo a partir do histórico de cada usuário): é um algoritmo de otimização numérica de verdade (gradiente/L-BFGS sobre milhares de revisões), não uma tela de CRUD. Implementar isso rápido, sem tempo de validar contra casos reais, é o tipo de mudança que — se tiver um bug sutil — corrompe o agendamento de TODOS os cards de quem usar. É trabalho de dias com testes numéricos dedicados, não de uma sessão. Fica no backlog como item isolado.
  - **Karaokê sincronizado** (destacar a palavra sendo lida durante "Ouvir Tudo"): nem Kokoro nem Google TTS devolvem timestamp por palavra — só dá pra fazer isso de verdade com alinhamento forçado (forced alignment) ou trocando de motor de TTS. Uma aproximação por contagem de caracteres existe, mas é imprecisa o bastante pra ficar dessincronizada e parecer quebrada em vez de "quase certa". Prefiro não entregar uma versão que pareça bug.

## 🎨 ONDA 8 — UX/produto: jogos, quiz, conquistas, consistência visual (2026-07-12)
> Pedido do dono: "os jogos estão chatos, não inspirados no Duolingo"; "as perguntas das histórias só geram 3 e não escondem o texto"; "deixo na decisão da equipe o que for melhor... quero que veja a UX/design de tudo no Dashboard inspirado no Duolingo". Prioridades executadas conforme `docs/VISAO_PRODUTO_2026-07-12.md`.
- [x] [Prof. didático] **Quiz de história corrigido** (`storiesView.js`): `normalizeQuiz` travava em EXATAMENTE 3 perguntas (descartava o quiz inteiro se a IA variasse 1 a mais/menos) — agora aceita de 3 a 5. Pior ainda: o texto da história NUNCA era escondido durante o quiz (`story-content` ficava visível embaixo da caixa de perguntas) — dava pra rolar e colar a resposta. Agora o texto some por padrão ao abrir o quiz, com um botão consciente "👀 reler o texto" pra quem quiser desistir de tentar de memória.
- [x] [Diretor de Arte + Prof. didático] **Jogo redesenhado no estilo Duolingo** (`gameView.js`): a tela tinha uma paleta escura própria (`#1e1e2e`/`#89b4fa`, tipo terminal) completamente desconectada da identidade verde/branca do resto do app — agora usa as MESMAS variáveis de `globals.css`. Ganhou: combo visual (🔥 acertos em sequência), celebração com confete em CSS ao terminar, som de acerto/erro melhorado (arpejo de 2-3 notas em vez de bipe único), e um **3º minijogo — "Monte a Frase"** (reaproveita a mecânica de banco de palavras do exercício builder do Estudo, usando `words.context_sentence` que já existe — zero coluna/tabela nova).
- [x] [Gerente + Eng. SRS] **Sistema de conquistas/badges** (`dashboard/js/core/achievements.js`, novo): 12 marcos (streak 7/30/100, palavras salvas 50/100/500, palavras maduras 25/100/300, histórias 1/10/30), computados por função pura sobre dados que já existem (zero coluna nova). "Vistos" persiste em `settings` (chave `lf_achievements_seen`, JSON) — reaproveita o k/v genérico, sem migration. Nova seção "🏆 Conquistas" no Início, com toast de celebração na primeira vez que cada badge é desbloqueado. 4 testes novos (`tests/engine.test.mjs`).
- [x] [QA] **Auditoria de consistência visual**: `leaguesView.js` tinha a tela INTEIRA com cores hardcoded (`#3c3c3c`, `#777`, `#e5e5e5`, `#f9f9f9`...) em vez de `var(--color-*)` — isso não é só inconsistência estética, é um bug real de **dark mode**: texto cinza-escuro fixo sobre fundo escuro do tema dark vira ilegível. Corrigido: toda a tela agora usa as variáveis de tema (inclusive a cor de destaque top-3/ouro, que já tinha o mesmo valor de `--color-warning`). `libraryView.js` tinha 1 cor de hover hardcoded, corrigida também. Demais views auditadas (studyView/storiesView/settingsView) usam cor fixa só em botões/badges de ação (verde/laranja/vermelho sólidos com texto branco) — isso é padrão intencional (o próprio Duolingo mantém botões vívidos independente do tema), não um bug.
- [x] [QA] Suíte revalidada: 34/34 `engine.test.mjs` (4 novos), `release-smoke` verde.
- **Análise completa** (benchmark Duolingo/Anki/LingQ/Language Reactor, cada item com custo de implementação) em `docs/VISAO_PRODUTO_2026-07-12.md`. Itens de custo médio/alto que ficaram para depois (por decisão de escopo, não descartados): perfis de SRS por categoria, otimizador FSRS pessoal, karaokê sincronizado na leitura, modo de estudo customizado (leeches/categoria), gradiente de exposição de palavras (LingQ-style).

## 🟠 ONDA 7 — Performance do painel "Início" (2026-07-12)
> Pedido do dono: "Veja porque demora em carregar o painel... Veja se é algo no front ou no banco de dados." Resposta: **é no front**, não no banco — os índices estão corretos (advisors já revisados na Onda 5), o problema é o padrão de busca de dados da view.
- [x] [Eng. Backend] **Achado principal — buscas duplicadas sem cache**: `renderHome()` faz 2 levas de chamadas. A 1ª (`db.getStats()`) já busca e devolve 30 dias de `review_log` inteiro (`stats.reviewLog`). A 2ª leva pedia **os mesmos 30 dias de novo** (`db.getReviewLog(30)`) — 2ª ida à rede idêntica — e AINDA por cima pedia `db.getReviewLog(1)` (que é só um SUBCONJUNTO desses mesmos 30 dias) — uma 3ª busca 100% redundante. Isso acontecia TODA VEZ que a tela "Início" carregava, sem cache nenhum nesses dois casos. Corrigido: a 2ª leva agora reaproveita `stats.reviewLog` — zero rede extra.
- [x] [Eng. Backend] **`getAllSentences()` e `getAllKnownWords()` não tinham cache** (diferente de `getAllWords()`/`getAllCards()`, que já ganharam SWR na Onda 4) — buscavam a tabela INTEIRA sem limite em toda carga do Início/Leitor/Histórias. Como essas tabelas só crescem com o uso, o painel ficava mais lento à medida que a conta envelhecia — não é um problema de índice, é reprocessar tudo no navegador toda vez. Adicionado o mesmo cache SWR de 30s (`_sentencesCache`/`_knownWordsCache`), com invalidação correta em `saveSentence`/`deleteSentence`/`markAsKnown`.
- [x] [Eng. Backend] `dashboard.html`: adicionado `<link rel="preconnect">` pro Supabase e pro Google Fonts — a busca de dados e a fonte agora começam o handshake de DNS/TLS em paralelo com o parse do HTML, em vez de só depois.
- [x] [QA] Suíte completa revalidada (30/30 `engine.test.mjs`, `release-smoke` verde) — a lógica de `reviewsToday`/`retention30`/forecast/missões é matematicamente idêntica a antes (mesmo filtro, aplicado nos mesmos dados, só sem a rede duplicada).
- **Nada no banco precisou de correção** — os índices de `cards`/`review_log`/`words` já estavam corretos (confirmado nos advisors da Onda 5); o gargalo era 100% de padrão de busca no cliente.

## 🚀 PRODUÇÃO — PR #3 mergeado em `main` (2026-07-12, autorização explícita do dono: "pode mandar pra produção")
> Squash merge `63adfb0`. A partir daqui, `main` tem: motor FSRS/learning engine real, configs 100% reais, gamificação (ligas/missões/XP), histórias LingQ, nivelamento 3 fases, import de texto/EPUB, IA (mnemônicos + correção de redação), reengajamento por e-mail, auditoria de segurança (IDOR/SSRF corrigidos) e responsividade mobile. Itens que continuam sendo só do dono (não corrigíveis por mim): teste manual em celular real, Web Push ponta a ponta, "Leaked Password Protection" no Supabase (Dashboard/Management API only), rotação da chave DeepSeek, chave de provedor de e-mail para o reengajamento funcionar de verdade.

## 🎛️ QUADRO VIVO DA EQUIPE — 2026-07-11 (gerente: Fable)
> Regra da equipe: cada frente tem UM responsável sênior; toda decisão relevante é registrada aqui e no HANDOFF.md (é assim que os papéis "conversam" entre sessões e entre agentes — Fable, Codex e quem vier). Nada é marcado feito sem evidência (teste, query ou arquivo).

### Papéis
| Papel | Responsabilidade | Estado |
|---|---|---|
| 🧑‍💼 Gerente (Fable) | prioriza, integra branches, resolve conflito entre papéis, reporta ao dono | ativo |
| 🗣️ Linguista | diagnóstico pedagógico dos dados, personas de IA, metodologia CEFR | ativo |
| ⚙️ Eng. SRS | motor FSRS, fila de sessão, agendamento | ativo |
| 👨‍🏫 Professor didático | exercícios, histórias, ciclo conteúdo↔vocabulário | ativo |
| 🛡️ Eng. Backend/Segurança | Postgres, RPCs, RLS, Edge Functions, cron | ativo (muito coberto pelo Codex) |
| 🧪 QA | testes Node, release-smoke, validação efêmera de migrations | ativo |

### MOTOR PEDAGÓGICO (o "cérebro professor") — ✅ v1 ENTREGUE (2026-07-11)
- [x] **Marco 1 [Linguista]**: `db.getDiagnosisData()` agrega retenção por categoria/nível + palavras sofrendo/sólidas do review_log real; `generateWeeklyDiagnosis()` (persona de linguista SLA, JSON estruturado); painel expansível no Início com cache semanal + gate de 10 revisões (sem dados, sem invenção). Evidência: 2 testes Node com stubs.
- [x] **Marco 2 [Eng. SRS]**: `core/sessionQueue.js` (puro): learning primeiro, fracas espaçadas, novas espalhadas; card fraco força exercício de PRODUÇÃO (builder/ditado). Evidência: 3 testes Node incl. regressão do bug "16 Difícil sem graduar".
- [x] **Marco 3 [Prof. didático]**: `generateStoryWeb(genre, onChunk, userWords)` — história inclui 4-6 palavras do aluno (fracas + em progresso); badge "🔁 Reencontro" mostra as que entraram de verdade (regex no texto).
- [x] **Marco 4 [Linguista]**: entregue na Onda 1.2/1.3 (diagnóstico alimenta "🎯 Foco da semana" + `buildSessionQueue({priorityCategory})`) — checkbox estava desatualizado, corrigido aqui.

### 🗺️ ROADMAP-MESTRE PRIORIZADO — auditoria completa conferida item a item (2026-07-11)
> O gerente varreu os 22 problemas + 9 etapas + 10 sugestões + benchmark da auditoria e o CHECKLIST histórico. **Status provado (não declarado)**: dos 22 problemas da tabela-mestra, 20 estão fechados com evidência; abertos de verdade: #9 parcial (vídeo não dá XP) e #21 (consolidação site×extensão). Abaixo, TUDO que falta, em ondas de prioridade decididas pela equipe.

#### 🔴 ONDA 0 — Entregar o que está pronto (bloqueia todo o resto)
- [ ] [Dono] Teste manual do preview (roteiro no HANDOFF): Difícil gradua · diagnóstico do linguista · história com reencontro · quiz varia · hover · toggle 🔔
- [ ] [Gerente] **Merge do PR #3 na main** após o OK do dono → tudo vai pro site oficial
- [ ] [Dono+Backend] Push real: ativar o toggle e confirmar a notificação do dia seguinte (17:30 UTC)
- [ ] [Dono] Leaked Password Protection (Supabase → Auth → Settings) + rotacionar chave DeepSeek (Vault)
- [ ] [Dono] E-mail de reengajamento (Onda 3.4): criar conta grátis num provedor transacional (ex. resend.com), gerar API key e me passar pra eu guardar no Vault (`lf_resend_api_key`) e ativar o cron `email-weekly-reengagement` (hoje inativo por segurança)

#### 🟠 ONDA 1 — ✅ CONCLUÍDA (2026-07-11) — "tudo conversa entre si"
- [x] [Eng. SRS] **XP por assistir vídeo**: `logSession` detecta cada bloco de 5 min e chama `recordEvent('video_session')` (cap 30/dia no banco). Assistir vídeo agora dá XP E mantém a ofensiva.
- [x] [Linguista] Diagnóstico → **missões**: categoria com pior retenção (30d, <80%) vira a missão "🎯 Foco da semana" no Início (dados já carregados, sem custo de IA).
- [x] [Eng. SRS] Diagnóstico → **interleaving**: `buildSessionQueue(cards, {priorityCategory})` traz a categoria fraca à frente das revisões; studyView passa a fraqueza do `getDiagnosisData`. Testado.
- [x] [Prof. didático] Reencontro nas histórias na **extensão**: `generateStoryWithAI` computa `getReencounterWordsSW` e injeta no prompt (paridade com a web); retorna `requestedWords` pro badge.
- [x] [Prof. didático] **Missões semanais**: migration `weekly_quest` (RPC `claim_weekly_quest`, anti-farm 1x/semana pelo fuso) + painel "🗓️ Missão da Semana" (500 XP → +100 XP).

#### 🟡 ONDA 2 — ✅ CONCLUÍDA (2026-07-11) — Experiência de estudo completa (paridade Anki)
- [x] [Gerente+Eng. SRS] **Tela de Estatísticas** de verdade: `core/statsEngine.js` (puro, 5 funções: retenção/dia, tempo de estudo/dia, maturidade, forecast 14d, resumo) + `ui/statsView.js` (barras inline, sem lib externa) + rota `/stats` (nav, `vercel.json`, `app.js`). Dados 100% reais de `review_log`/`sessions`/`cards`. Evidência: 5 testes Node.
- [x] [Eng. SRS] **Estudo filtrado por tópico**: `app.navigate(route, params)` agora aceita parâmetros; botão "🧠 Revisar este tópico" no Cofre manda `{category}` pro Estudo; `renderStudy` filtra o pool ANTES da cota diária (mesmo orçamento global, só restrito à categoria); banner "Ver tudo" pra sair do filtro.
- [x] [Prof. didático] **Editor de card** no Cofre: `db.updateWord(id, patch)` (PATCH por id — nunca upsert por word/lang, então nunca duplica nem perde histórico FSRS do card); modal ✏️ edita tradução/frase/categoria/nível CEFR.
- [x] [Prof. didático] Mini-jogo **"Ouça e Escolha"** (listening): tela de Jogo virou menu (Ligar Colunas + Ouça e Escolha); toca a palavra (TTS canônico) e o aluno escolhe a tradução entre 4 opções; XP via `recordEvent('game_match', acertos)` — mesmo teto diário do jogo existente (sem brecha de farm trocando de modo).
- [x] [Eng. SRS] Player YouTube **instância única global** no estudo: `core/ytPlayer.js` — UMA `YT.Player` (API oficial) por sessão; trocar de card troca só o vídeo (`cueVideoById`), nunca recria o iframe; wrapper estável sobrevive à substituição de elemento que a própria API do YouTube faz; TTS continua canônico (sem autoplay do vídeo); degrada pro link externo se não for YouTube/não carregar.

#### 🟢 ONDA 3 — ✅ CONCLUÍDA (2026-07-11) — Conteúdo e alcance (benchmark LingQ/Readlang)
- [x] [Prof. didático] Leitor: **importar por URL** (via proxy p/ CORS) e epub. Edge Function `url-import` (auth+rate-limit 6/min, SSRF-safe: bloqueia localhost/RFC1918/link-local mesmo em redirect, teto 3MB HTML/60k chars texto, extração por heurística `<article>/<main>`) + `core/epub.js` (fflate via CDN só pra descompactar .epub, parsing de container.xml/OPF/spine com DOMParser nativo, tudo no navegador — nenhum arquivo sobe pra lugar nenhum).
- [x] [Linguista] Placement v3: banco de 5 cloze/4 listening por banda (era 3/2), corte proporcional (`clozePassThreshold`), **C2 alcançável** subindo a escada de cloze/listening (vocabulário para em C1 por falta de dados — Cambridge de verdade avalia C2 por gramática/leitura/escuta, não lista de palavras), **Fase 4 de mini-produção escrita** corrigida por IA (`gradeWriting` em `ai.js`, nudge de -1/0/+1 banda, nunca decide sozinha). 28 testes.
- [x] [Linguista] **Mnemônicos por IA** no card: botão "💡 Me dá um truque pra lembrar" no Estudo, `generateMnemonic` em `ai.js`, salvo em `words.mnemonic` (migration `word_mnemonic`) — não regenera à toa.
- [x] [Backend] Reengajamento por **e-mail** opcional: migration `email_reengagement` (opt-in, `get_email_candidates`/`get_email_secrets` SECURITY DEFINER restritas a service_role), Edge Function `email-reengagement` (Resend HTTP API, testada via pg_net: chave errada→401, certa→503 "provider not configured" — pipeline real, só falta a chave do provedor), toggle nas Configurações. Cron `email-weekly-reengagement` criado **INATIVO** (mesmo padrão do push) até o dono configurar `lf_resend_api_key`.
- [x] [Prof. didático] Frases de exemplo do **Tatoeba** como fonte extra: painel sob demanda no Estudo ("🔎 Ver exemplos de falantes reais"), `core/tatoeba.js`, degrada gracioso se a API falhar.

#### 🔵 ONDA 4 — Infra e polimento (em andamento, 2026-07-11)
- [x] [Gerente] Consolidação site×extensão — **já estava feita** (Bloco A, commit `bca3ad5`, confirmado de novo por investigação de código nesta sessão): `dashboard.html` não é carregado em nenhum contexto da extensão (fora de `manifest.json`, fora de `web_accessible_resources`), popup/newtab abrem o site Vercel. Não há HTML/login/service-worker duplicado — só ramos `isExtension` mortos (vestigiais, não é a pendência "rotas/código duplicado" da auditoria). Item da tabela-mestra estava desatualizado; corrigido aqui.
- [x] [Backend] Perf: **stale-while-revalidate** em `getAllWords`/`getAllCards` — cache fresco (<30s) serve na hora como antes; cache vencido agora serve o dado antigo IMEDIATAMENTE e revalida em segundo plano (deduplicado por `_wordsRefreshing`/`_cardsRefreshing`, sem N requests em paralelo), em vez de bloquear a tela esperando a rede de novo. `getWordsByCategory` ganhou paginação real (LIMIT/OFFSET no Postgres) via `{limit, offset}` — e um bug latente foi corrigido de graça: a versão antiga ignorava completamente o parâmetro `category` (nunca tinha chamador na UI, então nunca foi notado).
- [x] [Backend] **Indicador de progresso do download do Kokoro** (~90MB): `tts.js` agora passa `progress_callback` pro `from_pretrained` e emite `lf_kokoro_progress` (padrão de evento global já usado por `lf_read_error`/`lf_auth_expired`); Configurações mostra barra real (%, bytes agregados por arquivo do modelo) em vez do toast genérico "pode demorar". `preloadKokoro()` novo dispara o download na hora que o toggle liga, não só no primeiro áudio.
- [x] [QA] FASE 3 antiga: **3 fluxos com sessão expirada — já se recuperam sozinhos, verificado por inspeção de código**: Tradução (`utils/translator.js`) e Dicionário (`api.dictionaryapi.dev`, `service-worker.js:487`) usam APIs públicas sem token do Supabase — sessão expirada não afeta nenhuma das duas. IA (`ai.js`) e TTS premium (`tts.js`) passam por `db._getToken()` → `_refreshTokenIfNeeded()`: refresh proativo 5min antes de vencer (com mutex contra corrida), e se o refresh_token já morreu de vez, faz `logout()` + dispara `lf_auth_expired` (que `app.js` escuta e redireciona pro login) ANTES de qualquer chamada de IA/TTS falhar — nunca fica travado, sempre volta pro login sozinho. TTS ainda tem uma segunda rede de segurança: se `_getToken()` falhar, cai no fallback direto do Google TTS sem token nenhum.
- [ ] [Gerente] Ícones PWA 192/512 com arte original — **precisa do dono**: já existem ícones funcionais em todos os tamanhos (16/48/128/192/512, PNGs válidos, manifest correto), mas são um mascote de tucano genérico (provavelmente clipart de banco de imagens), não arte de marca original. Não tenho ferramenta de geração de imagem neste ambiente — preciso que você forneça uma logo/arte real (ou aprove manter o mascote atual).
- [ ] [QA+Dono] Inspeção visual mobile/a11y em celular real; validar virada de dia no fuso à meia-noite; observar limite do YouGlish — **precisa do dono**: exige um celular físico de verdade, não dá pra simular com confiança no meu ambiente.

#### 🟣 ONDA 5 — ✅ CONCLUÍDA (2026-07-12) — Nova auditoria completa (infra viva + revisão de código)
> Pedido do dono: "Faça uma nova auditoria com todos seniors em busca de erros, bugs, coisas não implantadas". Relatório completo em `docs/AUDITORIA_2026-07-12.md`. Toda correção em Supabase/GitHub foi autorizada explicitamente pelo dono.
- [x] [Backend] **IDOR crítico corrigido**: `get_user_stats(p_user_id)` era `SECURITY DEFINER` sem checar `auth.uid()=p_user_id` — qualquer usuário logado lia stats de qualquer outro. Função morta (zero chamadores), removida.
- [x] [Backend] Índice duplicado (`idx_cards_due`) removido; migrations recentes renomeadas pra bater com o histórico real do Supabase (evita reaplicação futura via CLI).
- [x] [Eng. Backend/Segurança] **SSRF crítico corrigido no `url-import`**: o filtro anti-SSRF nunca resolvia DNS, só olhava a string do hostname — um domínio próprio com registro A pra rede interna passava batido. Agora resolve `A`/`AAAA` via `Deno.resolveDns()` e valida os IPs antes de cada fetch/redirect. Deployado.
- [x] [Linguista] **2 bugs corrigidos no algoritmo de Placement v3**: `scoreClozeLadder` caía sempre pra A1 ao reprovar a primeira banda (agora cai só 1 abaixo de onde a escada começou); `listeningBands` duplicava a banda de ponta nos extremos da escala (agora sempre 3 bandas distintas). 2 testes de regressão novos.
- [x] [Eng. SRS] **Corrida de cache corrigida**: uma escrita (editar/suspender/excluir card) podia "sumir" por até 30s se corresse contra um refresh SWR em voo. Contador de geração (`_cacheGeneration`) agora invalida writes obsoletos.
- [x] [Eng. SRS] **Corrida no Undo corrigida**: apertar "Desfazer" (Z) logo após avaliar podia desfazer a nota do card ANTERIOR em vez da atual. Guard `gradeBusy` adicionado.
- [x] [Prof. didático] Vídeo de card anterior podia esconder o vídeo válido do card atual (guard de identidade de card adicionado); `AudioContext` dos mini-jogos agora é fechado ao terminar a partida.
- [x] [Gerente] PR #2 (obsoleta desde 04/07, superada pela #3) fechada com autorização do dono. Marca de conflito de merge (`<<<<<<< HEAD`) esquecida no topo deste arquivo desde uma sessão anterior, removida.
- [x] [QA] 30/30 testes `engine.test.mjs` (2 novos de regressão), 5/5 `local-day.test.mjs`, migrations replayadas do zero em banco efêmero, `release-smoke` verde.
- [ ] [Dono] Branches obsoletas (`master`, `codex/auditoria-completa`) identificadas mas não removidas — sem ferramenta de delete de branch disponível; avisar se quiser que eu remova via git direto.

#### 🟢 ONDA 6 — ✅ CONCLUÍDA (2026-07-12) — Responsividade mobile
> Pedido do dono: "A versão no celular precisa de diversos ajustes... Preciso de todos sênior das áreas envolvidas". Verificado com Chromium/Playwright em viewport de 320/375/390px (topbar renderizado manualmente pois fica oculto por trás do login sem sessão real — sem credenciais de teste neste ambiente, então as demais telas autenticadas foram corrigidas por inspeção estática de CSS/layout, não visualmente).
- [x] [Eng.Backend+Prof.didático] **Bug crítico de mobile corrigido**: `.topbar` (logo + 7 botões de navegação + tema + Sair + stats) nunca teve `@media` — em 375px de largura o conteúdo somava **1112px** e `overflow-x:hidden` no `body` cortava o excesso. Na prática, em qualquer celular só "Início" e um pedaço de "Histórias" apareciam; **Leitor, Ligas, O Cofre, Estatísticas, Config, alternar tema e até o botão Sair (logout) ficavam inacessíveis** — sem nenhuma forma de sair da conta pelo celular. Corrigido em `globals.css`: abaixo de 768px o topbar quebra em 2 linhas (logo+stats / nav) e a barra de nav vira uma faixa `overflow-x:auto` (todos os botões alcançáveis por swipe horizontal); abaixo de 420px o texto do logo some pra dar mais espaço.
- [x] [Prof. didático] Containers de conteúdo com `padding:40px` fixo (Leitor, Histórias, Configurações) trocados por `clamp(16px, 5vw, 40px)` — em 375px isso devolve ~2× mais largura útil de texto/formulário. `libraryView` (Cofre): `.word-card` (linha de palavra + ações) ganhou `flex-wrap`, título encolhido em mobile. `storiesView`: cabeçalho da história (título + 4 botões de ação) não quebrava linha e espremia o título contra os botões — corrigido com `flex-wrap`; fonte do corpo do texto reduzida abaixo de 480px pra melhor leitura. `readerView`: corpo do texto lido também reduzido/compactado abaixo de 480px. `homeView` (Início): paddings fixos trocados por `clamp()` — já tinha boa base responsiva de uma onda anterior (grid `auto-fit`, coluna única <768px), só refinado.
- [x] [QA] `studyView` (tela de estudo) e `statsView` (Estatísticas) já tinham `@media` bem construídos de ondas anteriores — confirmado por inspeção, sem regressão. Suíte completa revalidada: 30/30 `engine.test.mjs`, 5/5 `local-day.test.mjs`, `release-smoke` verde (exceto o aviso esperado de árvore suja pré-commit).
- [ ] [Dono] **Recomendo fortemente um teste manual em celular real antes de fechar este item de vez** — o ambiente de sandbox não tem sessão autenticada real, então as telas pós-login (Estudo, Jogo, Cofre com dados, Histórias geradas) foram corrigidas por leitura/raciocínio sobre o CSS, não visualmente renderizadas logado. O bug do topbar (o mais grave) foi confirmado visualmente com certeza.
- [x] [Gerente] **Ícone do app trocado pro pássaro inteiro**: os ícones (`icon16/32/48/128.png` na raiz da extensão e `dashboard/icons/icon16/48/128/192/512.png` do PWA) mostravam só a cabeça/bico do papagaio, cortada bem de perto — recuperei o círculo branco de fundo do design original (`git show HEAD:...`, confirmado por pixel: círculo sólido branco inscrito no canvas) e recompus com o pássaro INTEIRO (`icon_full.png`, corpo+pés+confete) centralizado dentro do círculo, mesma linguagem visual de antes. Todos os tamanhos regenerados com Pillow (LANCZOS), release-smoke confirma que a extensão MV3 e o manifest do PWA continuam válidos.
- [x] [Backend] **Revisão final dos advisors do Supabase antes de produção**: nenhum achado NOVO de segurança/performance ao alcance. Os WARNs de `SECURITY DEFINER` + `authenticated` (9 RPCs: `claim_weekly_quest`, `ensure_user_stats`, `get_push_public_key`, `maybe_league_rollover`, `record_card_review`, `record_learning_event`, `revert_card_review`, `set_email_opt_in`, `set_user_timezone`) são o padrão intencional de toda RPC client-facing do projeto — cada uma checa `auth.uid()` internamente (confirmado na Onda 5), não é um bug. `pg_net` em `public`: confirmado de novo que a extensão não é relocável (`ALTER EXTENSION ... SET SCHEMA` falha com `0A000`), sem ação segura possível. Os 6 índices "não usados" (INFO, não WARN) são recentes e servem consultas conhecidas (due date, user lookup) — não há sinal de que sejam lixo, só baixo tráfego ainda; não removidos. **"Leaked Password Protection" continua fora do meu alcance de verdade**: confirmei na documentação oficial que só é configurável pelo Dashboard (Auth → Settings) ou pela Management API com um Personal Access Token que eu não tenho acesso — nenhuma ferramenta MCP disponível aqui expõe isso, e o recurso exige plano Pro ou superior. Ativar isso continua sendo exclusivamente seu.

#### ✅ Fechado da tabela-mestra da auditoria (com evidência): #1-8, #10-20, #22
Fila learning/rótulos reais · settings→translation_cache · configs reais · limites diários · XP jogo/história/quiz/missões · ligas cron · streak unificada+fuso · card de história consertado · placement 3 fases · push · missões adaptativas+retorno · LingQ (%conhecido/status/quiz/reencontro) · RPC morta · advisors · índices · revisão atômica+undo íntegro · telemetria · onboarding real · XP localStorage removido · Difícil gradua.

> Nota de merge (Codex): a política de `Difícil` no learning ficou EXPLÍCITA e conservadora (repete o 1º passo uma vez, depois avança 1,5×; três "Difícil" graduam com [1,10]). Histórias com quiz e tooltip endurecidos (DOM seguro, XP 1x/história). CI roda as verificações da auditoria (`.github/workflows/release.yml`).

## Diagnóstico e planejamento
- [x] Revisão multi-especialista do estado atual do repositório (diff completo, 22 arquivos modificados + 8 untracked)
- [x] Confirmar causa raiz do bug de sessão (falta refresh de token) por grep no repo inteiro
- [x] Confirmar arquitetura real da IA contextual (BYOK direto, não via Edge Function) e decidir migração com o usuário
- [x] Confirmar com o usuário que remoção de decks é intencional (cards substituem decks)
- [x] Criar MASTER_BLUEPRINT.md / CHECKLIST.md / HANDOFF.md

## FASE 0 — Refresh de token (prioridade máxima)
- [x] Capturar `refresh_token` e calcular `expires_at` em `login()` (`utils/db.js`)
- [x] Capturar `refresh_token` e calcular `expires_at` em `signUp()` (`utils/db.js`)
- [x] Criar `_refreshTokenIfNeeded()` em `utils/db.js` (com mutex contra refresh duplo — Supabase rotaciona o refresh_token)
- [x] Chamar `_refreshTokenIfNeeded()` no início de `_getToken()` (cobre SW e web direto; proxy delega pro SW)
- [x] Tratar falha de refresh (refresh_token também expirado) como logout explícito + eventos `lf_auth_expired`/`AUTH_EXPIRED`
- [x] Falha de REDE no refresh não desloga (mantém sessão — offline não pode destruir login)
- [x] Testado em Node com mocks: 6 cenários (válida, concorrência 5x→1 refresh, legada, refresh morto→logout, offline→preserva, login salva formato novo)
- [ ] Teste manual no navegador: recarregar extensão, logar de novo (sessões antigas são legadas, sem refresh_token), editar `expires_at` no chrome.storage e confirmar refresh no Network — **PENDENTE: precisa do usuário**

## Bugs encontrados durante a Fase 0 (revisão da equipe)
- [x] `chrome.storage.local.set` não era aguardado no login — chamada logo após podia não ver o token (corrigido via `_saveSession` await)
- [x] Timeout do proxy (5s) ficaria apertado com refresh na frente da chamada (corrigido → 10s)
- [ ] `_fetch()` engole TODOS os erros no catch e retorna `null` — chamador não distingue "lista vazia" de "erro de rede/servidor". Views podem mostrar "nenhuma palavra" quando na verdade a chamada falhou. Corrigir na Fase 1 ou 2 (mudança de contrato, precisa cuidado)
- [ ] Condicionais mortas `config.provider !== 'gemini'` no service-worker (resíduo do cleanup.py) — remover na Fase 1
- [ ] `dashboard/newtab.js` usa `lfDb` — confirmar se newtab está declarado no manifest e funcional (visto de passagem, não inspecionado)
- [ ] **PWA sem ícone**: `manifest.webmanifest` aponta pra `../icons/icon128.png` e a pasta `icons/` não existe (nem `dashboard/icons/`) — corrigir na Fase 1
- [ ] **Rota `stories` ausente do `vercel.json`** — deep-link/refresh na view de histórias quebra na Vercel; adicionar à lista de rotas
- [ ] Relatório completo de melhorias criado: ver `MELHORIAS.md` (FSRS, Kokoro TTS, modo leitor, exercícios, PWA offline)

## FASE 1 — Limpeza (escopo expandido)
- [x] Remover `dashboard/js/core/db.js` (IndexedDB órfão — grep confirmou zero imports)
- [x] Remover `utils/sync.js`
- [x] Remover `utils/cloud-sync.js` (já quebrado — chamava `db.getAllDecks()` inexistente)
- [x] Remover seção `oauth2`/`drive.appdata` do `manifest.json` + permissão `identity` (também sem uso)
- [x] Remover `bulkUpdateDeck()` de `utils/db.js` e `deck_id: 1` de `content/web-reader.js`
- [x] Confirmar que views não referenciam mais decks (só sobraram comentários/CSS inertes)
- [x] Remover `background/service-worker.js_temp`, `cleanup.py`, `fix_enc_test.py`, `fix_mojibake.js`, `scratch/check.js`, `scratch/diff.txt`
- [x] Resolver `popup/popup.html` → `icon_full.png` (asset foi commitado no backup — resolvido)
- [x] Adicionar `dashboard/js/ui/storiesView.js` ao git (feito no commit de backup)
- [x] `dashboard/js/core/ai.js::explainGrammar()`: MANTIDO — é o padrão de referência pra migração da Fase 2 (único código que chama a Edge Function corretamente)
- [x] Remover condicionais mortas `config.provider !== 'gemini'` do service-worker (4 pontos)
- [x] **PWA**: criada `dashboard/icons/` (16/48/128 + 192/512 gerados por upscale), webmanifest corrigido (`start_url: "/"` — o antigo `./dashboard.html` dava 404 na Vercel; ícones 192+512 destravam o prompt de instalação do Chrome)
- [x] **Rota `stories`** adicionada aos 6 grupos de rewrite do `vercel.json`
- [ ] Teste manual pós-limpeza: extensão e dashboard funcionando (login, salvar palavra, IA contextual), sem erro novo no console — **PENDENTE: usuário**
- [ ] Substituir ícones 192/512 por arte original (os atuais são upscale do 128 — funcionais, mas suaves demais); `icon.png` da raiz tem header PNG corrompido, avaliar remoção

## Correções do feedback do usuário (2026-07-08, sessão 2 — commit f684169)
- [x] **CAUSA RAIZ do "sempre a mesma palavra" e dos dados fake**: saveWord falhava 100% com 400 (colunas inexistentes: ai_chunks/synonyms/antonyms/definition/snapshot) — só 1 palavra existia no banco. Migração aplicada (chunks→ai_chunks + 5 colunas novas incl. category) + saveWord corrigido (aceita chunks/ai_chunks, tags array/string, envia category)
- [x] Botão Sair: chamava `db.signOut()` inexistente → `this.logout()`
- [x] word-popup mostrava "Salvo!" sem checar `result.ok` → agora mostra erro real
- [x] Áudio robótico na web (Vercel): agora toca Google TTS via `<audio>` direto (sem CORS), robótico só como último fallback
- [x] Dark mode: backgrounds hardcoded (white/#f7f9fa) em studyView/library/leagues/stories → tokens do tema; "texto invisível" era título claro em sidebar branca fixa
- [x] Missões diárias: localStorage estático 0/50 → calculadas de xp_today (trigger real), review_log de hoje, palavras de hoje
- [x] CEFR sincronizado: extensão (cefrTargetLevel) ↔ dashboard/IA (lf_cefr_level) espelham nos dois sentidos
- [x] Backfill do Cofre: gravava em w.ai_chunks que o saveWord ignorava → agora aceito; contagem "sem contexto" era 100% fake (coluna não existia)
- [ ] Teste manual: salvar palavras novas num vídeo, estudar (fila deve variar), Sair, dark mode, missões subindo — **PENDENTE: usuário**
- [ ] Gamificação (XP/ligas/streak) é REAL no backend (trigger calculate_xp em review_log) — validar que XP sobe após revisões agora que reviews gravam

## FASE 2 — Migrar IA contextual para proxy seguro (commit a756403)
- [x] `supabase/functions/deepseek-chat/index.ts` v2: validação real de JWT (`supabase.auth.getUser`) — anon key pública agora leva 401
- [x] CORS restrito: `chrome-extension://*`, `*.vercel.app`, localhost — nunca `*`
- [x] Tabela `api_usage_log` + índice criados (migração `create_api_usage_log_rate_limit`, RLS sem policies — só service role)
- [x] Rate-limit 20 req/min por `user_id` na Edge Function (429 acima) + modelo fixo + teto max_tokens 2048
- [x] `getApiConfig()` no service worker migrado: sem `aiApiKey` → Edge Function com token de sessão; TODAS as funções de IA cobertas de uma vez (explicação, chunks, fonética, histórias, classificação, backfill)
- [x] BYOK mantido como override (chave própria → DeepSeek direto, não gasta cota compartilhada)
- [x] Testado: anon key → 401; origem estranha → Allow-Origin null; origem Vercel → ecoada
- [x] Chave DeepSeek configurada no **Vault** do Supabase; Edge Function v3 lê via RPC `get_deepseek_key` (SECURITY DEFINER, só service_role — anon/authenticated levam 403, testado)
- [x] **Teste E2E completo passou**: usuário real → Edge Function → resposta da IA via chave compartilhada, sem BYOK (usuários de teste removidos após)
- [ ] Teste manual na extensão: sem chave BYOK, clicar palavra → explicação da IA via Edge Function — **PENDENTE: usuário**
- [ ] Recomendação de segurança: a chave foi colada no chat — considerar rotacionar a chave DeepSeek depois e atualizar só o Vault (update em vault.secrets)

## Roadmap MELHORIAS.md — executado nesta sessão (commits 745ff18 + 26762d4)
- [x] **FSRS-4.5** no lugar do SM-2: `_calculateNextState` reescrita com o algoritmo do Anki moderno (stability/difficulty — colunas já existiam), retenção configurável (`lf_srs_retention`, default 0.9), learning steps mantidos, cards legados semeados sem quebrar. Testado: 7 cenários em Node (crescimento 12→43→129→375→929 dias)
- [x] **PWA offline real**: sw.js antigo pré-cacheava URLs 404 e a instalação abortava (nunca cacheou nada). Reescrito: app shell + stale-while-revalidate + navegação com fallback; Supabase nunca cacheado
- [x] **`_fetch` não engole mais erros de escrita**: POST/PATCH/DELETE relançam (como o saveWord 400 passou despercebido); GETs seguem null
- [x] **TTS com cache IndexedDB + download de MP3** (sessão paralela, integrado): mesmo áudio nunca baixado 2x; estudo offline de áudios já ouvidos; `downloadAudio()` exportado
- [x] **Edge Function `tts` deployada** (v1): proxy autenticado do Google TTS — JWT real, rate-limit 60/min, texto ≤300 chars, CORS restrito; anon key → 401 (testado)
- [x] `ai.js` reescrito como cliente unificado (extensão → SW `ai_chat` com BYOK; web → Edge Function); tutor de gramática do dashboard reativado
- [x] `dashboard/newtab.js` confirmado: declarado no manifest (chrome_url_overrides) — não é código morto

## Cards v2 — estudo funcional de verdade (commit 1f5bba6, 2026-07-09)
- [x] **Bug do vazamento**: fonética abrasileirada aparecia ANTES da revelação e vinha de outra frase (`chunks[0]`) — agora só aparece após revelar e é da frase exata do card
- [x] Fonética + tradução da frase e da palavra geradas em 1 chamada de IA (`enrichCard`) e persistidas em `ai_chunks` (entradas `is_context`/`is_word`) — nunca regeradas
- [x] **Tutor de gramática em chat**: persona didática (professor brasileiro poliglota), adaptada ao `lf_cefr_level`, multi-turno com histórico; funciona na web (Edge Function direto) e na extensão (`ai_chat` no SW, respeita BYOK)
- [x] Chunks com botão 🔊 (cache IndexedDB) e ⬇️ salvar MP3; frase do card como primeiro chunk rotulado
- [x] **YouGlish embutido** na sidebar (widget oficial, só na web — na extensão MV3 o CSP proíbe script remoto → link externo)
- [x] Botão "✨ Frase estranha? Gerar melhor com IA" para contextos capturados quebrados (fragmentos de legenda)
- [x] Geração de chunks agora funciona na web também (`generateChunksWeb`)
- [x] Tradução da palavra isolada corrigida (mostrava a tradução da frase do chunk)
- [ ] Teste manual: estudar cards no site e na extensão — fluxo cloze → revelar → chat do tutor → salvar áudio — **PENDENTE: usuário**
- [ ] YouGlish widget: validar limite diário do modo anônimo; se estourar, avaliar API key gratuita do YouGlish

## Roadmap MELHORIAS.md — executado (commit aeaec0b, 2026-07-09)
- [x] **Slider de retenção FSRS** nas Configurações: o controle existia no HTML mas era morto (não lia nem salvava) — agora lê/grava `lf_srs_retention`, label ao vivo, faixa 80-97%
- [x] **Undo na revisão (Ctrl+Z do Anki)**: `logReview` retorna `prevCard` (snapshot); `undoReview` restaura o card e apaga o último `review_log`; botão "Desfazer última (Z)" + tecla Z no studyView; reverte progresso da sessão e recoloca o card na fila. Testado em Node (estado idêntico ao original, log removido)

## Roadmap MELHORIAS.md — pendente (próximas sessões)
- [ ] Kokoro-82M TTS local (WebGPU/WASM) como voz neural premium offline
- [ ] Exercícios variados no studyView (cloze, montar frase, ditado — dados já existem em ai_chunks)
- [ ] Modo Leitor estilo LingQ (evolução do storiesView: importar texto/URL, palavras clicáveis coloridas)
- [ ] Contador de palavras conhecidas + lemmatização (compromise)
- [ ] Cartões reversos (PT→EN), estatísticas de retenção reais, streak freeze

## PLANO-MESTRE FABLE 5 (2026-07-09) — ver `PLANO_MESTRE_FABLE5.md`
Decisões ratificadas: dashboard SÓ no site; extensão = captura + revisão rápida; login próprio no popup. Roadmap priorizado:
### Bloco A — Consolidação (destrava tudo) — CONCLUÍDO (commit bca3ad5)
- [x] A1. Histórias no site: `generateStoryWeb` em ai.js (Edge Function, mesmo prompt do SW) + `translateText` roteado (extensão→SW; web→translator.js client-side, CORS do GTX/MyMemory verificado com curl). Testado em Node
- [x] A2. Login próprio no popup: form email/senha (via proxy→SW), estados carregando/deslogado/logado, chip de e-mail, cards devidos, logout, "Criar conta" abre o site
- [x] A3. Site-only: popup/settings-panel/newtab abrem `linguaflow-web-tau.vercel.app`; `dashboard/*` removido dos web_accessible_resources (grep de getURL confirmou zero uso por content scripts)
### Bloco B — Paridade Anki
- [x] B1. Export Anki .txt (TSV `#separator:tab`/`#html:true`/`#tags column:3`, frente com frase e palavra destacada, verso com tradução+fonética+definição) + backup JSON completo (words/cards/review_log/stats) + restauração (upsert palavras, re-casamento de cards por palavra|idioma). CSV corrigido (campo `context` inexistente → `context_sentence`) — commit dc289a6
- [x] B2. Suspender/reativar no Cofre (⏸️/▶️ + badge, studyView filtra suspensos), enterrar ("Deixar pra amanhã"), cartões reversos 🇧🇷→🇺🇸 opt-in (setting lf_reverse_cards, só cards graduados, áudio só ao revelar), painel de memória no Início (retenção 30d real + carga amanhã/7 dias). Bugs corrigidos de passagem: exclusão no Cofre usava parseInt(uuid) e nunca funcionou; "Gerar Agora" na web agora usa generateChunksWeb — commit 6e47341
### Bloco C — LingQ — CONCLUÍDO (commit 37311e1)
- [x] C1. Modo Leitor (`readerView.js`, rota /reader): colar texto, palavras coloridas por status (azul nova / amarelo aprendendo / sem cor conhecida), popup com tradução+áudio+salvar card+marcar conhecida (`known_words` finalmente em uso — RLS e constraint verificadas), biblioteca em localStorage, % de famílias conhecidas por texto
- [x] C2. Lematizador de regras próprio (`utils/lemma.js`, zero deps, 18 casos testados; interface pronta pra trocar por compromise) + contador de "Palavras conhecidas" (famílias) no painel de memória do Início
- [ ] C-futuro: importar por URL (CORS exige proxy), epub, e importar textos capturados pelo web-reader da extensão
### Bloco D — Duolingo + avaliação oficial
- [x] D1. Exercícios variados no estudo (commit 57c965d): 🧩 montar frase (word bank) + 🎧 ditado (escute e escreva) + 🇧🇷→🇺🇸 reverso no mesmo sorteio; só cards graduados; acerto=Bom(3)/erro=Errei(1) alimentando o FSRS; áudio nunca vaza resposta; toggle lf_varied_exercises (ON por padrão)
- [x] D2. Teste de nivelamento CEFR (commit e186cee): 36 palavras por faixa + 6 pseudo-palavras anti-chute (honestidade desconta o score), modal nas Configurações, resultado aplica lf_cefr_level+cefrTargetLevel no sistema inteiro. Achado: cefr-wordlist só tem A1-B2 — C1 estimado via palavras raras (rank≥8500); C2 não é estimável com os dados atuais
- [x] D3 (parcial, commit e0bab0e): **streak freeze** (coluna streak_freezes + trigger perdoa 1 dia pulado; +1 freeze a cada 7 dias, máx 2; 🧊 no Início) + **notificações de revisão** (chrome.notifications, 1/20h, clique abre o site; permissão no manifest)
- [ ] D3-restante: mini-jogos novos (ditado relâmpago, ouça-e-escolha) — gameView tem só "Ligar Colunas"
- [ ] D2-futuro: teste com verificação ativa (múltipla escolha de tradução) e avaliação de listening/gramática pra rigor Cambridge de verdade
### HOTFIX pós-feedback do usuário (commit 3a61e4f, 2026-07-10)
- [x] Demora ao avaliar: getSRSSettings 11 requests→1 em lote+cache 60s; grade otimista (próximo card na hora, gravação em background)
- [x] Tela final não finalizava: escrevia no body via #app-view inexistente → container real da view
- [x] YouGlish: topo da sidebar, lazy (só no clique — sem autoplay), pausado ao trocar de card
- [x] Salvar no popup: imediato — chunks via backfill em background (não espera mais a IA)
- [x] Ligas: bots fantasmas removidos — só usuários reais
- [x] Histórias: histórico funcionava só na extensão (chrome.storage) → localStorage na web; nível cacheado pra sempre → TTL 30s
- [x] Missões: pool de 7 sorteadas por dia (1 XP + 1 revisão + 1 palavras novas)
- [x] Leitor: onboarding em 3 passos + texto de exemplo com 1 clique
- [x] **RODADA SÊNIOR (commit 303e0bc)**: loadNextCard não-bloqueante; cache 30s words/cards (site fluido); tutor sob demanda (zero IA sem pergunta, 140 chars, 320 tokens, persona fluência, colapsado); tabela `stories` no banco (histórico sincronizado, história nunca se perde); mojibake das Histórias corrigido; banner ofensiva em risco
- [x] **STREAMING da IA (commit 3e81581)**: Edge Function v4 repassa SSE do DeepSeek (deployada, E2E testado); aiChatStream com parser incremental (linha quebrada entre chunks testada); tutor de gramática e histórias mostram o texto AO VIVO. Espera percebida ~8s → ~1s
- [ ] Gargalos restantes mapeados: getWordsByCategory carrega words+cards inteiros; heatmap refaz getStats; sem cache HTTP nos GETs REST (candidato: stale-while-revalidate no db)

### Bloco E — Qualidade
- [x] E1 (commit 694f131). Kokoro-82M opt-in no site: lazy via CDN, WebGPU/WASM, vozes US/GB pelo sotaque, entra antes do Google TTS só pra inglês com fallback total, cache IndexedDB com motor na chave, toggle nas Configurações com aviso do download (~90MB, 1x)
- [ ] E1-melhoria: indicador de progresso do download do modelo na 1ª geração
- [x] E2 (commit e0bab0e). Limpeza: `utils/fsrs.js` removido (FSRS duplicado morto), `icon.png` corrompido removido, tabela `decks` + `words.deck_id` DROPados (migração); grade 1/3 do newtab conferida — 1=Errei/3=Bom são valores válidos do FSRS, sem bug
- [ ] E2-restante: ícones PWA 192/512 com arte original (hoje upscale do 128)
- [ ] E3. Onboarding + Tatoeba + acessibilidade

## FASE 3 — Confirmação final dos 3 fluxos
- [ ] Tradução de legenda funciona com sessão expirada
- [ ] Dicionário de palavra clicada funciona com sessão expirada
- [ ] IA contextual se recupera sozinha via refresh automático (Fase 0) + Edge Function (Fase 2), sem erro visível
- [ ] Fallback BYOK continua funcionando para quem configurou chave própria

## P0.2b — preparação Codex (2026-07-15)

- [x] Remover `updateCard()` e bloquear caller legado no proxy.
- [x] Alinhar manifest da extensão em `3.0.3`.
- [x] Corrigir confirmação enganosa da restauração de backup.
- [x] Preservar `review_log`: exclusão segura recusa palavra já revisada.
- [x] Restringir restore a card virgem, auditá-lo e impedir revisão imediata.
- [x] Fazer a migration abortar se policies remotas mudarem após o preflight.
- [x] Adicionar teste SQL comportamental das ACLs/RPCs P0.2b.
- [x] Publicar código/manifest `3.0.3` no GitHub e Vercel (`e357c7b`).
- [x] Recarregar a extensão `3.0.3` no Chrome do usuário.
- [x] Smoke real: criar, revisar, enterrar, suspender/reativar e restaurar backup.
- [ ] Executar replay SQL P0.2b em Postgres descartável.
- [x] Aplicar P0.2b no Supabase e conferir grants, policies, ACLs das RPCs, constraints, advisors e logs.
- [x] Executar smoke transacional remoto com `ROLLBACK`: escrita direta bloqueada; create/review/bury/suspend/restore/backup/delete seguro aprovados, sem resíduos de fixture.
- [x] Corrigir validação numérica do restore em migration append-only `restore_card_state_numeric_types_p0_2b`; `null` e string nos três campos FSRS são rejeitados sem mutação/evento.
- [ ] Observar 403/5xx e falhas de RPC por 24 h de uso real após o cutover.

## 🔍 Auditoria real de código — plano de execução (Claude, 2026-07-17)

> Documento canônico: [`docs/AUDITORIA_REAL_2026-07-16.md`](docs/AUDITORIA_REAL_2026-07-16.md) (80% do código lido, reconciliado contra `origin/main` na §4o). PR aberto: `docs/code-audit-2026-07-16` → `main`. Todo item abaixo tem arquivo:linha na auditoria — buscar pela seção citada entre parênteses antes de mexer.

### Fase 0 — Git (fazer primeiro, é só documentação)

- [ ] Abrir o PR `docs/code-audit-2026-07-16` → `main` (link: github.com/cascaoconcurseiro/linguaflow/pull/new/docs/code-audit-2026-07-16).
- [ ] Revisar e mergear — zero mudança de código de produto, só docs + script de auditoria.

### Fase 1 — Correções de 1 linha, alta confiança, sem decisão de produto envolvida

- [ ] `content/review-overlay.js:126` — adicionar `preventDefault()`/`stopPropagation()` nas teclas `1`-`4`, que hoje pulam o vídeo do YouTube para 10/20/30/40% em vez de avaliar o card (§4e.2). **O mais provável culpado de a feature parecer quebrada.**
- [ ] `dashboard/js/ui/storiesView.js:989` — trocar `âœ…` por `✅` no toast de salvar palavra (mojibake ativo, confirmado em `main`) (§4l.4).
- [ ] `content/subtitle-engine.js` — separar o listener de teclado `C`/`O` entre `_setupKeyboardShortcuts()` e `_injectYouTubeControls()`; hoje disparam 2× no YouTube (§4d.4).
- [ ] `dashboard/js/ui/studyView.js:377` — comentário diz "Ctrl+Z / tecla Z", código só testa `KeyZ`; ajustar o comentário (o código está certo) (§4g.9).
- [ ] `content/settings-panel.js` (lista de atalhos, seção "Atalhos do Teclado") — adicionar `C` e `Espaço`, que faltam na única lista de atalhos que o app mostra ao usuário (§4j.3).
- [ ] `utils/db.js` — `isNew` sempre `false` em `saveWord`/`getCardByWordId`: a variável `card` sempre existe depois do `if`, então `!card` nunca é `true`. Corrigir a lógica (§3.4).

### Fase 2 — Correções reais, precisam de teste manual antes de subir

- [ ] `content/word-popup.js` (`_convertIPAtoPT`) — o mapa de fonética aplica substituições em cascata na mesma string (`ɪ→i` depois `i→í`), destruindo o par ship/sheep. Trocar por regex alternado com callback, uma única passada (§3.1).
- [ ] `content/word-popup.js` (`_truncateContext`) — frase salva pode vir picotada com `"..."`. Decidir: salvar a frase completa, ou marcar visivelmente como truncada no card (§3.2). **Isto também destrava dois bugs derivados sem precisar tocar neles**: §4j.5 (o guard `hasGoodVideoContext`, duplicado em `service-worker.js` e `libraryView.js`, é enganado por frases truncadas) e §4k.5 (o editor do Cofre existe mas nada avisa que a frase está quebrada).
- [ ] `content/word-popup.js` (`_showSaveToast`/estado do botão) — "já salvo" reseta em 2s e um segundo clique sobrescreve `context_sentence`/`video_url`/bounds da captura original. Adicionar guarda contra re-save silencioso (§3.3).
- [ ] `content/subtitle-engine.js` (`_injectSubtitleUI` chamada 2× no boot) — arrastar a legenda nunca funciona no YouTube/Max porque os listeners de drag ficam presos no host destruído na primeira chamada. Consolidar numa única injeção (§4d.5).
- [ ] `content/subtitle-engine.js` (`_createSubtitlePanel` vs `_loadSavedWords`) — abrir o painel lateral (`L`) reconstrói `savedWords` só a partir de `cards.status`, apagando palavras salvas sem card e pintando-as como "nunca vistas" na legenda ao vivo. Unificar a fonte do mapa (§4d.3).
- [ ] `content/subtitle-engine.js` (`_loadSettings`) — reescreve `translationAnticipation`/`subtitleMode` no banco do usuário sempre que a página carrega, se detectar valores legados. Confirmar se ainda existe caminho para o usuário escolher esses valores hoje; se não, remover a migração forçada (§4d.7).
- [ ] `content/subtitle-engine.js` (`_cleanSubtitleText`) — não decodifica entidades HTML (`&#39;` etc.), só `&nbsp;`. A legenda na tela já tem esse conserto em `_makeClickable`, mas ele não alimenta o texto salvo no card. Mover/centralizar a decodificação para antes de `context_sentence` ser gravado (§4j.1, §4l.2).

### Fase 3 — O achado principal: religar o shadowing

- [ ] `dashboard/js/ui/studyView.js` + `utils/pronunciation.js` — o overlay "Sua vez... Fale em voz alta!" só conta 3 segundos; `pronunciationLab` (com `SpeechRecognition`/`getUserMedia` prontos) tem **zero importadores** em todo o projeto. Importar e conectar: capturar a fala do aluno, comparar com a palavra/frase, dar feedback. É a peça que fecha a W4 (shadowing) inteira — as outras 3 partes já existem e funcionam (§4g.1, §4g.2).

### Fase 4 — Decisões de produto (perguntar ao Wesley antes de codificar)

- [ ] **Paleta de cores para daltônicos** — implementada em `settingsView`/`settings-panel`, escondida com `display:none` no HTML. Reativar o seletor, ou remover a lógica morta? (§4j.2 — achado de acessibilidade, prioridade alta para decidir mesmo que a implementação espere.)
- [ ] **`blurSubtitles`** — configuração lida/aplicada mas sem `<select>` no painel (`#sel-blur` não existe). Restaurar o controle, ou remover a configuração órfã? (§4j.4)
- [ ] **`lf_auto_backup`** — o service worker grava um backup silencioso que nunca é lido em lugar nenhum, redundante com o backup real e funcional em Configurações → Dados (`btn-backup-json`). Remover a escrita morta? (§4j.7)
- [ ] **`utils/tts.js` (`_playWebSpeech`)** — 118 linhas mortas (fallback de voz desligado com `return false` no topo). Apagar, ou religar como último recurso — igual ao que `dashboard/js/core/tts.js` (site) já faz — para fechar a assimetria de confiabilidade entre extensão e site? (§4p.2)
- [ ] **`#app-view`** — `renderSessionComplete` e `renderWaitingScreen` em `studyView.js` caem para um elemento `#app-view` que **não existe em lugar nenhum do HTML**. Criar o elemento (fallback real), ou remover o fallback morto e garantir que `studyContainer` nunca seja nulo nesses pontos? (§4g.8, confirmado ainda vivo em `main` na §4o.4)
- [ ] **CEFR sincroniza só num sentido** — mudar o nível na tela de Configurações do site grava só `lf_cefr_level`; o painel da extensão grava as duas chaves (`lf_cefr_level` + `cefrTargetLevel`). Replicar a escrita dupla no site (§4b.8).

### Fase 5 — Limpeza de código morto (segura, baixo risco, sem decisão de produto)

- [ ] Apagar `content/engine/subtitle-fetcher.js` e `content/engine/video-adapter.js` — confirmados órfãos pela varredura de fiação, zero importadores em `main`. **Atenção:** o `HANDOFF.md` do Codex (15/07) afirma que esses arquivos foram preservados de propósito — avisar antes de apagar (§4h.1, §4h.2).
- [ ] Apagar `utils/subtitle-parsers.js` — mesmo caso, órfão confirmado (§4h.1).
- [ ] `content/subtitle-engine.js` — remover os stubs vazios `_injectDeckSelector()`, `_injectFloatingButton()`, `_injectNavigationControls()`, `_createNavButton()`, e as referências a `#lf-deck-host`, `#lf-btn-loop`, `#lf-save-btn`, `#lf-hbo-switch`, `#lf-float-btn`, `#lf-float-panel-btn`, `#lf-nav-controls` no `destroy()` (§4b.6, §4h.3).
- [ ] `content/subtitle-engine.js` — remover `_renderVideoWordPrep()` (80 linhas, container `#lf-video-words` nunca existe) e as ~160 linhas mortas dentro de `_processYtSub` (`decodeHtml`, `detectLang`, os objetos `D`/`l`) (§4d.10, §4d.11).
- [ ] `dashboard/js/ui/storiesView.js` — remover o handler órfão de `#lf-reveal-context`/`#lf-context-trans` (versão antiga de uma feature já substituída) (§4l.5).
- [ ] `background/service-worker.js:163,166` — `createDeck`/`deleteDeck` listados em `writeMethods`, mas os decks foram removidos do `db`. Limpar a lista (§4b.6).

### Fase 6 — Terminar a leitura (menor prioridade — o padrão da sessão foi achado forte por arquivo até aqui, mas os que sobram são infraestrutura de borda, não superfície de produto)

- [ ] Reconferir contra `main` em detalhe: `app.js`, `gameView.js`, `homeView.js`, `readerView.js` (mudaram no rollout P0.3, não foram reabertos linha a linha — §4o.5).
- [ ] Ler pela primeira vez: `utils/translator.js` (170), `dashboard/js/core/ytPlayer.js` (252), `content/max-player-ui.js` (229), `dashboard/js/core/epub.js` (104), `popup/popup.js` (112), `content/youtube-hook.js` (111), `dashboard/sw.js` (123), `supabase/functions/url-import` (304), `supabase/functions/tts` (107), demais Edge Functions (`push-reminder`, `email-reengagement`).
- [ ] Ler `content/engine/subtitle-fetcher.js`/`video-adapter.js` e `utils/subtitle-parsers.js` só se a Fase 5 decidir manter em vez de apagar — senão, dispensar.
