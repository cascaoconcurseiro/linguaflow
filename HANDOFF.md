# Handoff — LinguaFlow

## Última sessão — 2026-09-09

Build `3.0.40` publicado na `main` pelo PR #35, squash `3589a9f`.

## Trabalho confirmado do Antigravity

- PRs #32–#34 publicaram FSRS autoritativo, permissões restritas, legenda
  original do YouTube, neutralização adicional de HTML, acessibilidade do painel
  da extensão e restauração do card autoritativo no undo.
- `20260907100000_server_authoritative_fsrs.sql` consta como aplicada no
  Supabase `main PRODUCTION`; o registro anterior também informa histórico de
  migrations reconciliado e `db push` sem pendências.
- O lote local corrige `isMobileVoiceDevice()` e o falso positivo do catálogo
  privado no auditor de fiação.

## Auditoria e correções desta sessão

- Frase, tradução e feedback vindos de IA/provedores são escapados nos sinks
  restantes de HTML.
- Clique de Push aceita somente destino do mesmo origin e cai em `/study` para
  URL externa ou inválida.
- O placement expõe diálogo nomeado, foco inicial, Escape, contenção de Tab e
  retorno ao acionador.
- Configurações SRS validam limites e passos positivos/finitos antes de salvar.
- Exportação Anki escapa HTML e informa que o TSV de agendamento é uma cópia de
  referência, não uma restauração automática do FSRS no Anki.
- Nova migration limita graduações pelo `max_interval`, suspende leeches já
  marcados quando configurado, neutraliza números não finitos e devolve o card
  atual em retry posterior ao undo.
- `20260908100000_harden_server_authoritative_fsrs.sql` foi aplicada no Supabase
  vinculado; o dry-run posterior retornou `Remote database is up to date`.
- README, Estado Atual, contrato pedagógico, índices, backlog, Checklist,
  Changelog e relatório de auditoria foram reconciliados com o build 3.0.40.
- O script local que sugeria `INSERT` direto em `schema_migrations` foi removido
  por poder marcar DDL inexistente como aplicado.

## Evidência

- Release completo do build 3.0.39 passou antes do novo lote.
- O release completo local do build 3.0.40 passou após o ajuste final.
- Os checks obrigatórios de push e pull request passaram no GitHub; o preview
  da Vercel também foi publicado antes do squash merge.
- Teste local não substitui extensão recarregada, áudio ouvido, sessão
  autenticada, duas contas reais ou verificação do painel Supabase.

## Próximo passo concreto

1. Recarregar a extensão 3.0.40 e homologar YouTube, contexto salvo, undo,
   limites, voz e configurações.
2. Validar RLS ao vivo com duas contas e conferir Leaked Password Protection.

## Limites conhecidos

- A PWA ainda executa dependências remotas de fflate, Kokoro e YouGlish no mesmo
  origin autenticado; autocustódia/isolamento reduz o risco de supply chain.
- O nonce da ponte MAIN world é observável pela própria página. Validação de
  origem, tipo, URL e tamanho reduz impacto, mas não autentica contra script da
  página hospedeira.
- Calibração humana e acompanhamento D7/D30/D90 continuam pendentes.
