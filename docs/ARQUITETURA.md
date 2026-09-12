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
│    • submit_review_fsrs (lock FOR UPDATE)                   │
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
5. Cliente dispara RPC `submit_review_fsrs(card_id, rating, review_duration)`.
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
3. **Isolamento de Credenciais**: Chaves de API de terceiros (OpenAI, Gemini) residem exclusivamente nas variáveis de ambiente seguras do Supabase Edge Functions, nunca expostas nos bundles dos clientes.
