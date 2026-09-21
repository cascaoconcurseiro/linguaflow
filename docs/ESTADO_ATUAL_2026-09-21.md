# Estado Atual do Sistema — LinguaFlow

**Data:** 21 de Setembro de 2026  
**Versão:** 3.0.51  
**Status do Repositório:** Estável, auditado, suíte de testes 100% verde  
**Branch Principal:** `main`

---

## 1. Visão Geral do Produto

O **LinguaFlow** é uma plataforma de aquisição e consolidação do inglês por imersão contextual, repetição espaçada (FSRS v4.5), leitura guiada e IA pedagógica.

O ecossistema é composto por:

1. **Extensão Chrome (Manifest V3)**: Captura de legendas em tempo real (YouTube, Netflix, HBO Max), popup de dicionário instantâneo, mineração de frases em 1 clique e leitor de artigos web.
2. **Dashboard PWA (Vercel / Vanilla JS)**: Gestão de vocabulário, sessões FSRS (Flashcard, Digitação, Áudio, Speed Review), leitor com tradução em linha, estante persistida, gerador de histórias por IA, gamificação (XP, Ofensiva, Ligas, Conquistas) e telemetria multimodal de estudo.
3. **Backend Serverless (Supabase)**: PostgreSQL com RLS estrito em todas as tabelas, RPCs atômicas com lock `FOR UPDATE`, Supabase Auth e Edge Functions (Gemini/OpenAI).

---

## 2. Métricas do Projeto

| Métrica | Valor |
|---|---|
| **Versão** | 3.0.51 |
| **Commits** | 350+ |
| **Pull Requests mergeados** | 97 |
| **Testes Automatizados** | 80+ arquivos (Node.js native test runner) |
| **Status dos Testes** | ✅ 100% passando (`npm run test:release`) |
| **Migrations Supabase** | 55 arquivos SQL versionados |
| **Tabelas no banco** | 25+ com RLS ativo em todas |
| **RPCs no banco** | 29+ funções server-side |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTES (FRONTEND)                    │
├──────────────────────────────┬──────────────────────────────┤
│    Extensão Chrome (MV3)     │      Dashboard PWA (Vercel)  │
│  - background/service-worker │  - dashboard.html + sw.js    │
│  - content/ (YT, Netflix,    │  - js/core/ (db, tts, ai,   │
│    HBO Max, floating popup)  │    ytPlayer, sessionQueue,   │
│  - popup/ (status, stats)    │    adaptiveLearning, video)  │
│                              │  - js/ui/ (views por rota)   │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │ HTTPS                        │ HTTPS
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (BACKEND)                      │
├─────────────────────────────────────────────────────────────┤
│  - Supabase Auth (JWT + refresh token rotativo)             │
│  - PostgreSQL com RLS estrito (25+ tabelas, 0 USING(true))  │
│  - RPCs Atômicas (SECURITY DEFINER, search_path=''):        │
│    • record_card_review (FSRS v4.5 + lock FOR UPDATE)       │
│    • revert_card_review (undo com XP revertido)             │
│    • log_study_time (multimodal, com p_language)            │
│    • log_manual_study (habilidades manuais)                 │
│    • save_word_with_card (palavra + card em 1 transação)    │
│    • issue/submit/assess_fluency_task (motor de fluência)   │
│    • admin_verify_pin / admin_get_system_metrics            │
│    • record_card_learning_signal (aprendizado adaptativo)   │
│    • get_dashboard_summary (agregação server-side)          │
│  - Edge Functions (Deno):                                   │
│    • ai-explainer / ai-story / ai-chat / fluency-assessment │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Domínios e Funcionalidades

### 4.1. FSRS v4.5 (Algoritmo de Repetição Espaçada)

- Estados: `new` → `learning` → `review` → `mature` (com `suspended` e `buried`).
- Avaliações: `again(1)`, `hard(2)`, `good(3)`, `easy(4)`.
- Agendamento autoritativo no servidor (`record_card_review` com `FOR UPDATE`).
- Undo com reversão de XP (`revert_card_review`).
- Learning steps configuráveis por categoria de vocabulário.
- Reset de card para `new` sem apagar histórico estatístico.
- Teto do Cofre (`lf_vault_cap`): limite de cards ativos — excesso entra suspenso.

### 4.2. Estudo Adaptativo

- `card_adaptive_profiles`: perfil de recuperação por card (issue dominante, streak de acertos sem ajuda).
- `record_card_learning_signal`: sinalização de dificuldade específica durante o estudo.
- `deriveAdaptivePlan`: plano de sessão ajustado ao perfil do card.

### 4.3. Fluência e Avaliação

- Catálogo de tarefas em `private.fluency_task_catalog` (seed com tarefas A1–C2).
- Fluxo completo: `issue_fluency_task` → `submit_fluency_task` → `assessFluencySubmission` (Edge Function com IA).
- Perfis por habilidade em `fluency_skill_profiles`.
- Rascunho persistente no storage local (`lf_fluency_check_draft_v1`).

### 4.4. Telemetria Multimodal de Estudo

- `sessions` com coluna `language`: horas discriminadas por idioma estudado.
- Fontes: `video`, `review`, `reader`, `manual_reading`, `manual_speaking`, `manual_listening`, `manual_writing`, `extension`, `pwa`.
- `log_study_time` com heartbeat antiduplicata (crédito real de tempo).
- `log_manual_study` para registro manual de habilidades externas.
- `review_log.response_time_ms`: latência de resposta por card (telemetria de hesitação).

### 4.5. Gamificação

- XP via ledger auditável (`xp_ledger`) + `user_stats` com trigger de atualização.
- Ofensiva (streak) com proteção de fuso horário e `set_user_timezone`.
- Ligas competitivas com rollover semanal (`maybe_league_rollover`).
- Conquistas normalizadas em `user_achievements`.
- Questão semanal (`claim_weekly_quest`).

### 4.6. Segurança (auditada em 2026-09-21)

- Todos os inputs de dados do banco passam por `escapeHtml()` antes de `innerHTML`.
- `escapeHtml` centralizada em `viewState.js` — única fonte de verdade, sem duplicatas locais.
- `storiesView.js` usa `escapeHTML` de `utils/html.js` (implementação equivalente).
- RLS habilitado em 100% das tabelas; nenhuma policy `USING (true)` em dados de usuário.
- RPCs de admin protegidas por `admin_verify_pin` com sessão temporária e lockout.
- `0 npm audit vulnerabilities` (omitindo dev deps).

### 4.7. Video Learning

- Injeção em YouTube, Netflix, HBO Max.
- Captura contínua de legendas com sincronização temporal.
- Salvar palavra com frase contextual do vídeo em 1 clique.
- Heartbeat de listening por idioma do vídeo (`subtitle-engine.js` passa `sourceLang`).

### 4.8. Web Reader

- Importação de textos livres e artigos.
- Tradução e mineração de vocabulário direto no texto.
- Persistência em `reader_texts` com `last_read_position`, `reading_percentage`, `is_completed` (banco pronto, UI ainda não conectada).

---

## 5. Banco de Dados — Tabelas Principais

| Tabela | Descrição | RLS |
|---|---|---|
| `words` | Vocabulário salvo com metadados (CEFR, chunks, vídeo) | ✅ |
| `cards` | Estado FSRS por palavra (`status`, `due_date`, `stability`, `difficulty`) | ✅ |
| `review_log` | Histórico de revisões com `quality`, `ts`, `response_time_ms` | ✅ |
| `sessions` | Tempo de estudo por data/fonte/idioma | ✅ |
| `user_stats` | XP, streak, liga, timezone | ✅ |
| `settings` | Preferências pedagógicas (SRS, limites, overrides por categoria) | ✅ |
| `stories` | Histórias geradas por IA | ✅ |
| `reader_texts` | Textos do leitor com progresso | ✅ |
| `sentences` | Frases salvas pelo usuário | ✅ |
| `known_words` | Palavras marcadas como conhecidas | ✅ |
| `translation_cache` | Cache de traduções por usuário | ✅ |
| `fluency_skill_profiles` | Perfil de fluência por habilidade | ✅ |
| `fluency_task_issues/submissions` | Emissão e resposta de tarefas de fluência | ✅ |
| `learning_task_attempts` | Tentativas de tarefas de aprendizagem | ✅ |
| `card_adaptive_profiles` | Perfil adaptativo por card | ✅ |
| `card_learning_signals` | Sinais de dificuldade durante o estudo | ✅ |
| `xp_ledger` | Ledger auditável de XP | ✅ |
| `user_achievements` | Conquistas desbloqueadas | ✅ |
| `push_subscriptions` | Assinaturas de Web Push | ✅ |
| `media_watch_sessions` | Histórico de sessões de vídeo | ✅ |
| `client_errors` | Telemetria de erros do cliente | ✅ |
| `admin_users/sessions/config` | Autoridade administrativa | ✅ |

---

## 6. Migrations (55 arquivos)

As migrations cobrem toda a evolução desde o schema baseline até:

- `20260718_*.sql`: Sincronização do Reader e sessões atômicas.
- `20260722_*.sql`: Aprendizado adaptativo, deduplicação de heartbeats, quota de API atômica.
- `20260728_*.sql`: Tarefas de aprendizagem e motor de avaliação de fluência.
- `20260906_*.sql`: Limites diários autoritativos e undo snapshot de revisões.
- `20260907_*.sql`: FSRS server-authoritative (cálculo completo no Postgres).
- `20260908_*.sql`: Hardening do FSRS server-authoritative.
- `20260909_*.sql`: Notificações e idempotência adaptativa.
- `20260912_*.sql`: Hardening geral do banco (auditoria de segurança).
- `20260913_*.sql`: RPCs administrativas, sessão admin, lockout.
- `20260921_*.sql`: Suporte multimodal a idiomas em `sessions` + `response_time_ms` em `review_log`.

---

## 7. Suíte de Testes

```bash
npm run test:release   # gate completo (80+ arquivos)
npm run test:engine    # FSRS, SRS, achievements (40 testes)
npm run test:untrusted-content  # XSS, wiring, auditoria
npm run test:product-ux         # UX e acessibilidade
npm run test:pedagogy           # 19 contratos pedagógicos
npm run test:fluency            # motor de fluência
npm run test:adaptive           # aprendizado adaptativo
```

Status: **100% verde**.

---

## 8. Correções Críticas Recentes (Setembro 2026)

| Versão | Correção |
|---|---|
| 3.0.51 | XSS em `studyView.js`: `pt\|word` e `context` sem escape no `innerHTML` do cartão reverso e cloze |
| 3.0.51 | `escapeHtml` duplicada em `studyView.js` removida; import centralizado de `viewState.js` |
| 3.0.50 | Sanitização em cartões de explicação contextual; CORS de Edge Functions alinhado |
| 3.0.50 | Correção de cálculo de weekday com DST |
| 3.0.50 | Remoção de classes CSS mortas detectadas na auditoria de wiring |
| 3.0.49 | Eliminação de anti-padrões de design IA (gradientes, cards genéricos) |
| 3.0.49 | Micro-interações humanas: `pressed`, `hover` direcional, ripple, `prefers-reduced-motion` |
| 3.0.47 | Cronômetro ao vivo nos cards; telemetria de hesitação (`response_time_ms`) |
| 3.0.47 | Controle multimodal de horas de estudo por idioma; widget de listening no popup |

---

## 9. Pendências Conhecidas

| Item | Status |
|---|---|
| QA autenticada no navegador | ⏳ Não executada |
| Bug hover de Histórias (Issue #77) | ⏳ Causa raiz não confirmada sem navegador real |
| `updateReaderProgress` na UI | 📌 Banco pronto, UI sem entrada conectada |
| RLS real com dois usuários | ⏳ Validação de isolamento pendente |
| Export schema remoto completo | ⏳ Bloqueado por Docker/CLI ausente |
