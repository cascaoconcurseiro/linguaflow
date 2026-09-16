# Checklist — LinguaFlow

## 0. Proteção e baseline

- [x] Confirmar que `main` local está em `0c33b26`.
- [x] Confirmar que a referência local `origin/main` aponta para `0c33b26`.
- [x] Confirmar que existem referências locais de backup.
- [ ] Revalidar `git ls-remote origin main` quando as credenciais do GitHub estiverem disponíveis.
- [ ] Preservar as 8 alterações locais; não executar reset ou limpeza destrutiva.
- [ ] Separar as alterações locais em branch/commit revisável antes do release.

## 1. Correção imediata do Reader

- [x] Remover o fallback de `fetch` direto para `translate.googleapis.com` em `content/web-reader.js`.
- [x] Manter a tradução do Web Reader pelo service worker, respeitando CORS.
- [x] Definir comportamento explícito quando o service worker estiver indisponível.
- [x] Adicionar regressão que impeça novo fetch direto de tradução no content script.
- [ ] Verificar seleção, Alt+seleção, menu de contexto e duplo-clique.
- [ ] Verificar que controles interativos e elementos editáveis não abrem o popup.

## 2. Revisão das alterações locais

- [x] Revisar `WORD_SAVED` em `background/service-worker.js` e remover o anúncio redundante antes da confirmação remota.
- [ ] Confirmar sincronização da versão em `content/boot.js`.
- [ ] Confirmar origem autorizada de `openWordPopup` em `content/subtitle-engine.js`.
- [ ] Confirmar revogação segura de object URLs em `dashboard/js/core/tts.js`.
- [ ] Confirmar embaralhamento do Builder em `dashboard/js/ui/gameView.js`.
- [ ] Confirmar interrupção de TTS ao sair de Histórias.
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

- [ ] Exportar o schema remoto do projeto Supabase canônico.
- [ ] Comparar tabelas, colunas, tipos, defaults e constraints.
- [ ] Comparar chaves estrangeiras e índices críticos.
- [ ] Comparar assinaturas de RPCs e sobrecargas antigas.
- [ ] Confirmar que todas as migrations foram aplicadas em ordem.
- [ ] Reexecutar replay em PostgreSQL real.
- [ ] Confirmar que não existem mudanças manuais ausentes do repositório.
- [ ] Confirmar que não há consumidor front sem tabela ou coluna correspondente.

## 5. RLS, grants e segurança Supabase

- [ ] Executar isolamento real com dois usuários.
- [ ] Confirmar leitura e escrita owner-only nas tabelas pessoais.
- [ ] Confirmar que usuário comum não executa RPC administrativa.
- [ ] Confirmar que usuário A não opera sobre IDs de B.
- [ ] Confirmar ledgers sem escrita direta do cliente.
- [ ] Confirmar RLS em tabelas pessoais e administrativas.
- [ ] Auditar policies permissivas adicionais.
- [ ] Auditar grants para `anon`, `authenticated`, `public` e `service_role`.
- [ ] Confirmar `SECURITY DEFINER` e `search_path`.
- [ ] Testar lockout, expiração e concorrência administrativa.

## 6. Edge Functions e jobs

- [ ] Confirmar secrets sem expor valores em logs ou cliente.
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
- [ ] Confirmar que migrations, testes, docs, `.env*` e backups não são públicos.
- [ ] Revalidar exposição de `20260913100000_admin_authority_rpcs.sql`.
- [ ] Rotacionar PIN/hash ou credencial exposto.
- [ ] Testar headers nas rotas principais.
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

- [ ] `npm run test:release` passa sem falha.
- [ ] `git diff --check` passa.
- [ ] Diff contém apenas arquivos esperados.
- [ ] Teste do Reader confirma ausência de fetch direto de tradução.
- [ ] Testes de segurança, lifecycle, áudio, tradução e extensão passam.
- [ ] Replay SQL real passa.
- [ ] RLS real com dois usuários passa.
- [ ] Artefato publicado foi escaneado.
- [ ] Revisar status, diff e log antes do commit.
- [ ] Criar commit separado e descritivo.
- [ ] Fazer push para `main`.
- [ ] Confirmar SHA remoto pós-push.
- [ ] Atualizar `HANDOFF.md`.

## Bloqueios conhecidos

- [ ] Credenciais GitHub para confirmação remota ao vivo.
- [ ] Ambiente seguro Supabase para schema, grants e RLS live.
- [ ] Navegador autenticado para reproduzir o hover de Histórias.
- [ ] Não declarar produção concluída sem evidência desses itens.
