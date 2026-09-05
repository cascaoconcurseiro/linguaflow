# Handoff — LinguaFlow

## Última sessão — 2026-09-05

Build local: `3.0.33`. Branch de integração e publicação: `main`.

## Entregue

- Home abre diretamente no primeiro acesso, sem onboarding obrigatório.
  Preferências antigas são preservadas; ausência, JSON inválido ou falha de
  leitura usam meta local de 20 revisões, sem gravar nível ou conclusão fictícios.
- Home interrompe atualizações após cancelamento da rota. Regressão cobre cinco
  estados de preferências e cancelamento em duas fases do carregamento.
- Popup corrige import de db, loading do dicionário, IPA e apresentação CEFR.
- Professor retorna tradução, explicação contextual e pronúncia BR na mesma
  chamada; pronúncia salva permanece prioritária. Trabalho auxiliar em paralelo
  e limite de 320 tokens reduzem esperas, sem promessa de latência de rede.
- Login da extensão abre/reutiliza guia própria e retoma apenas o contexto aberto.
  PWA e extensão mantêm sessões independentes; tokens não são enviados em URLs.
- IA exclusivamente DeepSeek por funções autenticadas; captura de voz removida.
- Documentação ativa reconciliada, com histórico consolidado e pendências reais.
- Usuário solicitou explicitamente commit/push e atualização documental.
  Remoto confirmado: https://github.com/cascaoconcurseiro/linguaflow.
  Integrado o histórico remoto `dbab29b`, preservando o contrato atual de IA.

## Evidência

- Release local completo passou em 05/09 após corrigir contrato estático que
  ainda rejeitava o campo pronunciation_pt. Testes de tradução passaram.
- Auditoria de dependências retornou zero vulnerabilidades conhecidas.
- O gate SQL local verifica contratos do replay; execução real de Postgres e
  isolamento com duas contas são validações separadas.
- Registro anterior: funções deepseek-chat e fluency-assessment publicadas em
  04/09; PWA autenticada respondeu e chamada sem Authorization retornou 401.
  Esses resultados não equivalem à validação do frontend desta atualização.

## Próximo passo concreto

1. Concluir PR da branch `codex/direct-entry-docs`: a main exige PR, histórico
   linear e o check Verify learning engine and release smoke aprovado.
2. Verificar resultado do workflow e publicação da PWA para o commit enviado.
3. Em `dashboard/js/ui/homeView.js::renderHome`, validar conta nova entrando
   diretamente, sem guia, e navegação durante carregamento.
4. Recarregar extensão e vídeo; em `content/word-popup.js::_explainContext`,
   verificar login, retomada, tradução contextual, pronúncia BR e tempo real.
5. Executar Check completo sem captura de voz, ouvir TTS natural e confirmar
   `fluency_skill_profiles` HTTP 200 sem 42703.

## Pendências e limites

- QA de navegador exige conta autenticada; extensão exige recarregamento local.
- Validar isolamento real com duas contas e resultados recentes do monitor RLS.
- Calibração humana, respostas-âncora e acompanhamento D7/D30/D90 continuam abertos.
- Leaked Password Protection estava desativado na consulta de 29/07; revalidar.
- Acesso GitHub autenticado e fetch confirmados. Push direto foi recusado por
  proteção da main (GH006); seguir PR com squash, sem contornar os checks.
- Push não comprova deploy concluído e não recarrega extensões instaladas.
