# Mapa do projeto — LinguaFlow

> **Para quem chegou agora:** este é o documento para entender o projeto inteiro sem abrir o código.
> Leia as seções 1 a 3 (5 minutos) para saber o que existe e onde. O resto é consulta.
>
> **Este mapa é mantido por máquina.** O inventário de arquivos (seção 14) é gerado do código por
> `npm run map`, e o teste `npm run test:project-map` falha se um arquivo for criado, apagado,
> renomeado, ficar sem descrição ou mudar de porte sem o mapa ser atualizado. A narrativa (seções 1 a 13)
> é escrita à mão; ao mudar uma peça descrita aqui, atualize a seção correspondente no mesmo PR.

Versão descrita: **3.0.x** (a versão exata está em `package.json`). Idioma do produto e do código: português do Brasil.

---

## 1. O que é o LinguaFlow, em um minuto

Plataforma para aprender inglês com conteúdo real: assistir vídeos com legenda interativa, ler textos e histórias,
salvar o que não conhece e revisar com repetição espaçada (FSRS). É formada por **três peças que se falam por HTTPS**:

| Peça | Onde mora no repositório | Onde roda | Como é publicada |
|---|---|---|---|
| **Extensão Chrome (MV3)** | `manifest.json`, `background/`, `content/`, `popup/` | No navegador do aluno, dentro de YouTube, Netflix, Max/HBO, Disney+ e Prime Video; o Leitor roda em qualquer site | Pacote `.zip` gerado por `npm run build:extension` (`dist/`) |
| **Dashboard (PWA)** | `dashboard/` (e `utils/`) | No navegador, servido pela Vercel | Deploy automático da `main` na Vercel (`vercel.json` reescreve `/css`, `/js`… para `/dashboard/*`) |
| **Backend (Supabase)** | `supabase/` | Supabase: Postgres, Auth e Edge Functions (Deno) | Migrations e funções são aplicadas manualmente; o repositório **não** tem pipeline que as publique |

O código compartilhado entre a extensão e o dashboard fica em `utils/`. Não há bundler nem transpilador:
são **módulos ES nativos** (JavaScript puro). O que o navegador carrega é o que está no repositório.

**Regra de ouro:** o Postgres do Supabase é a única fonte da verdade. O cliente (extensão ou dashboard) nunca calcula
agendamento FSRS nem XP; ele chama RPCs. Detalhes em [ARQUITETURA.md](ARQUITETURA.md).

---

## 2. Visão geral em um desenho

```
 NAVEGADOR DO ALUNO
 ┌────────────────────────────────────────────┐   ┌───────────────────────────────┐
 │ Página de vídeo (YouTube / Netflix / Max…) │   │ Dashboard PWA (linguaflow-web) │
 │  ├─ MAIN world: youtube-hook / hbo-inject  │   │  dashboard.html → js/core/app  │
 │  │     (captam a legenda, avisam por        │   │  roteador + telas (js/ui/*)    │
 │  │      postMessage com nonce)              │   │  sw.js (cache offline da PWA)  │
 │  └─ Content script: index.js                │   └───────────────┬───────────────┘
 │        SubtitleEngine, dock, painel,        │                   │ fetch (REST/RPC)
 │        WordPopup, revisão rápida            │                   │ e Edge Functions
 │              │ chrome.runtime.sendMessage   │                   │
 │              ▼                              │                   │
 │  Service worker (background/)  ◄───── popup/                    │
 │   fila de salvar palavras, tradução,        │                   │
 │   IA, alarmes, selo, notificação            │                   │
 └──────────────┬──────────────────────────────┘                   │
                │ fetch com a sessão (só o service worker tem o token)
                ▼                                                   ▼
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ SUPABASE                                                                       │
 │  Auth (JWT) · Postgres com RLS em todas as tabelas · RPCs (PL/pgSQL) ·         │
 │  Edge Functions: deepseek-chat · tts · url-import · fluency-assessment ·       │
 │                  push-reminder (cron) · email-reengagement (cron)              │
 └────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mapa das pastas

| Pasta | O que tem | Comece por |
|---|---|---|
| `content/` | Tudo que roda **dentro** das páginas de streaming: motor de legendas, dock de controles, painel de configurações, popup de palavra, revisão rápida, Leitor web | `content/index.js` |
| `content/subtitles/` | Peças pequenas e testáveis do motor de legendas (VTT, ativação, atalhos, dock, shadowing, ponte segura…) | `content/subtitles/*.js` |
| `background/` | Service worker MV3 e módulos puros dele (fila de palavras, alarmes, TTS) | `background/service-worker.js` |
| `popup/` | Popup da extensão (login, resumo do dia, atalho para as configurações do player) | `popup/popup.js` |
| `dashboard/` | A PWA: `js/core` (roteador, IA, TTS, regras puras), `js/ui` (telas), `css`, `sw.js` | `dashboard/js/core/app.js` |
| `utils/` | Código compartilhado: banco (`db.js`), tradutor, dicionários, lematizador, perfil lexical, observabilidade | `utils/db.js` |
| `utils/db/` | Repositórios por domínio (cursos, estatísticas, histórias/leitor, gamificação) usados por `db.js` | `utils/db/*.js` |
| `supabase/migrations/` | Histórico SQL **append-only** do banco | o arquivo mais recente |
| `supabase/functions/` | Edge Functions (Deno/TypeScript) | `supabase/functions/<nome>/index.ts` |
| `supabase/content/` | Fonte editorial dos cursos (lotes) que viram migrations | [EDITORIAL_CURSOS.md](product/EDITORIAL_CURSOS.md) |
| `tests/` | Testes unitários, de contrato, de banco e de navegador | seção 10 |
| `scripts/` | Automação: empacotar a extensão, gerar conteúdo, validar, gerar este mapa | `scripts/*.mjs` |
| `.github/workflows/` | CI (verificação, CodeQL, monitor de RLS em produção, keep-alive) | `release.yml` |
| `docs/` | Documentação viva; histórico em `docs/history/`, produto em `docs/product/` | [INDICE.md](INDICE.md) |

---

## 4. A extensão por dentro

### 4.1 Como o código chega na página

O `manifest.json` declara três content scripts (nenhum é módulo nativo, então há um "carregador"):

1. **`content/injector.js`** (em `document_start`, só YouTube e Max/HBO): injeta no **mundo da página** (MAIN world)
   o `content/youtube-hook.js` ou o `content/hbo-inject.js`. Esses scripts interceptam `fetch`/`XHR` para captar a legenda
   que o próprio player baixa. Cada injeção leva um **nonce**; só mensagens com o nonce certo são aceitas
   (`content/subtitles/bridge-security.js`).
2. **`content/boot.js`** (em `document_idle`, nos sites de vídeo): importa `content/index.js` como módulo.
3. **`content/web-reader.js`** (todos os sites, exceto o site oficial e sites de vídeo): o Modo Leitura para qualquer página
   (duplo clique ou seleção traduz e salva).

`content/index.js` só segue em sites suportados e monta: `SubtitleEngine` (legendas), `MaxPlayerUI` (dock lateral, em Max,
Netflix, Disney+ e Prime), `SettingsPanel` (configurações no player) e `ReviewOverlay` (revisão rápida, tecla `R`).
No YouTube o dock é horizontal e vive na barra de controles do próprio player (montado pelo motor).

### 4.2 Como as peças conversam

| Canal | Quem fala com quem | Exemplos |
|---|---|---|
| `window.postMessage` com nonce | Hooks do MAIN world → content script | `LF_HBO_SUB`, `LF_SUBTITLE_HOOK`, `LF_CAPTION_AVAILABILITY`, `LF_PLAYER_STATE`, `LF_YT_SUB_TOGGLE` |
| Eventos do `window` (`CustomEvent`) | Partes do content script entre si | `LF_UPDATE_*` (configurações ao vivo), `LF_TOGGLE_SETTINGS`, `LF_TOGGLE_REVIEW`, `LF_WORD_SAVED/KNOWN/IGNORED` |
| `chrome.runtime.sendMessage` | Content script / popup → service worker | `QUEUE_WORD_SAVE`, `DB_CALL`, `translate`, `dictionary`, `wordSenses`, `ai_*`, `FETCH_TTS`, `FETCH_NEURAL_TTS`, `OPEN_DASHBOARD` |
| Porta `chrome.runtime.connect` | Streaming de IA do service worker para a página | `utils/ai-stream.js` |

### 4.3 O service worker

`background/service-worker.js` é a central. Concentra: o **banco** (as páginas usam `utils/db.js` em *modo proxy* e cada chamada
vira `DB_CALL`, então o token de sessão nunca fica na página), a **tradução** e os dicionários (evita CORS da página),
a **IA** (`background/ai-generator.js`), a **fila local-first de salvar palavras** (`background/word-save-queue.js`: salvar
funciona offline e é reenviado depois, de forma idempotente), os **alarmes** (`background/reminders.js`), o **selo** com os
cards pendentes e a **notificação** de revisão (no máximo 1 a cada 20 h). O áudio do Google Tradutor só é buscado para a URL
permitida em `background/tts-url.js`.

### 4.4 Estado do player

O LinguaFlow **começa desligado** no player (o botão `LF` ou a tecla `C` liga). A regra de início vem de
`content/subtitles/activation-state.js` (modos `session`, `off`, `on`, `remember`). Ligar o LF no Max também liga a legenda
nativa por baixo (`content/subtitles/hbo-native-captions.js`), porque a Max só envia a legenda com ela ligada.
O dock pode ser recolhido para só o botão `LF` (`content/subtitles/dock-collapse.js`).

### 4.5 Onde a extensão guarda coisas

`chrome.storage.local` (sessão do Supabase, fila de palavras, escolhas de UI), `chrome.storage.session` (escolha de ativar
nesta sessão do navegador), IndexedDB (`LinguaFlow_OfflineDict` para dicionário, `lf-audio-cache` para áudio) e `localStorage`
da página (posição do dock, velocidade). Tudo isso é **cache descartável**; a verdade está no Supabase.

### 4.6 Permissões do manifest (e por que existem)

| Permissão | Uso |
|---|---|
| `storage`, `unlimitedStorage` | Sessão, filas e caches de dicionário/áudio |
| `alarms` | Sincronizar fila de palavras e escuta (1 min) e lembrete de revisão (60 min) |
| `notifications` | Lembrete de cards pendentes |
| `contextMenus` | "Salvar no LinguaFlow" com o botão direito |
| `tabs` | Reaproveitar a aba do LinguaFlow e avisar abas abertas de que o Cofre mudou |
| `host_permissions` | Provedores de tradução/dicionário e o projeto Supabase |

---

## 5. O dashboard (PWA) por dentro

- **Entrada:** `dashboard/dashboard.html` carrega `js/core/app.js` (módulo). O `app.js` registra o service worker da PWA,
  cuida de sessão, tema e do aviso "Atualizar".
- **Roteador:** em `app.js`. As telas pesadas são carregadas sob demanda (`import()`); o container de cada tela é um `Proxy`
  que **recusa escrita de uma renderização substituída**, então uma resposta atrasada nunca desenha sobre a tela errada.
  A rota restaurável fica no hash da URL (`js/core/routeHash.js`).
- **Rotas e arquivos:**

| Rota | Tela | Rota | Tela |
|---|---|---|---|
| `home` | `ui/homeView.js` | `courses` | `ui/coursesView.js` (+ `ui/courses/`) |
| `learn` | `ui/learnView.js` | `course-practice` | `ui/coursePracticeView.js` |
| `study` | `ui/studyView.js` (revisão FSRS) | `library` | `ui/libraryView.js` (o Cofre) |
| `stories` | `ui/storiesView.js` | `reader` | `ui/readerView.js` |
| `progress` / `stats` | `ui/progressView.js`, `ui/statsView.js` | `leagues` | `ui/leaguesView.js` |
| `settings` | `ui/settingsView.js` | `fluency-check` | `ui/fluencyCheckView.js` |
| `login` | `ui/loginView.js` | `admin` | `ui/adminView.js` (+ `ui/admin/`) |

- **PWA (`dashboard/sw.js`):** casca do app em cache, **rede primeiro** para código e navegação, nunca cacheia o Supabase.
  O nome do cache carrega a versão; versões antigas são apagadas.
- **Estilos:** `dashboard/css/` (`globals.css` com os tokens, `editorial.css`, `course-*.css`, `admin.css`).
- **Telas devem ter** estados de carregamento, vazio, erro e sucesso (`ui/viewState.js`), teclado e foco visível.

---

## 6. O backend (Supabase)

**Banco.** Segundo as migrations, todas as tabelas de `public` têm RLS ligado; leitura e escrita passam por `auth.uid()`. As funções privilegiadas
(`SECURITY DEFINER`) fixam `search_path`. Domínios das tabelas:

| Domínio | Tabelas principais |
|---|---|
| Vocabulário e cards | `words`, `cards`, `sentences`, `known_words`, `ignored_words`, `review_log`, `card_review_undos`, `card_adaptive_profiles`, `card_learning_signals` |
| Cursos | `course_catalog`, `course_lessons`, `course_units`, `course_practice_sessions`, `course_session_results`, `course_user_reviews`, `course_user_mistakes`, `course_user_notes`, `course_user_vocabulary`, `user_course_enrollment` |
| Leitura e histórias | `reader_texts`, `stories`, `translation_cache`, `canonical_lexicon` |
| Fluência | `fluency_skill_profiles`, `fluency_task_submissions`, `fluency_task_issues`, `learning_task_attempts` |
| Progresso e jogo | `user_stats`, `xp_ledger`, `user_achievements`, `league_meta`, `sessions`, `study_time_heartbeats`, `listening_intervals`, `media_watch_sessions`, `learning_events` |
| Conta e preferências | `settings`, `push_subscriptions` |
| Operação e admin | `admin_users`, `admin_sessions`, `admin_audit_log`, `admin_backups`, `admin_config`, `admin_flags`, `admin_pin_attempts`, `user_reports`, `api_usage_log`, `client_errors`, `keep_alive` |

**Migrations.** Append-only: nunca edite uma já aplicada; crie outra. Nome `AAAAMMDDHHMMSS_assunto.sql`. O CI as reproduz
num Postgres efêmero (`tests/db/validate-migrations.sh`).

**Edge Functions.** As que os clientes chamam validam o **usuário do token** (nunca um id vindo do corpo) e aplicam cota por usuário; as duas de cron validam uma chave de cron comparada em tempo constante:

| Função | Para que serve | Quem chama |
|---|---|---|
| `deepseek-chat` | Proxy de IA (a chave fica só no Supabase) | `dashboard/js/core/ai.js`, service worker |
| `tts` | Áudio neural (Edge TTS com reserva no Google) | `dashboard/js/core/tts.js`, service worker |
| `url-import` | Importa texto de uma URL para o Leitor, com defesa contra SSRF | `ui/readerView.js` |
| `fluency-assessment` | Avalia respostas da Checagem de Fluência | `utils/db.js` |
| `push-reminder` | Notificação push de revisão | `pg_cron` (não é chamada por clientes) |
| `email-reengagement` | E-mail de reengajamento | `pg_cron` |

**Segredos** ficam no Supabase (Secrets/Vault), nunca no repositório nem no cliente. O cliente só tem a URL do projeto e a
chave **publicável** (`utils/db.js`), que por desenho é pública; a proteção real é a RLS.

---

## 7. Como os dados fluem (os cinco caminhos que importam)

1. **Salvar uma palavra do vídeo.** Clique na palavra → `WordPopup` → `QUEUE_WORD_SAVE` → o service worker grava na fila local →
   `syncPendingWordSaves` chama `db.saveWord` → RPC `save_word_with_card`. Se estiver offline ou a rede falhar, a palavra espera
   na fila e é reenviada; duplicar não é possível (idempotência).
2. **Revisar um card.** `studyView.handleGrade` trava cliques duplos, gera um `operationId` e chama `logReview` → RPC atômica
   `record_card_review`. O **servidor** calcula o FSRS e decide se a avaliação é elegível (limites diários, card suspenso…).
   Reenviar a mesma operação é seguro.
3. **Praticar um curso.** `coursePracticeSession.js` guarda o estado (sem DOM); ao concluir, sair da tela, **recarregar ou fechar
   a aba** o parcial vai para `sessionStorage` e é enviado por `commitPractice` (idempotente por `client_session_id`) na
   próxima abertura dos Cursos.
4. **Ler uma URL.** `readerView` → `url-import` (valida DNS e IPs a cada redirecionamento) → texto limpo → tabela `reader_texts`.
5. **Checagem de fluência.** `fluencyCheckView` → `utils/db.js` → `fluency-assessment` (IA avalia pela rubrica) →
   RPC autoritativa grava o perfil. O cliente não calcula nível.

---

## 8. Segurança em uma página

- **RLS em 100% das tabelas** e funções privilegiadas com `search_path` fixo. Monitor agendado confere o isolamento entre
  duas contas em produção (`production-rls.yml`).
- **Sem segredos no cliente.** Chaves de IA e de e-mail ficam no Supabase.
- **Sessão fora da página.** Em sites de vídeo, só o service worker fala com o Supabase com o token.
- **Conteúdo de fora é hostil:** legenda, texto da web e resposta de IA entram no DOM escapados (`utils/html.js`,
  `ui/viewState.js`) e há testes específicos (`untrusted-html-security`).
- **Ponte da página:** mensagens do MAIN world só valem com o nonce da injeção atual.
- **Fetch arbitrário recusado:** `FETCH_TTS` só busca `https://translate.google.com/translate_tts`.
- **CSP** da extensão no `manifest.json` e da PWA no `vercel.json`.
- Política de reporte: [SECURITY.md](../SECURITY.md).

---

## 9. Regras de trabalho (resumo do [AGENTS.md](../AGENTS.md))

- **Toda mudança começa por uma Issue** (Correção, Melhoria ou Nova função), com escopo, critérios de aceite, riscos e plano de teste.
- Branch a partir da `main`; **deploy só por Pull Request**, com `Closes #N`/`Refs #N`, CI verde e revisão. Nunca push direto.
- **Commits convencionais** (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`…) com **assunto começando em minúscula**; o CI
  rejeita o contrário. Use o modelo `.github/pull_request_template.md`.
- **Mudança de comportamento é teste primeiro** (vermelho, verde, refatora). Testes de contrato e de navegador real são coisas
  diferentes; nunca declare visual ou animação validados só por teste de código.
- **Interface:** estados de carregamento/vazio/erro/sucesso, `prefers-reduced-motion`, teclado, foco visível, nomes acessíveis.
- **Migrations são append-only**; segredos ficam fora do cliente, dos logs e do Git.
- Atualize o `CHANGELOG.md` para mudança que o usuário percebe e este mapa para mudança de estrutura.
- Registre decisões de arquitetura na seção 6 de [ARQUITETURA.md](ARQUITETURA.md).

---

## 10. Testes e qualidade

| Camada | Onde | Como rodar |
|---|---|---|
| Unitário e contrato | `tests/*.test.mjs` | `npm test` (= `test:release`; o `pretest:release` roda antes os grupos de estabilização, adaptativo, fluência…) |
| Extensão | vários, agrupados | `npm run test:ext` |
| Banco | `tests/db/` | `bash tests/db/validate-migrations.sh` (Postgres efêmero) |
| Navegador real | `tests/e2e/` | `npm run test:e2e` (Playwright, carrega a extensão num Chromium) |
| Conteúdo dos cursos | `scripts/content-check.mjs` | `npm run content:check` |
| Lint e código morto | `biome.json`, `knip.json` | `npm run lint:biome`, `npm run lint:knip` (rodam no CI) |
| Este mapa | `scripts/generate-project-map.mjs` | `npm run test:project-map` |

Muitos testes **leem o código-fonte como texto** (verificam que certos trechos existem). Ao mover código entre arquivos, os testes
precisam apontar para o novo lugar sem perder a exigência original.

**CI (`.github/workflows/release.yml`):** Biome, Knip, commitlint, Playwright, cobertura, observabilidade, `npm audit`, testes do
motor, replay das migrations e o `test:release` completo. Os testes do CI **não** provam: RLS real (há um workflow à parte),
Supabase e Edge Functions em produção, login real, comportamento dos sites reais (tela cheia, legendas reais, Disney+/Prime) nem
QA visual. Essas validações são manuais e devem ser declaradas no PR.

---

## 11. Versões e publicação

A versão aparece em **quatro lugares que precisam andar juntos**: `package.json`, `manifest.json`, `dashboard/sw.js`
(nome do cache e URLs da casca) e `dashboard/js/core/app.js` (`CLIENT_BUILD`). Quem confere: `scripts/package-extension.mjs`
(`package.json` × `manifest.json`) e `tests/release-smoke.mjs` (manifest × `CLIENT_BUILD` × nome do cache). O `?v=` de
`dashboard/dashboard.html` e da casca do `sw.js` **não** é conferido por teste: atualize à mão. Passos de uma versão: atualizar `CHANGELOG.md` → subir a versão nos lugares acima → PR → CI verde → merge
(a Vercel publica o dashboard) → `npm run build:extension` gera o `.zip` em `dist/` (ignorado pelo git).

---

## 12. Onde mexer quando eu quero…

| Quero mudar… | Vá para |
|---|---|
| Atalhos de teclado do player | `content/subtitles/player-hotkeys.js` e a lista em `content/subtitles/shortcuts-help.js` |
| Como a legenda aparece (posição, tamanho, modo) | `content/subtitle-engine.js` (UI) e `content/settings-panel.js` (opções) |
| Captura da legenda no YouTube / Max | `content/youtube-hook.js`, `content/hbo-inject.js`, `content/injector.js` |
| Botões do player (dock) | Max/Netflix/Disney/Prime: `content/max-player-ui.js`; YouTube: `_injectYouTubeControls` no motor e `content/subtitles/youtube-dock-styles.js` |
| Popup de palavra (tradução, salvar, IPA) | `content/word-popup.js` e `content/popup/popup-linguistics.js` |
| Salvar palavras / fila offline | `background/word-save-queue.js`, `background/service-worker.js`, `utils/db.js` |
| Tradução e dicionários | `utils/translator.js`, `utils/offline-dict.js`, `utils/word-senses.js` |
| Voz / TTS | `utils/tts.js` (extensão), `dashboard/js/core/tts.js` (site), `supabase/functions/tts` |
| Revisão de cards e FSRS | `dashboard/js/ui/studyView.js` (tela) e as RPCs em `supabase/migrations` (regra; o cliente não calcula) |
| Cursos | `dashboard/js/ui/coursePracticeView.js`, `dashboard/js/core/coursePracticeSession.js`, `utils/db/courses-repo.js`, [CURSOS.md](product/CURSOS.md) |
| Conteúdo dos cursos | `supabase/content/` e [EDITORIAL_CURSOS.md](product/EDITORIAL_CURSOS.md) |
| Histórias e Leitor | `dashboard/js/ui/storiesView.js`, `readerView.js`, `supabase/functions/url-import` |
| XP, ligas, streak | RPCs e `xp_ledger` no banco; telas `homeView.js`, `leaguesView.js` |
| Console de admin | `dashboard/js/ui/admin/` |
| Preferências da extensão | `content/settings-panel.js` (gravação agrupada dos sliders) |
| Login da extensão | `popup/popup.js`, `utils/db.js` |
| Nova rota do dashboard | `dashboard/js/core/app.js` (e `routeHash.js` se restaurável) |
| Nova migration | `supabase/migrations/` (nunca edite as antigas) |

---

## 13. Glossário

| Termo | Significado |
|---|---|
| **LF** | LinguaFlow; também o botão liga/desliga no player |
| **Dock** | Barra de botões do LinguaFlow no player (vertical no Max/Netflix/Disney+/Prime, horizontal no YouTube) |
| **Cofre** | Tela `library`: as palavras e frases que o aluno salvou |
| **FSRS** | Algoritmo de repetição espaçada (v4.5); calculado só no servidor |
| **RPC** | Função do Postgres chamada pela API (`/rest/v1/rpc/...`) |
| **RLS** | Row Level Security: o banco só entrega ao usuário as linhas dele |
| **CEFR** | Níveis A1 a C2 de proficiência |
| **MAIN world** | O mundo JavaScript da própria página (os hooks de legenda rodam aqui) |
| **Nonce** | Código aleatório de cada injeção que autentica as mensagens da página |
| **bfcache** | Cache de voltar/avançar do navegador, que guarda a página inteira |
| **Shadowing** | Repetir a fala logo depois de ouvir (modo de legenda e ação do dock) |
| **Idempotente** | Repetir a operação não duplica o efeito (base das filas e dos retries) |

---

## 14. Inventário de arquivos (gerado)

**Porte:** `P` até 150 linhas · `M` até 500 · `G` até 1000 · `GG ⚠` acima de 1000 (candidato a divisão).
Para atualizar: `npm run map`.

<!-- mapa:inicio (gerado por scripts/generate-project-map.mjs; não edite à mão) -->

### Raiz e configuração

| Arquivo | Porte | Para que serve |
|---|---|---|
| `.mcp.json` | P | Servidores MCP usados nas sessões de desenvolvimento assistido. |
| `biome.json` | P | Regras do Biome (lint e formatação) aplicadas em scripts, utils, dashboard/js/core e tests. |
| `commitlint.config.cjs` | P | Regras de mensagem de commit (Conventional Commits), validadas no CI. |
| `config/biome-undeclared/biome.json` | P | Configuração do Biome só para detectar variáveis não declaradas. |
| `knip.json` | P | Configuração do Knip (código e dependências não usados). |
| `manifest.json` | M | Manifest MV3 da extensão: permissões, sites, content scripts e recursos expostos. |
| `package.json` | P | Versão, dependências de desenvolvimento e todos os scripts de teste/lint/build. |
| `playwright.config.mjs` | P | Configuração dos testes de navegador (Playwright): pasta tests/e2e, relatórios e servidor local. |
| `stryker.config.mjs` | P | Configuração do teste de mutação (Stryker) sobre utils/schema.js. |
| `vercel.json` | P | Deploy do dashboard na Vercel: rewrites para `/dashboard/*`, cabeçalhos de segurança e cache. |

### Extensão Chrome — service worker (`background/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `background/ai-generator.js` | M | Geração com IA no service worker: frases, histórias, variações e preenchimento de frases que faltam nos cards. |
| `background/cache-cleaner.js` | P | Limpeza dos caches descartáveis (dicionários, Linguee, Reverso, traduções) para liberar espaço quando o armazenamento enche. |
| `background/reminders.js` | P | Alarmes e lembrete de revisão do service worker (#465) |
| `background/service-worker.js` | GG ⚠ | Service worker MV3: central de mensagens (tradução, dicionário, IA, fila de salvar palavras), alarmes, selo de cards e notificação de revisão. |
| `background/tts-url.js` | P | URLs que o service worker aceita buscar para TTS (#470) |
| `background/word-save-queue.js` | P | regras puras da fila local-first de palavras (lf_pending_word_saves_v1). O service worker guarda e sincroniza; aqui fica só a decisão do que repetir e o que mostrar ao… |

### Extensão Chrome — popup (`popup/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `popup/popup.html` | P | Popup da extensão: entrar na conta, ver resumo do dia e abrir as configurações do player. |
| `popup/popup.js` | M | login próprio da extensão (sessão independente do site). |

### Extensão Chrome — scripts injetados nas páginas (`content/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `content/boot.js` | P | Bootloader necessário pois o Chrome não aceita "type: module" diretamente nos content_scripts nativos. |
| `content/hbo-inject.js` | P | Injetado via manifest world:MAIN + document_start Intercepta XHR e Fetch para capturar VTT de legendas do HBO/Max/Netflix |
| `content/index.js` | P | Entrada dos scripts de vídeo: só roda em sites suportados e monta o motor de legendas, o dock, o painel de configurações e a revisão rápida. |
| `content/injector.js` | P | Injeta scripts no MAIN world contornando o bug do Chrome (Manifest V3) que gera spam de "Blocked script execution in 'about:blank'" quando usamos "world": "MAIN" no ma… |
| `content/max-player-ui.js` | M | Dock lateral de controles (Max, Netflix, Disney+, Prime): botão LF, frase anterior/próxima, loop, shadowing, velocidade, painel e configurações. |
| `content/review-overlay.js` | M | LinguaFlow Review Overlay — Revisão rápida durante vídeos Mostra 1 flashcard por vez como overlay sem interromper o vídeo. |
| `content/settings-panel.js` | M | Painel de configurações da extensão no player (Shadow DOM): aparência da legenda, sincronia, idiomas e gravação das preferências. |
| `content/settings-panel/expression-mark-options.js` | P | As cinco marcas de expressão da legenda que o painel de configurações liga e desliga. |
| `content/settings-panel/markup.js` | G | Estrutura do painel: Shadow DOM com o CSS e o HTML de todas as seções de configuração. |
| `content/settings-panel/storage.js` | P | Lê e grava as configurações do painel no banco (importado sob demanda para não pesar no carregamento). |
| `content/subtitle-engine.js` | G | Motor de legendas: captura, sincronização, tradução, palavras clicáveis, painel lateral, dock do YouTube e atalhos do player. |
| `content/web-reader.js` | G | LinguaFlow Web Reader — Modo Leitura para qualquer site Ativado por duplo-clique em palavra ou seleção de texto. |
| `content/word-popup.js` | G | LinguaFlow Pro — Word Popup v5 (unified storage, bilingual examples, full grammar) |
| `content/word-popup/ai-context.js` | G | IA no popup: explicar o contexto, gerar frase e trechos, exemplos do vídeo e aviso de login. |
| `content/word-popup/first-recall.js` | P | Primeira lembrança: pergunta de recordação mostrada na primeira vez que a palavra aparece. |
| `content/word-popup/lookup.js` | M | Dados do popup: expressão, CEFR, falsos cognatos, tradução, dicionário, sentidos e trechos de uso. |
| `content/word-popup/positioning.js` | M | Posicionamento do popup sobre o player e acompanhamento da posição. |
| `content/word-popup/save.js` | M | Salvar a palavra (card + contexto), enriquecimento tardio, aviso de salvo e ignorar palavra. |
| `content/youtube-hook.js` | M | Script injetado no MAIN WORLD para contornar o CSP estrito do YouTube e capturar a legenda direto da fonte de rede sem atraso. |

### Extensão Chrome — legendas (`content/subtitles/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `content/subtitles/activation-state.js` | P | Estado inicial do botão LF nos players (Issue #418) |
| `content/subtitles/active-cue.js` | P | Escolha da fala ativa e do fim efetivo. |
| `content/subtitles/bridge-security.js` | P | Validação e segurança de mensagens da ponte de legendas Extraído de content/subtitle-engine.js |
| `content/subtitles/caption-conflict.js` | P | Detecta outra extensão de legendas (Language Reactor) no mesmo vídeo (#400): duas camadas de legenda se sobrepõem e o usuário não sabe qual desativar. |
| `content/subtitles/dock-collapse.js` | P | Recolher/expandir o dock de controles (#462) |
| `content/subtitles/dock-layout.js` | P | Lógica de layout responsivo para a dock horizontal do player Extraído de content/subtitle-engine.js |
| `content/subtitles/engine/caption-display.js` | G | A legenda na tela: host/Shadow DOM, posicionamento, renderização dual, palavras clicáveis e marcas de expressão. |
| `content/subtitles/engine/capture.js` | G | Obtenção das legendas: YouTube (XHR/VTT), DOM da plataforma, loop de sincronização, correção de encoding e legendas nativas. |
| `content/subtitles/engine/export.js` | M | Exportação da transcrição: PDF, CSV e Anki. |
| `content/subtitles/engine/playback.js` | G | Controles de reprodução: navegar entre falas, loops A-B e por fala, shadowing, foco por palavra e velocidade. |
| `content/subtitles/engine/sidebar-panel.js` | M | Painel lateral: criação, abertura, tema, destaque da fala atual e rolagem. |
| `content/subtitles/engine/transcript-tab.js` | M | Aba de transcrição do painel: lista de falas, explicação de linha por IA e tradução da barra lateral. |
| `content/subtitles/engine/words-tab.js` | M | Aba de palavras do painel: vocabulário do vídeo, marcar como conhecida e explorador de frases. |
| `content/subtitles/engine/youtube-dock.js` | M | Dock de botões do LinguaFlow na barra de controles do YouTube e sincronização do estado dos botões de loop. |
| `content/subtitles/expression-marks.js` | P | Marcas de expressão na legenda (phrasal, gíria, fala reduzida, contração, "soa como", marcador): tipos, CSS de cada traço, chaves de configuração e rótulos. |
| `content/subtitles/hbo-native-captions.js` | P | Liga a legenda nativa da Max/HBO por código. |
| `content/subtitles/hover-tip.js` | P | Dica leve ao passar o mouse numa palavra (#369): tradução e traduções por classe gramatical, sem IA e sem abrir o card. O clique continua abrindo o card completo. |
| `content/subtitles/line-explainer.js` | P | "Explicar esta fala" (Issue #347): prompt com a fala e as vizinhas, leitura segura da resposta da IA e cache local por vídeo + início da fala + idioma. |
| `content/subtitles/lookup-memory.js` | P | Memória de consultas repetidas (#488) |
| `content/subtitles/player-hotkeys.js` | M | Gerenciamento isolado dos atalhos de teclado do player Centro de Comando: A, S, D, Q, R, P, O, C, Espaço, Z, X, B, V, F, M, [ ], ? (lista em subtitles/shortcuts-help.js) |
| `content/subtitles/shadow-mode.js` | P | Modo shadowing (#456) Mostra a fala anterior (apagada), a atual (destaque) e a próxima (meio-tom) no lugar da legenda, com uma barra fina de progresso da fala. Só lógi… |
| `content/subtitles/shortcuts-help.js` | P | Painel de atalhos do player (Issue #432) Fonte única da lista de atalhos mostrada ao aluno; o teste de contrato garante que cada tecla listada aqui existe em player-ho… |
| `content/subtitles/smart-captions.js` | P | Legenda que se adapta ao que o aluno já sabe (#488) |
| `content/subtitles/start-tip.js` | P | Dica de primeira vez ancorada no botão LF (Issue #421) |
| `content/subtitles/subtitle-panel-styles.js` | M | CSS do painel lateral de legendas (palavras clicáveis, temas claro e escuro, marcas de expressão), injetado no documento fora do Shadow DOM. |
| `content/subtitles/subtitle-shadow-template.js` | M | HTML e CSS da legenda dentro do Shadow DOM (original, tradução, marcas de expressão e aviso), montados a partir do CSS de shadowing e do CSS das marcas. |
| `content/subtitles/transcript-render.js` | P | Funções puras de texto da legenda: segmentação em palavras/expressões (tela e roteiro), destaque de busca e estado de carregamento do roteiro. |
| `content/subtitles/video-vocabulary.js` | M | Vocabulário de um vídeo agrupado por lema, palavras-chave para o aluno e resumo de compreensão sem exagero. |
| `content/subtitles/vtt-parser.js` | P | Parser de legendas WebVTT Extraído de content/subtitle-engine.js (HBO Max / Max / VTT streams) |
| `content/subtitles/word-frequency.js` | P | Palavras muito comuns do inglês: lista de stop words e posição de frequência (top 5 mil) usadas na legenda e no vocabulário do vídeo. |
| `content/subtitles/youtube-dock-styles.js` | G | CSS dos controles LinguaFlow na barra do YouTube (Issue #429) Extraído sem alteração de content/subtitle-engine.js; o texto é injetado em <style id="lf-yt-styles">. |

### Extensão Chrome — análise linguística do popup de palavra (`content/popup/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `content/popup/popup-linguistics.js` | M | Regras puras do popup de palavra: limpa explicações de IA, detecta falsos cognatos, expressões e blocos comuns e rotula a classe gramatical. |

### Dashboard PWA — núcleo (`dashboard/js/core/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `dashboard/js/core/achievements.js` | P | Onda 8 (Gerente + Eng. SRS): sistema de conquistas — celebra marcos que já existem nos dados (streak, palavras salvas, palavras maduras, histórias), sem tabela nova ne… |
| `dashboard/js/core/adaptiveLearning.js` | P | Regras de aprendizagem adaptativa: plano por card, honestidade da autoavaliação, perfil do aluno e detecção de cansaço. |
| `dashboard/js/core/ai.js` | G | cliente de IA do dashboard. |
| `dashboard/js/core/app.js` | G | Núcleo do dashboard: roteador com renderização protegida contra tela antiga, sessão, tema, atualização da PWA e avisos. |
| `dashboard/js/core/coursePracticeSession.js` | M | Estado de uma sessão de prática, sem DOM. Regras de combo: só acerto sem envio errado e sem dica soma combo; dica, resposta revelada, envio errado ou pular quebram o c… |
| `dashboard/js/core/coursePrefs.js` | P | Preferências do player de cursos, guardadas neste navegador. |
| `dashboard/js/core/courseVault.js` | P | Cursos → Cofre (#434): leva uma frase/palavra estudada num curso para a fila única de revisão espaçada (FSRS, calculada no servidor). É sempre uma ação explícita do al… |
| `dashboard/js/core/epub.js` | P | Leitor de EPUB no navegador (Onda 3.1). Um .epub é um .zip com XHTML dentro; usamos fflate (CDN, ~8KB, só descompacta) e o DOMParser nativo do browser pra ler a estrut… |
| `dashboard/js/core/fluencyCheck.js` | M | Modelo de domínio da Checagem de Fluência: níveis A1–B2, habilidades, decisão de tentativa e força da evidência. |
| `dashboard/js/core/fluencyTaskCatalog.js` | M | Catálogo versionado de tarefas de fluência por nível e habilidade, com validação e sobreposição de texto estudado. |
| `dashboard/js/core/inputEngine.js` | M | LinguaFlow — Motor de Entrada e Tokenizador de Palavras Arquivo: dashboard/js/core/inputEngine.js Responsabilidade: Divisão em slots de palavras, cálculo de largura 'ch' |
| `dashboard/js/core/levelEstimator.js` | P | Lexical review summary only. Never a measured CEFR proficiency level. |
| `dashboard/js/core/placement.js` | M | Teste de nivelamento CEFR. |
| `dashboard/js/core/readability.js` | P | mede o nível CEFR REAL de um texto gerado (A4 do backlog). |
| `dashboard/js/core/reviewBatches.js` | P | Tamanhos de sessão da Revisão dos Cursos (#398). ~30 s por frase: 10 frases cabem em ~5 minutos. Fila grande desanima, então oferecemos uma sessão curta |
| `dashboard/js/core/routeHash.js` | P | Hash das rotas: "#rota" e, em Cursos, "#courses/<seção>" ou "#courses/course/<id>". |
| `dashboard/js/core/sessionQueue.js` | P | Interleaving inteligente da sessão (Marco 2 do motor pedagógico). Decisão do Eng. SRS + Linguista |
| `dashboard/js/core/soundFx.js` | P | Sons do player de cursos gerados na hora com Web Audio (sem arquivos): um clique curto de tecla e tons curtos de feedback. Implementação própria. |
| `dashboard/js/core/statsEngine.js` | P | Agregações PURAS para a tela de Estatísticas (Onda 2.1). |
| `dashboard/js/core/tts.js` | M | Áudio natural (Google TTS) com cache em IndexedDB + download do MP3. |
| `dashboard/js/core/videoContext.js` | P | Contexto de vídeo salvo pela extensão. Só YouTube recebe embed: demais plataformas podem bloquear iframes (DRM) e devem abrir no ponto salvo. |
| `dashboard/js/core/videoWordStats.js` | P | Palavras salvas a partir de vídeos (#399). O Cofre já agenda revisão para elas; aqui só medimos quantas vieram de vídeo e quantas já fixaram, para o aluno ver que o há… |
| `dashboard/js/core/ytPlayer.js` | M | Player único de trechos. A fronteira start/end é controlada por uma única máquina de estados local; o iframe não é recarregado a cada repetição. |

### Dashboard PWA — telas (`dashboard/js/ui/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `dashboard/js/ui/activityHeatmap.js` | P | mapa de calor anual (segunda a domingo), navegável por teclado. Usado em Progresso e na Análise dos Cursos. |
| `dashboard/js/ui/adminView.js` | M | Casca do console administrativo (#408): porta de acesso (papel + PIN), abas acessíveis e carga preguiçosa de cada aba. A autoridade é do servidor; aqui só se esconde o… |
| `dashboard/js/ui/cefrPlacementTest.js` | M | Teste de nível (CEFR): roda a prova de nivelamento e entrega o nível estimado ao chamador. |
| `dashboard/js/ui/coursePracticeView.js` | G | Player de prática (modo foco): ouvir a frase e digitá-la palavra por palavra. |
| `dashboard/js/ui/coursePrepareModal.js` | P | Diálogo antes da prática: modo (fácil / médio / difícil) e configurações. |
| `dashboard/js/ui/coursesView.js` | P | Área de Cursos: navegação própria (Início, Meus cursos, Loja, cadernos, Análise, Ranking) e a página de cada curso. Dados vindos do banco; sem conteúdo de demonstração. |
| `dashboard/js/ui/firstSteps.js` | P | Primeiros passos da tela Hoje (#427): para quem ainda não salvou nenhuma palavra, o caminho é o mesmo da promessa do produto — entender o que você assiste e salvar a p… |
| `dashboard/js/ui/fluencyCheckView.js` | G | Tela da Checagem de Fluência: passos, envio das respostas, estados de carregamento/erro e adaptador de dados. |
| `dashboard/js/ui/homeView.js` | GG ⚠ | Tela Início: próximo passo do dia, palavras difíceis, horas de estudo, conquistas e avisos. |
| `dashboard/js/ui/homeViewStyles.js` | M | Estilos da tela Início, injetados uma vez no <head> pela homeView. |
| `dashboard/js/ui/leaguesView.js` | M | Tela de Ligas: liga atual, ranking da semana e os 5 que avançam. |
| `dashboard/js/ui/learnView.js` | P | Tela Aprender: escolhe entre histórias no seu nível, o Leitor de textos e aprender com vídeo (YouTube e Max). |
| `dashboard/js/ui/libraryView.js` | G | Tela Cofre: palavras e frases salvas por baralho ou por palavra, busca, revisão por tema e preenchimento do contexto que falta. |
| `dashboard/js/ui/libraryViewStyles.js` | M | Estilos da tela Cofre, injetados uma vez no <head> pela libraryView. |
| `dashboard/js/ui/loginView.js` | M | Tela de login e cadastro (entrar ou criar conta). |
| `dashboard/js/ui/progressView.js` | M | Progresso = estatísticas de todo o sistema (vídeo, leitura, revisões FSRS, cursos, histórias e escuta) a partir de uma única RPC (rpc_system_stats). |
| `dashboard/js/ui/readerView.js` | G | Modo Leitor estilo LingQ. |
| `dashboard/js/ui/readingHub.js` | P | Cabeçalho comum de Leitura (Histórias guiadas × Meus textos), compartilhado pelas duas telas. |
| `dashboard/js/ui/reportProblem.js` | P | "Ajuda e relatos" nas Configurações (#412): o usuário descreve um bug, sugestão, abuso ou falha de segurança. O servidor valida, limita a 5 por dia e deduplica; aqui h… |
| `dashboard/js/ui/settingsView.js` | GG ⚠ | Tela Configurações: nível aproximado, limites diários, motor de memória (FSRS) e perfis de SRS, áudio, lembretes e e-mail, dados e portabilidade, ajuda e relatos, cont… |
| `dashboard/js/ui/statsView.js` | M | Onda 2.1 (Gerente+Eng. SRS): tela de Estatísticas, paridade com o "Stats" do Anki. Consome dados REAIS do Supabase (cards, review_log, sessions) através de statsEngine… |
| `dashboard/js/ui/storiesQuiz.js` | M | Quiz das histórias: valida as perguntas devolvidas pela IA (3 a 5, com 4 opções), gera o quiz e o desenha na tela. |
| `dashboard/js/ui/storiesView.js` | GG ⚠ | Tela Histórias: gera e lê histórias por nível, formato de livro, tradução no hover, quiz e relatório. |
| `dashboard/js/ui/storiesViewStyles.js` | P | Estilos da tela Histórias, injetados uma vez no <head> pela storiesView. |
| `dashboard/js/ui/storyReport.js` | P | "Reportar problema nesta história" (#435): histórias são geradas por IA e ninguém as revisa antes de chegarem ao aluno; este atalho leva o aluno a apontar o problema n… |
| `dashboard/js/ui/studyView.js` | GG ⚠ | Tela Estudar (revisão FSRS): fila de cards, 4 formas de revisar, avaliação idempotente, desfazer, áudio e sessão. |
| `dashboard/js/ui/studyViewStyles.js` | M | Estilos da tela Estudar (revisão FSRS), injetados uma vez no <head> pela studyView. |
| `dashboard/js/ui/systemNotice.js` | P | Faixa de aviso global definida em Admin > Sistema (#408). Falha em silêncio: aviso nunca bloqueia o estudo. |
| `dashboard/js/ui/viewState.js` | P | Estados padrão de tela (carregando, vazio, erro, sucesso) e escape de HTML para as views. |

### Dashboard PWA — telas de Cursos (`dashboard/js/ui/courses/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `dashboard/js/ui/courses/courseAnalysis.js` | P | Análise de aprendizado dos Cursos. |
| `dashboard/js/ui/courses/courseHome.js` | M | Início dos Cursos: continuar, semana, revisão do dia, tempo e recentes. |
| `dashboard/js/ui/courses/courseLeaderboard.js` | P | Ranking dos Cursos por tempo ativo de estudo (UTC). |
| `dashboard/js/ui/courses/courseNotebooks.js` | M | Cadernos: revisão espaçada, erros, vocabulário e notas. Tudo gratuito. |
| `dashboard/js/ui/courses/courseStore.js` | M | Loja, Meus cursos e página do curso (capítulos). |
| `dashboard/js/ui/courses/courseUi.js` | P | peças compartilhadas pelas seções de Cursos. |

### Dashboard PWA — console administrativo (`dashboard/js/ui/admin/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `dashboard/js/ui/admin/adminAudit.js` | P | Aba "Auditoria": trilha append-only de toda ação administrativa de escrita. |
| `dashboard/js/ui/admin/adminBackups.js` | P | Backups restaurá­veis (7 dias) criados antes de resets. Usado pela aba Backups e pelo detalhe do usuário. |
| `dashboard/js/ui/admin/adminDanger.js` | P | Aba "Zona de perigo": reset global por escopo. Sem backup; exige PIN recente e frase validada no servidor. |
| `dashboard/js/ui/admin/adminOverview.js` | P | Aba "Visão geral": saúde do sistema em uma tela — crescimento, atividade, erros, IA e pendências. |
| `dashboard/js/ui/admin/adminReports.js` | P | Aba "Relatos": triagem dos relatos de usuários (novo → em análise → resolvido/descartado) com nota interna. |
| `dashboard/js/ui/admin/adminResetDialog.js` | P | Reset granular de dados de um usuário: escolher escopos -> dry-run (contagens) -> confirmar digitando o e-mail. |
| `dashboard/js/ui/admin/adminSecurity.js` | M | Aba "Segurança": checagens ao vivo do banco, relatórios de acesso e a lista do que só pode ser ligado nos painéis da Vercel/Supabase (o app não consegue configurar fir… |
| `dashboard/js/ui/admin/adminShared.js` | M | Utilitários compartilhados do console administrativo (#408): formatação, diálogos acessíveis, estados assíncronos e metadados de escopos/ações. Sem acesso a dados: que… |
| `dashboard/js/ui/admin/adminSystem.js` | M | Aba "Sistema": aviso global, erros do cliente, uso de IA e equipe administrativa. |
| `dashboard/js/ui/admin/adminUserDetail.js` | M | Diálogo de gestão de um usuário: fatos, volumes por tabela, backups, trilha e ações (conforme o papel). |
| `dashboard/js/ui/admin/adminUsers.js` | P | Aba "Usuários": busca no servidor, filtros e paginação; a gestão individual abre no diálogo de detalhe. |

### Dashboard PWA — casca, estilos e service worker

| Arquivo | Porte | Para que serve |
|---|---|---|
| `dashboard/css/admin.css` | P | Console administrativo (#408). Carregado sob demanda por dashboard/js/ui/admin/adminShared.js. |
| `dashboard/css/course-player.css` | G | LinguaFlow — Player de Prática Palavra por Palavra (Fullscreen / Modo Foco) Arquivo: dashboard/css/course-player.css Diretriz: Foco imersivo total, latência zero, feed… |
| `dashboard/css/course-system.css` | G | LinguaFlow — Subsistema de Cursos Autônomo & Design System Arquivo: dashboard/css/course-system.css Diretriz: "Menos é mais", visual editorial premium, tipografia limp… |
| `dashboard/css/editorial.css` | M | Issue #114 — shared editorial direction. Scoped specificity intentionally wins over legacy view-injected styles; data and scheduling stay untouched. |
| `dashboard/css/globals.css` | GG ⚠ | Estilos globais do dashboard: tokens de cor e tipografia, navegação, movimento de rotas e componentes compartilhados. |
| `dashboard/dashboard.html` | P | Casca da PWA: manifest, fontes, estilos globais e o módulo do app (js/core/app.js). |
| `dashboard/manifest.webmanifest` | P | Manifest da PWA do dashboard (nome, ícones, cores, escopo). |
| `dashboard/sw.js` | P | Service Worker do Web App (Vercel) — estudo offline Estratégias: app shell pré-cacheado; network-first para código; navegação network-first com fallback pro shell; Sup… |

### Código compartilhado (`utils/`) — usado pela extensão e pelo dashboard

| Arquivo | Porte | Para que serve |
|---|---|---|
| `utils/ai-stream.js` | M | streaming de IA entre service worker e content scripts. |
| `utils/caption-casing.js` | M | Normalização inteligente de caixa e maiúsculas/minúsculas em legendas. |
| `utils/caption-grouping.js` | P | Agrupa eventos de legenda em frases do tamanho da tela e casa traduções por tempo, sem alterar palavras nem horários. |
| `utils/cefr-wordlist.json` | P | Nível CEFR (A1…C2) de cada palavra em inglês; base do perfil lexical e da dificuldade dos textos. |
| `utils/context-chunks.js` | P | Estrutura compartilhada para manter o trecho original e a unidade aprendida no mesmo card sem misturar isso com exemplos genéricos de IA. |
| `utils/db.js` | M | Banco único do LinguaFlow (Cloud-Only) Integração 100% direta com Supabase via REST API (sem IndexedDB local) |
| `utils/dom-events.js` | P | Utilitários de eventos DOM e proteção contra conflito de teclado |
| `utils/exclusive-playback.js` | P | Coordena recursos de áudio assíncronos. Uma geração antiga nunca pode recuperar o controle depois que uma reprodução mais nova começou. |
| `utils/expression-detector.js` | M | Detecção única de expressões na fala (legenda, roteiro, aba Palavras e popup), com posições no texto. Tipos: - phrasal: phrasal verb idiomático, inclusive separado ("t… |
| `utils/expressions-db.js` | M | Banco de dados massivo de phrasal verbs e expressões (baseado em análise competitiva) |
| `utils/frequency-en.json` | P | Posição de frequência de cada palavra em inglês (1 = mais comum). |
| `utils/html.js` | P | Escape de HTML para qualquer texto de fora (legendas, IA, web) antes de entrar no DOM. |
| `utils/install-methods.js` | P | Instala em uma classe os métodos que moram em módulos por assunto (motor de legendas, popup de palavra etc.). |
| `utils/ipa-validator.js` | P | Validação estrita de IPA (International Phonetic Alphabet) Elimina terminantemente pronúncia abrasileirada, respellings em português e aproximações ortográficas. |
| `utils/lemma.js` | P | lematizador leve de regras para inglês. |
| `utils/lexical-profile.js` | M | Motor de auditoria lexical e densidade de novidade (i+1). |
| `utils/local-day.js` | P | Datas de atividade são dias de calendário do aluno, não do servidor UTC. |
| `utils/observability.js` | P | Observabilidade neutra de fornecedor: eventos, erros e spans com redação de dados sensíveis, emitidos como evento do navegador. |
| `utils/offline-dict.js` | P | Cache do dicionário em IndexedDB para consultas repetidas e uso offline. |
| `utils/phrasal-verbs.js` | P | Base de phrasal verbs (significado e exemplo) usada para marcar e explicar expressões. |
| `utils/schema.js` | P | utils/schema.js Utilitários defensivos para sanitização e validação de schemas em bordas: - Respostas de LLMs (JSON truncado, markdown fences, chaves ausentes) |
| `utils/site-boundary.js` | P | Fronteira de sites: identifica o site oficial do LinguaFlow para a extensão não agir nele. |
| `utils/slangs-db.js` | P | Base de gírias e formas coloquiais, com regras que dependem do contexto da frase. |
| `utils/speech-cadence.js` | M | Análise de cadência e fenômenos de fala conectada (Connected Speech). |
| `utils/story-variety.js` | M | variedade obrigatória na geração de histórias. |
| `utils/translation-quality.js` | P | Detecta tradução ruim (vazamento da frase original) para não mostrar nem salvar. |
| `utils/translator.js` | M | Tradutor: cache em memória/local/banco, provedores externos, proxy via extensão e controle de qualidade. |
| `utils/tts.js` | M | Voz do LinguaFlow na extensão: áudio do dicionário, voz neural, Google Tradutor e voz do navegador, nessa ordem. |
| `utils/video-utils.js` | P | LinguaFlow Video Utilities Shared logic for timestamp generation and time formatting |
| `utils/weak-card.js` | P | Fonte única de "palavra fraca" (#338), usada pelo site e pela extensão: Home, sessão de reforço, fila de estudo, modo de recuperação e reencontro nas histórias. O leec… |
| `utils/word-senses.js` | P | Traduções de uma palavra agrupadas por classe gramatical (verbo, substantivo…), a partir do dicionário que o Google devolve junto com a tradução (dt=bd). Mesma fonte d… |

### Camada de dados por domínio (`utils/db/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `utils/db/account.js` | P | Conta e engajamento: estatísticas do usuário, ranking, push, e-mail, cache de tradução e conquistas. |
| `utils/db/admin.js` | M | Painel de administração: papéis, PIN, usuários, backups, auditoria, avisos do sistema e denúncias. |
| `utils/db/cards.js` | M | Cards: fila de estudo, devidos de hoje, enterrar, suspender, restaurar e resetar. |
| `utils/db/courses-repo.js` | M | Repositório do domínio de Cursos (escuta + digitação) Conteúdo vem das tabelas course_*; progresso, erros, revisões e sessões só mudam por RPC. Leituras lançam erro pa… |
| `utils/db/gamification-repo.js` | P | Repositório especializado em Gamificação, Ligas, Telemetria e Web Push Submódulo modular extraído de utils/db.js (Cloud-Only / Supabase) |
| `utils/db/learning.js` | M | Tarefas de aprendizagem e checagem de fluência: perfis adaptativos, envio, avaliação e rascunho. |
| `utils/db/reader-stories-repo.js` | M | Repositório especializado em Histórias e Web Reader Submódulo modular extraído de utils/db.js (Cloud-Only / Supabase) |
| `utils/db/shared.js` | P | Constantes e funções puras compartilhadas pelo banco (db.js) e pelos seus módulos por assunto. |
| `utils/db/srs-constants.js` | P | Parâmetros do agendamento: chaves de SRS por categoria e os pesos default do FSRS-4.5. |
| `utils/db/srs.js` | M | Agendamento: configurações de SRS, perfis por categoria, FSRS-4.5, previsão e registro/desfazer de revisão. |
| `utils/db/stats-repo.js` | P | Estatísticas de todo o sistema (página Progresso). |
| `utils/db/study.js` | M | Estatísticas e tempo de estudo: histórico, streak, sessões, estudo manual, fila de listening e resumo do painel. |
| `utils/db/words.js` | G | Palavras, frases, histórias, textos do leitor, palavras conhecidas/ignoradas, tags e léxico canônico. |

### Backend — Edge Functions (`supabase/functions/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `supabase/config.toml` | P | Configuração do Supabase: autenticação, pool de conexões e `verify_jwt` das Edge Functions. |
| `supabase/functions/deepseek-chat/index.ts` | M | deepseek-chat — proxy seguro de IA do LinguaFlow (Fase 2) Chave DeepSeek vive APENAS em Supabase Secrets (DEEPSEEK_API_KEY). |
| `supabase/functions/email-reengagement/index.ts` | P | email-reengagement — chamado exclusivamente pelo pg_cron (Onda 3.4). |
| `supabase/functions/fluency-assessment/index.ts` | M | Edge Function da Checagem de Fluência: avalia a resposta com IA segundo a rubrica e grava o resultado por RPC do servidor. |
| `supabase/functions/push-reminder/index.ts` | P | push-reminder — chamado exclusivamente pelo pg_cron. |
| `supabase/functions/tts/edge_tts.ts` | M | Síntese de voz neural da Microsoft (Edge TTS) via WebSocket. |
| `supabase/functions/tts/index.ts` | M | tts — proxy autenticado de áudio (Google Translate TTS) O navegador não consegue fazer fetch() do translate_tts (CORS); este proxy busca o MP3 no servidor e devolve co… |
| `supabase/functions/url-import/index.ts` | M | url-import — proxy seguro de importação de URL pro Leitor (Onda 3.1) Por que existir: o navegador não consegue fazer fetch cross-origin de qualquer site (CORS) — o ser… |

### Conteúdo editorial dos cursos (`supabase/content/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `supabase/content/courses.mjs` | M | Conteúdo original dos cursos (fonte da migration de seed gerada por scripts/generate-course-seed.mjs). Cada frase: texto, tradução pt-BR natural, nota de uso e grupos … |
| `supabase/content/images.mjs` | M | Imagens das palavras dos cursos de vocabulário (#443). Fonte única: este mapa gera a migration de imagens (scripts/generate-course-images.mjs). |
| `supabase/content/lexicon.mjs` | M | Léxico dos cursos: palavra → [classe, IPA (inglês americano, forma de citação), glosa pt-BR no sentido usado nas frases]. |

### Automação (`scripts/` e `.github/workflows/`)

| Arquivo | Porte | Para que serve |
|---|---|---|
| `.github/workflows/codeql.yml` | P | CodeQL |
| `.github/workflows/production-rls.yml` | P | Production RLS Monitor |
| `.github/workflows/release.yml` | M | Build and Release |
| `.github/workflows/supabase-keep-alive.yml` | P | Supabase Keep Alive |
| `scripts/content-check.mjs` | P | Verificador editorial dos cursos (Issue #428): valida TODOS os lotes de conteúdo sem escrever nada e confere se o SQL gerado ainda é igual ao que foi publicado em supa… |
| `scripts/content-review-sample.mjs` | P | Amostra para revisão humana do conteúdo dos cursos (Issue #435). |
| `scripts/generate-course-images.mjs` | P | Gera a migration de imagens das palavras a partir de supabase/content/images.mjs (#443). |
| `scripts/generate-course-seed.mjs` | M | Gera migrations de conteúdo dos cursos a partir de supabase/content/. |
| `scripts/generate-project-map.mjs` | M | Gera o inventário de docs/MAPA_DO_PROJETO.md a partir dos arquivos rastreados pelo git. |
| `scripts/package-extension.mjs` | P | LinguaFlow - Script de Empacotamento de Produção da Extensão Chrome Gera dist/linguaflow-extension-v<version>.zip pronto para a Chrome Web Store. |
| `scripts/replay-migrations-local.ps1` | P | Reproduz as migrations em uma pilha Supabase LOCAL e descartável. |
| `scripts/verificar.ps1` | P | Verificação local oficial do LinguaFlow para Windows. |
| `scripts/wiring-audit.js` | M | Auditoria de FIAÇÃO do LinguaFlow — prova mecânica de desconexão. |

### Grupos resumidos

| Grupo | Quantidade | Observação |
|---|---|---|
| `supabase/migrations/` | 129 | Migrations SQL append-only, ordenadas por data no nome (`AAAAMMDDHHMMSS_assunto.sql`). Primeira: `00000000000000_baseline_schema.sql`. Última: `20261004200000_usage_events_smart_captions.sql`. Nunca edite uma migration já aplicada. |
| `supabase/content/batches/` | 48 | Lotes editoriais dos cursos (palavras, frases, parágrafos, histórias). Validados por `npm run content:check`. |
| `tests/*.test.mjs` | 185 | Testes unitários e de contrato (Node). Nome do arquivo = assunto testado. |
| `tests/e2e/` | 4 | Playwright: carrega a extensão num Chromium real com páginas-fixture. |
| `tests/db/` | 15 | SQL e scripts que reproduzem as migrations num Postgres efêmero e testam RPCs/RLS. |
| `tests/production/` | 1 | Verificação de isolamento entre contas no Supabase de produção (workflow agendado). |
| `docs/*.md` | 6 | Documentação viva; histórico em `docs/history/`, produto em `docs/product/`. |
| imagens e mídia | 37 | Ícones da extensão e do PWA, logo e vídeo de fixture dos testes. |

<!-- mapa:fim -->

---

## 15. Estado do projeto e limitações conhecidas

Declarado com honestidade, para quem herda o projeto:

- **Sem QA automatizada nos sites reais.** Max, Netflix, Disney+ e Prime só têm testes de contrato e fixtures; o comportamento real
  (seletores do menu de legenda da Max, tela cheia, anúncios) exige teste manual no navegador.
- **Lint só no CI.** O Biome e o Knip rodam no GitHub Actions; em alguns ambientes de desenvolvimento o binário do Biome não executa.
- **Arquivos grandes.** Os de porte `GG ⚠` no inventário concentram muita responsabilidade; a divisão segue o padrão
  "mover e reexportar" para não mudar comportamento.
- **Deploy do backend é manual.** Migrations e Edge Functions não têm pipeline no repositório.
- **Fontes externas.** O dashboard e o painel da extensão carregam fontes do Google Fonts; o dashboard pode baixar o modelo
  de voz local (Kokoro) de uma CDN sob demanda, ao ativar a voz local nas configurações.
- Histórico de estados anteriores: `docs/history/`.
