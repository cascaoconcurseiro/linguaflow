# Changelog

## [3.0.37] - 2026-09-06

### Corrigido

- O popup encerra tradução e dicionário com estado visível mesmo quando uma
  API externa trava; o dicionário tenta Dictionary API, Datamuse e Wiktionary
  dentro de um orçamento compatível com a espera da interface.
- Uma falha no `Desfazer` preserva a tentativa para repetição; após adiar um
  card, o botão não aponta mais para uma avaliação anterior.
- Campos das configurações e grupos de voz possuem nomes acessíveis.

### Segurança

- O proxy de dados da extensão passou a aceitar somente métodos públicos
  enumerados e bloqueia acesso ao helper REST interno `_fetch`.
- Termos persistidos são escapados também no editor do Cofre, no progresso do
  backfill e no reencontro de Histórias.
- Undo ignora snapshots enviados pelo cliente e reutiliza o estado anterior
  imutável do evento, inclusive após retry idempotente.
- FSRS calcula estabilidade com a dificuldade anterior; limites SRS inválidos
  voltam a defaults finitos e limitados.

### Validação

- Gate funcional completo e smoke com árvore intencionalmente alterada passaram.

## Atualização de código — 2026-09-05 (build 3.0.33)

- Primeiro acesso abre o dashboard sem onboarding obrigatório; preferências
  ausentes, inválidas ou indisponíveis não bloqueiam a Home.
- Meta anterior preservada; novas contas usam 20 revisões como padrão local,
  sem gravar nível ou conclusão de onboarding fictícios.
- Home interrompe atualizações após cancelamento da rota.
- Popup corrige import de banco, carregamento do dicionário e classificação CEFR.
- Professor explica blocos no contexto e retorna pronúncia brasileira no mesmo
  JSON; pronúncia salva permanece prioritária.
- Consulta de sessão local e tarefas paralelas reduzem esperas antes da resposta.
- Convite de login da extensão reutiliza uma guia e retoma o contexto aberto.
- IA exclusivamente DeepSeek autenticada; removida captura de voz do aluno.
- Novas regressões de entrada direta, dicionário, pronúncia e autenticação;
  contrato de tradução atualizado. Release completo e auditoria de dependências
  passaram localmente; QA autenticado e confirmação do deploy continuam separados.
- Documentação ativa reconciliada; planos antigos permanecem no histórico Git.

## [3.0.33] - 2026-07-29

### Corrigido

- Alinha `getFluencyProfiles()` ao schema canônico
  (`evidence_status` e `authoritative_attempt_count`), eliminando `42703`.
- Sincroniza manifest, PWA, HTML e cache do Service Worker no build `3.0.33`.

### Documentação

- Cria uma página canônica de estado atual.
- Reescreve Blueprint, Checklist, Handoff, índices e backlog com base em
  `main`, testes e estado de produção registrado.
- Marca planos/auditorias anteriores como históricos ou superados.
- Diferencia alinhamento CEFR de exame ou certificação oficial.

## [3.0.32] - 2026-07-29

### Corrigido

- O Check de comunicação usa o pipeline de TTS natural compartilhado.
- Reprodução é cancelada ao trocar de etapa/rota e só conta após terminar.
- Web Speech permanece apenas como fallback de indisponibilidade.

## Corte de fluência e tradução contextual - 2026-07-28/29

- Catálogo privado de 32 tarefas A1–B2, autoridade SQL e Edge Function
  `fluency-assessment`.
- Migrations aplicadas no Supabase canônico e índices de FKs adicionados.
- Tradução contextual promovida da captura ao card sem hardcode por palavra.
- QA autenticado de navegador e calibração humana permanecem gates.

## Operação de produção — 23/07/2026

- Adicionado monitor diário autenticado de RLS com dois usuários reais.
- O teste prova isolamento de leitura, alteração, exclusão e criação por proprietário.
- Credenciais ficam somente nos Secrets do GitHub e o dado de prova é removido ao final.
- O cliente web passou da chave `anon` legada para a chave publicável atual do Supabase.

As mudanças relevantes do LinguaFlow são registradas aqui. O projeto segue
[Versionamento Semântico](https://semver.org/lang/pt-BR/) para os pacotes
publicados.

## [3.0.31] - 2026-07-23

### Corrigido

- Impede que permissões tardias do microfone reabram a gravação após sair do
  treino e encerra recursos de áudio ao trocar de tela.
- Descarta respostas adaptativas obsoletas e listeners de telas desmontadas.
- Deduplica no banco o mesmo intervalo de estudo entre abas e origens, mantendo
  o Supabase como autoridade do tempo de atividade.
- Serializa sinais simultâneos do mesmo card para preservar o estado adaptativo.
- Torna o rate limit das Edge Functions atômico e limita o tamanho dos pedidos.
- Inclui a versão do cliente na telemetria de erro e sincroniza PWA, service
  worker e extensão na versão 3.0.31.

### Segurança e operação

- Remove escrita direta nas tabelas adaptativas; mutações passam somente pela
  RPC autenticada e vinculada ao dono do card.
- Adiciona índices de chaves estrangeiras e gates SQL reais ao pipeline de
  release.
- Adiciona testes de regressão para ciclo de vida do áudio, fronteiras das Edge
  Functions e contratos de produção.
