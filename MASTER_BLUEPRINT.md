# Master Blueprint — LinguaFlow

## Visão geral
Extensão de navegador (Manifest V3) para aprendizado de idiomas via legenda de vídeo (estilo Anki + Duolingo + LingQ), com um Web App companheiro deployado na Vercel a partir da mesma pasta `dashboard/` (via rewrites em `vercel.json`), compartilhando dados e sessão com a extensão.

## Stack
- Extensão: JavaScript vanilla, Manifest V3 (Service Worker + content scripts)
- Dashboard: JavaScript vanilla (módulos ES), HTML/CSS, deploy Vercel
- Banco/Auth: Supabase (Postgres via REST API + Supabase Auth), acesso direto do cliente com `anon key`
- IA: DeepSeek (`deepseek-chat`), proxied (ou deveria ser) via Supabase Edge Function `supabase/functions/deepseek-chat`
- Tradução: Google Translate GTX + fallback MyMemory + dicionário offline local (100% client-side, sem chave)
- Dicionário: `api.dictionaryapi.dev` (público, sem chave)

## Estrutura de diretórios (relevante)
```
/
├── background/service-worker.js     — hub central: auth, proxy de DB, chamadas de IA
├── content/
│   ├── index.js                     — bootstrap do content script
│   ├── subtitle-engine.js           — legenda + tradução inline
│   ├── word-popup.js                — popup de palavra clicada (dicionário + IA contextual)
│   └── settings-panel.js            — painel de configurações in-page
├── dashboard/                       — Web App (também servido via Vercel)
│   ├── js/core/app.js                — router/bootstrap
│   ├── js/core/ai.js                 — chama Edge Function deepseek-chat (hoje sem callers — código morto)
│   ├── js/core/tts.js
│   └── js/ui/{homeView,studyView,settingsView,loginView,storiesView}.js
├── utils/
│   ├── db.js                        — módulo único de acesso a dados (Supabase REST), usado por extensão E dashboard
│   ├── translator.js                — tradução client-side
│   └── tts.js
├── supabase/functions/deepseek-chat/index.ts  — Edge Function proxy de IA (existe, mas subutilizada — ver Decisões)
└── manifest.json
```

## Decisões de arquitetura

| Data | Decisão | Motivo |
|------|---------|--------|
| 2026-07-08 | `utils/db.js` é a única fonte de acesso a dados, tanto para content scripts quanto para todas as views do dashboard. Não criar caminho paralelo. | Confirmado por leitura de todos os imports — evita divergência entre extensão e site. |
| 2026-07-08 | Padrão de proxy interno (`isProxyMode` em `utils/db.js`) roteia chamadas de páginas de extensão via `chrome.runtime.sendMessage` pro Service Worker, que é quem detém o token de verdade e faz o fetch real. | Evita problemas de CSP em páginas de extensão e centraliza o token num só lugar. Não reescrever do zero. |
| 2026-07-08 | Sessão Supabase (`lf_supabase_session`) fica em `chrome.storage.local` **e** `localStorage` simultaneamente. | Extensão e site-na-Vercel compartilham a mesma sessão de fato, desde que ela não expire (ver bug de refresh abaixo). |
| 2026-07-08 | Refresh de token (`refresh_token` + `expires_at`) é PRIORIDADE MÁXIMA, fase isolada antes de qualquer outra coisa. `login()`/`signUp()` em `utils/db.js` hoje salvam só `access_token` — sessão expira em 3600s e quebra tudo autenticado silenciosamente. Já existe fallback de logout automático em 401 (`_fetch()`), mas não substitui o refresh proativo. | Causa raiz mais provável dos sintomas de "desincroniza"/"some depois de um tempo" relatados pelo usuário. |
| 2026-07-08 | Sistema de **decks foi removido intencionalmente** de `utils/db.js` (`getAllDecks`, `createDeck`, `getOrCreateDeck`, `getDeckStats`, `deleteDeck`) — **cards substituem decks**, conforme decisão explícita do usuário. Remoção ficou incompleta: `bulkUpdateDeck()` e `utils/cloud-sync.js` (que chama `db.getAllDecks()`, método inexistente) ainda referenciam o conceito antigo. | Terminar a remoção faz parte da Fase 1 (limpeza). Não recriar decks. |
| 2026-07-08 | IA contextual (clique na palavra) vai migrar de **BYOK direto pro DeepSeek** (`api.deepseek.com` com chave do usuário em `chrome.storage.local.aiApiKey`) para **Edge Function `deepseek-chat` com chave compartilhada server-side**, mantendo BYOK como override opcional. | Modelo atual não escala: exigir que cada usuário tenha a própria chave DeepSeek inviabiliza crescimento de base. Language Reactor e apps freemium equivalentes usam chave única no servidor + auth real + rate-limit por usuário — infraestrutura (`supabase/functions/deepseek-chat/index.ts`, já lê `DEEPSEEK_API_KEY` de Supabase Secrets) já existe, só não está conectada ao fluxo real. Requer Fase 0 (refresh de token) completa antes, senão sessão expirada quebraria a IA contextual pior do que hoje. |
| 2026-07-08 | Tradução de legenda e dicionário de palavra clicada são 100% client-side, sem token, sem proxy — nunca devem depender de sessão Supabase. | São as únicas duas features que devem seguir funcionando mesmo com sessão expirada/deslogado. |
| 2026-07-09 | SRS usa **FSRS-4.5** (algoritmo do Anki moderno) em `_calculateNextState`, com learning steps para cards novos e retenção desejada configurável (`lf_srs_retention`, default 0.9). SM-2 aposentado; `ease_factor` mantido só por compatibilidade de schema. Cards antigos são semeados a partir do intervalo SM-2. | ~20-30% menos revisões pra mesma retenção; colunas stability/difficulty já existiam no schema. Não voltar pro SM-2. |
| 2026-07-09 | TTS de áudio natural: blob cacheado em IndexedDB (chave `lang\|texto`), com download de MP3. Web usa Edge Function `tts` (proxy autenticado do Google TTS, rate-limit 60/min); extensão segue via service worker FETCH_TTS. Voz robótica (Web Speech) é último fallback apenas. | Navegador não consegue fetch() do translate_tts por CORS; <audio> direto não permite cache/download. Padrão de segurança idêntico ao deepseek-chat. |

## Regras do projeto
- Nenhuma API key/segredo compartilhado pode aparecer em código de cliente (extensão, popup, content script, frontend web). `SUPABASE_ANON_KEY` é exceção por design do Supabase (chave pública). `DEEPSEEK_API_KEY` **nunca** pode ir para o cliente — vive só em Supabase Secrets, usada pela Edge Function.
- Toda função de backend que recebe requisição autenticada precisa validar o JWT de verdade (`supabase.auth.getUser(token)`), nunca só checar se o header existe.
- Não inventar assinatura de função ou estrutura de tabela do Supabase sem verificar o código real ou pedir para rodar uma query.
- Política "tudo gratuito": nenhuma feature essencial deve exigir pagamento do usuário (ver memória `feedback_tudo_gratuito`).
- Push sempre para `main` ao final de um ciclo de trabalho — nunca deixar código só em branch de feature (ver memória `feedback_git_decisions`).
