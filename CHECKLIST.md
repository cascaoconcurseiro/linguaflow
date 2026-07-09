# Checklist — LinguaFlow

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
- [ ] D1. Exercícios variados (cloze/montar frase/ditado usando ai_chunks)
- [ ] D2. Avaliação oficial CEFR/Cambridge + placement test (usar cefr-wordlist.json + frequency-en.json)
- [ ] D3. Mais mini-jogos + streak freeze + notificações de revisão
### Bloco E — Qualidade
- [ ] E1. Cadeia TTS Kokoro-82M (voz neural offline)
- [ ] E2. Limpeza: remover `utils/fsrs.js` (morto), tabela `decks` (migração), corrigir grade do newtab, ícones PWA originais, remover `icon.png` corrompido
- [ ] E3. Onboarding + Tatoeba + acessibilidade

## FASE 3 — Confirmação final dos 3 fluxos
- [ ] Tradução de legenda funciona com sessão expirada
- [ ] Dicionário de palavra clicada funciona com sessão expirada
- [ ] IA contextual se recupera sozinha via refresh automático (Fase 0) + Edge Function (Fase 2), sem erro visível
- [ ] Fallback BYOK continua funcionando para quem configurou chave própria
