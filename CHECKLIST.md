# Checklist — LinguaFlow

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
