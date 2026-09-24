# Auditoria da legenda YouTube — Issue #138

Data: 2026-09-24. Alvo: extensão 3.0.56. Escopo: `youtube-hook`, `subtitle-engine`, barra lateral, frase do card e caminhos de coleta. Sem alteração de Supabase.

## Causas verificadas no código

1. **Fragmentação:** o JSON3 era mapeado evento a evento. Uma frase emitida como eventos por palavra resultava em linhas e cards parciais. O novo agrupador preserva as palavras e a janela temporal, juntando eventos contínuos; pontuação, mudança de falante, pausa de 1,1 s, 8 s e 150 caracteres limitam frases. Uma revisão incremental do ASR substitui o prefixo anterior, sem duplicação. O mesmo array alimenta legenda, barra lateral e contexto de captura. Posição do vídeo continua sincronizada pelo início/fim da frase.
2. **Faixa errada:** a pré-carga aceitava `tracks[0]` quando não encontrava o idioma estudado. Esse fallback podia trocar a língua da frase. Agora somente uma faixa original que corresponda ao idioma é candidata, com preferência pela faixa manual. URL em cache sem `lang`, traduzida ou de outro idioma não gera solicitação. A resposta `ytInitialPlayerResponse` é rejeitada se pertencer a outro vídeo em navegação SPA.
3. **Faixa parcial sobrescrevendo completa:** quando chegava um trecho segmentado após a faixa completa, a mesclagem pela hora inicial podia trocar uma frase longa por um fragmento. A faixa completa substitui fragmentos anteriores da navegação atual. Quando só há segmentos, eles são reagrupados entre respostas e a mesclagem conserva a versão mais longa da mesma língua.
4. **Tradução na linha errada:** o índice do array traduzido não correspondia necessariamente ao índice do original. O pareamento usa proximidade de início (máximo 750 ms); se não houver correspondência, deixa a tradução vazia.
5. **Falhas/requisições duplicadas:** a pré-carga repetia o pedido após falha; um `fetch` interceptado que falhava era executado novamente pelo `catch`; os trechos com `tlang` podiam provocar um pedido original por segmento. Agora cada trilha/navegação tem uma tentativa, o interceptor deixa o player cuidar de retries, e a recuperação de original é limitada a uma solicitação. Os erros HTTP são registrados apenas por status/código, sem URL assinada ou texto.
6. **Frase repetida:** duas ocorrências com texto idêntico eram tratadas como a mesma cue. A seleção agora usa a identidade da cue e atualiza tempo/contexto do card na segunda ocorrência.
7. **Pacote da extensão:** o empacotamento Linux produzia TAR com sufixo `.zip`; isso impedia a instalação do pacote enviado. Agora usa ZIP real, verificado com `unzip -t`, e inclui o novo módulo em `web_accessible_resources` restrito aos players suportados.
8. **Fallback visual:** a legenda nativa era ocultada antes de existir qualquer cue utilizável. Agora ela permanece visível sem faixa válida e volta quando a navegação é reiniciada, a extensão é desligada ou destruída. A barra lateral explica quando faltam legendas do idioma estudado.

## Fontes e limites

- [Ajuda oficial do YouTube: transcrição automática](https://support.google.com/youtube/answer/6373554?hl=en): o próprio reconhecimento pode errar por sotaque, ruído, pronúncia, falas sobrepostas e áudio multilíngue. A engine não deve inventar palavras que não estão na faixa. O autor pode revisar a faixa no YouTube Studio; o espectador não tem essa autoridade.
- [YouTube Data API `captions.download`](https://developers.google.com/youtube/v3/docs/captions/download): acesso sem autorização suficiente retorna 403. A API oficial não é uma solução gratuita universal para baixar legendas de vídeos de terceiros.
- [Políticas oficiais da API do YouTube](https://developers.google.com/youtube/terms/developer-policies): proíbem scraping em determinados contextos e impõem restrições ao uso de métodos não documentados. A extensão ainda usa interfaces internas já existentes (`getPlayerResponse`, `timedtext`); limitar chamadas reduz pressão, mas não garante ausência de bloqueio nem conformidade automática. Uma avaliação de política/licenciamento para distribuição pública permanece pendente.

## Verificação e rollback

Testes unitários/contrato RED→GREEN: eventos ASR por palavra, rolling revisions, pausas/pontuação/falante, tradução desalinhada, seleção de idioma, 429 sem retry, erro de fetch sem duplicação, segmento parcial após faixa completa, faixa completa após segmentos, fragmentos em respostas consecutivas, fallback nativo, frase idêntica repetida. Build ZIP validado com `unzip -t`. Testes de lifecycle/bridge e release pelo CI. Não foi possível comprovar nesta sessão a captura com extensão instalada num vídeo real do usuário; player e legendas variam conforme vídeo, conta e navegador. Reverter 3.0.56 restaura o comportamento 3.0.55; nenhuma migration.

Perguntas operacionais: (1) com que frequência a faixa de origem não está disponível? (2) quais HTTP status impedem a pré-carga? (3) há retries de fetch ou requests além do limite por navegação? (4) o usuário recorre à legenda oficial quando não há cues? O console traz códigos/estado delimitados; métricas agregadas de produção não estão instrumentadas e não devem ser afirmadas como existentes.
