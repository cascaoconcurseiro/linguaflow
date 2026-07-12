# Visão de Produto — LinguaFlow vs. Duolingo / Anki / LingQ / Language Reactor

**Pedido do dono (2026-07-12):** "os jogos estão chatos, não inspirados no Duolingo"; "as perguntas das histórias só geram 3 e não escondem o texto"; "falta muita personalização nas configurações do Anki"; "preciso da visão de toda a equipe — UX, diretor de arte, experiência do usuário — sobre o que falta, sem puxa-saco, um sistema real."

Este documento é essa análise. Cada achado foi verificado no código (não é chute) e vem com o **custo de implementação** (é config? é coluna nova? é tabela nova?), pra você decidir com informação real, não só ideia solta.

---

## 0. As duas queixas concretas — confirmadas, não são impressão

**Jogos (`dashboard/js/ui/gameView.js`)**: hoje existem só 2 minijogos — "Ligar Colunas" (matching) e "Ouça e Escolha" (múltipla escolha por áudio). Visualmente é uma paleta escura genérica tipo terminal (`#1e1e2e`/`#89b4fa`, tema "Catppuccin" de programador, não tem nada a ver com a identidade verde/amarela/azul do resto do app — olha o ícone do papagaio vs. essa tela, parecem apps diferentes). O feedback sonoro são osciladores de áudio crus (bip agudo/grave), sem o "ding" gorduroso do Duolingo. Não há combo, não há vidas, não há barra de progresso, não há celebração ao terminar, não há dificuldade progressiva — é sempre a mesma mecânica com palavras diferentes. **Você está certo: comparado ao Duolingo, isso não parece um jogo, parece um formulário com som.**

**Quiz de história (`dashboard/js/ui/storiesView.js:306,342`)**: `normalizeQuiz()` descarta qualquer resposta da IA que não tenha **exatamente 3** perguntas (`return questions.length === 3 ? questions : []`) — não é a IA "decidindo" gerar 3, é uma trava no código. E o pior: `story-quiz-box` é injetado no HTML **antes** de `story-content` (linha 130 vs. 132) e `renderQuiz()` nunca esconde `story-content` — o texto da história continua 100% visível embaixo do quiz. Dá pra rolar a tela e copiar a resposta. Isso não é "não escondeu direito", é **o quiz não faz o que promete**: não testa compreensão de memória, testa capacidade de encontrar-e-colar.

Essas duas eu já classifico como bugs de produto (não "ideias para o futuro") — ver prioridade no fim do documento.

---

## 1. 🎮 Jogos / prática ativa — benchmark Duolingo

O que o Duolingo faz que cria a sensação de "jogo de verdade":
- **Variedade dentro da MESMA sessão**: uma lição mistura tradução, ouvir-e-digitar, falar, montar frase com banco de palavras, selecionar a opção com imagem — o cérebro nunca entra no piloto automático porque o tipo de exercício muda a cada 1-2 perguntas.
- **Economia de risco**: vidas/corações que você perde ao errar (ou "Reta Final" sem erro nenhum permitido) — cria tensão. Hoje no LinguaFlow você pode errar infinitamente sem custo nenhum no Jogo.
- **Combo/multiplicador**: acertar em sequência aumenta o XP por acerto, com um contador visual crescendo na tela — é o principal gerador da sensação de "estou ficando bom nisso agora".
- **Celebração desproporcional**: confete, som de fanfarra, o mascote reagindo — o cérebro associa "terminei" a uma recompensa física, não só a um número.
- **"Lendário"**: rejogar uma lição já dominada em modo "sem erro = grande recompensa" — dá uma segunda vida útil pro conteúdo já visto, em vez de só acumular pó.

**Propostas concretas:**

| Ideia | O que muda | Custo técnico |
|---|---|---|
| **Terceiro minijogo: "Monte a Frase"** — banco de palavras embaralhado, o aluno monta a frase-exemplo do card clicando na ordem certa (exatamente como o Duolingo). Já existe a mecânica de "banco de palavras" no `studyView.js` (exercício builder) — é reaproveitar, não inventar. | Novo modo no menu de Jogo | Zero DB novo — usa `words.context_sentence` que já existe |
| **Combo visual com multiplicador de XP** nos 2 jogos atuais: 3 acertos seguidos = XP em dobro por acerto, com um número crescendo saltitante no canto. | Muda a *sensação* do jogo sem mudar a mecânica | Zero DB — só front |
| **"Vidas" no modo Jogo** (não no Estudo — lá o FSRS não pode ser punido): 3 corações, erra 3 vezes e a partida acaba antes da hora, com convite a tentar de novo. | Cria tensão real | Zero DB |
| **Retrabalhar a skin visual do Jogo** pra usar a MESMA paleta do resto do app (verde/azul/amarelo Duolingo-like) em vez do tema escuro solto — hoje `gameView.js` tem seu próprio `<style>` isolado que nunca herdou `globals.css`. | Consistência de marca | Zero DB — só CSS |
| **Sons "de verdade"** (2-3 arquivos .mp3 curtos de acerto/erro/vitória, tipo Duolingo) em vez de osciladores sintéticos. | Percepção de qualidade | Assets estáticos, zero DB |
| **Novo minijogo "Contra o Relógio"**: mesma lista de palavras due, mas cronometrado (60s), pontuação por velocidade — dá uma variante de alta energia pra quem já domina o vocabulário e quer só manter afiado. | Variedade real | Zero DB — reaproveita `getCardsDue` |
| **Progressão/desbloqueio**: um "path" visual (tipo trilha de unidades do Duolingo) em vez do Jogo ser uma tela solta desconectada do resto — isso é mais estrutural, ver seção 5. | Estrutural | Precisa de tabela nova (`skill_path` ou similar) — deixo pra depois |

---

## 2. 📖 Histórias / Leitura — benchmark LingQ + Language Reactor

O LingQ tem 3 coisas que fazem a leitura "grudar":
- **Gradiente de 5 cores** por nível de exposição (não sei → vi 1x → vi 3x → vi 5x → conheço), não um binário novo/sei. O LinguaFlow hoje é praticamente binário (`rw-new`/`rw-learning`/sem-cor) no Leitor.
- **Widget de vocabulário flutuante** durante a leitura, mostrando a lista de palavras da página atual com status, sem precisar clicar uma por uma.
- **Import em massa de fontes reais**: podcast, canal do YouTube inteiro, feed RSS — o LinguaFlow já importa URL/EPUB (bom!), mas não trata "assinatura" de uma fonte recorrente.

**Propostas concretas para Histórias/Leitor:**

| Ideia | O que muda | Custo técnico |
|---|---|---|
| **Corrigir o quiz** (ver #0): esconder `story-content` enquanto o quiz está ativo (com um botão "Reler a história" que abre de novo, mas fecha o quiz) e permitir de **3 a 5** perguntas em vez de trava fixa em 3. | Conserta o propósito do recurso | Zero DB — só front (`storiesView.js`) |
| **Gradiente de exposição** em vez de binário: contar quantas vezes uma palavra apareceu nas histórias/leituras do usuário e colorir em 3-4 tons (não 2). | Fidelidade ao "conhecimento real" da LingQ | Precisa de uma coluna simples (`words.exposure_count int default 0`, incrementada a cada vez que a palavra aparece num texto novo consumido) — migration pequena |
| **Resumo automático pós-leitura**: a IA gera 2 frases resumindo o que o aluno acabou de ler, ele tenta reescrever com as próprias palavras antes de ver o resumo real — treina produção, não só reconhecimento (Language Reactor/LingQ não tem isso, seria um diferencial nosso). | Exercício de produção real | Zero DB novo — usa `ai.js`, guarda no `stories` existente |
| **"Retomar de onde parei"**: histórias/textos longos hoje não salvam posição de leitura — reabrir sempre volta ao início. | Fricção de retomada | Coluna `stories.last_position int` / mesma coisa em `reader` (hoje é `localStorage`, dá pra manter local mesmo, é rápido) |
| **Áudio sincronizado (karaokê)** — destacar a palavra sendo lida em tempo real durante o "Ouvir Tudo" (hoje toca o áudio mas não sincroniza destaque visual). | Efeito Language Reactor de imersão | Médio: precisa de timestamps por palavra do TTS (Kokoro/Google não retorna isso nativamente) — mais caro, marcar como "nice to have", não prioridade |

---

## 3. 🎬 Extensão (vídeo) — benchmark Language Reactor

Isso já é o ponto mais forte do LinguaFlow hoje — `content/subtitle-engine.js` (4182 linhas) já cobre legendas duplas, clique-pra-traduzir e captura de contexto de vídeo pro Cofre, que é exatamente a proposta de valor central do Language Reactor. Onde ainda dá pra aprofundar:

| Ideia | O que muda | Custo técnico |
|---|---|---|
| **"Mineração" com auto-pause**: pausar o vídeo automaticamente quando aparece uma palavra que o aluno NUNCA viu (hoje o fluxo é manual: o aluno precisa notar e clicar). | Reduz a chance de passar batido por uma palavra nova | Zero DB — lógica no content script comparando com `known_words`/`words` já carregados |
| **Replay "só esse trecho"**: um botão de voltar 3s específico da legenda atual (não só o seek nativo do player), pra reescutar só a frase que não entendeu. | Reduz fricção de reescuta | Zero DB — só player |
| **Lista de vocabulário por vídeo/série**: hoje uma palavra salva de vídeo guarda o contexto (`video_url`/`video_title` em `words`), mas não existe uma tela "todo o vocabulário que salvei assistindo a Série X" agrupado. | Fecha o ciclo "assisti → aprendi X palavras desse episódio" | Zero DB novo — é uma VIEW/agrupamento por `video_url` sobre dado que já existe, só falta a tela |

---

## 4. 🗂️ Cofre / Configurações SRS — benchmark Anki

Comparado ao Anki puro, o LinguaFlow já tem bastante profundidade real (retenção FSRS, learning steps, intervalo de graduação, modificador de intervalo, limite de novas/dia, limite de revisões/dia, leech threshold+ação) — isso **não é genérico**, é de fato nível avançado. O que ainda falta pra ser "nível Anki completo":

| Ideia | O que muda | Custo técnico |
|---|---|---|
| **Perfis por categoria** (phrasal verb / idiom / slang / word): hoje as configs de SRS são globais — no Anki, cada baralho pode ter presets diferentes. Um aluno pode querer intervalos mais curtos pra idioms (esquece mais rápido) e mais longos pra vocabulário básico. | Personalização real, não cosmética | Precisa de uma tabela nova `srs_presets` (category → overrides) OU simplificar: prefixar chaves existentes por categoria em `settings` (`graduating_interval:idiom`) — dá pra fazer sem tabela nova, só convenção de chave |
| **Otimização automática do FSRS** ("Optimizer" do Anki): hoje os pesos do FSRS são fixos/genéricos pra todo mundo. O Anki recalcula os 17 pesos a partir do HISTÓRICO REAL de acertos/erros de cada pessoa — isso é a diferença entre um algoritmo genérico e um que aprendeu o seu esquecimento específico. | Precisão real de agendamento | Alto: precisa rodar o algoritmo de otimização FSRS (existe implementação de referência em JS/Python) sobre `review_log`, provavelmente como Edge Function agendada mensalmente, salvando pesos em `settings` |
| **Modo de estudo customizado** ("Custom Study" do Anki): "revisar só leeches", "revisar só uma categoria", "adiantar cards que só vencem amanhã" — hoje só existe "sessão normal" e "filtro por tópico" (Onda 2.2). | Flexibilidade de sessão | Zero DB — é UI sobre `getCardsDue`/`getWordsByCategory` que já existem, só falta expor os filtros |
| **Fuso/hora de virada do dia customizável**: o Anki deixa escolher a que horas o "dia" vira (padrão 4h da manhã, pra quem estuda de madrugada não perder tudo pro dia seguinte). O LinguaFlow usa meia-noite local fixo (`local-day.js`). | Edge case, mas real pra quem estuda tarde da noite | Uma chave de settings (`day_rollover_hour`) + ajuste no `local-day.js` para aceitar offset — baixo custo, mas toca lógica sensível (fazer com cuidado e testes) |
| **Tamanho de fonte / aparência do card de estudo**: Anki deixa customizar o template visual do card. Aqui pelo menos um slider de tamanho de fonte pro texto do card ajudaria acessibilidade. | Acessibilidade | Zero DB — CSS var + 1 chave de settings |

---

## 5. 🏠 Início / arquitetura geral — visão de Diretor de Arte + UX

Isso é mais estrutural — não é 1 tela, é como as telas se conectam.

- **Falta uma "trilha" visual.** Hoje a navegação é uma lista plana de 7 botões no topo (Início/Histórias/Leitor/Ligas/Cofre/Estatísticas/Config) sem hierarquia nem progresso visível. O Duolingo tem UM caminho visual (o "path" de unidades) que comunica "você está aqui, isso vem depois" — dá senso de jornada. Aqui cada tela é uma ilha. Não estou sugerindo copiar o path literal (não faz sentido pro seu conteúdo, que não é linear por unidades fixas), mas a página Início poderia ter uma seção "Seu próximo passo sugerido" mais proeminente (já existe o "plano do professor" em texto — poderia virar um cartão visual, com botão de ação direto, não só um parágrafo).
- **Identidade visual inconsistente entre telas.** `gameView.js` tem paleta própria (escura, tipo terminal). O resto do app é a paleta verde/branco Duolingo-like. Isso quebra a sensação de "app único" — é a crítica de "diretor de arte" mais direta que dá pra fazer olhando o código.
- **Nenhuma tela de "conquistas"/badges.** Duolingo e LingQ têm marcos visuais (primeira semana de streak, 100 palavras salvas, primeira história terminada) — hoje o LinguaFlow tem os NÚMEROS (estatísticas) mas não tem o RITUAL de comemorar marcos. Isso é psicologicamente diferente: número é informação, badge é celebração.
- **Onboarding termina e não guia o próximo clique.** Depois do onboarding (Onda P1), o aluno cai no Início — funciona, mas não há um "tour" de 10 segundos pelas 7 abas pra quem nunca usou um app de SRS antes (público de Anki já sabe o que é um "card"; público vindo do Duolingo pode nem saber o que é "revisar").

**Propostas:**

| Ideia | Custo técnico |
|---|---|
| Unificar a paleta do Jogo com `globals.css` | Zero DB |
| Cartão de "Badges"/conquistas simples (streak 7/30/100 dias, 50/100/500 palavras salvas, 1ª/10ª história) — dado já existe todo em `user_stats`/`words`/`stories`, só falta a UI e uma tabela pequena pra marcar quais já foram vistos/celebrados (evita repetir a animação toda vez) | Tabela pequena nova: `achievements_seen (user_id, achievement_key, seen_at)` |
| Cartão "Próximo passo" mais visual no Início, substituindo o parágrafo de texto do "plano do professor" por um componente com botão de ação | Zero DB — já existe o dado (`professorTip`), é reformatar a UI |
| Tour rápido no primeiro acesso (reaproveitar o padrão de onboarding já existente) | Zero DB |

---

## 6. O que eu NÃO recomendo copiar (e por quê)

Parte de "visão real, sem puxar saco" é também dizer não pra coisa que não serve:
- **Corações/vidas no modo ESTUDO (não Jogo)**: no Duolingo faz sentido punir erro porque o conteúdo é fixo e repetível. No FSRS, errar é DADO — é assim que o algoritmo aprende que você esqueceu. Colocar "vida" no Estudo brigaria com o próprio motor de repetição espaçada. Vidas só fazem sentido no modo Jogo (que já é "prática solta", não agendamento).
- **Monetização/loja de gemas**: você não pediu, e adicionar economia de moeda sem um produto pago por trás é só complexidade decorativa.
- **Path linear de unidades fixas** (tipo Duolingo "Unidade 1, 2, 3..."): seu conteúdo é gerado dinamicamente (IA, vídeo, importação) — não é um currículo fixo como o do Duolingo. Forçar uma trilha linear entraria em conflito com o que já funciona bem aqui (liberdade de conteúdo).

---

## 7. Priorização — se eu tivesse que escolher por onde começar

1. **Corrigir o quiz de história** (esconder o texto, permitir mais perguntas) — é um bug de propósito, não feature nova. Baixíssimo custo, alto impacto na credibilidade do recurso.
2. **Terceiro minijogo "Monte a Frase" + combo visual + paleta unificada no Jogo** — resolve a queixa "chato" com o menor custo técnico (reaproveita mecânica que já existe no Estudo).
3. **Modo de estudo customizado** (revisar só leeches / só uma categoria) — o dado já existe, é só expor.
4. **Badges/conquistas no Início** — impacto emocional alto, custo baixo (uma tabela pequena).
5. Depois disso, entramos no território mais caro (otimizador FSRS pessoal, karaokê sincronizado, perfis de SRS por categoria) — são reais, mas são semanas de trabalho, não sessões.

Me diga por onde quer que a equipe comece e eu já entro construindo — com o papel certo assumindo cada frente (Prof. didático nos jogos/histórias, Eng. SRS nas configs avançadas, Eng. Backend nas migrations que cada item pedir), documentado do jeito de sempre.
