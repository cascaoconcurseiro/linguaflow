# Handoff — LinguaFlow

## Última sessão — 2026-09-09

Build `3.0.42` publicado na `main` pelo PR #39, squash `0d2f1c1`.

## Auditoria e correções desta sessão

- Fechados sinks de HTML não confiável no jogo, painel lateral e exportações PDF/Anki; CSV neutraliza fórmulas iniciadas por `=`, `+`, `-` ou `@`.
- O painel da extensão lê `sourceLang` e `uiTheme` persistidos. Tradução continua marcada por padrão.
- A estratégia por viewport foi substituída conforme o requisito confirmado: a extensão solicita uma trilha completa do YouTube e traduz antecipadamente todas as cues da barra lateral em uma fila limitada, entregando cada resultado assim que termina.
- O protótipo paralelo foi preservado em stash, mas parser duplicado, fan-out de blocos, separador frágil e testes com rede real não entraram na implementação revisada.
- Exportação Anki do dashboard inclui explicação contextual e mnemônico já salvos, sem gerar nova chamada de IA.
- Rotas, menus, jogos e modais de Histórias/Cofre receberam títulos, estados de carregamento, foco, Escape, contenção de Tab, nomes acessíveis e retorno ao acionador. Resultados de jogos aguardam ação explícita.
- Nova migration rejeita colisão de evento adaptativo com payload diferente e cria claims atômicos com lease para Push e e-mail. O Resend recebe chave de idempotência estável.
- Novos contratos foram ligados aos gates oficiais de UX e segurança de produção.

## Evidência atual

- O release completo local do build 3.0.42 passou, incluindo o novo contrato de tradução antecipada sem acesso real à rede.
- Os dois gates de release e o preview Vercel do PR #39 passaram antes do squash merge.
- Checks de sintaxe dos módulos alterados, `git diff --check` e a suíte completa de release passaram.
- `npm audit --omit=dev` não encontrou vulnerabilidades no snapshot auditado.
- Cabeçalhos públicos de HSTS, CSP, anti-frame, nosniff, referrer e permissões foram confirmados; o workflow live de RLS consultado estava verde.
- A migration `20260909100000_notification_claims_and_adaptive_idempotency.sql` foi aplicada no Supabase; o dry-run posterior retornou `Remote database is up to date`.
- As Edge Functions `push-reminder` e `email-reengagement` foram publicadas no projeto `qnutoswrufznztoznlql`.
- Os dois gates de release do PR #37 e o preview Vercel passaram antes do squash merge.
- Testes locais não provam extensão recarregada, áudio ouvido, sessão autenticada, duas contas reais ou importação manual no Anki.

## Próximo passo concreto

1. Recarregar a extensão e confirmar que toda a lista lateral começa a preencher ainda no início do vídeo.
2. Homologar contexto do card, exportação Anki, áudio e isolamento com duas contas.

## Riscos residuais conhecidos

- Push Web não oferece chave idempotente no provedor: o claim elimina execução concorrente normal, mas uma resposta de rede ambígua ainda admite duplicata após o lease.
- A busca de legenda ativa percorre a lista completa por frame em vídeos; deve ser otimizada somente com índice temporal que preserve cues sobrepostos.
- Disponibilidade imediata depende de o YouTube expor `captionTracks` e os provedores de tradução responderem; a interface preenche progressivamente e reutiliza cache quando algum serviço demora.
- Dependências remotas de fflate, Kokoro e YouGlish e Actions fixadas por tag mantêm risco de supply chain.
- O nonce da ponte MAIN world é observável por scripts da página hospedeira.
- O gate live de RLS cobre a superfície exercitada pelo workflow, não todas as tabelas. Leaked Password Protection e QA visual/áudio continuam externos.
