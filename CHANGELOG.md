# Changelog

## [Não lançado]

### Alterado
- **Card da palavra mais limpo**: a definição em inglês do dicionário saiu de baixo da tradução (às vezes contradizia o sentido da frase). As abas agora dizem o que têm: "Dicionários" (Reverso, Linguee e Google Tradutor) e "Pronúncia" (vídeos do YouGlish).
- **Passar o mouse numa palavra mostra uma dica rápida, não o card inteiro**: a dica traz só a palavra: a tradução e as outras traduções por classe gramatical, sem a legenda inteira e sem chamar a IA. O card completo (contexto da IA, salvar, exemplos) abre com um clique. Com o card já aberto, passar o mouse em outra palavra continua trocando o card. A pausa ao passar o mouse segue a configuração que você já tinha.
- **"Contexto nesta frase" aparece enquanto a IA escreve**: antes, o popup esperava a resposta inteira da IA (alguns segundos) para mostrar qualquer coisa. Agora a tradução no contexto entra no título assim que a IA a escreve, e a explicação vai aparecendo em seguida. Reabrir a mesma palavra na mesma frase é instantâneo, mesmo depois de a extensão ficar ociosa (a resposta fica guardada no navegador por 30 dias). "Analisar frase completa" também aparece enquanto é gerada. Trocar de palavra no meio cancela o pedido anterior.
- **Leitor em qualquer site mostra a tradução sem esperar a IA**: a tradução rápida aparece assim que chega e é trocada pela tradução no contexto quando a IA responde. Antes, as duas esperavam juntas. O botão Salvar continua liberando só depois da IA, para o card receber o sentido da frase.
- **"Explicar esta fala" aparece enquanto a IA escreve**: no roteiro do vídeo, a tradução natural e o sentido da fala vão surgindo em vez de ficar só o carregamento; as expressões entram no final. Reabrir continua instantâneo pelo cache.
- **Primeiro clique numa palavra abre mais rápido**: os bancos de expressões, phrasal verbs e gírias carregam em paralelo e já são pré-carregados quando o player abre.
- **Toda resposta da IA começa um pouco mais cedo**: o servidor da IA passou a conferir o login do pedido localmente (assinatura do token), sem uma consulta extra ao serviço de autenticação a cada chamada. Uma sessão encerrada em outro dispositivo continua aceita até o token expirar (até 1 hora); o limite de pedidos por minuto não mudou.
- **Home mais enxuta e acionável**: "Hoje" volta a ser o primeiro item do menu, antes de Cursos. "Cards Críticos" vira "Palavras que não estão fixando": lista só palavras esquecidas 3+ vezes (mesmo critério da sessão de reforço), mostra quando o item foi sinalizado e tem o botão "Reforçar" para as vencidas. A dificuldade interna do FSRS deixou de aparecer. A Home mostra no máximo um alerta por vez (retorno, ofensiva ou cofre), e as horas de estudo foram para "Métricas detalhadas". Cada palavra tem "Ver no Cofre" (abre o Cofre já filtrado) e "Pausar" (com confirmação; reativável no Cofre).
- **Card de estudo com a organização do player de Cursos**: uma coluna centralizada, contadores em pílulas e, no verso, um painel único com tradução, pronúncia, palavra estudada e explicação, nesta ordem. Trecho original e "Entender melhor" passam a ficar abaixo do painel, recolhidos, em vez de coluna lateral. A lógica de revisão não mudou.
- **Verso do card sem rolagem, com atalhos como no curso**: após virar aparecem só frase, tradução e IPA. Palavra (P), Por quê (X), Trecho original (V) e Outros contextos (O) abrem por atalho ou botão, um de cada vez, no mesmo lugar; Esc fecha. Botão de algo que o card não tem fica escondido.

- **Roteiro do vídeo ao lado, sem cobrir o vídeo**: a barra lateral deixou de escurecer e desfocar a página; dá para assistir e ler ao mesmo tempo. As palavras do roteiro são clicáveis (abre o popup de palavra) e têm a cor do seu status; a busca destaca o termo em cada fala; enquanto a legenda carrega aparece um esqueleto, separado do aviso de "legenda indisponível". Cada trecho tem botões "Tocar a partir de…" e "Repetir" acessíveis por teclado e leitor de tela.
- **Aba Palavras do roteiro mais útil e honesta**: nova seção "Palavras-chave deste vídeo" com as palavras que mais aparecem e você ainda não marcou, cada uma com "Já sei" e "Ver e salvar". As palavras são contadas por forma base (running/ran contam como run) e nomes próprios ficam de fora. O antigo score "Fluente/Desafio" virou "X% das palavras deste vídeo você já marcou como conhecidas ou dominadas", e só aparece depois de você marcar alguma. O explorador de frases destaca a forma que aparece na fala (ex.: "looked it up", "turns"). A aba segue o tema claro/escuro e funciona por teclado.
- **Menos falso alarme de gíria e phrasal verb**: palavras comuns só contam como gíria na construção de gíria ("here's the tea", "that's fire", "he's loaded"); "I drink tea" ou "the goat ate the grass" não são mais gíria. Verbo + preposição comum ("look at", "add to", "act as", "need to") deixou de ser sublinhado como phrasal verb; continuam os idiomáticos ("look after", "come across", "give up", "run out of"). A legenda, o roteiro, a aba Palavras e o popup usam a mesma detecção. Num conjunto de frases de referência a precisão foi de 60% para 100% (phrasal) e de 45% para 100% (gíria); em frases novas, 86% e 100%.

### Adicionado
- **"Ignorar esta palavra" no card**: para nomes, interjeições ("yeah", "uh") e ruído da legenda automática. A palavra fica sem cor na legenda, sai da aba Palavras e da porcentagem de compreensão, e não conta como conhecida em nenhuma estatística. Vale no site e na extensão (fica salvo na sua conta) e se desfaz no próprio card com "Deixar de ignorar".
- **Card da palavra com "Outras traduções" e "Neste vídeo"**: além da tradução principal, o card lista as traduções por classe gramatical ("let" — verbo: deixar, permitir…; substantivo: impedimento…), com a forma base quando a palavra está flexionada ("filming" → film). Também mostra até 3 outras falas do mesmo vídeo com a palavra (inclusive "filmed", "films"), com a tradução quando disponível e o botão ▶ "Ouvir no vídeo", que fecha o card e toca a partir daquela fala. As seções só aparecem quando há conteúdo.
- **Legenda mostra a fala natural**: a legenda automática escreve "going to", mas a pessoa fala "gonna". Agora esses trechos ganham a forma falada em miniatura ("going to ≈gonna", "want to ≈wanna", "have to ≈hafta", "kind of ≈kinda", "should have ≈shoulda"…), só quando é futuro/redução de verdade ("going to the store" não é marcado). Reduções já escritas (gonna, tryna, 'cause, y'know, c'mon, 'em…) aparecem como fala reduzida com o significado, "I'd" mostra se é "I had" ou "I would" pela palavra seguinte, phrasal verbs separados pelo objeto ("turn the lights off", "pick the kids up") passam a ser reconhecidos e há marcadores de conversa (you know, I mean, "was like"). Cada tipo tem um traço próprio (pontilhado, ondulado, tracejado, duplo), não só uma cor, e pode ser ligado ou desligado em Configurações › Imersão e destaques. Marcadores começam desligados.
- **"Explicar" em cada fala do roteiro**: a IA explica a fala usando a anterior e a seguinte, com tradução natural, o que a pessoa quis dizer e o sentido das expressões naquele contexto ("take off" = decolar, tirar a roupa ou fazer sucesso). Usa a mesma conta/chave de IA do tutor, mostra "Explicando…" enquanto carrega, pede login quando não há sessão e oferece "Tentar de novo" se falhar. Fica guardado no navegador por vídeo e fala, então reabrir é instantâneo.

### Corrigido
- **Aviso falso na lista de erros da extensão**: todo vídeo registrava "caption_track_empty" como aviso, embora a legenda carregasse normalmente pelo próprio player. Agora esse caso esperado só aparece no log de depuração, e a lista de erros mostra apenas falhas reais.
- **Segurança do cache de palavras compartilhado**: o dicionário comum que acelera as explicações passou a recusar gravações gigantes e guarda no máximo 20 contextos por palavra, para ninguém conseguir inchar ou poluir o cache de todos. Nenhuma conta pode mais esvaziar tabelas inteiras (TRUNCATE).
- **Aba Palavras não perde mais "thing"**: o agrupamento por forma base juntava "thing" com "the" (e ela sumia da lista) e "hoping" com "hop". Agora só junta flexões de verdade (films → film, hoping → hope, running → run).
- **"Contexto nesta frase" sem suposições**: a IA deixou de supor o assunto do vídeo além do que a fala diz (ex.: "provavelmente Halloween" para "it's not September yet"). Explicações antigas guardadas no navegador são descartadas e geradas de novo.
- **Legenda automática do YouTube em trechos maiores e mais fáceis de acompanhar**: a legenda gerada automaticamente aparecia em pedaços de ~7 palavras (cerca de 2 s), cortados no meio da frase. Agora ela mostra até duas linhas por vez (~14 palavras), preferindo terminar no ponto final — o mesmo ritmo do player do YouTube. Vale para a legenda na tela, o roteiro, o "Explicar" e a pausa automática. A tradução continua correspondendo ao trecho exibido, e nomes próprios ("September") e começo de citação não viram mais minúsculos ao juntar pedaços.
- **Legenda presa depois de pular o vídeo**: ao pular de uma fala para um trecho sem fala (música, silêncio, abertura), a legenda anterior continuava na tela até a próxima fala começar, tocando ou pausado. Agora ela some no mesmo instante.
- **Legenda do YouTube não iniciava ao trocar de vídeo**: a legenda baixada pelo player durante a navegação interna do YouTube era descartada pela ponte de segurança (nonce antigo) e nunca reenviada; ficava só a legenda nativa traduzida até um Ctrl+Shift+R. Agora a última faixa capturada do vídeo atual é reenviada assim que a ponte é renovada.
- **Botão CC desligando sozinho após várias trocas de vídeo**: cada navegação somava um novo listener de `play` no mesmo `<video>`, clicando o CC várias vezes por play.
- **Nível CEFR do painel do vídeo não chegava ao site**: trocar o nível no painel de legendas gerava ReferenceError (`db` não importado) e o nível não sincronizava. O teste de variáveis não declaradas passa a cobrir também a extensão (`content`, `background`, `popup`).
- **Sessão caía com o token de renovação ainda válido**: qualquer 401 deslogava na hora. Com o relógio do PC atrasado alguns minutos, o token parecia válido localmente e o servidor recusava. Agora o 401 força uma renovação e repete a chamada uma vez; só desloga se a renovação for recusada.
- **Palavra salva que o servidor recusava sumia em silêncio**: o popup confirmava "salvo" e a fila repetia o envio a cada minuto para sempre. Agora uma recusa do servidor (4xx) para de repetir, e o popup da extensão mostra as palavras aguardando sincronização e as que não puderam ser salvas, com "Tentar de novo" e "Descartar" (com confirmação). Deslogado, o popup avisa quantas palavras vão sincronizar ao entrar.
- **Histórias: cada tema gera o tipo de texto escolhido**: auto-ajuda, biografia e não-ficção geravam um conto de ficção com personagens e diálogos. Agora temas de auto-ajuda geram um texto de auto-ajuda falando com o leitor, "Biografia" gera a biografia de uma pessoa real, e os temas de fatos reais geram um texto informativo, sem diálogos nem personagens inventados. Textos desses temas gerados antes da correção deixam de ser reaproveitados.
- **Pausa automática em falas longas**: falas com mais de ~8 s nunca pausavam e a legenda sumia antes de a pessoa terminar. Agora a legenda fica até o fim real da fala (com limite só para trechos presos em música/silêncio) e a pausa acontece mesmo a 2x ou quando a próxima fala já começou.
- **Barra lateral destacava outra frase**: a tela e o roteiro escolhiam a fala ativa por regras diferentes; agora usam a mesma.
- **Netflix: roteiro, loop e anterior/próxima**: as falas eram gravadas com o fim ~2 horas depois e repetidas a cada mudança de texto. Agora cada fala fecha quando o texto muda ou some, sem duplicar ao voltar o vídeo.
- **Idioma do áudio do vídeo**: o seletor para corrigir vídeo dublado estava escondido. Volta como uma linha recolhida no topo do roteiro ("Áudio: … · corrigir").
- **Botão de tradução rápida** não troca mais o ícone por texto depois do primeiro uso e tem nome para leitor de tela.
- **Legenda do YouTube às vezes não aparecia ao abrir um vídeo**: se o player baixava a legenda antes de a extensão começar a escutar, a resposta se perdia, e a busca direta volta vazia (falta o token do player). Agora, sem legenda capturada, a extensão pede ao próprio player que recarregue a faixa original uma vez por vídeo.
- **Velocidade escolhida não valia ao abrir outro vídeo**: o botão mostrava 0.75× com o vídeo em 1×, porque o YouTube volta a velocidade ao padrão quando carrega a mídia. Agora a velocidade salva é reaplicada a cada vídeo carregado. O teste dos controles do player (`test:max-ui`) encerrava o processo antes de executar e passa a rodar de verdade.
- **Vídeo sem legenda ficava em silêncio**: quando o YouTube não tem legenda no idioma do vídeo, a LinguaFlow mostra por alguns segundos "Este vídeo não tem legenda em inglês." (anunciado a leitores de tela), em vez de parecer que falhou.

## [3.0.59] - 2026-09-27

### Adicionado
- **Cursos**: nova área no site para ouvir frases do inglês cotidiano e escrevê-las palavra por palavra (modos fácil, médio e difícil), com tradução, IPA e explicação de cada expressão, Caderno de Erros, revisões espaçadas e vocabulário salvo. Começa com 1 curso (A1, 10 frases); o catálogo mostra só o que tem conteúdo. Resultado gravado por RPC idempotente, com reenvio se a rede cair.

### Corrigido
- **Voz neural em produção**: a função `tts` passa a fazer o handshake com a Microsoft à mão sobre TLS; antes a Microsoft recusava (403) e todo áudio caía no Google sem aviso.

## [3.0.58] - 2026-09-27

### Adicionado
- **Síntese de Voz Neural Microsoft (Edge TTS)**: Integração com vozes neurais de alta fidelidade da Microsoft (`en-US-JennyNeural`, `pt-BR-FranciscaNeural`, `es-ES-ElviraNeural`, etc.) sem custo e sem necessidade de cartão/chave de API, com fallback transparente para Google TTS e compatibilidade total com o cache offline do IndexedDB (`lf-audio-cache`).
- **Pipeline em Segundo Plano (Background Pre-warming) no Estudo**: Pré-geração e resolução em 2º plano de IPA, traduções contextuais e áudio natural da frase seguinte (`dueQueue[1]`) e subsequente (`dueQueue[2]`), garantindo transições sem espera e sem telas travadas em "Gerando pronúncia...".
- **Cache Léxico Canônico Multi-tier (FinOps)**: Resolução de IPA e contexto em 3 níveis (L1 RAM, L2 Local Storage offline-first, L3 Supabase RPC) com de-duplicação de requisições concorrentes, impedindo chamadas repetidas à IA para termos ou frases já enriquecidos.
- **Inteligência de Mídia no YouTube**: Detecção automática de palavras por minuto (WPM) e connected speech (reduções coloquiais, linking consoante + vogal, elisões e assimilação palatal).
- **Temas Expandidos de Histórias**: Geração de contos adaptativos calibrados por CEFR com novos temas de Auto-ajuda e Histórias Reais.
- **Padronização de Testes**: Adicionado comando canônico universal `npm test` e atalhos por domínio (`test:fsrs`, `test:ext`, `test:ui`, `test:db`).

### Corrigido
- **Atalhos do Player & Auto-Pause**:
  - Resolução do loop infinito de auto-pause ao pressionar Espaço (a verificação de término de legenda causava re-pausa imediata no syncLoop de 60fps).
  - Captura prioritária de eventos de teclado com `capture: true` e parada estrita de propagação (`stopPropagation`, `stopImmediatePropagation`), evitando conflitos e cancelamentos mútuos com o player nativo do YouTube.
  - Eliminação de concorrência na tecla `O` (duplo toggle no painel de configurações), adição do atalho `R` para o overlay de revisão e repetição resiliente com `S` mesmo quando o playback alcança o final exato da frase.
- **Persistência de Chunks e Fonética**: Correção de dupla serialização JSON em `parseChunks`/`persistChunks`, inclusão de `ai_chunks` nos campos permitidos de `updateWord` e atualização atômica da tabela `words`.
- **Merge Inteligente no Banco**: Migration `20260927120000_canonical_lexicon_update_merge.sql` corrigindo a RPC `get_or_cache_canonical_lexicon` para atualizar frases existentes com fonéticas e traduções mais ricas.
- **FSRS Math Hardening**: Recuperação resiliente de estabilidade zerada, sanitização de NaN e valores negativos no motor de repetição espaçada.
- **Normalização Fonética IPA**: Normalização de estresse fonético, fontes tipográficas com glifos completos e eliminação de pronúncia abrasileirada inconsistente.
- **Persistência de Explicação Contextual**: Reutilização segura da explicação sem requisições redundantes de IA e sem duplicação de texto no card.
- **Segurança & Resiliência de Mídia**: Eliminação do proxy de terceiros `allorigins.win`, throttling com `requestAnimationFrame` no MutationObserver do YouTube e prevenção de estouro de quota no `chrome.storage.local`.

### Refatoração
- **Decomposição Modular**: Modularização em repositórios desacoplados (`settings`, `stories`, `word-popup`, `subtitles`, `service-worker`).
- **Limpeza de Documentação**: Consolidação da arquitetura viva em `docs/ARQUITETURA.md` e arquivamento de diários de bordo legados em `docs/history/`.

## [3.0.46] - 2026-09-12

### Corrigido
- **Ditado e Exercícios de Escrita**: O sistema agora valida e exibe explicitamente o resultado da digitação do aluno (Correto / Quase lá / Incorreto) com comparativo do texto digitado versus resposta correta, corrigindo o problema em que a revelação do verso sobrescrevia o feedback da verificação.
- **Dicionário e Phrasal Verbs**: Termos compostos (ex.: "face off", "give up") não travam mais em `(Carregando dicionário...)`. Detecção prévia de termos com espaço pula a consulta inútil à DictionaryAPI e exibe a tradução contextual e análise em 3s em vez de travar por 7s.
- **Auditoria de Banco e Telemetria**: Adicionada migração de hardening relacional e tabela `db_audit_telemetry`. Métodos de auditoria adicionados a `db.js`.
- **Dashboard e Visualização**: Correções pontuais de rendering na visualização de cards, modais e gestão de filas de revisão.

## [3.0.45] - 2026-09-11

### Adicionado
- **Reset de Card**: Funcionalidade para resetar card individual para o estado `new` mantendo integridade dos dados históricos de revisão.

### Corrigido
- **Auto-scroll de Legendas**: Corrigido scroll automático da lista lateral de legendas durante a reprodução no player.

## [3.0.44] - 2026-09-11

### Corrigido

- Cadastro reconhece os tokens retornados na raiz pela API REST do Supabase,
  persiste a sessão e permite entrada direta na Home quando a confirmação de
  email está desativada. Antes, a sessão era ignorada e a tela afirmava que um
  email de confirmação havia sido enviado.
- Teste de regressão cobre resposta REST, envelope de sessão, persistência,
  invalidação de cache e resposta sem token. Versão do cache PWA atualizada.

## [3.0.43] - 2026-09-09

### Corrigido

- A tradução antecipada da barra lateral passa pelo service worker da extensão,
  que possui as permissões de host necessárias, em vez de fazer `fetch` a partir
  do origin do YouTube e ser bloqueada por CORS.
- Falha do proxy não repete a chamada pelo transporte bloqueado da página; o
  service worker valida remetente e limita o texto antes de encaminhar.

### Validação

- Novo contrato diferencia content script, página da extensão, service worker e
  PWA e impede regressão para acesso direto ao Google no contexto do YouTube.

## [3.0.42] - 2026-09-09

### Corrigido

- A barra lateral solicita a trilha completa do YouTube no início e antecipa a
  tradução de todas as cues, inclusive as que ainda estão fora da rolagem.
- A fila entrega cada tradução à interface assim que ela termina, preserva a
  ordem e limita concorrência a 12 chamadas para evitar rajadas sem atrasar a
  lista inteira até a última resposta.
- Troca de vídeo ou idioma invalida resultados tardios; a pré-carga usa uma
  única URL `json3` sem `tlang`, `t`, `range` ou `spv` e não dispara fan-out de
  blocos nem depende de rede nos testes.

### Validação

- Contratos cobrem concorrência real da fila, ordem, preenchimento de todas as
  cues, pré-carga da trilha completa e ausência da estratégia por viewport.

## [3.0.41] - 2026-09-09

### Corrigido

- Configurações persistidas de idioma original e tema voltam a ser carregadas
  pelo painel da extensão; a tradução permanece ativada por padrão.
- A barra lateral traduz somente legendas próximas da área visível, evitando
  milhares de requisições em vídeos longos, e escapa traduções antes do HTML.
- PDF, CSV e exportações Anki neutralizam HTML e fórmulas de planilha; o Anki
  principal inclui a explicação contextual e a dica já salvas no card.
- Jogos, Histórias, Cofre, menus e rotas receberam foco previsível, nomes
  acessíveis, teclado completo e resultados que não desaparecem sozinhos.
- Sinais adaptativos rejeitam reutilização divergente do mesmo evento.
  Push e e-mail reservam atomicamente cada envio; e-mail também usa chave de
  idempotência estável no provedor.

### Validação

- Novos contratos cobrem conteúdo não confiável, carregamento limitado de
  traduções, acessibilidade, exportação contextual e concorrência do backend.

## [3.0.40] - 2026-09-08

### Corrigido

- O teto máximo também limita a primeira graduação por Bom/Fácil, e cards leech
  existentes podem ser suspensos após a mudança da configuração.
- Retry de uma revisão já desfeita devolve o card atual; valores SRS não finitos
  degradam para defaults e a interface impede persistir entradas inválidas.
- Frase, tradução e feedback de IA são escapados nos sinks restantes.
- Notificações Push só navegam dentro da PWA; placement ganhou diálogo e ciclo
  de foco; a exportação Anki descreve corretamente o sidecar de agendamento.

### Validação

- Contratos comportamentais cobrem o endurecimento FSRS, HTML não confiável,
  configurações, acessibilidade e navegação de notificações.

## [3.0.39] - 2026-09-07

### Corrigido

- A RPC de revisão calcula a transição FSRS no servidor, sob bloqueio do card,
  e ignora propostas de estado do cliente mantendo a assinatura compatível.
- O cliente aceita somente o card e o snapshot de undo devolvidos pelo servidor.
- As configurações completam nomes, estados pressionados e anúncios acessíveis
  para CEFR, voz, velocidade, Kokoro, push, e-mail e posicionamento.
- O carregamento da extensão no Chrome falhava por match pattern inválido com
  subcaminho em `web_accessible_resources[1]`; o padrão foi corrigido para origem (`*://*.amazon.com/*`).
- No YouTube, legendas auto-traduzidas (`tlang=pt`) eram aceitas como idioma
  original; o engine agora força a trilha de origem no player e remove `tlang` para carregar a legenda no idioma original.

### Segurança

- O manifesto substitui hosts genéricos por provedores HTTPS explícitos e limita
  recursos acessíveis à Web aos módulos realmente carregados por cada integração.

### Validação

- Contratos novos cobrem a autoridade FSRS, as permissões mínimas, padrões de match
  do manifesto e isolamento de tlang no ciclo de vida de legendas.

## [3.0.38] - 2026-09-06

### Corrigido

- A fila consulta learning, review/mature e novos separadamente, aplica tópico
  antes dos limites e suporta até 1.000 revisões sem starvation entre estados.
- O canal de legendas valida origem, navegação, nonce rotativo, tipo, URL,
  protocolo e tamanho do payload antes de aceitar mensagens da página.
- O popup de palavras ganhou diálogo e abas ARIA, foco contido e restaurado,
  teclado completo, chips nativos, contraste AA e movimento reduzido.

### Validação

- Novos contratos de fila, ponte de legendas e acessibilidade integram o gate
  oficial de release.

## [3.0.37] - 2026-09-06

### Corrigido

- O popup encerra tradução e dicionário com estado visível mesmo quando uma
  API externa trava; o dicionário tenta Dictionary API, Datamuse e Wiktionary
  dentro de um orçamento compatível com a espera da interface.
- Uma falha no `Desfazer` preserva a tentativa para repetição; após adiar um
  card, o botão não aponta mais para uma avaliação anterior.
- Campos das configurações e grupos de voz possuem nomes acessíveis.

### Segurança

- O proxy de dados da extensão passou a aceitar somente métodos públicos
  enumerados e bloqueia acesso ao helper REST interno `_fetch`.
- Termos persistidos são escapados também no editor do Cofre, no progresso do
  backfill e no reencontro de Histórias.
- Undo ignora snapshots enviados pelo cliente e reutiliza o estado anterior
  imutável do evento, inclusive após retry idempotente.
- FSRS calcula estabilidade com a dificuldade anterior; limites SRS inválidos
  voltam a defaults finitos e limitados.

### Validação

- Gate funcional completo e smoke com árvore intencionalmente alterada passaram.

## Atualização de código — 2026-09-05 (build 3.0.33)

- Primeiro acesso abre o dashboard sem onboarding obrigatório; preferências
  ausentes, inválidas ou indisponíveis não bloqueiam a Home.
- Meta anterior preservada; novas contas usam 20 revisões como padrão local,
  sem gravar nível ou conclusão de onboarding fictícios.
- Home interrompe atualizações após cancelamento da rota.
- Popup corrige import de banco, carregamento do dicionário e classificação CEFR.
- Professor explica blocos no contexto e retorna pronúncia brasileira no mesmo
  JSON; pronúncia salva permanece prioritária.
- Consulta de sessão local e tarefas paralelas reduzem esperas antes da resposta.
- Convite de login da extensão reutiliza uma guia e retoma o contexto aberto.
- IA exclusivamente DeepSeek autenticada; removida captura de voz do aluno.
- Novas regressões de entrada direta, dicionário, pronúncia e autenticação;
  contrato de tradução atualizado. Release completo e auditoria de dependências
  passaram localmente; QA autenticado e confirmação do deploy continuam separados.
- Documentação ativa reconciliada; planos antigos permanecem no histórico Git.

## [3.0.33] - 2026-07-29

### Corrigido

- Alinha `getFluencyProfiles()` ao schema canônico
  (`evidence_status` e `authoritative_attempt_count`), eliminando `42703`.
- Sincroniza manifest, PWA, HTML e cache do Service Worker no build `3.0.33`.

### Documentação

- Cria uma página canônica de estado atual.
- Reescreve Blueprint, Checklist, Handoff, índices e backlog com base em
  `main`, testes e estado de produção registrado.
- Marca planos/auditorias anteriores como históricos ou superados.
- Diferencia alinhamento CEFR de exame ou certificação oficial.

## [3.0.32] - 2026-07-29

### Corrigido

- O Check de comunicação usa o pipeline de TTS natural compartilhado.
- Reprodução é cancelada ao trocar de etapa/rota e só conta após terminar.
- Web Speech permanece apenas como fallback de indisponibilidade.

## Corte de fluência e tradução contextual - 2026-07-28/29

- Catálogo privado de 32 tarefas A1–B2, autoridade SQL e Edge Function
  `fluency-assessment`.
- Migrations aplicadas no Supabase canônico e índices de FKs adicionados.
- Tradução contextual promovida da captura ao card sem hardcode por palavra.
- QA autenticado de navegador e calibração humana permanecem gates.

## Operação de produção — 23/07/2026

- Adicionado monitor diário autenticado de RLS com dois usuários reais.
- O teste prova isolamento de leitura, alteração, exclusão e criação por proprietário.
- Credenciais ficam somente nos Secrets do GitHub e o dado de prova é removido ao final.
- O cliente web passou da chave `anon` legada para a chave publicável atual do Supabase.

As mudanças relevantes do LinguaFlow são registradas aqui. O projeto segue
[Versionamento Semântico](https://semver.org/lang/pt-BR/) para os pacotes
publicados.

## [3.0.31] - 2026-07-23

### Corrigido

- Impede que permissões tardias do microfone reabram a gravação após sair do
  treino e encerra recursos de áudio ao trocar de tela.
- Descarta respostas adaptativas obsoletas e listeners de telas desmontadas.
- Deduplica no banco o mesmo intervalo de estudo entre abas e origens, mantendo
  o Supabase como autoridade do tempo de atividade.
- Serializa sinais simultâneos do mesmo card para preservar o estado adaptativo.
- Torna o rate limit das Edge Functions atômico e limita o tamanho dos pedidos.
- Inclui a versão do cliente na telemetria de erro e sincroniza PWA, service
  worker e extensão na versão 3.0.31.

### Segurança e operação

- Remove escrita direta nas tabelas adaptativas; mutações passam somente pela
  RPC autenticada e vinculada ao dono do card.
- Adiciona índices de chaves estrangeiras e gates SQL reais ao pipeline de
  release.
- Adiciona testes de regressão para ciclo de vida do áudio, fronteiras das Edge
  Functions e contratos de produção.
