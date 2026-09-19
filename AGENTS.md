# Instruções de engenharia — LinguaFlow

Estas regras valem para qualquer agente, modelo ou colaborador que altere este repositório.

## Issues, branches, PRs e deploys

- Toda tarefa de **Correção**, **Melhoria** ou **Nova função** começa por uma Issue no GitHub.
- Antes de editar código, identifique a Issue correspondente e registre nela o escopo, critérios de aceite, riscos e plano de validação.
- Cada mudança deve ser feita em uma branch de trabalho derivada de `main`, com nome `codex/<issue>-<slug>` ou equivalente descritivo.
- Todo deploy passa por Pull Request para `main`; não faça push direto de mudanças funcionais em `main`.
- A descrição do PR deve mencionar a Issue com `Closes #<número>` ou `Refs #<número>`. PR sem Issue vinculada não está pronto para revisão.
- O PR deve declarar se é correção, melhoria, nova função, documentação, refatoração, UI ou testes, além dos gates executados e das limitações de QA.
- Só faça merge/deploy após revisão, CI verde, testes aplicáveis, validação de segurança e evidência de rollback quando houver risco operacional.
- Não feche uma Issue apenas porque o código foi escrito: confirme os critérios de aceite e o estado publicado.

## Interface, motion e carregamento

- Toda interface deve ter estados explícitos de carregamento, vazio, erro, sucesso e progresso quando a operação for assíncrona ou incremental.
- Use skeletons para conteúdo estrutural que ainda será carregado; o skeleton deve preservar a geometria para evitar layout shift.
- Use lazy loading para rotas, módulos, imagens, mídia e dados que não são necessários no primeiro paint, sem atrasar o caminho crítico de estudo.
- Toda entrada, saída, transição de rota, feedback de ação e progresso deve ter motion suave e curto, animando preferencialmente `transform` e `opacity`.
- Motion deve comunicar hierarquia, continuidade, feedback ou foco. Não adicione animação ornamental que distraia ou prejudique aprendizagem.
- Respeite `prefers-reduced-motion`: mantenha o conteúdo e o feedback, removendo movimento não essencial e evitando scroll-scrub.
- Toda nova interface precisa de teclado, foco visível, nomes acessíveis, semântica apropriada e estados anunciáveis por tecnologia assistiva.
- A validação visual deve distinguir teste estrutural/contratual de QA real no navegador; nunca declare layout ou animação validados apenas por parsing.

## Observabilidade

- Toda funcionalidade de produção deve declarar de 2 a 4 perguntas operacionais que a telemetria responde.
- Use OpenTelemetry como camada vendor-neutral para traces/métricas quando aplicável; Sentry, Datadog ou New Relic podem ser backends, não contratos espalhados pelo domínio.
- Logs devem ser estruturados, ter evento estável e correlation/request ID; nunca registrar tokens, segredos, senhas ou PII não necessária.
- Métricas devem usar cardinalidade limitada e histogramas com p95/p99; não use user ID, URL bruta ou mensagem de erro como label.
- Alertas devem ser acionáveis, baseados em sintomas percebidos pelo usuário, ter limiar/duração justificados e apontar para runbook.
- Instrumentação precisa ser exercitada em ambiente seguro: erro induzido, evento localizado por correlation ID, métrica emitida e trace sem quebra.

## Qualidade, lint e testes

- Preserve a arquitetura e os contratos existentes antes de introduzir ferramentas. Toda ferramenta nova deve ter Issue, configuração mínima e critério de aceite mensurável.
- Avalie Arch/contract checks, Biome, Commitlint, Knip e Stryker Mutation Testing; registre explicitamente quando uma ferramenta não for compatível com o stack vanilla JS/MV3 atual.
- Mudança de comportamento segue RED-GREEN-REFACTOR: teste unitário ou de contrato que falha, implementação mínima, regressão verde e refatoração.
- Mantenha cobertura em três níveis: unitário, integração/contrato e end-to-end com Playwright quando houver fluxo de navegador. Codecov pode publicar cobertura, mas não substitui testes.
- Gates verdes locais não provam RLS, Supabase, Edge Functions, autenticação real, comportamento do Chrome, QA visual ou deploy; rotule essas evidências separadamente.
- Nunca apague ou reescreva alterações locais sem inspeção de `git status` e `git diff`. Migrations são append-only e segredos ficam fora do cliente, logs e Git.

## Referências e estado do projeto

- Leia `HANDOFF.md` e `MASTER_BLUEPRINT.md` antes de iniciar uma sessão.
- Atualize `CHECKLIST.md` e `HANDOFF.md` ao encerrar uma sessão de trabalho.
- Atualize `MASTER_BLUEPRINT.md` apenas quando uma decisão arquitetural realmente mudar.
- A referência de motion solicitada em `github.com/kylezantos/design-principles` não estava acessível/retornou 404 em 2026-09-19; não trate esse endereço como fonte verificada. Até ser fornecida uma URL válida, siga os princípios documentados acima e a skill local de motion.
