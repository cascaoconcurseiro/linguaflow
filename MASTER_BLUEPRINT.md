# Master Blueprint — LinguaFlow

## Visão geral

Extensão Chrome MV3 e PWA para transformar conteúdo real em compreensão,
memória de longo prazo e uso comunicativo verificável. O produto preserva o
contexto da captura, agenda recuperação com FSRS e mantém avaliação
comunicativa separada de atividade, competição e memória.

Estado vigente: [`docs/ESTADO_ATUAL_2026-07-29.md`](docs/ESTADO_ATUAL_2026-07-29.md).

## Stack

- Extensão: JavaScript vanilla, Manifest V3, Service Worker e content scripts.
- PWA: módulos ES nativos, HTML/CSS, Service Worker, Vercel.
- Dados/Auth: Supabase Auth, Postgres 17, RLS, REST e RPCs estreitas.
- Backend: Supabase Edge Functions para IA, TTS, fluência, Push, e-mail e URL.
- Testes: Node, contratos de código/SQL e replay PostgreSQL efêmero.

## Estrutura

```text
/
├── background/                 # hub da extensão e proxy de dados
├── content/                    # legendas, popup, Reader e overlays
├── dashboard/                  # PWA, rotas e experiências de aprendizagem
├── popup/                      # login/status e entrada da extensão
├── utils/                      # dados, TTS, tradução e contratos compartilhados
├── supabase/
│   ├── functions/              # seis Edge Functions
│   └── migrations/             # histórico append-only
├── tests/                      # regressões, contratos e gates SQL
└── docs/                       # estado, contratos e histórico
```

## Domínios e autoridade

| Domínio | Autoridade | Não pode significar |
|---|---|---|
| Memória | cards + RPCs de revisão + FSRS | fluência ou domínio global |
| Atividade | sessões/eventos | retenção ou competência |
| Competição | ledger e projeções server-side | qualidade linguística |
| Prática livre | resultado local/telemetria não competitiva | XP, streak ou mudança de FSRS |
| Fluência | tarefas inéditas + avaliação server/humana | certificado oficial |
| Dados pessoais | Supabase owner-only | cache local como segunda verdade |

## Decisões de arquitetura

| Data | Decisão | Motivo |
|---|---|---|
| 2026-09-05 | A Home abre diretamente, sem onboarding obrigatório. Preferências anteriores são opcionais para renderizar; ausência ou falha usa meta local de 20 revisões, sem atribuir nível nem gravar conclusão fictícia. Placement permanece nas configurações. | O primeiro acesso deve permitir uso imediato; falhas de personalização não podem bloquear a entrada. |
| 2026-09-04 | DeepSeek `deepseek-chat`, acessado exclusivamente pelas Edge Functions autenticadas, é o único provedor de IA. Cada chamada resolve o JWT para `user.id`, consome cota individual e não persiste nem permite cache compartilhado de prompts/respostas. Não há fallback para outro modelo, captura de voz do aluno nem payload de gravação. | Mantém um único fornecedor, isola a IA por usuário e elimina do produto o tratamento de voz do aluno. |
| 2026-07-29 | Tradução contextual é o valor canônico quando há frase; tradução isolada é fallback provisório. | Palavras polissêmicas não têm um sentido correto fora do contexto. |
| 2026-07-29 | A fundação de fluência está tecnicamente integrada, mas não pode ser chamada de avaliação oficial nem evidência de eficácia até calibração humana e validação longitudinal. | Contratos de software não estabelecem validade psicométrica ou resultado educacional. |
| 2026-07-28 | Evidência comunicativa vive separada de FSRS, XP, ofensiva, missões e liga. | Retenção e atividade não demonstram transferência. |
| 2026-07-25 | Supabase canônico: `qnutoswrufznztoznlql`; não aplicar roadmap antigo de soft-delete ou `supabase db push` mecanicamente. | O schema vivo e as RPCs atuais têm semântica específica e histórico divergente. |
| 2026-07-18 | Supabase é fonte de verdade de conteúdo/progresso; local é cache, preferência do dispositivo ou contingência. | Evita duas verdades entre extensão, PWA e dispositivos. |
| 2026-07-16 | XP competitivo só vem de evidência qualificada e server-side; prática livre não altera economia. | Impede farming e incentiva resposta honesta. |
| 2026-07-09 | Dashboard completo vive no site; extensão concentra captura, contexto e revisão rápida. | Reduz divergência de CSP e superfícies duplicadas. |
| 2026-07-09 | Site e extensão usam a mesma conta, mas sessões independentes por origem. | `localStorage` e `chrome.storage.local` não são compartilhados. |
| 2026-07-09 | FSRS-4.5 é o agendador atual; `ease_factor` permanece apenas por compatibilidade. | Preserva cards legados e retenção configurável. |
| 2026-07-09 | TTS: cache → caminho natural server-side/direto → Web Speech como último fallback. | Continuidade sem apresentar voz robótica como caminho principal. |
| 2026-07-08 | `utils/db.js` é a única fronteira de dados; páginas de extensão usam proxy `DB_CALL`. | Centraliza token, erros e contratos entre PWA e extensão. |
| 2026-07-08 | Tradução básica e dicionário não dependem da sessão Supabase. | O núcleo de compreensão deve degradar quando o login expirar. |

## Contratos que não podem regredir

1. Escrita nunca falha silenciosamente.
2. Segredo compartilhado nunca entra em cliente, log ou documentação.
3. Toda função privilegiada valida identidade, propriedade, grants e input.
4. Retry usa UUID estável; colisão com payload diferente é conflito.
5. Reprodução, vídeo, timers, streams e listeners terminam ao trocar de card/rota.
6. Uma tela obsoleta não pode commitar UI ou efeitos.
7. Prática livre não altera FSRS, XP, streak ou liga.
8. Uma tentativa de fluência nunca certifica nível.
9. “CEFR/Cambridge” significa alinhamento, não endosso institucional.
10. Compilação/teste estático não equivale a QA visual, áudio, Chrome ou live.
11. Migrations são append-only; verificar schema e consumidores antes de mudar.
12. Branch `main` é a origem do deploy; publicação exige gates e smoke.
13. Texto capturado, persistido ou gerado por IA nunca é HTML confiável; qualquer formatação permitida precisa de sanitização por allowlist.

## Gates atuais

- build `3.0.34` autenticado no navegador;
- `fluency_skill_profiles` HTTP 200 sem `42703`;
- Check de comunicação sem captura de voz;
- voz natural real na escuta;
- tradução contextual ponta a ponta;
- calibração humana com respostas-âncora;
- observação de usuários e medidas D7/D30/D90.
