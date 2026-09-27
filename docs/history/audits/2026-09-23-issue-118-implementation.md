# Issue #118 · Primeira estabilização de aprendizagem

## Entrega e limites

- Listening da extensão: exige confirmação explícita do idioma do áudio; a legenda e a preferência de estudo não servem como prova. Conta apenas progressão audível do vídeo com a aba visível, sem anúncio, pausa, seek ou buffer. Velocidades diferentes convertem tempo de mídia em tempo real. Troca de faixa de áudio observável invalida a confirmação. Alguns players não expõem troca de dublagem; a pessoa deve atualizar manualmente a escolha.
- Intervalos de 1–60 s entram na fila local por conta e são enviados com ID estável. RPC autenticada valida duração, data, conta, sobreposição e idempotência; rejeita inflação óbvia e não concede XP. Offline acima de sete dias expira. A origem é declarada pelo dispositivo, não prova que a pessoa compreendeu ou ouviu o áudio de fato.
- Histórico de vídeos/extension sem idioma verificável migra para `und`; Home mostra tempo sem idioma separado do idioma selecionado. Max conta como vídeo. Escrita manual entra nos totais, e leitura das sessões pagina o histórico integral. Falha na leitura mostra indisponibilidade, não zero.
- O check utiliza tarefas emitidas pelo servidor, o áudio correspondente à tarefa autenticada e o contrato real de submissão/avaliação, com IDs e payload congelados para retry. Rascunhos ficam por conta; o legado sem dono é descartado. Uma avaliação textual guiada não constitui evidência oral. O transcript é acessível ao próprio usuário via RPC para TTS no cliente, então o listening ainda permite inspeção técnica do texto: a avaliação não deve ser vendida como exame antifraude.
- Revisões de cards não recalibram nível CEFR global. Estimativa lexical passa a retornar apenas `lexicalBand` e `level:null`; configurações/placement já existentes não são reclassificados retroativamente.

## Implantação

1. Antes do cliente, aplicar em ordem a migration já versionada `20260921160000_multimodal_study_and_language_tracking.sql` que ainda falta no projeto hospedado, seguida de `20260923091833_stabilize_learning_contracts.sql`. Conferir schema REST após notify; não aplicar apenas a segunda. Revisar a contagem de sessions `en`/`und` para fontes históricas e registrar os números antes/depois.
2. Fazer deploy de PWA e carregar extensão v3.0.52 após CI, revisão e QA autenticada com uma conta descartável: confirmar inglês em um vídeo Max/YouTube, tocar 15 s, pausar, trocar a velocidade, deixar aba em segundo plano, selecionar português, testar perda de rede/sincronização, tentar o check e recarregar. Verificar histórico e inexistência de duplicação.
3. Rollback do cliente: voltar a versão anterior da PWA/extensão. As migrations são expand-only exceto a normalização do idioma de histórico de vídeo, que é intencional e não deve ser revertida para `en` por adivinhação. Se a RPC apresentar erro, parar novos envios pelo cliente e manter a fila local. Não apagar intervalos ou reclassificar idioma sem evidência.

## Validação e monitoramento

- Testes Node do contador, isolamento de rascunho, agregados e retry, e replay das 56 migrations com teste transacional de idempotência, RLS/ACL e acesso entre contas em PGlite. A CI com PostgreSQL real deve passar também; PGlite não prova concorrência nem substitui o projeto hospedado.
- Prévia de navegador offline mostra tarefa emitida e tratamento de falha de áudio; ainda faltam testes de vídeo nos players reais, áudio TTS real, Chrome MV3, duas contas reais e avaliação Edge no ambiente hospedado.
- Perguntas operacionais: qual fração dos intervalos fica pendente ou expira na fila? Quantos são rejeitados por auth/duração/sobreposição? Qual a taxa de checks iniciados, submetidos e avaliados? Quantas leituras de horas falham? O cliente registra erros com nomes de evento sem token/URL; métricas agregadas e alertas ainda são trabalho posterior, e não devem ser declarados operantes.
- Pedagogia pendente: diálogo interativo efetivo, leitura oral e estimativa validada, catálogo maior que duas tarefas por habilidade/nível, feedback por critério com evidências longitudinais e avaliação de aprendizagem com usuários. Não interpretar horas ou duas respostas guiadas como nível CEFR.
