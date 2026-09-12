# Estado Atual do Sistema — LinguaFlow

**Data:** 12 de Setembro de 2026  
**Versão:** 3.0.46  
**Status do Repositório:** Estável, auditado, suíte de testes 100% verde  
**Branch Principal:** `main`

---

## 1. Visão Geral do Produto

O **LinguaFlow** é uma plataforma completa de aquisição e consolidação do idioma inglês através de imersão contextual, repetição espaçada avançada (FSRS v4.5), leitura guiada e inteligência artificial pedagógica.

O ecossistema é composto por:
1. **Extensão Chrome (Manifest V3)**: Captura de legendas de vídeo em tempo real (YouTube, Netflix, HBO Max), popups de dicionário instantâneo, mineração de frases em 1 clique e leitor de artigos web.
2. **Dashboard PWA (Vercel / Vanilla JS)**: Gestão de vocabulário, sessões de revisão FSRS com múltiplos modos (Flashcard, Digitação, Áudio, Speed Review), leitor com tradução em linha, estante de leitura persistida, gerador de histórias personalizadas por IA, sistema de gamificação (XP, Ofensiva, Ligas, Conquistas) e telemetria de estudo.
3. **Backend Serverless (Supabase)**: Banco de dados PostgreSQL com RLS estrito em todas as tabelas, funções RPC atômicas com transações ACID e lock pessimista (`FOR UPDATE`), autenticação Supabase Auth e Edge Functions para IA (Google Gemini / OpenAI).

---

## 2. Métricas do Projeto

| Métrica | Valor |
| --- | --- |
| **Commits** | 332+ |
| **Pull Requests** | 62 mergeados |
| **Testes Automatizados** | 80 arquivos de teste (Node.js native test runner) |
| **Status dos Testes** | 100% passando (`npm run test:release`) |
| **Migrações Supabase** | 50 arquivos SQL versionados (`supabase/migrations/`) |
| **Cobertura de Domínios** | FSRS, Gamificação, Auth, Sync, IA, Audio, Dict, Video Ingestion |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTES (FRONTEND)                    │
├──────────────────────────────┬──────────────────────────────┤
│    Extensão Chrome (MV3)     │      Dashboard PWA (Vercel)  │
│  - background/service_worker │  - index.html + styles       │
│  - content/ (YT, Netflix,    │  - js/core/ (db, auth, FSRS, │
│    HBO Max, floating popup)  │    sync, session, telemetry) │
│  - popup/ (status, stats)    │  - js/ui/ (views, modals,    │
│  - options/ (configurações)  │    themes, audio, gestures)  │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               │ HTTPS / WSS                  │ HTTPS / WSS
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (BACKEND)                      │
├─────────────────────────────────────────────────────────────┤
│  - Supabase Auth (JWT, sessões independentes)               │
│  - PostgreSQL com RLS estrito (todas as tabelas)            │
│  - RPCs Atômicas:                                           │
│    • submit_review_fsrs (FSRS v4.5 com lock FOR UPDATE)     │
│    • log_study_time (telemetria multicanal com lock)        │
│    • commit_fluency_assessment (motor de proficiência)      │
│    • sync_pull / sync_push (reconciliação offline-first)    │
│    • check_and_award_achievements (gamificação)             │
│  - Edge Functions (Deno):                                   │
│    • ai-explainer (análise de contexto com Gemini/OpenAI)   │
│    • ai-story (geração de histórias baseadas em vocabulário)│
│    • ai-chat (tutor de conversação contextual)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Domínios e Funcionalidades

### 4.1. Algoritmo de Repetição Espaçada (FSRS v4.5)
- Implementação rigorosa do Free Spaced Repetition Scheduler v4.5.
- Estados do card: `new`, `learning`, `review`, `relearning`.
- Avaliações: `again` (1), `hard` (2), `good` (3), `easy` (4).
- Retenção alvo configurável (default: 0.9 / 90%).
- Função de reset de card para `new` preservando histórico estatístico.
- Concorrência protegida no banco com `SELECT ... FOR UPDATE`.

### 4.2. Dicionário e Análise Contextual
- Suporte a palavras isoladas e **Phrasal Verbs** compostos (ex.: "face off", "give up").
- Resolução inteligente de definições: Free Dictionary API para termos simples; pipeline resiliente de fallback imediato para phrasal verbs sem timeout bloqueante.
- Tradução contextual alimentada por IA (Edge Function `ai-explainer`) ou fallback MyMemory.
- Pronúncia em áudio: Web Speech API com seleção de vozes nativas (US/UK) e fallback de sintetizador.

### 4.3. Video Learning (Extensão Chrome)
- Injeção em players de streaming: YouTube, Netflix, HBO Max.
- Captura contínua de legendas com sincronização temporal.
- Subtitle overlay com palavras clicáveis: clique pausa o vídeo, abre o popup com tradução, definição fonética e botão de salvar com frase contextual.
- Atalhos de teclado (A/D para navegar legendas, S para repetir, barra de espaço para alternar).

### 4.4. Web Reader & Estante
- Importação de textos livres, transcrições e artigos da web.
- Tradução e mineração de vocabulário direto no texto.
- Persistência na tabela `reader_texts` com RLS por usuário.
- Telemetria de tempo de leitura via `log_study_time`.

### 4.5. Gamificação e Economia
- Cálculo de XP por revisões, leituras e vídeos assistidos.
- Sistema de Ofensiva (Streak) diária com proteção de fuso horário.
- Ligas competitivas (Bronze, Prata, Ouro, Safira, Diamante).
- Conquistas desbloqueáveis automáticas via banco de dados.

### 4.6. Telemetria e Auditoria
- Registro unificado de tempo de estudo em `study_time_logs`.
- Métricas segregadas por canal: `extension`, `pwa`, `video`, `review`, `reader`.
- Tabela de auditoria de consistência de banco (`db_audit_telemetry`).
- Totalizadores agregados e seguros contra contagens simultâneas.

---

## 5. Estrutura do Banco de Dados (Supabase)

### Principais Tabelas
| Tabela | Descrição | RLS |
| --- | --- | --- |
| `cards` | Vocabulário, frases, estado FSRS (`s`, `d`, `r`, `due_date`, `state`) | ✅ Habilitado |
| `review_log` | Histórico detalhado de cada resposta FSRS para análise | ✅ Habilitado |
| `user_stats` | XP acumulado, streak, liga atual, nível estimado | ✅ Habilitado |
| `reader_texts` | Textos salvos pelo usuário para leitura guiada | ✅ Habilitado |
| `study_time_logs` | Sessões de estudo atômicas com origem (`source`) | ✅ Habilitado |
| `stories` | Histórias geradas por IA para consolidação | ✅ Habilitado |
| `settings` | Preferências pedagógicas e de interface do usuário | ✅ Habilitado |
| `fluency_skill_profiles` | Perfil de competência linguística por domínio | ✅ Habilitado |
| `db_audit_telemetry` | Auditoria de telemetria e integridade relacional | ✅ Habilitado |

### Políticas de Segurança (RLS)
- Padrão uniforme: `auth.uid() = user_id` para SELECT, INSERT, UPDATE, DELETE.
- Zero uso de `USING (true)` em tabelas com dados de usuário.
- RPCs executadas com `SECURITY DEFINER` onde estritamente necessário para transações entre tabelas, validando explicitamente `auth.uid()`.

---

## 6. Histórico de Migrações (50 migrações)

As migrações em `supabase/migrations/` cobrem toda a evolução do sistema, desde o schema inicial até:
- `20260718_*.sql`: Consolidação do modelo FSRS e fontes de verdade.
- `20260725_*.sql`: Suporte a textos do Reader e migração idempotente.
- `20260801_*.sql`: RLS avançado e logs de estudo atômicos (`log_study_time`).
- `20260905_*.sql`: Otimizações de índice e queries analíticas.
- `20260912_*.sql`: Tabela de auditoria de integridade (`db_audit_telemetry`) e hardening relacional.

---

## 7. Suíte de Testes

Os testes são executados nativamente pelo Node.js (`node --test`):
```bash
npm run test:release
```
Abrangência dos testes:
- Contratos de ambiente e cross-platform (`tests/cross-platform-environment-contract.test.mjs`)
- Agendador FSRS v4.5 e transições de estado (`tests/fsrs-engine.test.mjs`)
- Dicionário e manipulação de phrasal verbs (`tests/dictionary-service.test.mjs`, `tests/phrasal-verbs.test.mjs`)
- Player de vídeo e overlays de legenda (`tests/video-player-overlay.test.mjs`, `tests/max-player-ui.test.mjs`)
- Sincronização offline e resolução de conflitos (`tests/sync-offline-engine.test.mjs`)
- Gamificação e progressão de XP (`tests/gamification-engine.test.mjs`)

---

## 8. Correções Críticas Recentes (Setembro 2026)

1. **Bug do Phrasal Verbs no Popup e Cards (v3.0.46)**:
   - Termos compostos (ex.: "face off", "look up") causavam travamento infinito em `(Carregando dicionário...)` porque a API externa não tem entradas de endpoint simples para locuções verbais.
   - Solução: Detecção prévia de termos com espaço ou compostos, pulando a chamada falha e indo direto para a tradução contextual e análise pedagógica imediata, com timeout reduzido de 7s para 3s.
2. **Hardening de Banco e Auditoria (v3.0.46 / PR #61)**:
   - Criação da tabela `db_audit_telemetry` com índices otimizados e RLS.
   - Métodos de telemetria no cliente `db.js` para monitoramento contínuo de anomalias relacionais.
3. **Reset de Card para Novo (v3.0.45)**:
   - Implementado botão e método para resetar card ao estado `new`, permitindo ao usuário recomeçar o aprendizado de vocabulário específico sem corromper as estatísticas globais de revisão.
4. **Auto-scroll de Legendas em Vídeo (v3.0.45)**:
   - Correção do scroll automático da transcrição lateral durante a reprodução no YouTube e HBO Max.
