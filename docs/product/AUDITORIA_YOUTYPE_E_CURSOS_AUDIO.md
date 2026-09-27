# YouType: auditoria observável e plano para LinguaFlow

**Data da observação:** 2026-09-27  
**Fonte:** páginas e fluxos autenticados de `youtype.app`, incluindo páginas de curso e aulas de demonstração/acesso aberto.  
**Objetivo:** extrair capacidades e requisitos de produto para uma ferramenta original de prática por áudio e digitação no LinguaFlow.

## Limites desta análise

- O catálogo e os índices de capítulos foram examinados em todos os 12 cursos. Nos capítulos bloqueados, só foi possível observar título, quantidade de exercícios e acesso; o conteúdo interno e a execução dessas aulas não foram acessados.
- Foram exercitados campos de digitação, submissão, erro, correção, revelação de resposta, revisão linguística e saída com retomada numa aula B2 aberta. Foram examinadas preparação, dificuldades, preferências de áudio e uma aula aberta de viagem.
- Nesta continuação, os modos Medium e Hard foram abertos dentro da aula Travel A1; Easy já havia sido usado para concluir uma questão. Pausa/retomada foi verificada com uma resposta parcial.
- O navegador disponibiliza a interface e seus estados, mas não uma escuta/captura de áudio para este teste. A audibilidade, qualidade acústica e identidade da voz continuam por validar com reprodução audível num dispositivo.
- O front-end, serviços, banco de dados e regras de autorização do YouType não estão no escopo acessível. Não se inferem detalhes internos a partir do que aparece no navegador.
- Esta análise preserva apenas a estrutura de produto. Frases, gravações, ilustrações, marca, textos de lições e composição visual do YouType não devem ser importados ou reproduzidos.

## Catálogo observado

Os cursos mostram capítulos sequenciais; nos cursos observados, os dois primeiros aparecem abertos e os posteriores aparecem como exclusivos para membros. O estado de acesso do LinguaFlow deve ser decidido pelo próprio produto, sem copiar o modelo comercial.

| Curso observado | Nível exibido | Estrutura exibida | Forma curricular |
|---|---:|---:|---|
| Build Better Paragraphs | B2 | 20 capítulos, 200 questões | Construção e revisão de parágrafo: ideia central, apoio, evidência, relações entre ideias, coesão e modelo final. |
| Master All 16 English Tenses | Não classificado | 16 capítulos, 160 questões | Um foco de tempo/aspecto por unidade, dos usos presentes até formas passadas relacionadas ao futuro. |
| English Sentence Building from Scratch | Não classificado | 55 capítulos, 8.865 questões | Estruturas graduadas de frase e uso; as duas primeiras unidades têm 218 e 165 questões, respectivamente. A carga por unidade é muito desigual. |
| 600 Essential English Words for Everyday Life | A1 | 24 capítulos, 600 questões | Vocabulário agrupado por temas cotidianos; 25 questões por capítulo. |
| My First ABC: A Letter and Word Adventure | A1 | 31 capítulos, 260 questões | Progressão alfabética com palavras e verificações adicionais em alguns pontos. |
| My First English Sentences | A1 | 20 capítulos, 200 questões | Moldes de frase iniciais e temas familiares; 10 questões por capítulo. |
| I Know 100 High-Frequency English Words | A1 | 20 capítulos, 200 questões | Palavras funcionais e categorias gramaticais numa sequência curta; 10 questões por capítulo. |
| I Can Read 30 Mini English Stories | A1 | 30 capítulos, 240 questões | Uma história curta por unidade; 8 questões por capítulo. |
| Word Power Through Roots and Affixes | B1 | 20 capítulos, 200 questões | Prefixos, sufixos e raízes organizados em famílias; 10 questões por capítulo. |
| Speak Fluent English with 850 Core Words | A1 | 85 capítulos, 1.746 questões | Vocabulário e linguagem em situações/temas; duração variável, aproximadamente 16–28 questões por unidade no índice observado. |
| Travel English: 150 Essential Sentences | A1 | 15 capítulos, 150 questões | Missões de viagem: planejamento, aeroporto, transporte, hospedagem, alimentação, saúde e emergências; 10 por capítulo. |
| Survival English: 300 Sentences for Real Life | A1 | 30 capítulos, 300 questões | Situações cotidianas e de segurança; 10 por capítulo. |

As estruturas variam em duração e tipo de conteúdo. Isso favorece um catálogo dirigido por dados e templates de atividade, em vez de um único curso gigante ou um conjunto de arrays dentro da interface. Para o primeiro lançamento, a recomendação é manter aulas curtas e duração declarada; não repetir unidades com centenas de respostas.

## Fluxo e interação observados

### Preparação

Antes de começar, uma folha/modal apresenta curso, capítulo, número de questões e seletor Easy/Medium/Hard. A preparação também oferece configurações. Os níveis explicitam o apoio:

- **Easy:** frase inglesa completa visível enquanto a pessoa digita e ouve.
- **Medium:** áudio com a primeira letra de cada palavra.
- **Hard:** áudio sem letras iniciais nem pistas de comprimento.

### Descrição da interface e UX observadas

- **Navegação do produto:** barra lateral persistente organiza área de aprendizagem, cursos, análise, revisão, notas, vocabulário, erros e placar. A barra superior concentra idioma, assinatura, ajuda e tema. Em tela de aula, essa navegação some para liberar espaço de foco; ficam “voltar aos capítulos”, capítulo/questão atual, tema, ajustes e pausa.
- **Preparação:** modal grande sobre a página de capítulos escurecida. Coluna esquerda reúne miniatura do curso, nome do capítulo e resumo; coluna direita tem as três opções Easy/Medium/Hard em cartões clicáveis com ícone e uma linha explicativa que muda com a seleção. Rodapé separa ajustes, repetir o capítulo e continuar. No estado observado, Easy vinha selecionado por padrão.
- **Exercício:** fundo escuro, texto claro e destaque lilás para foco/seleção; barra fina de progresso junto ao topo. Capítulo e posição ficam centralizados no cabeçalho; cronômetro, pontos e combo ficam agrupados no canto superior direito. O conteúdo ocupa área ampla no centro, com espaço negativo para manter atenção na frase/escuta. Controles de navegação e atalhos ficam alinhados na faixa inferior. Um mascote pequeno aparece no canto inferior direito.
- **Representação por dificuldade:** Easy mostra a frase e campos sublinhados separados por palavra; o campo ativo recebe sublinhado/foco lilás. Medium troca a frase por iniciais alinhadas a cada campo, mantendo entradas separadas por palavra. Hard troca as iniciais por um indicador de áudio e mantém uma linha única de escrita segmentada pelo avanço atual; não revela iniciais nem tamanho individual das palavras. Isso confirma que os modos alteram efetivamente o exercício, não só a etiqueta na preparação.
- **Teclado e feedback:** não há teclado virtual na área da aula. Usa-se o teclado físico; Espaço avança de palavra e submete quando todos os campos estão preenchidos. Pontuação opcional fica visualmente junto ao campo final. A faixa inferior exibe Replay (Ctrl + apóstrofo), dica (Ctrl + Shift + ponto e vírgula), conferir (Enter/Espaço), revelar (Ctrl + ponto e vírgula) e navegação. Os atalhos são apresentados como pequenas teclas rotuladas, não como teclado.
- **Pausa e persistência:** a pausa abre a sobreposição “Take a moment”; continuar preservou os caracteres já digitados no campo atual. Ao encerrar, o site informa que posição e progresso confirmado serão mantidos. Na saída observada, a questão concluída continuou registrada (1/150); a resposta parcial da questão ainda não enviada não foi confirmada como persistente entre sessões.
- **Estados do áudio:** o áudio inicia ao entrar no exercício; Replay aparece desabilitado enquanto a leitura automática está em andamento e volta a habilitar quando ela termina. As preferências mostravam velocidade 1×, duas leituras, “Exercise audio” ligado, “Typing and feedback sounds” ligado e redução de movimento desligada. A opção “Try key sound” foi acionada com a preferência ligada. Como não há captura/escuta no canal de teste, nenhum desses cliques comprova som audível ou sua qualidade.
- **Direção útil para LinguaFlow:** manter a hierarquia de preparação → exercício → revisão/resultado, os modos de suporte realmente distintos e a digitação palavra a palavra; redesenhar com identidade editorial própria do LinguaFlow. Não reproduzir o fundo escuro, composição, mascote, ícones, cores ou arte da referência. Garantir alternativa a atalhos, foco anunciado, contraste, responsividade e respeito a movimento reduzido.

### Exercício de digitação

- A frase-alvo fica visível no Easy e o espaço de resposta é dividido em campos por palavra, sublinhados e focados no campo atual.
- Não apareceu um teclado virtual na tela. O texto digitado aparece dentro dos campos; o teclado físico é o mecanismo de entrada. Há keycaps pequenos para atalhos, que não formam um teclado virtual.
- A interface instrui a usar Espaço para avançar entre palavras e, quando os campos estão completos, submeter. Enter também confere. A pontuação é opcional.
- Enviar uma resposta com erros destaca os campos a corrigir e informa que o restante foi preservado. A correção pode ser reenviada.
- Há ações para repetir o áudio, pedir uma dica, mostrar/esconder a resposta, voltar, avançar, pular e pausar. Mostrar resposta abre uma análise por partes da frase.

### Som e preferências

Em configurações foi possível observar os controles de áudio do exercício, sons de digitação e feedback, redução de movimento, quantidade de leituras e velocidade. A preferência informa que fica salva no navegador. A sessão mostrou duas leituras e velocidade 1×. Esses sinais confirmam configurações expostas, mas não provam que o áudio tocou de forma audível nem a qualidade da voz.

### Feedback, progresso e retomada

- A resposta aceita abre uma revisão com funções gramaticais, IPA, classe gramatical e consulta individual do significado; há ações para salvar palavras e criar uma nota.
- A sessão mostra questão atual, barra de progresso, tempo ativo, pontos e combo. Erros e dicas afetam a construção de combo.
- A confirmação de saída informa que posição e progresso do curso serão mantidos para continuar depois.
- A pausa dentro da sessão preservou a resposta parcial no campo quando o teste foi retomado. A evidência não demonstra persistência dessa resposta parcial após fechar a sessão; a questão confirmada e o progresso geral permaneceram salvos.
- Ao terminar capítulo B2 anterior, o resumo apresentou questões feitas, precisão e tempo da sessão, progresso no curso e indicação do próximo capítulo.

## O que já existe no LinguaFlow

- O modo ditado em [studyView.js](../dashboard/js/ui/studyView.js) toca a frase contextual por TTS, recebe a frase completa num único campo, oferece replay e avalia a resposta. Há também montagem de frase por palavras em outra atividade.
- O serviço em [tts.js](../dashboard/js/core/tts.js) já coordena reprodução natural, cache e fallback; há uma opção local Kokoro e configurações de voz/velocidade em outros fluxos.
- Não encontrei tabelas de catálogo de cursos ou aulas nas migrations verificadas. A estrutura observada é, portanto, um novo domínio de conteúdo e progresso; não uma repetição do SRS FSRS existente.

**Consequência:** criar um percurso de cursos com progresso próprio, reutilizando os serviços de áudio e utilitários de estudo quando os contratos coincidirem. Manter FSRS responsável pelas revisões de cards; não registrar cada exercício de curso como uma revisão FSRS artificial.

## Escopo proposto para o LinguaFlow

Entregar a mesma classe de interação — ouvir, digitar palavra por palavra, receber pistas graduais e feedback reparável — com frases e cursos originais, idioma de apoio prioritário em português brasileiro e identidade LinguaFlow. O plano não inclui copiar arquivos de áudio, frases, imagens, marca, tema exato, textos de interface distintivos ou conteúdo de aulas bloqueadas.

“Mesmo som” deve significar uma experiência consistente de inglês falado (voz, sotaque, ritmo, velocidade e repetição escolhidos para o aprendiz), não a cópia de gravações do YouType. Começar pelo TTS que o LinguaFlow já usa, medir latência/qualidade e rever licenças e custos antes de escolher gravações ou fornecedor específico. Efeitos de tecla/acerto/erro devem ser originais, curtos, configuráveis e desligáveis.

## Plano executável, ordenado por dependência

### Fase 1 — Requisitos e issue

1. Criar uma Issue de feature antes de tocar código; registrar este escopo, critérios de aceite, risco de conteúdo/licenças e plano de validação. Criar branch `codex/<issue>-course-listening-typing` a partir de `main`.
2. Definir o primeiro recorte vertical: uma unidade original de **Travel A1** e uma unidade original de **Writing/Paragraph B2**. Cada uma deve ter exercícios curtos, áudio, 3 níveis, retomada e resultado. Isso exercita os dois extremos observados sem importar conteúdo do catálogo de referência.
3. Especificar as métricas operacionais: falhas/latência de áudio; abandono e retomada; acerto por nível/tipo de apoio; erros corrigidos por exercício. Não guardar texto bruto digitado por padrão.

**Saída verificável:** Issue aprovada internamente pelo repositório, critérios testáveis e dois roteiros didáticos originais.

### Fase 2 — Conteúdo e progresso persistentes

1. Modelar cursos, unidades versionadas e exercícios estruturados no PostgreSQL/Supabase. Guardar ordem, nível CEFR, tipo pedagógico, idioma-alvo, texto próprio, fragmentação/tokenização, metadados de foco e configuração de áudio — sem frases copiadas.
2. Modelar matrícula/estado de acesso, progresso por unidade e tentativa resumida (correto, nível, dicas, tempo, data e idempotency key). Progresso e escrita devem ser escopados por `auth.uid()`; RLS deve impedir leitura/escrita entre contas. O servidor valida publicação e autorização; o cliente nunca concede acesso com um booleano.
3. Definir política de versão/publicação e uma forma editorial mínima de cadastrar, revisar, pré-visualizar e publicar cursos. Não usar conteúdo fixo dentro do frontend nem exigir migration para cada nova aula.
4. Manter progresso retentável: salvar avanço em limites seguros, retomar no próximo exercício e tratar duplicação/reconexão sem dupla contagem.

**Dependência:** conteúdo e contratos de progresso vêm antes da UI do catálogo.  
**Saída verificável:** migration append-only, política RLS e fluxos de escrita/leitura documentados e testáveis.

### Fase 3 — Motor de exercício e som

1. Acrescentar um modo de **transcrição por palavra** ao domínio de cursos: foco visível, entrada física palavra a palavra, avanço com Espaço, Enter para verificar e pontuação opcional.
2. Oferecer os três níveis por dados: frase completa; iniciais; áudio sem pistas. Confirmar no cliente e servidor qual suporte foi usado para interpretar resultado, mas não para expor respostas do modo Hard.
3. Usar o serviço TTS do LinguaFlow, com play/replay, repetição e velocidade persistidos em preferência do usuário. Ao falhar, mostrar erro, permitir nova tentativa e não avançar silenciosamente.
4. Criar efeitos originais opcionais de digitação e feedback com controles de volume/desativação; respeitar redução de movimento e preferência de silêncio. Não tocar um som a cada evento DOM de modo que gere ruído, atraso ou feedback inacessível.
5. Normalizar resposta com regra explícita para capitalização e pontuação; não aceitar palavras-alvo divergentes. Em erro, marcar campos e permitir reparar mantendo os acertos. Dica e revelação devem ser anunciadas ao leitor de tela e refletidas nos resultados.

**Saída verificável:** uma sessão de ponta a ponta com áudio TTS real, teclado físico, feedback correto/incorreto, retry, pausa, erro de áudio e retomada.

### Fase 4 — Catálogo, aula e resultados

1. Montar catálogo pesquisável por tema e CEFR e detalhe de curso com etapas, quantidade/duração aproximada, estado de progresso e unidade seguinte.
2. Construir preparação de aula com dificuldade, som e configurações persistentes; tela de prática com progresso, estado de pausa/loading/erro e foco acessível.
3. Mostrar resultado honesto: acertos, erros, dicas, tempo ativo e conclusão; indicar a próxima ação. Integrar vocabulário a cards somente por ação explícita do aprendiz.
4. Expandir o catálogo por templates distintos de habilidade: vocabulário temático, padrões gramaticais, frases úteis, histórias e produção escrita. O esqueleto pode compartilhar navegação e estado; exercícios não devem virar o mesmo tipo de pergunta para todo conteúdo.

**Saída verificável:** os dois cursos-piloto permanecem navegáveis de catálogo a resultado em celular e desktop, com progresso por conta.

### Fase 5 — Conteúdo, validação e lançamento

1. Validar corpus por nível CEFR, naturalidade, áudio, IPA e tradução em português; cada lição declara objetivo observável e contexto, com revisão humana antes de publicação.
2. Testar unidades de duração curta, português de apoio, inglês americano/britânico conforme configuração e entrada de teclado móvel; testar leitor de tela, foco, contraste e `prefers-reduced-motion`.
3. Cobrir estados vazio/loading/erro/offline/duplicado, progresso entre duas contas, autorização, limitação de acesso e cache TTS. Fazer teste de navegador real e escuta humana; contratos locais não provam som ou RLS de produção.
4. Lançar atrás de feature flag, observar erros de reprodução e retomada, comparar conclusão/acerto por dificuldade e manter procedimento de desativação/rollback.
5. Só depois ampliar conteúdo aos demais formatos do catálogo. Uma expansão de 12 cursos exige autoria e QA próprios; não é uma simples clonagem de 12 páginas.

## Critérios de aceite da primeira entrega

- A pessoa começa uma aula de cada piloto e a retoma após fechar/recarregar sem perder a posição confirmada.
- Easy revela a frase; Medium revela iniciais; Hard não mostra texto ou pista de comprimento. O estudante pode repetir o áudio em cada modo.
- Digitação ocorre em campos por palavra com foco visível e avanço previsível; pontuação opcional; erros ficam marcados e podem ser corrigidos sem apagar campos corretos.
- Áudio indisponível, reprodução lenta e rede caída geram mensagem acessível e retry; pontuação/progresso só atualizam uma vez por tentativa.
- Sons de voz, digitação e feedback podem ser ajustados ou desligados, persistem por usuário e passam teste auditivo humano em computador e celular.
- O resultado explica desempenho e próximo passo; não confunde precisão de cópia com domínio, fluência ou retenção.
- Curso, conteúdo e progresso são servidos por fonte persistente, com RLS e sem dados de tentativa de outra conta.
- Interface própria do LinguaFlow, conteúdo original e fonte/licença de cada mídia registrados.

## Riscos e mitigação

1. **Áudio falha por autoplay, rede, TTS ou cache:** testar em navegador/dispositivo real, oferecer botão de play imediato, status e retry; métrica de erro e latência.
2. **Cursos enormes tornam a experiência cansativa e difícil de validar:** limitar extensão das unidades, mostrar tempo estimado e dividir conteúdo por objetivo; pilotar o número de itens com aprendizes.
3. **Conteúdo ou visuais se aproximam demasiado da referência:** escrever currículo próprio, trocar taxonomia e composição, criar áudio licenciado/original e revisão de proveniência antes do release.
4. **Progresso incorreto com várias abas/rede instável:** atualizações idempotentes, versão/ordem de exercício no servidor e teste de concorrência/reconexão.
5. **Áudio vira gabarito ou cópia visual vira falsa medida de compreensão:** reportar habilidade e nível de suporte usado; comparar separadamente escuta sem texto, transcrição e cópia.

## Questões ainda não comprovadas

- Se o som de voz, feedback e teclas foi audível; a ferramenta de browser observou controles e estados, não captura sonora.
- Como são implementados TTS, áudio, schema, gating de membros, sincronização e análise no servidor do YouType.
- Conteúdo, critérios de correção e resultado interno dos capítulos marcados “Members only”.
- Comportamento móvel em dispositivo real e com teclado virtual do sistema.
