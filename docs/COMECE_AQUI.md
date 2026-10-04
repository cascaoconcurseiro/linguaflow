# Comece Aqui — Guia do Desenvolvedor

Instruções para inicialização rápida no ecossistema LinguaFlow (Extensão Chrome + Dashboard PWA).

---

## 1. Documentação de Referência

0. **[Mapa do Projeto](MAPA_DO_PROJETO.md)** — Visão completa do sistema: peças, pastas, fluxos, segurança e onde mexer.
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

---

## 4. Testes em navegador real

Os testes `tests/e2e/*.spec.mjs` (Playwright) rodam na CI. Os de `player-*.spec.mjs` **carregam a extensão de verdade**
num Chromium e abrem páginas-fixture servidas nos domínios do YouTube/Netflix (nenhuma chamada sai para o site real):

- A legenda entra pelo mesmo caminho do player (`fetch` de `https://www.youtube.com/api/timedtext…` interceptado por
  `content/youtube-hook.js`); o vídeo é um clipe real (`tests/e2e/fixtures/lf-test.webm`). O endereço precisa ser
  **absoluto**, como no YouTube real.
- Fixture e página-modelo: `tests/e2e/extension-fixture.mjs`. Cada teste usa um navegador novo (fechar = sessão limpa).
- Local: `npx playwright test tests/e2e/player-shortcuts.spec.mjs`. Se a versão do Chromium instalada for outra, aponte
  o binário: `LF_CHROMIUM_PATH=/caminho/do/chrome npx playwright test …`.
- Isso **não** valida o layout dos sites reais (tela cheia, legendas reais, Disney+/Prime): continua exigindo QA manual.

Checagens complementares úteis: `npm run content:check` (conteúdo dos cursos) e `npm run content:review` (amostra para
revisão humana); o replay de migrations roda em `tests/db/validate-migrations.sh` (Postgres efêmero, não como root).
