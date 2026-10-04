<div align="center">

# 🌐 LinguaFlow

**Plataforma open-source para aquisição e consolidação do inglês através de imersão contextual, repetição espaçada avançada (FSRS v4.5), leitura guiada e inteligência artificial pedagógica.**

[![Release](https://img.shields.io/github/v/release/cascaoconcurseiro/linguaflow?style=flat-square&color=blue&label=release)](https://github.com/cascaoconcurseiro/linguaflow/releases)
[![CI](https://github.com/cascaoconcurseiro/linguaflow/actions/workflows/release.yml/badge.svg)](https://github.com/cascaoconcurseiro/linguaflow/actions/workflows/release.yml)
[![FSRS](https://img.shields.io/badge/algorithm-FSRS%20v4.5-orange.svg?style=flat-square)](https://github.com/open-spaced-repetition/fsrs4anki)
[![Supabase](https://img.shields.io/badge/backend-Supabase%20%7C%20PostgreSQL-3ECF8E.svg?style=flat-square&logo=supabase)](https://supabase.com)
[![Chrome MV3](https://img.shields.io/badge/extension-Manifest%20V3-yellow.svg?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![PWA Live](https://img.shields.io/badge/demo-linguaflow--web.vercel.app-000000.svg?style=flat-square&logo=vercel)](https://linguaflow-web-tau.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg?style=flat-square)](LICENSE)

[🚀 Acessar Web App](https://linguaflow-web-tau.vercel.app) · [🗺️ Mapa do Projeto](docs/MAPA_DO_PROJETO.md) · [📖 Documentação](docs/INDICE.md) · [🐛 Reportar Problema](https://github.com/cascaoconcurseiro/linguaflow/issues)

</div>

---

## 📌 Visão Geral

O **LinguaFlow** une o consumo de conteúdo autêntico na web (filmes, séries, vídeos e textos) com ciência cognitiva de memorização de longo prazo. A plataforma é composta por:

1. **Extensão Chrome (Manifest V3)**: Captura em tempo real legendas de streaming (YouTube, Netflix, Max, Disney+, Prime Video), oferece popups de mineração instantânea de termos/phrasal verbs e leitor flutuante.
2. **Dashboard PWA (Vercel)**: Aplicação web progressiva para gestão do vocabulário, sessões de estudo com FSRS v4.5, estante de leitura persistida, histórias geradas por IA e telemetria de estudo.
3. **Backend Serverless (Supabase)**: Banco de dados relacional com 100% de Row Level Security (RLS), transações atômicas com locks pessimistas (`FOR UPDATE`), sincronização offline-first e Edge Functions.

---

## ✨ Principais Funcionalidades

### 🎬 Imersão com Vídeos e Streaming
- **Legendas Interativas**: Interceptação e tokenização de legendas em tempo real.
- **Mineração em 1 Clique**: Clique em qualquer palavra ou phrasal verb para pausar o vídeo, ver tradução contextual, pronúncia fonética e salvar com a frase real do vídeo.
- **Barra Lateral com Pré-carga**: Carregamento da trilha de legendas e tradução antecipada com controle de concorrência.
- **Atalhos Rápidos** (tecla `?` mostra todos): navegue entre falas (`A`/`D`), repita a frase (`S`), laço A–B (`B`), ajuste a sincronia da legenda (`Z`/`X`), escuta primeiro (`V`) e escolha palavras só com o teclado (`F`).
- **Começa desligado**: o LinguaFlow só aparece quando você liga o botão LF (ou a tecla `C`); desligado, o player fica como o original.

### 🧠 Algoritmo FSRS v4.5 (Free Spaced Repetition Scheduler)
- **Cálculo Server-Authoritative**: O estado de retenção, estabilidade ($S$) e dificuldade ($D$) é calculado exclusivamente no banco por RPCs atômicas com lock `FOR UPDATE`.
- **4 Formas de Revisar o mesmo cartão**: clássico (frase com a palavra escondida), montar a frase, ditado e inverso (português → inglês). A forma muda com o nível do aluno e em rotação; cartões que empacam ganham recuperação adaptativa.
- **Reset Seguro**: Possibilidade de reiniciar cards específicos para o estado `new` sem corromper o histórico estatístico.

### 📚 Leitor Web & Estante Persistida
- Importação direta de artigos, transcrições e textos em inglês.
- Dicionário em linha com análise de expressões idiomáticas e phrasal verbs.
- Sincronização automática com a tabela `reader_texts` no Supabase com isolamento total por usuário.

### 📖 Histórias Geradas por IA
- Criação de contos adaptados ao nível CEFR do usuário (A1 a B2) utilizando exatamente as palavras do seu cofre pessoal.
- Formato livro imersivo com tradução instantânea no hover.

### 🏆 Gamificação com Integridade Pedagógica
- Sistema contábil de XP em ledger append-only server-side.
- Ofensiva (Streak) diária com proteção de fuso horário.
- Ligas competitivas (Bronze, Prata, Ouro, Safira, Diamante).
- Limites competitivos saudáveis: o cap diário limita a pontuação na liga, mas **nunca bloqueia o aprendizado livre**.

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA CLIENTE                         │
├──────────────────────────────┬──────────────────────────────┤
│    Extensão Chrome (MV3)     │      Dashboard PWA           │
│  - Captura de Legendas       │  - Gestão de Vocabulário     │
│  - Injeção em Streaming      │  - Sessões FSRS (4 modos)    │
│  - Popup de Mineração        │  - Web Reader                │
│  - Cache chrome.storage      │  - Histórias e Gamificação   │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               │ HTTPS (REST / RPC)           │ HTTPS (REST / RPC)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  CAMADA BACKEND (SUPABASE)                  │
├─────────────────────────────────────────────────────────────┤
│  - Supabase Auth: JWT, RBAC, isolamento por usuário         │
│  - PostgreSQL: schema relacional com RLS em 100%            │
│  - RPCs atômicas (PL/pgSQL com locks transacionais):        │
│    • record_card_review (lock FOR UPDATE)                   │
│    • save_word_with_card (palavra e card, mesma transação)  │
│    • log_study_time (agregação multicanal atômica)          │
│    • commit_fluency_assessment (perfil de proficiência)     │
│  - Supabase Edge Functions (Deno Runtime):                  │
│    • deepseek-chat (proxy de IA; chave só no Supabase)      │
│    • tts (áudio neural) e url-import (URL para o Leitor)    │
│    • fluency-assessment (avalia a Checagem de Fluência)     │
│    • push-reminder e email-reengagement (via pg_cron)       │
└─────────────────────────────────────────────────────────────┘
```

> Mais detalhes na especificação técnica completa em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ (recomendado 20+)
- Google Chrome (para a extensão)

### 1. Clonar e Instalar
```bash
git clone https://github.com/cascaoconcurseiro/linguaflow.git
cd linguaflow
npm install
```

### 2. Rodar a Suíte de Testes
```bash
npm test
```

### 3. Carregar a Extensão no Chrome
1. Acesse `chrome://extensions` no Google Chrome.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta raiz deste repositório (`linguaflow`).

### 4. Rodar o Dashboard PWA Localmente
O dashboard é construído em JavaScript nativo (módulos ES), sem necessidade de transpiladores:
```bash
npx serve dashboard
# ou abra dashboard/index.html diretamente com uma extensão Live Server
```
Ou acesse a versão em produção: [linguaflow-web-tau.vercel.app](https://linguaflow-web-tau.vercel.app).

---

## 🧪 Qualidade e Testes

A integridade do sistema é garantida por mais de 80 suítes de teste nativos (`node --test`), cobrindo:
- Motor FSRS v4.5 e transições de estado
- Isolamento de dados e contratos de RLS
- Sincronização offline-first e resiliência de filas
- Injeção em players de streaming e ciclo de vida de legendas
- Imutabilidade do ledger contábil de XP e proteção contra farming

```bash
# Executa todos os testes e o release smoke gate
npm test

# Testes de domínios específicos
npm run test:fsrs         # Agendador FSRS v4.5 e integridade matemática
npm run test:ext          # Extensão Chrome e motores de streaming
npm run test:ui           # Interface, navegação e acessibilidade
npm run test:db           # Contratos de banco e Row Level Security
```

---

## 🔒 Segurança e Privacidade

- **RLS em 100% das Tabelas**: Nenhuma tabela com dados de usuário permite acesso público; todo SELECT, INSERT, UPDATE e DELETE exige `auth.uid() = user_id`.
- **Credenciais Seguras**: Chaves privadas de API residem exclusivamente nas variáveis de ambiente seguras do Supabase Edge Functions.
- **Sessões Isoladas**: A extensão (`chrome.storage.local`) e a PWA (`localStorage`) operam sessões independentes. Nenhum token de autenticação trafega por URLs.
- **Zero Captura de Voz**: O sistema não armazena nem transmite áudio ou gravações do usuário.

Consulte nossa política completa em [SECURITY.md](SECURITY.md).

---

## 📚 Documentação Técnica e Comunidade

- 📘 **[Comece Aqui](docs/COMECE_AQUI.md)** — Guia rápido para desenvolvedores e setup.
- 🏛️ **[Arquitetura Técnica](docs/ARQUITETURA.md)** — Fonte de verdade, fluxos de dados, segurança e ADRs.
- 📜 **[Contrato Pedagógico](docs/CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md)** — Regras de XP, caps competitivos e integridade FSRS.
- 🗂️ **[Índice Geral](docs/INDICE.md)** — Mapa de toda a documentação ativa e histórico arquivado.
- 🤝 **[Guia de Contribuição](CONTRIBUTING.md)** — Convenções de código, branches e envio de PRs.
- 🛡️ **[Política de Segurança](SECURITY.md)** — Diretrizes de proteção de dados e reporte responsável.
- 📝 **[Changelog](CHANGELOG.md)** — Histórico completo de versões.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte [`LICENSE`](LICENSE) para mais detalhes.
