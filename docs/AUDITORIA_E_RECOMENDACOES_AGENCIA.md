# Auditoria geral — LinguaFlow

**Data:** 2026-09-08  
**Base:** `main` em `590f436`, build `3.0.40` em validação

## Escopo e método

A revisão cobriu extensão MV3, PWA, Supabase, FSRS, undo, tradução e contexto,
configurações, acessibilidade, permissões, conteúdo não confiável, documentação
ativa e gates de release. Os achados foram confirmados no código e confrontados
com testes. Testes locais não provam extensão recarregada, áudio ouvido, sessão
autenticada, duas contas reais ou o estado atual dos painéis externos.

## Trabalho do Antigravity confirmado

- PRs #32 a #34 estão na `main`: FSRS autoritativo, manifesto restrito, legenda
  original do YouTube, neutralização adicional de HTML, diálogo de configurações
  da extensão e restauração autoritativa no undo.
- A migration `20260907100000_server_authoritative_fsrs.sql` consta como aplicada
  no Supabase de produção no registro operacional do projeto.
- O lote local corrige `isMobileVoiceDevice()` e classifica o catálogo privado de
  fluência como contrato offline no auditor de fiação.

## Achados corrigidos neste lote

| Severidade | Falha | Correção |
|---|---|---|
| Alta | Frase, tradução e feedback retornados por serviços entravam em `innerHTML` sem escape. | Todo valor não confiável é escapado e os contratos cobrem os sinks restantes. |
| Alta | `max_interval` não limitava cards graduados por Bom ou Fácil. | Cliente e nova migration aplicam o mesmo teto também na graduação. |
| Alta | Mudar leech de `tag` para `suspend` não suspendia cards já marcados. | A suspensão considera lapsos e configuração atual, inclusive em leeches existentes. |
| Média | Retry da revisão depois de undo devolvia o snapshot pós-review obsoleto. | A RPC detecta o undo e devolve o card atualmente persistido com outcome `undone`. |
| Média | `NaN`/`Infinity` em configurações podiam abortar a RPC. | Cliente rejeita valores inválidos e servidor degrada para defaults finitos. |
| Média | Notification click aceitava destino externo do payload. | Service Worker restringe a navegação ao mesmo origin e usa `/study` como fallback. |
| Média | Modal de placement não tinha semântica e ciclo de foco completos. | Dialog nomeado, Escape, foco inicial, contenção de Tab e retorno ao acionador. |
| Média | Exportação Anki podia gerar HTML inválido e sugeria restaurar FSRS automaticamente. | Conteúdo HTML é escapado e a interface explica que o TSV de agendamento é apenas referência. |

## Governança de migrations

Foi descartado um script local que imprimia `INSERT` direto em
`supabase_migrations.schema_migrations`. Registrar uma versão sem provar o DDL
pode deixar o ambiente permanentemente incoerente. A verificação correta é
somente leitura; qualquer reparo deve usar `supabase migration repair` depois de
comparar objetos e versões. Uma saída anterior registrada no Handoff informa
`Remote database is up to date`, mas isso deve ser novamente verificado antes
de um futuro `db push`.

## Riscos residuais e homologação

1. Aplicar `20260908100000_harden_server_authoritative_fsrs.sql` antes de publicar
   o cliente deste lote e executar seu gate PostgreSQL comportamental.
2. Recarregar a extensão 3.0.40 e testar YouTube: original, tradução tardia,
   flash manual e salvamento da explicação contextual.
3. Confirmar no verso do card que a explicação aparece sem nova chamada de IA.
4. Testar revisão/undo/limites em duas abas e RLS com duas contas reais.
5. Ouvir o TTS natural e validar fallback em aparelho móvel real.
6. Reduzir risco de supply chain dos scripts remotos da PWA, priorizando
   autocustódia de fflate/Kokoro e isolamento do widget YouGlish.
7. Verificar Leaked Password Protection no Auth Advisor do Supabase.
8. Calibrar a avaliação de fluência com julgamento humano e acompanhamento
   D7/D30/D90 antes de fazer alegações de eficácia.

## Evidência automatizada

- `npm run test:release -- --allow-dirty`: verde antes das correções deste lote.
- Contratos focados de HTML não confiável, configurações, FSRS e release smoke:
  verdes após as correções.
- O release completo deve ser repetido depois do diff final e antes do PR.
