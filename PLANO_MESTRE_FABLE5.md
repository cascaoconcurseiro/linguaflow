# PLANO-MESTRE LinguaFlow — Guia de Execução para o Fable 5

> Este documento é a fonte de verdade estratégica do projeto. Foi escrito depois de uma auditoria linha-a-linha do código real (não suposição) em 2026-07-09. Leia-o INTEIRO antes de tocar em qualquer arquivo. Ele explica o que o sistema é, como funciona hoje, o que está errado, o que falta, e a ordem exata de execução. Ao final de cada etapa: pare, teste o critério de aceite, atualize `CHECKLIST.md` e `HANDOFF.md`, e faça commit + push pra `main` (e `master`).

---

## 0. Como o Fable 5 deve trabalhar neste projeto

1. **Sempre leia primeiro** `HANDOFF.md`, `MASTER_BLUEPRINT.md` e este arquivo. Não re-explore o que já está documentado.
2. **Não invente APIs, colunas ou assinaturas.** Se não tiver certeza da estrutura de uma tabela ou de uma função, rode uma query no Supabase (via MCP) ou leia o arquivo real. O projeto já foi queimado por código que enviava colunas inexistentes (bug do `saveWord` 400 que fazia TODO salvamento falhar em silêncio).
3. **Não reescreva o que funciona.** O módulo `utils/db.js` (proxy `isProxyMode` + `_fetch` + refresh de token) é sólido. O motor de legenda `content/subtitle-engine.js` (4.182 linhas) é o mais maduro do projeto — mexa com cirurgia, não com marreta.
4. **Escritas nunca podem falhar em silêncio.** `_fetch` já relança erros de POST/PATCH/DELETE. Mantenha esse contrato: se uma escrita falha, o usuário tem que saber.
5. **Nenhuma chave secreta no cliente.** Chave DeepSeek vive no Vault do Supabase, lida só pela Edge Function (RPC `get_deepseek_key`, restrita a `service_role`). `SUPABASE_ANON_KEY` no cliente é normal (design do Supabase).
6. **Sessões paralelas:** o dono (Wesley) roda mais de uma sessão de IA ao mesmo tempo. SEMPRE rode `git status` e `git log --oneline -5` antes de commitar, e commite só os arquivos que VOCÊ mexeu.
7. **Commits:** mensagem em português, explicando o PORQUÊ. Rodar `node --check` nos arquivos JS editados antes de commitar. Terminar a mensagem com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
8. **Teste de verdade.** Toda lógica não-trivial (agendamento, auth, cálculo) deve ter um teste em Node com mocks antes do commit — foi assim que validamos o FSRS e o refresh de token.

---

## 1. O que é o LinguaFlow (visão)

Um sistema para quem quer **fluência de verdade** em idiomas, treinando com **conteúdo real** (YouTube, HBO Max, Netflix, Prime, Disney+) — listening real, frases reais, não frases de laboratório. A régua de qualidade é a de **poliglotas**: didática correta, avaliação alinhada a padrões **oficiais (CEFR / Cambridge)**, nada de "gamezinho" solto sem lastro linguístico.

**É a fusão de 4 produtos:**
- **Language Reactor** → legenda dupla nos vídeos + clicar palavra pra dicionário/IA (JÁ É o mais maduro — content scripts).
- **Anki** → repetição espaçada séria (FSRS-4.5 já implementado), undo, e precisa de **export/import Anki** e todas as opções de deck do Anki.
- **Duolingo** → hábito: XP, ligas, streak, missões diárias, mini-jogos.
- **LingQ** → input compreensível: modo leitor de textos com palavras clicáveis coloridas por status (novo/aprendendo/conhecido), contador de "palavras conhecidas".

**Tudo tem que conversar entre si.** Uma palavra salva no vídeo vira card (Anki), conta como "vista" (LingQ), dá XP (Duolingo) e aparece nas Histórias e no Cofre. Uma só fonte de verdade: o Postgres do Supabase.

---

## 2. Arquitetura DECIDIDA (ratificada pelo dono em 2026-07-09)

### 2.1. Dashboard = SÓ NO SITE
- **Site oficial:** `https://linguaflow-web-tau.vercel.app/` — deploya automaticamente a partir da branch `main` do GitHub (`github.com/cascaoconcurseiro/linguaflow`). **Todo push pra `main` atualiza o site.**
- O dashboard pesado (Início, Estudo, Cofre, Histórias, Ligas, Config) deve viver **apenas no site**. Hoje ele é servido em DOIS contextos (página `chrome-extension://` E site Vercel), o que dobra o teste e causa bugs de divergência (CSP diferente, `chrome.runtime` que só existe na extensão, etc). **Consolidar em um só: o site.**
- **A extensão fica com o que é a razão dela existir** (modelo Language Reactor): capturar (legenda + clicar palavra + salvar card) e revisão rápida em contexto. Nada de dashboard embutido.

### 2.2. Login da extensão = próprio, no popup
- **Fato crítico confirmado:** a sessão NÃO é compartilhada entre site e extensão. `_saveSession` grava em `chrome.storage.local` (extensão) e `localStorage` (site) — mas como são origens diferentes, logar num não loga no outro. Mesma conta Supabase, **duas sessões independentes**.
- Por isso, a extensão precisa de **login próprio no popup** (mini form email/senha). Uma vez logado, a sessão (com refresh token da Fase 0) fica em `chrome.storage.local` e **renova sozinha pra sempre** — o usuário só sai no logout explícito.
- O botão "Dashboard" do popup abre o **site** (`https://linguaflow-web-tau.vercel.app/`), não a página da extensão.

### 2.3. Fluxo da IA DeepSeek no popup de palavra
1. Usuário clica palavra no vídeo → `content/word-popup.js` manda `ai_explain_word` pro Service Worker.
2. `getApiConfig()` no SW decide:
   - **Com chave própria (BYOK, `chrome.storage.local.aiApiKey`)** → chama `api.deepseek.com` direto (não gasta a cota compartilhada).
   - **Sem chave** → chama a Edge Function `deepseek-chat` com o **token de sessão da extensão**.
3. A Edge Function valida o usuário (JWT real), aplica rate-limit (20/min), pega a chave do Vault, responde. **Chave nunca exposta.**
- **Requisito:** pro modo compartilhado funcionar, o usuário PRECISA estar logado na extensão (ver 2.2). Legenda e dicionário NÃO dependem disso (são client-side sem token) — continuam funcionando deslogado.

---

## 3. Como o sistema funciona HOJE (mapa técnico real)

### 3.1. Superfícies da extensão
| Arquivo | Papel |
|---|---|
| `content/subtitle-engine.js` (4.182 l.) | Motor de legenda dupla — captura, traduz inline, colore por CEFR, injeta UI no player. O código mais complexo e maduro. |
| `content/word-popup.js` (2.060 l.) | Popup ao clicar palavra: dicionário + IA contextual + salvar card (com snapshot do vídeo, chunks, fonética). |
| `content/settings-panel.js` (904 l.) | Painel de config in-page (legenda, cores, CEFR, TTS). |
| `content/web-reader.js` | Leitura de qualquer site (`<all_urls>`) — embrião de modo leitor. |
| `content/boot.js`, `injector.js`, `youtube-hook.js`, `hbo-inject.js`, `review-overlay.js` | Bootstrap e hooks por plataforma. |
| `background/service-worker.js` (1.242 l.) | Hub central: proxy de DB (`DB_CALL`), tradução, dicionário, TODAS as funções de IA (`explainWordWithAI`, `generateChunksWithAI`, `getPTPhoneticWithAI`, `generateStoryWithAI`, `aiChatPassthrough`, classificação), TTS fetch, badge, backfill. |
| `popup/` | Popup da barra — hoje só abre o dashboard; PRECISA virar login + status. |
| `dashboard/newtab.html/js` | Aba nova = flashcard rápido. Decidir se mantém (ver roadmap). |

### 3.2. Páginas do dashboard (site)
`dashboard/js/core/app.js` é o router. Páginas: `home`, `stories`, `leagues`, `library` (Cofre), `settings`, `study` (via botão). Cada uma em `dashboard/js/ui/*View.js`.

### 3.3. Camada de dados
`utils/db.js` (908 l.) — módulo único, cloud-only, fala REST com o Supabase. Padrão `isProxyMode`: dentro de página de extensão, roteia via `chrome.runtime.sendMessage` pro SW (que detém o token). No site, chama direto. **Refresh de token automático** (`_refreshTokenIfNeeded`, mutex contra refresh duplo) já implementado.

### 3.4. IA e TTS
- **IA:** `dashboard/js/core/ai.js` é o cliente unificado — na extensão passa pelo SW (`ai_chat`, respeita BYOK); no site chama a Edge Function `deepseek-chat` direto com o token. Edge Function v3 blindada (JWT real, CORS restrito, rate-limit, chave no Vault).
- **TTS:** `dashboard/js/core/tts.js` — áudio natural (Google TTS) com cache IndexedDB + download de MP3. Na extensão via SW (`FETCH_TTS`); no site via Edge Function `tts` (proxy autenticado). Voz robótica (Web Speech) só como último fallback.

### 3.5. Banco de dados (10 tabelas, RLS ativo em todas)
| Tabela | Uso | Observação |
|---|---|---|
| `words` | ✅ ativo | Vocabulário salvo. Colunas: word, lang, translation, context_sentence, phonetic, pronunciation_pt, definition, ai_chunks(jsonb), synonyms, antonyms, snapshot, category, level, video_url/title, platform, tags, added_at. `deck_id` ainda existe (nullable) mas é legado. |
| `cards` | ✅ ativo | Estado FSRS: status, interval, ease_factor(legado), step_index, reps, lapses, **stability, difficulty** (FSRS), pre_lapse_interval, due_date, last_review, suspended, is_leech. |
| `review_log` | ✅ ativo | Histórico de revisões (trigger `calculate_xp_on_activity` credita XP aqui). |
| `sessions` | ✅ ativo | Tempo de estudo por dia (pra streak/stats). |
| `user_stats` | ✅ ativo | Gamificação: xp_today/week/total, league_index, streak, username, avatar_url. RPCs: `ensure_user_stats`, `get_user_stats`. |
| `settings` | ✅ ativo (1.770 linhas) | Key-value de config por usuário (CEFR, TTS, SRS, retenção FSRS `lf_srs_retention`, etc). |
| `api_usage_log` | ✅ ativo | Rate-limit das Edge Functions (RLS sem policy — só service_role). |
| `decks` | ⚠️ ÓRFÃ (3 linhas) | Removida do código, tabela ainda existe. Limpar. |
| `known_words` | ⚠️ VAZIA (0) | Feature "palavra conhecida" (LingQ) existe no schema mas nunca foi ligada. |
| `sentences` | ⚠️ VAZIA (0) | Feature de frases salvas existe mas não é usada. |

Funções/triggers: `calculate_xp_on_activity` (trigger em review_log), `ensure_user_stats`, `get_user_stats`, `get_due_cards`, `handle_new_user`, `get_deepseek_key` (Vault, service_role).

---

## 4. O que está ERRADO, FALTANDO e DEVERIA TER

### 4.1. ERRADO (bugs confirmados)
1. **Histórias quebram no site.** `storiesView.js` (linhas 305, 443, 445, 562) usa `chrome.runtime.sendMessage` — que só existe na extensão. No site dá erro e não gera história. PRECISA rotear via `ai.js`/Edge Function (geração) e via um caminho de tradução web. **Este é o bug mais visível pro usuário hoje.**
2. **`utils/fsrs.js` é código morto** — segunda implementação de FSRS que ninguém importa. O FSRS vivo é o inline em `db.js::_calculateNextState`. Remover `fsrs.js` OU consolidar (preferir uma fonte só).
3. **Tabela `decks` órfã** — remover do banco (migração) depois de confirmar zero dependência.
4. **`newtab.js` usa grade só 1/3** (bad/good) — não bate com a escala FSRS 1-4. Alinhar ou simplificar.
5. **Ícones PWA 192/512 são upscale** do 128 (suaves). Trocar por arte original.
6. **`icon.png` da raiz tem header PNG corrompido** (dimensões absurdas na leitura). Avaliar remoção.

### 4.2. FALTANDO (features prometidas pela stack, ausentes)
1. **Login próprio no popup da extensão** (decisão 2.2) — hoje o popup só manda "logar no dashboard".
2. **Consolidação site-only** (decisão 2.1) — parar de servir o dashboard como página de extensão; popup abre o site.
3. **Export/Import Anki** (`.apkg` ou `.txt`/CSV compatível) + todas as opções de deck do Anki (suspender, enterrar, reposicionar, opções por deck). Hoje há só export CSV cru.
4. **Backup completo** (export/import de todo o progresso do usuário — words+cards+stats).
5. **Modo Leitor estilo LingQ de verdade** — importar texto/URL/epub, palavras clicáveis coloridas por status, salvar com um clique, usar `known_words` (que está vazia). O `web-reader.js` e o `storiesView` são embriões.
6. **Contador de "palavras conhecidas"** + lemmatização (run/runs/running = 1 palavra) via `compromise` — a métrica-vício do LingQ.
7. **Exercícios variados no estudo** — hoje é só flashcard. Faltam: cloze (lacuna), montar frase, ditado (escute e escreva) — os dados já existem em `ai_chunks`.
8. **Avaliação oficial CEFR/Cambridge** — hoje o nível CEFR é uma config que ajusta prompts. Falta uma **avaliação real** que estime o nível do usuário (placement test) e classifique palavras/textos por nível oficial de forma rigorosa (usar a `cefr-wordlist.json` que já existe em `utils/`).
9. **Mais mini-jogos** — hoje só "Ligar Colunas" (`gameView`). Sugestões: ditado relâmpago, corrida contra o tempo, "ouça e escolha", completar frase do vídeo.
10. **Notificações/lembrete de revisão** — `srs-reminder` (alarme no SW) existe mas não vira notificação visível. PWA pode usar Notification API.
11. **Streak freeze** (Duolingo) — perdoa 1 dia; barato e retém.
12. **Cartões reversos** (PT→EN) — dobra o valor de cada palavra.
13. **Estatísticas de retenção reais** — retenção %, carga futura ("amanhã: 37 cards"), previsão. Dados já em `review_log`.

### 4.3. DEVERIA TER (qualidade/produto)
1. **Cadeia de TTS neural premium offline** — Kokoro-82M (WebGPU/WASM, ~82MB, roda no navegador, qualidade acima do Google WaveNet, Apache 2.0, custo zero). Cai bem no PWA. Fallback: edge-tts (função Vercel/Supabase).
2. **Onboarding + placement test** — primeiro acesso estima o nível CEFR e monta a trilha.
3. **Banco de frases-exemplo Tatoeba** (CC) — enriquece cards sem custo de IA.
4. **PWA polido** — offline real (já melhorado), instalável, notificações, ícones bons.
5. **Acessibilidade** — a stack toca muito UI; garantir ARIA, teclado, contraste (o dark mode já foi corrigido uma vez).

---

## 5. ROADMAP PRIORIZADO (ordem de execução pro Fable 5)

> Cada etapa: **objetivo**, **arquivos**, **critério de aceite**, **cuidados**. Não pule ordem sem avisar o dono. Pare e confirme entre blocos grandes.

### BLOCO A — Consolidação da arquitetura (destrava tudo)
**A1. Corrigir Histórias no site (bug mais visível).**
- Arquivos: `dashboard/js/ui/storiesView.js`, `dashboard/js/core/ai.js`.
- Fazer: criar `generateStoryWeb(genre)` em `ai.js` (chama Edge Function `deepseek-chat` com o prompt de história do SW); no `storiesView`, detectar `isExtension` e rotear (extensão → `chrome.runtime.sendMessage`; web → `generateStoryWeb`). Idem para as traduções (linhas 443/445/562) — usar um helper de tradução web (Edge Function `tts` não; criar/rotear tradução — checar se há endpoint público de tradução usável no site sem CORS).
- Aceite: gerar história no site `linguaflow-web-tau.vercel.app` sem erro; clicar palavra na história e ver tradução.
- Cuidado: o site não tem `chrome.runtime`; qualquer `sendMessage` no caminho web quebra.

**A2. Login próprio no popup da extensão.**
- Arquivos: `popup/popup.html`, `popup/popup.js`.
- Fazer: mini form email/senha → `db.login()`; mostrar status (logado como X / cards devidos); botão "Sair"; botão "Abrir Dashboard" abre `https://linguaflow-web-tau.vercel.app/`.
- Aceite: logar no popup, recarregar, seguir logado (refresh token); clicar palavra no vídeo com a IA compartilhada funcionando sem BYOK.
- Cuidado: `db.login` na extensão passa pelo proxy → SW. Testar o caminho proxy.

**A3. Consolidar dashboard site-only.**
- Fazer: o popup e o newtab abrem o site, não a página de extensão. Avaliar remover `dashboard/` do `web_accessible_resources` e do bundle da extensão (ou manter só o mínimo). NÃO quebrar o site (mesma pasta).
- Aceite: extensão não abre mais o dashboard embutido; site é a casa; bundle da extensão menor.
- Cuidado: confirmar que nada do content script depende de abrir `dashboard.html` como página de extensão.

### BLOCO B — Paridade Anki (o núcleo "estudo sério")
**B1. Export/Import Anki + backup completo.**
- Arquivos: `dashboard/js/ui/settingsView.js`, `utils/db.js` (funções de export/import).
- Fazer: export `.txt`/CSV no formato que o Anki importa (Front;Back;Tags) e um backup JSON completo (words+cards+stats); import que lê de volta. Idealmente `.apkg` (gerar SQLite — pesquisar lib client-side; se inviável, `.txt` cobre 90%).
- Aceite: exportar, importar no Anki de verdade, ver os cards; reimportar o backup restaura o estado.

**B2. Opções de deck estilo Anki + cartões reversos + estatísticas de retenção.**
- Fazer: suspender/enterrar card, reposicionar, opções (novos/dia, revisões/dia); cartão reverso PT→EN; painel de stats (retenção %, carga futura) usando `review_log`.
- Aceite: suspender um card e ele some da fila; reverso aparece; stats batem com os dados.

### BLOCO C — LingQ (input compreensível)
**C1. Modo Leitor de verdade.**
- Arquivos: novo `dashboard/js/ui/readerView.js` (evoluir `storiesView`/`web-reader`), `utils/db.js` (usar `known_words`).
- Fazer: importar texto/URL/colar; renderizar com palavras clicáveis coloridas por status (novo/aprendendo/conhecido); clique salva/marca conhecida; usar `known_words` (hoje vazia).
- Aceite: colar um texto, clicar palavras, status colorido persiste; contador de palavras conhecidas sobe.

**C2. Contador de palavras conhecidas + lemmatização.**
- Fazer: integrar `compromise` (MIT, client-side) pra lematizar (run/running = 1); métrica central no Início.
- Aceite: "running" conta como "run"; número de palavras conhecidas é a métrica de progresso.

### BLOCO D — Duolingo (hábito) + avaliação oficial
**D1. Exercícios variados no estudo.**
- Arquivos: `dashboard/js/ui/studyView.js`.
- Fazer: além do flashcard, cloze (lacuna na frase), montar frase (usar `ai_chunks`), ditado (TTS + digitar). Alternar tipos por card.
- Aceite: sessão de estudo mistura os tipos; cada um credita XP e agenda via FSRS.

**D2. Avaliação oficial CEFR/Cambridge + placement test.**
- Arquivos: novo módulo de avaliação; `utils/cefr-wordlist.json` (já existe).
- Fazer: teste de nivelamento no onboarding que estima CEFR; classificar palavras/textos por nível oficial de forma rigorosa (lista CEFR + frequência `frequency-en.json`, ambos já em `utils/`). O nível vira real: filtra conteúdo, ajusta dificuldade, mede progresso rumo a B2/C1.
- Aceite: fazer o teste → recebe um nível CEFR fundamentado; o sistema usa esse nível de ponta a ponta.

**D3. Mais mini-jogos + streak freeze + notificações.**
- Fazer: 2-3 jogos novos (ditado relâmpago, ouça-e-escolha, completar frase do vídeo); streak freeze; notificação de revisão via `srs-reminder`.
- Aceite: jogos jogáveis creditando XP; streak perdoa 1 dia; lembrete aparece.

### BLOCO E — Qualidade / voz / limpeza
**E1. Cadeia TTS Kokoro-82M** (voz neural offline no site/PWA) — ver `MELHORIAS.md`.
**E2. Limpeza:** remover `utils/fsrs.js` (morto), tabela `decks` (migração), corrigir `newtab` grade, trocar ícones PWA por arte original, remover `icon.png` corrompido.
**E3. Onboarding + Tatoeba** (frases-exemplo grátis) + acessibilidade.

---

## 6. Estado ATUAL do que já foi feito (não refazer)
- ✅ Refresh de token (Fase 0) — sessão renova sozinha, mutex contra refresh duplo.
- ✅ Limpeza (Fase 1) — código morto removido, oauth2/identity fora do manifest, PWA (ícones/rota stories/start_url).
- ✅ IA segura (Fase 2) — Edge Function `deepseek-chat` v3: JWT real, CORS restrito, rate-limit, chave no Vault via RPC. BYOK como override. **Modo compartilhado testado E2E, funcionando.**
- ✅ Bugs do feedback — saveWord 400 (migração + fix), Sair, dark mode, missões reais, CEFR sync extensão↔site.
- ✅ FSRS-4.5 no lugar do SM-2 (testado, cards legados compatíveis) + slider de retenção + undo (Ctrl+Z).
- ✅ PWA offline real (`sw.js` reescrito).
- ✅ TTS com cache IndexedDB + download MP3 + Edge Function `tts`.
- ✅ Cards v2 (estudo funcional: revelação sem vazamento, tutor de gramática em chat, YouGlish, áudio salvável).

Detalhe fino de cada item em `CHECKLIST.md`.

---

## 7. Pendências que dependem do dono (não são código)
- [ ] Testar manualmente na extensão + no site (roteiro no `CHECKLIST.md`).
- [ ] **Rotacionar a chave DeepSeek** (foi colada no chat) e atualizar só no Vault (`update vault.secrets`).
- [ ] Confirmar se quer manter o `newtab` flashcard ou remover na consolidação.

---

## 8. Regra de ouro
LinguaFlow é pra quem quer **fluência real com conteúdo real**, com rigor de **poliglota** e régua **CEFR/Cambridge**. Cada feature nova responde a: "isso aproxima o usuário da fluência de verdade, ou é só enfeite?". Se for enfeite, não faz. **Tudo tem que conversar** — a mesma palavra vive no vídeo, no card, no leitor, no jogo e nas stats, sempre a partir da única fonte de verdade (Postgres/Supabase).
