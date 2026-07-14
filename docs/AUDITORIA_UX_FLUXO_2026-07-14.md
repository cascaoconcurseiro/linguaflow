# Auditoria UX, fluxo e concorrência — 2026-07-14

**Coordenação:** Codex  
**Frentes:** direção de UX/arquitetura de informação, product design de aprendizagem e engenharia frontend/áudio.  
**Regra do projeto:** nenhuma função será removida. Recursos serão priorizados, agrupados e revelados no momento certo.

## Diagnóstico executivo

O LinguaFlow tem boas funções, mas apresenta três problemas sistêmicos:

1. **Recordar, avaliar e explorar acontecem na mesma tela e ao mesmo tempo.** O aluno recebe card, tutor, vídeo, exemplos, mnemônico, YouGlish, Tatoeba, chunks, navegação e estatísticas como elementos concorrentes.
2. **A arquitetura assíncrona não possui um dono único por operação.** Áudio, navegação, vídeo, legendas e ações de card podem continuar depois que o estado que os iniciou já mudou.
3. **Todas as funções têm peso visual semelhante.** A ausência de progressive disclosure faz Home, Cofre e Configurações parecerem inventários de features, não fluxos orientados a uma tarefa.

A referência correta do Duolingo aqui não é copiar cores ou ilustrações. É aplicar: uma decisão principal por estado, feedback claro, conteúdo secundário sob demanda e conclusão explícita de cada fluxo.

## P0 — bugs técnicos confirmados

### Áudio toca duas vezes

- `studyView.js` toca o áudio ao apresentar o card e volta a tocar quando a geração assíncrona de chunks termina.
- `playNaturalAudio()` cancela o áudio atual **antes** de aguardar cache/rede. Duas chamadas ainda pendentes podem resolver depois e criar dois players simultâneos.
- O fallback `speechSynthesis` não é cancelado por `stopAudio()`.
- `audio.onerror` e a rejeição de `play()` podem acionar o fallback mais de uma vez sem trava idempotente.

**Correção:** um `playbackGeneration` único; validar o token depois de cada `await`; cancelar HTMLAudio e Web Speech; fallback `once`; autoplay no máximo uma vez por `cardPresentationId`; enriquecimento assíncrono nunca dispara autoplay.

### Races de navegação e estudo

- `app.navigate()` inicia renders sem `navigationEpoch`/AbortSignal. Dois renders de Estudo podem terminar fora de ordem e um render já oculto pode tocar áudio.
- Estudo não registra cleanup completo ao sair: áudio, YouGlish, YouTube, timer e handler de teclado precisam ser encerrados juntos.
- `handleGrade()` remove o card da fila e contabiliza feedback antes da persistência; falha precisa restaurar o estado ou oferecer retry, nunca avançar silenciosamente.
- `buryCard()` não possui mutex; clique duplo pode executar dois `shift()` e pular o próximo card.
- `content/web-reader.js` é injetado em `<all_urls>`, inclusive no próprio dashboard do LinguaFlow. Ele acrescenta listeners globais de `mouseup`, `dblclick`, `click` e `keydown`; um duplo clique pode abrir múltiplos popups e as respostas de tradução não possuem token da seleção atual. Os domínios próprios devem ser excluídos no manifest/guard, e a interação precisa ser deduplicada.

### Vídeo e legendas

- O loop do YouTube possui dois donos do fim do clipe: polling e evento `ENDED`; ambos podem reiniciar o mesmo ciclo.
- Navegação YouTube da extensão possui pipelines concorrentes e fetch antigo pode publicar cues num vídeo novo.
- Tradução de legenda DOM pode chegar atrasada e substituir a legenda atual.
- Listeners de vídeo podem se acumular em sessões longas.

**Correção comum:** máquina de estados por recurso, epoch/AbortController, commit condicionado ao id atual e exatamente um dono para cada transição.

## P0 — novo fluxo de Estudo: modo foco

### Entrada na sessão

- Ocultar topbar global e sidebar.
- Cabeçalho mínimo: `Sair`, progresso discreto e menu `⋯`.
- Nenhuma estatística, missão ou navegação compete com o card.

### Frente do card

Mostrar somente:

1. áudio/replay;
2. prompt ou frase com lacuna;
3. ação principal `Revelar`.

`Deixar para amanhã`, suspender e outras exceções ficam em `⋯`. Tutor, vídeo e recursos permanecem invisíveis. A IA não pode trocar a frase durante a tentativa; enriquecimento tardio vale para o próximo encontro ou para a gaveta Explorar.

### Verso do card

Mostrar no mesmo card:

1. resposta;
2. pronúncia;
3. tradução;
4. notas `Errei`, `Difícil`, `Bom`, `Fácil`, com intervalos reais.

Vídeo vira a ação compacta `Ouvir trecho original`; iframe só nasce após clique. Tutor vira `Entender esta frase`. Palavra isolada, mnemônico, YouGlish, Tatoeba e chunks ficam na gaveta `Explorar`, sem exclusão de recursos.

### Depois da nota

- Persistir primeiro; somente sucesso confirmado encerra o estado.
- Avançar para o próximo card.
- Undo fica numa barra discreta.
- XP e celebrações fortes ficam no resumo da sessão, não interrompem cada repetição.

### Mobile

- Um único scroll.
- Card ocupa a área central.
- Notas numa linha compacta de quatro colunas, com alvo mínimo de 44 px.
- Recursos abrem em bottom sheet.
- Remover a compensação atual de 186 px criada pelo dock 2×2.

### Exercícios ativos

- Resposta errada agenda `Errei`.
- Resposta correta pergunta `Como foi?` e oferece `Difícil`, `Bom`, `Fácil`.
- Nunca avançar por timer; o aluno confirma a transição.

## P1 — reorganização das páginas

### Início

Ordem recomendada:

1. **Hoje:** próxima sessão, quantidade e CTA principal.
2. **Missões:** progresso acionável do dia.
3. **Insights:** retenção, diagnóstico e forecast recolhíveis.
4. **Conquistas e atividade:** abaixo, sob demanda.

Ofensiva, retorno, plano, diagnóstico, métricas, forecast, CTAs, conquistas, heatmap e missões não devem compartilhar o primeiro nível visual.

### Cofre

- Busca como primeiro controle.
- Categorias como chips.
- Alfabeto A–Z dentro de `Filtros`.
- Item mostra palavra e tradução; detalhes expandem contexto/status.
- Editar, suspender e excluir ficam em menu contextual.
- Banner de geração só aparece quando há itens realmente incompletos.

### Histórias

- Separar `Criar` de `Ler` como estados.
- Ao abrir uma história, ocultar gerador e histórico.
- Toolbar compacta; ouvir, quiz e concluir aparecem conforme a etapa.
- Quiz/conclusão no fim da leitura, sem três CTAs equivalentes no cabeçalho.

### Configurações

Agrupar em cinco seções:

1. Aprendizado;
2. Áudio;
3. Conteúdo e IA;
4. Notificações;
5. Dados e conta.

FSRS detalhado e perfis por categoria ficam em `Avançado`. Defaults devem ser bons o suficiente para a maioria nunca precisar abrir essa área.

### Navegação

Mobile persistente: `Início`, `Conteúdo`, `Cofre`, `Mais`. Stories/Reader ficam em Conteúdo; Ligas, Estatísticas, Configurações, tema e sair ficam em Mais. Desktop mantém 4–5 destinos primários e `Mais`. Nada é removido.

## P2 — sistema visual e qualidade

- Substituir estilos inline por componentes/tokens.
- Uma CTA primária por estado.
- Escala de espaçamento de 8 px e larguras máximas consistentes.
- Loading, erro, vazio, retry e salvamento com padrões únicos.
- Waveform só anima durante playback e respeita `prefers-reduced-motion`.
- O aria-live do card não pode anunciar a palavra escondida.
- Reservar espaço ou postergar enriquecimentos para evitar layout shift antes da nota.

## Ordem de execução aprovada pela auditoria

1. Exclusão mútua do áudio + testes de concorrência.
2. `navigationEpoch`, cleanup de Estudo e locks de nota/bury.
3. Máquina de estados do YouTube/legendas.
4. Modo foco do Estudo.
5. Frente, verso, dock mobile e gaveta Explorar.
6. Exercícios ativos e acessibilidade.
7. Home, Cofre, Histórias, Configurações e navegação.
8. Consolidação do design system.

## Critérios de aceite da primeira entrega

- Um card produz no máximo um autoplay por apresentação.
- Sair/voltar/trocar rota encerra áudio, vídeo, timers e requests obsoletos.
- Clique duplo em nota ou bury gera uma única operação.
- Antes de revelar, somente o card e sua ação principal ficam visíveis.
- Nenhuma função existente desaparece; recursos secundários continuam acessíveis em gavetas/menu.
- Mobile não possui dois scrolls nem dock 2×2 ocupando o card.
- Falha de persistência não avança o card nem concede feedback de sucesso.
