# Handoff — LinguaFlow

## Última sessão

**Data:** 2026-09-21

**O que foi feito:**

- Criada a Issue #89 e a branch `codex/89-multimodal-study-hours` para o controle total de horas de estudo por idioma.
- Criada a migration append-only `supabase/migrations/20260921160000_multimodal_study_and_language_tracking.sql`:
  - Adicionado suporte a `language` na tabela `public.sessions` com chave única `(user_id, date, source, language)`.
  - Ampliadas as fontes válidas de estudo para habilidades manuais (`manual_reading`, `manual_speaking`, `manual_listening`, `manual_writing`).
  - Atualizada a RPC `public.log_study_time` para aceitar `p_language` com fallback seguro para chamadas legadas.
  - Criada a RPC `public.log_manual_study` para registro manual seguro e auditável de horas de estudo externo.
  - Adicionada coluna `response_time_ms` em `public.review_log`.
- No player da extensão (`content/subtitle-engine.js`):
  - Passado `this.sourceLang` nos heartbeats de `db.logSession(10, this.platform, this.sourceLang || 'en')` para computar horas de listening específicas do idioma do vídeo.
- No popup da extensão (`popup/popup.html`, `popup/popup.js`):
  - Criado widget moderno e minimalista ("Menos é mais"): badge do idioma (`🇺🇸 Inglês`), listening hoje e acumulado (`45 min hoje • Total: 104h`), cards pendentes e ofensiva real.
- Na biblioteca de dados (`utils/db.js`):
  - Implementados `getStudyStats(language)`, `formatStudyTime(seconds)` e `logManualStudy()`.
  - Adicionadas permissões no `DB_PROXY_METHODS` do service worker.
- No Dashboard (`dashboard/js/ui/homeView.js`, `dashboard/css/globals.css`):
  - Adicionado card "Horas de Estudo" com breakdown por habilidade (Listening, Cards, Leitura, Speaking) no idioma ativo.
  - Implementado modal de registro rápido de estudo externo (+15m, +30m, +45m, +1h) com feedback em toast.
- Na tela de Flashcards (`dashboard/js/ui/studyView.js`):
  - Adicionado badge de cronômetro ao vivo (`⏱️ 00:00`) no cabeçalho de estudo (`#anki-card-timer` / `#card-live-timer`), cronometrando os segundos de cada card em tempo real.
  - Adicionada métrica de tempo médio de resposta / hesitação e coluna de tempo por revisão no modal "Info (I)" do card.
- Na agregação de estudo (`utils/db.js`):
  - Restringido o cálculo de listening estritamente para `video` e `manual_listening` (removido `extension` geral para não inflar tempo ocioso).
- Cache Busting do PWA:
  - Bump de versão para `v3.0.47` em `sw.js`, `app.js`, `dashboard.html`, `package.json` e `manifest.json`, forçando o navegador a invalidar caches locais e renderizar imediatamente a interface atualizada.
- Integrado o guia canônico de Anti-padrões de IA e Metodologia Sênior em `AGENTS.md` (anti-padrões visuais, UX, animação, produto gerado por IA, engenharia e perguntas obrigatórias de cada feature).
- Sincronização dos switches do player Max/YouTube (Issue #87, PR #88) incorporada e validada.
- Criado teste de contrato TDD `tests/multimodal-study-hours.test.mjs`, suíte 100% verde sem regressões.

## Próximo passo

**Arquivo:** Pull Request para `main`

**Ação:** Merge do PR com a versão `v3.0.47` e validação no navegador e Vercel.

## Bloqueios

- QA autenticada no navegador ainda não foi executada.
- Schema/RLS remoto, Edge Functions e observabilidade real continuam sem validação completa.

