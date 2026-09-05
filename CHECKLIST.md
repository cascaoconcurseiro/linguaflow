# Checklist — LinguaFlow

**Atualizado em:** 2026-09-05
**Referência:** correções de setembro na `main`, build `3.0.33`

Este arquivo contém apenas trabalho vigente. Auditorias e planos superados
foram consolidados e permanecem recuperáveis pelo histórico Git.

## Fundação entregue

- [x] Primeiro acesso abre o dashboard sem guia obrigatório; falha ou ausência
  de preferências não bloqueia entrada (2026-09-05).
- [x] Regressões de entrada direta e cancelamento da Home; release completo,
  qualidade de tradução e auditoria de dependências passaram (2026-09-05).
- [ ] Validar entrada direta com conta nova no navegador após publicação.

- [x] Extensão MV3 e PWA com build/versionamento sincronizados.
- [x] Supabase como fonte de verdade com RLS e grants estreitos.
- [x] Refresh de sessão, proxy de dados e erros de escrita visíveis.
- [x] FSRS-4.5, learning/relearning steps, limites, bury, suspend e undo.
- [x] Ledger/evidência e XP server-side, idempotente e anti-farm.
- [x] Prática livre separada de FSRS, XP, ofensiva e liga.
- [x] Home, Aprender, Cofre e Progresso com rotas preservadas.
- [x] Reader, Histórias, jogos e modos variados de estudo.
- [x] Entrada direta, placement opcional e recalibração pelo histórico.
- [x] Recuperação adaptativa por card.
- [x] Backup/restore JSON, CSV e Anki com estado de agendamento.
- [x] Notificações da extensão e Push da PWA.

## Contexto e áudio

- [x] Removida latência sequencial do Professor: sessão local, tarefas paralelas
  e tradução auxiliar fora do caminho crítico de sucesso (2026-09-05).
- [x] Professor contextual retorna e renderiza `pronunciation_pt` mesmo sem IPA,
  preservando pronúncia brasileira já salva (2026-09-05).
- [x] Popup encerra estados de loading, exibe CEFR legível e gera aproximação
  brasileira a partir dos dois formatos IPA do dicionário (2026-09-05).
- [x] Prompt do popup focado no significado contextual, blocos/expressões e
  explicação natural sem análise gramatical; contratos e release passaram (2026-09-05).
- [ ] Validar resposta real do prompt ajustado no popup após recarregar extensão.

- [x] Corrigido import ausente de db no popup; regressões de pronúncia e login
  verificam o módulo real sem db global (2026-09-05).

- [x] Tradução contextual promovida em popup, primeiro teste, Reader, Histórias,
  Cofre e Estudo.
- [x] TTS natural do Check reutiliza o mesmo pipeline das demais superfícies.
- [x] Cache, exclusividade de reprodução e cleanup de áudio/stream protegidos.
- [x] Build avançado para `3.0.33` para invalidar clientes antigos.
- [ ] QA Chrome: palavra ambígua em frase real até o card.
- [ ] QA auditivo: escuta do Check usa voz natural, não fallback robótico.
- [ ] QA de falha: caminho natural indisponível cai para Web Speech uma vez.

## Fluência A1–B2

- [x] Contrato separa memória, atividade e evidência comunicativa.
- [x] Catálogo privado com 32 tarefas e rubricas versionadas.
- [x] Emissão owner-only sem expor gabarito/rubrica.
- [x] Submissão idempotente com expiração e conflito de payload.
- [x] Edge Function com JWT, quota, payload limitado e timeout.
- [x] Commit autoritativo e perfil por habilidade.
- [x] Rota, retomada, Home e UX acessível integradas.
- [x] Migrations e Edge Function registradas como aplicadas em produção.
- [x] Contratos de catálogo, SQL, Edge, cliente e UX verdes.
- [x] Registro de 29/07: PWA pública entrega `app.js?v=3.0.33` sem erro de console.
- [ ] QA autenticado no build `3.0.33`.
- [ ] QA autenticado: `fluency_skill_profiles` HTTP 200 sem `42703`.
- [ ] Jornada completa do Check sem captura de voz.
- [x] Remover microfone, gravação, upload e avaliação de voz do aluno.
- [ ] Confirmar que respostas livres não persistem fora do contrato.

## Calibração e eficácia

- [ ] Criar respostas-âncora por nível/habilidade/família.
- [ ] Obter dois julgamentos humanos independentes por amostra.
- [ ] Medir concordância por dimensão.
- [ ] Medir falsos positivos/negativos e viés por nível e perfil.
- [ ] Definir política de retenção e exclusão da evidência.
- [ ] Observar cinco usuários reais sem orientação do executor.
- [ ] Medir transferência em D7, D30 e D90.
- [ ] Proibir linguagem de certificação oficial sem validação institucional.

## Produção e segurança

- [x] Convite de login no contexto IA com guia própria da extensão e retomada do contexto aberto.
- [x] Testar convite, sessão expirada, retomada única, cancelamento e reutilização da guia.
- [ ] Validar manualmente login pelo convite após recarregar a extensão no navegador.

- [x] Popup prioriza `pronunciation_pt` do Supabase; teste de corrida e release completo verdes.
- [x] Commit `71b6dfe` na main com IA, BR e remoção de gravação.
- [ ] Enviar correções e documentação à main; push solicitado pelo usuário em 05/09.

- [x] Publicar `deepseek-chat` e `fluency-assessment` exclusivamente DeepSeek no Supabase em 04/09.
- [x] Confirmar `DEEPSEEK_API_KEY` nos Secrets e ausência do secret OpenRouter.
- [x] Testar professor na PWA autenticada após deploy: resposta `DEEPSEEK_OK`.
- [x] Confirmar recusa HTTP 401 de chamada sem Authorization.
- [x] Proteger respostas das duas funções com `Cache-Control: private, no-store`.
- [x] Remover captura/envio de voz do cliente e das funções de IA.
- [x] Preservar erros de autenticação do contexto rápido até o popup; testar sessão ausente, 401, 502 e sucesso.
- [x] Suíte release completa verde em 04/09 antes do ajuste final de propagação; testes focados verdes após ajuste.
- [ ] Recarregar extensão local e validar professor no YouTube com login próprio da extensão.
- [ ] Publicar alterações locais do frontend; deploy Supabase não publica PWA ou recarrega extensão.
- [ ] Validar isolamento ao vivo com duas contas; contratos de propriedade/JWT passaram, mas o teste real usou uma conta.

- [x] Registro de 29/07: `main` alinhada com `origin/main` em `267433d`.
- [x] `npm run test:engine`: 38 testes verdes em 29/07.
- [x] `npm run test:fluency`: verde em 29/07.
- [x] `npm run test:release -- --allow-dirty`: verde em 29/07.
- [x] Release smoke: 60 arquivos JS, manifest e build `3.0.33`.
- [ ] Consultar resultado recente do workflow live de RLS com dois usuários.
- [x] Consultar advisor: Leaked Password Protection está desativado em 29/07.
- [ ] Ativar Leaked Password Protection no painel/plano compatível.
- [ ] Smoke autenticado pós-deploy no navegador.

## Documentação — atualizada em 05/09

- [x] Reconciliados entrada direta, Professor, pronúncia e ausência de captura de voz.
- [x] Separadas evidências locais de QA autenticado e publicação.

- [x] Criado `docs/ESTADO_ATUAL_2026-07-29.md`.
- [x] Reescritos README/índices e autoridade documental.
- [x] Reconciliados Blueprint, Backlog e arquitetura de dados.
- [x] Política de histórico consolidada em `docs/HISTORY.md`.
- [x] Contratos atualizados sem reescrever sua intenção original.
- [x] Planos/auditorias superados consolidados e removidos do workspace.
- [x] Validar links dos documentos canônicos e referências Markdown.
- [x] Rodar novamente o release após o diff documental final.

## Limpeza de produção — 29/07

- [x] Inventariar 242 arquivos versionados, tamanhos e duplicatas exatas.
- [x] Mapear consumidores por manifest, HTML, imports, testes e scripts.
- [x] Remover `popup/popup.css`, não carregado por nenhuma superfície.
- [x] Remover `utils/en-top-10k.txt`, sem consumidor no repositório.
- [x] Remover 17 documentos históricos já consolidados e recuperáveis no Git.
- [x] Remover cache de ferramenta e pasta temporária vazia.
- [x] Remover 128 snapshots locais ignorados em `docs/archived/`.
- [x] Preservar duplicatas de ícones exigidas pela extensão e pela PWA.
- [x] Preservar migrations, testes, `.vercel`, `supabase/.temp`, `node_modules`
  e configurações locais.
- [x] Validar referências Markdown e release smoke depois da exclusão.
- [x] Rodar a suíte completa `npm run test:release -- --allow-dirty`.

## Manutenção posterior à validação

- [ ] Mapear dependências externas, taxa de fallback e impacto.
- [ ] Decidir TTS offline com dados, não apenas benchmark.
- [ ] Eliminar warning de módulos nos testes sem mudar o runtime.
- [ ] Caracterizar módulos grandes antes de extração cirúrgica.
- [ ] Não trocar framework ou reescrever motor de legenda sem problema medido.

## Próximo passo concreto

Abrir a PWA autenticada, confirmar o build `3.0.33` e inspecionar a chamada de
`fluency_skill_profiles`. Se estiver em 200, executar o Check sem captura de
voz; registrar resultado aqui e no `HANDOFF.md`.
