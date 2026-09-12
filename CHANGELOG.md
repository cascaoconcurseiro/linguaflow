# Changelog

## [3.0.46] - 2026-09-12

### Corrigido
- **Dicionário e Phrasal Verbs**: Termos compostos (ex.: "face off", "give up") não travam mais em `(Carregando dicionário...)`. Detecção prévia de termos com espaço pula a consulta inútil à DictionaryAPI e exibe a tradução contextual e análise em 3s em vez de travar por 7s.
- **Auditoria de Banco e Telemetria**: Adicionada migração de hardening relacional e tabela `db_audit_telemetry`. Métodos de auditoria adicionados a `db.js`.
- **Dashboard e Visualização**: Correções pontuais de rendering na visualização de cards, modais e gestão de filas de revisão.

## [3.0.45] - 2026-09-11

### Adicionado
- **Reset de Card**: Funcionalidade para resetar card individual para o estado `new` mantendo integridade dos dados históricos de revisão.

### Corrigido
- **Auto-scroll de Legendas**: Corrigido scroll automático da lista lateral de legendas durante a reprodução no player.

## [3.0.44] - 2026-09-11

### Corrigido

- Cadastro reconhece os tokens retornados na raiz pela API REST do Supabase,
  persiste a sessão e permite entrada direta na Home quando a confirmação de
  email está desativada. Antes, a sessão era ignorada e a tela afirmava que um
  email de confirmação havia sido enviado.
- Teste de regressão cobre resposta REST, envelope de sessão, persistência,
  invalidação de cache e resposta sem token. Versão do cache PWA atualizada.

## [3.0.43] - 2026-09-09

### Corrigido

- A tradução antecipada da barra lateral passa pelo service worker da extensão,
  que possui as permissões de host necessárias, em vez de fazer `fetch` a partir
  do origin do YouTube e ser bloqueada por CORS.
- Falha do proxy não repete a chamada pelo transporte bloqueado da página; o
  service worker valida remetente e limita o texto antes de encaminhar.

### Validação

- Novo contrato diferencia content script, página da extensão, service worker e
  PWA e impede regressão para acesso direto ao Google no contexto do YouTube.

## [3.0.42] - 2026-09-09

### Corrigido

- A barra lateral solicita a trilha completa do YouTube no início e antecipa a
  tradução de todas as cues, inclusive as que ainda estão fora da rolagem.
- A fila entrega cada tradução à interface assim que ela termina, preserva a
  ordem e limita concorrência a 12 chamadas para evitar rajadas sem atrasar a
  lista inteira até a última resposta.
- Troca de vídeo ou idioma invalida resultados tardios; a pré-carga usa uma
  única URL `json3` sem `tlang`, `t`, `range` ou `spv` e não dispara fan-out de
  blocos nem depende de rede nos testes.

### Validação

- Contratos cobrem concorrência real da fila, ordem, preenchimento de todas as
  cues, pré-carga da trilha completa e ausência da estratégia por viewport.

## [3.0.41] - 2026-09-09

### Corrigido

- Configurações persistidas de idioma original e tema voltam a ser carregadas
  pelo painel da extensão; a tradução permanece ativada por padrão.
- A barra lateral traduz somente legendas próximas da área visível, evitando
  milhares de requisições em vídeos longos, e escapa traduções antes do HTML.
- PDF, CSV e exportações Anki neutralizam HTML e fórmulas de planilha; o Anki
  principal inclui a explicação contextual e a dica já salvas no card.
- Jogos, Histórias, Cofre, menus e rotas receberam foco previsível, nomes
  acessíveis, teclado completo e resultados que não desaparecem sozinhos.
- Sinais adaptativos rejeitam reutilização divergente do mesmo evento.
  Push e e-mail reservam atomicamente cada envio; e-mail também usa chave de
  idempotência estável no provedor.

### Validação

- Novos contratos cobrem conteúdo não confiável, carregamento limitado de
  traduções, acessibilidade, exportação contextual e concorrência do backend.

## [3.0.40] - 2026-09-08

### Corrigido

- O teto máximo também limita a primeira graduação por Bom/Fácil, e cards leech
  existentes podem ser suspensos após a mudança da configuração.
- Retry de uma revisão já desfeita devolve o card atual; valores SRS não finitos
  degradam para defaults e a interface impede persistir entradas inválidas.
- Frase, tradução e feedback de IA são escapados nos sinks restantes.
- Notificações Push só navegam dentro da PWA; placement ganhou diálogo e ciclo
  de foco; a exportação Anki descreve corretamente o sidecar de agendamento.

### Validação

- Contratos comportamentais cobrem o endurecimento FSRS, HTML não confiável,
  configurações, acessibilidade e navegação de notificações.

## [3.0.39] - 2026-09-07

### Corrigido

- A RPC de revisão calcula a transição FSRS no servidor, sob bloqueio do card,
  e ignora propostas de estado do cliente mantendo a assinatura compatível.
- O cliente aceita somente o card e o snapshot de undo devolvidos pelo servidor.
- As configurações completam nomes, estados pressionados e anúncios acessíveis
  para CEFR, voz, velocidade, Kokoro, push, e-mail e posicionamento.
- O carregamento da extensão no Chrome falhava por match pattern inválido com
  subcaminho em `web_accessible_resources[1]`; o padrão foi corrigido para origem (`*://*.amazon.com/*`).
- No YouTube, legendas auto-traduzidas (`tlang=pt`) eram aceitas como idioma
  original; o engine agora força a trilha de origem no player e remove `tlang` para carregar a legenda no idioma original.

### Segurança

- O manifesto substitui hosts genéricos por provedores HTTPS explícitos e limita
  recursos acessíveis à Web aos módulos realmente carregados por cada integração.

### Validação

- Contratos novos cobrem a autoridade FSRS, as permissões mínimas, padrões de match
  do manifesto e isolamento de tlang no ciclo de vida de legendas.

## [3.0.38] - 2026-09-06

### Corrigido

- A fila consulta learning, review/mature e novos separadamente, aplica tópico
  antes dos limites e suporta até 1.000 revisões sem starvation entre estados.
- O canal de legendas valida origem, navegação, nonce rotativo, tipo, URL,
  protocolo e tamanho do payload antes de aceitar mensagens da página.
- O popup de palavras ganhou diálogo e abas ARIA, foco contido e restaurado,
  teclado completo, chips nativos, contraste AA e movimento reduzido.

### Validação

- Novos contratos de fila, ponte de legendas e acessibilidade integram o gate
  oficial de release.

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
