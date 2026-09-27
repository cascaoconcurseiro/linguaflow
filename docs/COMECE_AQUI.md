# Comece Aqui — Guia do Desenvolvedor

Instruções para inicialização rápida no ecossistema LinguaFlow (Extensão Chrome + Dashboard PWA).

---

## 1. Documentação de Referência

1. **[Arquitetura Técnica](ARQUITETURA.md)** — Princípios de fonte da verdade, diagrama do sistema e ADRs.
2. **[Contrato Pedagógico e Economia](CONTRATO_PEDAGOGICO_ECONOMIA_P0_2_2026-07-14.md)** — Regras de pontuação, integridade FSRS e caps diários.
3. **[README Principal](../README.md)** — Visão geral do produto, requisitos e comandos de execução.
4. **[Changelog](../CHANGELOG.md)** — Histórico de releases e entregas.
5. **[Índice Geral](INDICE.md)** — Mapa de todos os documentos ativos e histórico arquivado.

---

## 2. Estrutura do Projeto

| Diretório | Responsabilidade |
|---|---|
| `content/` | Scripts injetados em páginas de streaming (YouTube, Netflix, Max) e Web Reader. |
| `background/` | Service Worker MV3 da extensão, filas de sincronização e proxy de dados. |
| `dashboard/` | Aplicação Web Progressiva (PWA) servida pela Vercel (módulos ES nativos). |
| `utils/` | Utilitários compartilhados: banco (`db.js`), validadores fonéticos IPA, algoritmos linguísticos. |
| `supabase/` | Migrations SQL append-only e Edge Functions em Deno. |
| `tests/` | Bateria de testes de release, contratos de banco e ponta a ponta. |

---

## 3. Regras de Engenharia

- **Preservação de Integridade**: Toda alteração funcional passa por teste automatizado (`npm run test:release`).
- **Schema Append-Only**: O banco de produção opera com migrations versionadas cronologicamente; nunca altere migrações passadas.
- **Autoridade Server-Side**: O Supabase PostgreSQL com Row Level Security (RLS) é a única autoridade; o cliente web ou extensão nunca calcula transições FSRS nem grava dados diretamente sem passar pelas RPCs seguras.
- **Higienização Estrita**: Todo conteúdo de IA ou da web inserido na interface deve ser devidamente escapado contra XSS.
