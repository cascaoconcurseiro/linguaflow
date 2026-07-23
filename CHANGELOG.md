# Changelog

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
