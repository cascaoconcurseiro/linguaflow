# Backlog atual do produto

**Reconciliado em:** 2026-09-05
**Base:** correções de setembro, build `3.0.33` e suíte de release local verde.

O nome datado foi preservado para não quebrar links, mas o conteúdo abaixo é o
backlog vigente. Itens dos planos antigos só entram aqui depois de nova
verificação no código e no produto.

## P0 — provar o corte já entregue

- [ ] Confirmar no navegador autenticado que `app.js?v=3.0.33` está ativo.
- [ ] Confirmar `fluency_skill_profiles` com HTTP 200, sem `42703`.
- [ ] Validar entrada direta com conta nova, sem guia obrigatório.
- [ ] Executar Check completo sem captura de voz.
- [ ] Validar login pelo popup, retomada de contexto e pronúncia BR.
- [ ] Ouvir “Escuta inédita” e confirmar voz natural igual às demais telas.
- [ ] Testar palavra ambígua em frase real da extensão até Cofre/Estudo.
- [ ] Registrar resultado do monitor live de RLS de dois usuários.
- [ ] Verificar Leaked Password Protection no painel do Supabase, se o plano
  disponibilizar a opção.

## P1 — tornar a avaliação defensável

- [ ] Definir respostas-âncora por nível, habilidade e família de tarefa.
- [ ] Ter ao menos dois avaliadores humanos independentes por amostra de
  calibração.
- [ ] Medir concordância por dimensão e investigar divergências.
- [ ] Medir falsos positivos, falsos negativos e viés por nível e perfil.
- [ ] Definir política de retenção, exclusão e revisão de evidência.
- [ ] Impedir qualquer linguagem de certificado ou exame oficial.
- [ ] Só promover estado `consistente` após repetição em dias e famílias
  diferentes.

## P1 — observar aprendizagem real

- [ ] Observar pelo menos cinco usuários em extensão e PWA sem orientação do
  executor.
- [ ] Medir o funil assistir → capturar → primeira recuperação → revisar →
  transferir.
- [ ] Reavaliar tarefas inéditas em D7, D30 e D90.
- [ ] Separar abandono por problema de produto, conteúdo, autenticação, áudio e
  dificuldade pedagógica.
- [ ] Comparar iniciante, intermediário e usuário experiente de SRS.

## P2 — confiabilidade e operação

- [ ] Mapear cada serviço externo, fallback, limite e impacto de indisponibilidade.
- [ ] Instrumentar taxa de fallback e latência de TTS/IA sem guardar conteúdo
  sensível.
- [ ] Decidir TTS offline somente depois de medir falhas, latência, tamanho e
  compatibilidade dos caminhos atuais.
- [ ] Criar E2E autenticado das jornadas críticas além do monitor isolado de
  RLS.
- [ ] Eliminar o warning de módulos dos testes sem alterar o runtime da
  extensão.
- [ ] Manter release SHA/build visível na investigação de incidentes.

## P3 — manutenção estrutural

- [ ] Caracterizar `studyView.js`, `subtitle-engine.js`, `word-popup.js` e
  `settingsView.js` antes de extrair módulos.
- [ ] Separar gradualmente regras, consultas, estado de sessão, mídia e markup.
- [ ] Não trocar framework nem reescrever o motor de legenda sem evidência de
  que a mudança resolve um problema medido.
- [ ] Preservar contratos de lifecycle, exclusividade de áudio, idempotência e
  proxy de dados durante qualquer extração.

## Decisões que exigem evidência do dono

- [ ] Priorizar TTS offline versus observabilidade/fallback atual.
- [ ] Decidir expansão para C1/C2 somente após conteúdo e rubricas próprios.
- [ ] Decidir novas modalidades somente se os estudos mostrarem uma habilidade
  sem treino suficiente.
- [ ] Decidir mudanças visuais amplas depois do QA das jornadas atuais.

## Entregue — não reabrir sem regressão

- [x] FSRS-4.5, learning/relearning steps, undo e RPCs estreitas.
- [x] Primeira recuperação pós-save.
- [x] Ditado tolerante, rotação determinística, builder e cartão reverso.
- [x] Histórias por nível, variedade e quiz sem texto visível por padrão.
- [x] `known_words` no popup e Reader.
- [x] Entrada direta, nivelamento opcional e recalibração pelo histórico.
- [x] Teto do Cofre, fila de espera e aposentadoria.
- [x] Exportação Anki com agendamento e backup/restore JSON.
- [x] Notificações da extensão e Push da PWA.
- [x] Catálogo privado de fluência, Edge Function e perfil por habilidade.
- [x] Tradução contextual canônica e TTS natural no Check de comunicação.
