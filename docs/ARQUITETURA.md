# Arquitetura Técnica do Sistema — LinguaFlow

## 1. Visão Geral da Arquitetura

O LinguaFlow é estruturado como um sistema híbrido distribuído, operando com duas frentes de cliente e uma camada unificada de persistência e computação em nuvem:

```
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA CLIENTE                         │
├──────────────────────────────┬──────────────────────────────┤
│    Extensão Chrome (MV3)     │      Dashboard PWA           │
│  - Captura de Legendas       │  - Gestão de Vocabulário     │
│  - Injeção em Streaming      │  - Sessões FSRS (4 modos)    │
│  - Popup de Mineração        │  - Web Reader                │
│  - Atalhos Globais           │  - Gerador de Histórias      │
│  - Cache chrome.storage      │  - Gamificação e Perfil      │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               │ HTTPS (REST / RPC)           │ HTTPS (REST / RPC)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  CAMADA BACKEND (SUPABASE)                  │
├─────────────────────────────────────────────────────────────┤
│  - Supabase Auth: JWT, RBAC, isolamento por usuário         │
│  - PostgreSQL 15: Schema relacional com RLS em 100%         │
│  - RPCs Atômicas (PL/pgSQL com locks transacionais):        │
│    • record_card_review (lock FOR UPDATE)                   │
│    • log_study_time (agregação multicanal atômica)          │
│    • sync_pull / sync_push (reconciliação offline)          │
│    • commit_fluency_assessment (perfil de proficiência)     │
│  - Supabase Edge Functions (Deno Runtime):                  │
│    • ai-explainer (Gemini Flash / OpenAI GPT-4o-mini)       │
│    • ai-story (gerador de histórias personalizadas)         │
│    • ai-chat (assistente de conversação guiada)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Princípios de Dados e Fonte de Verdade

### Regra Fundamental
O **Supabase PostgreSQL** é a **única fonte da verdade** para todos os dados de conta, vocabulário, histórico de revisões e progresso pedagógico. Cópias locais (seja em `chrome.storage.local` na extensão ou `localStorage`/`IndexedDB` no Dashboard PWA) são exclusivamente caches de leitura descartáveis ou buffers temporários de escrita offline.

Nenhuma escrita local tem autoridade para sobrescrever o servidor sem reconciliação explícita baseada em timestamps (`updated_at`).

### Tabela de Autoridade por Domínio

| Domínio | Fonte de Verdade | Cache / Uso Local |
| --- | --- | --- |
| **Sessão Autenticada** | Supabase Auth (JWT) | Refresh token persistido para reabertura de sessão. Sessões da Extensão e PWA são independentes (nunca passam token via URL). |
| **Palavras, Frases e Cards** | Tabela `cards` (Postgres) | Cache local indexado e fila de sincronização offline. |
| **Revisões e FSRS** | Tabela `review_log` e RPCs | Estado em memória da sessão ativa; commit imediato via RPC atômica com lock `FOR UPDATE`. |
| **XP, Streak e Ligas** | Tabela `user_stats` e eventos | Cache de exibição na UI; recálculo garantido no servidor. |
| **Estatísticas de Estudo** | `study_time_logs`, `review_log` | Invalidação ao focar na aba; soma calculada por RPC agregadora. |
| **Textos do Web Reader** | Tabela `reader_texts` | Cache local contingente; textos importados são persistidos antes de confirmação na UI. |
| **Histórias Salvas** | Tabela `stories` | Histórias geradas por IA gravadas no banco; espelho local para leitura offline. |
| **Configurações Pedagógicas** | Tabela `settings` | Formulário reativo sincronizado com debounce no banco. |
| **Perfil de Fluência** | `fluency_skill_profiles` | Calculado exclusivamente pela RPC autoritativa `commit_fluency_assessment`. |
| **Preferências Visuais** | Dispositivo / Navegador | Tema (Dark/Light), fontes, preferências de visualização de legendas. |
| **Dicionário e Traduções** | Provedores externos + Edge Functions | Cache com TTL local para evitar chamadas de rede redundantes. |

---

## 3. Fluxos de Dados Principais

### 3.1. Mineração de Palavras no Vídeo (Extensão)
1. Content script monitora o player (YouTube / Netflix / HBO Max) via `MutationObserver` ou API do player.
2. Legenda é parseada em tokens clicáveis.
3. Ao clicar num token, o vídeo pausa automaticamente.
4. Extensão consulta o cache local de dicionário; se ausente, aciona Edge Function `ai-explainer` ou fallback.
5. Ao clicar em "Salvar", um registro é enviado para a tabela `cards` via Supabase Client autenticado, associando a frase contextual e timestamp do vídeo.

### 3.2. Ciclo de Revisão FSRS (Dashboard PWA)
1. Ao iniciar sessão, o cliente invoca a query de cards vencidos (`due_date <= NOW()`).
2. Cartão é apresentado em um dos 4 modos (Flashcard, Digitação, Áudio, Speed Review).
3. O usuário classifica a retenção (`Again`, `Hard`, `Good`, `Easy`).
4. Algoritmo FSRS v4.5 calcula novos valores de Estabilidade ($S$), Dificuldade ($D$) e próxima data de vencimento ($I$).
5. Cliente dispara RPC `record_card_review(card_id, rating, review_duration)` (autoridade server-side FSRS).
6. O banco adquire lock de linha (`SELECT ... FOR UPDATE`), grava o `review_log`, atualiza o card e soma o XP correspondente numa única transação atômica.

### 3.3. Telemetria de Estudo Multicanal
1. Sessões ativas de estudo disparam batimentos cardíacos ou flush no desmonte via `log_study_time`.
2. A RPC recebe os segundos estudados e o canal de origem:
   - `extension`: navegação com overlay ativo
   - `video`: tempo líquido com player rodando e legendas ativas
   - `review`: tempo focado na tela de resolução de cards
   - `reader`: leitura ativa com rolagem e interação de vocabulário
3. O servidor soma ao log diário do usuário com proteção de concorrência.

---

## 4. O que NÃO Deve Ir ao Banco como Verdade

Para manter o banco limpo, escalável e com custo controlado, os seguintes estados transitórios **nunca** são persistidos no PostgreSQL:
- Posição momentânea de scroll da página ou leitor.
- Estado de menus abertos, drawers ou modais.
- URLs temporárias de arquivos de legenda blob.
- Cache de consultas externas de dicionário (salvo em localStorage com TTL).
- Locks de mutex de abas cruzadas (`BroadcastChannel`).
- Áudio em buffer de sintetizador e progresso de reprodução milissegundo a milissegundo.

---

## 5. Diretrizes de Segurança e Resiliência

1. **Row Level Security (RLS)**: Cada consulta ou mutação é delimitada por `auth.uid() = user_id`.
2. **Offline-First Gratuito**: O cliente suporta quedas temporárias de rede enfileirando revisões em fila local (`sessionQueue.js`), drenando atomicamente assim que a conexão é restaurada.
3. **Isolamento de Credenciais**: Chaves de API de terceiros (OpenAI, Gemini, DeepSeek) residem exclusivamente nas variáveis de ambiente seguras do Supabase Edge Functions, nunca expostas nos bundles dos clientes.

---

## 6. Registro de Decisões de Arquitetura (ADR Sintético)

| Data | Decisão | Racional / Impacto |
|---|---|---|
| **2026-10-03** | **Funil de uso sem dados pessoais (#426)**: `usage_events` guarda só (usuário, evento, plataforma, dia) com lista fechada de eventos e plataformas e chave primária que torna a gravação idempotente (no máximo 4 eventos × 6 plataformas por dia). Ninguém lê ou escreve direto (RLS sem policies, sem grants): grava-se por `log_usage_event` (só `authenticated`) e lê-se por `admin_usage_funnel` (PIN/papel de admin). Não registra URL, título, texto nem conteúdo de vídeo. Só mede usuários logados. | Responde "o app ajuda?" (abrir player → ligar LF → salvar → revisar) sem criar PII nova nem cardinalidade livre. Rollback: dropar as duas funções e a tabela; nada depende delas. |
| **2026-10-03** | **Central de segurança e relatos (#412)**: `user_reports` só é gravada pela RPC `submit_user_report` (login obrigatório, 10–2000 caracteres, 5/dia, deduplicação em 10 min) e lida pelo próprio autor via RLS; a triagem e o relatório `admin_security_overview` passam por RPCs admin auditadas. Bloqueio por país/IP **não** foi implementado no app: a API do Supabase é acessada direto do navegador e escapa do firewall da Vercel, e a trava rígida por país bloquearia brasileiros no exterior e a extensão; a recomendação é *challenge* no Firewall da Vercel (configuração manual). | Entrega visibilidade e triagem sem inventar controles que o app não consegue impor. IP aparece só ao admin (LGPD) e não é gravado em tabela nova. |
| **2026-10-03** | **Console administrativo com papéis, auditoria e backup (#408)**: papéis `admin` (escrita) e `support` (leitura) em `admin_users.role`; toda RPC admin valida sessão por PIN e papel no servidor; ações de escrita gravam em `admin_audit_log` (append-only, imutável por trigger); reset de dados é granular por escopo, com dry-run e backup restaurável por 7 dias (`admin_backups`); reset global exige PIN recente (<5 min) e frase validada no servidor, sem backup. | Um "limpar deck" que deixava XP e cursos era enganoso e irreversível. Auditoria, dry-run e desfazer tornam a ação segura; suspensão (`auth.users.banned_until`) é a alternativa reversível à exclusão. Limite: sessão já aberta de um suspenso vale até ~1 h; backup em jsonb vai até 250 mil linhas por operação. |
| **2026-09-29** | **Palavras ignoradas em tabela própria (`ignored_words`)**: "Ignorar" no card grava em tabela separada, com RLS por usuário e só SELECT/INSERT/DELETE para `authenticated`. | Uma coluna em `known_words` obrigaria todos os consumidores de "conhecidas" (Home, Leitor, Histórias, CEFR) a filtrar; com tabela própria, ignorar nunca infla o progresso por esquecimento. |
| **2026-09-27** | **Síntese Neural Gratuita via Edge TTS**: a Edge Function `tts` utiliza Microsoft Edge TTS como motor primário com fallback transparente para Google TTS. | Elimina voz robótica do Google Tradutor sem gerar custos de API ou exigir cadastros com cartão, mantendo compatibilidade com o cache IndexedDB (`lf-audio-cache`). |
| **2026-09-26** | **Cache Léxico Canônico** (`canonical_lexicon`): cache compartilhado server-side de lemas, classes gramaticais e fonética IPA. | Reduz drasticamente chamadas redundantes a APIs externas e modelos de linguagem para vocábulos comuns. |
| **2026-09-24** | **Provedor de Listening**: distingue faixa de áudio selecionada (`audio_track`), confirmação do usuário (`user_confirmed`) e estimativa de legenda original (`caption_asr`). | Faixa de áudio selecionada prevalece; faixas ambíguas suspendem a estimativa para evitar falsos créditos de listening. |
| **2026-09-21** | **Foco em Aprendizagem Sem Mini-Jogos**: prática principal orientada a contexto, repetição FSRS e leitura guiada. Rota antiga redireciona para Aprender. | Evita dispersão com gamificação ornamental; preserva integridade pedagógica. |
| **2026-09-21** | **Preservação de Contexto em Chunks**: cards novos persistem no `ai_chunks` a ocorrência real como `is_context` e a unidade de aprendizado como `is_learning_unit`. | Impede que a tela trate exemplos genéricos artificiais como se fossem a frase real dita no vídeo. |
| **2026-09-12** | **Bypass de Dicionário Simples para Expressões**: expressões e phrasal verbs delegam direto para enriquecimento contextual com timeout estrito. | APIs comuns de dicionário não suportam termos multi-palavra e causavam travamentos. |
| **2026-09-09** | **Tradução via Service Worker na Extensão**: content scripts delegam tradução ao service worker via mensagens estruturadas. | Contorna restrições de CORS da página hospedeira sem abrir brechas de segurança. |
| **2026-09-07** | **FSRS Server-Authoritative**: transições de revisão são calculadas exclusivamente por RPC no Postgres com lock `FOR UPDATE`. | Impede adulteração de retenção, cálculo incorreto de estabilidade ou manipulação de contadores no cliente. |
| **2026-07-16** | **Integridade Contábil de XP**: XP competitivo vem de ledger append-only server-side; prática livre nunca altera a economia da liga. | Elimina farming e incentiva revisões consistentes e honestas. |

---

## 7. Invariantes de Engenharia do Sistema

1. **Escrita Segura**: Toda mutação possui tratamento de erro explícito; nenhuma escrita falha silenciosamente.
2. **Zero Segredos**: Chaves privadas, tokens de serviço e senhas residem exclusivamente em variáveis de ambiente protegidas no backend.
3. **Autoridade Server-Side**: RPCs e tabelas validam identidade (`auth.uid() = user_id`), limites de cota e constraints de integridade no banco.
4. **Idempotência**: Requisições de escrita e reconciliações utilizam identificadores imutáveis contra duplicações.
5. **Ciclo de Vida Limpo**: Ao desmontar uma tela ou trocar de card, todos os recursos (áudio, observadores, listeners globais e timers) são terminados.
6. **Higienização de Conteúdo**: Textos capturados na web, salvos ou gerados por IA são tratados como entrada não confiável e inseridos via propriedades de texto ou sanitizados rigorosamente antes de entrar no DOM.

