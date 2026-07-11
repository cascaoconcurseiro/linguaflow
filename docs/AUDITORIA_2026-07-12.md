# Auditoria de continuidade — LinguaFlow (2026-07-12)

> Segunda auditoria completa do projeto, feita pela equipe (Gerente/Fable, Linguista, Eng. SRS, Prof. didático, Eng. Backend/Segurança, QA) depois de fechar o ROADMAP-MESTRE (Ondas 1-4). Objetivo: caçar bugs reais, coisas não implantadas de verdade, e problemas de infraestrutura viva (Supabase + GitHub) que a auditoria original (2026-07-10) e o desenvolvimento acelerado das últimas ondas possam ter deixado passar. Todas as correções de banco/GitHub abaixo foram feitas com autorização explícita do dono.

## 1. Infraestrutura viva — Supabase (produção `qnutoswrufznztoznlql`)

### 🔴 Corrigido nesta auditoria (migration `20260712000000_security_audit_fixes`)

| # | Achado | Severidade | Evidência | Correção |
|---|---|---|---|---|
| 1 | **IDOR real**: `public.get_user_stats(p_user_id uuid)` — `SECURITY DEFINER`, `EXECUTE` liberado pra `authenticated`, **nunca verificava `auth.uid() = p_user_id`**. Qualquer usuário logado podia chamar `POST /rest/v1/rpc/get_user_stats {"p_user_id": "<uuid de outra pessoa>"}` e ler contagem de palavras, cards vencidos e retenção de 30 dias de QUALQUER outro usuário. | 🔴 Alta (vazamento de dados entre usuários) | Código-fonte da função lido via `pg_proc.prosrc`; comparado com `ensure_user_stats` (que faz a checagem certa). Zero chamadores no client (grep no repo inteiro) — função morta, devolvia até campos hardcoded (`streak: 0`, `by_cefr: {}`). | `DROP FUNCTION` — eliminada, não só restringida, já que não tinha uso real. |
| 2 | **Índice duplicado**: `idx_cards_due` e `idx_cards_user_due` na tabela `cards` — definições IDÊNTICAS (`btree (user_id, due_date) WHERE NOT suspended`). | 🟡 Média (custo de escrita em dobro sem ganho) | `pg_indexes` confirmou definições byte-a-byte iguais. | `DROP INDEX idx_cards_due` (mantido o versionado em migration, `idx_cards_user_due`). |
| 3 | **Migrations desalinhadas**: as últimas 6 migrations aplicadas via `apply_migration` (timezone, expose_push_public_key, weekly_quest, grant_push_server_rpcs, word_mnemonic, email_reengagement) tinham **timestamps diferentes no arquivo local vs. no histórico real do Supabase** (`supabase_migrations.schema_migrations`) — o Supabase atribui o timestamp no momento da aplicação, não no nome que eu dei ao arquivo. Isso quebraria `supabase db push`/CLI no futuro (tentaria reaplicar migrations "novas" que na verdade já rodaram). | 🟡 Média (risco futuro de tooling, não de dados) | `list_migrations` comparado arquivo a arquivo com `ls supabase/migrations/`. | Arquivos renomeados (`git mv`) pros timestamps reais; replay completo do zero em banco efêmero confirmou a cadeia ainda funciona na ordem certa. |

### 🟡 Investigado, não corrigido (risco desproporcional ou fora do meu controle)

| # | Achado | Por que não corrigir agora |
|---|---|---|
| 4 | `pg_net` instalado no schema `public` (advisor "Extension in Public") | Testado em produção: `ALTER EXTENSION pg_net SET SCHEMA` falha com `0A000: extension "pg_net" does not support SET SCHEMA` — limitação da própria extensão, não é falta de tentativa. Corrigir exigiria `DROP EXTENSION` + `CREATE EXTENSION` num schema novo, arriscando derrubar os crons (`push-reminder`, `email-weekly-reengagement`) que dependem de `net.http_post`. As funções `net.*` já vivem no schema `net` (nunca em `public`), então não há exposição real — aceito como falso-positivo de baixo risco, comum em projetos Supabase. |
| 5 | ~10 avisos "SECURITY DEFINER function executable by authenticated" (`claim_weekly_quest`, `ensure_user_stats`, `get_push_public_key`, `maybe_league_rollover`, `record_card_review`, `record_learning_event`, `revert_card_review`, `set_email_opt_in`, `set_user_timezone`) | Revisados um a um: todos são RPCs de usuário legítimas, cada uma valida `auth.uid()` internamente (a MESMA verificação que faltava em `get_user_stats`, item #1). O advisor sinaliza "SECURITY DEFINER + authenticated" de forma genérica — não distingue "função perigosa" de "função corretamente restrita ao próprio usuário". Nenhuma ação necessária. |
| 6 | "Leaked Password Protection Disabled" | Só é configurável no dashboard do Supabase (Auth → Settings), não via SQL/migration — depende do dono (já rastreado no CHECKLIST, Onda 0). |
| 7 | 6 índices "unused" (INFO, não WARN) | Normal em app com pouco tráfego real ainda — índices existem pra quando o volume crescer (ex: `idx_cards_user_due` seria usado pesadamente em produção com muitos usuários). Não remover preventivamente. |

## 2. GitHub

| # | Achado | Ação |
|---|---|---|
| 8 | **PR #2** ("Unify main + master...") continua **aberta e em draft** desde 2026-07-04, sem nenhuma atividade desde então — parece totalmente superada pelo trabalho da PR #3 (que já unificou/consolidou tudo o que a #2 tentava resolver). | **Não fechei sozinho** — é uma decisão de gestão de repositório, não um bug técnico. Recomendo ao dono fechar a PR #2 como superada, mas só ele deve decidir. |
| 9 | Branches obsoletas: `master` (idêntica a `main`, mesmo SHA — parece um ponteiro de branch-padrão legado) e `codex/auditoria-completa` (já foi mergeada dentro de `claude/learning-system-audit-4uwb83` nesta sessão, seu conteúdo já está na PR #3). | **Não apaguei sozinho** — apagar branch é destrutivo; fica com o dono decidir se quer limpar. |
| 10 | CI check "Verify learning engine and release smoke" continua falhando (~2-4s, `runner_id: 0`, sem log) em TODOS os pushes recentes — confirmado repetidas vezes que é falha de infraestrutura do GitHub Actions (nenhum runner é atribuído ao job), não do código. Todos os testes passam localmente (28 engine + 5 local-day + release-smoke) a cada push. | Provavelmente Actions desabilitado/restrito em Settings → Actions → General do repositório — fora do que consigo verificar/corrigir via API. Segue não-bloqueante (Vercel + testes locais são o gate real). |

## 3. Revisão de código (bugs reais, não estilo)

*(preenchido após a revisão dedicada das áreas de maior risco: Onda 2 — Estatísticas/Estudo por tópico/Editor de card/Mini-jogo/Player YouTube; Onda 3 — Placement v3/Mnemônicos/Import URL-EPUB/E-mail/Tatoeba)*
