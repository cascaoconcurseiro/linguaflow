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

## Padrões de IA que este projeto deve evitar

### Princípio

Não é possível determinar com segurança se uma interface foi feita por IA apenas por sua aparência. Os itens abaixo são sinais de concepção genérica, superficial ou incompleta que também podem ocorrer em projetos humanos. O problema não é usar IA; é aceitar plausibilidade visual como substituta de engenharia e entendimento do usuário.

### 1. Anti-padrões visuais

- Gradientes roxos, azuis e cianos usados por reflexo, sem relação com a identidade.
- Hero centralizado previsível com título gigante, subtítulo genérico e dois CTAs.
- Tudo dentro de cards arredondados com sombras suaves.
- Glassmorphism, brilhos e bordas luminosas sem função.
- Bento grids usados como linguagem universal.
- Ícones genéricos usados para preencher espaço.
- Mesma tipografia, peso e ritmo para informações de importância diferente.
- Layout excessivamente uniforme, sem hierarquia editorial.
- Dashboard, currículo, configurações e estudo tratados como variações da mesma grade.
- Textos vazios como “desbloqueie seu potencial” ou “aprenda de forma inteligente”.
- **Regra de avaliação:** Se logotipo, cores e textos forem removidos, o produto ainda deve conservar uma identidade e uma organização coerentes com aprendizagem de idiomas.

### 2. Anti-padrões de UX

- Projetar apenas o estado ideal da tela.
- Botões sem estados hover, pressed, disabled, focus e loading.
- Formulários sem validação, mensagem de erro e recuperação.
- Spinner sem explicar o que está acontecendo.
- Falta de feedback após uma resposta.
- Perder a sessão quando a página é recarregada.
- Não explicar por que uma resposta está errada.
- Navegação sem indicar posição, progresso ou próximo passo.
- Ações destrutivas sem confirmação ou possibilidade de desfazer.
- Configurações visuais que não persistem nem alteram o comportamento real.
- Responsividade que apenas empilha ou encolhe elementos.
- Gamificação decorativa que não melhora a aprendizagem.

### 3. Anti-padrões de animação

- Fade-in em todas as seções.
- Cards que sobem em todo hover.
- Botões que aumentam sem necessidade.
- Confetes para qualquer acerto.
- Transições lentas que atrasam o estudo.
- Movimento que não respeita `prefers-reduced-motion`.
- Animação sem continuidade espacial ou feedback de causa e efeito.
- Movimento deve confirmar interação, comunicar mudança de estado, preservar contexto ou orientar atenção. Se não cumprir uma dessas funções, é decoração.

### 4. Anti-padrões de produto gerado por IA

- Entregar uma landing page quando foi pedido um sistema.
- Criar dados fictícios e apresentá-los como catálogo real.
- Construir 12, 50 ou 96 itens e sugerir que existe progressão completa A1–B2.
- Adicionar filtros que não filtram, configurações que não salvam e gráficos sem dados.
- Usar `localStorage` como arquitetura multiusuário.
- Implementar apenas o caminho feliz.
- Misturar protótipo, MVP e produto final sem declarar o estágio.
- Inventar integrações de áudio, IA ou pagamentos sem implementá-las.
- Usar um algoritmo simplificado e chamá-lo de FSRS/Anki sem validação.
- Fazer todas as páginas em um único componente grande.
- Duplicar regras no cliente e no servidor sem fonte única.
- Não definir modelo de dados, migração, versionamento ou rollback.
- Tratar conteúdo pedagógico como array fixo dentro do frontend.
- Não criar ferramentas editoriais para expansão do catálogo.
- Não medir comportamento real do usuário.
- Não testar autorização por objeto e isolamento entre contas.

### 5. Anti-padrões de engenharia

- Segredos no repositório.
- Autenticação apenas no cliente.
- IDs de usuário aceitos do corpo da requisição.
- Ausência de validação no servidor.
- Consultas sem índice para filas de revisão.
- Atualizações concorrentes sem idempotência.
- Migrações destrutivas sem backup ou plano de reversão.
- Logs contendo e-mail, token ou conteúdo sensível.
- Dependências adicionadas sem necessidade e sem auditoria.
- Falhas silenciosas em áudio, gravação ou sincronização.
- Nenhuma telemetria para erros e latência.
- Nenhum teste do comportamento realmente crítico.

### 6. Como trabalhar como uma equipe sênior

1. Descobrir o problema e os comportamentos reais dos usuários.
2. Escrever requisitos, suposições, riscos e critérios de aceite.
3. Modelar domínio, estados, permissões e falhas antes de polir telas.
4. Construir o menor fluxo vertical completo: interface, API, dados, segurança e teste.
5. Validar com usuários e dados reais.
6. Medir, corrigir e só então expandir.
7. Manter documentação viva e decisões registradas.
8. Declarar claramente o que está pronto, parcial, simulado ou planejado.

### Perguntas obrigatórias para cada funcionalidade

- Que problema resolve?
- Qual é a fonte real dos dados?
- Quem pode executar a ação?
- O estado persiste?
- O que acontece offline, com latência, erro ou duplicação?
- Existe loading, vazio, sucesso, erro e recuperação?
- Funciona no teclado, leitor de tela e celular?
- Como será testada?
- Que métrica mostrará se ajudou?
- Como será desativada ou revertida? Se fossemos fazer isso, mudaria muita coisa no sistema?

## Referências e estado do projeto

- Leia `HANDOFF.md` e `MASTER_BLUEPRINT.md` antes de iniciar uma sessão.
- Atualize `CHECKLIST.md` e `HANDOFF.md` ao encerrar uma sessão de trabalho.
- Atualize `MASTER_BLUEPRINT.md` apenas quando uma decisão arquitetural realmente mudar.
- A referência de motion solicitada em `github.com/kylezantos/design-principles` não estava acessível/retornou 404 em 2026-09-19; não trate esse endereço como fonte verificada. Até ser fornecida uma URL válida, siga os princípios documentados acima e a skill local de motion.
