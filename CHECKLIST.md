# Checklist — LinguaFlow

## 0. Proteção e baseline

- [x] Confirmar que `main` local está em `0c33b26`.
- [x] Confirmar que a referência local `origin/main` aponta para `0c33b26`.
- [x] Confirmar que existem referências locais de backup.
- [x] Pushes recentes para `main` foram aceitos pelo GitHub; consulta independente via `git ls-remote` continua bloqueada por Schannel.
- [x] Preservar as 8 alterações locais; não executar reset ou limpeza destrutiva.
- [x] Separar as alterações locais em branch/commit revisável antes do release.

## 1. Correção imediata do Reader

- [x] Remover o fallback de `fetch` direto para `translate.googleapis.com` em `content/web-reader.js`.
- [x] Manter a tradução do Web Reader pelo service worker, respeitando CORS.
- [x] Definir comportamento explícito quando o service worker estiver indisponível.
- [x] Adicionar regressão que impeça novo fetch direto de tradução no content script.
- [ ] Verificar seleção, Alt+seleção, menu de contexto e duplo-clique.
- [ ] Verificar que controles interativos e elementos editáveis não abrem o popup.

## 2. Revisão das alterações locais

- [x] Revisar `WORD_SAVED` em `background/service-worker.js` e remover o anúncio redundante antes da confirmação remota.
- [x] Confirmar sincronização da versão em `content/boot.js`.
- [x] Confirmar origem autorizada de `openWordPopup` em `content/subtitle-engine.js`.
- [x] Confirmar revogação segura de object URLs em `dashboard/js/core/tts.js`.
- [x] Confirmar embaralhamento do Builder em `dashboard/js/ui/gameView.js`.
- [x] Confirmar interrupção de TTS ao sair de Histórias.
- [x] Executar testes específicos após cada grupo.
- [x] Corrigir a linha em branco extra em `tests/web-reader-contract.test.mjs`.

## 3. Bug de tradução no hover de Histórias

- [ ] Reproduzir no navegador autenticado um caso real de “Tradução indisponível”.
- [ ] Registrar token, contexto, idioma, endpoint, status HTTP e ordem das respostas.
- [ ] Rastrear hover → token → normalização → vault → translateText → tooltip.
- [ ] Confirmar uma única causa raiz antes de editar `storiesView.js`.
- [ ] Criar teste de regressão para o caso reproduzido.
- [ ] Corrigir somente a causa confirmada.
- [ ] Validar corrida entre hovers, troca de história e saída da rota.
- [ ] Validar pontuação, apóstrofo, hífen e expressão composta.

## 4. Schema e migrations

- [x] Confirmar live pelo SQL Editor o inventário público de 33 tabelas; migrations remotas estão alinhadas até `20260913123000`.
- [ ] Exportar o schema remoto completo; CLI dump bloqueado por Docker/`cli_login_postgres` ausente.
- [ ] Comparar colunas, tipos, defaults e constraints em inventário completo.
- [ ] Comparar chaves estrangeiras e índices críticos.
- [ ] Comparar assinaturas de RPCs e sobrecargas antigas.
- [x] Confirmar que as migrations locais e remotas estão alinhadas até `20260913123000`.
- [ ] Reexecutar replay em PostgreSQL real; bloqueado por `npm`/cache com erro `EPERM` ao inicializar o Supabase CLI.
- [ ] Confirmar que não existem mudanças manuais ausentes do repositório.
- [ ] Confirmar que não há consumidor front sem tabela ou coluna correspondente.

## 5. RLS, grants e segurança Supabase

- [ ] Executar isolamento real com dois usuários.
- [ ] Confirmar leitura e escrita owner-only nas tabelas pessoais.
- [ ] Confirmar que usuário comum não executa RPC administrativa.
- [ ] Confirmar que usuário A não opera sobre IDs de B.
- [ ] Confirmar ledgers sem escrita direta do cliente.
- [x] Confirmar live RLS habilitado nas 33 tabelas públicas; nenhuma está sem RLS.
- [x] Auditar live policies, grants e funções pelo SQL Editor autenticado.
- [x] Confirmar live que `anon` só tem grants de tabela em `keep_alive`; `authenticated` tem grants amplos protegidos por policies owner-only.
- [x] Confirmar live `SECURITY DEFINER` e `search_path` das RPCs; não há alteração direta sem revisão de necessidade.
- [ ] Testar lockout, expiração e concorrência administrativa.

## 6. Edge Functions e jobs

- [x] Confirmar live que as 6 Edge Functions estão ativas; `verify_jwt=false` em push/e-mail depende da chave de cron validada no código.
- [ ] Confirmar `verify_jwt` de cada função.
- [ ] Testar JWT ausente, expirado e adulterado.
- [ ] Testar método, payload, tamanho e CORS.
- [ ] Confirmar quota e idempotência de IA/fluência.
- [ ] Confirmar autorização de jobs de push e e-mail.
- [ ] Testar claims de push/e-mail sob concorrência.
- [ ] Revisar `url-import` contra redirects, IP privado e DNS rebinding.
- [ ] Confirmar timeout, tamanho e número de redirects.
- [ ] Confirmar cron jobs, URLs e chaves remotas.

## 7. Publicação e Vercel

- [ ] Fazer scan do artefato publicado.
- [x] Confirmar por HTTP que migration administrativa, teste de release e `.env` não são entregues; migration/teste terminam em 404 após redirect.
- [x] Revalidar exposição de `20260913100000_admin_authority_rpcs.sql`; após correção, termina em 404.
- [ ] Rotacionar PIN/hash ou credencial exposto.
- [x] Home pública respondeu 200 após a correção de publicação.
- [ ] Testar rewrites, fallback SPA e arquivos estáticos.
- [ ] Confirmar ausência de segredos nos bundles.

## 8. QA real

- [ ] Testar Home, Study, Learn, Progress, Settings, Stories e Reader autenticados.
- [ ] Testar service worker com cache antigo e aba aberta.
- [ ] Testar logout, expiração e novo login.
- [ ] Testar offline, timeout, retry e falha parcial.
- [ ] Testar Chrome MV3 em páginas com CSP restritiva.
- [ ] Testar YouTube/HBO, legendas, popup e Reader.
- [ ] Testar áudio natural, fallback e troca rápida de rota.
- [ ] Testar atalhos com input, leitor de tela, mobile e overlays.
- [ ] Testar texto/IA contendo HTML, atributos, URLs e caracteres especiais.
- [ ] Confirmar que tela obsoleta não commita UI ou efeitos.

## 9. Wiring e manutenção

- [ ] Investigar `utils/schema.js` antes de removê-lo.
- [ ] Revisar exports órfãos reportados pelo wiring audit.
- [ ] Distinguir imports dinâmicos legítimos de código morto.
- [ ] Cobrir carregamento dinâmico não reconhecido pelo auditor.
- [ ] Remover apenas código comprovadamente sem consumidor.
- [ ] Executar novamente `node scripts/wiring-audit.js`.

## 10. Gates de commit e release

- [x] `npm run test:release` passa sem falha.
- [x] `git diff --check` passa.
- [ ] Diff contém apenas arquivos esperados.
- [ ] Teste do Reader confirma ausência de fetch direto de tradução.
- [x] Testes de segurança, lifecycle, áudio, tradução e extensão passam.
- [ ] Replay SQL real passa.
- [ ] RLS real com dois usuários passa.
- [x] Build local da extensão passou e o ZIP de v3.0.46 contém os 33 arquivos esperados.
- [x] `npm audit --omit=dev` encontrou 0 vulnerabilidades.
- [ ] Artefato publicado foi escaneado.
- [ ] Revisar status, diff e log antes do commit.
- [x] Criar commit separado e descritivo (`a686fce`).
- [x] Fazer push para `main` (GitHub aceitou `0c33b26..a686fce`).
- [x] Commits de correção/documentação foram enviados para `main`; confirmação independente via `git ls-remote` continua bloqueada por Schannel.
- [ ] Atualizar `HANDOFF.md`.

## Bloqueios conhecidos

- [ ] Credenciais GitHub para confirmação remota ao vivo.
- [ ] Ambiente seguro Supabase para schema, grants e RLS live.
- [ ] Navegador autenticado para reproduzir o hover de Histórias.
- [ ] Não declarar produção concluída sem evidência desses itens.

## 11. Governança criada em 2026-09-19

- [x] Criar Issue #77 para a investigação do hover de tradução em Histórias.
- [x] Criar Issue #78 para o fluxo obrigatório Issue → branch → PR → deploy.
- [x] Criar Issue #79 para motion, skeleton, lazy loading e progresso.
- [x] Criar Issue #80 para observabilidade com OpenTelemetry e backend de erros.
- [x] Criar Issue #81 para lint, análise estrutural, mutation testing e testes.
- [x] Adicionar `AGENTS.md` com instruções persistentes para agentes.
- [x] Reforçar o template de PR com Issue, gates e limites de validação.
- [x] Entregar e fazer merge do PR #82 na `main`.
